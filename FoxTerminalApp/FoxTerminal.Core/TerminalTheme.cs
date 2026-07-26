namespace FoxTerminal.Core;

public static class TerminalTheme
{
    private static byte _fgR = 230;
    private static byte _fgG = 230;
    private static byte _fgB = 230;
    private static byte _bgR = 11;
    private static byte _bgG = 15;
    private static byte _bgB = 26;

    public static bool IsNoir { get; private set; }

    public static void ApplyFoxNight()
    {
        IsNoir = false;
        _fgR = 230;
        _fgG = 230;
        _fgB = 230;
        _bgR = 11;
        _bgG = 15;
        _bgB = 26;
    }

    public static void ApplyNoir()
    {
        IsNoir = true;
        _fgR = 216;
        _fgG = 216;
        _fgB = 216;
        _bgR = 10;
        _bgG = 10;
        _bgB = 10;
    }

    public static TerminalColor DefaultForeground => new(_fgR, _fgG, _fgB, true);

    public static TerminalColor DefaultBackground => new(_bgR, _bgG, _bgB, true);

    public static string BackgroundHex => IsNoir ? "#0A0A0A" : "#0B0F1A";

    public static string ForegroundHex => IsNoir ? "#D8D8D8" : "#E6E6E6";

    public static TerminalColor FromAnsiIndex(int index)
    {
        if (IsNoir)
        {
            return index switch
            {
                0 => new TerminalColor(10, 10, 10, false),
                1 or 9 => new TerminalColor(90, 90, 90, false),
                2 or 10 => new TerminalColor(120, 120, 120, false),
                3 or 11 => new TerminalColor(155, 155, 155, false),
                4 or 12 => new TerminalColor(185, 185, 185, false),
                5 or 13 => new TerminalColor(200, 200, 200, false),
                6 or 14 => new TerminalColor(220, 220, 220, false),
                7 or 15 => new TerminalColor(240, 240, 240, false),
                _ => DefaultForeground
            };
        }

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
