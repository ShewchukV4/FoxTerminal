using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using RemoteFlow.Agent.Services;
using RemoteFlow.Core.Models;
using RemoteFlow.Core.Protocol;

namespace RemoteFlow.Agent.Hubs;

[Authorize]
public sealed class RemoteHub : Hub
{
    private readonly AgentRuntime _runtime;
    private readonly ILogger<RemoteHub> _logger;

    public RemoteHub(AgentRuntime runtime, ILogger<RemoteHub> logger)
    {
        _runtime = runtime;
        _logger = logger;
    }

    public override async Task OnConnectedAsync()
    {
        var deviceId = DeviceId();
        var name = Context.User?.Identity?.Name ?? "Device";
        _runtime.Sessions[Context.ConnectionId] = new SessionInfo
        {
            ConnectionId = Context.ConnectionId,
            DeviceId = deviceId,
            DeviceName = name
        };
        _runtime.Devices.SetConnected(deviceId, true);
        _runtime.AddLog($"Device connected: {name}");
        _runtime.NotifyDevicesChanged();
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        _runtime.ReleaseAllInput();
        if (_runtime.Sessions.TryRemove(Context.ConnectionId, out var session))
        {
            var stillConnected = _runtime.Sessions.Values.Any(s => s.DeviceId == session.DeviceId);
            if (!stillConnected)
                _runtime.Devices.SetConnected(session.DeviceId, false);
            _runtime.AddLog($"Device disconnected: {session.DeviceName}");
            _runtime.NotifyDevicesChanged();
        }

        if (_runtime.Sessions.IsEmpty && _runtime.Capture.IsActive)
        {
            _runtime.Capture.Stop();
            _runtime.AddLog("Screen share stopped (no clients)");
        }

        await base.OnDisconnectedAsync(exception);
    }

    public Task<ServerStatus> GetStatus() => Task.FromResult(_runtime.GetStatus());

    public Task<DeckState> GetDeck() => Task.FromResult(_runtime.Deck.Current);

    public Task<CommandResult> SaveDeck(DeckState state)
    {
        if (!_runtime.Config.Current.AllowRemoteControl)
            return Task.FromResult(CommandResult.Fail("Remote control disabled"));
        _runtime.Deck.Save(state);
        _runtime.AddLog("Deck saved from device");
        return Task.FromResult(CommandResult.Success());
    }

    public Task<IReadOnlyList<MonitorInfo>> GetMonitors() =>
        Task.FromResult(_runtime.Monitors.GetMonitors());

    public async Task<CommandResult> ExecuteAction(ExecuteActionRequest req)
    {
        if (!EnsureRemoteControl(out var err)) return err!;
        if (!RateLimit()) return CommandResult.Fail("Rate limit exceeded");

        var action = _runtime.Deck.FindAction(req.ActionId, req.ProfileId);
        if (action is null) return CommandResult.Fail("Unknown action");

        _runtime.AddLog($"Action: {action.Name} ({action.Kind})");
        return await _runtime.Actions.ExecuteAsync(action);
    }

    public Task<CommandResult> CancelMacro()
    {
        _runtime.Actions.CancelMacro();
        return Task.FromResult(CommandResult.Success());
    }

    public Task<CommandResult> MouseMove(MouseMoveEvent ev)
    {
        if (!EnsureRemoteControl(out var err)) return Task.FromResult(err!);
        if (!RateLimit(burst: true)) return Task.FromResult(CommandResult.Fail("Rate limit exceeded"));
        _runtime.Mouse.MoveRelative(ev.Dx, ev.Dy);
        return Task.FromResult(CommandResult.Success());
    }

    public Task<CommandResult> MouseButton(MouseButtonEvent ev)
    {
        if (!EnsureRemoteControl(out var err)) return Task.FromResult(err!);
        _runtime.Mouse.Button(ev.Button, ev.Action);
        return Task.FromResult(CommandResult.Success());
    }

    public Task<CommandResult> MouseScroll(MouseScrollEvent ev)
    {
        if (!EnsureRemoteControl(out var err)) return Task.FromResult(err!);
        _runtime.Mouse.Scroll(ev.Dx, ev.Dy);
        return Task.FromResult(CommandResult.Success());
    }

    public Task<CommandResult> MouseAbsolute(MouseAbsoluteEvent ev)
    {
        if (!EnsureRemoteControl(out var err)) return Task.FromResult(err!);
        var monitor = _runtime.Monitors.GetMonitor(ev.MonitorIndex);
        if (monitor is null) return Task.FromResult(CommandResult.Fail("Monitor not found"));
        _runtime.Mouse.MoveAbsoluteNormalized(monitor, ev.X, ev.Y);
        return Task.FromResult(CommandResult.Success());
    }

    public Task<CommandResult> Keyboard(KeyboardEvent ev)
    {
        if (!EnsureRemoteControl(out var err)) return Task.FromResult(err!);
        // Never log typed text
        _runtime.Keyboard.Handle(ev);
        return Task.FromResult(CommandResult.Success());
    }

    public Task<CommandResult> ReleaseAllInput()
    {
        _runtime.ReleaseAllInput();
        return Task.FromResult(CommandResult.Success());
    }

    public async Task<CommandResult> StartScreenShare(int monitorIndex = 0)
    {
        if (!_runtime.Config.Current.AllowScreenShare)
            return CommandResult.Fail("Screen share disabled on agent");
        if (!RateLimit()) return CommandResult.Fail("Rate limit exceeded");

        _runtime.SelectedMonitor = monitorIndex;
        _runtime.Capture.Start(monitorIndex);
        await Groups.AddToGroupAsync(Context.ConnectionId, "screen");
        _runtime.AddLog($"Screen share started (monitor {monitorIndex}) by {Context.User?.Identity?.Name}");
        _runtime.RaiseStatusChanged();
        return CommandResult.Success();
    }

    public async Task<CommandResult> StopScreenShare()
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, "screen");
        if (_runtime.Sessions.Count <= 1)
            _runtime.Capture.Stop();
        _runtime.AddLog("Screen share stop requested");
        _runtime.RaiseStatusChanged();
        return CommandResult.Success();
    }

    public Task<CommandResult> SelectMonitor(int monitorIndex)
    {
        if (!_runtime.Capture.IsActive)
            return Task.FromResult(CommandResult.Fail("Screen share not active"));
        _runtime.SelectedMonitor = monitorIndex;
        _runtime.Capture.MonitorIndex = monitorIndex;
        return Task.FromResult(CommandResult.Success());
    }

    private string DeviceId() =>
        Context.User?.FindFirstValue("device_id")
        ?? Context.User?.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? "";

    private bool EnsureRemoteControl(out CommandResult? error)
    {
        if (!_runtime.Config.Current.AllowRemoteControl)
        {
            error = CommandResult.Fail("Remote control disabled");
            return false;
        }
        error = null;
        return true;
    }

    private bool RateLimit(bool burst = false)
    {
        var key = DeviceId();
        if (burst)
        {
            // mouse move uses a higher allowance via separate key
            return _runtime.CommandLimiter.Allow("move:" + key) || _runtime.CommandLimiter.Allow(key);
        }
        return _runtime.CommandLimiter.Allow(key);
    }
}
