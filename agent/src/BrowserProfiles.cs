using System.Text.Json;

namespace VaayuMonitor.Agent;

public record BrowserProfileInfo(string Browser, string Name, string? Email);

/// <summary>
/// Figures out which browser profile a window belongs to, by matching the
/// profile name a Chromium browser appends to its window title
/// ("&lt;tab title&gt; - &lt;Profile name&gt; - Google Chrome") against the set of
/// profile display names read from the browser's own "Local State" file.
///
/// Using the real known names (not a blind "the segment before the browser
/// name") is what makes this reliable — a page title full of " - " separators
/// won't be mistaken for a profile unless it actually ends with a real
/// profile's name. The default/only profile usually isn't named in the title
/// at all, which is fine: it simply reports no profile and is never silenced
/// by a profile rule.
/// </summary>
public static class BrowserProfiles
{
    private static readonly HashSet<string> BrowserProcesses =
        new(StringComparer.OrdinalIgnoreCase) { "chrome", "msedge", "brave" };

    // Trailing " - &lt;app&gt;" text each browser puts at the end of its title.
    private static readonly Dictionary<string, string[]> AppNames =
        new(StringComparer.OrdinalIgnoreCase)
        {
            ["chrome"] = ["Google Chrome"],
            ["msedge"] = ["Microsoft Edge", "Microsoft​Edge"],
            ["brave"] = ["Brave"],
        };

    // Where each browser keeps its profile.info_cache (display names).
    private static string[] LocalStateFiles()
    {
        var local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        return
        [
            Path.Combine(local, "Google", "Chrome", "User Data", "Local State"),
            Path.Combine(local, "Microsoft", "Edge", "User Data", "Local State"),
            Path.Combine(local, "BraveSoftware", "Brave-Browser", "User Data", "Local State"),
        ];
    }

    public static bool IsBrowser(string processName) => BrowserProcesses.Contains(processName);

    // Same order as LocalStateFiles().
    private static readonly string[] LocalStateBrowsers = ["chrome", "msedge", "brave"];

    /// <summary>
    /// Every profile of every installed Chromium browser: its display name and
    /// the Google/Microsoft account signed in to it (info_cache "user_name";
    /// null when the profile isn't signed in).
    /// </summary>
    public static IReadOnlyList<BrowserProfileInfo> KnownProfiles()
    {
        var result = new List<BrowserProfileInfo>();
        var files = LocalStateFiles();
        for (var i = 0; i < files.Length; i++)
        {
            try
            {
                if (!File.Exists(files[i])) continue;
                // Opened shared: the browser keeps Local State open while running.
                using var stream = new FileStream(files[i], FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
                using var doc = JsonDocument.Parse(stream);
                if (doc.RootElement.TryGetProperty("profile", out var profile) &&
                    profile.TryGetProperty("info_cache", out var cache) &&
                    cache.ValueKind == JsonValueKind.Object)
                {
                    foreach (var entry in cache.EnumerateObject())
                    {
                        var name = ReadString(entry.Value, "name");
                        if (string.IsNullOrWhiteSpace(name)) continue;
                        var email = ReadString(entry.Value, "user_name");
                        result.Add(new BrowserProfileInfo(
                            LocalStateBrowsers[i],
                            name!,
                            string.IsNullOrWhiteSpace(email) ? null : email));
                    }
                }
            }
            catch
            {
                // Missing or locked Local State — just skip this browser.
            }
        }
        return result;
    }

    /// <summary>Profile display names across all installed Chromium browsers.</summary>
    public static IReadOnlyCollection<string> KnownProfileNames(IReadOnlyList<BrowserProfileInfo> profiles) =>
        profiles.Select(p => p.Name).ToHashSet(StringComparer.OrdinalIgnoreCase);

    /// <summary>
    /// The account email in use in a browser window: the signed-in account of
    /// the profile named in its title, or — when the title names no profile,
    /// which is what a browser with a single profile does — that browser's only
    /// profile's account. Null if it can't be determined.
    /// </summary>
    public static string? ResolveAccountEmail(string processName, string? profileName, IReadOnlyList<BrowserProfileInfo> profiles)
    {
        if (!IsBrowser(processName)) return null;
        var mine = profiles.Where(p => string.Equals(p.Browser, processName, StringComparison.OrdinalIgnoreCase)).ToList();

        if (profileName is not null)
        {
            // Only trust the name when it's unique — several profiles can
            // share a display name (e.g. three all called "vaayutrip.com"),
            // and guessing would attribute activity to the wrong account.
            var named = mine.Where(p => string.Equals(p.Name, profileName, StringComparison.OrdinalIgnoreCase)).ToList();
            return named.Count == 1 ? named[0].Email : null;
        }
        return mine.Count == 1 ? mine[0].Email : null;
    }

    private static string? ReadString(JsonElement obj, string property) =>
        obj.TryGetProperty(property, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;

    /// <summary>
    /// The profile name for a browser window, or null if it's not a (known)
    /// browser window or the title names no known profile (default profile).
    /// </summary>
    public static string? Parse(string processName, string windowTitle, IReadOnlyCollection<string> knownNames)
    {
        if (!IsBrowser(processName) || string.IsNullOrWhiteSpace(windowTitle)) return null;
        if (!AppNames.TryGetValue(processName, out var apps)) return null;
        if (knownNames.Count == 0) return null;

        // Strip the trailing " - <app>" so what's left ends with the profile
        // segment (if any).
        string? body = null;
        foreach (var app in apps)
        {
            var suffix = " - " + app;
            if (windowTitle.EndsWith(suffix, StringComparison.OrdinalIgnoreCase))
            {
                body = windowTitle[..^suffix.Length];
                break;
            }
            if (windowTitle.Equals(app, StringComparison.OrdinalIgnoreCase))
            {
                body = "";
                break;
            }
        }
        if (body is null) return null; // not a recognizable window title for this browser

        foreach (var name in knownNames)
        {
            if (string.IsNullOrWhiteSpace(name)) continue;
            // "<page> - <Profile>"  or just "<Profile>" (e.g. the New Tab page).
            if (body.EndsWith(" - " + name, StringComparison.OrdinalIgnoreCase)) return name;
            if (body.Equals(name, StringComparison.OrdinalIgnoreCase)) return name;
        }
        return null;
    }
}
