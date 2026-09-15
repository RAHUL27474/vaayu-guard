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
///
/// A running exe's own file content can't be overwritten, but it CAN be
/// renamed while running (Windows only locks the content, not the
/// directory entry) — so this renames itself out of the way, writes the
/// new build at the original path, then exits with a non-zero code and
/// lets the Scheduled Task's own restart-on-failure setting relaunch it.
/// An earlier version spawned a detached helper script to do the swap and
/// relaunch instead; in production that script (and the relaunch) got
/// killed along with this process by Task Scheduler's job-object cleanup
/// the moment this process exited, silently discarding the update and
/// leaving nothing running. Task Scheduler's own restart mechanism doesn't
/// have that problem — it's not a child process of anything this process
/// spawned.
/// </summary>
public class SelfUpdater(HttpClient http, ILogger<SelfUpdater> logger)
{
    // Bump alongside agent/install/stage-update.ps1's manifest version on
    // every release that should trigger already-installed agents to update.
    public const int CurrentAgentVersion = 12;

    /// <summary>
    /// Deletes a leftover renamed-old-exe from an update applied on a
    /// previous run, if any. Call once at startup — by then the OS has
    /// long since released any lock the old process held on it.
    /// </summary>
    public static void CleanupPreviousVersion()
    {
        var currentExePath = Environment.ProcessPath;
        if (string.IsNullOrEmpty(currentExePath)) return;
        var oldPath = currentExePath + ".old";
        try { if (File.Exists(oldPath)) File.Delete(oldPath); }
        catch { /* best-effort — try again next start */ }
    }

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

        try
        {
            var oldPath = currentExePath + ".old";
            try { if (File.Exists(oldPath)) File.Delete(oldPath); } catch { /* ignore */ }

            // Renaming a running exe is allowed (only its content is
            // locked); this frees up the original path for the new build.
            File.Move(currentExePath, oldPath);
            await File.WriteAllBytesAsync(currentExePath, bytes, ct);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to swap in the new build — leaving the current version running");
            return;
        }

        logger.LogInformation(
            "Update applied to disk (v{Version}) — exiting so the Scheduled Task's restart-on-failure relaunches it",
            manifest.Version);

        // Non-zero on purpose: this is what tells Task Scheduler to apply
        // its RestartCount/RestartInterval policy instead of treating this
        // as a normal, intentional completion.
        Environment.Exit(1);
    }
}
