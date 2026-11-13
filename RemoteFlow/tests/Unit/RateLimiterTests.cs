using RemoteFlow.Security.Auth;
using Xunit;

namespace RemoteFlow.Tests.Unit;

public class RateLimiterTests
{
    [Fact]
    public void AllowsUntilLimitThenBlocks()
    {
        var limiter = new RateLimiter(maxPerWindow: 3, windowSeconds: 60);
        Assert.True(limiter.Allow("a"));
        Assert.True(limiter.Allow("a"));
        Assert.True(limiter.Allow("a"));
        Assert.False(limiter.Allow("a"));
        Assert.True(limiter.Allow("b"));
    }
}
