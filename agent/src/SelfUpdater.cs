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
    public const int CurrentAgentVersion = 23;

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

    /// <summary>
    /// Why the last update attempt failed, or null if it succeeded / there was
    /// nothing to do. Sent with each check-in (devices.agent_update_error) so a
    /// PC that isn't updating can be diagnosed without visiting it.
    /// </summary>
    public static string? LastError { get; private set; }

    // Generous: the exe is tens of MB and office links can be slow. The
    // download streams to disk, so a slow link costs time, not memory.
    private static readonly TimeSpan DownloadTimeout = TimeSpan.FromMinutes(30);

    public async Task CheckAndApplyAsync(CancellationToken ct)
    {
        UpdateManifest? manifest;
        try
        {
            manifest = await http.GetFromJsonAsync<UpdateManifest>("/agent/manifest.json", ct);
        }
        catch (Exception ex)
        {
            Fail($"update check failed: {ex.GetType().Name}: {ex.Message}", ex);
            return;
        }

        if (manifest is null || manifest.Version <= CurrentAgentVersion)
        {
            LastError = null;
            return;
        }

        logger.LogInformation(
            "Update available: v{Current} -> v{New} — downloading",
            CurrentAgentVersion, manifest.Version);

        var currentExePath = Environment.ProcessPath;
        if (string.IsNullOrEmpty(currentExePath))
        {
            Fail("could not determine the running executable's path");
            return;
        }

        // Stream straight to a file beside the exe — no whole-file buffering,
        // and no short request timeout cutting off a slow download.
        var newPath = currentExePath + ".new";
        var started = DateTimeOffset.UtcNow;
        try
        {
            using var downloadCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            downloadCts.CancelAfter(DownloadTimeout);
            using var res = await http.GetAsync(manifest.Url, HttpCompletionOption.ResponseHeadersRead, downloadCts.Token);
            res.EnsureSuccessStatusCode();
            await using var body = await res.Content.ReadAsStreamAsync(downloadCts.Token);
            await using var file = new FileStream(newPath, FileMode.Create, FileAccess.Write, FileShare.None, 1 << 16, useAsync: true);
            await body.CopyToAsync(file, 1 << 16, downloadCts.Token);
        }
        catch (Exception ex)
        {
            TryDelete(newPath);
            Fail($"download of v{manifest.Version} failed after {(DateTimeOffset.UtcNow - started).TotalSeconds:F0}s: {ex.GetType().Name}: {ex.Message}", ex);
            return;
        }

        if (manifest.Sha256 is not null)
        {
            string hash;
            await using (var file = File.OpenRead(newPath))
            {
                hash = Convert.ToHexString(await SHA256.HashDataAsync(file, ct)).ToLowerInvariant();
            }
            if (!string.Equals(hash, manifest.Sha256, StringComparison.OrdinalIgnoreCase))
            {
                TryDelete(newPath);
                Fail($"downloaded v{manifest.Version} failed the hash check");
                return;
            }
        }

        try
        {
            var oldPath = currentExePath + ".old";
            TryDelete(oldPath);

            // Renaming a running exe is allowed (only its content is
            // locked); this frees up the original path for the new build.
            File.Move(currentExePath, oldPath);
            File.Move(newPath, currentExePath);
        }
        catch (Exception ex)
        {
            TryDelete(newPath);
            Fail($"could not swap in v{manifest.Version}: {ex.GetType().Name}: {ex.Message}", ex);
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

    private void Fail(string message, Exception? ex = null)
    {
        LastError = message.Length > 500 ? message[..500] : message;
        logger.LogWarning(ex, "Self-update: {Message}", message);
    }

    private static void TryDelete(string path)
    {
        try { if (File.Exists(path)) File.Delete(path); } catch { /* best-effort */ }
    }
}
