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
    private static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    private static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);

    [DllImport("kernel32.dll")]
    private static extern uint GetCurrentThreadId();

    [DllImport("user32.dll")]
    private static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

    private const int SW_RESTORE = 9;
    private const byte VK_CONTROL = 0x11;
    private const byte VK_W = 0x57;
    private const uint KEYEVENTF_KEYUP = 0x0002;

    private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    /// <summary>
    /// Closes just the one tab showing the flagged identity — never the
    /// whole window. A window-level WM_CLOSE on a multi-tab browser window
    /// triggers Chrome's own "Close all N tabs?" confirmation, which
    /// nothing here can (or should) click through; a real Ctrl+W only
    /// closes the active tab, no confirmation needed. This only ever
    /// affects the exact tab that matched — the caller re-classifies the
    /// window's title immediately before calling this, so if the user had
    /// since switched to a different tab, this is never invoked at all.
    /// Momentarily steals focus (brings the window to front) — visible by
    /// design, not a silent background action.
    /// </summary>
    public static void CloseActiveTab(IntPtr hwnd)
    {
        // The trick is attaching to whichever thread currently OWNS the
        // foreground lock — not to the target window's thread — since
        // Windows only lets the foreground-owning thread (and anything
        // attached to it) change the foreground window.
        var currentForeground = GetForegroundWindow();
        GetWindowThreadProcessId(currentForeground, out var foregroundThreadId);
        var currentThreadId = GetCurrentThreadId();

        var attached = foregroundThreadId != 0 && foregroundThreadId != currentThreadId
            && AttachThreadInput(currentThreadId, foregroundThreadId, true);
        try
        {
            ShowWindow(hwnd, SW_RESTORE);
            SetForegroundWindow(hwnd);
            Thread.Sleep(150); // let the window actually take focus before sending keys

            keybd_event(VK_CONTROL, 0, 0, UIntPtr.Zero);
            keybd_event(VK_W, 0, 0, UIntPtr.Zero);
            Thread.Sleep(30);
            keybd_event(VK_W, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
            keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
        }
        finally
        {
            if (attached) AttachThreadInput(currentThreadId, foregroundThreadId, false);
        }
    }

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
