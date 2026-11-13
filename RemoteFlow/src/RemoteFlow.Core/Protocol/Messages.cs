using RemoteFlow.Core.Models;

namespace RemoteFlow.Core.Protocol;

public static class HubMethods
{
    public const string ExecuteAction = "ExecuteAction";
    public const string MouseMove = "MouseMove";
    public const string MouseButton = "MouseButton";
    public const string MouseScroll = "MouseScroll";
    public const string MouseAbsolute = "MouseAbsolute";
    public const string Keyboard = "Keyboard";
    public const string ReleaseAllInput = "ReleaseAllInput";
    public const string GetDeck = "GetDeck";
    public const string SaveDeck = "SaveDeck";
    public const string GetStatus = "GetStatus";
    public const string GetMonitors = "GetMonitors";
    public const string StartScreenShare = "StartScreenShare";
    public const string StopScreenShare = "StopScreenShare";
    public const string SelectMonitor = "SelectMonitor";
    public const string WebRtcOffer = "WebRtcOffer";
    public const string WebRtcAnswer = "WebRtcAnswer";
    public const string WebRtcIce = "WebRtcIce";
    public const string CancelMacro = "CancelMacro";
}

public sealed class CommandResult
{
    public bool Ok { get; set; }
    public string? Error { get; set; }
    public string? Detail { get; set; }

    public static CommandResult Success(string? detail = null) => new() { Ok = true, Detail = detail };
    public static CommandResult Fail(string error) => new() { Ok = false, Error = error };
}

public sealed class ExecuteActionRequest
{
    public string ActionId { get; set; } = string.Empty;
    public string? ProfileId { get; set; }
}

public sealed class WebRtcSignal
{
    public string Type { get; set; } = string.Empty; // offer|answer|ice
    public string Sdp { get; set; } = string.Empty;
    public string? Candidate { get; set; }
    public string? SdpMid { get; set; }
    public int? SdpMLineIndex { get; set; }
}

public sealed class FramePacket
{
    public int MonitorIndex { get; set; }
    public int Width { get; set; }
    public int Height { get; set; }
    public long TimestampMs { get; set; }
    public string Mime { get; set; } = "image/jpeg";
    public string Base64 { get; set; } = string.Empty;
}
