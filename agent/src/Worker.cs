namespace VaayuMonitor.Agent;

public class Worker(
    ILogger<Worker> logger,
    AgentOptions options,
    WindowScanner scanner,
    LocalQueue queue,
    BackendClient backend) : BackgroundService
{
    private const int BatchSize = 50;
    private static readonly TimeSpan MinBackoff = TimeSpan.FromSeconds(5);
    private static readonly TimeSpan MaxBackoff = TimeSpan.FromMinutes(5);

    private DeviceState? _device;
    private TimeSpan _backoff = MinBackoff;
    private DateTimeOffset _nextFlushAttempt = DateTimeOffset.MinValue;

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

    private async Task<DeviceState?> EnsureEnrolledAsync(CancellationToken ct)
    {
        var existing = DeviceState.Load(options);
        if (existing is not null) return existing;

        var tokenPath = Path.Combine(options.ResolveDataDirectory(), "enroll.token");
        if (!File.Exists(tokenPath))
        {
            logger.LogWarning(
                "No device.json and no enroll.token found at {Path} — waiting for install.ps1 to drop an enrollment token.",
                tokenPath);
            return null;
        }

        var token = (await File.ReadAllTextAsync(tokenPath, ct)).Trim();
        var result = await backend.EnrollAsync(token, Environment.MachineName, ct);
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
        };
        state.Save(options);

        // Single-use — discard the raw enrollment token now that it's exchanged.
        try { File.Delete(tokenPath); } catch { /* best-effort */ }

        logger.LogInformation("Enrolled as device {DeviceId}", result.DeviceId);
        return state;
    }

    private async Task RunOneTickAsync(CancellationToken ct)
    {
        var device = _device!;

        if (!device.ConsentReported && ConsentNotice.IsAcknowledged(options))
        {
            if (await backend.ConsentAsync(device.DeviceToken, ct))
            {
                device.ConsentReported = true;
                device.Save(options);
            }
        }
        else if (!ConsentNotice.IsAcknowledged(options))
        {
            // First run (or the notice was somehow cleared) — show it now.
            // Scanning still proceeds regardless (company-owned-device
            // policy), but the notice keeps reappearing until acknowledged.
            ConsentNotice.EnsureAcknowledged(options);
        }

        var windows = scanner.Scan();
        foreach (var window in windows)
        {
            var evt = IdentityExtractor.Classify(window, device.AssignedEmail);
            if (evt is not null) queue.Enqueue(evt);
        }

        await TryFlushAsync(device, ct);
        queue.PruneSynced(TimeSpan.FromDays(30));
    }

    private async Task TryFlushAsync(DeviceState device, CancellationToken ct)
    {
        if (DateTimeOffset.UtcNow < _nextFlushAttempt) return;

        var batch = queue.GetUnsyncedBatch(BatchSize);
        if (batch.Count == 0)
        {
            _backoff = MinBackoff;
            return;
        }

        var result = await backend.CheckinAsync(device.DeviceToken, batch, ct);
        if (result is null)
        {
            _nextFlushAttempt = DateTimeOffset.UtcNow + _backoff;
            _backoff = TimeSpan.FromSeconds(Math.Min(_backoff.TotalSeconds * 2, MaxBackoff.TotalSeconds));
            logger.LogWarning("Check-in failed, backing off {Seconds}s", _backoff.TotalSeconds);
            return;
        }

        queue.MarkSynced(batch.Select(e => e.Id));
        _backoff = MinBackoff;

        if (result.Status == "disabled")
        {
            logger.LogWarning("Device has been disabled by an admin — clearing local device state.");
            var path = Path.Combine(options.ResolveDataDirectory(), "device.json");
            try { File.Delete(path); } catch { /* best-effort */ }
            _device = null;
            return;
        }

        if (!string.Equals(result.AssignedEmail, device.AssignedEmail, StringComparison.Ordinal))
        {
            device.AssignedEmail = result.AssignedEmail;
            device.Save(options);
            logger.LogInformation("Assigned email updated to {Email}", result.AssignedEmail);
        }
    }
}
