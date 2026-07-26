using Avalonia;
using Avalonia.Controls;
using Avalonia.Input;
using Avalonia.Media;
using Avalonia.Threading;
using FoxTerminal.Core;
using FoxTerminal.Config;
using System;
using System.Collections.Generic;
using System.Threading;
using System.Globalization;

namespace FoxTerminal.UI;

public sealed class TerminalControl : Control
{
    private TerminalSession? _session;
    private Typeface _typeface = new("Cascadia Mono");
    private double _fontSize = 13;
    private Color _backgroundColor = Color.FromRgb(11, 15, 26);
    private IBrush _backgroundBrush = new SolidColorBrush(Color.FromRgb(11, 15, 26)).ToImmutable();
    private IBrush _cursorBrush = new SolidColorBrush(Color.FromRgb(230, 230, 230)).ToImmutable();
    private Size _cellSize = new(8, 16);
    private bool _cellSizeDirty = true;
    private CancellationTokenSource _cts = new();

    // Coalescing flag: 0 = no render queued, 1 = render queued.
    // Many PTY chunks per frame collapse into a single redraw.
    private int _renderQueued;

    // Reusable buffer for run-length-style style segmentation in Render.
    // Lives on the UI thread; reused across frames to avoid per-render
    // allocations that previously triggered GC pressure / freezes.
    private char[] _segmentBuffer = new char[256];

    // Brush cache keyed by terminal color so we don't allocate a new
    // SolidColorBrush per cell-segment per frame.
    private readonly Dictionary<TerminalColor, IBrush> _brushCache = new();

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
                ScheduleRender();
            }
        }
    }

    public TerminalControl()
    {
        Focusable = true;
        ClipToBounds = true;
        GotFocus += (_, _) => RefreshFoxTheme();
        // Aliased edges keep the cell grid pixel-crisp and avoid sub-pixel
        // shimmer that looks like flicker when redrawing rapidly.
        RenderOptions.SetEdgeMode(this, EdgeMode.Aliased);
        RenderOptions.SetTextRenderingMode(this, TextRenderingMode.Antialias);
        AttachedToVisualTree += OnAttached;
        DetachedFromVisualTree += OnDetached;
        AddHandler(PointerPressedEvent, OnPointerPressed, handledEventsToo: true);
        AddHandler(TextInputEvent, OnTextInput, handledEventsToo: true);
        AddHandler(KeyDownEvent, OnKeyDown, handledEventsToo: true);
    }

    public void ApplyConfig(FoxTerminalConfig config)
    {
        FoxThemeLoader.ApplyToConfig(config);
        _typeface = new Typeface(config.FontFamily);
        _fontSize = config.FontSize;
        _backgroundColor = ParseHex(config.Background, _backgroundColor);
        _backgroundBrush = new SolidColorBrush(_backgroundColor).ToImmutable();
        _brushCache.Clear();
        _cellSizeDirty = true;
        InvalidateMeasure();
        InvalidateVisual();
    }

    public void RefreshFoxTheme()
    {
        FoxThemeLoader.ApplyTerminalTheme();
        _backgroundColor = ParseHex(TerminalTheme.BackgroundHex, _backgroundColor);
        _backgroundBrush = new SolidColorBrush(_backgroundColor).ToImmutable();
        _brushCache.Clear();
        InvalidateVisual();
    }

    public override void Render(DrawingContext context)
    {
        var session = _session;
        if (session == null)
        {
            return;
        }

        // Apply any pending PTY data on the UI thread, just before painting.
        // This serialises buffer mutation with rendering and removes the
        // background-thread race that previously caused visual corruption
        // resembling flicker.
        session.DrainPending();

        var buffer = session.Buffer;
        var rows = buffer.VisibleRows;
        var rowCount = rows.Count;
        var cellWidth = _cellSize.Width;
        var cellHeight = _cellSize.Height;

        context.FillRectangle(_backgroundBrush, new Rect(Bounds.Size));

        for (var row = 0; row < rowCount; row++)
        {
            var cells = rows[row].Cells;
            var cellCount = cells.Count;
            if (cellCount == 0)
            {
                continue;
            }

            EnsureSegmentCapacity(cellCount);

            var x = 0.0;
            var col = 0;
            var y = row * cellHeight;

            while (col < cellCount)
            {
                var style = cells[col].Style;
                var len = 0;
                while (col < cellCount && cells[col].Style.Equals(style))
                {
                    _segmentBuffer[len++] = cells[col].Rune;
                    col++;
                }

                var segmentWidth = len * cellWidth;
                var rect = new Rect(x, y, segmentWidth, cellHeight);

                // Skip drawing the background fill when the cells use the
                // default background; the surface fill above already covers
                // it. Saves a FillRectangle per default-styled run.
                if (!style.Background.IsDefault)
                {
                    context.FillRectangle(GetBrush(style.Background), rect);
                }

                // Skip emitting glyph runs that are entirely whitespace.
                if (HasVisibleGlyph(_segmentBuffer, len))
                {
                    var segment = new string(_segmentBuffer, 0, len);
                    var ft = new FormattedText(
                        segment,
                        CultureInfo.InvariantCulture,
                        FlowDirection.LeftToRight,
                        _typeface,
                        _fontSize,
                        GetBrush(style.Foreground));
                    context.DrawText(ft, new Point(x, y));
                }

                x += segmentWidth;
            }
        }

        var cursor = buffer.Cursor;
        var cursorRect = new Rect(
            cursor.Column * cellWidth,
            cursor.Row * cellHeight + cellHeight - 2,
            cellWidth,
            2);
        context.FillRectangle(_cursorBrush, cursorRect);
    }

    protected override Size MeasureOverride(Size availableSize)
    {
        EnsureCellSize();
        return base.MeasureOverride(availableSize);
    }

    protected override Size ArrangeOverride(Size finalSize)
    {
        EnsureCellSize();
        ResizePty(finalSize);
        return base.ArrangeOverride(finalSize);
    }

    private void EnsureCellSize()
    {
        if (!_cellSizeDirty)
        {
            return;
        }

        var ft = new FormattedText(
            "W",
            CultureInfo.InvariantCulture,
            FlowDirection.LeftToRight,
            _typeface,
            _fontSize,
            Brushes.White);
        _cellSize = new Size(
            Math.Max(6, ft.WidthIncludingTrailingWhitespace),
            Math.Max(12, ft.Height));
        _cellSizeDirty = false;
    }

    private async void ResizePty(Size size)
    {
        var session = _session;
        if (session == null)
        {
            return;
        }

        var columns = Math.Max(1, (int)(size.Width / _cellSize.Width));
        var rows = Math.Max(1, (int)(size.Height / _cellSize.Height));
        if (columns == session.Buffer.Columns && rows == session.Buffer.Rows)
        {
            return;
        }

        try
        {
            await session.ResizeAsync(columns, rows, _cts.Token);
        }
        catch (OperationCanceledException)
        {
            return;
        }

        ScheduleRender();
    }

    private void OnSessionUpdated(object? sender, EventArgs e)
    {
        ScheduleRender();
    }

    /// <summary>
    /// Coalesces redraw requests so that bursts of PTY data become at most
    /// one render per UI frame rather than flooding the dispatcher.
    /// </summary>
    private void ScheduleRender()
    {
        if (Interlocked.Exchange(ref _renderQueued, 1) == 0)
        {
            Dispatcher.UIThread.Post(RunRender, DispatcherPriority.Render);
        }
    }

    private void RunRender()
    {
        Volatile.Write(ref _renderQueued, 0);
        InvalidateVisual();
    }

    private async void OnTextInput(object? sender, TextInputEventArgs e)
    {
        var session = _session;
        if (session == null || string.IsNullOrEmpty(e.Text))
        {
            return;
        }

        var ch = e.Text[0];
        if (!char.IsControl(ch))
        {
            e.Handled = true;
            try
            {
                await session.SendAsync(e.Text, _cts.Token);
            }
            catch (OperationCanceledException)
            {
                // Control was detached; ignore.
            }
        }
    }

    private async void OnKeyDown(object? sender, KeyEventArgs e)
    {
        var session = _session;
        if (session == null)
        {
            return;
        }

        if (e.Key == Key.Enter)
        {
            e.Handled = true;
            try
            {
                await session.SendAsync("\r", _cts.Token);
            }
            catch (OperationCanceledException)
            {
                // Control was detached; ignore.
            }
            return;
        }

        if (e.Key == Key.Back)
        {
            e.Handled = true;
            try
            {
                await session.SendAsync("\b", _cts.Token);
            }
            catch (OperationCanceledException)
            {
                // Control was detached; ignore.
            }
            return;
        }

        var seq = e.Key switch
        {
            Key.Tab => "\t",
            Key.Left => "\u001b[D",
            Key.Right => "\u001b[C",
            Key.Up => "\u001b[A",
            Key.Down => "\u001b[B",
            Key.Home => "\u001b[H",
            Key.End => "\u001b[F",
            Key.Delete => "\u001b[3~",
            Key.PageUp => "\u001b[5~",
            Key.PageDown => "\u001b[6~",
            Key.Escape => "\u001b",
            _ => null
        };

        if ((e.KeyModifiers & KeyModifiers.Control) != 0)
        {
            seq = e.Key switch
            {
                Key.C => "\u0003",
                Key.D => "\u0004",
                Key.L => "\u000c",
                _ => seq
            };
        }

        if (!string.IsNullOrEmpty(seq))
        {
            e.Handled = true;
            try
            {
                await session.SendAsync(seq, _cts.Token);
            }
            catch (OperationCanceledException)
            {
                // Control was detached; ignore.
            }
        }
    }

    private void OnAttached(object? sender, VisualTreeAttachmentEventArgs e)
    {
        if (_cts.IsCancellationRequested)
        {
            _cts.Dispose();
            _cts = new CancellationTokenSource();
        }
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

    private IBrush GetBrush(TerminalColor color)
    {
        if (!_brushCache.TryGetValue(color, out var brush))
        {
            brush = new SolidColorBrush(Color.FromRgb(color.R, color.G, color.B)).ToImmutable();
            _brushCache[color] = brush;
        }
        return brush;
    }

    private void EnsureSegmentCapacity(int required)
    {
        if (_segmentBuffer.Length < required)
        {
            var size = _segmentBuffer.Length;
            while (size < required)
            {
                size *= 2;
            }
            _segmentBuffer = new char[size];
        }
    }

    private static bool HasVisibleGlyph(char[] buffer, int length)
    {
        for (var i = 0; i < length; i++)
        {
            var ch = buffer[i];
            if (ch != ' ' && ch != '\0')
            {
                return true;
            }
        }
        return false;
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
