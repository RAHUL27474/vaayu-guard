namespace VaayuMonitor.Agent;

public class AgentOptions
{
    public const string SectionName = "VaayuGuard";

    public string BackendBaseUrl { get; set; } = "";
    public int PollIntervalSeconds { get; set; } = 45;
    public int FlushIntervalSeconds { get; set; } = 30;
    public string DataDirectory { get; set; } = "%ProgramData%\\VaayuGuard";

    /// <summary>How often to check the dashboard for a newer agent build.</summary>
    public int UpdateCheckIntervalMinutes { get; set; } = 240;

    /// <summary>Resolves %ProgramData% etc. and ensures the directory exists.</summary>
    public string ResolveDataDirectory()
    {
        var path = Environment.ExpandEnvironmentVariables(DataDirectory);
        Directory.CreateDirectory(path);
        return path;
    }
}
