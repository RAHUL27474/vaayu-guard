using System.Text.Json;
using System.Text.Json.Serialization;

namespace VaayuMonitor.Agent;

public class LocalFilterRule
{
    /// <summary>"tab", "email" or "whatsapp".</summary>
    [JsonPropertyName("target")] public string Target { get; set; } = "tab";
    [JsonPropertyName("pattern")] public string Pattern { get; set; } = "";
}

/// <summary>
/// Per-PC developer settings, edited from the local developer panel (opened
/// with `--dev &lt;code&gt;`) and read by the Worker before it sends anything.
/// These are LOCAL and sit ON TOP of the dashboard's per-device filters — the
/// agent drops anything matching either layer, and while paused it sends
/// nothing at all. Stored as JSON in the data dir; the Worker reloads it when
/// the file changes so edits take effect without restarting the agent.
/// </summary>
public class LocalDevConfig
{
    [JsonPropertyName("paused")] public bool Paused { get; set; }
    [JsonPropertyName("filters")] public List<LocalFilterRule> Filters { get; set; } = [];

    private const string FileName = "local_dev.json";

    private static string Path_(AgentOptions options) =>
        System.IO.Path.Combine(options.ResolveDataDirectory(), FileName);

    public static LocalDevConfig Load(AgentOptions options)
    {
        try
        {
            var path = Path_(options);
            if (File.Exists(path))
                return JsonSerializer.Deserialize<LocalDevConfig>(File.ReadAllText(path)) ?? new();
        }
        catch { /* corrupt/missing — start clean */ }
        return new LocalDevConfig();
    }

    public void Save(AgentOptions options)
    {
        var json = JsonSerializer.Serialize(this, new JsonSerializerOptions { WriteIndented = true });
        File.WriteAllText(Path_(options), json);
    }

    /// <summary>Last-write time of the config file, for cheap change detection.</summary>
    public static DateTime LastWriteUtc(AgentOptions options)
    {
        try
        {
            var path = Path_(options);
            return File.Exists(path) ? File.GetLastWriteTimeUtc(path) : DateTime.MinValue;
        }
        catch { return DateTime.MinValue; }
    }

    private static string DigitsOnly(string s) => new(s.Where(char.IsDigit).ToArray());

    /// <summary>
    /// Mirror of the dashboard's visibility-filter.ts matching: a sighting is
    /// hidden (never sent) if any rule matches. tab/email are case-insensitive
    /// substring matches (email also checks the detected identity); whatsapp is
    /// a digits-only comparison.
    /// </summary>
    public bool IsHidden(string windowTitle, string? detectedIdentity)
    {
        if (Filters.Count == 0) return false;

        var title = (windowTitle ?? "").ToLowerInvariant();
        var identity = (detectedIdentity ?? "").ToLowerInvariant();
        var titleDigits = DigitsOnly(windowTitle ?? "");
        var identityDigits = DigitsOnly(detectedIdentity ?? "");

        foreach (var r in Filters)
        {
            var pattern = r.Pattern?.Trim();
            if (string.IsNullOrEmpty(pattern)) continue;

            if (string.Equals(r.Target, "whatsapp", StringComparison.OrdinalIgnoreCase))
            {
                var p = DigitsOnly(pattern);
                if (p.Length > 0 && (titleDigits.Contains(p) || identityDigits.Contains(p))) return true;
                continue;
            }

            var pl = pattern.ToLowerInvariant();
            if (string.Equals(r.Target, "tab", StringComparison.OrdinalIgnoreCase))
            {
                if (title.Contains(pl)) return true;
            }
            else if (title.Contains(pl) || identity.Contains(pl))
            {
                return true;
            }
        }
        return false;
    }
}
