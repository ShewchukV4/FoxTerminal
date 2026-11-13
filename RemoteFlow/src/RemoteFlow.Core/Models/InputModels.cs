namespace RemoteFlow.Core.Models;

public enum MouseButton
{
    Left = 0,
    Right = 1,
    Middle = 2
}

public enum MouseButtonAction
{
    Down = 0,
    Up = 1,
    Click = 2,
    DoubleClick = 3
}

public sealed class MouseMoveEvent
{
    public float Dx { get; set; }
    public float Dy { get; set; }
}

public sealed class MouseButtonEvent
{
    public MouseButton Button { get; set; }
    public MouseButtonAction Action { get; set; }
}

public sealed class MouseScrollEvent
{
    public float Dx { get; set; }
    public float Dy { get; set; }
}

public sealed class MouseAbsoluteEvent
{
    public int MonitorIndex { get; set; }
    public float X { get; set; } // 0..1 normalized within monitor
    public float Y { get; set; }
}

public sealed class KeyboardEvent
{
    public string? Text { get; set; }
    public string? Key { get; set; } // Enter, Backspace, Escape, Tab, Ctrl, Alt, Shift, etc.
    public bool Down { get; set; } = true;
    public bool Ctrl { get; set; }
    public bool Alt { get; set; }
    public bool Shift { get; set; }
    public bool Win { get; set; }
}

public sealed class TouchpadSettings
{
    public float Sensitivity { get; set; } = 1.2f;
    public float Acceleration { get; set; } = 0.35f;
    public float ScrollSensitivity { get; set; } = 1.0f;
}
