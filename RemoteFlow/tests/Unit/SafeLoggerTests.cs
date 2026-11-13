using RemoteFlow.Core.Logging;
using Xunit;

namespace RemoteFlow.Tests.Unit;

public class SafeLoggerTests
{
    [Fact]
    public void RedactsTokenLikeStrings()
    {
        Assert.Equal("[REDACTED]", SafeLogger.Redact("Authorization: Bearer abc"));
        Assert.Equal("hello", SafeLogger.Redact("hello"));
    }
}
