using System.Text.RegularExpressions;

namespace VaayuMonitor.Agent;

public enum ActivityChannel { Email, WhatsApp }
public enum EventConfidence { High, Low }

public record ExtractedEvent(
    string ProcessName,
    string WindowTitle,
    ActivityChannel Channel,
    string? DetectedIdentity,
    bool IsMismatch,
    EventConfidence Confidence);

/// <summary>
/// Classifies a scanned window title: extracts an email address and flags
/// it as a mismatch if it isn't the PC's assigned company email, or
/// recognizes a WhatsApp Web window as a coarse (no-phone-number) signal.
/// </summary>
public static class IdentityExtractor
{
    private static readonly Regex EmailPattern = new(
        @"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}",
        RegexOptions.Compiled);

    public static ExtractedEvent? Classify(ScannedWindow window, string assignedEmail)
    {
        var emailMatch = EmailPattern.Match(window.WindowTitle);
        if (emailMatch.Success)
        {
            var detected = emailMatch.Value;
            var isMismatch = !string.Equals(detected, assignedEmail, StringComparison.OrdinalIgnoreCase);
            return new ExtractedEvent(
                window.ProcessName,
                window.WindowTitle,
                ActivityChannel.Email,
                detected,
                isMismatch,
                EventConfidence.High);
        }

        // No phone number is exposed in WhatsApp Web's window/tab title, so
        // this is deliberately a coarse, non-mismatch observation only —
        // see docs in the project plan for why exact number detection was
        // scoped out of phase 1.
        if (window.WindowTitle.Contains("WhatsApp", StringComparison.OrdinalIgnoreCase))
        {
            return new ExtractedEvent(
                window.ProcessName,
                window.WindowTitle,
                ActivityChannel.WhatsApp,
                "whatsapp_web_open",
                false,
                EventConfidence.Low);
        }

        return null;
    }
}
