namespace VaayuMonitor.Agent;

public class AgentOptions
{
    public const string SectionName = "VaayuGuard";

    // Baked-in default so a bare, single downloaded exe (no appsettings.json
    // alongside it) still knows where to enroll. Now the permanent Vercel
    // deployment — no longer tied to this laptop's LAN dev server staying up.
    public string BackendBaseUrl { get; set; } = "https://vaayuguard-bice.vercel.app";
    public int PollIntervalSeconds { get; set; } = 45;
    public int FlushIntervalSeconds { get; set; } = 30;
    public string DataDirectory { get; set; } = "%ProgramData%\\VaayuGuard";

    /// <summary>How often to check the dashboard for a newer agent build.</summary>
    public int UpdateCheckIntervalMinutes { get; set; } = 60;

    /// <summary>
    /// Loopback-only port the VaayuGuard browser extension posts the
    /// signed-in WhatsApp account's own number to. See WhatsAppIdentityServer.
    /// </summary>
    public int WhatsAppIdentityPort { get; set; } = 8737;

    /// <summary>
    /// Where the installer copies itself to and registers the Scheduled
    /// Task against. If the running exe is already at this path, it's
    /// treated as "already installed" and runs as the background worker
    /// instead of showing the install prompt again.
    /// </summary>
    public string InstallDirectory { get; set; } = "%ProgramFiles%\\VaayuGuard";

    /// <summary>
    /// Skips the interactive email prompt during install when set (e.g.
    /// `VaayuGuard__InstallerEmail=cre@vaayutrip.com`) — for IT scripting a
    /// silent install, and for automated testing.
    /// </summary>
    public string? InstallerEmail { get; set; }

    /// <summary>
    /// SHA-256 (lowercase hex) of the secret code required to uninstall the
    /// agent via `VaayuGuardAgent.exe --uninstall`. VaayuGuard has no normal
    /// Add/Remove-Programs uninstall and keeps itself running via a Scheduled
    /// Task + watchdog, so an ordinary user can't remove it like an app; only
    /// someone with this code (and local admin rights) can. The plaintext is
    /// never stored — only this hash, which the entered code is hashed and
    /// compared against. Default is the code `VG7K-29QX-4MZ8`; CHANGE IT
    /// before rollout. To set a new code, hash it and replace this value, or
    /// override per-fleet via `VaayuGuard__UninstallCodeSha256`. PowerShell to
    /// hash a code:
    ///   ($c='your-code'; -join ([System.Security.Cryptography.SHA256]::Create().
    ///     ComputeHash([Text.Encoding]::UTF8.GetBytes($c)) | % { $_.ToString('x2') }))
    /// </summary>
    public string UninstallCodeSha256 { get; set; } =
        "390716c4fd38f4d1d1b75390c577784d86a502af781c1fcf67ebffa6e26b92eb";

    /// <summary>
    /// SHA-256 (lowercase hex) of the secret developer-access code. Running
    /// `VaayuGuardAgent.exe --dev &lt;code&gt;` with the correct code opens a local
    /// developer panel on the PC (edit this PC's send hide-list, pause/resume
    /// reporting, view what's being captured). Like the uninstall code this is
    /// dashboard-managed and pushed to agents on check-in; this compiled-in
    /// default (`VGDEV-4K2Q-9MX7`) is only the pre-first-sync fallback. CHANGE
    /// IT before rollout. Override per-fleet via `VaayuGuard__DeveloperCodeSha256`.
    /// </summary>
    public string DeveloperCodeSha256 { get; set; } =
        "d47931e047ce1db637d9c2d150e3ac85457a43e7eaaa0699c78963edd4946d2c";

    public string ResolveInstallDirectory() => Environment.ExpandEnvironmentVariables(InstallDirectory);

    /// <summary>Resolves %ProgramData% etc. and ensures the directory exists.</summary>
    public string ResolveDataDirectory()
    {
        var path = Environment.ExpandEnvironmentVariables(DataDirectory);
        Directory.CreateDirectory(path);
        return path;
    }
}
