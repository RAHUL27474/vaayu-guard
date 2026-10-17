// VaayuGuard Admin — desktop launcher for the admin/developer dashboard.
//
// Opens the dashboard in its own app window (no tabs or address bar) using
// Microsoft Edge's app mode, which ships with every Windows 10/11 PC; falls
// back to Chrome, then to the default browser. Edge keeps the sign-in between
// launches. Built with the C# compiler that ships with Windows — see build.ps1.
using System;
using System.Diagnostics;
using System.IO;

static class VaayuGuardAdmin
{
    const string DashboardUrl = "https://vaayuguard-bice.vercel.app/devices";

    [STAThread]
    static void Main()
    {
        string pf = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
        string pf86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
        string local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);

        string[] browsers =
        {
            Path.Combine(pf86, @"Microsoft\Edge\Application\msedge.exe"),
            Path.Combine(pf, @"Microsoft\Edge\Application\msedge.exe"),
            Path.Combine(pf, @"Google\Chrome\Application\chrome.exe"),
            Path.Combine(pf86, @"Google\Chrome\Application\chrome.exe"),
            Path.Combine(local, @"Google\Chrome\Application\chrome.exe"),
        };

        foreach (string exe in browsers)
        {
            if (!File.Exists(exe)) continue;
            try
            {
                Process.Start(new ProcessStartInfo(exe, "--app=" + DashboardUrl + " --window-size=1280,860")
                {
                    UseShellExecute = false,
                });
                return;
            }
            catch
            {
                // Try the next browser.
            }
        }

        // No Edge/Chrome found — open in whatever the default browser is.
        Process.Start(new ProcessStartInfo(DashboardUrl) { UseShellExecute = true });
    }
}
