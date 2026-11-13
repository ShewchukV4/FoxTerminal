using RemoteFlow.Security.Crypto;
using Xunit;

namespace RemoteFlow.Tests.Unit;

public class TokenServiceTests
{
    [Fact]
    public void CreateSecureToken_IsUnique()
    {
        var a = TokenService.CreateSecureToken();
        var b = TokenService.CreateSecureToken();
        Assert.False(string.IsNullOrWhiteSpace(a));
        Assert.NotEqual(a, b);
    }

    [Fact]
    public void HashAndVerify_RoundTrips()
    {
        var token = TokenService.CreateSecureToken();
        var hash = TokenService.HashToken(token);
        Assert.True(TokenService.VerifyToken(token, hash));
        Assert.False(TokenService.VerifyToken("other", hash));
    }

    [Fact]
    public void PairingCode_IsSixDigits()
    {
        var code = TokenService.CreatePairingCode();
        Assert.Equal(6, code.Length);
        Assert.True(code.All(char.IsDigit));
    }
}
