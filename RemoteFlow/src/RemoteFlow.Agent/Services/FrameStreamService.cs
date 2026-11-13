using Microsoft.AspNetCore.SignalR;
using RemoteFlow.Agent.Hubs;
using RemoteFlow.Core.Protocol;

namespace RemoteFlow.Agent.Services;

public sealed class FrameStreamService : IHostedService, IDisposable
{
    private readonly AgentRuntime _runtime;
    private readonly IHubContext<RemoteHub> _hub;
    private readonly ILogger<FrameStreamService> _logger;
    private CancellationTokenSource? _cts;
    private Task? _loop;
    private int _quality;

    public FrameStreamService(AgentRuntime runtime, IHubContext<RemoteHub> hub, ILogger<FrameStreamService> logger)
    {
        _runtime = runtime;
        _hub = hub;
        _logger = logger;
        _quality = runtime.Config.Current.Stream.JpegQuality;
    }

    public Task StartAsync(CancellationToken cancellationToken)
    {
        _cts = new CancellationTokenSource();
        _loop = Task.Run(() => LoopAsync(_cts.Token));
        return Task.CompletedTask;
    }

    public async Task StopAsync(CancellationToken cancellationToken)
    {
        if (_cts is null) return;
        await _cts.CancelAsync();
        if (_loop is not null)
        {
            try { await _loop; } catch { /* ignore */ }
        }
    }

    private async Task LoopAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            try
            {
                if (!_runtime.Capture.IsActive || _runtime.Sessions.IsEmpty)
                {
                    await Task.Delay(100, ct);
                    continue;
                }

                var cfg = _runtime.Config.Current.Stream;
                var fps = Math.Clamp(cfg.TargetFps, 5, cfg.MaxFps);
                var delay = TimeSpan.FromMilliseconds(1000.0 / fps);

                var monitor = _runtime.Monitors.GetMonitor(_runtime.SelectedMonitor);
                if (monitor is null)
                {
                    await Task.Delay(delay, ct);
                    continue;
                }

                _runtime.Capture.Configure(cfg);
                if (cfg.AdaptiveQuality)
                    _runtime.Capture.AdaptQuality(50, fps, ref _quality);

                var frame = _runtime.Capture.CaptureFrame(monitor);
                if (frame is not null)
                {
                    var packet = new FramePacket
                    {
                        MonitorIndex = frame.MonitorIndex,
                        Width = frame.Width,
                        Height = frame.Height,
                        TimestampMs = frame.TimestampMs,
                        Base64 = Convert.ToBase64String(frame.JpegBytes)
                    };
                    await _hub.Clients.Group("screen").SendAsync("Frame", packet, ct);
                }

                await Task.Delay(delay, ct);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Frame stream loop error");
                try { await Task.Delay(200, ct); } catch { break; }
            }
        }
    }

    public void Dispose() => _cts?.Cancel();
}
