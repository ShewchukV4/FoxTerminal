namespace FoxTerminal.Core;

public readonly record struct TerminalCell(char Rune, TerminalStyle Style)
{
    public static TerminalCell Empty => new(' ', TerminalStyle.Default);
}

public readonly record struct TerminalStyle(TerminalColor Foreground, TerminalColor Background, bool Bold)
{
    public static TerminalStyle Default => new(TerminalTheme.DefaultForeground, TerminalTheme.DefaultBackground, false);
}

public readonly record struct TerminalColor(byte R, byte G, byte B, bool IsDefault)
{
    public static TerminalColor DefaultForeground => TerminalTheme.DefaultForeground;

    public static TerminalColor DefaultBackground => TerminalTheme.DefaultBackground;

    public static TerminalColor FromAnsiIndex(int index) => TerminalTheme.FromAnsiIndex(index);
}
