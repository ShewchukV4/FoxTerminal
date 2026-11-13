using System.Security.Cryptography;
using System.Text;

namespace RemoteFlow.Security.Crypto;

public static class TokenService
{
    public static string CreateSecureToken(int bytes = 32)
    {
        var data = RandomNumberGenerator.GetBytes(bytes);
        return Base64Url(data);
    }

    public static string CreatePairingCode()
    {
        // 6-digit numeric code for QR / manual entry; single-use + short TTL elsewhere.
        var n = RandomNumberGenerator.GetInt32(0, 1_000_000);
        return n.ToString("D6");
    }

    public static string HashToken(string token)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(token));
        return Convert.ToHexString(bytes);
    }

    public static bool FixedTimeEquals(string a, string b)
    {
        var ba = Encoding.UTF8.GetBytes(a);
        var bb = Encoding.UTF8.GetBytes(b);
        return CryptographicOperations.FixedTimeEquals(ba, bb);
    }

    public static bool VerifyToken(string token, string expectedHash) =>
        FixedTimeEquals(HashToken(token), expectedHash);

    private static string Base64Url(byte[] data) =>
        Convert.ToBase64String(data).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
