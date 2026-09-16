using System.Diagnostics;
using System.Security;
using System.Text;

namespace VaayuMonitor.Agent;

/// <summary>
/// Turns the same single exe into its own installer: double-click it from
/// anywhere, it copies itself into Program Files, registers the per-logon
/// Scheduled Task, asks for the assigned email, and hands off to the
/// freshly-installed copy — no separate install.ps1/PowerShell required
/// for the common case (that script still exists for advanced/silent IT
/// scripting with a pre-issued token).
/// </summary>
public static class Installer
{
    private const string TaskName = "VaayuGuardAgent";
    private const string WatchdogTaskName = "VaayuGuardWatchdog";
    private const string WatchdogExeName = "VaayuGuardWatchdog.exe";

    public static string InstalledExePath(AgentOptions options) =>
        Path.Combine(options.ResolveInstallDirectory(), "VaayuGuardAgent.exe");

    /// <summary>True if the currently-running exe IS the installed copy.</summary>
    public static bool IsRunningInstalled(AgentOptions options)
    {
        var current = Environment.ProcessPath;
        if (string.IsNullOrEmpty(current)) return false;
        return string.Equals(
            Path.GetFullPath(current),
            Path.GetFullPath(InstalledExePath(options)),
            StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Stops any other running copy of the installed exe so it can be
    /// overwritten — e.g. re-running the installer to force an update on a
    /// PC that's already got the agent running from a previous install.
    /// Best-effort: a failure here just means CopyOverPossiblyLockedTarget's
    /// rename-first fallback has to handle it instead.
    /// </summary>
    private static void StopOtherRunningInstances(string targetExe, ILogger logger)
    {
        var currentPid = Environment.ProcessId;
        var processName = Path.GetFileNameWithoutExtension(targetExe);
        foreach (var proc in Process.GetProcessesByName(processName))
        {
            using (proc)
            {
                if (proc.Id == currentPid) continue;
                try
                {
                    proc.Kill();
                    proc.WaitForExit(5000);
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "Could not stop existing agent process (PID {Pid}) before reinstalling", proc.Id);
                }
            }
        }
    }

    /// <summary>
    /// Copies over the install target even if something still has it open —
    /// same rename-out-of-the-way trick as SelfUpdater, as a fallback for
    /// when StopOtherRunningInstances couldn't stop every holder in time.
    /// </summary>
    private static void CopyOverPossiblyLockedTarget(string sourceExe, string targetExe)
    {
        try
        {
            File.Copy(sourceExe, targetExe, overwrite: true);
            return;
        }
        catch (IOException)
        {
            // Target is still locked — rename it out of the way (renaming,
            // unlike overwriting content, doesn't require the lock) and
            // write fresh instead.
        }

        var oldPath = targetExe + ".old";
        try { if (File.Exists(oldPath)) File.Delete(oldPath); } catch { /* best-effort */ }
        File.Move(targetExe, oldPath);
        File.Copy(sourceExe, targetExe);
    }

    /// <summary>
    /// Runs the interactive (or silent, if AgentOptions.InstallerEmail is
    /// set) install flow. Returns true if installation completed and the
    /// installed copy was launched — the caller should exit immediately
    /// afterwards rather than also starting the background host.
    /// </summary>
    public static bool Run(AgentOptions options, ILogger logger)
    {
        // Silent (IT-scripted / test) installs skip both the prompt and any
        // popups — only an interactively-entered email gets UI feedback.
        var silent = !string.IsNullOrWhiteSpace(options.InstallerEmail);
        var email = silent ? options.InstallerEmail : EmailPromptForm.Prompt();

        if (string.IsNullOrWhiteSpace(email))
        {
            logger.LogInformation("Install cancelled — no email entered.");
            return false;
        }

        try
        {
            var installDir = options.ResolveInstallDirectory();
            Directory.CreateDirectory(installDir);
            var targetExe = InstalledExePath(options);
            var watchdogExe = Path.Combine(installDir, WatchdogExeName);

            var currentExe = Environment.ProcessPath!;

            // Re-running the installer over an already-installed, currently
            // running agent (the "just re-run the installer to force an
            // update" path) needs the old copies stopped first — Windows
            // won't let File.Copy overwrite a running exe's content.
            StopOtherRunningInstances(targetExe, logger);
            StopOtherRunningInstances(watchdogExe, logger);
            CopyOverPossiblyLockedTarget(currentExe, targetExe);
            // The watchdog is literally the same exe under a different
            // filename (Program.cs branches on its own filename) — a plain
            // copy of the exe we just installed, not the original launcher.
            CopyOverPossiblyLockedTarget(targetExe, watchdogExe);

            // Confirmed live: a stale appsettings.json left over in installDir
            // from a much earlier install (pointing at a long-dead LAN
            // address) silently overrode every subsequent build's compiled-in
            // BackendBaseUrl default, since Host.CreateApplicationBuilder
            // loads appsettings.json from the content root regardless of
            // which exe version put it there. The single-exe install has no
            // appsettings.json of its own — the compiled-in default is the
            // whole point — so when the fresh download doesn't ship one,
            // remove any old one instead of silently leaving it in charge.
            var currentAppsettings = Path.Combine(Path.GetDirectoryName(currentExe)!, "appsettings.json");
            var installedAppsettings = Path.Combine(installDir, "appsettings.json");
            if (File.Exists(currentAppsettings))
            {
                try { File.Copy(currentAppsettings, installedAppsettings, overwrite: true); }
                catch { /* optional — baked-in defaults cover this */ }
            }
            else
            {
                try { File.Delete(installedAppsettings); } catch { /* fine if it wasn't there */ }
            }

            var taskWarning = "";
            var taskRegistered = false;
            var watchdogTaskRegistered = false;
            try
            {
                RegisterScheduledTask(TaskName, targetExe,
                    "VaayuGuard monitoring agent.");
                taskRegistered = true;
                RegisterScheduledTask(WatchdogTaskName, watchdogExe,
                    "VaayuGuard watchdog — makes sure the VaayuGuard agent stays running.");
                watchdogTaskRegistered = true;
            }
            catch (Exception ex)
            {
                // Don't let a Scheduled Task failure (policy restriction,
                // permissions, etc.) throw away a working file copy — the
                // agent still runs now, it just won't auto-start at next
                // logon until this is retried (e.g. by IT, elevated).
                logger.LogWarning(ex, "Scheduled Task registration failed — continuing without auto-start");
                taskWarning = "\n\nNote: could not set it to start automatically at logon " +
                              "(ask IT to run install.ps1 as Administrator to fix this). " +
                              "It will keep running for this session regardless.";
            }

            var emailPath = Path.Combine(options.ResolveDataDirectory(), "assigned_email.txt");
            File.WriteAllText(emailPath, email!.Trim());

            // Launch it AS the Scheduled Task, not a bare Process.Start —
            // RestartOnFailure only protects process instances Task
            // Scheduler itself launched. A fire-and-forget Process.Start
            // here would run fine but Task Scheduler wouldn't be watching
            // it, so killing it would do nothing until the next logon's
            // LogonTrigger fires a fresh (tracked) one. But confirmed live:
            // `schtasks /run` can silently fail (non-zero exit) right after
            // registering two tasks back-to-back — its exit code was never
            // checked before, so the watchdog just never started and no one
            // knew. Now falls back to a direct launch whenever /run doesn't
            // report success, so install always ends with both running.
            if (!taskRegistered || RunSchtasks(["/run", "/tn", TaskName], out _) != 0)
            {
                Process.Start(new ProcessStartInfo { FileName = targetExe, UseShellExecute = true });
            }

            if (!watchdogTaskRegistered || RunSchtasks(["/run", "/tn", WatchdogTaskName], out _) != 0)
            {
                Process.Start(new ProcessStartInfo { FileName = watchdogExe, UseShellExecute = true });
            }

            if (!silent)
            {
                ShowMessage(
                    "VaayuGuard has been installed." + taskWarning,
                    System.Windows.Forms.MessageBoxIcon.Information);
            }

            return true;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Install failed");
            if (!silent)
            {
                ShowMessage(
                    $"Installation failed: {ex.Message}\n\nTry running this as Administrator, or ask IT for help.",
                    System.Windows.Forms.MessageBoxIcon.Error);
            }
            return false;
        }
    }

    /// <summary>
    /// MessageBox.Show requires an STA thread; Program.cs's top-level
    /// statements don't guarantee one, so — same fix as
    /// ConsentNotice/EmailPromptForm — run it on a dedicated one.
    /// </summary>
    private static void ShowMessage(string text, System.Windows.Forms.MessageBoxIcon icon)
    {
        var thread = new Thread(() =>
            System.Windows.Forms.MessageBox.Show(text, "VaayuGuard Setup", System.Windows.Forms.MessageBoxButtons.OK, icon));
        thread.SetApartmentState(ApartmentState.STA);
        thread.Start();
        thread.Join();
    }

    private static void RegisterScheduledTask(string taskName, string exePath, string description)
    {
        // Whoever is running this installer (possibly elevated as a
        // *different* admin account than the person who logs into this PC
        // day to day) is not necessarily who the AtLogOn trigger should
        // fire for. Resolve the actual interactive console user instead of
        // trusting Environment.UserName, or the task silently never fires
        // again after the next restart.
        var interactiveUser = GetInteractiveConsoleUser() ?? Environment.UserName;

        // Ignore failure — fine if the task doesn't exist yet on first install.
        RunSchtasks(["/delete", "/tn", taskName, "/f"], out _);

        // The plain `schtasks /create /tr ... /sc onlogon` command-line form
        // has NO way to configure restart-on-failure, so this imports a full
        // Task XML instead (via schtasks /create /xml). RestartOnFailure
        // covers a voluntary non-zero exit (e.g. SelfUpdater's own
        // exit(1)-after-update). It does NOT reliably cover every other way
        // this can stop running (confirmed live: a manual "End Task" is
        // recorded as a forced termination, which Task Scheduler treats as
        // an intentional stop rather than a failure) — that's what the
        // separate Watchdog process (see Watchdog.cs and the second
        // registration of this same task type below) is for.
        var xmlPath = Path.Combine(Path.GetTempPath(), $"VaayuGuardTask_{Guid.NewGuid():N}.xml");
        File.WriteAllText(xmlPath, BuildTaskXml(exePath, interactiveUser, description), Encoding.Unicode);
        try
        {
            var create = RunSchtasks(["/create", "/tn", taskName, "/xml", xmlPath, "/f"], out var output);
            if (create != 0)
            {
                throw new InvalidOperationException($"schtasks /create (xml) exited with code {create}: {output}");
            }
        }
        finally
        {
            try { File.Delete(xmlPath); } catch { /* best-effort */ }
        }
    }

    private static string BuildTaskXml(string exePath, string userId, string description)
    {
        var user = SecurityElement.Escape(userId);
        var exe = SecurityElement.Escape(exePath);
        var desc = SecurityElement.Escape(description);
        return $"""
            <?xml version="1.0" encoding="UTF-16"?>
            <Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
              <RegistrationInfo>
                <Description>{desc}</Description>
              </RegistrationInfo>
              <Triggers>
                <LogonTrigger>
                  <Enabled>true</Enabled>
                  <UserId>{user}</UserId>
                </LogonTrigger>
              </Triggers>
              <Principals>
                <Principal id="Author">
                  <UserId>{user}</UserId>
                  <LogonType>InteractiveToken</LogonType>
                  <RunLevel>HighestAvailable</RunLevel>
                </Principal>
              </Principals>
              <Settings>
                <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
                <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
                <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
                <AllowHardTerminate>true</AllowHardTerminate>
                <StartWhenAvailable>true</StartWhenAvailable>
                <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
                <AllowStartOnDemand>true</AllowStartOnDemand>
                <Enabled>true</Enabled>
                <Hidden>false</Hidden>
                <RunOnlyIfIdle>false</RunOnlyIfIdle>
                <WakeToRun>false</WakeToRun>
                <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
                <Priority>7</Priority>
                <RestartOnFailure>
                  <Interval>PT1M</Interval>
                  <Count>999</Count>
                </RestartOnFailure>
              </Settings>
              <Actions Context="Author">
                <Exec>
                  <Command>{exe}</Command>
                </Exec>
              </Actions>
            </Task>
            """;
    }

    /// <summary>
    /// The account actually logged into the interactive console session —
    /// via WMI, since that's what's authoritative regardless of which
    /// account is running this installer process. Returns "DOMAIN\user" or
    /// null if it couldn't be determined (e.g. no interactive session).
    /// </summary>
    private static string? GetInteractiveConsoleUser()
    {
        try
        {
            using var searcher = new System.Management.ManagementObjectSearcher(
                "SELECT UserName FROM Win32_ComputerSystem");
            foreach (System.Management.ManagementObject obj in searcher.Get())
            {
                var userName = obj["UserName"] as string;
                if (!string.IsNullOrWhiteSpace(userName)) return userName;
            }
        }
        catch
        {
            // Fall through to the Environment.UserName fallback at the call site.
        }
        return null;
    }

    private static int RunSchtasks(string[] arguments, out string output)
    {
        var psi = new ProcessStartInfo
        {
            FileName = "schtasks.exe",
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
        };
        foreach (var arg in arguments) psi.ArgumentList.Add(arg);

        using var process = Process.Start(psi)!;
        var stdout = process.StandardOutput.ReadToEnd();
        var stderr = process.StandardError.ReadToEnd();
        process.WaitForExit();
        output = stdout + stderr;
        return process.ExitCode;
    }
}
