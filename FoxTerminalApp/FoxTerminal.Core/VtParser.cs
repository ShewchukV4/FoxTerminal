using System.Text;
using System.Linq;

namespace FoxTerminal.Core;

public sealed class VtParser
{
    private readonly TerminalBuffer _buffer;
    private readonly StringBuilder _escape = new();
    private bool _inEscape;
    private TerminalStyle _style = TerminalStyle.Default;

    public VtParser(TerminalBuffer buffer)
    {
        _buffer = buffer;
    }

    public TerminalStyle CurrentStyle => _style;

    public void Feed(string text)
    {
        foreach (var ch in text)
        {
            if (_inEscape)
            {
                _escape.Append(ch);
                if (IsEscapeTerminator(ch))
                {
                    HandleEscape(_escape.ToString());
                    _escape.Clear();
                    _inEscape = false;
                }
                continue;
            }

            if (ch == '\u001b')
            {
                _inEscape = true;
                _escape.Clear();
                _escape.Append(ch);
                continue;
            }

            _buffer.PutChar(ch, _style);
        }
    }

    private static bool IsEscapeTerminator(char ch)
    {
        return ch is >= 'A' and <= 'Z' or >= 'a' and <= 'z';
    }

    private void HandleEscape(string seq)
    {
        if (!seq.StartsWith("\u001b[", StringComparison.Ordinal))
        {
            return;
        }

        var command = seq[^1];
        var payload = seq[2..^1];
        var parts = payload.Length == 0 ? Array.Empty<int>() : payload.Split(';').Select(ParseInt).ToArray();

        switch (command)
        {
            case 'm':
                ApplySgr(parts);
                break;
            case 'H':
            case 'f':
                var row = parts.Length > 0 ? Math.Max(1, parts[0]) : 1;
                var col = parts.Length > 1 ? Math.Max(1, parts[1]) : 1;
                _buffer.SetCursor(row - 1, col - 1);
                break;
            case 'A':
                _buffer.MoveCursor(-GetOrDefault(parts, 1), 0);
                break;
            case 'B':
                _buffer.MoveCursor(GetOrDefault(parts, 1), 0);
                break;
            case 'C':
                _buffer.MoveCursor(0, GetOrDefault(parts, 1));
                break;
            case 'D':
                _buffer.MoveCursor(0, -GetOrDefault(parts, 1));
                break;
            case 'J':
                _buffer.Clear();
                break;
            case 'K':
                _buffer.ClearLine(_buffer.Cursor.Row);
                break;
        }
    }

    private void ApplySgr(IReadOnlyList<int> codes)
    {
        if (codes.Count == 0)
        {
            _style = TerminalStyle.Default;
            return;
        }

        var fg = _style.Foreground;
        var bg = _style.Background;
        var bold = _style.Bold;

        foreach (var code in codes)
        {
            switch (code)
            {
                case 0:
                    fg = TerminalColor.DefaultForeground;
                    bg = TerminalColor.DefaultBackground;
                    bold = false;
                    break;
                case 1:
                    bold = true;
                    break;
                case 22:
                    bold = false;
                    break;
                case >= 30 and <= 37:
                    fg = TerminalColor.FromAnsiIndex(code - 30);
                    break;
                case >= 90 and <= 97:
                    fg = TerminalColor.FromAnsiIndex(code - 90 + 8);
                    break;
                case 39:
                    fg = TerminalColor.DefaultForeground;
                    break;
                case >= 40 and <= 47:
                    bg = TerminalColor.FromAnsiIndex(code - 40);
                    break;
                case >= 100 and <= 107:
                    bg = TerminalColor.FromAnsiIndex(code - 100 + 8);
                    break;
                case 49:
                    bg = TerminalColor.DefaultBackground;
                    break;
            }
        }

        _style = new TerminalStyle(fg, bg, bold);
    }

    private static int ParseInt(string value)
    {
        return int.TryParse(value, out var result) ? result : 0;
    }

    private static int GetOrDefault(IReadOnlyList<int> values, int defaultValue)
    {
        return values.Count > 0 && values[0] > 0 ? values[0] : defaultValue;
    }
}
