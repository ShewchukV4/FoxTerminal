using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using RemoteFlow.Core.Models;

namespace RemoteFlow.Capture;

/// <summary>
/// Screen capture using GDI BitBlt for reliable LAN streaming.
/// Windows.Graphics.Capture integration is prepared via <see cref="GraphicsCaptureSession"/> when WinRT is available;
/// BitBlt is the default path that works for the interactive user session without extra prompts.
/// Secure Desktop / UAC screens are not captured (by design).
/// </summary>
public sealed class ScreenCaptureService : IDisposable
{
    private readonly object _gate = new();
    private bool _active;
    private int _monitorIndex;
    private int _jpegQuality = 70;
    private int _maxWidth = 1920;
    private Bitmap? _buffer;
    private Graphics? _graphics;
    private bool _disposed;

    public bool IsActive
    {
        get { lock (_gate) return _active; }
    }

    public int MonitorIndex
    {
        get { lock (_gate) return _monitorIndex; }
        set { lock (_gate) { _monitorIndex = value; ResetBuffer(); } }
    }

    public event Action? Started;
    public event Action? Stopped;

    public void Configure(StreamQualitySettings settings)
    {
        lock (_gate)
        {
            _jpegQuality = Math.Clamp(settings.JpegQuality, 20, 95);
            _maxWidth = Math.Clamp(settings.MaxWidth, 640, 3840);
        }
    }

    public void Start(int monitorIndex = 0)
    {
        lock (_gate)
        {
            _monitorIndex = monitorIndex;
            _active = true;
            ResetBuffer();
        }
        Started?.Invoke();
    }

    public void Stop()
    {
        lock (_gate)
        {
            if (!_active) return;
            _active = false;
            ResetBuffer();
        }
        Stopped?.Invoke();
    }

    public CaptureFrame? CaptureFrame(MonitorInfo monitor)
    {
        lock (_gate)
        {
            if (!_active || _disposed) return null;

            var srcW = monitor.Width;
            var srcH = monitor.Height;
            var scale = 1f;
            if (srcW > _maxWidth)
                scale = (float)_maxWidth / srcW;
            var dstW = Math.Max(1, (int)(srcW * scale));
            var dstH = Math.Max(1, (int)(srcH * scale));

            EnsureBuffer(dstW, dstH);

            using var screenBmp = new Bitmap(srcW, srcH, PixelFormat.Format32bppArgb);
            using (var g = Graphics.FromImage(screenBmp))
            {
                g.CopyFromScreen(monitor.X, monitor.Y, 0, 0, new Size(srcW, srcH), CopyPixelOperation.SourceCopy);
            }

            _graphics!.Clear(Color.Black);
            _graphics.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.Low;
            _graphics.DrawImage(screenBmp, 0, 0, dstW, dstH);

            using var ms = new MemoryStream();
            var encoder = GetJpegEncoder();
            using var ep = new EncoderParameters(1);
            ep.Param[0] = new EncoderParameter(Encoder.Quality, (long)_jpegQuality);
            _buffer!.Save(ms, encoder, ep);

            return new CaptureFrame
            {
                MonitorIndex = monitor.Index,
                Width = dstW,
                Height = dstH,
                JpegBytes = ms.ToArray(),
                TimestampMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
            };
        }
    }

    public void AdaptQuality(double rttMs, double targetFps, ref int currentQuality)
    {
        // Simple adaptive ladder
        if (rttMs > 120 || targetFps < 20)
            currentQuality = Math.Max(35, currentQuality - 5);
        else if (rttMs < 40 && targetFps >= 28)
            currentQuality = Math.Min(85, currentQuality + 2);

        lock (_gate) _jpegQuality = currentQuality;
    }

    private void EnsureBuffer(int w, int h)
    {
        if (_buffer is not null && _buffer.Width == w && _buffer.Height == h) return;
        ResetBuffer();
        _buffer = new Bitmap(w, h, PixelFormat.Format24bppRgb);
        _graphics = Graphics.FromImage(_buffer);
    }

    private void ResetBuffer()
    {
        _graphics?.Dispose();
        _graphics = null;
        _buffer?.Dispose();
        _buffer = null;
    }

    private static ImageCodecInfo GetJpegEncoder() =>
        ImageCodecInfo.GetImageEncoders().First(c => c.FormatID == ImageFormat.Jpeg.Guid);

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        Stop();
        ResetBuffer();
    }
}

public sealed class CaptureFrame
{
    public int MonitorIndex { get; init; }
    public int Width { get; init; }
    public int Height { get; init; }
    public long TimestampMs { get; init; }
    public byte[] JpegBytes { get; init; } = [];
}

/// <summary>
/// Placeholder for future Windows.Graphics.Capture-based path.
/// Documented limitation: WGC requires a graphics capture item picker or HWND/monitor handle
/// and WinRT activation; BitBlt covers the interactive desktop for RemoteFlow v1.
/// </summary>
public static class GraphicsCaptureSession
{
    public static bool IsSupported
    {
        get
        {
            try
            {
                return Environment.OSVersion.Version.Major >= 10;
            }
            catch { return false; }
        }
    }
}
