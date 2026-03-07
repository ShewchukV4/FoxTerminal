using System.Text.Json;

namespace FoxTerminal.Config;

public sealed class FoxTerminalConfig
{
    public string FontFamily { get; set; } = "Cascadia Mono";
    public double FontSize { get; set; } = 13;
    public string Foreground { get; set; } = "#E6E6E6";
    public string Background { get; set; } = "#0B0F1A";
    public string SelectionBackground { get; set; } = "#1F2937";
    public double WindowOpacity { get; set; } = 0.92;
    public int Padding { get; set; } = 10;

    public static FoxTerminalConfig Default => new();
}

public static class FoxTerminalConfigLoader
{
    public static string DefaultConfigPath =>
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".foxterminal.json");

    public static FoxTerminalConfig Load(string? path = null)
    {
        var target = path ?? DefaultConfigPath;
        if (!File.Exists(target))
        {
            return FoxTerminalConfig.Default;
        }

        try
        {
            var json = File.ReadAllText(target);
            var config = JsonSerializer.Deserialize<FoxTerminalConfig>(json, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });
            return config ?? FoxTerminalConfig.Default;
        }
        catch
        {
            return FoxTerminalConfig.Default;
        }
    }
}
