using System.Runtime.InteropServices;
using System.Text;

namespace VaayuMonitor.Agent;

public record ScannedWindow(string ProcessName, string WindowTitle);

/// <summary>
/// Enumerates top-level visible windows via raw P/Invoke, filtered to the
/// browser/mail processes we care about. Runs in the logged-in user's own
/// session (the agent is launched by a per-logon Scheduled Task, not a
/// Session-0 service), so it sees the user's own windows directly.
/// </summary>
public class WindowScanner
{
    private static readonly HashSet<string> TargetProcesses = new(StringComparer.OrdinalIgnoreCase)
    {
        "chrome", "msedge", "firefox", "outlook",
    };

    [DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetWindowTextLength(IntPtr hWnd);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    public IReadOnlyList<ScannedWindow> Scan()
    {
        var results = new List<ScannedWindow>();

        EnumWindows((hWnd, _) =>
        {
            if (!IsWindowVisible(hWnd)) return true;

            var length = GetWindowTextLength(hWnd);
            if (length == 0) return true;

            var sb = new StringBuilder(length + 1);
            GetWindowText(hWnd, sb, sb.Capacity);
            var title = sb.ToString();
            if (string.IsNullOrWhiteSpace(title)) return true;

            GetWindowThreadProcessId(hWnd, out var pid);
            string processName;
            try
            {
                processName = System.Diagnostics.Process.GetProcessById((int)pid).ProcessName;
            }
            catch
            {
                // Process exited between enumeration and lookup — skip it.
                return true;
            }

            if (TargetProcesses.Contains(processName))
            {
                results.Add(new ScannedWindow(processName, title));
            }

            return true; // keep enumerating
        }, IntPtr.Zero);

        return results;
    }
}
