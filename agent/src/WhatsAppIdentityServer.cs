using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Hosting;

namespace VaayuMonitor.Agent;

/// <summary>
/// Tiny local-loopback-only HTTP endpoint the VaayuGuard browser extension
/// posts to. Two routes, both from the extension:
///   • POST /whatsapp-identity — the signed-in WhatsApp Web account's own
///     number (see extension/inject.js).
///   • POST /active-tab — the active browser tab's site (host) + document
///     title, so the agent can label the foreground browser window with the
///     site it's showing (see extension/background.js and ActiveTabStore).
/// Bound to an explicit 127.0.0.1 address (not a wildcard host), which
/// Windows lets any user-mode process listen on without the admin-only URL
/// ACL reservation a wildcard binding would need.
/// </summary>
public class WhatsAppIdentityServer(AgentOptions options, ActiveTabStore activeTabs, ILogger<WhatsAppIdentityServer> logger) : IHostedService
{
    private HttpListener? _listener;
    private CancellationTokenSource? _cts;

    public Task StartAsync(CancellationToken cancellationToken)
    {
        _cts = new CancellationTokenSource();
        _listener = new HttpListener();
        _listener.Prefixes.Add($"http://127.0.0.1:{options.WhatsAppIdentityPort}/");

        try
        {
            _listener.Start();
        }
        catch (Exception ex)
        {
            // Best-effort — port already in use (e.g. a second agent
            // instance mid-restart) shouldn't take down the whole worker.
            logger.LogWarning(ex, "Could not start the WhatsApp identity listener on port {Port}", options.WhatsAppIdentityPort);
            return Task.CompletedTask;
        }

        _ = Task.Run(() => AcceptLoopAsync(_cts.Token));
        return Task.CompletedTask;
    }

    private async Task AcceptLoopAsync(CancellationToken ct)
    {
        while (_listener is { IsListening: true } && !ct.IsCancellationRequested)
        {
            HttpListenerContext ctx;
            try
            {
                ctx = await _listener.GetContextAsync();
            }
            catch
            {
                break; // listener stopped
            }

            _ = HandleAsync(ctx);
        }
    }

    private async Task HandleAsync(HttpListenerContext ctx)
    {
        try
        {
            ctx.Response.Headers.Add("Access-Control-Allow-Origin", "*");

            var path = ctx.Request.Url?.AbsolutePath;

            if (ctx.Request.HttpMethod == "POST" && path == "/whatsapp-identity")
            {
                using var reader = new StreamReader(ctx.Request.InputStream, Encoding.UTF8);
                var body = await reader.ReadToEndAsync();
                var payload = JsonSerializer.Deserialize<WhatsAppReportPayload>(
                    body, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                var number = NormalizeNumber(payload?.Number);
                if (!string.IsNullOrEmpty(number))
                {
                    WhatsAppIdentityStore.Save(options, number);
                }

                ctx.Response.StatusCode = 204;
            }
            else if (ctx.Request.HttpMethod == "POST" && path == "/active-tab")
            {
                using var reader = new StreamReader(ctx.Request.InputStream, Encoding.UTF8);
                var body = await reader.ReadToEndAsync();
                var payload = JsonSerializer.Deserialize<ActiveTabPayload>(
                    body, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                if (!string.IsNullOrWhiteSpace(payload?.Host))
                {
                    activeTabs.Report(payload.Host, payload.Title);
                }

                ctx.Response.StatusCode = 204;
            }
            else if (ctx.Request.HttpMethod == "POST" && path == "/profile-windows")
            {
                using var reader = new StreamReader(ctx.Request.InputStream, Encoding.UTF8);
                var body = await reader.ReadToEndAsync();
                var payload = JsonSerializer.Deserialize<ProfileWindowsPayload>(
                    body, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                if (!string.IsNullOrWhiteSpace(payload?.Email))
                {
                    activeTabs.ReportProfileWindows(payload.Email, payload.Titles);
                }

                ctx.Response.StatusCode = 204;
            }
            else
            {
                ctx.Response.StatusCode = 404;
            }
        }
        catch
        {
            try { ctx.Response.StatusCode = 400; } catch { /* response already gone */ }
        }
        finally
        {
            try { ctx.Response.Close(); } catch { /* best-effort */ }
        }
    }

    /// <summary>Digits only, so "+91 98765 43210" and "919876543210" compare equal.</summary>
    private static string? NormalizeNumber(string? raw) =>
        string.IsNullOrWhiteSpace(raw) ? null : new string(raw.Where(char.IsDigit).ToArray());

    public Task StopAsync(CancellationToken cancellationToken)
    {
        _cts?.Cancel();
        try { _listener?.Stop(); } catch { /* best-effort */ }
        return Task.CompletedTask;
    }

    private record WhatsAppReportPayload(string? Number);
    private record ActiveTabPayload(string? Host, string? Title);
    private record ProfileWindowsPayload(string? Email, List<string>? Titles);
}
