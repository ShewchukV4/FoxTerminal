using FoxTerminal.Core;
using FoxTerminal.Config;
using FoxTerminal.Pty;
using System;
using System.Collections.Concurrent;
using System.Threading;
using System.Threading.Tasks;

namespace FoxTerminal.UI;

public sealed class TerminalSession : IAsyncDisposable
{
    // Cap pending bytes to avoid unbounded memory if the consumer falls behind.
    private const int MaxPendingChars = 4 * 1024 * 1024;

    private readonly IPty _pty;
    private readonly TerminalBuffer _buffer;
    private readonly VtParser _parser;
    private readonly ConcurrentQueue<string> _pending = new();
    private string? _pendingEcho;
    private int _pendingCharCount;

    public TerminalSession(int columns, int rows, FoxTerminalConfig? config = null)
    {
        _buffer = new TerminalBuffer(columns, rows);
        _parser = new VtParser(_buffer);
        _pty = PtyFactory.CreateDefault(BuildLaunchOptions(config));
        _pty.DataReceived += OnDataReceived;
    }

    public TerminalBuffer Buffer => _buffer;

    /// <summary>
    /// Raised whenever new data has been queued for the UI thread to consume.
    /// May fire from any thread; consumers must marshal to the UI thread.
    /// </summary>
    public event EventHandler? Updated;

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        await _pty.StartAsync(cancellationToken);
    }

    public Task SendAsync(string data, CancellationToken cancellationToken)
    {
        return _pty.WriteAsync(data, cancellationToken);
    }

    public Task SendLineAsync(string line, CancellationToken cancellationToken)
    {
        _pendingEcho = line;
        return _pty.WriteAsync(line + "\r\n", cancellationToken);
    }

    /// <summary>
    /// Feeds locally-generated data (e.g. echo for typed characters).
    /// Must be called from the UI thread; mutates the buffer immediately.
    /// </summary>
    public void FeedLocal(string data)
    {
        if (string.IsNullOrEmpty(data))
        {
            return;
        }

        _parser.Feed(data);
        Updated?.Invoke(this, EventArgs.Empty);
    }

    /// <summary>
    /// Drains queued PTY data into the buffer. Must be called on the UI thread.
    /// Returns true when at least one chunk was applied.
    /// </summary>
    public bool DrainPending()
    {
        var any = false;
        while (_pending.TryDequeue(out var chunk))
        {
            Interlocked.Add(ref _pendingCharCount, -chunk.Length);
            var data = chunk;

            if (!string.IsNullOrEmpty(_pendingEcho))
            {
                if (data.StartsWith(_pendingEcho, StringComparison.Ordinal))
                {
                    data = data[_pendingEcho.Length..];
                    if (data.StartsWith("\r\n", StringComparison.Ordinal))
                    {
                        data = data[2..];
                    }
                    else if (data.StartsWith("\n", StringComparison.Ordinal))
                    {
                        data = data[1..];
                    }
                    _pendingEcho = null;
                }
            }

            if (data.Length > 0)
            {
                _parser.Feed(data);
            }
            any = true;
        }
        return any;
    }

    public Task ResizeAsync(int columns, int rows, CancellationToken cancellationToken)
    {
        _buffer.Resize(columns, rows);
        return _pty.ResizeAsync(columns, rows, cancellationToken);
    }

    public async ValueTask DisposeAsync()
    {
        _pty.DataReceived -= OnDataReceived;
        await _pty.DisposeAsync();
    }

    private void OnDataReceived(object? sender, PtyDataEventArgs e)
    {
        if (string.IsNullOrEmpty(e.Data))
        {
            return;
        }

        // Backpressure: if the UI thread cannot keep up, drop the oldest data
        // rather than letting memory grow without bound. This prevents the
        // long freezes that happen when the consumer falls behind.
        var current = Interlocked.Add(ref _pendingCharCount, e.Data.Length);
        while (current > MaxPendingChars && _pending.TryDequeue(out var dropped))
        {
            current = Interlocked.Add(ref _pendingCharCount, -dropped.Length);
        }

        _pending.Enqueue(e.Data);
        Updated?.Invoke(this, EventArgs.Empty);
    }

    private static PtyLaunchOptions BuildLaunchOptions(FoxTerminalConfig? config)
    {
        if (config == null)
        {
            return PtyLaunchOptions.Default;
        }

        return new PtyLaunchOptions
        {
            ShellBackend = config.ShellBackend,
            ShellPath = config.ShellPath,
            ShellArguments = config.ShellArguments,
            WorkingDirectory = Environment.CurrentDirectory
        };
    }
}
