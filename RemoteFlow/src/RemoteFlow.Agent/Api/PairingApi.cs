using System.Net;
using System.Text.Json.Serialization;
using RemoteFlow.Agent.Services;
using RemoteFlow.Core.Models;
using RemoteFlow.Security.Crypto;

namespace RemoteFlow.Agent.Api;

public static class PairingApi
{
    public static void Map(WebApplication app)
    {
        app.MapGet("/api/status", (AgentRuntime runtime) => Results.Json(new
        {
            name = "RemoteFlow",
            running = runtime.ServerRunning,
            requirePairing = runtime.Config.Current.RequirePairingApproval,
            remoteControl = runtime.Config.Current.AllowRemoteControl,
            screenShare = runtime.Config.Current.AllowScreenShare
        }));

        app.MapPost("/api/pair/request", (AgentRuntime runtime, PairRequestBody body, HttpContext ctx) =>
        {
            var ip = ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown";
            if (!runtime.PairLimiter.Allow(ip))
                return Results.Json(new { error = "Too many pairing attempts" }, statusCode: 429);

            if (!IsPrivateOrLoopback(ctx.Connection.RemoteIpAddress) && runtime.Config.Current.BindLocalNetworkOnly)
                return Results.Json(new { error = "Only local network pairing is allowed" }, statusCode: 403);

            var nonce = string.IsNullOrWhiteSpace(body.ClientNonce)
                ? TokenService.CreateSecureToken(16)
                : body.ClientNonce;
            var req = runtime.Devices.CreatePairingRequest(body.DeviceName ?? "iPhone", nonce);

            if (!runtime.Config.Current.RequirePairingApproval)
            {
                ApproveAndCache(runtime, req.RequestId);
                runtime.AddLog($"Auto-approved pairing for {req.DeviceName}");
            }
            else if (req.Status == PairingStatus.Pending)
            {
                runtime.NotifyPairing(req);
            }

            return Results.Json(new
            {
                requestId = req.RequestId,
                pairingCode = req.PairingCode,
                expiresAt = req.ExpiresAt,
                status = req.Status.ToString().ToLowerInvariant(),
                message = runtime.Config.Current.RequirePairingApproval
                    ? "Confirm this request on the Windows Agent"
                    : "Auto-approved"
            });
        });

        app.MapGet("/api/pair/status/{requestId}", (AgentRuntime runtime, string requestId) =>
        {
            var req = runtime.Devices.GetPending(requestId);
            if (req is null)
                return Results.Json(new { status = "unknown" });
            return Results.Json(new
            {
                status = req.Status.ToString().ToLowerInvariant(),
                expiresAt = req.ExpiresAt
            });
        });

        app.MapPost("/api/pair/complete", (AgentRuntime runtime, PairCompleteBody body) =>
        {
            // Primary path: credentials stay on the request until the phone picks them up.
            var taken = runtime.Devices.TryTakeApproved(body.RequestId);
            // Fallback: phone requestId drifted — take the only approved request on LAN.
            taken ??= runtime.Devices.TryTakeAnyApproved();
            if (taken is { Success: true })
            {
                runtime.AddLog($"Phone picked up pairing ({taken.DeviceId?[..8]}…)");
                return Results.Json(new
                {
                    status = "approved",
                    deviceId = taken.DeviceId,
                    deviceToken = taken.DeviceToken
                });
            }

            var req = runtime.Devices.GetPending(body.RequestId);
            if (req is null)
                return Results.Json(new { status = "unknown" });

            // Approved but token already taken — tell client to restart pairing.
            if (req.Status == PairingStatus.Approved)
                return Results.Json(new { status = "approved_consumed" });

            return Results.Json(new { status = req.Status.ToString().ToLowerInvariant() });
        });

        // Loopback-only helper so we can verify Approve → complete without clicking the UI.
        app.MapPost("/api/pair/approve", (AgentRuntime runtime, PairCompleteBody body, HttpContext ctx) =>
        {
            var ip = ctx.Connection.RemoteIpAddress;
            if (ip is not null && ip.IsIPv4MappedToIPv6) ip = ip.MapToIPv4();
            if (ip is null || !IPAddress.IsLoopback(ip))
                return Results.Json(new { error = "loopback only" }, statusCode: 403);

            var id = string.IsNullOrWhiteSpace(body.RequestId)
                ? runtime.Devices.GetPendingRequests().FirstOrDefault()?.RequestId
                : body.RequestId;
            if (string.IsNullOrEmpty(id))
                return Results.Json(new { error = "no pending" }, statusCode: 404);

            var result = ApproveAndCache(runtime, id);
            return Results.Json(new
            {
                success = result.Success,
                deviceId = result.DeviceId,
                error = result.Error
            }, statusCode: result.Success ? 200 : 400);
        });

        app.MapGet("/api/config/public", (AgentRuntime runtime) => Results.Json(new
        {
            touchpad = runtime.Config.Current.Touchpad,
            stream = new
            {
                runtime.Config.Current.Stream.TargetFps,
                runtime.Config.Current.Stream.MaxFps,
                runtime.Config.Current.Stream.MaxWidth
            }
        }));
    }

    public static PairingResult ApproveAndCache(AgentRuntime runtime, string requestId)
    {
        var result = runtime.Devices.Approve(requestId);
        if (result.Success)
            runtime.AddLog($"Pairing approved → waiting for phone pickup ({result.DeviceId?[..8]}…)");
        runtime.NotifyDevicesChanged();
        return result;
    }

    private static bool IsPrivateOrLoopback(System.Net.IPAddress? ip)
    {
        if (ip is null) return false;
        if (System.Net.IPAddress.IsLoopback(ip)) return true;
        if (ip.IsIPv4MappedToIPv6) ip = ip.MapToIPv4();
        if (ip.AddressFamily != System.Net.Sockets.AddressFamily.InterNetwork) return false;
        var b = ip.GetAddressBytes();
        return b[0] == 10
               || (b[0] == 172 && b[1] >= 16 && b[1] <= 31)
               || (b[0] == 192 && b[1] == 168)
               || (b[0] == 169 && b[1] == 254);
    }

    public sealed class PairRequestBody
    {
        [JsonPropertyName("deviceName")] public string? DeviceName { get; set; }
        [JsonPropertyName("clientNonce")] public string? ClientNonce { get; set; }
    }

    public sealed class PairCompleteBody
    {
        [JsonPropertyName("requestId")] public string RequestId { get; set; } = "";
    }
}
