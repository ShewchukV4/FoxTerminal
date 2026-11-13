using System.Runtime.InteropServices;
using RemoteFlow.Core.Models;
using RemoteFlow.Input.Native;

namespace RemoteFlow.Input;

public sealed class KeyboardService
{
    private readonly object _gate = new();
    private readonly HashSet<byte> _heldVk = [];

    public void TypeText(string text)
    {
        if (string.IsNullOrEmpty(text)) return;
        foreach (var ch in text)
        {
            // Skip control chars except tab/newline handled as keys elsewhere
            if (ch is '\r' or '\n')
            {
                TapVk(SendInputApi.VK_RETURN);
                continue;
            }
            if (ch == '\t')
            {
                TapVk(SendInputApi.VK_TAB);
                continue;
            }

            SendInputApi.Send(
                Unicode(ch, down: true),
                Unicode(ch, down: false));
        }
    }

    public void Handle(KeyboardEvent ev)
    {
        if (!string.IsNullOrEmpty(ev.Text))
        {
            TypeText(ev.Text);
            return;
        }

        if (string.IsNullOrWhiteSpace(ev.Key)) return;
        var key = ev.Key.Trim();

        // Chord shortcuts from mobile UI
        if (string.Equals(key, "Copy", StringComparison.OrdinalIgnoreCase))
        {
            Chord(SendInputApi.VK_CONTROL, (byte)'C');
            return;
        }
        if (string.Equals(key, "Paste", StringComparison.OrdinalIgnoreCase))
        {
            Chord(SendInputApi.VK_CONTROL, (byte)'V');
            return;
        }
        if (string.Equals(key, "Undo", StringComparison.OrdinalIgnoreCase))
        {
            Chord(SendInputApi.VK_CONTROL, (byte)'Z');
            return;
        }
        if (string.Equals(key, "SelectAll", StringComparison.OrdinalIgnoreCase))
        {
            Chord(SendInputApi.VK_CONTROL, (byte)'A');
            return;
        }
        if (string.Equals(key, "Cut", StringComparison.OrdinalIgnoreCase))
        {
            Chord(SendInputApi.VK_CONTROL, (byte)'X');
            return;
        }
        if (string.Equals(key, "Save", StringComparison.OrdinalIgnoreCase))
        {
            Chord(SendInputApi.VK_CONTROL, (byte)'S');
            return;
        }

        if (TryParseHotkey(key, out var mods, out var vk))
        {
            SendHotkey(mods.Ctrl || ev.Ctrl, mods.Alt || ev.Alt, mods.Shift || ev.Shift, mods.Win || ev.Win, vk);
            return;
        }

        if (!TryMapKey(key, out vk, out var extended)) return;

        if (ev.Ctrl || ev.Alt || ev.Shift || ev.Win)
        {
            SendHotkey(ev.Ctrl, ev.Alt, ev.Shift, ev.Win, vk);
            return;
        }

        if (ev.Down) KeyDown(vk, extended);
        else KeyUp(vk, extended);
    }

    public void SendHotkey(bool ctrl, bool alt, bool shift, bool win, byte vk)
    {
        var downs = new List<SendInputApi.INPUT>();
        var ups = new List<SendInputApi.INPUT>();
        if (ctrl) { downs.Add(Vk(SendInputApi.VK_CONTROL, true)); ups.Add(Vk(SendInputApi.VK_CONTROL, false)); }
        if (alt) { downs.Add(Vk(SendInputApi.VK_MENU, true)); ups.Add(Vk(SendInputApi.VK_MENU, false)); }
        if (shift) { downs.Add(Vk(SendInputApi.VK_SHIFT, true)); ups.Add(Vk(SendInputApi.VK_SHIFT, false)); }
        if (win) { downs.Add(Vk(SendInputApi.VK_LWIN, true)); ups.Add(Vk(SendInputApi.VK_LWIN, false)); }
        downs.Add(Vk(vk, true));
        ups.Insert(0, Vk(vk, false));
        SendInputApi.Send(downs.Concat(ups).ToArray());
    }

    public void TapVk(byte vk) => SendInputApi.Send(Vk(vk, true), Vk(vk, false));

    public void Media(byte vk) => TapVk(vk);

    public void ReleaseAll()
    {
        lock (_gate)
        {
            foreach (var vk in _heldVk.ToArray())
                KeyUp(vk, false);
            _heldVk.Clear();
            // Safety: release modifiers
            KeyUp(SendInputApi.VK_SHIFT, false);
            KeyUp(SendInputApi.VK_CONTROL, false);
            KeyUp(SendInputApi.VK_MENU, false);
            KeyUp(SendInputApi.VK_LWIN, false);
        }
    }

    private void KeyDown(byte vk, bool extended)
    {
        lock (_gate)
        {
            SendInputApi.Send(Vk(vk, true, extended));
            _heldVk.Add(vk);
        }
    }

    private void KeyUp(byte vk, bool extended)
    {
        lock (_gate)
        {
            SendInputApi.Send(Vk(vk, false, extended));
            _heldVk.Remove(vk);
        }
    }

    private static void Chord(byte modifier, byte key) =>
        SendInputApi.Send(Vk(modifier, true), Vk(key, true), Vk(key, false), Vk(modifier, false));

    private static SendInputApi.INPUT Unicode(char ch, bool down) => new()
    {
        type = SendInputApi.INPUT_KEYBOARD,
        U = new SendInputApi.InputUnion
        {
            ki = new SendInputApi.KEYBDINPUT
            {
                wVk = 0,
                wScan = ch,
                dwFlags = SendInputApi.KEYEVENTF_UNICODE | (down ? 0u : SendInputApi.KEYEVENTF_KEYUP)
            }
        }
    };

    private static SendInputApi.INPUT Vk(byte vk, bool down, bool extended = false) => new()
    {
        type = SendInputApi.INPUT_KEYBOARD,
        U = new SendInputApi.InputUnion
        {
            ki = new SendInputApi.KEYBDINPUT
            {
                wVk = vk,
                dwFlags = (down ? 0u : SendInputApi.KEYEVENTF_KEYUP)
                          | (extended ? SendInputApi.KEYEVENTF_EXTENDEDKEY : 0u)
            }
        }
    };

    private static bool TryMapKey(string key, out byte vk, out bool extended)
    {
        extended = false;
        vk = 0;
        switch (key.ToLowerInvariant())
        {
            case "enter": case "return": vk = SendInputApi.VK_RETURN; return true;
            case "backspace": vk = SendInputApi.VK_BACK; return true;
            case "escape": case "esc": vk = SendInputApi.VK_ESCAPE; return true;
            case "tab": vk = SendInputApi.VK_TAB; return true;
            case "ctrl": case "control": vk = SendInputApi.VK_CONTROL; return true;
            case "alt": vk = SendInputApi.VK_MENU; return true;
            case "shift": vk = SendInputApi.VK_SHIFT; return true;
            case "win": case "meta": case "cmd": vk = SendInputApi.VK_LWIN; return true;
            case "delete": case "del": vk = SendInputApi.VK_DELETE; extended = true; return true;
            case "home": vk = SendInputApi.VK_HOME; extended = true; return true;
            case "end": vk = SendInputApi.VK_END; extended = true; return true;
            case "pageup": vk = SendInputApi.VK_PRIOR; extended = true; return true;
            case "pagedown": vk = SendInputApi.VK_NEXT; extended = true; return true;
            case "arrowleft": case "left": vk = SendInputApi.VK_LEFT; extended = true; return true;
            case "arrowright": case "right": vk = SendInputApi.VK_RIGHT; extended = true; return true;
            case "arrowup": case "up": vk = SendInputApi.VK_UP; extended = true; return true;
            case "arrowdown": case "down": vk = SendInputApi.VK_DOWN; extended = true; return true;
            case "space": vk = 0x20; return true;
        }

        if (key.Length == 1)
        {
            var c = char.ToUpperInvariant(key[0]);
            if (c is >= 'A' and <= 'Z' or >= '0' and <= '9')
            {
                vk = (byte)c;
                return true;
            }
        }
        return false;
    }

    private readonly record struct Mods(bool Ctrl, bool Alt, bool Shift, bool Win);

    private static bool TryParseHotkey(string combo, out Mods mods, out byte vk)
    {
        mods = default;
        vk = 0;
        if (!combo.Contains('+')) return false;
        var parts = combo.Split('+', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (parts.Length < 2) return false;
        bool ctrl = false, alt = false, shift = false, win = false;
        string? keyPart = null;
        foreach (var p in parts)
        {
            switch (p.ToLowerInvariant())
            {
                case "ctrl": case "control": ctrl = true; break;
                case "alt": alt = true; break;
                case "shift": shift = true; break;
                case "win": case "meta": win = true; break;
                default: keyPart = p; break;
            }
        }
        if (keyPart is null || !TryMapKey(keyPart, out vk, out _)) return false;
        mods = new Mods(ctrl, alt, shift, win);
        return true;
    }
}
