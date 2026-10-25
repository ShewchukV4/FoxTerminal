using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Windows.Forms;

namespace FoxOs.Nodes {

    static class NativeWin {
        public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
        public const int WM_HOTKEY = 0x0312;
        public const int WM_NCHITTEST = 0x0084;
        public const int WM_MOUSEACTIVATE = 0x0021;
        public const int WM_DPICHANGED = 0x02E0;
        public const int MA_NOACTIVATE = 3;
        public const uint WM_SPAWN_WORKER = 0x052C;
        public const uint GW_HWNDPREV = 3;
        public const int HTCLIENT = 1;
        public const int HTTRANSPARENT = -1;
        public const int HOTKEY_ID = 0x4E01;
        public const int HOTKEY_PTT = 0x4E02;
        public static readonly IntPtr HWND_TOP = IntPtr.Zero;
        public static readonly IntPtr HWND_BOTTOM = new IntPtr(1);
        public const uint SWP_NOSIZE = 0x0001;
        public const uint SWP_NOMOVE = 0x0002;
        public const uint SWP_NOACTIVATE = 0x0010;
        public const uint SWP_SHOWWINDOW = 0x0040;

        public const uint MOD_ALT = 0x0001;
        public const uint MOD_CONTROL = 0x0002;
        public const uint MOD_SHIFT = 0x0004;
        public const uint MOD_WIN = 0x0008;

        public const uint SPI_GETCLIENTAREAANIMATION = 0x1042;

        [DllImport("user32.dll")]
        static extern bool SetProcessDpiAwarenessContext(IntPtr value);

        [DllImport("user32.dll")]
        public static extern bool RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk);

        [DllImport("user32.dll")]
        public static extern bool UnregisterHotKey(IntPtr hWnd, int id);

        [DllImport("user32.dll")]
        public static extern IntPtr GetForegroundWindow();

        [DllImport("user32.dll")]
        public static extern bool SetForegroundWindow(IntPtr hWnd);

        [DllImport("user32.dll")]
        public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

        [DllImport("user32.dll")]
        public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);

        [DllImport("user32.dll")]
        public static extern bool SystemParametersInfo(uint uiAction, uint uiParam, ref bool pvParam, uint fWinIni);

        [DllImport("user32.dll")]
        public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter,
            int x, int y, int cx, int cy, uint flags);

        [DllImport("user32.dll", CharSet = CharSet.Auto)]
        public static extern IntPtr FindWindow(string className, string windowName);

        [DllImport("user32.dll", CharSet = CharSet.Auto)]
        public static extern IntPtr FindWindowEx(IntPtr parent, IntPtr after,
            string className, string windowName);

        [DllImport("user32.dll")]
        public static extern IntPtr GetWindow(IntPtr hWnd, uint command);

        [DllImport("user32.dll")]
        public static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);

        [DllImport("user32.dll", CharSet = CharSet.Auto)]
        public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint msg,
            UIntPtr wParam, IntPtr lParam, uint flags, uint timeout, out UIntPtr result);

        [DllImport("user32.dll", SetLastError = true)]
        public static extern IntPtr SetParent(IntPtr child, IntPtr parent);

        [DllImport("user32.dll")]
        public static extern bool ScreenToClient(IntPtr hWnd, ref PointNative point);

        [DllImport("user32.dll")]
        public static extern bool IsWindowVisible(IntPtr hWnd);

        [DllImport("user32.dll")]
        public static extern bool GetWindowRect(IntPtr hWnd, out RectNative rect);

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        public static extern int GetWindowText(IntPtr hWnd,
            System.Text.StringBuilder text, int maxCount);

        [StructLayout(LayoutKind.Sequential)]
        public struct PointNative {
            public int X;
            public int Y;
            public PointNative(int x, int y) { X = x; Y = y; }
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct RectNative {
            public int Left;
            public int Top;
            public int Right;
            public int Bottom;
        }

        public static IntPtr FindInteractiveDesktopHost() {
            IntPtr progman = FindWindow("Progman", null);
            try {
                UIntPtr ignored;
                if (progman != IntPtr.Zero) {
                    SendMessageTimeout(progman, WM_SPAWN_WORKER, new UIntPtr(0xD),
                        IntPtr.Zero, 0, 1000, out ignored);
                }
            } catch { }

            IntPtr host = IntPtr.Zero;
            try {
                EnumWindows(delegate(IntPtr h, IntPtr l) {
                    IntPtr icons = FindWindowEx(h, IntPtr.Zero, "SHELLDLL_DefView", null);
                    if (icons != IntPtr.Zero) {
                        host = h;
                        return false;
                    }
                    return true;
                }, IntPtr.Zero);
            } catch { }
            return host != IntPtr.Zero ? host : progman;
        }

        public static IntPtr FindFoxOsWallpaperHost() {
            try {
                Process[] processes = Process.GetProcessesByName("foxos-live");
                if (processes == null || processes.Length == 0) return IntPtr.Zero;
                var ids = new System.Collections.Generic.HashSet<uint>();
                for (int i = 0; i < processes.Length; i++) {
                    ids.Add((uint)processes[i].Id);
                    processes[i].Dispose();
                }
                IntPtr found = IntPtr.Zero;
                long bestArea = 0;
                EnumWindows(delegate(IntPtr h, IntPtr l) {
                    uint pid;
                    GetWindowThreadProcessId(h, out pid);
                    if (!ids.Contains(pid) || !IsWindowVisible(h)) return true;
                    var text = new System.Text.StringBuilder(128);
                    GetWindowText(h, text, text.Capacity);
                    RectNative r;
                    if (!GetWindowRect(h, out r)) return true;
                    long area = (long)Math.Max(0, r.Right - r.Left) *
                        Math.Max(0, r.Bottom - r.Top);
                    if (text.ToString() == "FoxOS Live" || area > bestArea) {
                        found = h;
                        bestArea = area;
                    }
                    return true;
                }, IntPtr.Zero);
                return found;
            } catch {
                return IntPtr.Zero;
            }
        }

        public static void RestoreFocus(IntPtr prev) {
            if (prev == IntPtr.Zero) return;
            try {
                uint pid;
                uint me = GetWindowThreadProcessId(GetForegroundWindow(), out pid);
                uint dest = GetWindowThreadProcessId(prev, out pid);
                uint fg = GetWindowThreadProcessId(GetForegroundWindow(), out pid);
                if (fg != 0 && fg != me) AttachThreadInput(me, fg, true);
                if (dest != 0 && dest != me) AttachThreadInput(me, dest, true);
                SetForegroundWindow(prev);
                if (dest != 0 && dest != me) AttachThreadInput(me, dest, false);
                if (fg != 0 && fg != me) AttachThreadInput(me, fg, false);
            } catch { }
        }

        public static bool AnimationsEnabled() {
            try {
                bool on = true;
                SystemParametersInfo(SPI_GETCLIENTAREAANIMATION, 0, ref on, 0);
                return on;
            } catch {
                return true;
            }
        }

        public static void EnablePerMonitorDpi() {
            try {
                // DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2
                SetProcessDpiAwarenessContext(new IntPtr(-4));
            } catch { }
        }

        public static uint ModifiersFromHotkey(HotkeySpec hk) {
            uint m = 0;
            if (hk == null) return MOD_CONTROL | MOD_ALT;
            if (hk.ctrl) m |= MOD_CONTROL;
            if (hk.alt) m |= MOD_ALT;
            if (hk.shift) m |= MOD_SHIFT;
            if (hk.win) m |= MOD_WIN;
            return m;
        }

        public static uint VkFromHotkey(HotkeySpec hk) {
            if (hk == null || string.IsNullOrEmpty(hk.key)) return 0x20;
            string k = hk.key.Trim();
            if (k.Length == 1) return (uint)char.ToUpperInvariant(k[0]);
            if (string.Equals(k, "Space", StringComparison.OrdinalIgnoreCase)) return 0x20;
            if (string.Equals(k, "Enter", StringComparison.OrdinalIgnoreCase)) return 0x0D;
            if (string.Equals(k, "Tab", StringComparison.OrdinalIgnoreCase)) return 0x09;
            if (k.StartsWith("F", StringComparison.OrdinalIgnoreCase) && k.Length <= 3) {
                int n;
                if (int.TryParse(k.Substring(1), out n) && n >= 1 && n <= 24)
                    return (uint)(0x70 + n - 1);
            }
            Keys parsed;
            if (Enum.TryParse(k, true, out parsed)) return (uint)parsed;
            return 0x20;
        }

        public static string HotkeyLabel(HotkeySpec hk) {
            if (hk == null) return "Ctrl+Alt+Space";
            var parts = new System.Collections.Generic.List<string>();
            if (hk.ctrl) parts.Add("Ctrl");
            if (hk.alt) parts.Add("Alt");
            if (hk.shift) parts.Add("Shift");
            if (hk.win) parts.Add("Win");
            parts.Add(string.IsNullOrEmpty(hk.key) ? "Space" : hk.key);
            return string.Join("+", parts.ToArray());
        }
    }
}
