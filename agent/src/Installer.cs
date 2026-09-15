using System.Diagnostics;

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

            var currentExe = Environment.ProcessPath!;
            File.Copy(currentExe, targetExe, overwrite: true);

            var currentAppsettings = Path.Combine(Path.GetDirectoryName(currentExe)!, "appsettings.json");
            if (File.Exists(currentAppsettings))
            {
                try { File.Copy(currentAppsettings, Path.Combine(installDir, "appsettings.json"), overwrite: true); }
                catch { /* optional — baked-in defaults cover this */ }
            }

            var taskWarning = "";
            try
            {
                RegisterScheduledTask(targetExe);
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

            Process.Start(new ProcessStartInfo { FileName = targetExe, UseShellExecute = true });

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

    private static void RegisterScheduledTask(string exePath)
    {
        // Ignore failure — fine if the task doesn't exist yet on first install.
        RunSchtasks(["/delete", "/tn", TaskName, "/f"], out _);

        var create = RunSchtasks(
            ["/create", "/tn", TaskName, "/tr", exePath, "/sc", "onlogon", "/rl", "highest", "/f"],
            out var output);
        if (create != 0)
        {
            throw new InvalidOperationException($"schtasks /create exited with code {create}: {output}");
        }
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
