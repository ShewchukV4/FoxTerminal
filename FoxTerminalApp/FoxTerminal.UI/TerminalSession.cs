using FoxTerminal.Core;
using FoxTerminal.Pty;
using System;
using System.Threading;
using System.Threading.Tasks;

namespace FoxTerminal.UI;

public sealed class TerminalSession : IAsyncDisposable
{
    private readonly IPty _pty;
    private readonly TerminalBuffer _buffer;
    private readonly VtParser _parser;
    private string? _pendingEcho;

    public TerminalSession(int columns, int rows)
    {
        _buffer = new TerminalBuffer(columns, rows);
        _parser = new VtParser(_buffer);
        _pty = PtyFactory.CreateDefault();
        _pty.DataReceived += OnDataReceived;
    }

    public TerminalBuffer Buffer => _buffer;

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

    public void FeedLocal(string data)
    {
        if (string.IsNullOrEmpty(data))
        {
            return;
        }

        _parser.Feed(data);
        Updated?.Invoke(this, EventArgs.Empty);
    }

    public Task ResizeAsync(int columns, int rows, CancellationToken cancellationToken)
    {
        _buffer.Resize(columns, rows);
        return _pty.ResizeAsync(columns, rows, cancellationToken);
    }

    public async ValueTask DisposeAsync()
    {
        await _pty.DisposeAsync();
    }

    private void OnDataReceived(object? sender, PtyDataEventArgs e)
    {
        var data = e.Data;
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

        _parser.Feed(data);
        Updated?.Invoke(this, EventArgs.Empty);
    }
}
