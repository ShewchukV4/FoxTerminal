using System.Collections.Concurrent;
using System.Text.Json;
using RemoteFlow.Core.Models;
using RemoteFlow.Core.Storage;
using RemoteFlow.Security.Crypto;

namespace RemoteFlow.Security.Auth;

public sealed class DeviceStore
{
    private static readonly JsonSerializerOptions JsonOpts = new() { WriteIndented = true };
    private readonly object _gate = new();
    private List<PairedDevice> _devices = [];
    private readonly ConcurrentDictionary<string, PairingRequest> _pending = new();

    public DeviceStore()
    {
        Load();
    }

    public IReadOnlyList<PairedDevice> GetDevices()
    {
        lock (_gate) return _devices.Select(Clone).ToList();
    }

    public PairingRequest CreatePairingRequest(string deviceName, string clientNonce)
    {
        ExpireOld();

        // Reuse active request so the phone keeps the same code / requestId.
        var active = _pending.Values.FirstOrDefault(p =>
            (p.Status is PairingStatus.Pending or PairingStatus.Approved) &&
            p.ExpiresAt > DateTimeOffset.UtcNow);
        if (active is not null)
            return active;

        var req = new PairingRequest
        {
            DeviceName = string.IsNullOrWhiteSpace(deviceName) ? "iPhone" : deviceName.Trim(),
            PairingCode = TokenService.CreatePairingCode(),
            ClientNonce = clientNonce
        };
        _pending[req.RequestId] = req;
        return req;
    }

    public PairingRequest? GetPending(string requestId) =>
        _pending.TryGetValue(requestId, out var r) ? r : null;

    public IReadOnlyList<PairingRequest> GetPendingRequests()
    {
        ExpireOld();
        return _pending.Values.Where(p => p.Status == PairingStatus.Pending).ToList();
    }

    public PairingResult Approve(string requestId)
    {
        ExpireOld();

        _pending.TryGetValue(requestId ?? "", out var req);

        // Already approved, waiting for phone pickup — idempotent success.
        if (req is { Status: PairingStatus.Approved } &&
            !string.IsNullOrEmpty(req.IssuedDeviceId) &&
            !string.IsNullOrEmpty(req.IssuedDeviceToken))
        {
            return new PairingResult
            {
                Success = true,
                DeviceId = req.IssuedDeviceId,
                DeviceToken = req.IssuedDeviceToken
            };
        }

        if (req is null || req.Status != PairingStatus.Pending)
        {
            req = _pending.Values.FirstOrDefault(p => p.Status == PairingStatus.Pending)
                  ?? _pending.Values.FirstOrDefault(p =>
                      p.Status == PairingStatus.Approved &&
                      !string.IsNullOrEmpty(p.IssuedDeviceToken));
            if (req is null)
                return new PairingResult
                {
                    Success = false,
                    Error = "Немає активного запиту. На телефоні натисніть «Підключити» ще раз."
                };
            if (req.Status == PairingStatus.Approved)
            {
                return new PairingResult
                {
                    Success = true,
                    DeviceId = req.IssuedDeviceId,
                    DeviceToken = req.IssuedDeviceToken
                };
            }
            requestId = req.RequestId;
        }

        if (req.ExpiresAt < DateTimeOffset.UtcNow)
        {
            req.Status = PairingStatus.Expired;
            return new PairingResult { Success = false, Error = "Код застарів" };
        }

        var deviceId = Guid.NewGuid().ToString("N");
        var token = TokenService.CreateSecureToken();
        var device = new PairedDevice
        {
            DeviceId = deviceId,
            Name = req.DeviceName,
            TokenHash = TokenService.HashToken(token),
            PairedAt = DateTimeOffset.UtcNow
        };

        lock (_gate)
        {
            _devices.Add(device);
            Save();
        }

        // Keep in map until phone polls /complete — do NOT remove here.
        req.Status = PairingStatus.Approved;
        req.IssuedDeviceId = deviceId;
        req.IssuedDeviceToken = token;
        req.ExpiresAt = DateTimeOffset.UtcNow.AddMinutes(5);

        return new PairingResult
        {
            Success = true,
            DeviceId = deviceId,
            DeviceToken = token
        };
    }

    /// <summary>Phone picks up credentials after Approve.</summary>
    public PairingResult? TryTakeApproved(string requestId)
    {
        if (string.IsNullOrWhiteSpace(requestId))
            return null;
        if (!_pending.TryGetValue(requestId, out var req))
            return null;
        return TakeApproved(req);
    }

    /// <summary>If the phone lost requestId, allow pickup of the single approved request.</summary>
    public PairingResult? TryTakeAnyApproved()
    {
        var req = _pending.Values.FirstOrDefault(p =>
            p.Status == PairingStatus.Approved &&
            !string.IsNullOrEmpty(p.IssuedDeviceId) &&
            !string.IsNullOrEmpty(p.IssuedDeviceToken));
        return req is null ? null : TakeApproved(req);
    }

    private PairingResult? TakeApproved(PairingRequest req)
    {
        if (req.Status != PairingStatus.Approved ||
            string.IsNullOrEmpty(req.IssuedDeviceId) ||
            string.IsNullOrEmpty(req.IssuedDeviceToken))
            return null;

        var result = new PairingResult
        {
            Success = true,
            DeviceId = req.IssuedDeviceId,
            DeviceToken = req.IssuedDeviceToken
        };

        req.IssuedDeviceToken = null;
        _pending.TryRemove(req.RequestId, out _);
        return result;
    }

    public bool Reject(string requestId)
    {
        if (!_pending.TryGetValue(requestId, out var req)) return false;
        req.Status = PairingStatus.Rejected;
        req.IssuedDeviceToken = null;
        _pending.TryRemove(requestId, out _);
        return true;
    }

    public PairedDevice? Authenticate(string deviceId, string token)
    {
        lock (_gate)
        {
            var device = _devices.FirstOrDefault(d => d.DeviceId == deviceId);
            if (device is null) return null;
            if (!TokenService.VerifyToken(token, device.TokenHash)) return null;
            device.LastSeenAt = DateTimeOffset.UtcNow;
            Save();
            return Clone(device);
        }
    }

    public bool Remove(string deviceId)
    {
        lock (_gate)
        {
            var removed = _devices.RemoveAll(d => d.DeviceId == deviceId) > 0;
            if (removed) Save();
            return removed;
        }
    }

    public void SetConnected(string deviceId, bool connected)
    {
        lock (_gate)
        {
            var d = _devices.FirstOrDefault(x => x.DeviceId == deviceId);
            if (d is null) return;
            d.IsConnected = connected;
            if (connected) d.LastSeenAt = DateTimeOffset.UtcNow;
            Save();
        }
    }

    private void ExpireOld()
    {
        foreach (var kv in _pending)
        {
            if (kv.Value.ExpiresAt < DateTimeOffset.UtcNow &&
                kv.Value.Status is PairingStatus.Pending or PairingStatus.Approved)
                kv.Value.Status = PairingStatus.Expired;
        }
        foreach (var expired in _pending
                     .Where(p => p.Value.Status is PairingStatus.Expired or PairingStatus.Rejected)
                     .ToList())
        {
            expired.Value.IssuedDeviceToken = null;
            _pending.TryRemove(expired.Key, out _);
        }
    }

    private void Load()
    {
        AppPaths.EnsureCreated();
        if (!File.Exists(AppPaths.DevicesFile)) return;
        try
        {
            var json = File.ReadAllText(AppPaths.DevicesFile);
            _devices = JsonSerializer.Deserialize<List<PairedDevice>>(json) ?? [];
            foreach (var d in _devices) d.IsConnected = false;
        }
        catch
        {
            _devices = [];
        }
    }

    private void Save()
    {
        AppPaths.EnsureCreated();
        var json = JsonSerializer.Serialize(_devices, JsonOpts);
        File.WriteAllText(AppPaths.DevicesFile, json);
    }

    private static PairedDevice Clone(PairedDevice d) => new()
    {
        DeviceId = d.DeviceId,
        Name = d.Name,
        TokenHash = d.TokenHash,
        PairedAt = d.PairedAt,
        LastSeenAt = d.LastSeenAt,
        IsConnected = d.IsConnected
    };
}
