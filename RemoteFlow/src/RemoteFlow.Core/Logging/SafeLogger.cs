using Microsoft.Extensions.Logging;

namespace RemoteFlow.Core.Logging;

/// <summary>
/// Thin helper that redacts secrets from log messages.
/// Passwords, tokens and typed text must never be written to ordinary logs.
/// </summary>
public static class SafeLogger
{
    private static readonly string[] SensitiveKeys =
    [
        "token", "password", "secret", "authorization", "bearer", "pfx", "privatekey"
    ];

    public static string Redact(string? input)
    {
        if (string.IsNullOrEmpty(input)) return string.Empty;
        var lower = input.ToLowerInvariant();
        foreach (var key in SensitiveKeys)
        {
            if (lower.Contains(key, StringComparison.Ordinal))
                return "[REDACTED]";
        }
        return input.Length > 500 ? input[..500] + "…" : input;
    }

    public static void Info(ILogger logger, string message, params object?[] args) =>
        logger.LogInformation(message, args);

    public static void Warn(ILogger logger, string message, params object?[] args) =>
        logger.LogWarning(message, args);

    public static void Error(ILogger logger, Exception? ex, string message, params object?[] args) =>
        logger.LogError(ex, message, args);
}
