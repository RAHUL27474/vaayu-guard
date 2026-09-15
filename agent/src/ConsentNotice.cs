using System.Text.Json;

namespace VaayuMonitor.Agent;

/// <summary>
/// Shows the one-time employee notice (see docs/CONSENT_NOTICE_TEXT.md) on
/// first run. Only an explicit OK click writes the local acknowledgment —
/// closing the box via X does not count, and the notice reshows next
/// launch until acknowledged.
/// </summary>
public static class ConsentNotice
{
    private const string NoticeText =
        "VaayuTrip Monitoring Notice\n\n" +
        "This is a company-owned computer. VaayuTrip monitors this PC to check " +
        "that the company email account assigned to this desktop is the one in " +
        "use, and to detect when WhatsApp Web is open, during working hours.\n\n" +
        "This tool does not record keystrokes, screenshots, or the content of " +
        "your messages or emails — it only checks which account is signed in.\n\n" +
        "By clicking OK, you acknowledge this notice.";

    private static string AckPath(AgentOptions options) =>
        Path.Combine(options.ResolveDataDirectory(), "consent_ack.json");

    public static bool IsAcknowledged(AgentOptions options) => File.Exists(AckPath(options));

    /// <summary>
    /// If not already acknowledged, blocks (on a dedicated STA thread, since
    /// the host's main thread apartment state isn't controllable from a
    /// top-level-statement Program.cs) showing the notice. Returns true if
    /// the user clicked OK just now.
    /// </summary>
    public static bool EnsureAcknowledged(AgentOptions options)
    {
        if (IsAcknowledged(options)) return false;

        var clickedOk = false;
        var thread = new Thread(() =>
        {
            var result = System.Windows.Forms.MessageBox.Show(
                NoticeText,
                "VaayuTrip Monitoring Notice",
                System.Windows.Forms.MessageBoxButtons.OK,
                System.Windows.Forms.MessageBoxIcon.Information);
            clickedOk = result == System.Windows.Forms.DialogResult.OK;
        });
        thread.SetApartmentState(ApartmentState.STA);
        thread.Start();
        thread.Join();

        if (clickedOk)
        {
            var ack = new { acknowledgedAt = DateTimeOffset.UtcNow.ToString("o"), windowsUser = Environment.UserName };
            File.WriteAllText(AckPath(options), JsonSerializer.Serialize(ack));
        }

        return clickedOk;
    }
}
