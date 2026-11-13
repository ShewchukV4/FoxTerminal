using System.Collections.Concurrent;
using RemoteFlow.Capture;
using RemoteFlow.Core.Models;
using RemoteFlow.Input;
using RemoteFlow.Security.Auth;
using RemoteFlow.Security.Certificates;

namespace RemoteFlow.Agent.Services;

public sealed class AgentRuntime : IDisposable
{
    public ConfigStore Config { get; } = new();
    public DeckStore Deck { get; } = new();
    public DeviceStore Devices { get; } = new();
    public RateLimiter CommandLimiter { get; } = new(maxPerWindow: 120, windowSeconds: 60);
    public RateLimiter PairLimiter { get; } = new(maxPerWindow: 10, windowSeconds: 60);
    public MouseService Mouse { get; } = new();
    public KeyboardService Keyboard { get; } = new();
    public MonitorService Monitors { get; } = new();
    public ScreenCaptureService Capture { get; } = new();
    public ActionExecutor Actions { get; }
    public ConcurrentDictionary<string, SessionInfo> Sessions { get; } = new();

    public event Action? StatusChanged;
    public event Action<PairingRequest>? PairingRequested;
    public event Action? DevicesChanged;

    private readonly List<string> _logBuffer = [];
    private readonly object _logGate = new();

    public bool ServerRunning { get; set; }
    public string? LocalIp { get; set; }
    public string? BaseUrl { get; set; }
    /// <summary>Plain HTTP port for easy first open from Safari (no cert warning).</summary>
    public int HttpPort { get; set; }
    public string? HttpBaseUrl { get; set; }
    /// <summary>Bonjour name — preferred connection URL without numeric IP.</summary>
    public string FriendlyHttpUrl { get; private set; } = $"http://{MdnsAdvertiser.FriendlyHost}:8744";
    public MdnsAdvertiser Mdns { get; } = new();
    public bool ScreenSharingActive => Capture.IsActive;
    public int SelectedMonitor { get; set; }

    public AgentRuntime(Microsoft.Extensions.Logging.ILogger<ActionExecutor> actionLogger)
    {
        Actions = new ActionExecutor(actionLogger, Keyboard, () => Config.Current);
        Mouse.UpdateSettings(Config.Current.Touchpad);
        Capture.Configure(Config.Current.Stream);
        Capture.Started += () => StatusChanged?.Invoke();
        Capture.Stopped += () => StatusChanged?.Invoke();
        RefreshNetwork();
    }

    public void RefreshNetwork()
    {
        LocalIp = NetworkHelper.GetPreferredLanIp();
        var cfg = Config.Current;
        if (HttpPort <= 0) HttpPort = Math.Clamp(cfg.Port - 1, 1024, 65534);
        FriendlyHttpUrl = $"http://{MdnsAdvertiser.FriendlyHost}:{HttpPort}";
        // Keep IP URLs as fallback for diagnostics only — UI prefers FriendlyHttpUrl.
        BaseUrl = $"https://{MdnsAdvertiser.FriendlyHost}:{cfg.Port}";
        HttpBaseUrl = FriendlyHttpUrl;
        RaiseStatusChanged();
    }

    public void RaiseStatusChanged() => StatusChanged?.Invoke();

    public ServerStatus GetStatus()
    {
        var cfg = Config.Current;
        return new ServerStatus
        {
            IsRunning = ServerRunning,
            LocalIp = LocalIp,
            Port = cfg.Port,
            BaseUrl = BaseUrl,
            ConnectedDevices = Sessions.Count,
            ScreenSharingActive = ScreenSharingActive,
            RemoteControlEnabled = cfg.AllowRemoteControl,
            ScreenShareEnabled = cfg.AllowScreenShare
        };
    }

    public void NotifyPairing(PairingRequest req)
    {
        AddLog($"Pairing request from {req.DeviceName} (code {req.PairingCode})");
        PairingRequested?.Invoke(req);
        StatusChanged?.Invoke();
    }

    public void NotifyDevicesChanged()
    {
        DevicesChanged?.Invoke();
        StatusChanged?.Invoke();
    }

    public void AddLog(string message)
    {
        var line = $"{DateTime.Now:HH:mm:ss} {message}";
        lock (_logGate)
        {
            _logBuffer.Add(line);
            if (_logBuffer.Count > 500) _logBuffer.RemoveAt(0);
        }
        StatusChanged?.Invoke();
    }

    public IReadOnlyList<string> GetLogs()
    {
        lock (_logGate) return _logBuffer.ToList();
    }

    public void ReleaseAllInput()
    {
        Mouse.ReleaseAll();
        Keyboard.ReleaseAll();
        Actions.CancelMacro();
    }

    public void Dispose()
    {
        ReleaseAllInput();
        Mdns.Dispose();
        Capture.Dispose();
    }
}
