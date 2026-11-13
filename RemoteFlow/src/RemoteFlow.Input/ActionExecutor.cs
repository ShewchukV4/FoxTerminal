using System.Diagnostics;
using Microsoft.Extensions.Logging;
using RemoteFlow.Core.Models;
using RemoteFlow.Core.Protocol;
using RemoteFlow.Core.Storage;
using RemoteFlow.Input.Native;

namespace RemoteFlow.Input;

public sealed class ActionExecutor
{
    private readonly ILogger _logger;
    private readonly KeyboardService _keyboard;
    private readonly Func<AgentConfig> _config;
    private CancellationTokenSource? _macroCts;

    public ActionExecutor(ILogger logger, KeyboardService keyboard, Func<AgentConfig> config)
    {
        _logger = logger;
        _keyboard = keyboard;
        _config = config;
    }

    public void CancelMacro()
    {
        try { _macroCts?.Cancel(); } catch { /* ignore */ }
    }

    public async Task<CommandResult> ExecuteAsync(ActionDefinition action, CancellationToken ct = default)
    {
        try
        {
            return action.Kind switch
            {
                ActionKind.OpenUrl => OpenUrl(action.Target),
                ActionKind.LaunchApp => LaunchApp(action.Target),
                ActionKind.OpenFolder => OpenFolder(action.Target),
                ActionKind.VolumeUp => Media(SendInputApi.VK_VOLUME_UP),
                ActionKind.VolumeDown => Media(SendInputApi.VK_VOLUME_DOWN),
                ActionKind.VolumeMute => Media(SendInputApi.VK_VOLUME_MUTE),
                ActionKind.MediaPlayPause => Media(SendInputApi.VK_MEDIA_PLAY_PAUSE),
                ActionKind.MediaNext => Media(SendInputApi.VK_MEDIA_NEXT_TRACK),
                ActionKind.MediaPrevious => Media(SendInputApi.VK_MEDIA_PREV_TRACK),
                ActionKind.Screenshot => Screenshot(),
                ActionKind.LockWorkstation => Lock(),
                ActionKind.Hotkey => Hotkey(action.Target),
                ActionKind.Macro => await RunMacroAsync(action, ct),
                _ => CommandResult.Fail("Unsupported action kind")
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Action failed: {Kind}", action.Kind);
            return CommandResult.Fail(ex.Message);
        }
    }

    private CommandResult Media(byte vk)
    {
        _keyboard.Media(vk);
        return CommandResult.Success();
    }

    private CommandResult Lock()
    {
        if (!SendInputApi.LockWorkStation())
            return CommandResult.Fail("LockWorkStation failed");
        return CommandResult.Success();
    }

    private CommandResult Hotkey(string? combo)
    {
        if (string.IsNullOrWhiteSpace(combo))
            return CommandResult.Fail("Hotkey target required");
        _keyboard.Handle(new KeyboardEvent { Key = combo });
        return CommandResult.Success();
    }

    private CommandResult OpenUrl(string? target)
    {
        var cfg = _config();
        var url = ResolveUrl(cfg, target);
        if (url is null) return CommandResult.Fail("URL not allowlisted");
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) ||
            (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
            return CommandResult.Fail("Only http/https URLs are allowed");

        Process.Start(new ProcessStartInfo(uri.ToString()) { UseShellExecute = true });
        return CommandResult.Success(uri.ToString());
    }

    private CommandResult LaunchApp(string? target)
    {
        var cfg = _config();
        var app = ResolveApp(cfg, target);
        if (app is null) return CommandResult.Fail("App not allowlisted");

        try
        {
            LaunchResolved(app);
            return CommandResult.Success(app.Name);
        }
        catch (Exception ex)
        {
            return CommandResult.Fail(ex.Message);
        }
    }

    private CommandResult OpenFolder(string? target)
    {
        var cfg = _config();
        var folder = ResolveFolder(cfg, target);
        if (folder is null) return CommandResult.Fail("Folder not allowlisted");
        if (!Directory.Exists(folder.Path))
            return CommandResult.Fail("Folder does not exist");

        Process.Start(new ProcessStartInfo("explorer.exe", $"\"{folder.Path}\"") { UseShellExecute = true });
        return CommandResult.Success(folder.Path);
    }

    private CommandResult Screenshot()
    {
        AppPaths.EnsureCreated();
        var path = Path.Combine(AppPaths.ScreenshotsDir, $"shot-{DateTime.Now:yyyyMMdd-HHmmss}.png");
        // Use virtual screen bounds
        var bounds = System.Windows.Forms.SystemInformation.VirtualScreen;
        using var bmp = new System.Drawing.Bitmap(bounds.Width, bounds.Height);
        using (var g = System.Drawing.Graphics.FromImage(bmp))
            g.CopyFromScreen(bounds.Left, bounds.Top, 0, 0, bmp.Size);
        bmp.Save(path, System.Drawing.Imaging.ImageFormat.Png);
        return CommandResult.Success(path);
    }

    private async Task<CommandResult> RunMacroAsync(ActionDefinition action, CancellationToken ct)
    {
        if (action.MacroSteps is null || action.MacroSteps.Count == 0)
            return CommandResult.Fail("Macro has no steps");

        _macroCts?.Cancel();
        _macroCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        var token = _macroCts.Token;

        foreach (var step in action.MacroSteps)
        {
            token.ThrowIfCancellationRequested();
            var stepAction = new ActionDefinition
            {
                Kind = step.Kind,
                Target = step.Target,
                Name = action.Name
            };
            if (step.Kind == ActionKind.Macro)
                return CommandResult.Fail("Nested macros are not allowed");

            var result = await ExecuteAsync(stepAction, token);
            if (!result.Ok) return result;
            if (step.DelayMs > 0)
                await Task.Delay(step.DelayMs, token);
        }
        return CommandResult.Success("Macro completed");
    }

    private static string? ResolveUrl(AgentConfig cfg, string? target)
    {
        if (string.IsNullOrWhiteSpace(target)) return null;
        target = target.Trim();
        var byId = cfg.AllowedUrls.FirstOrDefault(u =>
            u.Id.Equals(target, StringComparison.OrdinalIgnoreCase) ||
            u.Name.Equals(target, StringComparison.OrdinalIgnoreCase));
        if (byId is not null) return byId.Url;
        // Direct URL only if explicitly allowlisted
        var byUrl = cfg.AllowedUrls.FirstOrDefault(u =>
            u.Url.Equals(target, StringComparison.OrdinalIgnoreCase));
        return byUrl?.Url ?? (cfg.AllowedUrls.Any(u => target.StartsWith(u.Url, StringComparison.OrdinalIgnoreCase)) ? target : null);
    }

    private static AllowedApp? ResolveApp(AgentConfig cfg, string? target)
    {
        if (string.IsNullOrWhiteSpace(target)) return null;
        target = target.Trim();
        return cfg.AllowedApps.FirstOrDefault(a =>
            a.Id.Equals(target, StringComparison.OrdinalIgnoreCase) ||
            a.Name.Equals(target, StringComparison.OrdinalIgnoreCase) ||
            a.PathOrShell.Equals(target, StringComparison.OrdinalIgnoreCase));
    }

    private static AllowedFolder? ResolveFolder(AgentConfig cfg, string? target)
    {
        if (string.IsNullOrWhiteSpace(target)) return null;
        target = target.Trim();
        return cfg.AllowedFolders.FirstOrDefault(f =>
            f.Id.Equals(target, StringComparison.OrdinalIgnoreCase) ||
            f.Name.Equals(target, StringComparison.OrdinalIgnoreCase) ||
            f.Path.Equals(target, StringComparison.OrdinalIgnoreCase));
    }

    private static void LaunchResolved(AllowedApp app)
    {
        var key = app.PathOrShell.Trim().ToLowerInvariant();
        switch (key)
        {
            case "browser":
                Process.Start(new ProcessStartInfo("https://") { UseShellExecute = true });
                return;
            case "vscode":
                if (TryStart("code") || TryStart(ExpandLocal(@"Programs\Microsoft VS Code\Code.exe")))
                    return;
                throw new InvalidOperationException("VS Code not found");
            case "discord":
                if (TryStart(ExpandLocal(@"Discord\Update.exe"), "--processStart Discord.exe") ||
                    TryStart("discord:"))
                    return;
                throw new InvalidOperationException("Discord not found");
            case "steam":
                if (TryStart("steam:") || TryStart(@"C:\Program Files (x86)\Steam\steam.exe"))
                    return;
                throw new InvalidOperationException("Steam not found");
            case "terminal":
                if (TryStart("wt") || TryStart("powershell"))
                    return;
                throw new InvalidOperationException("Terminal not found");
            default:
                if (File.Exists(app.PathOrShell))
                {
                    Process.Start(new ProcessStartInfo(app.PathOrShell, app.Arguments ?? "")
                    {
                        UseShellExecute = true
                    });
                    return;
                }
                // Shell protocol like "spotify:"
                if (app.PathOrShell.Contains(':') && !app.PathOrShell.Contains('\\'))
                {
                    Process.Start(new ProcessStartInfo(app.PathOrShell) { UseShellExecute = true });
                    return;
                }
                throw new InvalidOperationException("App path invalid");
        }
    }

    private static string ExpandLocal(string relative) =>
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), relative);

    private static bool TryStart(string fileName, string? args = null)
    {
        try
        {
            var psi = new ProcessStartInfo(fileName)
            {
                UseShellExecute = true
            };
            if (!string.IsNullOrEmpty(args)) psi.Arguments = args;
            Process.Start(psi);
            return true;
        }
        catch
        {
            return false;
        }
    }
}
