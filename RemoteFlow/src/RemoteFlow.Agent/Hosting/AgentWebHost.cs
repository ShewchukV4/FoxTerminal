using System.Net;
using RemoteFlow.Agent.Api;
using RemoteFlow.Agent.Auth;
using RemoteFlow.Agent.Hubs;
using RemoteFlow.Agent.Services;
using RemoteFlow.Security.Certificates;
// MdnsAdvertiser lives in Services namespace (already imported).

namespace RemoteFlow.Agent.Hosting;

public sealed class AgentWebHost : IAsyncDisposable
{
    private WebApplication? _app;
    private CancellationTokenSource? _cts;

    public async Task StartAsync(AgentRuntime runtime, IServiceProvider? existing = null)
    {
        if (_app is not null) return;

        var cfg = runtime.Config.Current;
        var cert = CertificateService.GetOrCreate();

        var builder = WebApplication.CreateBuilder(new WebApplicationOptions
        {
            ContentRootPath = AppContext.BaseDirectory,
            WebRootPath = Path.Combine(AppContext.BaseDirectory, "wwwroot")
        });

        builder.Logging.ClearProviders();
        builder.Logging.AddConsole();
        builder.Logging.SetMinimumLevel(LogLevel.Information);

        var httpPort = Math.Clamp(cfg.Port - 1, 1024, 65534);
        // Prefer HTTP for first iPhone open (no self-signed warning). HTTPS remains available.
        builder.WebHost.ConfigureKestrel(options =>
        {
            options.Listen(IPAddress.Any, httpPort);
            options.Listen(IPAddress.Any, cfg.Port, listen =>
            {
                listen.UseHttps(cert);
            });
        });

        builder.Services.AddSingleton(runtime);
        builder.Services.AddSingleton(runtime.Devices);
        builder.Services.AddAuthentication(DeviceAuthOptions.SchemeName)
            .AddScheme<DeviceAuthOptions, DeviceAuthHandler>(DeviceAuthOptions.SchemeName, _ => { });
        builder.Services.AddAuthorization();
        builder.Services.AddSignalR(o =>
        {
            o.MaximumReceiveMessageSize = 256 * 1024;
            o.EnableDetailedErrors = true;
        }).AddJsonProtocol(o =>
        {
            o.PayloadSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
            o.PayloadSerializerOptions.PropertyNameCaseInsensitive = true;
        });
        builder.Services.AddHostedService<FrameStreamService>();
        builder.Services.AddCors(o =>
        {
            o.AddDefaultPolicy(p => p
                .AllowAnyHeader()
                .AllowAnyMethod()
                .SetIsOriginAllowed(_ => true)
                .AllowCredentials());
        });

        _app = builder.Build();

        _app.UseCors();
        _app.UseDefaultFiles();
        _app.UseStaticFiles();
        _app.UseAuthentication();
        _app.UseAuthorization();

        PairingApi.Map(_app);

        // iOS Web Clip profile — installs as a home-screen "app" with icon (not a Safari tab).
        _app.MapGet("/install/RemoteFlow.mobileconfig", async (HttpContext ctx) =>
        {
            var path = Path.Combine(_app!.Environment.WebRootPath ?? "", "install", "RemoteFlow.mobileconfig");
            if (!File.Exists(path))
                return Results.NotFound("Profile missing — rebuild Agent wwwroot.");
            ctx.Response.Headers.CacheControl = "no-store";
            return Results.File(path, "application/x-apple-aspen-config", "RemoteFlow.mobileconfig");
        });

        _app.MapGet("/install", () => Results.Redirect("/install/index.html"));

        _app.MapHub<RemoteHub>("/hub").RequireAuthorization();

        _app.MapFallbackToFile("index.html");

        _cts = new CancellationTokenSource();
        runtime.ServerRunning = true;
        runtime.HttpPort = httpPort;
        runtime.RefreshNetwork();
        try
        {
            runtime.Mdns.Start(httpPort);
            runtime.AddLog($"mDNS: {MdnsAdvertiser.FriendlyHost} (port {httpPort})");
        }
        catch (Exception ex)
        {
            runtime.AddLog("mDNS failed: " + ex.Message);
        }
        runtime.AddLog($"Listening as {runtime.FriendlyHttpUrl}");

        _ = _app.RunAsync(_cts.Token);
        await Task.Delay(300);
    }

    public async Task StopAsync(AgentRuntime runtime)
    {
        if (_app is null) return;
        runtime.ReleaseAllInput();
        runtime.Capture.Stop();
        runtime.Mdns.Stop();
        if (_cts is not null) await _cts.CancelAsync();
        try { await _app.StopAsync(); } catch { /* ignore */ }
        await _app.DisposeAsync();
        _app = null;
        runtime.ServerRunning = false;
        runtime.AddLog("Server stopped");
        runtime.RaiseStatusChanged();
    }

    public async ValueTask DisposeAsync()
    {
        if (_app is not null)
        {
            try { await _app.StopAsync(); } catch { /* ignore */ }
            await _app.DisposeAsync();
        }
        _cts?.Dispose();
    }
}
