using System.Security.Cryptography;
using System.Text;

namespace VaayuMonitor.Agent;

/// <summary>
/// Shared handling for the dashboard-managed secret codes (uninstall code and
/// developer-access code). Each code's SHA-256 is pushed to the agent on every
/// check-in and cached locally, so the codes can be changed from the dashboard
/// and still validated on the PC — even offline, against the last synced value.
/// The compiled-in AgentOptions defaults are only the pre-first-sync fallback.
/// </summary>
public static class SecretCodes
{
    public const string UninstallHashFile = "uninstall.hash";
    public const string DeveloperHashFile = "developer.hash";

    public static void Cache(AgentOptions options, string fileName, string? hashHex)
    {
        if (string.IsNullOrWhiteSpace(hashHex)) return;
        var normalized = hashHex.Trim().ToLowerInvariant();
        if (normalized.Length != 64) return;
        try { File.WriteAllText(Path.Combine(options.ResolveDataDirectory(), fileName), normalized); }
        catch { /* best-effort */ }
    }

    public static string Resolve(AgentOptions options, string fileName, string fallback)
    {
        try
        {
            var path = Path.Combine(Environment.ExpandEnvironmentVariables(options.DataDirectory), fileName);
            if (File.Exists(path))
            {
                var cached = File.ReadAllText(path).Trim().ToLowerInvariant();
                if (cached.Length == 64) return cached;
            }
        }
        catch { /* fall through to the compiled-in default */ }
        return fallback;
    }

    public static bool Matches(string code, string? expectedHashHex)
    {
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(code.Trim())))
            .ToLowerInvariant();
        return string.Equals(hash, expectedHashHex?.Trim().ToLowerInvariant(), StringComparison.Ordinal);
    }
}
