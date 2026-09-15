using System.Diagnostics;
using System.Security.Cryptography;

namespace VaayuMonitor.Agent;

/// <summary>
/// A second, separately-named process (installed alongside the agent as
/// VaayuGuardWatchdog.exe — literally a copy of the same exe, launched with
/// a flag) whose only job is making sure VaayuGuardAgent.exe is running.
///
/// This exists because Task Scheduler's own restart mechanisms turned out
/// NOT to reliably cover every way the agent can stop, confirmed live on
/// the pilot PC: a manual "End Task" is recorded as a forced termination
/// (exit code 0xC000013A), which Task Scheduler treats as an intentional
/// stop rather than a failure, so RestartOnFailure never re-launches it —
/// and a Repetition trigger meant to catch that case didn't reliably
/// re-fire either. Directly polling "is it running? no? start it." sidesteps
/// all of that ambiguity with something simple enough to reason about and
/// test without needing Task Scheduler at all.
/// </summary>
public static class Watchdog
{
    private const string AgentProcessName = "VaayuGuardAgent";
    private static readonly TimeSpan CheckInterval = TimeSpan.FromSeconds(30);

    public static void Run(AgentOptions options)
    {
        var installDir = options.ResolveInstallDirectory();
        var agentExe = Path.Combine(installDir, "VaayuGuardAgent.exe");
        var selfExe = Environment.ProcessPath;

        // SelfUpdater only ever replaces VaayuGuardAgent.exe, not this
        // separately-named copy — refresh it here instead of needing a
        // second update mechanism, so the watchdog doesn't fall permanently
        // behind whatever build is actually current.
        if (!string.IsNullOrEmpty(selfExe))
        {
            TryRefreshSelf(selfExe, agentExe);
        }

        while (true)
        {
            try
            {
                if (!IsAgentRunning() && File.Exists(agentExe))
                {
                    Process.Start(new ProcessStartInfo { FileName = agentExe, UseShellExecute = true });
                }
            }
            catch
            {
                // Best-effort — try again next tick regardless of what went wrong.
            }

            Thread.Sleep(CheckInterval);
        }
    }

    private static bool IsAgentRunning()
    {
        var procs = Process.GetProcessesByName(AgentProcessName);
        foreach (var proc in procs) proc.Dispose();
        return procs.Length > 0;
    }

    private static void TryRefreshSelf(string selfExe, string agentExe)
    {
        try
        {
            if (!File.Exists(agentExe)) return;
            if (string.Equals(selfExe, agentExe, StringComparison.OrdinalIgnoreCase)) return;

            if (File.Exists(selfExe) && ComputeHash(selfExe) == ComputeHash(agentExe)) return;

            var oldPath = selfExe + ".old";
            try { if (File.Exists(oldPath)) File.Delete(oldPath); } catch { /* best-effort */ }
            if (File.Exists(selfExe))
            {
                File.Move(selfExe, oldPath);
            }
            File.Copy(agentExe, selfExe);
        }
        catch
        {
            // Best-effort — a slightly-out-of-date watchdog binary still does its job.
        }
    }

    private static string ComputeHash(string path)
    {
        using var stream = File.OpenRead(path);
        return Convert.ToHexString(SHA256.HashData(stream));
    }
}
