using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json.Serialization;

namespace VaayuMonitor.Agent;

public record UpdateManifest(
    [property: JsonPropertyName("version")] int Version,
    [property: JsonPropertyName("url")] string Url,
    [property: JsonPropertyName("sha256")] string? Sha256);

/// <summary>
/// Checks the dashboard for a newer published build and, if found,
/// downloads it, verifies its hash, and swaps it into place — so updating
/// VaayuGuard never again means walking to 11 PCs with a USB stick.
/// The running process cannot overwrite its own exe file, so this hands
/// off to a tiny detached helper script that waits for this process to
/// exit, does the copy, and relaunches it.
/// </summary>
public class SelfUpdater(HttpClient http, AgentOptions options, ILogger<SelfUpdater> logger)
{
    // Bump alongside agent/install/stage-update.ps1's manifest version on
    // every release that should trigger already-installed agents to update.
    public const int CurrentAgentVersion = 3;

    public async Task CheckAndApplyAsync(CancellationToken ct)
    {
        UpdateManifest? manifest;
        try
        {
            manifest = await http.GetFromJsonAsync<UpdateManifest>("/agent/manifest.json", ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Update check failed");
            return;
        }

        if (manifest is null || manifest.Version <= CurrentAgentVersion) return;

        logger.LogInformation(
            "Update available: v{Current} -> v{New} — downloading",
            CurrentAgentVersion, manifest.Version);

        byte[] bytes;
        try
        {
            bytes = await http.GetByteArrayAsync(manifest.Url, ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Update download failed");
            return;
        }

        if (manifest.Sha256 is not null)
        {
            var hash = Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
            if (!string.Equals(hash, manifest.Sha256, StringComparison.OrdinalIgnoreCase))
            {
                logger.LogWarning("Downloaded update failed the hash check — discarding, will retry later.");
                return;
            }
        }

        var currentExePath = Environment.ProcessPath;
        if (string.IsNullOrEmpty(currentExePath))
        {
            logger.LogWarning("Could not determine the running executable's path — skipping self-update.");
            return;
        }

        var updateDir = Path.Combine(options.ResolveDataDirectory(), "update");
        Directory.CreateDirectory(updateDir);
        var newExePath = Path.Combine(updateDir, "VaayuGuardAgent.new.exe");
        await File.WriteAllBytesAsync(newExePath, bytes, ct);

        // cmd, not PowerShell: no execution-policy prompt, and it's already
        // on every Windows install. Small delay lets this process actually
        // exit (its exe file is locked while running) before the copy.
        var scriptPath = Path.Combine(updateDir, "apply-update.cmd");
        var script = $"""
            @echo off
            timeout /t 3 /nobreak > nul
            copy /y "{newExePath}" "{currentExePath}" > nul
            start "" "{currentExePath}"
            del "{newExePath}"
            del "%~f0"
            """;
        await File.WriteAllTextAsync(scriptPath, script, ct);

        System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
        {
            FileName = scriptPath,
            UseShellExecute = true,
            WindowStyle = System.Diagnostics.ProcessWindowStyle.Hidden,
        });

        logger.LogInformation("Update staged — restarting now to apply v{Version}", manifest.Version);
        Environment.Exit(0);
    }
}
