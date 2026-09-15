using System.Net.Http.Json;
using System.Text.Json.Serialization;

namespace VaayuMonitor.Agent;

public record EnrollResult(string DeviceId, string DeviceToken, string AssignedEmail);
public record CheckinResult(bool Ok, int Accepted, string AssignedEmail, string Status);

/// <summary>Talks to the dashboard's /api/agent/* route handlers over HTTPS.</summary>
public class BackendClient(HttpClient http, ILogger<BackendClient> logger)
{
    public async Task<EnrollResult?> EnrollAsync(string enrollmentToken, string hostname, CancellationToken ct)
    {
        try
        {
            var res = await http.PostAsJsonAsync(
                "/api/agent/enroll",
                new { token = enrollmentToken, hostname },
                ct);

            if (!res.IsSuccessStatusCode)
            {
                logger.LogWarning("Enrollment failed: {Status}", res.StatusCode);
                return null;
            }

            var body = await res.Content.ReadFromJsonAsync<EnrollResponseDto>(cancellationToken: ct);
            return body is null
                ? null
                : new EnrollResult(body.DeviceId, body.DeviceToken, body.AssignedEmail);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Enrollment request failed");
            return null;
        }
    }

    public async Task<CheckinResult?> CheckinAsync(string deviceToken, IReadOnlyList<QueuedEvent> events, CancellationToken ct)
    {
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, "/api/agent/checkin");
            request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", deviceToken);
            request.Content = JsonContent.Create(new
            {
                events = events.Select(e => new
                {
                    capturedAt = e.CapturedAt.ToString("o"),
                    processName = e.ProcessName,
                    windowTitle = e.WindowTitle,
                    channel = e.Channel == ActivityChannel.Email ? "email" : "whatsapp",
                    detectedIdentity = e.DetectedIdentity,
                    isMismatch = e.IsMismatch,
                    confidence = e.Confidence == EventConfidence.High ? "high" : "low",
                }),
            });

            var res = await http.SendAsync(request, ct);
            if (!res.IsSuccessStatusCode)
            {
                logger.LogWarning("Check-in failed: {Status}", res.StatusCode);
                return null;
            }

            var body = await res.Content.ReadFromJsonAsync<CheckinResponseDto>(cancellationToken: ct);
            return body is null
                ? null
                : new CheckinResult(body.Ok, body.Accepted, body.AssignedEmail, body.Status);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Check-in request failed");
            return null;
        }
    }

    public async Task<bool> ConsentAsync(string deviceToken, CancellationToken ct)
    {
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, "/api/agent/consent");
            request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", deviceToken);
            var res = await http.SendAsync(request, ct);
            return res.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Consent report failed");
            return false;
        }
    }

    private record EnrollResponseDto(
        [property: JsonPropertyName("deviceId")] string DeviceId,
        [property: JsonPropertyName("deviceToken")] string DeviceToken,
        [property: JsonPropertyName("assignedEmail")] string AssignedEmail);

    private record CheckinResponseDto(
        [property: JsonPropertyName("ok")] bool Ok,
        [property: JsonPropertyName("accepted")] int Accepted,
        [property: JsonPropertyName("assignedEmail")] string AssignedEmail,
        [property: JsonPropertyName("status")] string Status);
}
