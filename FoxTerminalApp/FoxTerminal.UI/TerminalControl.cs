using Avalonia;
using Avalonia.Controls;
using Avalonia.Input;
using Avalonia.Media;
using Avalonia.Threading;
using FoxTerminal.Core;
using FoxTerminal.Config;
using System;
using System.Threading;
using System.Globalization;

namespace FoxTerminal.UI;

public sealed class TerminalControl : Control
{
    private TerminalSession? _session;
    private Typeface _typeface = new("Cascadia Mono");
    private double _fontSize = 13;
    private Color _backgroundColor = Color.FromRgb(11, 15, 26);
    private Size _cellSize = new(8, 16);
    private CancellationTokenSource _cts = new();
    private string _inputBuffer = string.Empty;

    public TerminalSession? Session
    {
        get => _session;
        set
        {
            if (_session != null)
            {
                _session.Updated -= OnSessionUpdated;
            }

            _session = value;
            if (_session != null)
            {
                _session.Updated += OnSessionUpdated;
            }
        }
    }

    public TerminalControl()
    {
        Focusable = true;
        this.AttachedToVisualTree += OnAttached;
        this.DetachedFromVisualTree += OnDetached;
        this.AddHandler(PointerPressedEvent, OnPointerPressed, handledEventsToo: true);
        this.AddHandler(TextInputEvent, OnTextInput, handledEventsToo: true);
        this.AddHandler(KeyDownEvent, OnKeyDown, handledEventsToo: true);
    }

    public void ApplyConfig(FoxTerminalConfig config)
    {
        _typeface = new Typeface(config.FontFamily);
        _fontSize = config.FontSize;
        _backgroundColor = ParseHex(config.Background, _backgroundColor);
        InvalidateVisual();
    }

    public override void Render(DrawingContext context)
    {
        if (Session == null)
        {
            return;
        }

        var buffer = Session.Buffer;
        var rows = buffer.VisibleRows;
        var cellWidth = _cellSize.Width;
        var cellHeight = _cellSize.Height;

        context.FillRectangle(new SolidColorBrush(_backgroundColor), new Rect(Bounds.Size));

        for (var row = 0; row < rows.Count; row++)
        {
            var cells = rows[row].Cells;
            var x = 0.0;
            var col = 0;

            while (col < cells.Count)
            {
                var style = cells[col].Style;
                var start = col;
                var text = new char[cells.Count - col];
                var len = 0;

                while (col < cells.Count && cells[col].Style.Equals(style))
                {
                    text[len++] = cells[col].Rune;
                    col++;
                }

                var segment = new string(text, 0, len);
                var rect = new Rect(x, row * cellHeight, len * cellWidth, cellHeight);
                var background = new SolidColorBrush(ToColor(style.Background));
                var foreground = new SolidColorBrush(ToColor(style.Foreground));

                context.FillRectangle(background, rect);
                var ft = new FormattedText(
                    segment,
                    CultureInfo.InvariantCulture,
                    FlowDirection.LeftToRight,
                    _typeface,
                    _fontSize,
                    foreground);
                context.DrawText(ft, new Point(x, row * cellHeight));

                x += len * cellWidth;
            }
        }

        // Cursor
        var cursor = buffer.Cursor;
        var cursorRect = new Rect(cursor.Column * cellWidth, cursor.Row * cellHeight + cellHeight - 2, cellWidth, 2);
        context.FillRectangle(new SolidColorBrush(Color.FromRgb(230, 230, 230)), cursorRect);
    }

    protected override Size MeasureOverride(Size availableSize)
    {
        UpdateCellSize();
        return base.MeasureOverride(availableSize);
    }

    protected override Size ArrangeOverride(Size finalSize)
    {
        UpdateCellSize();
        ResizePty(finalSize);
        return base.ArrangeOverride(finalSize);
    }

    private void UpdateCellSize()
    {
        var ft = new FormattedText(
            "W",
            CultureInfo.InvariantCulture,
            FlowDirection.LeftToRight,
            _typeface,
            _fontSize,
            Brushes.White);
        _cellSize = new Size(Math.Max(6, ft.WidthIncludingTrailingWhitespace), Math.Max(12, ft.Height));
    }

    private async void ResizePty(Size size)
    {
        if (Session == null)
        {
            return;
        }

        var columns = Math.Max(1, (int)(size.Width / _cellSize.Width));
        var rows = Math.Max(1, (int)(size.Height / _cellSize.Height));
        await Session.ResizeAsync(columns, rows, _cts.Token);
        InvalidateVisual();
    }

    private void OnSessionUpdated(object? sender, EventArgs e)
    {
        Dispatcher.UIThread.Post(InvalidateVisual);
    }

    private void OnTextInput(object? sender, TextInputEventArgs e)
    {
        if (Session == null || string.IsNullOrEmpty(e.Text))
        {
            return;
        }

        var ch = e.Text[0];
        if (!char.IsControl(ch))
        {
            _inputBuffer += e.Text;
            Session.FeedLocal(e.Text);
        }
    }

    private async void OnKeyDown(object? sender, KeyEventArgs e)
    {
        if (Session == null)
        {
            return;
        }

        var seq = e.Key switch
        {
            Key.Enter => "\r\n",
            Key.Back => "\b",
            Key.Tab => "\t",
            Key.Left => "\u001b[D",
            Key.Right => "\u001b[C",
            Key.Up => "\u001b[A",
            Key.Down => "\u001b[B",
            _ => string.Empty
        };

        if (e.Key == Key.Enter)
        {
            e.Handled = true;
            Session.FeedLocal("\r\n");
            var line = _inputBuffer;
            _inputBuffer = string.Empty;
            await Session.SendLineAsync(line, _cts.Token);
            return;
        }

        if (e.Key == Key.Back)
        {
            e.Handled = true;
            if (_inputBuffer.Length > 0)
            {
                _inputBuffer = _inputBuffer[..^1];
                Session.FeedLocal("\b \b");
            }
            return;
        }

        if (!string.IsNullOrEmpty(seq))
        {
            e.Handled = true;
            // Ignore cursor movement for now in line mode.
        }
    }

    private void OnAttached(object? sender, VisualTreeAttachmentEventArgs e)
    {
        Focus();
    }

    private void OnDetached(object? sender, VisualTreeAttachmentEventArgs e)
    {
        _cts.Cancel();
    }

    private void OnPointerPressed(object? sender, PointerPressedEventArgs e)
    {
        Focus();
        e.Handled = true;
    }

    private static Color ToColor(TerminalColor color)
    {
        return Color.FromRgb(color.R, color.G, color.B);
    }

    private static Color ParseHex(string hex, Color fallback)
    {
        if (string.IsNullOrWhiteSpace(hex))
        {
            return fallback;
        }

        if (!hex.StartsWith("#"))
        {
            hex = "#" + hex;
        }

        if (Color.TryParse(hex, out var color))
        {
            return color;
        }

        return fallback;
    }
}
