using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using Makaretu.Dns;

namespace RemoteFlow.Agent.Services;

/// <summary>
/// Advertises RemoteFlow on the LAN as http://remoteflow.local so the phone
/// never needs to type a numeric IP. (Bluetooth cannot host a full PWA control
/// channel from Safari — mDNS/Bonjour is the practical zero-IP UX on iOS.)
/// </summary>
public sealed class MdnsAdvertiser : IDisposable
{
    public const string HostLabel = "remoteflow";
    public const string FriendlyHost = "remoteflow.local";

    private MulticastService? _mdns;
    private ServiceDiscovery? _discovery;
    private bool _started;

    public void Start(int httpPort)
    {
        Stop();
        try
        {
            _mdns = new MulticastService();
            _discovery = new ServiceDiscovery(_mdns);

            var ips = GetAdvertisableIpv4().ToArray();
            if (ips.Length == 0)
                ips = [IPAddress.Loopback];

            var profile = new ServiceProfile(
                "RemoteFlow",
                "_http._tcp",
                (ushort)Math.Clamp(httpPort, 1, 65535),
                ips);

            // Stable hostname so Safari opens http://remoteflow.local:port/
            profile.HostName = $"{HostLabel}.local";
            profile.AddProperty("path", "/");
            profile.AddProperty("app", "RemoteFlow");

            _discovery.Advertise(profile);
            _mdns.Start();
            _started = true;
        }
        catch
        {
            Stop();
            throw;
        }
    }

    public void Stop()
    {
        if (!_started && _mdns is null) return;
        try { _discovery?.Unadvertise(); } catch { /* ignore */ }
        try { _discovery?.Dispose(); } catch { /* ignore */ }
        try { _mdns?.Stop(); } catch { /* ignore */ }
        try { _mdns?.Dispose(); } catch { /* ignore */ }
        _discovery = null;
        _mdns = null;
        _started = false;
    }

    public void Dispose() => Stop();

    private static IEnumerable<IPAddress> GetAdvertisableIpv4()
    {
        foreach (var ni in NetworkInterface.GetAllNetworkInterfaces())
        {
            if (ni.OperationalStatus != OperationalStatus.Up) continue;
            if (ni.NetworkInterfaceType is NetworkInterfaceType.Loopback) continue;
            var name = (ni.Name + " " + ni.Description).ToLowerInvariant();
            // Skip pure virtual box host-only if possible, but keep Mobile Hotspot SoftAP.
            if (name.Contains("virtualbox") && name.Contains("host-only")) continue;

            foreach (var ua in ni.GetIPProperties().UnicastAddresses)
            {
                if (ua.Address.AddressFamily != AddressFamily.InterNetwork) continue;
                if (IPAddress.IsLoopback(ua.Address)) continue;
                var s = ua.Address.ToString();
                if (s.StartsWith("169.254.", StringComparison.Ordinal)) continue;
                yield return ua.Address;
            }
        }
    }
}
