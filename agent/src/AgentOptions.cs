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
    public int UpdateCheckIntervalMinutes { get; set; } = 240;

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

    public string ResolveInstallDirectory() => Environment.ExpandEnvironmentVariables(InstallDirectory);

    /// <summary>Resolves %ProgramData% etc. and ensures the directory exists.</summary>
    public string ResolveDataDirectory()
    {
        var path = Environment.ExpandEnvironmentVariables(DataDirectory);
        Directory.CreateDirectory(path);
        return path;
    }
}
