namespace RemoteFlow.Core.Models;

/// <summary>
/// Allowlisted action kinds only. Arbitrary shell/code execution is intentionally absent.
/// </summary>
public enum ActionKind
{
    OpenUrl = 1,
    LaunchApp = 2,
    OpenFolder = 3,
    VolumeUp = 4,
    VolumeDown = 5,
    VolumeMute = 6,
    MediaPlayPause = 7,
    MediaNext = 8,
    MediaPrevious = 9,
    Screenshot = 10,
    LockWorkstation = 11,
    Hotkey = 12,
    Macro = 13
}

public sealed class ActionDefinition
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Name { get; set; } = string.Empty;
    public ActionKind Kind { get; set; }
    /// <summary>URL, app id, folder path, or hotkey combo depending on Kind.</summary>
    public string? Target { get; set; }
    public string? Icon { get; set; }
    public string? Color { get; set; }
    public List<MacroStep>? MacroSteps { get; set; }
}

public sealed class MacroStep
{
    public ActionKind Kind { get; set; }
    public string? Target { get; set; }
    public int DelayMs { get; set; }
}

public sealed class DeckButton
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Label { get; set; } = "Button";
    public string? Icon { get; set; }
    public string Color { get; set; } = "#7C5CFF";
    public int Row { get; set; }
    public int Col { get; set; }
    public int RowSpan { get; set; } = 1;
    public int ColSpan { get; set; } = 1;
    public string? FolderId { get; set; }
    public string ActionId { get; set; } = string.Empty;
}

public sealed class DeckFolder
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Name { get; set; } = "Folder";
    public string? Icon { get; set; }
    public string Color { get; set; } = "#3B82F6";
}

public sealed class DeckProfile
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Name { get; set; } = "Default";
    public List<DeckButton> Buttons { get; set; } = [];
    public List<DeckFolder> Folders { get; set; } = [];
    public List<ActionDefinition> Actions { get; set; } = [];
}

public sealed class DeckState
{
    public string ActiveProfileId { get; set; } = string.Empty;
    public List<DeckProfile> Profiles { get; set; } = [];
}
