using System.Runtime.InteropServices;
using System.Text;

namespace VaayuMonitor.Agent;

public record ScannedWindow(string ProcessName, string WindowTitle, bool IsForeground, IntPtr Hwnd);

/// <summary>
/// Enumerates every visible top-level window via raw P/Invoke — every open
/// app/browser window's title, not just Gmail/WhatsApp. Runs in the
/// logged-in user's own session (the agent is launched by a per-logon
/// Scheduled Task, not a Session-0 service), so it sees the user's own
/// windows directly. Titles only: never reads page/document content.
/// </summary>
public class WindowScanner
{
    // Never log the agent's own console/window — pure noise, not activity.
    private static readonly HashSet<string> ExcludedProcesses = new(StringComparer.OrdinalIgnoreCase)
    {
        "VaayuGuardAgent", "conhost",
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

    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    private static extern bool PostMessage(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);

    private const uint WM_CLOSE = 0x0010;

    private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    /// <summary>
    /// Asks a window to close — the same signal Windows sends when you
    /// click its own X button. The app decides what happens next (prompts
    /// to save, closes one tab vs. the whole window, etc.) — this never
    /// force-kills the process or destroys data itself.
    /// </summary>
    public static void RequestClose(IntPtr hwnd) => PostMessage(hwnd, WM_CLOSE, IntPtr.Zero, IntPtr.Zero);

    public IReadOnlyList<ScannedWindow> Scan()
    {
        var results = new List<ScannedWindow>();
        var foregroundHwnd = GetForegroundWindow();

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

            if (!ExcludedProcesses.Contains(processName))
            {
                results.Add(new ScannedWindow(processName, title, hWnd == foregroundHwnd, hWnd));
            }

            return true; // keep enumerating
        }, IntPtr.Zero);

        return results;
    }
}
