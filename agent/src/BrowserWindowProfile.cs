using System.Runtime.InteropServices;
using System.Text.RegularExpressions;

namespace VaayuMonitor.Agent;

/// <summary>
/// Which browser profile a specific window belongs to, read straight from the
/// window itself — no extension needed. Chromium browsers (Chrome, Edge,
/// Brave) tag every browser window with a per-profile relaunch command
/// (e.g. <c>chrome.exe --profile-directory="Profile 9"</c>) so Windows can
/// group each profile separately on the taskbar. That profile folder maps
/// exactly to one entry in the browser's Local State, and so to the account
/// signed in to it — even when several profiles share a display name.
/// </summary>
public static partial class BrowserWindowProfile
{
    // System.AppUserModel.RelaunchCommand
    private static PropertyKey RelaunchCommandKey = new(new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3"), 2);

    [GeneratedRegex("--profile-directory=(?:\"([^\"]+)\"|(\\S+))", RegexOptions.IgnoreCase)]
    private static partial Regex ProfileDirPattern();

    /// <summary>The window's profile folder name (e.g. "Profile 9", "Default"), or null.</summary>
    public static string? GetProfileDirectory(IntPtr hwnd)
    {
        var command = GetRelaunchCommand(hwnd);
        if (string.IsNullOrEmpty(command)) return null;
        var m = ProfileDirPattern().Match(command);
        if (!m.Success) return null;
        var dir = m.Groups[1].Success ? m.Groups[1].Value : m.Groups[2].Value;
        return string.IsNullOrWhiteSpace(dir) ? null : dir.Trim();
    }

    private static string? GetRelaunchCommand(IntPtr hwnd)
    {
        IPropertyStore? store = null;
        var value = new PropVariant();
        try
        {
            var iid = typeof(IPropertyStore).GUID;
            if (SHGetPropertyStoreForWindow(hwnd, ref iid, out store) != 0 || store is null) return null;
            if (store.GetValue(ref RelaunchCommandKey, out value) != 0) return null;
            const ushort VT_LPWSTR = 31;
            return value.vt == VT_LPWSTR ? Marshal.PtrToStringUni(value.pointerValue) : null;
        }
        catch
        {
            return null; // window closed mid-read, or property unavailable
        }
        finally
        {
            PropVariantClear(ref value);
            if (store is not null) Marshal.ReleaseComObject(store);
        }
    }

    [DllImport("shell32.dll")]
    private static extern int SHGetPropertyStoreForWindow(IntPtr hwnd, ref Guid riid,
        [MarshalAs(UnmanagedType.Interface)] out IPropertyStore propertyStore);

    [DllImport("ole32.dll")]
    private static extern int PropVariantClear(ref PropVariant pvar);

    [StructLayout(LayoutKind.Sequential, Pack = 4)]
    private struct PropertyKey(Guid fmtid, uint pid)
    {
        public Guid fmtid = fmtid;
        public uint pid = pid;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct PropVariant
    {
        public ushort vt;
        public ushort reserved1, reserved2, reserved3;
        public IntPtr pointerValue;
        public IntPtr pointerValue2;
    }

    [ComImport, Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IPropertyStore
    {
        int GetCount(out uint count);
        int GetAt(uint index, out PropertyKey key);
        int GetValue(ref PropertyKey key, out PropVariant value);
        int SetValue(ref PropertyKey key, ref PropVariant value);
        int Commit();
    }
}
