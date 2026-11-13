using RemoteFlow.Core.Models;

namespace RemoteFlow.Core.Defaults;

public static class DefaultProfiles
{
    public static DeckState Create()
    {
        var gaming = BuildGaming();
        var programming = BuildProgramming();
        var multimedia = BuildMultimedia();

        return new DeckState
        {
            ActiveProfileId = programming.Id,
            Profiles = [programming, gaming, multimedia]
        };
    }

    private static DeckProfile BuildProgramming()
    {
        var actions = new List<ActionDefinition>
        {
            Act("vscode", "VS Code", ActionKind.LaunchApp, "vscode"),
            Act("browser", "Browser", ActionKind.LaunchApp, "browser"),
            Act("github", "GitHub", ActionKind.OpenUrl, "https://github.com"),
            Act("folder", "Project", ActionKind.OpenFolder, "projects"),
            Act("macro-prog", "Programming", ActionKind.Macro, null, [
                new MacroStep { Kind = ActionKind.LaunchApp, Target = "vscode", DelayMs = 400 },
                new MacroStep { Kind = ActionKind.LaunchApp, Target = "browser", DelayMs = 400 },
                new MacroStep { Kind = ActionKind.OpenUrl, Target = "https://github.com", DelayMs = 200 },
                new MacroStep { Kind = ActionKind.OpenFolder, Target = "projects", DelayMs = 0 }
            ]),
            Act("vol-up", "Vol+", ActionKind.VolumeUp),
            Act("vol-down", "Vol-", ActionKind.VolumeDown),
            Act("lock", "Lock", ActionKind.LockWorkstation)
        };

        return new DeckProfile
        {
            Name = "Programming",
            Actions = actions,
            Buttons =
            [
                Btn(actions[4], 0, 0, "#7C5CFF", "code"),
                Btn(actions[0], 0, 1, "#3B82F6", "terminal"),
                Btn(actions[1], 0, 2, "#06B6D4", "globe"),
                Btn(actions[2], 1, 0, "#22C55E", "github"),
                Btn(actions[3], 1, 1, "#F59E0B", "folder"),
                Btn(actions[5], 1, 2, "#64748B", "volume-up"),
                Btn(actions[6], 2, 0, "#64748B", "volume-down"),
                Btn(actions[7], 2, 1, "#EF4444", "lock")
            ]
        };
    }

    private static DeckProfile BuildGaming()
    {
        var actions = new List<ActionDefinition>
        {
            Act("discord", "Discord", ActionKind.LaunchApp, "discord"),
            Act("steam", "Steam", ActionKind.LaunchApp, "steam"),
            Act("vol-up", "Vol+", ActionKind.VolumeUp),
            Act("vol-down", "Vol-", ActionKind.VolumeDown),
            Act("mute", "Mute", ActionKind.VolumeMute),
            Act("play", "Play/Pause", ActionKind.MediaPlayPause),
            Act("next", "Next", ActionKind.MediaNext),
            Act("prev", "Prev", ActionKind.MediaPrevious)
        };

        return new DeckProfile
        {
            Name = "Gaming",
            Actions = actions,
            Buttons =
            [
                Btn(actions[0], 0, 0, "#5865F2", "message"),
                Btn(actions[1], 0, 1, "#1B2838", "game"),
                Btn(actions[5], 0, 2, "#22C55E", "play"),
                Btn(actions[6], 1, 0, "#3B82F6", "skip-forward"),
                Btn(actions[7], 1, 1, "#3B82F6", "skip-back"),
                Btn(actions[2], 1, 2, "#64748B", "volume-up"),
                Btn(actions[3], 2, 0, "#64748B", "volume-down"),
                Btn(actions[4], 2, 1, "#EF4444", "volume-x")
            ]
        };
    }

    private static DeckProfile BuildMultimedia()
    {
        var actions = new List<ActionDefinition>
        {
            Act("play", "Play/Pause", ActionKind.MediaPlayPause),
            Act("next", "Next", ActionKind.MediaNext),
            Act("prev", "Prev", ActionKind.MediaPrevious),
            Act("vol-up", "Vol+", ActionKind.VolumeUp),
            Act("vol-down", "Vol-", ActionKind.VolumeDown),
            Act("mute", "Mute", ActionKind.VolumeMute),
            Act("yt", "YouTube", ActionKind.OpenUrl, "https://www.youtube.com"),
            Act("shot", "Screenshot", ActionKind.Screenshot)
        };

        return new DeckProfile
        {
            Name = "Multimedia",
            Actions = actions,
            Buttons =
            [
                Btn(actions[0], 0, 0, "#22C55E", "play"),
                Btn(actions[1], 0, 1, "#3B82F6", "skip-forward"),
                Btn(actions[2], 0, 2, "#3B82F6", "skip-back"),
                Btn(actions[3], 1, 0, "#64748B", "volume-up"),
                Btn(actions[4], 1, 1, "#64748B", "volume-down"),
                Btn(actions[5], 1, 2, "#EF4444", "volume-x"),
                Btn(actions[6], 2, 0, "#FF0000", "youtube"),
                Btn(actions[7], 2, 1, "#F59E0B", "camera")
            ]
        };
    }

    private static ActionDefinition Act(
        string id, string name, ActionKind kind, string? target = null, List<MacroStep>? steps = null) =>
        new()
        {
            Id = id,
            Name = name,
            Kind = kind,
            Target = target,
            MacroSteps = steps
        };

    private static DeckButton Btn(ActionDefinition action, int row, int col, string color, string icon) =>
        new()
        {
            Id = Guid.NewGuid().ToString("N"),
            Label = action.Name,
            ActionId = action.Id,
            Row = row,
            Col = col,
            Color = color,
            Icon = icon
        };

    public static AgentConfig CreateDefaultConfig()
    {
        var userProfile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        var projects = Path.Combine(userProfile, "Documents");

        return new AgentConfig
        {
            AllowedApps =
            [
                new AllowedApp { Id = "browser", Name = "Browser", PathOrShell = "browser" },
                new AllowedApp { Id = "vscode", Name = "VS Code", PathOrShell = "vscode" },
                new AllowedApp { Id = "discord", Name = "Discord", PathOrShell = "discord" },
                new AllowedApp { Id = "steam", Name = "Steam", PathOrShell = "steam" },
                new AllowedApp { Id = "terminal", Name = "Terminal", PathOrShell = "terminal" }
            ],
            AllowedUrls =
            [
                new AllowedUrl { Id = "youtube", Name = "YouTube", Url = "https://www.youtube.com" },
                new AllowedUrl { Id = "github", Name = "GitHub", Url = "https://github.com" }
            ],
            AllowedFolders =
            [
                new AllowedFolder { Id = "projects", Name = "Documents", Path = projects },
                new AllowedFolder { Id = "desktop", Name = "Desktop", Path = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory) }
            ]
        };
    }
}
