namespace RemoteFlow.Core.Models;

public sealed class AgentConfig
{
    public int Port { get; set; } = 8745;
    public bool BindLocalNetworkOnly { get; set; } = true;
    public bool Autostart { get; set; }
    public bool AllowRemoteControl { get; set; } = true;
    public bool AllowScreenShare { get; set; }
    public bool RequirePairingApproval { get; set; } = true;
    public string Language { get; set; } = "uk";
    public string LogLevel { get; set; } = "Information";
    public StreamQualitySettings Stream { get; set; } = new();
    public TouchpadSettings Touchpad { get; set; } = new();
    public List<AllowedApp> AllowedApps { get; set; } = [];
    public List<AllowedUrl> AllowedUrls { get; set; } = [];
    public List<AllowedFolder> AllowedFolders { get; set; } = [];
}

public sealed class StreamQualitySettings
{
    public int TargetFps { get; set; } = 30;
    public int MaxFps { get; set; } = 60;
    public int MaxWidth { get; set; } = 1920;
    public int JpegQuality { get; set; } = 70;
    public bool AdaptiveQuality { get; set; } = true;
}

public sealed class AllowedApp
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Name { get; set; } = string.Empty;
    public string PathOrShell { get; set; } = string.Empty;
    public string? Arguments { get; set; }
}

public sealed class AllowedUrl
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Name { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
}

public sealed class AllowedFolder
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Name { get; set; } = string.Empty;
    public string Path { get; set; } = string.Empty;
}

public sealed class MonitorInfo
{
    public int Index { get; set; }
    public string Name { get; set; } = string.Empty;
    public int X { get; set; }
    public int Y { get; set; }
    public int Width { get; set; }
    public int Height { get; set; }
    public bool IsPrimary { get; set; }
}

public sealed class ServerStatus
{
    public bool IsRunning { get; set; }
    public string? LocalIp { get; set; }
    public int Port { get; set; }
    public string? BaseUrl { get; set; }
    public int ConnectedDevices { get; set; }
    public bool ScreenSharingActive { get; set; }
    public bool RemoteControlEnabled { get; set; }
    public bool ScreenShareEnabled { get; set; }
}
