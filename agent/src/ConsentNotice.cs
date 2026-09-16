using System.Text.Json;

namespace VaayuMonitor.Agent;

/// <summary>
/// Shows the employee notice (see docs/CONSENT_NOTICE_TEXT.md) on first run
/// AND again whenever <see cref="CurrentNoticeVersion"/> is bumped — e.g.
/// because what's monitored widened. Only an explicit OK click writes the
/// local acknowledgment; closing via X does not count and the notice
/// reshows next launch until acknowledged.
/// </summary>
public static class ConsentNotice
{
    // Bump this — and the text below, and docs/CONSENT_NOTICE_TEXT.md —
    // whenever the scope of what's monitored changes. A version bump makes
    // already-installed agents re-show the notice even though the employee
    // acknowledged an earlier version.
    public const int CurrentNoticeVersion = 3;

    private const string NoticeText =
        "VaayuTrip Monitoring Notice\n\n" +
        "This is a company-owned computer. VaayuTrip monitors this PC to check " +
        "that the company email account assigned to this desktop is the one in " +
        "use, to detect when WhatsApp Web is open and which WhatsApp number is " +
        "signed in (via a companion browser extension), and to log which apps " +
        "and browser tabs (by title only) are open during working hours.\n\n" +
        "This tool does not record keystrokes, screenshots, or the content of " +
        "your messages, emails, or documents — only window/tab titles and " +
        "which account/number is signed in.\n\n" +
        "By clicking OK, you acknowledge this notice.";

    private record AckRecord(string AcknowledgedAt, string WindowsUser, int NoticeVersion);

    // Set while the notice thread is up, so a tick that runs again before
    // it's dismissed doesn't stack a fresh popup on top of it every 45s.
    private static volatile bool _noticeShowing;

    private static string AckPath(AgentOptions options) =>
        Path.Combine(options.ResolveDataDirectory(), "consent_ack.json");

    public static bool IsAcknowledged(AgentOptions options)
    {
        var path = AckPath(options);
        if (!File.Exists(path)) return false;
        try
        {
            var record = JsonSerializer.Deserialize<AckRecord>(File.ReadAllText(path));
            return record is not null && record.NoticeVersion >= CurrentNoticeVersion;
        }
        catch
        {
            return false; // corrupt/old-format file — treat as not acknowledged
        }
    }

    /// <summary>
    /// If not already acknowledged (for the current notice version), shows
    /// the notice on a dedicated STA thread (the host's main thread
    /// apartment state isn't controllable from a top-level-statement
    /// Program.cs) — WITHOUT blocking the caller. Confirmed live: this used
    /// to Join() the thread, which froze the entire Worker tick loop
    /// (scanning AND check-ins) until someone noticed and dismissed the
    /// popup — directly contradicting "scanning still proceeds regardless"
    /// above. The whole point of calling this every tick until acknowledged
    /// is that everything else keeps working meanwhile.
    /// </summary>
    public static void EnsureAcknowledged(AgentOptions options)
    {
        if (IsAcknowledged(options)) return;
        if (_noticeShowing) return;

        _noticeShowing = true;
        var thread = new Thread(() =>
        {
            try
            {
                var result = System.Windows.Forms.MessageBox.Show(
                    NoticeText,
                    "VaayuTrip Monitoring Notice",
                    System.Windows.Forms.MessageBoxButtons.OK,
                    System.Windows.Forms.MessageBoxIcon.Information);

                if (result == System.Windows.Forms.DialogResult.OK)
                {
                    var ack = new AckRecord(DateTimeOffset.UtcNow.ToString("o"), Environment.UserName, CurrentNoticeVersion);
                    File.WriteAllText(AckPath(options), JsonSerializer.Serialize(ack));
                }
            }
            finally
            {
                _noticeShowing = false;
            }
        })
        {
            IsBackground = true,
        };
        thread.SetApartmentState(ApartmentState.STA);
        thread.Start();
    }
}
