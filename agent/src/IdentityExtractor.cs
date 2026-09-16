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
    EventConfidence Confidence,
    bool IsForeground);

/// <summary>
/// Classifies a scanned window title: extracts an email address and flags
/// it as a mismatch if it isn't the PC's assigned company email, or
/// recognizes a WhatsApp Web window. The number actually signed in there
/// (if the browser extension has reported one recently) is compared
/// against the PC's assigned number the same way email is; otherwise this
/// falls back to a coarse "WhatsApp Web is open" observation only.
/// </summary>
public static class IdentityExtractor
{
    private static readonly Regex EmailPattern = new(
        @"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}",
        RegexOptions.Compiled);

    public static ExtractedEvent? Classify(ScannedWindow window, string assignedEmail, string? assignedPhone, string? reportedWaNumber)
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
                EventConfidence.High,
                window.IsForeground);
        }

        if (window.WindowTitle.Contains("WhatsApp", StringComparison.OrdinalIgnoreCase))
        {
            // The window/tab title never exposes a phone number — that
            // comes separately from the browser extension (see
            // WhatsAppIdentityServer), which reads it out of WhatsApp
            // Web's own page state. Without it, fall back to the old
            // coarse "WhatsApp Web is open" signal.
            if (!string.IsNullOrEmpty(reportedWaNumber))
            {
                var normalizedAssigned = NormalizePhone(assignedPhone);
                var isMismatch = normalizedAssigned is null ||
                    !string.Equals(reportedWaNumber, normalizedAssigned, StringComparison.Ordinal);
                return new ExtractedEvent(
                    window.ProcessName,
                    window.WindowTitle,
                    ActivityChannel.WhatsApp,
                    reportedWaNumber,
                    isMismatch,
                    EventConfidence.High,
                    window.IsForeground);
            }

            return new ExtractedEvent(
                window.ProcessName,
                window.WindowTitle,
                ActivityChannel.WhatsApp,
                "whatsapp_web_open",
                false,
                EventConfidence.Low,
                window.IsForeground);
        }

        return null;
    }

    private static string? NormalizePhone(string? raw) =>
        string.IsNullOrWhiteSpace(raw) ? null : new string(raw.Where(char.IsDigit).ToArray());
}
