using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

namespace FoxTerminal.Pty;

public interface IPty : IAsyncDisposable
{
    event EventHandler<PtyDataEventArgs>? DataReceived;
    event EventHandler? Exited;

    bool IsRunning { get; }
    int? ExitCode { get; }

    Task StartAsync(CancellationToken cancellationToken);
    Task WriteAsync(string data, CancellationToken cancellationToken);
    Task ResizeAsync(int columns, int rows, CancellationToken cancellationToken);
}

public sealed class PtyDataEventArgs : EventArgs
{
    public PtyDataEventArgs(string data)
    {
        Data = data;
    }

    public string Data { get; }
}

public sealed class BasicProcessPty : IPty
{
    private readonly string _fileName;
    private readonly string? _arguments;
    private readonly string? _workingDirectory;
    private Process? _process;
    private Task? _readTask;
    private CancellationTokenSource? _readCts;

    public BasicProcessPty(string fileName, string? arguments, string? workingDirectory)
    {
        _fileName = fileName;
        _arguments = arguments;
        _workingDirectory = workingDirectory;
    }

    public event EventHandler<PtyDataEventArgs>? DataReceived;
    public event EventHandler? Exited;

    public bool IsRunning => _process is { HasExited: false };
    public int? ExitCode => _process?.HasExited == true ? _process.ExitCode : null;

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        if (_process != null)
        {
            throw new InvalidOperationException("PTY already started.");
        }

        var psi = new ProcessStartInfo
        {
            FileName = _fileName,
            Arguments = _arguments ?? string.Empty,
            WorkingDirectory = _workingDirectory ?? Environment.CurrentDirectory,
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
            StandardOutputEncoding = Encoding.UTF8,
            StandardErrorEncoding = Encoding.UTF8,
            StandardInputEncoding = Encoding.UTF8
        };

        _process = new Process { StartInfo = psi, EnableRaisingEvents = true };
        _process.Exited += (_, _) => Exited?.Invoke(this, EventArgs.Empty);

        if (!_process.Start())
        {
            throw new InvalidOperationException("Failed to start shell process.");
        }

        _readCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        _readTask = Task.WhenAll(
            ReadStreamAsync(_process.StandardOutput, _readCts.Token),
            ReadStreamAsync(_process.StandardError, _readCts.Token));

        await Task.CompletedTask;
    }

    public async Task WriteAsync(string data, CancellationToken cancellationToken)
    {
        if (_process?.HasExited != false)
        {
            return;
        }

        await _process.StandardInput.WriteAsync(data.AsMemory(), cancellationToken);
        await _process.StandardInput.FlushAsync(cancellationToken);
    }

    public Task ResizeAsync(int columns, int rows, CancellationToken cancellationToken)
    {
        // Placeholder for real PTY resize; unsupported in BasicProcessPty.
        return Task.CompletedTask;
    }

    public async ValueTask DisposeAsync()
    {
        if (_readCts != null)
        {
            _readCts.Cancel();
        }

        if (_process != null && !_process.HasExited)
        {
            _process.Kill(entireProcessTree: true);
        }

        if (_readTask != null)
        {
            try
            {
                await _readTask;
            }
            catch
            {
                // Ignore cancellation
            }
        }

        _process?.Dispose();
        _readCts?.Dispose();
    }

    private async Task ReadStreamAsync(StreamReader reader, CancellationToken cancellationToken)
    {
        var buffer = new char[4096];
        while (!cancellationToken.IsCancellationRequested)
        {
            var read = await reader.ReadAsync(buffer.AsMemory(0, buffer.Length), cancellationToken);
            if (read <= 0)
            {
                break;
            }

            var text = new string(buffer, 0, read);
            DataReceived?.Invoke(this, new PtyDataEventArgs(text));
        }
    }
}

public static class PtyFactory
{
    public static IPty CreateDefault()
    {
        if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
        {
            var shell = Environment.GetEnvironmentVariable("COMSPEC") ?? "cmd.exe";
            var cmdPath = @"C:\Users\dmytr\Desktop\FireFoxBot\cmd";
            var args = $"/Q /K \"chcp 65001 >nul & set PATH={cmdPath};%PATH%\"";
            return new BasicProcessPty(shell, args, Environment.CurrentDirectory);
        }

        var unixShell = Environment.GetEnvironmentVariable("SHELL") ?? "/bin/bash";
        return new BasicProcessPty(unixShell, null, Environment.CurrentDirectory);
    }
}
