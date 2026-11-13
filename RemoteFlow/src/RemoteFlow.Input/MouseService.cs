using RemoteFlow.Core.Models;
using RemoteFlow.Input.Native;

namespace RemoteFlow.Input;

public sealed class MouseService
{
    private readonly object _gate = new();
    private readonly HashSet<MouseButton> _held = [];
    private TouchpadSettings _settings = new();

    public void UpdateSettings(TouchpadSettings settings) => _settings = settings;

    public void MoveRelative(float dx, float dy)
    {
        var sens = Math.Clamp(_settings.Sensitivity, 0.1f, 8f);
        var accel = Math.Clamp(_settings.Acceleration, 0f, 2f);
        var mag = MathF.Sqrt(dx * dx + dy * dy);
        var factor = sens * (1f + accel * mag);
        var mx = (int)MathF.Round(dx * factor);
        var my = (int)MathF.Round(dy * factor);
        if (mx == 0 && my == 0) return;

        SendInputApi.Send(new SendInputApi.INPUT
        {
            type = SendInputApi.INPUT_MOUSE,
            U = new SendInputApi.InputUnion
            {
                mi = new SendInputApi.MOUSEINPUT
                {
                    dx = mx,
                    dy = my,
                    dwFlags = SendInputApi.MOUSEEVENTF_MOVE
                }
            }
        });
    }

    public void MoveAbsoluteNormalized(MonitorInfo monitor, float x, float y)
    {
        x = Math.Clamp(x, 0f, 1f);
        y = Math.Clamp(y, 0f, 1f);
        var absX = monitor.X + (int)MathF.Round(x * (monitor.Width - 1));
        var absY = monitor.Y + (int)MathF.Round(y * (monitor.Height - 1));
        SendInputApi.SetCursorPos(absX, absY);
    }

    public void Button(MouseButton button, MouseButtonAction action)
    {
        lock (_gate)
        {
            switch (action)
            {
                case MouseButtonAction.Down:
                    SendButton(button, down: true);
                    _held.Add(button);
                    break;
                case MouseButtonAction.Up:
                    SendButton(button, down: false);
                    _held.Remove(button);
                    break;
                case MouseButtonAction.Click:
                    SendButton(button, down: true);
                    SendButton(button, down: false);
                    _held.Remove(button);
                    break;
                case MouseButtonAction.DoubleClick:
                    SendButton(button, down: true);
                    SendButton(button, down: false);
                    SendButton(button, down: true);
                    SendButton(button, down: false);
                    _held.Remove(button);
                    break;
            }
        }
    }

    public void Scroll(float dx, float dy)
    {
        var sens = Math.Clamp(_settings.ScrollSensitivity, 0.1f, 8f);
        var v = (int)MathF.Round(dy * -120f * sens);
        var h = (int)MathF.Round(dx * 120f * sens);
        if (v != 0)
        {
            SendInputApi.Send(new SendInputApi.INPUT
            {
                type = SendInputApi.INPUT_MOUSE,
                U = new SendInputApi.InputUnion
                {
                    mi = new SendInputApi.MOUSEINPUT
                    {
                        mouseData = unchecked((uint)v),
                        dwFlags = SendInputApi.MOUSEEVENTF_WHEEL
                    }
                }
            });
        }
        if (h != 0)
        {
            SendInputApi.Send(new SendInputApi.INPUT
            {
                type = SendInputApi.INPUT_MOUSE,
                U = new SendInputApi.InputUnion
                {
                    mi = new SendInputApi.MOUSEINPUT
                    {
                        mouseData = unchecked((uint)h),
                        dwFlags = SendInputApi.MOUSEEVENTF_HWHEEL
                    }
                }
            });
        }
    }

    public void ReleaseAll()
    {
        lock (_gate)
        {
            foreach (var b in _held.ToArray())
                SendButton(b, down: false);
            _held.Clear();
        }
    }

    private static void SendButton(MouseButton button, bool down)
    {
        uint flags = button switch
        {
            MouseButton.Left => down ? SendInputApi.MOUSEEVENTF_LEFTDOWN : SendInputApi.MOUSEEVENTF_LEFTUP,
            MouseButton.Right => down ? SendInputApi.MOUSEEVENTF_RIGHTDOWN : SendInputApi.MOUSEEVENTF_RIGHTUP,
            MouseButton.Middle => down ? SendInputApi.MOUSEEVENTF_MIDDLEDOWN : SendInputApi.MOUSEEVENTF_MIDDLEUP,
            _ => 0
        };
        if (flags == 0) return;
        SendInputApi.Send(new SendInputApi.INPUT
        {
            type = SendInputApi.INPUT_MOUSE,
            U = new SendInputApi.InputUnion { mi = new SendInputApi.MOUSEINPUT { dwFlags = flags } }
        });
    }
}
