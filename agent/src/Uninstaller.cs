using System.Diagnostics;
using System.Windows.Forms;
using Microsoft.Win32;

namespace VaayuMonitor.Agent;

/// <summary>
/// Code-gated uninstall. VaayuGuard deliberately has no Add/Remove-Programs
/// entry and keeps itself alive with a per-logon Scheduled Task plus a
/// watchdog, so an ordinary user can't remove it the way they would a normal
/// app. Removal is only possible by running the exe with the --uninstall flag
/// AND supplying the secret code — and, because the binaries live in Program
/// Files and the tasks were registered by an admin, with local administrator
/// rights.
///
/// Intended flow: an admin opens cmd and runs
///   "C:\Program Files\VaayuGuard\VaayuGuardAgent.exe" --uninstall &lt;code&gt;
/// The correct code opens the uninstall page; the admin confirms, and the
/// agent stops itself, removes its tasks + extension policy, and deletes its
/// own files. A wrong/absent code never opens the page.
/// </summary>
public static class Uninstaller
{
    public const string Flag = "--uninstall";

    private const string TaskName = "VaayuGuardAgent";
    private const string WatchdogTaskName = "VaayuGuardWatchdog";
    private const string ExtensionId = "amkaccikccmobblkcmnndhengmpacfba";

    public static bool IsUninstallInvocation(string[] args) =>
        args.Any(a =>
            string.Equals(a, Flag, StringComparison.OrdinalIgnoreCase) ||
            a.StartsWith(Flag + "=", StringComparison.OrdinalIgnoreCase));

    public static void Run(AgentOptions options, string[] args, ILogger logger)
    {
        // The code can be passed on the command line (--uninstall CODE or
        // --uninstall=CODE); if it wasn't, prompt for it so an admin who
        // forgot still has a path in. Either way it must be correct.
        var code = ExtractCodeArg(args) ?? PromptForCode();
        if (string.IsNullOrWhiteSpace(code))
        {
            logger.LogInformation("Uninstall cancelled — no code entered.");
            return;
        }

        var expected = SecretCodes.Resolve(options, SecretCodes.UninstallHashFile, options.UninstallCodeSha256);
        if (!SecretCodes.Matches(code, expected))
        {
            logger.LogWarning("Uninstall refused — incorrect code.");
            ShowMessage("Incorrect uninstall code. VaayuGuard was not removed.", MessageBoxIcon.Error);
            return;
        }

        if (!ShowUninstallPage())
        {
            logger.LogInformation("Uninstall cancelled at the confirmation page.");
            return;
        }

        PerformUninstall(options, logger);
    }

    private static string? ExtractCodeArg(string[] args)
    {
        for (var i = 0; i < args.Length; i++)
        {
            var a = args[i];
            if (a.StartsWith(Flag + "=", StringComparison.OrdinalIgnoreCase))
                return a[(Flag.Length + 1)..];
            if (string.Equals(a, Flag, StringComparison.OrdinalIgnoreCase))
                return (i + 1 < args.Length && !args[i + 1].StartsWith('-')) ? args[i + 1] : null;
        }
        return null;
    }

    private static void PerformUninstall(AgentOptions options, ILogger logger)
    {
        var installDir = options.ResolveInstallDirectory();
        var dataDir = Environment.ExpandEnvironmentVariables(options.DataDirectory);

        // 1. Unregister the tasks first so nothing relaunches mid-removal.
        RunSchtasks(["/delete", "/tn", WatchdogTaskName, "/f"]);
        RunSchtasks(["/delete", "/tn", TaskName, "/f"]);

        // 2. Kill the watchdog BEFORE the agent — otherwise it would just
        //    relaunch the agent we're about to delete. Never kill ourselves.
        KillProcesses("VaayuGuardWatchdog", logger);
        KillProcesses("VaayuGuardAgent", logger);

        // 3. Remove the force-installed browser extension policy (best-effort;
        //    needs HKLM / admin).
        try { RemoveExtensionPolicy(); }
        catch (Exception ex) { logger.LogWarning(ex, "Could not remove browser extension policy"); }

        // 4. Delete the install directory and local data. If this very exe is
        //    running from inside the install dir, a running process can't
        //    delete its own folder — hand off to a tiny detached cmd that
        //    waits for us to exit first, then removes everything.
        var selfDir = Path.GetDirectoryName(Environment.ProcessPath) ?? "";
        if (PathsEqual(selfDir, installDir))
        {
            LaunchDetachedCleanup(installDir, dataDir);
            logger.LogInformation("Uninstall handed off to detached cleanup; exiting.");
            ShowMessage("VaayuGuard is being removed. This window will now close.", MessageBoxIcon.Information);
            Environment.Exit(0);
        }

        TryDeleteDir(installDir, logger);
        TryDeleteDir(dataDir, logger);
        logger.LogInformation("VaayuGuard uninstalled.");
        ShowMessage("VaayuGuard has been removed from this PC.", MessageBoxIcon.Information);
    }

    private static void KillProcesses(string name, ILogger logger)
    {
        var currentPid = Environment.ProcessId;
        foreach (var p in Process.GetProcessesByName(name))
        {
            using (p)
            {
                if (p.Id == currentPid) continue;
                try { p.Kill(); p.WaitForExit(5000); }
                catch (Exception ex) { logger.LogWarning(ex, "Could not stop {Name} (PID {Pid})", name, p.Id); }
            }
        }
    }

    private static void RemoveExtensionPolicy()
    {
        RemoveForcelistEntry(@"SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist");
        RemoveForcelistEntry(@"SOFTWARE\Policies\Microsoft\Edge\ExtensionInstallForcelist");
    }

    private static void RemoveForcelistEntry(string keyPath)
    {
        using var key = Registry.LocalMachine.OpenSubKey(keyPath, writable: true);
        if (key is null) return;
        foreach (var name in key.GetValueNames())
        {
            if (key.GetValue(name) is string v &&
                v.StartsWith(ExtensionId + ";", StringComparison.OrdinalIgnoreCase))
            {
                key.DeleteValue(name, throwOnMissingValue: false);
            }
        }
    }

    private static void LaunchDetachedCleanup(string installDir, string dataDir)
    {
        var script = Path.Combine(Path.GetTempPath(), $"vg_uninstall_{Guid.NewGuid():N}.cmd");
        // ping is a portable ~2s sleep; by then this process has exited and
        // its folder is free to delete. The script deletes itself last.
        var content =
            "@echo off\r\n" +
            "ping 127.0.0.1 -n 3 >nul\r\n" +
            $"rmdir /s /q \"{installDir}\"\r\n" +
            $"rmdir /s /q \"{dataDir}\"\r\n" +
            "del /q \"%~f0\"\r\n";
        File.WriteAllText(script, content);
        Process.Start(new ProcessStartInfo
        {
            FileName = "cmd.exe",
            Arguments = $"/c \"{script}\"",
            UseShellExecute = true,
            WindowStyle = ProcessWindowStyle.Hidden,
        });
    }

    private static void TryDeleteDir(string dir, ILogger logger)
    {
        try { if (Directory.Exists(dir)) Directory.Delete(dir, recursive: true); }
        catch (Exception ex) { logger.LogWarning(ex, "Could not delete {Dir} (admin rights may be required)", dir); }
    }

    private static bool PathsEqual(string a, string b)
    {
        try
        {
            return string.Equals(
                Path.GetFullPath(a).TrimEnd('\\'),
                Path.GetFullPath(b).TrimEnd('\\'),
                StringComparison.OrdinalIgnoreCase);
        }
        catch { return false; }
    }

    private static void RunSchtasks(string[] arguments)
    {
        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = "schtasks.exe",
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
            };
            foreach (var a in arguments) psi.ArgumentList.Add(a);
            using var p = Process.Start(psi)!;
            p.StandardOutput.ReadToEnd();
            p.StandardError.ReadToEnd();
            p.WaitForExit();
        }
        catch { /* best-effort */ }
    }

    // --- Minimal WinForms UI, each shown on its own STA thread (same pattern
    //     as ConsentNotice/EmailPromptForm/Installer.ShowMessage). ---

    private static string? PromptForCode() => RunOnStaThread<string?>(() =>
    {
        using var form = new Form
        {
            Text = "VaayuGuard — Uninstall",
            Width = 380,
            Height = 175,
            FormBorderStyle = FormBorderStyle.FixedDialog,
            StartPosition = FormStartPosition.CenterScreen,
            MaximizeBox = false,
            MinimizeBox = false,
            TopMost = true,
        };
        var label = new Label { Text = "Enter the VaayuGuard uninstall code:", Left = 14, Top = 15, Width = 345 };
        var box = new TextBox { Left = 14, Top = 42, Width = 345, UseSystemPasswordChar = true };
        var ok = new Button { Text = "Continue", Left = 197, Top = 85, Width = 75, DialogResult = DialogResult.OK };
        var cancel = new Button { Text = "Cancel", Left = 278, Top = 85, Width = 75, DialogResult = DialogResult.Cancel };
        form.Controls.AddRange([label, box, ok, cancel]);
        form.AcceptButton = ok;
        form.CancelButton = cancel;
        return form.ShowDialog() == DialogResult.OK ? box.Text : null;
    });

    private static bool ShowUninstallPage() => RunOnStaThread(() =>
    {
        using var form = new Form
        {
            Text = "VaayuGuard — Uninstall",
            Width = 430,
            Height = 230,
            FormBorderStyle = FormBorderStyle.FixedDialog,
            StartPosition = FormStartPosition.CenterScreen,
            MaximizeBox = false,
            MinimizeBox = false,
            TopMost = true,
        };
        var label = new Label
        {
            Text =
                "This will stop and completely remove VaayuGuard from this PC:\n\n" +
                "   •  the monitoring agent and its watchdog\n" +
                "   •  their scheduled tasks\n" +
                "   •  the browser identity-helper policy\n" +
                "   •  all locally stored data\n\n" +
                "Administrator rights are required to finish removal.",
            Left = 16,
            Top = 14,
            Width = 395,
            Height = 140,
        };
        var uninstall = new Button { Text = "Uninstall", Left = 232, Top = 158, Width = 85, DialogResult = DialogResult.OK };
        var cancel = new Button { Text = "Cancel", Left = 323, Top = 158, Width = 85, DialogResult = DialogResult.Cancel };
        form.Controls.AddRange([label, uninstall, cancel]);
        form.AcceptButton = uninstall;
        form.CancelButton = cancel;
        return form.ShowDialog() == DialogResult.OK;
    });

    private static void ShowMessage(string text, MessageBoxIcon icon) => RunOnStaThread<object?>(() =>
    {
        MessageBox.Show(text, "VaayuGuard Uninstall", MessageBoxButtons.OK, icon);
        return null;
    });

    private static T RunOnStaThread<T>(Func<T> func)
    {
        T result = default!;
        var thread = new Thread(() => result = func());
        thread.SetApartmentState(ApartmentState.STA);
        thread.Start();
        thread.Join();
        return result;
    }
}
