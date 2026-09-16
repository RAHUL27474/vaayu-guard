using System.Text.Json;

namespace VaayuMonitor.Agent;

/// <summary>
/// The last WhatsApp account number the browser extension reported, written
/// by <see cref="WhatsAppIdentityServer"/> and read back by the classifier.
/// A plain local file rather than anything fancier — the extension and the
/// agent are two separate processes with no other shared state.
/// </summary>
public record WhatsAppIdentityRecord(string Number, DateTimeOffset ReportedAt);

public static class WhatsAppIdentityStore
{
    // Longer than the extension's own ~15s report interval by a wide
    // margin, so a couple of missed reports (tab backgrounded, page
    // reloading) don't make a genuinely-open WhatsApp Web look "unknown".
    private static readonly TimeSpan StaleAfter = TimeSpan.FromMinutes(5);

    private static string StatePath(AgentOptions options) =>
        Path.Combine(options.ResolveDataDirectory(), "whatsapp_identity.json");

    public static void Save(AgentOptions options, string number)
    {
        var record = new WhatsAppIdentityRecord(number, DateTimeOffset.UtcNow);
        File.WriteAllText(StatePath(options), JsonSerializer.Serialize(record));
    }

    /// <summary>The current number, or null if never reported or the report is stale.</summary>
    public static string? TryGetCurrentNumber(AgentOptions options)
    {
        var path = StatePath(options);
        if (!File.Exists(path)) return null;
        try
        {
            var record = JsonSerializer.Deserialize<WhatsAppIdentityRecord>(File.ReadAllText(path));
            if (record is null) return null;
            if (DateTimeOffset.UtcNow - record.ReportedAt > StaleAfter) return null;
            return record.Number;
        }
        catch
        {
            return null; // corrupt file — treat as unknown, not fatal
        }
    }
}
