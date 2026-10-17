namespace VaayuMonitor.Agent;

public record ActiveTabReport(string Host, string Title, DateTimeOffset ReceivedAt);

/// <summary>
/// In-memory, process-wide buffer of the most recent "active browser tab"
/// reports posted by the VaayuGuard browser extension (see
/// WhatsAppIdentityServer's /active-tab route). The Worker reads from it to
/// attach a site (host) to the foreground browser window it scans.
///
/// A DI singleton so the HTTP listener (which writes) and the Worker (which
/// reads) share the same instance. The extension only ever sends the tab's
/// host (e.g. "mail.google.com"), never the full path/query.
/// </summary>
public class ActiveTabStore
{
    private readonly object _lock = new();
    private readonly LinkedList<ActiveTabReport> _recent = new(); // most-recent first
    private const int MaxRecent = 24;

    // A window the agent scans is matched to a report only if the report is
    // this fresh — long enough to cover a poll interval or two, short enough
    // that a stale tab doesn't get pinned to an unrelated window.
    private static readonly TimeSpan Freshness = TimeSpan.FromSeconds(90);

    // Document titles shorter than this are too generic to correlate safely
    // (e.g. "", "New Tab"); for those we don't guess a host.
    private const int MinTitleLenForMatch = 4;

    // Per browser profile (keyed by its signed-in email): the active-tab title
    // of each of its windows, as last reported by that profile's copy of the
    // extension. Lets any browser window be matched to the account it's
    // signed in as — even when several profiles share a display name.
    private readonly Dictionary<string, (string[] Titles, DateTimeOffset At)> _profileWindows =
        new(StringComparer.OrdinalIgnoreCase);

    public void ReportProfileWindows(string email, IEnumerable<string>? titles)
    {
        if (string.IsNullOrWhiteSpace(email)) return;
        var clean = (titles ?? []).Select(t => t.Trim()).Where(t => t.Length >= MinTitleLenForMatch).ToArray();
        lock (_lock) _profileWindows[email.Trim()] = (clean, DateTimeOffset.UtcNow);
    }

    /// <summary>
    /// The signed-in email of the browser profile whose reported window titles
    /// match this window's title, or null if no fresh report correlates. The
    /// longest matching title wins, so a short generic title can't steal a
    /// window from a profile with a more specific match.
    /// </summary>
    public string? ResolveEmailForWindow(string windowTitle)
    {
        if (string.IsNullOrWhiteSpace(windowTitle)) return null;
        var now = DateTimeOffset.UtcNow;
        string? best = null;
        var bestLen = 0;

        lock (_lock)
        {
            foreach (var (email, report) in _profileWindows)
            {
                if (now - report.At > Freshness) continue;
                foreach (var title in report.Titles)
                {
                    if (title.Length > bestLen && windowTitle.Contains(title, StringComparison.Ordinal))
                    {
                        best = email;
                        bestLen = title.Length;
                    }
                }
            }
        }
        return best;
    }

    public void Report(string host, string? title)
    {
        if (string.IsNullOrWhiteSpace(host)) return;
        var report = new ActiveTabReport(host.Trim(), (title ?? "").Trim(), DateTimeOffset.UtcNow);
        lock (_lock)
        {
            _recent.AddFirst(report);
            while (_recent.Count > MaxRecent) _recent.RemoveLast();
        }
    }

    /// <summary>
    /// The host of the freshest active-tab report whose document title is
    /// contained in this browser window's title, or null if none correlates.
    /// Chrome titles are "&lt;tab title&gt; - [Profile - ] Google Chrome", so the
    /// reported document title is a substring of the window title.
    /// </summary>
    public string? ResolveHostForWindow(string windowTitle)
    {
        if (string.IsNullOrWhiteSpace(windowTitle)) return null;
        var now = DateTimeOffset.UtcNow;

        lock (_lock)
        {
            foreach (var r in _recent)
            {
                if (now - r.ReceivedAt > Freshness) continue;
                if (r.Title.Length < MinTitleLenForMatch) continue;
                if (windowTitle.Contains(r.Title, StringComparison.Ordinal)) return r.Host;
            }
        }
        return null;
    }
}
