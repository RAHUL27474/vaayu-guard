namespace VaayuMonitor.Agent;

public class Worker(
    ILogger<Worker> logger,
    AgentOptions options,
    WindowScanner scanner,
    LocalQueue queue,
    BackendClient backend,
    ActiveTabStore activeTabs,
    SelfUpdater updater) : BackgroundService
{
    private const int BatchSize = 50;
    private const int WindowActivityBatchSize = 100;
    private static readonly TimeSpan MinBackoff = TimeSpan.FromSeconds(5);
    private static readonly TimeSpan MaxBackoff = TimeSpan.FromMinutes(5);

    private DeviceState? _device;
    private TimeSpan _backoff = MinBackoff;
    private DateTimeOffset _nextFlushAttempt = DateTimeOffset.MinValue;
    private DateTimeOffset _nextUpdateCheck = DateTimeOffset.UtcNow.AddMinutes(1);
    private DateTimeOffset _lastForcedUpdateCheck = DateTimeOffset.MinValue;

    // Last tick's (process, title) set — only enqueue a window_activity row
    // when something is new/changed, so a tab sitting open unchanged for
    // hours doesn't write a row every single poll.
    private HashSet<string> _lastSeenKeys = new();

    // Local developer-panel config (hide-list + pause), reloaded when its file
    // changes so edits from `--dev` take effect without restarting the agent.
    private LocalDevConfig _localDev = new();
    private DateTime _localDevStamp = DateTime.MinValue;

    // Browser profiles (by name or signed-in email) and apps (by process name)
    // the developer switched off from the dashboard, pushed down on each
    // check-in. Nothing from a matching profile or app is captured.
    private HashSet<string> _disabledProfiles = new(StringComparer.OrdinalIgnoreCase);
    private HashSet<string> _disabledApps = new(StringComparer.OrdinalIgnoreCase);

    // Known browser profiles (display name + signed-in account, from each
    // browser's Local State), used to pull the profile out of a window title
    // and to tell which account it's signed in as. Cached — they change only
    // when someone adds/renames/signs in to a profile.
    private IReadOnlyList<BrowserProfileInfo> _profiles = Array.Empty<BrowserProfileInfo>();
    private IReadOnlyCollection<string> _knownProfiles = Array.Empty<string>();
    private DateTime _knownProfilesStamp = DateTime.MinValue;
    private static readonly TimeSpan KnownProfilesTtl = TimeSpan.FromMinutes(5);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _device = await EnsureEnrolledAsync(stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                if (_device is null)
                {
                    _device = await EnsureEnrolledAsync(stoppingToken);
                }
                else
                {
                    await RunOneTickAsync(stoppingToken);
                }
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Unhandled error in agent tick");
            }

            await Task.Delay(TimeSpan.FromSeconds(options.PollIntervalSeconds), stoppingToken);
        }
    }

    private void ReloadLocalDevIfChanged()
    {
        var stamp = LocalDevConfig.LastWriteUtc(options);
        if (stamp == _localDevStamp) return;
        _localDev = LocalDevConfig.Load(options);
        _localDevStamp = stamp;
    }

    private void RefreshKnownProfilesIfStale()
    {
        if (DateTime.UtcNow - _knownProfilesStamp < KnownProfilesTtl) return;
        _profiles = BrowserProfiles.KnownProfiles();
        _knownProfiles = BrowserProfiles.KnownProfileNames(_profiles);
        _knownProfilesStamp = DateTime.UtcNow;
    }

    private async Task<DeviceState?> EnsureEnrolledAsync(CancellationToken ct)
    {
        var existing = DeviceState.Load(options);
        if (existing is not null) return existing;

        var dataDir = options.ResolveDataDirectory();
        var tokenPath = Path.Combine(dataDir, "enroll.token");
        var emailPath = Path.Combine(dataDir, "assigned_email.txt");

        EnrollResult? result;
        if (File.Exists(tokenPath))
        {
            var token = (await File.ReadAllTextAsync(tokenPath, ct)).Trim();
            result = await backend.EnrollAsync(token, Environment.MachineName, ct);
            if (result is not null)
            {
                // Single-use — discard the raw enrollment token now that it's exchanged.
                try { File.Delete(tokenPath); } catch { /* best-effort */ }
            }
        }
        else if (File.Exists(emailPath))
        {
            var email = (await File.ReadAllTextAsync(emailPath, ct)).Trim();
            result = await backend.EnrollByEmailAsync(email, Environment.MachineName, ct);
            if (result is not null)
            {
                try { File.Delete(emailPath); } catch { /* best-effort */ }
            }
            // Otherwise kept on failure so it keeps retrying — e.g. the
            // admin hasn't created the matching device row yet.
        }
        else
        {
            logger.LogWarning(
                "No device.json, enroll.token, or assigned_email.txt found in {Dir} — nothing to enroll with yet.",
                dataDir);
            return null;
        }

        if (result is null)
        {
            logger.LogWarning("Enrollment attempt failed — will retry next tick.");
            return null;
        }

        var state = new DeviceState
        {
            DeviceId = result.DeviceId,
            DeviceToken = result.DeviceToken,
            AssignedEmail = result.AssignedEmail,
            AssignedPhone = result.AssignedPhone,
        };
        state.Save(options);

        // Fresh enrollment: discard anything still queued from before this PC
        // became this device. An old backlog (e.g. a previous install whose
        // device was deleted) would otherwise upload under the new device id
        // and appear as days-old "live" activity. New history starts here.
        queue.ClearAll();

        logger.LogInformation("Enrolled as device {DeviceId}", result.DeviceId);
        return state;
    }

    private async Task RunOneTickAsync(CancellationToken ct)
    {
        var device = _device!;

        ReloadLocalDevIfChanged();
        if (_localDev.Paused)
        {
            // Developer paused this PC from the local panel — capture nothing
            // and send nothing (not even a heartbeat) until resumed. Resume is
            // a local action, so the loop just keeps re-reading the config.
            return;
        }

        if (DateTimeOffset.UtcNow >= _nextUpdateCheck)
        {
            _nextUpdateCheck = DateTimeOffset.UtcNow.AddMinutes(options.UpdateCheckIntervalMinutes);
            // Exits the process via Environment.Exit if an update is applied
            // — everything after this call simply won't run in that case.
            await updater.CheckAndApplyAsync(ct);
        }

        if (device.ConsentReportedVersion < ConsentNotice.CurrentNoticeVersion && ConsentNotice.IsAcknowledged(options))
        {
            if (await backend.ConsentAsync(device.DeviceToken, ConsentNotice.CurrentNoticeVersion, ct))
            {
                device.ConsentReportedVersion = ConsentNotice.CurrentNoticeVersion;
                device.Save(options);
            }
        }
        else if (!ConsentNotice.IsAcknowledged(options))
        {
            // First run, or the notice text changed since last ack — show
            // it now. Scanning still proceeds regardless (company-owned
            // -device policy), but the notice keeps reappearing until
            // acknowledged.
            ConsentNotice.EnsureAcknowledged(options);
        }

        RefreshKnownProfilesIfStale();

        var windows = scanner.Scan();
        var currentKeys = new HashSet<string>();

        var reportedWaNumber = WhatsAppIdentityStore.TryGetCurrentNumber(options);

        foreach (var window in windows)
        {
            // Developer switched this whole app off from the dashboard —
            // capture and send nothing from it.
            if (_disabledApps.Contains(window.ProcessName)) continue;

            // Which profile/account a browser window belongs to, most exact
            // source first: the profile folder the browser tags the window
            // itself with (mapped to Local State); then the extension's report
            // (if it's installed); then the profile name in the title, or the
            // browser's only profile.
            var isBrowser = BrowserProfiles.IsBrowser(window.ProcessName);
            var byDir = isBrowser
                ? BrowserProfiles.FindByDirectory(window.ProcessName, BrowserWindowProfile.GetProfileDirectory(window.Hwnd), _profiles)
                : null;
            var profile = byDir?.Name ?? BrowserProfiles.Parse(window.ProcessName, window.WindowTitle, _knownProfiles);
            var accountEmail = isBrowser
                ? byDir?.Email
                    ?? activeTabs.ResolveEmailForWindow(window.WindowTitle)
                    ?? (byDir is null ? BrowserProfiles.ResolveAccountEmail(window.ProcessName, profile, _profiles) : null)
                : null;

            // Developer switched this whole browser profile off (by its name
            // or its signed-in email) — capture and send nothing from it.
            if (profile is not null && _disabledProfiles.Contains(profile)) continue;
            if (accountEmail is not null && _disabledProfiles.Contains(accountEmail)) continue;

            var evt = IdentityExtractor.Classify(window, device.AssignedEmail, device.AssignedPhone, reportedWaNumber);
            // Local developer hide-list (on top of the dashboard's per-device
            // filters): drop anything matching before it is ever queued/sent.
            var hidden = _localDev.IsHidden(window.WindowTitle, evt?.DetectedIdentity);

            if (evt is not null && !hidden) queue.Enqueue(evt);

            var key = window.ProcessName + " " + window.WindowTitle;
            currentKeys.Add(key);
            if (!hidden && !_lastSeenKeys.Contains(key))
            {
                // Label the foreground browser window with the site the
                // extension says its active tab is on. Only the focused
                // window's active tab is reported, so we only attach a site to
                // the foreground one.
                var url = BrowserProfiles.IsBrowser(window.ProcessName) && window.IsForeground
                    ? activeTabs.ResolveHostForWindow(window.WindowTitle)
                    : null;
                // The WhatsApp account signed in, on WhatsApp windows only.
                var waNumber = window.WindowTitle.Contains("WhatsApp", StringComparison.OrdinalIgnoreCase)
                    ? reportedWaNumber
                    : null;
                queue.EnqueueWindowActivity(window, url, profile, accountEmail, waNumber);
            }
        }
        _lastSeenKeys = currentKeys;

        await TryFlushAsync(device, ct);
        queue.PruneSynced(TimeSpan.FromDays(30));
    }

    private async Task TryFlushAsync(DeviceState device, CancellationToken ct)
    {
        if (DateTimeOffset.UtcNow < _nextFlushAttempt) return;

        // Always check in, even with nothing new to report — this is also
        // the heartbeat that delivers pending "close window" commands
        // promptly, not just an upload step.
        var batch = queue.GetUnsyncedBatch(BatchSize);
        var windowActivityBatch = queue.GetUnsyncedWindowActivityBatch(WindowActivityBatchSize);

        var result = await backend.CheckinAsync(device.DeviceToken, batch, windowActivityBatch, ct);
        if (result is null)
        {
            _nextFlushAttempt = DateTimeOffset.UtcNow + _backoff;
            _backoff = TimeSpan.FromSeconds(Math.Min(_backoff.TotalSeconds * 2, MaxBackoff.TotalSeconds));
            logger.LogWarning("Check-in failed, backing off {Seconds}s", _backoff.TotalSeconds);
            return;
        }

        queue.MarkSynced(batch.Select(e => e.Id));
        queue.MarkWindowActivitySynced(windowActivityBatch.Select(w => w.Id));
        _backoff = MinBackoff;

        // The server says a newer agent is published — check for it on the
        // very next tick instead of waiting for the periodic update check, so
        // a release reaches every PC within about a minute.
        // At most one forced attempt per 10 minutes, so a download that keeps
        // failing doesn't re-fetch a 100MB+ exe every poll.
        if (result.LatestAgentVersion > SelfUpdater.CurrentAgentVersion &&
            DateTimeOffset.UtcNow - _lastForcedUpdateCheck >= TimeSpan.FromMinutes(10))
        {
            _lastForcedUpdateCheck = DateTimeOffset.UtcNow;
            _nextUpdateCheck = DateTimeOffset.UtcNow;
        }

        // Latest set of developer-disabled browser profiles for this device.
        _disabledProfiles = new HashSet<string>(result.DisabledProfiles, StringComparer.OrdinalIgnoreCase);
        _disabledApps = new HashSet<string>(
            result.DisabledApps.Select(a => a.EndsWith(".exe", StringComparison.OrdinalIgnoreCase) ? a[..^4] : a),
            StringComparer.OrdinalIgnoreCase);

        if (result.Status == "disabled")
        {
            logger.LogWarning("Device has been disabled by an admin — clearing local device state.");
            var path = Path.Combine(options.ResolveDataDirectory(), "device.json");
            try { File.Delete(path); } catch { /* best-effort */ }
            _device = null;
            return;
        }

        var deviceChanged = false;
        if (!string.Equals(result.AssignedEmail, device.AssignedEmail, StringComparison.Ordinal))
        {
            device.AssignedEmail = result.AssignedEmail;
            logger.LogInformation("Assigned email updated to {Email}", result.AssignedEmail);
            deviceChanged = true;
        }
        if (!string.Equals(result.AssignedPhone, device.AssignedPhone, StringComparison.Ordinal))
        {
            device.AssignedPhone = result.AssignedPhone;
            logger.LogInformation("Assigned WhatsApp number updated");
            deviceChanged = true;
        }
        if (deviceChanged) device.Save(options);

        // Keep the local secret-code hashes current so `--uninstall <code>`
        // and `--dev <code>` validate against the latest dashboard-set codes,
        // even offline.
        SecretCodes.Cache(options, SecretCodes.UninstallHashFile, result.UninstallCodeSha256);
        SecretCodes.Cache(options, SecretCodes.DeveloperHashFile, result.DeveloperCodeSha256);

        if (result.CloseRequests.Count > 0)
        {
            CloseMatchingWindows(result.CloseRequests, device.AssignedEmail, device.AssignedPhone);
        }
    }

    /// <summary>
    /// Re-scans (the last tick's snapshot may be stale by now) and sends a
    /// graceful WM_CLOSE to every currently-open window whose classified
    /// identity matches one of the requested ones. Best-effort — if the
    /// window was already closed, or reopened as something else, there's
    /// simply nothing to do.
    /// </summary>
    private void CloseMatchingWindows(IReadOnlyList<string> identities, string assignedEmail, string? assignedPhone)
    {
        var wanted = new HashSet<string>(identities, StringComparer.OrdinalIgnoreCase);
        var reportedWaNumber = WhatsAppIdentityStore.TryGetCurrentNumber(options);
        foreach (var window in scanner.Scan())
        {
            var evt = IdentityExtractor.Classify(window, assignedEmail, assignedPhone, reportedWaNumber);
            if (evt?.DetectedIdentity is not null && wanted.Contains(evt.DetectedIdentity))
            {
                logger.LogInformation("Closing tab for {Identity}: {Title}", evt.DetectedIdentity, window.WindowTitle);
                WindowScanner.CloseActiveTab(window.Hwnd);
            }
        }
    }
}
