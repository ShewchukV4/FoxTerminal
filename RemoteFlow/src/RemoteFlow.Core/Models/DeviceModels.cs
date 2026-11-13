namespace RemoteFlow.Core.Models;

public sealed class PairedDevice
{
    public string DeviceId { get; set; } = string.Empty;
    public string Name { get; set; } = "iPhone";
    public string TokenHash { get; set; } = string.Empty;
    public DateTimeOffset PairedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? LastSeenAt { get; set; }
    public bool IsConnected { get; set; }
}

public sealed class PairingRequest
{
    public string RequestId { get; set; } = Guid.NewGuid().ToString("N");
    public string DeviceName { get; set; } = "iPhone";
    public string PairingCode { get; set; } = string.Empty;
    public string ClientNonce { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset ExpiresAt { get; set; } = DateTimeOffset.UtcNow.AddMinutes(5);
    public PairingStatus Status { get; set; } = PairingStatus.Pending;
    /// <summary>Filled after Approve; kept until phone calls /api/pair/complete.</summary>
    public string? IssuedDeviceId { get; set; }
    /// <summary>Plain token kept in memory only until the phone picks it up.</summary>
    public string? IssuedDeviceToken { get; set; }
}

public enum PairingStatus
{
    Pending,
    Approved,
    Rejected,
    Expired
}

public sealed class PairingResult
{
    public bool Success { get; set; }
    public string? DeviceId { get; set; }
    public string? DeviceToken { get; set; }
    public string? Error { get; set; }
}

public sealed class SessionInfo
{
    public string ConnectionId { get; set; } = string.Empty;
    public string DeviceId { get; set; } = string.Empty;
    public string DeviceName { get; set; } = string.Empty;
    public DateTimeOffset ConnectedAt { get; set; } = DateTimeOffset.UtcNow;
}
