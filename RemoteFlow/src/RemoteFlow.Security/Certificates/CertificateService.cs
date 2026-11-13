using System.Net;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using RemoteFlow.Core.Storage;

namespace RemoteFlow.Security.Certificates;

public static class CertificateService
{
    public static X509Certificate2 GetOrCreate(string? extraDns = null)
    {
        AppPaths.EnsureCreated();
        if (File.Exists(AppPaths.CertFile))
        {
            try
            {
                return X509CertificateLoader.LoadPkcs12FromFile(AppPaths.CertFile, "RemoteFlowLocal");
            }
            catch
            {
                // regenerate below
            }
        }

        return CreateAndSave(extraDns);
    }

    public static X509Certificate2 CreateAndSave(string? extraDns = null)
    {
        AppPaths.EnsureCreated();
        using var rsa = RSA.Create(2048);
        var req = new CertificateRequest(
            "CN=RemoteFlow Local Agent",
            rsa,
            HashAlgorithmName.SHA256,
            RSASignaturePadding.Pkcs1);

        req.CertificateExtensions.Add(new X509BasicConstraintsExtension(false, false, 0, false));
        req.CertificateExtensions.Add(new X509KeyUsageExtension(
            X509KeyUsageFlags.DigitalSignature | X509KeyUsageFlags.KeyEncipherment, true));
        req.CertificateExtensions.Add(new X509EnhancedKeyUsageExtension(
            [new Oid("1.3.6.1.5.5.7.3.1")], true));

        var san = new SubjectAlternativeNameBuilder();
        san.AddDnsName("localhost");
        san.AddIpAddress(IPAddress.Loopback);
        san.AddIpAddress(IPAddress.IPv6Loopback);
        if (!string.IsNullOrWhiteSpace(extraDns))
            san.AddDnsName(extraDns);
        foreach (var ip in NetworkHelper.GetLocalIpv4Addresses())
            san.AddIpAddress(IPAddress.Parse(ip));
        req.CertificateExtensions.Add(san.Build());

        var cert = req.CreateSelfSigned(DateTimeOffset.UtcNow.AddDays(-1), DateTimeOffset.UtcNow.AddYears(5));
        var exportable = cert.Export(X509ContentType.Pfx, "RemoteFlowLocal");
        File.WriteAllBytes(AppPaths.CertFile, exportable);
        return X509CertificateLoader.LoadPkcs12(exportable, "RemoteFlowLocal");
    }
}

public static class NetworkHelper
{
    public static IReadOnlyList<string> GetLocalIpv4Addresses()
    {
        var list = new List<string>();
        try
        {
            foreach (var ni in System.Net.NetworkInformation.NetworkInterface.GetAllNetworkInterfaces())
            {
                if (ni.OperationalStatus != System.Net.NetworkInformation.OperationalStatus.Up) continue;
                if (ni.NetworkInterfaceType is System.Net.NetworkInformation.NetworkInterfaceType.Loopback) continue;
                var props = ni.GetIPProperties();
                foreach (var addr in props.UnicastAddresses)
                {
                    if (addr.Address.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork)
                        list.Add(addr.Address.ToString());
                }
            }
        }
        catch
        {
            // ignore
        }
        return list;
    }

    public static string? GetPreferredLanIp()
    {
        try
        {
            // Prefer addresses from Wi‑Fi / Ethernet, skip virtual adapters when possible.
            var ranked = new List<(int Rank, string Ip)>();
            foreach (var ni in System.Net.NetworkInformation.NetworkInterface.GetAllNetworkInterfaces())
            {
                if (ni.OperationalStatus != System.Net.NetworkInformation.OperationalStatus.Up) continue;
                if (ni.NetworkInterfaceType is System.Net.NetworkInformation.NetworkInterfaceType.Loopback) continue;
                var name = (ni.Name + " " + ni.Description).ToLowerInvariant();
                var rank = 100;
                if (name.Contains("wi-fi") || name.Contains("wifi") || name.Contains("wlan")) rank = 0;
                else if (name.Contains("ethernet") && !name.Contains("vethernet")) rank = 1;
                else if (name.Contains("virtual") || name.Contains("vmware") || name.Contains("virtualbox")
                         || name.Contains("hyper-v") || name.Contains("vethernet") || name.Contains("vpn"))
                    rank = 50;

                foreach (var addr in ni.GetIPProperties().UnicastAddresses)
                {
                    if (addr.Address.AddressFamily != System.Net.Sockets.AddressFamily.InterNetwork) continue;
                    var ip = addr.Address.ToString();
                    if (ip.StartsWith("169.254.", StringComparison.Ordinal)) continue;
                    ranked.Add((rank, ip));
                }
            }

            return ranked
                .OrderBy(x => x.Rank)
                .ThenBy(x => x.Ip.StartsWith("192.168.", StringComparison.Ordinal) ? 0
                    : x.Ip.StartsWith("10.", StringComparison.Ordinal) ? 1 : 2)
                .Select(x => x.Ip)
                .FirstOrDefault();
        }
        catch
        {
            return GetLocalIpv4Addresses()
                .FirstOrDefault(ip => !ip.StartsWith("169.254.", StringComparison.Ordinal));
        }
    }
}
