namespace FoxTerminal.Core;

public readonly record struct TerminalCell(char Rune, TerminalStyle Style)
{
    public static TerminalCell Empty => new(' ', TerminalStyle.Default);
}

public readonly record struct TerminalStyle(TerminalColor Foreground, TerminalColor Background, bool Bold)
{
    public static TerminalStyle Default => new(TerminalColor.DefaultForeground, TerminalColor.DefaultBackground, false);
}

public readonly record struct TerminalColor(byte R, byte G, byte B, bool IsDefault)
{
    public static TerminalColor DefaultForeground => new(230, 230, 230, true);
    public static TerminalColor DefaultBackground => new(11, 15, 26, true);

    public static TerminalColor FromAnsiIndex(int index)
    {
        return index switch
        {
            0 => new TerminalColor(11, 15, 26, false),
            1 => new TerminalColor(255, 107, 107, false),
            2 => new TerminalColor(149, 245, 160, false),
            3 => new TerminalColor(251, 211, 141, false),
            4 => new TerminalColor(122, 162, 247, false),
            5 => new TerminalColor(187, 154, 247, false),
            6 => new TerminalColor(125, 207, 255, false),
            7 => new TerminalColor(230, 230, 230, false),
            8 => new TerminalColor(59, 66, 97, false),
            9 => new TerminalColor(255, 122, 147, false),
            10 => new TerminalColor(158, 206, 106, false),
            11 => new TerminalColor(224, 175, 104, false),
            12 => new TerminalColor(122, 162, 247, false),
            13 => new TerminalColor(192, 167, 247, false),
            14 => new TerminalColor(125, 207, 255, false),
            15 => new TerminalColor(242, 242, 242, false),
            _ => DefaultForeground
        };
    }
}
