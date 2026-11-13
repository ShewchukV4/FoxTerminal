using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;
using RemoteFlow.Agent.Services;

namespace RemoteFlow.Agent.Auth;

public sealed class DeviceAuthOptions : AuthenticationSchemeOptions
{
    public const string SchemeName = "DeviceToken";
}

public sealed class DeviceAuthHandler : AuthenticationHandler<DeviceAuthOptions>
{
    private readonly AgentRuntime _runtime;

    public DeviceAuthHandler(
        IOptionsMonitor<DeviceAuthOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder,
        AgentRuntime runtime)
        : base(options, logger, encoder)
    {
        _runtime = runtime;
    }

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var deviceId = Request.Headers["X-Device-Id"].FirstOrDefault()
                       ?? Request.Query["deviceId"].FirstOrDefault();
        var token = Request.Headers["X-Device-Token"].FirstOrDefault()
                    ?? Request.Query["deviceToken"].FirstOrDefault();

        // SignalR browsers send auth only as access_token (WebSocket cannot set custom headers).
        if (Request.Query.TryGetValue("access_token", out var at))
        {
            var raw = at.ToString();
            // format: deviceId.token  (deviceId is hex without dots)
            var parts = raw.Split('.', 2);
            if (parts.Length == 2)
            {
                deviceId = parts[0];
                token = parts[1];
            }
        }

        if (string.IsNullOrEmpty(deviceId) || string.IsNullOrEmpty(token))
            return Task.FromResult(AuthenticateResult.NoResult());

        var device = _runtime.Devices.Authenticate(deviceId, token);
        if (device is null)
            return Task.FromResult(AuthenticateResult.Fail("Invalid device credentials"));

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, device.DeviceId),
            new Claim(ClaimTypes.Name, device.Name),
            new Claim("device_id", device.DeviceId)
        };
        var identity = new ClaimsIdentity(claims, DeviceAuthOptions.SchemeName);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, DeviceAuthOptions.SchemeName);
        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}
