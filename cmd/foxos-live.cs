using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Drawing.Text;
using System.IO;
using System.Management;
using System.Net.NetworkInformation;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Windows.Forms;

namespace FoxOsLive {
    static class Native {
        public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
        public const uint WM_SPAWN = 0x052C;
        public const int GWL_STYLE = -16;
        public const int GWL_EXSTYLE = -20;
        public const int WS_CHILD = 0x40000000;
        public const int WS_VISIBLE = 0x10000000;
        public const int WS_EX_NOACTIVATE = 0x08000000;
        public const int WS_EX_TOOLWINDOW = 0x00000080;
        public const int WS_EX_TRANSPARENT = 0x00000020;
        public const int WS_CAPTION = 0x00C00000;
        public const uint DWMWA_CLOAKED = 14;
        public const uint DWMWA_USE_IMMERSIVE_DARK_MODE = 20;
        public const uint DWMWA_WINDOW_CORNER_PREFERENCE = 33;
        public const uint DWMWA_BORDER_COLOR = 34;
        public const uint DWMWA_CAPTION_COLOR = 35;
        public const uint DWMWA_TEXT_COLOR = 36;
        public const uint DWMWA_COLOR_DEFAULT = 0xFFFFFFFF;
        public static readonly IntPtr HWND_BOTTOM = new IntPtr(1);

        [DllImport("user32.dll", CharSet = CharSet.Auto)]
        public static extern IntPtr FindWindow(string cls, string name);
        [DllImport("user32.dll", CharSet = CharSet.Auto)]
        public static extern IntPtr FindWindowEx(IntPtr parent, IntPtr after, string cls, string name);
        [DllImport("user32.dll")]
        public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr l);
        [DllImport("user32.dll", CharSet = CharSet.Auto)]
        public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint msg, UIntPtr wParam, IntPtr lParam, uint flags, uint timeout, out UIntPtr result);
        [DllImport("user32.dll", SetLastError = true)]
        public static extern IntPtr SetParent(IntPtr child, IntPtr parent);
        [DllImport("user32.dll")]
        public static extern int GetWindowLong(IntPtr hWnd, int nIndex);
        [DllImport("user32.dll")]
        public static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);
        [DllImport("user32.dll")]
        public static extern bool SetWindowPos(IntPtr hWnd, IntPtr after, int x, int y, int cx, int cy, uint flags);
        [DllImport("user32.dll")]
        public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
        [DllImport("user32.dll")]
        public static extern bool IsIconic(IntPtr hWnd);
        [DllImport("user32.dll")]
        public static extern bool IsZoomed(IntPtr hWnd);
        [DllImport("user32.dll")]
        public static extern bool GetWindowRect(IntPtr hWnd, out RECT r);
        [DllImport("user32.dll")]
        public static extern bool SetForegroundWindow(IntPtr hWnd);
        [DllImport("user32.dll")]
        public static extern bool AllowSetForegroundWindow(int pid);
        [DllImport("user32.dll")]
        public static extern IntPtr GetForegroundWindow();
        [DllImport("user32.dll")]
        public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
        [DllImport("user32.dll")]
        public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
        [DllImport("kernel32.dll")]
        public static extern uint GetCurrentThreadId();
        [DllImport("user32.dll")]
        public static extern int GetSystemMetrics(int nIndex);
        [DllImport("user32.dll")]
        public static extern bool GetClientRect(IntPtr hWnd, out RECT r);
        [DllImport("kernel32.dll")]
        public static extern bool GlobalMemoryStatusEx(ref MEMORYSTATUSEX buf);
        [DllImport("kernel32.dll")]
        public static extern bool GetSystemTimes(out long idle, out long kernel, out long user);
        [DllImport("user32.dll")]
        public static extern bool IsWindowVisible(IntPtr hWnd);
        [DllImport("user32.dll")]
        public static extern bool IsWindow(IntPtr hWnd);
        [DllImport("user32.dll")]
        public static extern IntPtr GetWindow(IntPtr hWnd, uint uCmd);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        public static extern int GetClassName(IntPtr hWnd, StringBuilder name, int max);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        public static extern int GetWindowText(IntPtr hWnd, StringBuilder name, int max);
        [DllImport("dwmapi.dll")]
        public static extern int DwmSetWindowAttribute(IntPtr hWnd, uint attr, ref uint value, uint size);
        [DllImport("dwmapi.dll")]
        public static extern int DwmGetWindowAttribute(IntPtr hWnd, uint attr, out uint value, uint size);
        [DllImport("user32.dll")]
        public static extern int SetWindowRgn(IntPtr hWnd, IntPtr hRgn, bool redraw);
        [DllImport("gdi32.dll")]
        public static extern IntPtr CreateRoundRectRgn(int l, int t, int r, int b, int w, int h);
        [DllImport("gdi32.dll")]
        public static extern bool DeleteObject(IntPtr obj);
        [DllImport("user32.dll")]
        public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr extra);
        [DllImport("user32.dll")]
        public static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);
        public struct LASTINPUTINFO { public uint cbSize; public uint dwTime; }
        public struct RECT { public int L, T, R, B; }
        public struct MEMORYSTATUSEX {
            public uint Length;
            public uint MemoryLoad;
            public ulong TotalPhys;
            public ulong AvailPhys;
            public ulong TotalPageFile;
            public ulong AvailPageFile;
            public ulong TotalVirtual;
            public ulong AvailVirtual;
            public ulong AvailExtendedVirtual;
        }
    }

    sealed class State {
        public Color Night = Color.FromArgb(11, 15, 26);
        public Color Accent = Color.FromArgb(220, 122, 20);
        public Color Accent2 = Color.FromArgb(240, 160, 60);
        public string DockStyle = "pill";
        public string DockPos = "bottom";
        public string DockSize = "normal";
        public bool DockHide;
        public string DockWins = "titles";
        public string DockTray = "full";
        public bool DockWidgets = true;
        public bool DockHome = true;
        public string PinCursor = "";
        public string PinZen = "";
        public string PinTerm = "";
        public Color[] Flag = null;
        public string FoxPath = "";
        public string CmdDir = "";
        public string Theme = "";
        public string User = "";
        public int Rig = 4;
        // "overlay": a tool window pinned at HWND_BOTTOM above the desktop (desk prompt clickable).
        // "behind":  parented into Explorer's WorkerW, under the icon layer (true wallpaper; prompt unreachable).
        public string Wall = "overlay";
        public bool Shell;
        // FOXSTYLE system look: window corners (default|square|small|round),
        // Windows taskbar rounding (px, -1 = untouched) and floating inset (px).
        public string WinCorner = "default";
        // Exact corner radius in px for SetWindowRgn (-1 = DWM modes only).
        public int WinRadius = -1;
        public int TbRadius = -1;
        public int TbInset = 0;
        // FoxOS dock (the taskbar when shell mode is on): corner px, edge gap px, glass alpha 0-100 (-1 = default)
        public int DockRadius = -1;
        public int DockPad = -1;
        public int DockAlpha = -1;
        public int DockBarH = -1;   // panel height px (from FOXSTYLE Chrome → Height)
        public int DockBlur = -1;   // 0=off, 1..40 acrylic strength
        public string WallKind = "glass"; // glass|neon|metal|fabric|none
        public int WallRain = 30;         // 0..80 column density
        public int WallStrength = 60;     // 0..100 texture intensity
        public int WallScale = 50;        // 0..100 grid spacing
        public int WallWeight = 40;       // 0..100 uniform line thickness
        public int WallVeil = 50;         // 0..100 accent wash
        public bool FoxGlow;
        public int FoxGlowStrength = 70;  // 0..100 pulse amplitude
        public int FoxGlowSpeed = 50;     // 0..100 pulse rate
        public DateTime Stamp;
    }

    static class Json {
        public static string Grab(string json, string key) {
            var m = Regex.Match(json, "\"" + key + "\"\\s*:\\s*\"([^\"]*)\"");
            if (m.Success) return m.Groups[1].Value.Replace("\\\\", "\\");
            // also accept bare numbers / true|false (ConvertTo-Json sometimes omits quotes)
            m = Regex.Match(json, "\"" + key + "\"\\s*:\\s*(-?\\d+(?:\\.\\d+)?|true|false)", RegexOptions.IgnoreCase);
            return m.Success ? m.Groups[1].Value : "";
        }
        static Color Hex(string h, Color fallback) {
            if (string.IsNullOrEmpty(h)) return fallback;
            h = h.Trim().TrimStart('#');
            if (h.Length != 6) return fallback;
            try {
                return Color.FromArgb(
                    Convert.ToInt32(h.Substring(0, 2), 16),
                    Convert.ToInt32(h.Substring(2, 2), 16),
                    Convert.ToInt32(h.Substring(4, 2), 16));
            } catch { return fallback; }
        }
        public static State Load(string path, State prev) {
            var s = prev ?? new State();
            if (string.IsNullOrEmpty(path) || !File.Exists(path)) return s;
            try {
                var json = File.ReadAllText(path);
                s.Night = Hex(Grab(json, "night"), s.Night);
                s.Accent = Hex(Grab(json, "accent"), s.Accent);
                s.Accent2 = Hex(Grab(json, "accent2"), s.Accent2);
                var fox = Grab(json, "fox");
                if (!string.IsNullOrEmpty(fox)) s.FoxPath = fox;
                var cmd = Grab(json, "cmd");
                if (!string.IsNullOrEmpty(cmd)) s.CmdDir = cmd;
                var theme = Grab(json, "theme");
                if (!string.IsNullOrEmpty(theme)) s.Theme = theme;
                var user = Grab(json, "user");
                if (!string.IsNullOrEmpty(user)) s.User = user;
                var flag = Grab(json, "flag");
                if (!string.IsNullOrEmpty(flag)) {
                    string[] parts = flag.Split(new[] { ',', ';', ' ' }, StringSplitOptions.RemoveEmptyEntries);
                    var list = new List<Color>();
                    for (int i = 0; i < parts.Length; i++) {
                        Color c = Hex(parts[i], Color.Empty);
                        if (c.A > 0) list.Add(c);
                    }
                    s.Flag = list.Count > 0 ? list.ToArray() : null;
                } else {
                    s.Flag = null;
                }
                var rig = Grab(json, "rig");
                int rv;
                if (int.TryParse(rig, out rv) && rv >= 1 && rv <= 5) s.Rig = rv;
                var wall = Grab(json, "wall");
                if (wall == "behind" || wall == "overlay") s.Wall = wall;
                var shell = Grab(json, "shell");
                s.Shell = (shell == "on" || shell == "true" || shell == "1");
                var wc = Grab(json, "winCorner");
                if (wc == "default" || wc == "square" || wc == "small" || wc == "round") s.WinCorner = wc;
                int tbv;
                if (int.TryParse(Grab(json, "winRadius"), out tbv)) s.WinRadius = Math.Max(-1, Math.Min(48, tbv));
                if (int.TryParse(Grab(json, "tbRadius"), out tbv)) s.TbRadius = Math.Max(-1, Math.Min(40, tbv));
                if (int.TryParse(Grab(json, "tbInset"), out tbv)) s.TbInset = Math.Max(0, Math.Min(24, tbv));
                if (int.TryParse(Grab(json, "dockRadius"), out tbv)) s.DockRadius = Math.Max(-1, Math.Min(60, tbv));
                if (int.TryParse(Grab(json, "dockPad"), out tbv)) s.DockPad = Math.Max(-1, Math.Min(40, tbv));
                if (int.TryParse(Grab(json, "dockAlpha"), out tbv)) s.DockAlpha = Math.Max(-1, Math.Min(100, tbv));
                if (int.TryParse(Grab(json, "dockBarH"), out tbv)) s.DockBarH = Math.Max(-1, Math.Min(96, tbv));
                if (int.TryParse(Grab(json, "dockBlur"), out tbv)) s.DockBlur = Math.Max(-1, Math.Min(40, tbv));
                var wk = Grab(json, "wallKind");
                if (wk == "glass" || wk == "neon" || wk == "metal" || wk == "fabric" || wk == "none") s.WallKind = wk;
                if (int.TryParse(Grab(json, "wallRain"), out tbv)) s.WallRain = Math.Max(0, Math.Min(80, tbv));
                if (int.TryParse(Grab(json, "wallStrength"), out tbv)) s.WallStrength = Math.Max(0, Math.Min(100, tbv));
                if (int.TryParse(Grab(json, "wallScale"), out tbv)) s.WallScale = Math.Max(0, Math.Min(100, tbv));
                if (int.TryParse(Grab(json, "wallWeight"), out tbv)) s.WallWeight = Math.Max(0, Math.Min(100, tbv));
                if (int.TryParse(Grab(json, "wallVeil"), out tbv)) s.WallVeil = Math.Max(0, Math.Min(100, tbv));
                var fg = Grab(json, "foxGlow");
                s.FoxGlow = (fg == "on" || fg == "true" || fg == "1");
                if (int.TryParse(Grab(json, "foxGlowStrength"), out tbv)) s.FoxGlowStrength = Math.Max(0, Math.Min(100, tbv));
                if (int.TryParse(Grab(json, "foxGlowSpeed"), out tbv)) s.FoxGlowSpeed = Math.Max(0, Math.Min(100, tbv));
                var ds = Grab(json, "dockStyle");
                if (ds == "rail" || ds == "pill" || ds == "glass" || ds == "slim") s.DockStyle = ds;
                var dp = Grab(json, "dockPos");
                if (dp == "top" || dp == "bottom") s.DockPos = dp;
                var dz = Grab(json, "dockSize");
                if (dz == "compact" || dz == "normal" || dz == "large") s.DockSize = dz;
                var dh = Grab(json, "dockHide");
                s.DockHide = (dh == "on" || dh == "true" || dh == "1");
                var dw = Grab(json, "dockWins");
                if (dw == "titles" || dw == "dots" || dw == "off") s.DockWins = dw;
                var dt = Grab(json, "dockTray");
                if (dt == "full" || dt == "clock" || dt == "off") s.DockTray = dt;
                var dwg = Grab(json, "dockWidgets");
                s.DockWidgets = !(dwg == "off" || dwg == "false" || dwg == "0");
                var dhm = Grab(json, "dockHome");
                s.DockHome = !(dhm == "off" || dhm == "false" || dhm == "0");
                var pc = Grab(json, "pinCursor");
                if (!string.IsNullOrEmpty(pc)) s.PinCursor = pc;
                var pz = Grab(json, "pinZen");
                if (!string.IsNullOrEmpty(pz)) s.PinZen = pz;
                var pt = Grab(json, "pinTerm");
                if (!string.IsNullOrEmpty(pt)) s.PinTerm = pt;
                s.Stamp = File.GetLastWriteTimeUtc(path);
            } catch { }
            return s;
        }
    }

    sealed class Rig {
        public string User = "";
        public string Host = "";
        public string Os = "";
        public string Cpu = "";
        public string Gpu = "";
        public string Net = "";
        public string Disp = "";
        public long RamUsed;
        public long RamTotal;
        public long DiskUsed;
        public long DiskTotal;
        public string DiskName = "C";
        public int CpuLoad;
        public int BatPct = -1;
        public bool OnAc;
        public bool HasBattery;
        public bool Charging;
        public TimeSpan Up;
        DateTime lastLive;
        DateTime lastSlow;
        DateTime lastNet;
        DateTime bootUtc;
        long prevIdle;
        long prevKernel;
        long prevUser;
        bool cpuTimesReady;

        public void Pulse() {
            DateTime n = DateTime.UtcNow;
            if ((n - lastLive).TotalMilliseconds >= 1200) RefreshLive();
            if (lastSlow == DateTime.MinValue) RefreshSlow();
            else if ((n - lastSlow).TotalSeconds >= 40)
                ThreadPool.QueueUserWorkItem(delegate { RefreshSlow(); });
        }

        static string WmiFirst(string cls, string prop) {
            try {
                using (var search = new ManagementObjectSearcher("SELECT " + prop + " FROM " + cls)) {
                    foreach (ManagementObject mo in search.Get()) {
                        object v = mo[prop];
                        if (v == null) continue;
                        string t = v.ToString().Trim();
                        if (t.Length > 0) return t;
                    }
                }
            } catch { }
            return "";
        }

        static string CleanChip(string s) {
            if (string.IsNullOrEmpty(s)) return "";
            s = Regex.Replace(s, @"\((R|TM|C)\)", "", RegexOptions.IgnoreCase);
            s = Regex.Replace(s, @"(?i)\s*(with|w/)\s+Radeon(\s+Graphics)?", "");
            s = Regex.Replace(s, @"\s+", " ").Trim();
            return s;
        }

        void RefreshSlow() {
            try {
                Host = Environment.MachineName;
                User = Environment.UserName;
                string cap = WmiFirst("Win32_OperatingSystem", "Caption");
                string arch = WmiFirst("Win32_OperatingSystem", "OSArchitecture");
                if (cap.Length == 0) cap = Environment.OSVersion.ToString();
                Os = (cap + " " + arch).Trim();
                Os = Os.Replace("Microsoft ", "");
                Cpu = CleanChip(WmiFirst("Win32_Processor", "Name"));
                if (Cpu.Length == 0) {
                    try {
                        object reg = Microsoft.Win32.Registry.GetValue(
                            @"HKEY_LOCAL_MACHINE\HARDWARE\DESCRIPTION\System\CentralProcessor\0",
                            "ProcessorNameString", "");
                        Cpu = CleanChip(reg == null ? "" : reg.ToString());
                    } catch { }
                }
                Gpu = "";
                try {
                    using (var search = new ManagementObjectSearcher("SELECT Name FROM Win32_VideoController")) {
                        foreach (ManagementObject mo in search.Get()) {
                            object v = mo["Name"];
                            if (v == null) continue;
                            string n = v.ToString().Trim();
                            if (n.Length == 0) continue;
                            if (n.IndexOf("Basic", StringComparison.OrdinalIgnoreCase) >= 0) continue;
                            if (n.IndexOf("Remote", StringComparison.OrdinalIgnoreCase) >= 0) continue;
                            Gpu = CleanChip(n);
                            break;
                        }
                    }
                } catch { }
                string bootRaw = WmiFirst("Win32_OperatingSystem", "LastBootUpTime");
                if (bootRaw.Length > 0) {
                    try { bootUtc = ManagementDateTimeConverter.ToDateTime(bootRaw).ToUniversalTime(); } catch { }
                }
                try {
                    Rectangle b = Screen.PrimaryScreen.Bounds;
                    Disp = b.Width + "x" + b.Height;
                } catch { Disp = ""; }
                string sys = Environment.GetEnvironmentVariable("SystemDrive");
                if (string.IsNullOrEmpty(sys)) sys = "C:";
                DiskName = sys.TrimEnd('\\', ':');
            } catch { }
            lastSlow = DateTime.UtcNow;
        }

        void RefreshLive() {
            try {
                var mem = new Native.MEMORYSTATUSEX();
                mem.Length = (uint)Marshal.SizeOf(typeof(Native.MEMORYSTATUSEX));
                if (Native.GlobalMemoryStatusEx(ref mem)) {
                    RamTotal = (long)mem.TotalPhys;
                    RamUsed = (long)(mem.TotalPhys - mem.AvailPhys);
                }
                string sys = Environment.GetEnvironmentVariable("SystemDrive");
                if (string.IsNullOrEmpty(sys)) sys = "C:";
                try {
                    var di = new DriveInfo(sys);
                    DiskTotal = di.TotalSize;
                    DiskUsed = di.TotalSize - di.AvailableFreeSpace;
                    DiskName = di.Name.TrimEnd('\\', ':');
                } catch { }
                long idle, kernel, user;
                if (Native.GetSystemTimes(out idle, out kernel, out user)) {
                    if (cpuTimesReady) {
                        long tot = (kernel - prevKernel) + (user - prevUser);
                        long idld = (idle - prevIdle);
                        if (tot > 0) {
                            int load = (int)((tot - idld) * 100 / tot);
                            if (load < 0) load = 0;
                            if (load > 100) load = 100;
                            CpuLoad = load;
                        }
                    }
                    prevIdle = idle;
                    prevKernel = kernel;
                    prevUser = user;
                    cpuTimesReady = true;
                }
                if (bootUtc != DateTime.MinValue) Up = DateTime.UtcNow - bootUtc;
                else Up = TimeSpan.FromMilliseconds((uint)Environment.TickCount);
                try {
                    PowerStatus ps = SystemInformation.PowerStatus;
                    HasBattery = (ps.BatteryChargeStatus & BatteryChargeStatus.NoSystemBattery) == 0;
                    OnAc = ps.PowerLineStatus == PowerLineStatus.Online;
                    Charging = (ps.BatteryChargeStatus & BatteryChargeStatus.Charging) != 0;
                    float bp = ps.BatteryLifePercent;
                    if (HasBattery && bp >= 0f && bp <= 1.01f)
                        BatPct = (int)Math.Round(bp * 100.0);
                    else
                        BatPct = -1;
                } catch { }
                if (lastNet == DateTime.MinValue || (DateTime.UtcNow - lastNet).TotalSeconds >= 8) {
                    lastNet = DateTime.UtcNow;
                    Net = "";
                    try {
                        foreach (NetworkInterface nic in NetworkInterface.GetAllNetworkInterfaces()) {
                            if (nic.OperationalStatus != OperationalStatus.Up) continue;
                            if (nic.NetworkInterfaceType == NetworkInterfaceType.Loopback) continue;
                            if (nic.NetworkInterfaceType == NetworkInterfaceType.Tunnel) continue;
                            if (nic.NetworkInterfaceType == NetworkInterfaceType.Wireless80211) {
                                Net = "Wi-Fi  " + nic.Name;
                                break;
                            }
                            if (Net.Length == 0) Net = nic.Name;
                        }
                    } catch { }
                }
            } catch { }
            lastLive = DateTime.UtcNow;
        }

        public static string Gb(long bytes) {
            double g = bytes / (1024.0 * 1024.0 * 1024.0);
            if (g >= 10) return g.ToString("0") + "G";
            return g.ToString("0.0") + "G";
        }

        public static string UpText(TimeSpan t) {
            if (t.TotalDays >= 1) return ((int)t.TotalDays).ToString() + "d " + t.Hours.ToString() + "h";
            if (t.TotalHours >= 1) return ((int)t.TotalHours).ToString() + "h " + t.Minutes.ToString() + "m";
            return t.Minutes.ToString() + "m";
        }

        public static string Bar(double t, int n) {
            if (n < 1) return "";
            if (t < 0) t = 0;
            if (t > 1) t = 1;
            int f = (int)Math.Round(t * n);
            char[] a = new char[n];
            for (int i = 0; i < n; i++) a[i] = i < f ? '\u2588' : '\u2591';
            return new string(a);
        }

        public static string Clip(string s, int n) {
            if (string.IsNullOrEmpty(s)) return "";
            if (s.Length <= n) return s;
            return s.Substring(0, n - 2) + "..";
        }
    }

    sealed class Wall : Form {
        const string Glyphs = " .,:;irsXA253hMHGS#9B&@";
        const string RainSetDefault = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ$%#@&*+=:.irsX";
        const string RainSetNotebook = "-_=.,'`~|;:/\\ilI ";
        readonly string statePath;
        string rainSet = RainSetDefault;


        readonly string logPath;
        readonly Random rng = new Random(7);
        State state;
        int cellW = 11;
        int cellH = 20;
        int cols;
        int rows;
        float[] head;
        float[] speed;
        int[] trail;
        byte[][] grid;
        Bitmap[][] rainGlyphs;
        StringFormat rainFmt;
        DateTime lastBottom;
        DateTime lastFgCheck;
        DateTime lastCoveredPaint;
        bool fgCovered;
        Bitmap foxBmp;
        string foxKey = "";
        int markX;
        int markW;
        Font font;
        SolidBrush[] rainBrushes;
        System.Windows.Forms.Timer timer;
        DateTime lastPoll;
        DateTime lastChrome;
        string typed = "";
        string hint = "";
        DateTime hintUntil;
        bool promptFocus;
        Font promptFont;
        Font specFont;
        Font specTitle;
        Font specSmall;
        Font specHuge;
        Font deskClock;
        DateTime lastDesk;
        string[] deskLines = new string[0];
        Bitmap deskCache;
        Bitmap rigCache;
        int deskCacheKey = int.MinValue;
        int rigCacheKey = int.MinValue;
        readonly Rig rig = new Rig();
        HelpBoard helpWin;

        DateTime lastIdleCheck;
        string toastText = "";
        DateTime toastUntil;
        bool sessionLocked;
        string lockUser = "";
        bool behind;
        readonly List<ShellBar> docks = new List<ShellBar>();
        AltTabBoard altTab;
        DeskWidgets widgets;
        HomeLaunch homeWin;
        bool homeShown;
        bool hadShell;
        DateTime pinsStamp;
        System.Windows.Forms.Timer reqTimer;
        float foxBoot; // 0..1 entrance
        Color morphFromNight;
        float morphT = 1f; // 1 = idle
        const float MorphMs = 640f;
        WifiBoard wifiWin;
        BluetoothBoard btWin;
        BrightBoard brightWin;
        VolumeBoard volWin;
        BatteryBoard batWin;
        ReminderBoard calWin;
        MediaStrip mediaStrip;

        static readonly string[] Allowed = {
            "sw","default","orange","fox","noir","dnote","notebook",
            "arthas","pride","shader","foxos","foxlook",
            "ytm","yt","sp","dj","term","sites","youtube","ff","help","rig","note",
            "ser","foxhelp","foxlife","home","lock","settings","mirror",
            "wifi","bt","bright","vol","bat","cal","calendar","reminders","off","shutdown"
        };

        public Wall(string path) {
            statePath = path;
            logPath = Path.Combine(Path.GetDirectoryName(path) ?? ".", "live.log");
            state = Json.Load(path, null);
            Text = "FoxOS Live";
            FormBorderStyle = FormBorderStyle.None;
            ShowInTaskbar = false;
            StartPosition = FormStartPosition.Manual;
            BackColor = state.Night;
            DoubleBuffered = true;
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint | ControlStyles.OptimizedDoubleBuffer, true);

            int w = Native.GetSystemMetrics(78);
            int h = Native.GetSystemMetrics(79);
            if (w < 800 || h < 600) {
                w = Screen.PrimaryScreen.Bounds.Width;
                h = Screen.PrimaryScreen.Bounds.Height;
            }
            Bounds = new Rectangle(0, 0, w, h);

            font = new Font("Consolas", 16f, FontStyle.Bold, GraphicsUnit.Pixel);
            promptFont = new Font("Consolas", 18f, FontStyle.Bold, GraphicsUnit.Pixel);
            specFont = new Font("Consolas", 15f, FontStyle.Regular, GraphicsUnit.Pixel);
            specTitle = new Font("Consolas", 26f, FontStyle.Bold, GraphicsUnit.Pixel);
            specSmall = new Font("Consolas", 11f, FontStyle.Regular, GraphicsUnit.Pixel);
            specHuge = new Font("Consolas", 34f, FontStyle.Bold, GraphicsUnit.Pixel);
            deskClock = new Font("Consolas", 52f, FontStyle.Bold, GraphicsUnit.Pixel);
            KeyPreview = true;
            using (var tmp = new Bitmap(32, 32))
            using (var g = Graphics.FromImage(tmp)) {
                var sz = g.MeasureString("M", font, PointF.Empty, StringFormat.GenericTypographic);
                cellW = Math.Max(13, (int)Math.Ceiling(sz.Width) + 2);
                cellH = Math.Max(18, (int)Math.Ceiling(sz.Height) + 3);
            }
            rainFmt = (StringFormat)StringFormat.GenericTypographic.Clone();
            cols = Math.Max(40, w / cellW);
            rows = Math.Max(20, h / cellH);
            InitRain();
            RebuildBrushes();
            RebuildFox(true);
            foxBoot = 0f;
            morphFromNight = state.Night;
            morphT = 1f;

            timer = new System.Windows.Forms.Timer();
            timer.Interval = 100;
            timer.Tick += delegate {
                bool covered = !promptFocus && ForegroundIsCovered();
                bool animating = foxBoot < 1f || morphT < 1f;
                bool altBusy = altTab != null && !altTab.IsDisposed && altTab.Visible;
                int want = (animating || altBusy) ? 16 : (promptFocus ? 70 : (covered ? 400 : 100));
                if (timer.Interval != want) timer.Interval = want;
                if (foxBoot < 1f) {
                    foxBoot += 0.045f;
                    if (foxBoot > 1f) foxBoot = 1f;
                }
                if (morphT < 1f) {
                    morphT += 16f / MorphMs;
                    if (morphT > 1f) morphT = 1f;
                }
                Poll();
                LoadToast();
                LoadLockFlag();
                CheckIdleLock();
                LoadDesk();
                // System look (corners / borders / taskbar) must run even when apps cover the desk.
                PaintChrome(false);
                if (covered && !animating && !altBusy) {
                    if ((DateTime.UtcNow - lastCoveredPaint).TotalMilliseconds > 1000) {
                        lastCoveredPaint = DateTime.UtcNow;
                        Invalidate();
                    }
                    return;
                }
                Step();
                rig.Pulse();
                PaintChrome(false);
                EnsureDock();
                if (!behind && !state.Shell && !promptFocus && (DateTime.UtcNow - lastBottom).TotalMilliseconds > 2200) {
                    lastBottom = DateTime.UtcNow;
                    Native.SetWindowPos(Handle, Native.HWND_BOTTOM, 0, 0, 0, 0, 0x0013);
                }
                Invalidate();
            };
            // Separate fast poll so Alt+Tab / desk requests aren't stuck on the
            // 400ms "covered" paint interval (felt like a broken slide).
            reqTimer = new System.Windows.Forms.Timer();
            reqTimer.Interval = 33;
            reqTimer.Tick += delegate { PeekHelpRequest(); };
            Shown += delegate {
                Attach();
                EnsureMediaStrip();
                timer.Start();
                reqTimer.Start();
            };
        }

        void EnsureMediaStrip() {
            try {
                string dir = Path.GetDirectoryName(statePath);
                if (mediaStrip == null || mediaStrip.IsDisposed) {
                    mediaStrip = new MediaStrip(dir);
                }
                mediaStrip.Recolor(state.Night, state.Accent, state.Accent2);
            } catch (Exception ex) { Log("media strip: " + ex.Message); }
        }


        string ThemeName() {
            return string.IsNullOrEmpty(state.Theme) ? "" : state.Theme;
        }
        bool ThemeIs(string name) {
            return string.Equals(ThemeName(), name, StringComparison.OrdinalIgnoreCase);
        }

        void Log(string msg) {
            try { File.AppendAllText(logPath, DateTime.Now.ToString("HH:mm:ss.fff") + " " + msg + Environment.NewLine); } catch { }
        }

        protected override CreateParams CreateParams {
            get {
                var cp = base.CreateParams;
                cp.ExStyle |= Native.WS_EX_TOOLWINDOW;
                return cp;
            }
        }

        protected override bool ShowWithoutActivation { get { return true; } }

        protected override void OnFormClosing(FormClosingEventArgs e) {
            e.Cancel = true;
        }

        protected override void WndProc(ref Message m) {
            if (m.Msg == 0x0010 || m.Msg == 0x0016) return;
            if (m.Msg == 0x0084) {
                if (sessionLocked) {
                    m.Result = new IntPtr(-1);
                    return;
                }
                long lp = m.LParam.ToInt64();
                int sx = (short)(lp & 0xFFFF);
                int sy = (short)((lp >> 16) & 0xFFFF);
                Point pt = PointToClient(new Point(sx, sy));
                if (PromptRect().Contains(pt)) {
                    m.Result = new IntPtr(1);
                    return;
                }
                m.Result = new IntPtr(-1);
                return;
            }
            base.WndProc(ref m);
        }

        Rectangle PromptRect() {
            int barH = 42;
            int barW;
            int x;
            int y;
            if (foxBmp != null) {
                int foxLeft = (Width - foxBmp.Width) / 2;
                int foxTop = (Height - foxBmp.Height) / 2;
                barW = markW > 120 ? markW : (int)(foxBmp.Width * 0.62);
                if (barW > foxBmp.Width) barW = foxBmp.Width;
                x = foxLeft + (foxBmp.Width - barW) / 2;
                y = foxTop + (int)(foxBmp.Height * 0.72) + 38;
            } else {
                barW = 420;
                x = (Width - barW) / 2;
                y = Height / 2 + 36;
            }
            if (y + barH > Height - 16) y = Height - barH - 16;
            return new Rectangle(x, y, barW, barH);
        }

        void BlurPrompt() {
            promptFocus = false;
            Native.SetWindowPos(Handle, Native.HWND_BOTTOM, 0, 0, 0, 0, 0x0013);
        }

        protected override void OnMouseDown(MouseEventArgs e) {
            if (sessionLocked) return;
            if (PromptRect().Contains(e.Location)) {
                promptFocus = true;
                Focus();
                Activate();
            } else {
                BlurPrompt();
            }
            base.OnMouseDown(e);
        }

        protected override void OnDeactivate(EventArgs e) {
            BlurPrompt();
            base.OnDeactivate(e);
        }

        protected override bool ProcessCmdKey(ref Message msg, Keys keyData) {
            if (sessionLocked) return true;
            if (!promptFocus) return base.ProcessCmdKey(ref msg, keyData);
            if (keyData == Keys.Enter) { RunPrompt(); return true; }
            if (keyData == Keys.Escape) { typed = ""; BlurPrompt(); return true; }
            if (keyData == Keys.Back) {
                if (typed.Length > 0) typed = typed.Substring(0, typed.Length - 1);
                return true;
            }
            return base.ProcessCmdKey(ref msg, keyData);
        }

        protected override void OnKeyPress(KeyPressEventArgs e) {
            if (promptFocus && !char.IsControl(e.KeyChar) && typed.Length < 80) {
                typed += e.KeyChar;
                e.Handled = true;
            }
            base.OnKeyPress(e);
        }

        void SetHint(string text) {
            hint = text ?? "";
            hintUntil = DateTime.UtcNow.AddSeconds(3);
        }

        void RunPrompt() {
            string line = (typed ?? "").Trim();
            typed = "";
            if (line.Length == 0) return;
            if (line.Equals("help", StringComparison.OrdinalIgnoreCase)) {
                SetHint("foxhelp   ser cats   note hello");
                return;
            }
            if (line.Equals("foxhelp", StringComparison.OrdinalIgnoreCase)) {
                ShowHelp();
                return;
            }
            string verb = line.Split(' ')[0].ToLowerInvariant();
            if (verb == "off" || verb == "shutdown") {
                ConfirmPowerOff();
                return;
            }
            if (verb == "term") {
                string rest = line.Length > 4 ? line.Substring(4).Trim() : "";
                string dir = state.CmdDir;
                if (string.IsNullOrEmpty(dir)) dir = Path.GetDirectoryName(statePath);
                if (GhosttyTalk.Run(rest, dir)) SetHint(rest.Length > 0 ? rest : "term");
                else SetHint("ghostty missing");
                return;
            }
            bool ok = false;
            for (int i = 0; i < Allowed.Length; i++) {
                if (Allowed[i] == verb) { ok = true; break; }
            }
            if (!ok) {
                SetHint("not on this prompt");
                return;
            }
            string cmdDir = state.CmdDir;
            if (string.IsNullOrEmpty(cmdDir)) cmdDir = Path.GetDirectoryName(statePath);
            string runner = Path.Combine(cmdDir, "foxos-deskcmd.ps1");
            if (!File.Exists(runner)) {
                SetHint("runner missing");
                return;
            }
            try {
                var psi = new ProcessStartInfo();
                psi.FileName = "powershell.exe";
                psi.Arguments = "-NoProfile -ExecutionPolicy Bypass -File \"" + runner + "\" \"" + line.Replace("\"", "") + "\"";
                psi.UseShellExecute = false;
                psi.CreateNoWindow = true;
                psi.WorkingDirectory = cmdDir;
                Process.Start(psi);
                SetHint(line);
            } catch {
                SetHint("failed");
            }
        }

        void ShowWinBars() {
            try {
                IntPtr t = Native.FindWindow("Shell_TrayWnd", null);
                if (t != IntPtr.Zero) Native.ShowWindow(t, 5);
                Native.EnumWindows(delegate(IntPtr h, IntPtr l) {
                    var cls = new StringBuilder(40);
                    Native.GetClassName(h, cls, cls.Capacity);
                    if (cls.ToString() == "Shell_SecondaryTrayWnd") Native.ShowWindow(h, 5);
                    return true;
                }, IntPtr.Zero);
            } catch { }
        }

        void EnsureDock() {
            if (!state.Shell) {
                bool had = hadShell || docks.Count > 0;
                KillDocks();
                if (had) ShowWinBars();
                hadShell = false;
                // Tear down shell-only chrome, but never dispose AltTab here —
                // EnsureDock runs every tick and was killing the slide mid-animation.
                if (widgets != null) {
                    try { widgets.Dispose(); } catch { }
                    widgets = null;
                }
                if (homeWin != null) {
                    try { homeWin.Dispose(); } catch { }
                    homeWin = null;
                }
                return;
            }
            hadShell = true;
            int want = Screen.AllScreens.Length;
            if (docks.Count == want) {
                bool ok = true;
                for (int i = 0; i < docks.Count; i++) {
                    if (docks[i] == null || docks[i].IsDisposed) { ok = false; break; }
                }
                if (ok) {
                    string pp = PinStore.PathIn(Path.GetDirectoryName(statePath) ?? "");
                    DateTime st = File.Exists(pp) ? File.GetLastWriteTimeUtc(pp) : DateTime.MinValue;
                    if (st != pinsStamp) {
                        pinsStamp = st;
                        for (int i = 0; i < docks.Count; i++) docks[i].ReloadPins();
                    }
                    EnsureChrome();
                    return;
                }
            }
            KillDocks();
            string dir = Path.GetDirectoryName(statePath) ?? "";
            IntPtr self = IntPtr.Zero;
            try { self = Handle; } catch { }
            foreach (Screen sc in Screen.AllScreens) {
                var bar = new ShellBar(state, RunDeskLine, self, dir, sc);
                bar.Show();
                docks.Add(bar);
            }
            string p2 = PinStore.PathIn(dir);
            pinsStamp = File.Exists(p2) ? File.GetLastWriteTimeUtc(p2) : DateTime.MinValue;
            EnsureChrome();
        }

        void KillDocks() {
            for (int i = 0; i < docks.Count; i++) {
                try { docks[i].Kill(); } catch { }
                try { docks[i].Dispose(); } catch { }
            }
            docks.Clear();
        }

        void EnsureChrome() {
            if (!state.Shell) { KillChrome(); return; }
            string dir = Path.GetDirectoryName(statePath) ?? "";
            if (state.DockWidgets) {
                if (widgets == null || widgets.IsDisposed) {
                    widgets = new DeskWidgets(state, dir, Screen.PrimaryScreen);
                    widgets.Show();
                } else widgets.Recolor();
            } else if (widgets != null) {
                try { widgets.Dispose(); } catch { }
                widgets = null;
            }
            if (state.DockHome && !homeShown) {
                homeShown = true;
                ShowHome();
            }
        }

        void KillChrome() {
            if (widgets != null) {
                try { widgets.Dispose(); } catch { }
                widgets = null;
            }
            if (homeWin != null) {
                try { homeWin.Dispose(); } catch { }
                homeWin = null;
            }
            // AltTabBoard is independent of shell mode — keep it alive
        }

        void ShowHome() {
            ShowHome(null);
        }

        void ShowHome(string focusTab) {
            try {
                if (homeWin != null && !homeWin.IsDisposed) {
                    homeWin.Recolor(state.Night, state.Accent);
                    if (!string.IsNullOrEmpty(focusTab)) homeWin.FocusTab(focusTab);
                    try {
                        homeWin.TopMost = true;
                        homeWin.Show();
                        homeWin.Activate();
                        homeWin.BringToFront();
                        Native.SetForegroundWindow(homeWin.Handle);
                    } catch {
                        try { homeWin.Show(); homeWin.Activate(); } catch { }
                    }
                    return;
                }
                homeWin = new HomeLaunch(state.Night, state.Accent, state.Accent2, state.FoxPath, state.Theme, RunDeskLine, FillDeskPrompt);
                homeWin.FormClosed += delegate { homeWin = null; };
                if (!string.IsNullOrEmpty(focusTab)) homeWin.FocusTab(focusTab);
                homeWin.TopMost = true;
                homeWin.Show();
                homeWin.Activate();
                homeWin.BringToFront();
                Native.SetForegroundWindow(homeWin.Handle);
            } catch (Exception ex) {
                try {
                    string dir = Path.GetDirectoryName(statePath) ?? "";
                    File.AppendAllText(Path.Combine(dir, "home.crash.log"),
                        DateTime.Now.ToString("o") + "\r\n" + ex + "\r\n\r\n");
                } catch { }
                homeWin = null;
            }
        }

        void ShowAltTab(bool forward) {
            if (altTab == null || altTab.IsDisposed) {
                altTab = new AltTabBoard(state.Night, state.Accent, delegate(IntPtr h) {
                    Native.ShowWindow(h, 9);
                    Native.ShowWindow(h, 5);
                    Native.SetForegroundWindow(h);
                });
            } else altTab.Recolor(state.Night, state.Accent);
            altTab.ShowCycle(forward);
        }

        void Attach() {
            if (state.Shell) {
                behind = false;
                Rectangle sb = Screen.PrimaryScreen.Bounds;
                Bounds = sb;
                Native.SetWindowPos(Handle, Native.HWND_BOTTOM, sb.X, sb.Y, sb.Width, sb.Height, 0x0010);
                Visible = true;
                Opacity = 1;
                Log("shell " + sb.Width + "x" + sb.Height);
                lastChrome = DateTime.MinValue;
                PaintChrome(false);
                EnsureDock();
                return;
            }
            if (state.Wall == "behind" && AttachBehind()) return;
            Rectangle wa = Screen.PrimaryScreen.WorkingArea;
            Bounds = wa;
            Native.SetWindowPos(Handle, Native.HWND_BOTTOM, wa.X, wa.Y, wa.Width, wa.Height, 0x0010);
            Visible = true;
            Opacity = 1;
            BringToFront();
            SendToBack();
            Log("overlay " + wa.X + "," + wa.Y + " " + wa.Width + "x" + wa.Height);
            lastChrome = DateTime.MinValue;
            PaintChrome(false);
        }

        // Live-wallpaper mode: the form becomes a child of the WorkerW Explorer spawns between the
        // wallpaper and the icon layer. Win+D, "show desktop" and z-order fights no longer touch it.
        // The icon layer sits on top, so mouse and keyboard never reach the desk prompt here.
        bool AttachBehind() {
            IntPtr worker = IntPtr.Zero;
            try { worker = FindWorker(); } catch { }
            if (worker == IntPtr.Zero) { Log("behind: no WorkerW, overlay fallback"); return false; }
            Rectangle sb = Screen.PrimaryScreen.Bounds;
            Rectangle vs = SystemInformation.VirtualScreen;
            IntPtr prev = Native.SetParent(Handle, worker);
            if (prev == IntPtr.Zero && Marshal.GetLastWin32Error() != 0) {
                Log("behind: SetParent failed, overlay fallback");
                return false;
            }
            behind = true;
            promptFocus = false;
            // Child coordinates are relative to WorkerW, which spans the virtual screen.
            Native.SetWindowPos(Handle, IntPtr.Zero, sb.X - vs.X, sb.Y - vs.Y, sb.Width, sb.Height, 0x0014);
            Visible = true;
            Opacity = 1;
            Log("behind " + sb.Width + "x" + sb.Height + " in WorkerW " + worker.ToInt64().ToString("X"));
            lastChrome = DateTime.MinValue;
            PaintChrome(false);
            return true;
        }

        static uint ColorRef(Color c) {
            return (uint)(c.R | (c.G << 8) | (c.B << 16));
        }

        public static bool SkipChromeClass(string cls) {
            if (string.IsNullOrEmpty(cls)) return true;
            switch (cls) {
                case "Progman":
                case "WorkerW":
                case "Shell_TrayWnd":
                case "Shell_SecondaryTrayWnd":
                case "NotifyIconOverflowWindow":
                case "NotifyIconOverflowWindowButton":
                case "ForegroundStaging":
                case "ApplicationManager_DesktopShellWindow":
                case "DummyDWMListenerWindow":
                    return true;
            }
            return false;
        }

        // Windows taskbar: rounded / floating via window region (works without shell mode).
        readonly Dictionary<long, string> tbShape = new Dictionary<long, string>();
        // Per-window rounded corners (true continuum in px — DWM alone only has 3 modes).
        readonly Dictionary<long, string> winShape = new Dictionary<long, string>();

        void ShapeWindows(bool reset) {
            try {
                int rad = state.WinRadius;
                bool off = reset || rad < 0;
                IntPtr self = IntPtr.Zero;
                try { self = Handle; } catch { }
                var stale = new List<long>(winShape.Keys);
                Native.EnumWindows(delegate(IntPtr h, IntPtr l) {
                    if (h == self) return true;
                    if (!reset && !Native.IsWindowVisible(h)) return true;
                    int ex = Native.GetWindowLong(h, Native.GWL_EXSTYLE);
                    if ((ex & Native.WS_EX_TOOLWINDOW) != 0) return true;
                    int st = Native.GetWindowLong(h, Native.GWL_STYLE);
                    bool hasCaption = (st & Native.WS_CAPTION) == Native.WS_CAPTION;
                    bool thick = (st & 0x00040000) != 0;
                    if (!hasCaption && !thick) return true;
                    var sb = new StringBuilder(64);
                    Native.GetClassName(h, sb, sb.Capacity);
                    string cls = sb.ToString();
                    if (SkipChromeClass(cls)) return true;
                    // Don't carve regions into our own FoxOS chrome.
                    if (cls.IndexOf("WindowsForms10", StringComparison.Ordinal) >= 0) {
                        var tb = new StringBuilder(80);
                        Native.GetWindowText(h, tb, tb.Capacity);
                        if (tb.ToString().StartsWith("FoxOS", StringComparison.OrdinalIgnoreCase)) return true;
                    }
                    long key = h.ToInt64();
                    stale.Remove(key);
                    bool zoom = false;
                    try { zoom = Native.IsZoomed(h) || Native.IsIconic(h); } catch { }
                    if (off || zoom || rad == 0) {
                        string prevOff;
                        if (winShape.TryGetValue(key, out prevOff) && prevOff == "off") return true;
                        winShape[key] = "off";
                        Native.SetWindowRgn(h, IntPtr.Zero, true);
                        return true;
                    }
                    Native.RECT rc;
                    if (!Native.GetWindowRect(h, out rc)) return true;
                    int w = rc.R - rc.L, ht = rc.B - rc.T;
                    if (w < 80 || ht < 40) return true;
                    string stamp = w + "x" + ht + ":" + rad;
                    string prev;
                    if (winShape.TryGetValue(key, out prev) && prev == stamp) return true;
                    winShape[key] = stamp;
                    int ew = Math.Max(2, rad * 2);
                    IntPtr rgn = Native.CreateRoundRectRgn(0, 0, w + 1, ht + 1, ew, ew);
                    if (rgn != IntPtr.Zero) {
                        if (Native.SetWindowRgn(h, rgn, true) == 0) Native.DeleteObject(rgn);
                    }
                    return true;
                }, IntPtr.Zero);
                for (int i = 0; i < stale.Count; i++) winShape.Remove(stale[i]);
            } catch { }
        }

        void ShapeTaskbars(bool reset) {
            try {
                var bars = new List<IntPtr>();
                IntPtr main = Native.FindWindow("Shell_TrayWnd", null);
                if (main != IntPtr.Zero) bars.Add(main);
                Native.EnumWindows(delegate(IntPtr h, IntPtr l) {
                    var cls = new StringBuilder(40);
                    Native.GetClassName(h, cls, cls.Capacity);
                    if (cls.ToString() == "Shell_SecondaryTrayWnd") bars.Add(h);
                    return true;
                }, IntPtr.Zero);
                int r = state.TbRadius;
                bool off = reset || state.Shell || r < 0;
                for (int i = 0; i < bars.Count; i++) {
                    IntPtr h = bars[i];
                    Native.RECT rc;
                    if (!Native.GetWindowRect(h, out rc)) continue;
                    int w = rc.R - rc.L, ht = rc.B - rc.T;
                    if (w <= 0 || ht <= 0) continue;
                    string key = off ? "off" : (w + "x" + ht + ":" + r + ":" + state.TbInset);
                    string prev;
                    if (tbShape.TryGetValue(h.ToInt64(), out prev) && prev == key) continue;
                    tbShape[h.ToInt64()] = key;
                    if (off) {
                        Native.SetWindowRgn(h, IntPtr.Zero, true);
                        continue;
                    }
                    int ins = state.TbInset;
                    int ew = Math.Max(1, r * 2);
                    IntPtr rgn = Native.CreateRoundRectRgn(ins, ins > 0 ? ins / 2 + 1 : 0, w - ins + 1, ht - (ins > 0 ? ins / 2 + 1 : 0) + 1, ew, ew);
                    if (rgn != IntPtr.Zero) {
                        if (Native.SetWindowRgn(h, rgn, true) == 0) Native.DeleteObject(rgn);
                    }
                }
            } catch { }
        }

        void PaintChrome(bool reset) {
            int glowSp = Math.Max(0, Math.Min(100, state.FoxGlowSpeed));
            int chromeMs = state.FoxGlow ? Math.Max(60, 220 - glowSp) : 1500;
            if (!reset && (DateTime.UtcNow - lastChrome).TotalMilliseconds < chromeMs) return;
            lastChrome = DateTime.UtcNow;
            ShapeTaskbars(reset);
            ShapeWindows(reset);
            uint corner = 0;
            if (!reset) {
                // DWM fallback (3 modes). Exact px continuum is ShapeWindows above.
                if (state.WinRadius == 0) corner = 1;
                else if (state.WinRadius > 0 && state.WinRadius <= 8) corner = 3;
                else if (state.WinRadius > 8) corner = 2;
                else {
                    switch (state.WinCorner) {
                        case "square": corner = 1; break;
                        case "round": corner = 2; break;
                        case "small": corner = 3; break;
                        default: corner = 0; break;
                    }
                }
            }
            uint cap = reset ? Native.DWMWA_COLOR_DEFAULT : ColorRef(state.Night);
            Color borderC = state.Accent;
            if (!reset && state.FoxGlow) {
                // Labs FoxGlow: pulse window border (strength + speed from FOXSTYLE)
                double amp = Math.Max(0, Math.Min(100, state.FoxGlowStrength)) / 100.0;
                double period = 900.0 - glowSp * 7.0; // 900ms..200ms
                if (period < 160) period = 160;
                double pulse = (1.0 - amp * 0.5) + amp * 0.5 * Math.Sin(Environment.TickCount / period);
                borderC = Color.FromArgb(
                    (int)Math.Min(255, state.Accent.R * pulse + state.Accent2.R * (1 - pulse)),
                    (int)Math.Min(255, state.Accent.G * pulse + state.Accent2.G * (1 - pulse)),
                    (int)Math.Min(255, state.Accent.B * pulse + state.Accent2.B * (1 - pulse)));
            }
            uint border = reset ? Native.DWMWA_COLOR_DEFAULT : ColorRef(borderC);
            uint text = reset ? Native.DWMWA_COLOR_DEFAULT : ColorRef(Color.FromArgb(230, 234, 240));
            uint dark = reset ? 0u : 1u;
            IntPtr self = IntPtr.Zero;
            try { self = Handle; } catch { }
            Native.EnumWindows(delegate(IntPtr h, IntPtr l) {
                if (h == self) return true;
                if (!reset && !Native.IsWindowVisible(h)) return true;
                int ex = Native.GetWindowLong(h, Native.GWL_EXSTYLE);
                if ((ex & Native.WS_EX_TOOLWINDOW) != 0) return true;
                int st = Native.GetWindowLong(h, Native.GWL_STYLE);
                bool hasCaption = (st & Native.WS_CAPTION) == Native.WS_CAPTION;
                bool thick = (st & 0x00040000) != 0; // WS_THICKFRAME (frameless Electron etc.)
                if (!hasCaption && !thick) return true;
                var sb = new StringBuilder(64);
                Native.GetClassName(h, sb, sb.Capacity);
                if (SkipChromeClass(sb.ToString())) return true;
                if (!reset) {
                    uint cloaked;
                    if (Native.DwmGetWindowAttribute(h, Native.DWMWA_CLOAKED, out cloaked, 4) == 0 && cloaked != 0) return true;
                }
                // Real window corners across the whole system (Windows 11).
                Native.DwmSetWindowAttribute(h, Native.DWMWA_WINDOW_CORNER_PREFERENCE, ref corner, 4);
                if (!hasCaption) return true;
                Native.DwmSetWindowAttribute(h, Native.DWMWA_USE_IMMERSIVE_DARK_MODE, ref dark, 4);
                Native.DwmSetWindowAttribute(h, Native.DWMWA_CAPTION_COLOR, ref cap, 4);
                Native.DwmSetWindowAttribute(h, Native.DWMWA_BORDER_COLOR, ref border, 4);
                Native.DwmSetWindowAttribute(h, Native.DWMWA_TEXT_COLOR, ref text, 4);
                return true;
            }, IntPtr.Zero);
        }

        static IntPtr FindWorker() {
            IntPtr progman = Native.FindWindow("Progman", null);
            UIntPtr ignored;
            Native.SendMessageTimeout(progman, Native.WM_SPAWN, new UIntPtr(0xD), IntPtr.Zero, 0, 1000, out ignored);
            Native.SendMessageTimeout(progman, Native.WM_SPAWN, new UIntPtr(0xD), new IntPtr(1), 0, 1000, out ignored);

            IntPtr child = IntPtr.Zero;
            while (true) {
                child = Native.FindWindowEx(progman, child, "WorkerW", null);
                if (child == IntPtr.Zero) break;
                IntPtr def = Native.FindWindowEx(child, IntPtr.Zero, "SHELLDLL_DefView", null);
                if (def == IntPtr.Zero) return child;
            }

            IntPtr found = IntPtr.Zero;
            Native.EnumWindows(delegate(IntPtr h, IntPtr l) {
                IntPtr def = Native.FindWindowEx(h, IntPtr.Zero, "SHELLDLL_DefView", null);
                if (def != IntPtr.Zero) {
                    IntPtr w = Native.FindWindowEx(IntPtr.Zero, h, "WorkerW", null);
                    if (w != IntPtr.Zero) found = w;
                }
                return true;
            }, IntPtr.Zero);
            return found != IntPtr.Zero ? found : progman;
        }

        void InitRain() {
            head = new float[cols];
            speed = new float[cols];
            trail = new int[cols];
            grid = new byte[cols][];
            // WallRain 0..80 → fraction of active columns; WallKind=none → almost off
            double dens = state.WallRain / 80.0;
            if (string.Equals(state.WallKind, "none", StringComparison.OrdinalIgnoreCase)) dens = 0;
            else if (string.Equals(state.WallKind, "neon", StringComparison.OrdinalIgnoreCase)) dens = Math.Min(1.0, dens + 0.15);
            for (int c = 0; c < cols; c++) {
                bool on = dens > 0.02 && (rng.NextDouble() < dens);
                head[c] = on ? (float)(rng.NextDouble() * rows) : -200f;
                speed[c] = on ? (0.18f + (float)rng.NextDouble() * 0.55f) : 0f;
                trail[c] = on ? (6 + rng.Next(4, 8 + state.WallRain / 6)) : 0;
                grid[c] = new byte[rows];
                for (int r = 0; r < rows; r++) grid[c][r] = (byte)rng.Next(rainSet.Length);
            }
        }

        Color MixNight(Color ink, double t) {
            return Color.FromArgb(
                (int)(state.Night.R * (1 - t) + ink.R * t),
                (int)(state.Night.G * (1 - t) + ink.G * t),
                (int)(state.Night.B * (1 - t) + ink.B * t));
        }

        bool IsNotebookTheme() { return ThemeIs("notebook"); }

        void SyncRainSet() {
            string next = IsNotebookTheme() ? RainSetNotebook : RainSetDefault;
            if (string.Equals(rainSet, next, StringComparison.Ordinal)) return;
            rainSet = next;
            if (grid != null) {
                for (int c = 0; c < cols; c++) {
                    if (grid[c] == null) continue;
                    for (int r = 0; r < rows; r++) {
                        grid[c][r] = (byte)rng.Next(rainSet.Length);
                    }
                }
            }
        }

        void RebuildBrushes() {
            SyncRainSet();
            if (rainBrushes != null) foreach (var b in rainBrushes) if (b != null) b.Dispose();
            rainBrushes = new SolidBrush[6];
            for (int i = 0; i < 6; i++) {
                double tt = 0.28 + 0.72 * (i / 5.0);
                Color ink = state.Accent;
                if (state.Flag != null && state.Flag.Length > 0) {
                    ink = state.Flag[i % state.Flag.Length];
                    tt = 0.42 + 0.50 * (i / 5.0);
                }
                if (IsNotebookTheme() && (state.Flag == null || state.Flag.Length == 0)) {
                    Color sepia = Color.FromArgb(196, 165, 116);
                    ink = Color.FromArgb(
                        (ink.R + sepia.R) / 2,
                        (ink.G + sepia.G) / 2,
                        (ink.B + sepia.B) / 2);
                }
                rainBrushes[i] = new SolidBrush(MixNight(ink, tt));
            }
            BackColor = state.Night;
            RebuildGlyphs();
        }

        void DrawNotebookPaper(Graphics g) {
            int step = Math.Max(22, cellH);
            using (var rule = new Pen(Color.FromArgb(48, 170, 185, 210), 1f)) {
                for (int y = step; y < Height; y += step) {
                    g.DrawLine(rule, 0, y, Width, y);
                }
            }
            int mx = Math.Max(56, Width / 13);
            using (var margin = new Pen(Color.FromArgb(170, state.Accent), 2.2f)) {
                g.DrawLine(margin, mx, 0, mx, Height);
            }
            using (var wash = new SolidBrush(Color.FromArgb(18, 232, 217, 192))) {
                g.FillRectangle(wash, ClientRectangle);
            }
        }

        void DropGlyphs() {
            if (rainGlyphs == null) return;
            for (int b = 0; b < rainGlyphs.Length; b++) {
                if (rainGlyphs[b] == null) continue;
                for (int i = 0; i < rainGlyphs[b].Length; i++) {
                    if (rainGlyphs[b][i] != null) rainGlyphs[b][i].Dispose();
                }
            }
            rainGlyphs = null;
        }

        void RebuildGlyphs() {
            DropGlyphs();
            if (rainBrushes == null || font == null) return;
            var fmt = rainFmt ?? StringFormat.GenericTypographic;
            rainGlyphs = new Bitmap[6][];
            for (int b = 0; b < 6; b++) {
                rainGlyphs[b] = new Bitmap[rainSet.Length];
                for (int i = 0; i < rainSet.Length; i++) {
                    var bmp = new Bitmap(cellW, cellH, PixelFormat.Format32bppPArgb);
                    using (var g = Graphics.FromImage(bmp)) {
                        g.Clear(Color.Transparent);
                        g.TextRenderingHint = TextRenderingHint.SingleBitPerPixelGridFit;
                        g.DrawString(rainSet.Substring(i, 1), font, rainBrushes[b], 0, 0, fmt);
                    }
                    rainGlyphs[b][i] = bmp;
                }
            }
        }

        Color FoxInk(int row, int rowCount, double lum, bool accented) {
            if (state.Flag != null && state.Flag.Length > 0) {
                int span = Math.Max(1, rowCount - 1);
                int idx = (int)Math.Floor((row / (double)span) * (state.Flag.Length - 1) + 0.001);
                if (idx < 0) idx = 0;
                if (idx >= state.Flag.Length) idx = state.Flag.Length - 1;
                Color c = state.Flag[idx];
                double t = 0.72 + 0.28 * lum;
                return Color.FromArgb(
                    Math.Min(255, (int)(c.R * t)),
                    Math.Min(255, (int)(c.G * t)),
                    Math.Min(255, (int)(c.B * t)));
            }
            if (accented) {
                double t = 0.62 + 0.38 * lum;
                return Color.FromArgb(
                    Math.Min(255, (int)(state.Accent.R * t)),
                    Math.Min(255, (int)(state.Accent.G * t)),
                    Math.Min(255, (int)(state.Accent.B * t)));
            }
            int v = Math.Min(255, (int)(210 + 45 * lum));
            return Color.FromArgb(v, v, v);
        }

        void RebuildFox(bool force) {
            string flagKey = "";
            if (state.Flag != null) {
                for (int i = 0; i < state.Flag.Length; i++) flagKey += state.Flag[i].ToArgb().ToString() + ",";
            }
            string key = (state.FoxPath ?? "") + "|" + state.Accent.ToArgb() + "|" + flagKey + "|" + cols;
            if (!force && key == foxKey) return;
            foxKey = key;
            if (foxBmp != null) { foxBmp.Dispose(); foxBmp = null; }
            if (string.IsNullOrEmpty(state.FoxPath) || !File.Exists(state.FoxPath)) return;
            Image src = null;
            try { src = Image.FromFile(state.FoxPath); } catch { return; }
            try {
                int foxCols = Math.Min(cols - 6, Math.Max(56, (int)(cols * 0.38)));
                int foxRows = Math.Max(16, (int)Math.Round(foxCols * (src.Height / (double)src.Width) * (cellW / (double)cellH)));
                using (var scaled = new Bitmap(foxCols, foxRows)) {
                    using (var g = Graphics.FromImage(scaled)) {
                        g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                        g.Clear(Color.Black);
                        g.DrawImage(src, 0, 0, foxCols, foxRows);
                    }
                    foxBmp = new Bitmap(foxCols * cellW, foxRows * cellH, PixelFormat.Format32bppArgb);
                    int[] rowL = new int[foxRows];
                    int[] rowR = new int[foxRows];
                    for (int i = 0; i < foxRows; i++) { rowL[i] = int.MaxValue; rowR[i] = 0; }
                    using (var g = Graphics.FromImage(foxBmp)) {
                        g.Clear(Color.Transparent);
                        g.TextRenderingHint = TextRenderingHint.AntiAliasGridFit;
                        var fmt = StringFormat.GenericTypographic;
                        for (int y = 0; y < foxRows; y++) {
                            for (int x = 0; x < foxCols; x++) {
                                Color p = scaled.GetPixel(x, y);
                                if (p.A < 16 || (p.R < 18 && p.G < 18 && p.B < 18)) continue;
                                double lum = (p.R * 0.299 + p.G * 0.587 + p.B * 0.114) / 255.0;
                                int idx = (int)Math.Round(lum * (Glyphs.Length - 1));
                                if (idx < 1) continue;
                                bool accented = (p.R > p.G + 8 && p.R > p.B + 8 && p.R > 50)
                                    || (p.B > p.R && lum > 0.25 && lum < 0.85);
                                bool striped = state.Flag != null && state.Flag.Length > 0;
                                if (!accented && !striped && lum <= 0.45) continue;
                                Color ink = FoxInk(y, foxRows, lum, accented);
                                using (var br = new SolidBrush(ink)) {
                                    g.DrawString(Glyphs[idx].ToString(), font, br, x * cellW, y * cellH, fmt);
                                }
                                int px = x * cellW;
                                if (px < rowL[y]) rowL[y] = px;
                                if (px + cellW > rowR[y]) rowR[y] = px + cellW;
                            }
                        }
                    }
                    int last = -1;
                    for (int y = foxRows - 1; y >= 0; y--) {
                        if (rowL[y] != int.MaxValue) { last = y; break; }
                    }
                    int first = last;
                    if (last >= 0) {
                        for (int y = last - 1; y >= 0; y--) {
                            if (rowL[y] == int.MaxValue) break;
                            first = y;
                        }
                        int mkL = int.MaxValue, mkR = 0;
                        for (int y = first; y <= last; y++) {
                            if (rowL[y] < mkL) mkL = rowL[y];
                            if (rowR[y] > mkR) mkR = rowR[y];
                        }
                        markX = mkL;
                        markW = Math.Max(1, mkR - mkL);
                    } else {
                        markX = 0;
                        markW = foxBmp.Width;
                    }
                }
                Log("fox ascii " + foxCols + "x" + foxRows + " mark " + markX + "+" + markW);
            } finally { src.Dispose(); }
        }

        // Request files other processes drop in the foxos dir (deskcmd, FoxHotkeys Win keys):
        //   help.req    open the command picker
        //   prompt.req  focus the desk prompt (Win+R / Win+S)
        //   desk.req    run one desk line, e.g. "term edit" (Win+E) or "term settings" (Win+I)
        void PeekHelpRequest() {
            string dir = Path.GetDirectoryName(statePath);
            if (string.IsNullOrEmpty(dir)) return;
            string help = Path.Combine(dir, "help.req");
            if (File.Exists(help)) {
                try { File.Delete(help); } catch { }
                ShowHelp();
                return;
            }
            string prompt = Path.Combine(dir, "prompt.req");
            if (File.Exists(prompt)) {
                try { File.Delete(prompt); } catch { }
                FocusPromptFromRequest();
                return;
            }
            string desk = Path.Combine(dir, "desk.req");
            if (File.Exists(desk)) {
                string line = "";
                try { line = File.ReadAllText(desk).Trim(); } catch { }
                try { File.Delete(desk); } catch { }
                if (line.Length > 0 && line.Length <= 80 && !sessionLocked) RunDeskLine(line);
                return;
            }
            string at = Path.Combine(dir, "alttab.req");
            if (File.Exists(at)) {
                string raw = "";
                try { raw = File.ReadAllText(at).Trim(); } catch { }
                try { File.Delete(at); } catch { }
                if (!sessionLocked) ShowAltTab(raw != "back");
                return;
            }
            string atClose = Path.Combine(dir, "alttab-close.req");
            if (File.Exists(atClose)) {
                try { File.Delete(atClose); } catch { }
                if (!sessionLocked && altTab != null && !altTab.IsDisposed && altTab.Visible) {
                    altTab.CloseSelected();
                }
                return;
            }
            string hm = Path.Combine(dir, "home.req");
            if (File.Exists(hm)) {
                string homeFocus = "";
                try { homeFocus = (File.ReadAllText(hm) ?? "").Trim(); } catch { }
                try { File.Delete(hm); } catch { }
                if (!sessionLocked) {
                    string tab = homeFocus;
                    if (string.Equals(tab, "1", StringComparison.OrdinalIgnoreCase)) tab = null;
                    ShowHome(tab);
                }
                return;
            }
            string wifi = Path.Combine(dir, "wifi.req");
            if (File.Exists(wifi)) {
                try { File.Delete(wifi); } catch { }
                if (!sessionLocked) ShowWifi();
                return;
            }
            string bt = Path.Combine(dir, "bt.req");
            if (File.Exists(bt)) {
                try { File.Delete(bt); } catch { }
                if (!sessionLocked) ShowBt();
                return;
            }
            string bright = Path.Combine(dir, "bright.req");
            if (File.Exists(bright)) {
                try { File.Delete(bright); } catch { }
                if (!sessionLocked) ShowBright();
                return;
            }
            string vol = Path.Combine(dir, "vol.req");
            if (File.Exists(vol)) {
                try { File.Delete(vol); } catch { }
                if (!sessionLocked) ShowVol();
                return;
            }
            string bat = Path.Combine(dir, "bat.req");
            if (File.Exists(bat)) {
                try { File.Delete(bat); } catch { }
                if (!sessionLocked) ShowBat();
                return;
            }
            string cal = Path.Combine(dir, "cal.req");
            if (File.Exists(cal)) {
                try { File.Delete(cal); } catch { }
                if (!sessionLocked) ShowCal();
            }
        }

        void SoftCloseQuickOthers(Form keep) {
            try { if (wifiWin != null && !wifiWin.IsDisposed && wifiWin.Visible && !object.ReferenceEquals(wifiWin, keep)) wifiWin.SoftClose(); } catch { }
            try { if (btWin != null && !btWin.IsDisposed && btWin.Visible && !object.ReferenceEquals(btWin, keep)) btWin.SoftClose(); } catch { }
            try { if (brightWin != null && !brightWin.IsDisposed && brightWin.Visible && !object.ReferenceEquals(brightWin, keep)) brightWin.SoftClose(); } catch { }
            try { if (volWin != null && !volWin.IsDisposed && volWin.Visible && !object.ReferenceEquals(volWin, keep)) volWin.SoftClose(); } catch { }
            try { if (batWin != null && !batWin.IsDisposed && batWin.Visible && !object.ReferenceEquals(batWin, keep)) batWin.SoftClose(); } catch { }
            try { if (calWin != null && !calWin.IsDisposed && calWin.Visible && !object.ReferenceEquals(calWin, keep)) calWin.SoftClose(); } catch { }
        }

        void ShowWifi() {
            if (wifiWin == null || wifiWin.IsDisposed) {
                wifiWin = new WifiBoard(state.Night, state.Accent);
                wifiWin.FormClosed += delegate { wifiWin = null; };
            } else wifiWin.Recolor(state.Night, state.Accent);
            SoftCloseQuickOthers(wifiWin);
            wifiWin.Pop();
        }

        void ShowBt() {
            if (btWin == null || btWin.IsDisposed) {
                btWin = new BluetoothBoard(state.Night, state.Accent);
                btWin.FormClosed += delegate { btWin = null; };
            } else btWin.Recolor(state.Night, state.Accent);
            SoftCloseQuickOthers(btWin);
            btWin.Pop();
        }

        void ShowBright() {
            if (brightWin == null || brightWin.IsDisposed) {
                brightWin = new BrightBoard(state.Night, state.Accent);
                brightWin.FormClosed += delegate { brightWin = null; };
            } else brightWin.Recolor(state.Night, state.Accent);
            SoftCloseQuickOthers(brightWin);
            brightWin.Pop();
        }

        void ShowVol() {
            if (volWin == null || volWin.IsDisposed) {
                volWin = new VolumeBoard(state.Night, state.Accent);
                volWin.FormClosed += delegate { volWin = null; };
            } else volWin.Recolor(state.Night, state.Accent);
            SoftCloseQuickOthers(volWin);
            volWin.Pop();
        }

        void ShowBat() {
            if (batWin == null || batWin.IsDisposed) {
                batWin = new BatteryBoard(state.Night, state.Accent);
                batWin.OpenBright = delegate { ShowBright(); };
                batWin.FormClosed += delegate { batWin = null; };
            } else batWin.Recolor(state.Night, state.Accent);
            SoftCloseQuickOthers(batWin);
            batWin.Pop();
        }

        void ShowCal() {
            if (calWin == null || calWin.IsDisposed) {
                calWin = new ReminderBoard(state.Night, state.Accent);
                calWin.FormClosed += delegate { calWin = null; };
            } else calWin.Recolor(state.Night, state.Accent);
            SoftCloseQuickOthers(calWin);
            calWin.Pop();
        }

        void FocusPromptFromRequest() {
            if (sessionLocked || behind) return;
            promptFocus = true;
            try {
                Native.SetWindowPos(Handle, IntPtr.Zero, 0, 0, 0, 0, 0x0013);
                Native.SetForegroundWindow(Handle);
                Activate();
                Focus();
            } catch { }
            SetHint("type a command   esc closes");
            Invalidate();
        }

        void ShowHelp() {
            BlurPrompt();
            if (helpWin != null && !helpWin.IsDisposed) {
                helpWin.Recolor(state.Night, state.Accent);
                helpWin.Activate();
                return;
            }
            helpWin = new HelpBoard(state.Night, state.Accent, RunDeskLine, FillDeskPrompt);
            helpWin.FormClosed += delegate { helpWin = null; };
            helpWin.Show();
        }

        void FillDeskPrompt(string text) {
            typed = text ?? "";
            if (typed.Length > 80) typed = typed.Substring(0, 80);
            promptFocus = true;
            Focus();
            Activate();
            SetHint("type the rest");
        }

        void ConfirmPowerOff() {
            var r = MessageBox.Show(
                this,
                "Shut down this PC?\n\nWindows will close apps safely.\nNothing is forced.",
                "FoxOS · power off",
                MessageBoxButtons.YesNo,
                MessageBoxIcon.Warning,
                MessageBoxDefaultButton.Button2);
            if (r != DialogResult.Yes) {
                SetHint("shutdown cancelled");
                return;
            }
            try {
                // /s = graceful shutdown, /t 0 = now (after Yes), /f not used so apps can save
                Process.Start(new ProcessStartInfo {
                    FileName = "shutdown.exe",
                    Arguments = "/s /t 0",
                    UseShellExecute = false,
                    CreateNoWindow = true
                });
                SetHint("shutting down…");
            } catch {
                SetHint("shutdown failed");
            }
        }

        void RunDeskLine(string line) {
            typed = line ?? "";
            RunPrompt();
        }

        void LoadToast() {
            string dir = Path.GetDirectoryName(statePath);
            if (string.IsNullOrEmpty(dir)) return;
            string path = Path.Combine(dir, "toast.json");
            if (!File.Exists(path)) { toastText = ""; return; }
            try {
                string json = File.ReadAllText(path);
                string text = Json.Grab(json, "text");
                string until = Json.Grab(json, "until");
                DateTime when;
                if (string.IsNullOrEmpty(text) || !DateTime.TryParse(until, null, System.Globalization.DateTimeStyles.RoundtripKind, out when)) {
                    toastText = "";
                    return;
                }
                if (DateTime.UtcNow > when.ToUniversalTime()) { toastText = ""; return; }
                bool fresh = toastText != text;
                toastText = text;
                toastUntil = when.ToUniversalTime();
                if (fresh) {
                    try { System.Media.SystemSounds.Asterisk.Play(); } catch { }
                }
            } catch { }
        }

        void LoadLockFlag() {
            string dir = Path.GetDirectoryName(statePath);
            if (string.IsNullOrEmpty(dir)) { sessionLocked = false; return; }
            string path = Path.Combine(dir, "lock.json");
            if (!File.Exists(path)) { sessionLocked = false; lockUser = ""; return; }
            try {
                string json = File.ReadAllText(path);
                sessionLocked = json.IndexOf("\"locked\":true", StringComparison.OrdinalIgnoreCase) >= 0
                    || string.Equals(Json.Grab(json, "locked"), "true", StringComparison.OrdinalIgnoreCase);
                lockUser = Json.Grab(json, "user");
            } catch {
                sessionLocked = false;
            }
        }

        void CheckIdleLock() {
            if (sessionLocked) return;
            if ((DateTime.UtcNow - lastIdleCheck).TotalMilliseconds < 2000) return;
            lastIdleCheck = DateTime.UtcNow;
            string dir = Path.GetDirectoryName(statePath);
            if (string.IsNullOrEmpty(dir)) return;
            string path = Path.Combine(dir, "idle-lock.txt");
            if (!File.Exists(path)) return;
            string[] lines;
            try { lines = File.ReadAllLines(path); } catch { return; }
            if (lines.Length < 1) return;
            int minutes;
            if (!int.TryParse((lines[0] ?? "").Trim(), out minutes) || minutes <= 0) return;
            string user = lines.Length > 1 ? (lines[1] ?? "").Trim() : "";
            if (string.IsNullOrEmpty(user)) return;
            var info = new Native.LASTINPUTINFO();
            info.cbSize = (uint)Marshal.SizeOf(typeof(Native.LASTINPUTINFO));
            if (!Native.GetLastInputInfo(ref info)) return;
            uint idleMs = (uint)Environment.TickCount - info.dwTime;
            if (idleMs < (uint)minutes * 60000u) return;
            try {
                File.WriteAllText(Path.Combine(dir, "lock.json"),
                    "{\"locked\":true,\"user\":\"" + user.Replace("\\", "") + "\",\"at\":\"" + DateTime.Now.ToString("s") + "\"}");
                File.WriteAllText(Path.Combine(dir, "toast.json"),
                    "{\"text\":\"locked  " + user.Replace("\"", "") + "\",\"until\":\"" + DateTime.UtcNow.AddSeconds(8).ToString("o") + "\"}");
            } catch { }
            GhosttyTalk.HideAll();
            sessionLocked = true;
            lockUser = user;
        }

        bool ForegroundIsCovered() {
            if ((DateTime.UtcNow - lastFgCheck).TotalMilliseconds < 280) return fgCovered;
            lastFgCheck = DateTime.UtcNow;
            fgCovered = false;
            try {
                IntPtr fg = Native.GetForegroundWindow();
                if (fg == IntPtr.Zero) return false;
                IntPtr self = IntPtr.Zero;
                try { self = Handle; } catch { }
                if (fg == self) return false;
                uint pid;
                Native.GetWindowThreadProcessId(fg, out pid);
                if (pid == 0) return false;
                using (var p = Process.GetProcessById((int)pid)) {
                    string n = (p.ProcessName ?? "").ToLowerInvariant();
                    if (n == "winghostty" || n == "ghostty") fgCovered = true;
                    else if (n == "cursor" || n == "code") fgCovered = true;
                    else if (n == "firefox" || n.IndexOf("zen") >= 0) fgCovered = true;
                }
            } catch { }
            return fgCovered;
        }

        void Poll() {
            // PeekHelpRequest runs on reqTimer (33ms); keep a backup call here.
            PeekHelpRequest();
            if ((DateTime.UtcNow - lastPoll).TotalMilliseconds < 400) return;
            lastPoll = DateTime.UtcNow;
            if (!File.Exists(statePath)) return;
            var stamp = File.GetLastWriteTimeUtc(statePath);
            if (stamp == state.Stamp) return;
            bool wasShell = state.Shell;
            Color wasNight = state.Night;
            Color wasAccent = state.Accent;
            int wasRain = state.WallRain;
            string wasKind = state.WallKind;
            Json.Load(statePath, state);
            bool themeChanged = wasNight.ToArgb() != state.Night.ToArgb()
                || wasAccent.ToArgb() != state.Accent.ToArgb();
            if (themeChanged) {
                morphFromNight = wasNight;
                morphT = 0f;
            }
            if (wasRain != state.WallRain || !string.Equals(wasKind, state.WallKind, StringComparison.OrdinalIgnoreCase)) {
                InitRain();
                RebuildGlyphs();
            }
            DropPanels();
            RebuildBrushes();
            RebuildFox(true);
            if (helpWin != null && !helpWin.IsDisposed) helpWin.Recolor(state.Night, state.Accent);
            for (int i = 0; i < docks.Count; i++) {
                if (docks[i] != null && !docks[i].IsDisposed) docks[i].Recolor();
            }
            if (widgets != null && !widgets.IsDisposed) widgets.Recolor();
            if (homeWin != null && !homeWin.IsDisposed) homeWin.Recolor(state.Night, state.Accent);
            if (altTab != null && !altTab.IsDisposed) altTab.Recolor(state.Night, state.Accent);
            if (wifiWin != null && !wifiWin.IsDisposed) wifiWin.Recolor(state.Night, state.Accent);
            if (btWin != null && !btWin.IsDisposed) btWin.Recolor(state.Night, state.Accent);
            if (brightWin != null && !brightWin.IsDisposed) brightWin.Recolor(state.Night, state.Accent);
            if (volWin != null && !volWin.IsDisposed) volWin.Recolor(state.Night, state.Accent);
            if (batWin != null && !batWin.IsDisposed) batWin.Recolor(state.Night, state.Accent);
            if (calWin != null && !calWin.IsDisposed) calWin.Recolor(state.Night, state.Accent);
            EnsureMediaStrip();
            EnsureDock();
            if (wasShell != state.Shell) {
                behind = false;
                Attach();
            }
            lastChrome = DateTime.MinValue;
            PaintChrome(false);
        }

        void Step() {
            for (int c = 0; c < cols; c++) {
                if (speed[c] <= 0f) continue;
                head[c] += speed[c];
                if (head[c] - trail[c] > rows + 2) {
                    head[c] = -rng.Next(4, 18);
                    speed[c] = 0.18f + (float)rng.NextDouble() * 0.55f;
                    trail[c] = 8 + rng.Next(16);
                }
                int hi = ((int)head[c] % rows + rows) % rows;
                if (rng.Next(100) < 32) grid[c][hi] = (byte)rng.Next(rainSet.Length);
            }
        }
        int WallStr() { return Math.Max(0, Math.Min(100, state.WallStrength)); }
        int WallSc() { return Math.Max(0, Math.Min(100, state.WallScale)); }
        int WallWt() { return Math.Max(0, Math.Min(100, state.WallWeight)); }
        int WallVl() { return Math.Max(0, Math.Min(100, state.WallVeil)); }
        // One uniform stroke for the whole grid (1px..8px)
        float WallStroke() { return 1f + WallWt() * 7f / 100f; }

        void PaintWallBase(Graphics g) {
            // Solid base under rain. Strength/veil from FOXSTYLE.
            string kind = state.WallKind ?? "glass";
            Rectangle rc = ClientRectangle;
            if (string.Equals(kind, "none", StringComparison.OrdinalIgnoreCase)) return;
            int str = WallStr();
            int veil = WallVl();
            float k = str / 100f;
            if (string.Equals(kind, "neon", StringComparison.OrdinalIgnoreCase)) {
                int drop = (int)(6 + 14 * k);
                Color deep = Color.FromArgb(
                    Math.Max(0, state.Night.R - drop),
                    Math.Max(0, state.Night.G - drop / 2),
                    Math.Max(0, state.Night.B - drop / 3));
                using (var br = new SolidBrush(deep)) g.FillRectangle(br, rc);
                return;
            }
            if (string.Equals(kind, "metal", StringComparison.OrdinalIgnoreCase)
                || string.Equals(kind, "fabric", StringComparison.OrdinalIgnoreCase)) {
                int lift = (int)(10 + 22 * k);
                Color steel = Color.FromArgb(
                    Math.Min(255, state.Night.R + lift),
                    Math.Min(255, state.Night.G + lift),
                    Math.Min(255, state.Night.B + lift + 6));
                using (var br = new System.Drawing.Drawing2D.LinearGradientBrush(rc, steel, state.Night, LinearGradientMode.ForwardDiagonal))
                    g.FillRectangle(br, rc);
                return;
            }
            // glass default
            int glowLift = (int)(12 + 40 * k);
            Color top = Color.FromArgb(
                Math.Min(255, state.Night.R + glowLift),
                Math.Min(255, state.Night.G + glowLift * 3 / 4),
                Math.Min(255, state.Night.B + glowLift + 10));
            using (var br = new System.Drawing.Drawing2D.LinearGradientBrush(rc, top, state.Night, LinearGradientMode.Vertical))
                g.FillRectangle(br, rc);
            int a1 = (int)(18 + veil * 0.7);
            int a2 = (int)(12 + veil * 0.55);
            if (a1 > 0) {
                using (var v1 = new SolidBrush(Color.FromArgb(Math.Min(180, a1), state.Accent)))
                    g.FillEllipse(v1, -rc.Width / 5, -rc.Height / 4, rc.Width * 2 / 3, rc.Height * 2 / 3);
            }
            if (a2 > 0) {
                using (var v2 = new SolidBrush(Color.FromArgb(Math.Min(160, a2), state.Accent2.A > 0 ? state.Accent2 : state.Accent)))
                    g.FillEllipse(v2, rc.Width / 3, rc.Height / 2, rc.Width * 2 / 3, rc.Height * 2 / 3);
            }
        }

        void PaintWallOverlay(Graphics g) {
            // One uniform stroke for the whole grid (no major/minor double-weight).
            string kind = state.WallKind ?? "glass";
            Rectangle rc = ClientRectangle;
            int str = WallStr();
            int sc = WallSc();
            int veil = WallVl();
            float stroke = WallStroke();
            if (str <= 0) return;
            // scale 0 → tight grid, 100 → wide
            int step = 18 + sc * 54 / 100; // 18..72
            if (string.Equals(kind, "neon", StringComparison.OrdinalIgnoreCase)) {
                int lineA = 50 + str * 170 / 100;
                using (var pen = new Pen(Color.FromArgb(Math.Min(255, lineA), state.Accent), stroke)) {
                    pen.StartCap = System.Drawing.Drawing2D.LineCap.Flat;
                    pen.EndCap = System.Drawing.Drawing2D.LineCap.Flat;
                    for (int x = 0; x < rc.Width; x += step) g.DrawLine(pen, x, 0, x, rc.Height);
                    for (int y = 0; y < rc.Height; y += step) g.DrawLine(pen, 0, y, rc.Width, y);
                }
                return;
            }
            if (string.Equals(kind, "metal", StringComparison.OrdinalIgnoreCase)) {
                int gap = Math.Max(2, step / 4);
                int lineA = 35 + str * 100 / 100;
                using (var pen = new Pen(Color.FromArgb(Math.Min(255, lineA), 220, 220, 230), stroke)) {
                    for (int y = 0; y < rc.Height; y += gap) g.DrawLine(pen, 0, y, rc.Width, y);
                }
                int sheenA = veil * str / 120;
                if (sheenA > 0) {
                    using (var sheen = new SolidBrush(Color.FromArgb(Math.Min(120, sheenA), state.Accent)))
                        g.FillRectangle(sheen, 0, 0, rc.Width, rc.Height / 4 + veil);
                }
                return;
            }
            if (string.Equals(kind, "fabric", StringComparison.OrdinalIgnoreCase)) {
                int gap = Math.Max(4, step / 3);
                int a = 25 + str * 80 / 100;
                using (var pen = new Pen(Color.FromArgb(Math.Min(220, a), state.Accent), stroke)) {
                    for (int x = -rc.Height; x < rc.Width; x += gap)
                        g.DrawLine(pen, x, 0, x + rc.Height, rc.Height);
                    for (int x = 0; x < rc.Width + rc.Height; x += gap)
                        g.DrawLine(pen, x, 0, x - rc.Height, rc.Height);
                }
                int wash = veil * str / 200;
                if (wash > 0) {
                    using (var br = new SolidBrush(Color.FromArgb(Math.Min(80, wash), state.Accent2.A > 0 ? state.Accent2 : state.Accent)))
                        g.FillRectangle(br, rc);
                }
            }
        }

        protected override void OnPaint(PaintEventArgs e) {
            var g = e.Graphics;
            g.CompositingMode = CompositingMode.SourceCopy;
            g.Clear(state.Night);
            g.CompositingMode = CompositingMode.SourceOver;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            PaintWallBase(g);
            if (IsNotebookTheme()) DrawNotebookPaper(g);
            if (morphT < 1f) {
                float mt = morphT < 0f ? 0f : (morphT > 1f ? 1f : morphT);
                float ease = mt * mt * (3f - 2f * mt);
                int a = (int)(210 * (1f - ease));
                if (a > 0) {
                    using (var wash = new SolidBrush(Color.FromArgb(a, morphFromNight)))
                        g.FillRectangle(wash, ClientRectangle);
                }
            }
            g.CompositingQuality = CompositingQuality.HighSpeed;
            g.InterpolationMode = InterpolationMode.NearestNeighbor;
            g.SmoothingMode = SmoothingMode.None;
            g.PixelOffsetMode = PixelOffsetMode.None;
            g.TextRenderingHint = TextRenderingHint.SingleBitPerPixelGridFit;
            for (int c = 0; c < cols; c++) {
                if (speed[c] <= 0f) continue;
                int start = (int)Math.Floor(head[c] - trail[c]);
                int end = (int)Math.Floor(head[c]);
                int tlen = Math.Max(1, trail[c]);
                int x = c * cellW;
                for (int r = start; r <= end; r++) {
                    if (r < 0 || r >= rows) continue;
                    int dist = end - r;
                    int bi = 5 - Math.Min(5, dist * 5 / tlen);
                    if (dist == 0) bi = 5;
                    if (rainGlyphs != null) {
                        g.DrawImageUnscaled(rainGlyphs[bi][grid[c][r]], x, r * cellH);
                    }
                }
            }
            g.SmoothingMode = SmoothingMode.AntiAlias;
            PaintWallOverlay(g);
            if (foxBmp != null) {
                float t = foxBoot < 0f ? 0f : (foxBoot > 1f ? 1f : foxBoot);
                float ease = 1f - (1f - t) * (1f - t);
                float scale = 0.78f + 0.22f * ease;
                int fw = Math.Max(1, (int)(foxBmp.Width * scale));
                int fh = Math.Max(1, (int)(foxBmp.Height * scale));
                int fx = (Width - fw) / 2;
                int fy = (Height - fh) / 2 + (int)((1f - ease) * 48f);
                if (ease >= 0.995f) {
                    g.DrawImageUnscaled(foxBmp, (Width - foxBmp.Width) / 2, (Height - foxBmp.Height) / 2);
                } else {
                    var cm = new System.Drawing.Imaging.ColorMatrix();
                    cm.Matrix33 = ease;
                    using (var ia = new System.Drawing.Imaging.ImageAttributes()) {
                        ia.SetColorMatrix(cm);
                        g.DrawImage(foxBmp, new Rectangle(fx, fy, fw, fh),
                            0, 0, foxBmp.Width, foxBmp.Height, GraphicsUnit.Pixel, ia);
                    }
                }
            }

            g.TextRenderingHint = TextRenderingHint.AntiAliasGridFit;

            Rectangle bar = PromptRect();
            int aFill = promptFocus ? 230 : 175;
            using (var fill = new SolidBrush(Color.FromArgb(aFill, 7, 9, 16))) {
                g.FillRectangle(fill, bar);
            }
            using (var rail = new SolidBrush(Color.FromArgb(promptFocus ? 255 : 170, state.Accent))) {
                g.FillRectangle(rail, bar.X, bar.Y, 3, bar.Height);
            }
            using (var outer = new Pen(Color.FromArgb(promptFocus ? 40 : 22, 255, 255, 255), 1f)) {
                g.DrawRectangle(outer, bar.X, bar.Y, bar.Width - 1, bar.Height - 1);
            }
            using (var inner = new Pen(Color.FromArgb(promptFocus ? 210 : 95, state.Accent), 1f)) {
                g.DrawRectangle(inner, bar.X + 1, bar.Y + 1, bar.Width - 3, bar.Height - 3);
            }
            using (var shine = new Pen(Color.FromArgb(promptFocus ? 36 : 18, 255, 255, 255), 1f)) {
                g.DrawLine(shine, bar.X + 4, bar.Y + 2, bar.Right - 3, bar.Y + 2);
            }

            using (var sf = (StringFormat)StringFormat.GenericTypographic.Clone()) {
                sf.Alignment = StringAlignment.Near;
                sf.LineAlignment = StringAlignment.Center;
                sf.FormatFlags = StringFormatFlags.NoWrap | StringFormatFlags.MeasureTrailingSpaces;
                sf.Trimming = StringTrimming.None;
                bool blink = promptFocus && ((Environment.TickCount / 480) % 2 == 0);
                SizeF pre = g.MeasureString("> ", promptFont, PointF.Empty, sf);
                float textLeft = bar.X + 16;
                var preBox = new RectangleF(textLeft, bar.Y, pre.Width + 2, bar.Height);
                var bodyBox = new RectangleF(textLeft + pre.Width, bar.Y, Math.Max(8, bar.Right - 12 - textLeft - pre.Width), bar.Height);
                using (var preInk = new SolidBrush(Color.FromArgb(promptFocus ? 255 : 165, state.Accent))) {
                    g.DrawString("> ", promptFont, preInk, preBox, sf);
                }
                string body = typed + (blink ? "_" : (promptFocus ? "" : ""));
                using (var bodyInk = new SolidBrush(typed.Length > 0 || promptFocus
                    ? Color.FromArgb(236, 238, 242)
                    : Color.FromArgb(120, 140, 160))) {
                    g.DrawString(body, promptFont, bodyInk, bodyBox, sf);
                }
            }
            if (hint.Length > 0 && DateTime.UtcNow < hintUntil) {
                using (var dim = new SolidBrush(state.Accent)) {
                    g.DrawString(hint, font, dim, bar.X, bar.Bottom + 4, StringFormat.GenericTypographic);
                }
            }

            if (toastText.Length > 0 && DateTime.UtcNow < toastUntil) {
                SizeF tz = g.MeasureString(toastText, specFont);
                int tw = Math.Min(Width - 80, (int)Math.Ceiling(tz.Width) + 28);
                int th = 36;
                int toastY = Height - 88 - (state.Shell ? ShellBar.LastBarH : 0);
                var toast = new Rectangle((Width - tw) / 2, toastY, tw, th);
                using (var fill = new SolidBrush(Color.FromArgb(230, 7, 9, 16))) {
                    g.FillRectangle(fill, toast);
                }
                using (var rail = new SolidBrush(Color.FromArgb(255, state.Accent))) {
                    g.FillRectangle(rail, toast.X, toast.Y, 3, toast.Height);
                }
                using (var ink = new SolidBrush(Color.FromArgb(236, 238, 242))) {
                    g.DrawString(toastText, specFont, ink, toast.X + 14, toast.Y + 8, StringFormat.GenericTypographic);
                }
            }

            if (sessionLocked) {
                string who = string.IsNullOrEmpty(lockUser) ? "" : ("  " + lockUser);
                string line = "LOCKED" + who;
                string sub = "Shift+Alt+T  then Fox password";
                SizeF lz = g.MeasureString(line, specTitle);
                int lw = Math.Min(Width - 80, Math.Max(420, (int)Math.Ceiling(lz.Width) + 40));
                int lh = 92;
                var box = new Rectangle((Width - lw) / 2, Height / 2 - 200, lw, lh);
                using (var fill = new SolidBrush(Color.FromArgb(235, 7, 9, 16))) {
                    g.FillRectangle(fill, box);
                }
                using (var rail = new SolidBrush(Color.FromArgb(255, state.Accent))) {
                    g.FillRectangle(rail, box.X, box.Y, 4, box.Height);
                }
                using (var ink = new SolidBrush(Color.FromArgb(236, 238, 242))) {
                    g.DrawString(line, specTitle, ink, box.X + 18, box.Y + 14, StringFormat.GenericTypographic);
                }
                using (var dim = new SolidBrush(Color.FromArgb(200, state.Accent))) {
                    g.DrawString(sub, specSmall, dim, box.X + 18, box.Y + 58, StringFormat.GenericTypographic);
                }
            }

            BlitPanel(g, EnsureDeskCache(), DeskRect());
            BlitPanel(g, EnsureRigCache(), RigRect());
        }

        void DropPanels() {
            if (deskCache != null) { deskCache.Dispose(); deskCache = null; }
            if (rigCache != null) { rigCache.Dispose(); rigCache = null; }
            deskCacheKey = int.MinValue;
            rigCacheKey = int.MinValue;
        }

        static void BlitPanel(Graphics g, Bitmap bmp, Rectangle box) {
            if (bmp == null) return;
            g.DrawImageUnscaled(bmp, box.X, box.Y);
        }

        Bitmap EnsureDeskCache() {
            DateTime now = DateTime.Now;
            int key = now.Second + now.Minute * 60 + now.Hour * 3600;
            if (deskLines != null) {
                for (int i = 0; i < deskLines.Length; i++)
                    key = unchecked(key * 33 + (deskLines[i] ?? "").GetHashCode());
            }
            if (deskCache != null && key == deskCacheKey) return deskCache;
            deskCacheKey = key;
            if (deskCache != null) { deskCache.Dispose(); deskCache = null; }
            return deskCache = RenderPanel(DeskRect(), DrawDesk);
        }

        Bitmap EnsureRigCache() {
            int key = state.Rig;
            key = unchecked(key * 31 + rig.CpuLoad);
            key = unchecked(key * 31 + (int)(rig.RamUsed >> 20));
            key = unchecked(key * 31 + (int)(rig.DiskUsed >> 20));
            key = unchecked(key * 31 + rig.BatPct);
            key = unchecked(key * 31 + (rig.OnAc ? 1 : 0) + (rig.Charging ? 2 : 0));
            key = unchecked(key * 31 + (int)rig.Up.TotalMinutes);
            if (rig.Net != null) key = unchecked(key * 31 + rig.Net.GetHashCode());
            if (rigCache != null && key == rigCacheKey) return rigCache;
            rigCacheKey = key;
            if (rigCache != null) { rigCache.Dispose(); rigCache = null; }
            return rigCache = RenderPanel(RigRect(), DrawRig);
        }

        Bitmap RenderPanel(Rectangle box, Action<Graphics> paint) {
            if (box.Width < 8 || box.Height < 8) return null;
            var bmp = new Bitmap(box.Width, box.Height, PixelFormat.Format32bppPArgb);
            using (var g = Graphics.FromImage(bmp)) {
                g.Clear(Color.Transparent);
                g.TextRenderingHint = TextRenderingHint.AntiAliasGridFit;
                g.SmoothingMode = SmoothingMode.None;
                g.TranslateTransform(-box.X, -box.Y);
                paint(g);
            }
            return bmp;
        }

        Rectangle RigRect() {
            if (state.Rig == 5) return new Rectangle(Width - 572 - 32, 28, 572, 336);
            if (state.Rig == 4) return new Rectangle(Width - 560 - 32, 28, 560, 328);
            if (state.Rig == 3) return new Rectangle(Width - 540 - 32, 28, 540, 392);
            if (state.Rig == 2) return new Rectangle(Width - 478 - 32, 28, 478, 456);
            return new Rectangle(Width - 500 - 32, 28, 500, 428);
        }

        void DrawTrack(Graphics g, Rectangle r, double t) {
            if (t < 0) t = 0;
            if (t > 1) t = 1;
            using (var bg = new SolidBrush(Color.FromArgb(26, 255, 255, 255))) {
                g.FillRectangle(bg, r);
            }
            int w = (int)Math.Round(r.Width * t);
            if (w > 0) {
                using (var fg = new SolidBrush(Color.FromArgb(240, state.Accent))) {
                    g.FillRectangle(fg, r.X, r.Y, Math.Max(2, w), r.Height);
                }
            }
        }

        void DrawBattery(Graphics g, int x, int y, int bw, int bh, double t) {
            if (t < 0) t = 0;
            if (t > 1) t = 1;
            SmoothingMode old = g.SmoothingMode;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            int nub = Math.Max(3, bh / 4);
            Rectangle body = new Rectangle(x, y, bw - nub - 2, bh);
            Rectangle tip = new Rectangle(body.Right, y + bh / 3, nub, Math.Max(4, bh - bh / 3 * 2));
            using (var edge = new Pen(Color.FromArgb(180, state.Accent), 1.4f)) {
                g.DrawRectangle(edge, body);
            }
            using (var nubBr = new SolidBrush(Color.FromArgb(180, state.Accent))) {
                g.FillRectangle(nubBr, tip);
            }
            int pad = 3;
            int innerW = Math.Max(0, body.Width - pad * 2);
            int fillW = (int)Math.Round(innerW * t);
            if (fillW > 0) {
                using (var fg = new SolidBrush(Color.FromArgb(230, state.Accent))) {
                    g.FillRectangle(fg, body.X + pad, body.Y + pad, fillW, body.Height - pad * 2);
                }
            }
            g.SmoothingMode = old;
        }

        void DrawKicker(Graphics g, Brush ink, float x, float y, string text) {
            using (var sf = (StringFormat)StringFormat.GenericTypographic.Clone()) {
                float cx = x;
                for (int i = 0; i < text.Length; i++) {
                    string ch = text.Substring(i, 1);
                    g.DrawString(ch, specSmall, ink, cx, y, sf);
                    SizeF sz = g.MeasureString(ch, specSmall, PointF.Empty, sf);
                    cx += sz.Width + 6;
                }
            }
        }

        void DrawSpecLine(Graphics g, StringFormat sf, Brush labelInk, Brush valueInk, int x, int y, int labelW, int valueW, string label, string value) {
            g.DrawString(label, specSmall, labelInk, new RectangleF(x, y + 3, labelW, 18), sf);
            g.DrawString(value, specFont, valueInk, new RectangleF(x + labelW, y, valueW, 22), sf);
        }

        void DrawVTrack(Graphics g, Rectangle r, double t) {
            if (t < 0) t = 0;
            if (t > 1) t = 1;
            using (var bg = new SolidBrush(Color.FromArgb(26, 255, 255, 255))) {
                g.FillRectangle(bg, r);
            }
            int h = (int)Math.Round(r.Height * t);
            if (h > 0) {
                using (var fg = new SolidBrush(Color.FromArgb(240, state.Accent))) {
                    g.FillRectangle(fg, r.X, r.Bottom - h, r.Width, h);
                }
            }
        }

        void DrawMiniStat(Graphics g, Rectangle cell, string label, string value, double t, StringFormat sf, Brush labelInk, Brush valueInk) {
            g.DrawString(label, specSmall, labelInk, new RectangleF(cell.X, cell.Y, 48, 16), sf);
            using (var far = (StringFormat)sf.Clone()) {
                far.Alignment = StringAlignment.Far;
                g.DrawString(value, specSmall, valueInk, new RectangleF(cell.X, cell.Y, cell.Width, 16), far);
            }
            DrawTrack(g, new Rectangle(cell.X, cell.Y + 20, cell.Width, 3), t);
        }

        void LoadDesk() {
            if ((DateTime.UtcNow - lastDesk).TotalMilliseconds < 1200) return;
            lastDesk = DateTime.UtcNow;
            string dir = Path.GetDirectoryName(statePath);
            string path = string.IsNullOrEmpty(dir) ? "" : Path.Combine(dir, "desk.txt");
            if (string.IsNullOrEmpty(path) || !File.Exists(path)) {
                deskLines = new string[0];
                return;
            }
            try {
                string[] raw = File.ReadAllLines(path);
                var keep = new List<string>();
                for (int i = 0; i < raw.Length; i++) {
                    string line = (raw[i] ?? "").Trim();
                    if (line.Length == 0) continue;
                    keep.Add(Rig.Clip(line, 34));
                }
                if (keep.Count > 8) keep = keep.GetRange(keep.Count - 8, 8);
                deskLines = keep.ToArray();
            } catch {
                deskLines = new string[0];
            }
        }

        Rectangle DeskRect() {
            return new Rectangle(32, 28, 380, 468);
        }

        void DrawDesk(Graphics g) {
            Rectangle box = DeskRect();
            using (var fill = new SolidBrush(Color.FromArgb(222, 6, 8, 14))) {
                g.FillRectangle(fill, box);
            }
            using (var wash = new SolidBrush(Color.FromArgb(22, state.Accent))) {
                g.FillRectangle(wash, box.X, box.Y, box.Width, 56);
            }
            using (var rail = new SolidBrush(Color.FromArgb(230, state.Accent))) {
                g.FillRectangle(rail, box.X, box.Y, 2, box.Height);
            }
            using (var edge = new Pen(Color.FromArgb(28, 255, 255, 255), 1f)) {
                g.DrawRectangle(edge, box.X, box.Y, box.Width - 1, box.Height - 1);
            }
            using (var shine = new Pen(Color.FromArgb(32, 255, 255, 255), 1f)) {
                g.DrawLine(shine, box.X + 3, box.Y + 1, box.Right - 2, box.Y + 1);
            }

            DateTime now = DateTime.Now;
            using (var sf = (StringFormat)StringFormat.GenericTypographic.Clone()) {
                sf.Alignment = StringAlignment.Near;
                sf.LineAlignment = StringAlignment.Center;
                sf.FormatFlags = StringFormatFlags.NoWrap;
                sf.Trimming = StringTrimming.EllipsisCharacter;
                int x = box.X + 24;
                int right = box.Right - 24;
                int y = box.Y + 18;
                string theme = string.IsNullOrEmpty(state.Theme) ? "FOX" : state.Theme.ToUpperInvariant();
                using (var accentInk = new SolidBrush(state.Accent))
                using (var valueInk = new SolidBrush(Color.FromArgb(232, 235, 240)))
                using (var muteInk = new SolidBrush(Color.FromArgb(124, 140, 156)))
                using (var labelInk = new SolidBrush(Color.FromArgb(100, 118, 138))) {
                    DrawKicker(g, accentInk, x, y, "FOXOS");
                    SizeF th = g.MeasureString(theme, specSmall, PointF.Empty, sf);
                    g.DrawString(theme, specSmall, accentInk, new RectangleF(right - th.Width, y, th.Width + 2, 16), sf);
                    y += 22;
                    string time = now.ToString("HH:mm");
                    g.DrawString(time, deskClock, valueInk, new RectangleF(x, y, 220, 56), sf);
                    SizeF timeSz = g.MeasureString(time, deskClock, PointF.Empty, sf);
                    g.DrawString(now.ToString("ss"), specTitle, accentInk, new RectangleF(x + timeSz.Width + 10, y + 18, 60, 28), sf);
                    y += 58;
                    DrawTrack(g, new Rectangle(x, y, right - x, 3), now.Second / 60.0 + now.Millisecond / 60000.0);
                    y += 14;
                    string weekday = now.ToString("dddd", System.Globalization.CultureInfo.InvariantCulture).ToLowerInvariant();
                    g.DrawString(weekday, specTitle, valueInk, new RectangleF(x, y, right - x, 28), sf);
                    y += 28;
                    string rest = now.ToString("d MMM", System.Globalization.CultureInfo.InvariantCulture).ToLowerInvariant();
                    g.DrawString(rest, specSmall, muteInk, new RectangleF(x, y, 120, 16), sf);
                    double dayT = now.TimeOfDay.TotalSeconds / 86400.0;
                    string dayPct = ((int)Math.Round(dayT * 100)).ToString() + "%";
                    using (var far = (StringFormat)sf.Clone()) {
                        far.Alignment = StringAlignment.Far;
                        g.DrawString(dayPct, specSmall, labelInk, new RectangleF(x, y, right - x, 16), far);
                    }
                    y += 18;
                    DrawTrack(g, new Rectangle(x, y, right - x, 4), dayT);
                    y += 18;
                    using (var rule = new Pen(Color.FromArgb(28, 255, 255, 255), 1f)) {
                        g.DrawLine(rule, x, y, right, y);
                    }
                    y += 14;
                    g.DrawString("desk", specSmall, accentInk, new RectangleF(x, y, 80, 16), sf);
                    y += 20;
                    if (deskLines.Length == 0) {
                        for (int i = 0; i < 3; i++) {
                            using (var pip = new SolidBrush(Color.FromArgb(i == 0 ? 200 : 70, state.Accent))) {
                                g.FillRectangle(pip, x, y + 6, 2, 12);
                            }
                            string ghost = i == 0 ? "note hello" : "";
                            if (ghost.Length > 0) g.DrawString(ghost, specFont, muteInk, new RectangleF(x + 12, y, right - x - 12, 22), sf);
                            else {
                                using (var ghostRule = new Pen(Color.FromArgb(18, 255, 255, 255), 1f)) {
                                    g.DrawLine(ghostRule, x + 12, y + 12, right, y + 12);
                                }
                            }
                            y += 28;
                        }
                    } else {
                        for (int i = 0; i < deskLines.Length; i++) {
                            using (var row = new SolidBrush(Color.FromArgb(i % 2 == 0 ? 16 : 0, 255, 255, 255))) {
                                g.FillRectangle(row, x - 4, y - 2, right - x + 8, 26);
                            }
                            using (var pip = new SolidBrush(state.Accent)) {
                                g.FillRectangle(pip, x, y + 6, 2, 12);
                            }
                            g.DrawString(deskLines[i], specFont, valueInk, new RectangleF(x + 12, y, right - x - 12, 22), sf);
                            y += 28;
                        }
                    }
                }
            }
        }

        void DrawRig(Graphics g) {
            if (state.Rig == 5) DrawRigRail(g);
            else if (state.Rig == 4) DrawRigGrid(g);
            else if (state.Rig == 3) DrawRigSplit(g);
            else if (state.Rig == 2) DrawRigAscii(g);
            else DrawRigCard(g);
        }

        void DrawRigRail(Graphics g) {
            Rectangle box = RigRect();
            using (var fill = new SolidBrush(Color.FromArgb(222, 6, 8, 14))) {
                g.FillRectangle(fill, box);
            }
            using (var rail = new SolidBrush(Color.FromArgb(230, state.Accent))) {
                g.FillRectangle(rail, box.X, box.Y, 2, box.Height);
            }
            using (var edge = new Pen(Color.FromArgb(28, 255, 255, 255), 1f)) {
                g.DrawRectangle(edge, box.X, box.Y, box.Width - 1, box.Height - 1);
            }

            double batT = 0;
            string batNum;
            string batTag;
            if (!rig.HasBattery) {
                batNum = "AC";
                batTag = rig.OnAc ? "plugged" : "power";
                batT = 1;
            } else {
                batNum = rig.BatPct >= 0 ? rig.BatPct.ToString() + "%" : "--";
                batTag = rig.Charging ? "charging" : (rig.OnAc ? "plugged" : "battery");
                if (rig.BatPct >= 0) batT = rig.BatPct / 100.0;
            }

            int splitX = box.Right - 188;
            using (var div = new Pen(Color.FromArgb(28, 255, 255, 255), 1f)) {
                g.DrawLine(div, splitX, box.Y + 22, splitX, box.Bottom - 22);
            }

            using (var sf = (StringFormat)StringFormat.GenericTypographic.Clone()) {
                sf.Alignment = StringAlignment.Near;
                sf.LineAlignment = StringAlignment.Center;
                sf.FormatFlags = StringFormatFlags.NoWrap;
                sf.Trimming = StringTrimming.EllipsisCharacter;
                int x = box.X + 24;
                int leftRight = splitX - 20;
                int labelW = 44;
                int valueW = leftRight - x - labelW;
                int y = box.Y + 20;
                string theme = string.IsNullOrEmpty(state.Theme) ? "FOX" : state.Theme.ToUpperInvariant();
                using (var accentInk = new SolidBrush(state.Accent))
                using (var labelInk = new SolidBrush(Color.FromArgb(100, 118, 138)))
                using (var valueInk = new SolidBrush(Color.FromArgb(232, 235, 240)))
                using (var muteInk = new SolidBrush(Color.FromArgb(124, 140, 156))) {
                    g.DrawString("FOXOS", specSmall, accentInk, new RectangleF(x, y, 80, 16), sf);
                    SizeF th = g.MeasureString(theme, specSmall, PointF.Empty, sf);
                    g.DrawString(theme, specSmall, accentInk, new RectangleF(leftRight - th.Width, y, th.Width + 2, 16), sf);
                    y += 20;
                    string host = Rig.Clip(string.IsNullOrEmpty(rig.Host) ? "machine" : rig.Host, 20);
                    g.DrawString(host, specTitle, valueInk, new RectangleF(x, y, leftRight - x, 28), sf);
                    y += 30;
                    string meta = Rig.Clip(rig.User, 12) + "   ·   " + Rig.UpText(rig.Up);
                    g.DrawString(meta, specSmall, muteInk, new RectangleF(x, y, leftRight - x, 16), sf);
                    y += 22;
                    using (var rule = new Pen(Color.FromArgb(28, 255, 255, 255), 1f)) {
                        g.DrawLine(rule, x, y, leftRight, y);
                    }
                    y += 14;
                    DrawSpecLine(g, sf, labelInk, valueInk, x, y, labelW, valueW, "os", Rig.Clip(rig.Os, 26));
                    y += 26;
                    DrawSpecLine(g, sf, labelInk, valueInk, x, y, labelW, valueW, "cpu", Rig.Clip(rig.Cpu, 26));
                    y += 26;
                    DrawSpecLine(g, sf, labelInk, valueInk, x, y, labelW, valueW, "gpu", Rig.Clip(rig.Gpu, 26));
                    y += 26;
                    DrawSpecLine(g, sf, labelInk, valueInk, x, y, labelW, valueW, "net", Rig.Clip(rig.Net, 22));
                    y += 26;
                    DrawSpecLine(g, sf, labelInk, valueInk, x, y, labelW, valueW, "disp", rig.Disp);

                    int rx = splitX + 18;
                    int rr = box.Right - 22;
                    int rw = rr - rx;
                    int ry = box.Y + 24;
                    string ram = Rig.Gb(rig.RamUsed) + "/" + Rig.Gb(rig.RamTotal);
                    string disk = Rig.Gb(rig.DiskUsed) + "/" + Rig.Gb(rig.DiskTotal);
                    DrawMiniStat(g, new Rectangle(rx, ry, rw, 28), "cpu", rig.CpuLoad.ToString() + "%", rig.CpuLoad / 100.0, sf, labelInk, valueInk);
                    ry += 40;
                    DrawMiniStat(g, new Rectangle(rx, ry, rw, 28), "ram", ram, rig.RamTotal > 0 ? rig.RamUsed / (double)rig.RamTotal : 0, sf, labelInk, valueInk);
                    ry += 40;
                    DrawMiniStat(g, new Rectangle(rx, ry, rw, 28), "disk", disk, rig.DiskTotal > 0 ? rig.DiskUsed / (double)rig.DiskTotal : 0, sf, labelInk, valueInk);
                    ry += 48;
                    using (var rule = new Pen(Color.FromArgb(28, 255, 255, 255), 1f)) {
                        g.DrawLine(rule, rx, ry, rr, ry);
                    }
                    ry += 16;
                    DrawBattery(g, rx, ry + 6, 28, 16, batT);
                    g.DrawString(batNum, specTitle, valueInk, new RectangleF(rx + 36, ry, rw - 36, 28), sf);
                    ry += 32;
                    g.DrawString(batTag, specSmall, accentInk, new RectangleF(rx, ry, rw, 16), sf);
                    ry += 20;
                    DrawTrack(g, new Rectangle(rx, ry, rw, 4), batT);
                }
            }
        }

        void DrawRigGrid(Graphics g) {
            Rectangle box = RigRect();
            using (var fill = new SolidBrush(Color.FromArgb(222, 6, 8, 14))) {
                g.FillRectangle(fill, box);
            }
            using (var rail = new SolidBrush(Color.FromArgb(230, state.Accent))) {
                g.FillRectangle(rail, box.X, box.Y, 2, box.Height);
            }
            using (var edge = new Pen(Color.FromArgb(28, 255, 255, 255), 1f)) {
                g.DrawRectangle(edge, box.X, box.Y, box.Width - 1, box.Height - 1);
            }

            double batT = 0;
            string batNum;
            string batTag;
            if (!rig.HasBattery) {
                batNum = "AC";
                batTag = rig.OnAc ? "plugged" : "power";
                batT = 1;
            } else {
                batNum = rig.BatPct >= 0 ? rig.BatPct.ToString() + "%" : "--";
                batTag = rig.Charging ? "charging" : (rig.OnAc ? "plugged" : "battery");
                if (rig.BatPct >= 0) batT = rig.BatPct / 100.0;
            }

            using (var sf = (StringFormat)StringFormat.GenericTypographic.Clone()) {
                sf.Alignment = StringAlignment.Near;
                sf.LineAlignment = StringAlignment.Center;
                sf.FormatFlags = StringFormatFlags.NoWrap;
                sf.Trimming = StringTrimming.EllipsisCharacter;
                int x = box.X + 24;
                int right = box.Right - 24;
                int y = box.Y + 20;
                int gap = 16;
                int colW = (right - x - gap) / 2;
                int labelW = 40;
                string theme = string.IsNullOrEmpty(state.Theme) ? "FOX" : state.Theme.ToUpperInvariant();
                using (var accentInk = new SolidBrush(state.Accent))
                using (var labelInk = new SolidBrush(Color.FromArgb(100, 118, 138)))
                using (var valueInk = new SolidBrush(Color.FromArgb(232, 235, 240)))
                using (var muteInk = new SolidBrush(Color.FromArgb(124, 140, 156))) {
                    g.DrawString("FOXOS", specSmall, accentInk, new RectangleF(x, y, 80, 16), sf);
                    SizeF th = g.MeasureString(theme, specSmall, PointF.Empty, sf);
                    g.DrawString(theme, specSmall, accentInk, new RectangleF(right - th.Width, y, th.Width + 2, 16), sf);
                    y += 20;
                    string host = Rig.Clip(string.IsNullOrEmpty(rig.Host) ? "machine" : rig.Host, 26);
                    g.DrawString(host, specTitle, valueInk, new RectangleF(x, y, right - x, 28), sf);
                    y += 30;
                    string meta = Rig.Clip(rig.User, 12) + "   ·   " + Rig.UpText(rig.Up);
                    if (!string.IsNullOrEmpty(rig.Net)) meta += "   ·   " + Rig.Clip(rig.Net, 16);
                    g.DrawString(meta, specSmall, muteInk, new RectangleF(x, y, right - x, 16), sf);
                    y += 22;
                    using (var rule = new Pen(Color.FromArgb(28, 255, 255, 255), 1f)) {
                        g.DrawLine(rule, x, y, right, y);
                    }
                    y += 16;
                    DrawBattery(g, x, y + 6, 30, 16, batT);
                    g.DrawString(batNum, specTitle, valueInk, new RectangleF(x + 40, y, 120, 28), sf);
                    SizeF numSz = g.MeasureString(batNum, specTitle, PointF.Empty, sf);
                    g.DrawString(batTag, specSmall, accentInk, new RectangleF(x + 40 + numSz.Width + 10, y + 6, 160, 16), sf);
                    y += 32;
                    DrawTrack(g, new Rectangle(x, y, right - x, 4), batT);
                    y += 18;
                    using (var rule = new Pen(Color.FromArgb(28, 255, 255, 255), 1f)) {
                        g.DrawLine(rule, x, y, right, y);
                    }
                    y += 14;
                    DrawSpecLine(g, sf, labelInk, valueInk, x, y, labelW, colW - labelW, "os", Rig.Clip(rig.Os, 20));
                    DrawSpecLine(g, sf, labelInk, valueInk, x + colW + gap, y, labelW, colW - labelW, "gpu", Rig.Clip(rig.Gpu, 20));
                    y += 26;
                    DrawSpecLine(g, sf, labelInk, valueInk, x, y, labelW, colW - labelW, "cpu", Rig.Clip(rig.Cpu, 20));
                    DrawSpecLine(g, sf, labelInk, valueInk, x + colW + gap, y, labelW, colW - labelW, "disp", rig.Disp);
                    y += 30;
                    using (var rule = new Pen(Color.FromArgb(28, 255, 255, 255), 1f)) {
                        g.DrawLine(rule, x, y, right, y);
                    }
                    y += 14;
                    int statGap = 14;
                    int statW = (right - x - statGap * 2) / 3;
                    string ram = Rig.Gb(rig.RamUsed) + "/" + Rig.Gb(rig.RamTotal);
                    string disk = Rig.Gb(rig.DiskUsed) + "/" + Rig.Gb(rig.DiskTotal);
                    DrawMiniStat(g, new Rectangle(x, y, statW, 28), "cpu", rig.CpuLoad.ToString() + "%", rig.CpuLoad / 100.0, sf, labelInk, valueInk);
                    DrawMiniStat(g, new Rectangle(x + statW + statGap, y, statW, 28), "ram", ram, rig.RamTotal > 0 ? rig.RamUsed / (double)rig.RamTotal : 0, sf, labelInk, valueInk);
                    DrawMiniStat(g, new Rectangle(x + (statW + statGap) * 2, y, statW, 28), "disk", disk, rig.DiskTotal > 0 ? rig.DiskUsed / (double)rig.DiskTotal : 0, sf, labelInk, valueInk);
                }
            }
        }

        void DrawRigSplit(Graphics g) {
            Rectangle box = RigRect();
            using (var fill = new SolidBrush(Color.FromArgb(222, 6, 8, 14))) {
                g.FillRectangle(fill, box);
            }
            using (var rail = new SolidBrush(Color.FromArgb(230, state.Accent))) {
                g.FillRectangle(rail, box.X, box.Y, 2, box.Height);
            }
            using (var edge = new Pen(Color.FromArgb(28, 255, 255, 255), 1f)) {
                g.DrawRectangle(edge, box.X, box.Y, box.Width - 1, box.Height - 1);
            }

            double batT = 0;
            string batNum;
            string batTag;
            if (!rig.HasBattery) {
                batNum = "AC";
                batTag = rig.OnAc ? "plugged" : "power";
                batT = 1;
            } else {
                batNum = rig.BatPct >= 0 ? rig.BatPct.ToString() + "%" : "--";
                batTag = rig.Charging ? "charging" : (rig.OnAc ? "plugged" : "battery");
                if (rig.BatPct >= 0) batT = rig.BatPct / 100.0;
            }

            int leftW = 92;
            int colX = box.X + 22;
            int colY = box.Y + 24;
            int colH = box.Height - 88;
            Rectangle cell = new Rectangle(colX + 22, colY + 10, 36, colH);
            using (var nub = new SolidBrush(Color.FromArgb(200, state.Accent))) {
                g.FillRectangle(nub, cell.X + cell.Width / 2 - 8, colY, 16, 6);
            }
            DrawVTrack(g, cell, batT);
            using (var cellEdge = new Pen(Color.FromArgb(180, state.Accent), 1.4f)) {
                g.DrawRectangle(cellEdge, cell);
            }
            using (var sfC = (StringFormat)StringFormat.GenericTypographic.Clone()) {
                sfC.Alignment = StringAlignment.Center;
                sfC.LineAlignment = StringAlignment.Center;
                using (var valueInk = new SolidBrush(Color.FromArgb(232, 235, 240)))
                using (var accentInk = new SolidBrush(state.Accent)) {
                    g.DrawString(batNum, specTitle, valueInk, new RectangleF(colX, box.Bottom - 54, leftW, 28), sfC);
                    g.DrawString(batTag, specSmall, accentInk, new RectangleF(colX - 8, box.Bottom - 28, leftW + 16, 16), sfC);
                }
            }

            using (var div = new Pen(Color.FromArgb(28, 255, 255, 255), 1f)) {
                g.DrawLine(div, box.X + 28 + leftW, box.Y + 22, box.X + 28 + leftW, box.Bottom - 22);
            }

            using (var sf = (StringFormat)StringFormat.GenericTypographic.Clone()) {
                sf.Alignment = StringAlignment.Near;
                sf.LineAlignment = StringAlignment.Center;
                sf.FormatFlags = StringFormatFlags.NoWrap;
                sf.Trimming = StringTrimming.EllipsisCharacter;
                int x = box.X + 36 + leftW;
                int right = box.Right - 22;
                int y = box.Y + 20;
                int labelW = 46;
                int valueW = right - x - labelW;
                string theme = string.IsNullOrEmpty(state.Theme) ? "FOX" : state.Theme.ToUpperInvariant();
                using (var accentInk = new SolidBrush(state.Accent))
                using (var labelInk = new SolidBrush(Color.FromArgb(100, 118, 138)))
                using (var valueInk = new SolidBrush(Color.FromArgb(232, 235, 240)))
                using (var muteInk = new SolidBrush(Color.FromArgb(124, 140, 156))) {
                    g.DrawString("FOXOS", specSmall, accentInk, new RectangleF(x, y, 80, 16), sf);
                    SizeF th = g.MeasureString(theme, specSmall, PointF.Empty, sf);
                    g.DrawString(theme, specSmall, accentInk, new RectangleF(right - th.Width, y, th.Width + 2, 16), sf);
                    y += 20;
                    string host = Rig.Clip(string.IsNullOrEmpty(rig.Host) ? "machine" : rig.Host, 22);
                    g.DrawString(host, specTitle, valueInk, new RectangleF(x, y, right - x, 28), sf);
                    y += 30;
                    string meta = Rig.Clip(rig.User, 12) + "   ·   " + Rig.UpText(rig.Up);
                    g.DrawString(meta, specSmall, muteInk, new RectangleF(x, y, right - x, 16), sf);
                    y += 22;
                    using (var rule = new Pen(Color.FromArgb(28, 255, 255, 255), 1f)) {
                        g.DrawLine(rule, x, y, right, y);
                    }
                    y += 12;
                    DrawSpecLine(g, sf, labelInk, valueInk, x, y, labelW, valueW, "os", Rig.Clip(rig.Os, 28));
                    y += 24;
                    DrawSpecLine(g, sf, labelInk, valueInk, x, y, labelW, valueW, "cpu", Rig.Clip(rig.Cpu, 28));
                    y += 24;
                    DrawSpecLine(g, sf, labelInk, valueInk, x, y, labelW, valueW, "gpu", Rig.Clip(rig.Gpu, 28));
                    y += 24;
                    DrawSpecLine(g, sf, labelInk, valueInk, x, y, labelW, valueW, "net", Rig.Clip(rig.Net, 22));
                    y += 24;
                    DrawSpecLine(g, sf, labelInk, valueInk, x, y, labelW, valueW, "disp", rig.Disp);
                    y += 26;
                    using (var rule = new Pen(Color.FromArgb(28, 255, 255, 255), 1f)) {
                        g.DrawLine(rule, x, y, right, y);
                    }
                    y += 14;
                    int trackW = right - x;
                    g.DrawString("cpu  " + rig.CpuLoad.ToString() + "%", specSmall, labelInk, new RectangleF(x, y, trackW, 16), sf);
                    y += 16;
                    DrawTrack(g, new Rectangle(x, y, trackW, 3), rig.CpuLoad / 100.0);
                    y += 14;
                    string ram = Rig.Gb(rig.RamUsed) + " / " + Rig.Gb(rig.RamTotal);
                    g.DrawString("ram  " + ram, specSmall, labelInk, new RectangleF(x, y, trackW, 16), sf);
                    y += 16;
                    DrawTrack(g, new Rectangle(x, y, trackW, 3), rig.RamTotal > 0 ? rig.RamUsed / (double)rig.RamTotal : 0);
                    y += 14;
                    string disk = rig.DiskName + "  " + Rig.Gb(rig.DiskUsed) + " / " + Rig.Gb(rig.DiskTotal);
                    g.DrawString("disk  " + disk, specSmall, labelInk, new RectangleF(x, y, trackW, 16), sf);
                    y += 16;
                    DrawTrack(g, new Rectangle(x, y, trackW, 3), rig.DiskTotal > 0 ? rig.DiskUsed / (double)rig.DiskTotal : 0);
                }
            }
        }

        void DrawRigAscii(Graphics g) {
            Rectangle box = RigRect();
            using (var fill = new SolidBrush(Color.FromArgb(222, 6, 8, 14))) {
                g.FillRectangle(fill, box);
            }
            using (var rail = new SolidBrush(Color.FromArgb(230, state.Accent))) {
                g.FillRectangle(rail, box.X, box.Y, 2, box.Height);
            }
            using (var edge = new Pen(Color.FromArgb(28, 255, 255, 255), 1f)) {
                g.DrawRectangle(edge, box.X, box.Y, box.Width - 1, box.Height - 1);
            }

            using (var sf = (StringFormat)StringFormat.GenericTypographic.Clone()) {
                sf.Alignment = StringAlignment.Near;
                sf.LineAlignment = StringAlignment.Center;
                sf.FormatFlags = StringFormatFlags.NoWrap;
                sf.Trimming = StringTrimming.None;
                SizeF em = g.MeasureString("M", specSmall, PointF.Empty, sf);
                int rowH = Math.Max(16, (int)Math.Ceiling(em.Height) + 4);
                int x = box.X + 20;
                int right = box.Right - 20;
                int y = box.Y + 16;
                int labelW = 46;
                int valueW = right - x - labelW;
                string theme = string.IsNullOrEmpty(state.Theme) ? "FOX" : state.Theme.ToUpperInvariant();
                double batT = 0;
                string batNum;
                string batTag;
                if (!rig.HasBattery) {
                    batNum = "AC";
                    batTag = rig.OnAc ? "plugged" : "power";
                    batT = 1;
                } else {
                    batNum = rig.BatPct >= 0 ? rig.BatPct.ToString() + "%" : "--";
                    batTag = rig.Charging ? "charging" : (rig.OnAc ? "plugged" : "battery");
                    if (rig.BatPct >= 0) batT = rig.BatPct / 100.0;
                }

                using (var accentInk = new SolidBrush(state.Accent))
                using (var labelInk = new SolidBrush(Color.FromArgb(100, 118, 138)))
                using (var valueInk = new SolidBrush(Color.FromArgb(230, 234, 240)))
                using (var muteInk = new SolidBrush(Color.FromArgb(124, 140, 156))) {
                    g.DrawString("FOXOS", specSmall, accentInk, new RectangleF(x, y, 80, rowH), sf);
                    SizeF th = g.MeasureString(theme, specSmall, PointF.Empty, sf);
                    g.DrawString(theme, specSmall, accentInk, new RectangleF(right - th.Width, y, th.Width + 2, rowH), sf);
                    y += rowH + 2;
                    string host = Rig.Clip(string.IsNullOrEmpty(rig.Host) ? "machine" : rig.Host, 26);
                    g.DrawString(host, specTitle, valueInk, new RectangleF(x, y, right - x, 30), sf);
                    y += 32;
                    string meta = Rig.Clip(rig.User, 14) + "   ·   " + Rig.UpText(rig.Up);
                    if (!string.IsNullOrEmpty(rig.Net)) meta += "   ·   " + Rig.Clip(rig.Net, 16);
                    g.DrawString(meta, specSmall, muteInk, new RectangleF(x, y, right - x, rowH), sf);
                    y += rowH + 8;
                    using (var rule = new Pen(Color.FromArgb(36, 255, 255, 255), 1f)) {
                        g.DrawLine(rule, x, y, right, y);
                    }
                    y += 12;
                    g.DrawString(batNum, specHuge, valueInk, new RectangleF(x, y, 160, 36), sf);
                    SizeF numSz = g.MeasureString(batNum, specHuge, PointF.Empty, sf);
                    g.DrawString(batTag, specSmall, accentInk, new RectangleF(x + numSz.Width + 12, y + 12, 180, rowH), sf);
                    y += 40;
                    DrawTrack(g, new Rectangle(x, y, right - x, 4), batT);
                    y += 16;
                    using (var rule = new Pen(Color.FromArgb(28, 255, 255, 255), 1f)) {
                        g.DrawLine(rule, x, y, right, y);
                    }
                    y += 12;
                    DrawSpecLine(g, sf, labelInk, valueInk, x, y, labelW, valueW, "os", Rig.Clip(rig.Os, 34));
                    y += 24;
                    DrawSpecLine(g, sf, labelInk, valueInk, x, y, labelW, valueW, "cpu", Rig.Clip(rig.Cpu, 34));
                    y += 24;
                    DrawSpecLine(g, sf, labelInk, valueInk, x, y, labelW, valueW, "gpu", Rig.Clip(rig.Gpu, 34));
                    y += 24;
                    DrawSpecLine(g, sf, labelInk, valueInk, x, y, labelW, valueW, "disp", rig.Disp);
                    y += 28;
                    using (var rule = new Pen(Color.FromArgb(28, 255, 255, 255), 1f)) {
                        g.DrawLine(rule, x, y, right, y);
                    }
                    y += 14;
                    int trackW = right - x;
                    g.DrawString("cpu", specSmall, labelInk, new RectangleF(x, y, 70, rowH), sf);
                    g.DrawString(rig.CpuLoad.ToString() + "%", specSmall, valueInk, new RectangleF(right - 40, y, 40, rowH), sf);
                    y += rowH;
                    DrawTrack(g, new Rectangle(x, y, trackW, 3), rig.CpuLoad / 100.0);
                    y += 14;
                    string ram = Rig.Gb(rig.RamUsed) + " / " + Rig.Gb(rig.RamTotal);
                    g.DrawString("ram", specSmall, labelInk, new RectangleF(x, y, 70, rowH), sf);
                    SizeF ramSz = g.MeasureString(ram, specSmall, PointF.Empty, sf);
                    g.DrawString(ram, specSmall, valueInk, new RectangleF(right - ramSz.Width, y, ramSz.Width + 2, rowH), sf);
                    y += rowH;
                    DrawTrack(g, new Rectangle(x, y, trackW, 3), rig.RamTotal > 0 ? rig.RamUsed / (double)rig.RamTotal : 0);
                    y += 14;
                    string disk = rig.DiskName + "  " + Rig.Gb(rig.DiskUsed) + " / " + Rig.Gb(rig.DiskTotal);
                    g.DrawString("disk", specSmall, labelInk, new RectangleF(x, y, 70, rowH), sf);
                    SizeF diskSz = g.MeasureString(disk, specSmall, PointF.Empty, sf);
                    g.DrawString(disk, specSmall, valueInk, new RectangleF(right - diskSz.Width, y, diskSz.Width + 2, rowH), sf);
                    y += rowH;
                    DrawTrack(g, new Rectangle(x, y, trackW, 3), rig.DiskTotal > 0 ? rig.DiskUsed / (double)rig.DiskTotal : 0);
                }
            }
        }

        void DrawRigCard(Graphics g) {
            Rectangle box = RigRect();
            using (var grad = new LinearGradientBrush(box,
                Color.FromArgb(218, 8, 11, 18),
                Color.FromArgb(188, 6, 8, 14),
                LinearGradientMode.Vertical)) {
                g.FillRectangle(grad, box);
            }
            using (var wash = new SolidBrush(Color.FromArgb(18, state.Accent))) {
                g.FillRectangle(wash, box.X, box.Y, box.Width, 48);
            }
            using (var rail = new SolidBrush(Color.FromArgb(230, state.Accent))) {
                g.FillRectangle(rail, box.X, box.Y, 2, box.Height);
            }
            using (var edge = new Pen(Color.FromArgb(22, 255, 255, 255), 1f)) {
                g.DrawRectangle(edge, box.X, box.Y, box.Width - 1, box.Height - 1);
            }
            using (var shine = new Pen(Color.FromArgb(30, 255, 255, 255), 1f)) {
                g.DrawLine(shine, box.X + 3, box.Y + 1, box.Right - 2, box.Y + 1);
            }

            using (var sf = (StringFormat)StringFormat.GenericTypographic.Clone()) {
                sf.Alignment = StringAlignment.Near;
                sf.LineAlignment = StringAlignment.Center;
                sf.FormatFlags = StringFormatFlags.NoWrap;
                sf.Trimming = StringTrimming.EllipsisCharacter;
                int x = box.X + 28;
                int right = box.Right - 28;
                int y = box.Y + 22;
                int labelW = 52;
                int valueW = right - x - labelW;
                using (var accentInk = new SolidBrush(state.Accent))
                using (var labelInk = new SolidBrush(Color.FromArgb(96, 114, 136)))
                using (var valueInk = new SolidBrush(Color.FromArgb(232, 235, 240)))
                using (var muteInk = new SolidBrush(Color.FromArgb(130, 146, 164))) {
                    DrawKicker(g, accentInk, x, y, "FOXOS");
                    string theme = string.IsNullOrEmpty(state.Theme) ? "FOX" : state.Theme.ToUpperInvariant();
                    SizeF th = g.MeasureString(theme, specSmall, PointF.Empty, sf);
                    g.DrawString(theme, specSmall, accentInk, right - th.Width, y, sf);
                    y += 22;
                    string host = Rig.Clip(string.IsNullOrEmpty(rig.Host) ? "machine" : rig.Host, 22);
                    g.DrawString(host, specTitle, valueInk, new RectangleF(x, y, right - x, 32), sf);
                    y += 34;
                    string meta = Rig.Clip(rig.User, 16) + "   ·   " + Rig.UpText(rig.Up);
                    if (!string.IsNullOrEmpty(rig.Net)) meta += "   ·   " + Rig.Clip(rig.Net, 16);
                    g.DrawString(meta, specSmall, muteInk, new RectangleF(x, y, right - x, 16), sf);
                    y += 26;
                    using (var rule = new Pen(Color.FromArgb(28, 255, 255, 255), 1f)) {
                        g.DrawLine(rule, x, y, right, y);
                    }
                    y += 16;
                    DrawSpecLine(g, sf, labelInk, valueInk, x, y, labelW, valueW, "os", Rig.Clip(rig.Os, 34));
                    y += 26;
                    DrawSpecLine(g, sf, labelInk, valueInk, x, y, labelW, valueW, "cpu", Rig.Clip(rig.Cpu, 34));
                    y += 26;
                    DrawSpecLine(g, sf, labelInk, valueInk, x, y, labelW, valueW, "gpu", Rig.Clip(rig.Gpu, 34));
                    y += 26;
                    DrawSpecLine(g, sf, labelInk, valueInk, x, y, labelW, valueW, "disp", rig.Disp);
                    y += 28;
                    using (var rule = new Pen(Color.FromArgb(22, 255, 255, 255), 1f)) {
                        g.DrawLine(rule, x, y, right, y);
                    }
                    y += 18;

                    int trackW = right - x;
                    g.DrawString("cpu", specSmall, labelInk, new RectangleF(x, y, 70, 16), sf);
                    g.DrawString(rig.CpuLoad.ToString() + "%", specSmall, valueInk, new RectangleF(right - 48, y, 48, 16), sf);
                    y += 18;
                    DrawTrack(g, new Rectangle(x, y, trackW, 3), rig.CpuLoad / 100.0);
                    y += 18;
                    string ram = Rig.Gb(rig.RamUsed) + " / " + Rig.Gb(rig.RamTotal);
                    g.DrawString("ram", specSmall, labelInk, new RectangleF(x, y, 70, 16), sf);
                    SizeF ramSz = g.MeasureString(ram, specSmall, PointF.Empty, sf);
                    g.DrawString(ram, specSmall, valueInk, new RectangleF(right - ramSz.Width, y, ramSz.Width + 2, 16), sf);
                    y += 18;
                    DrawTrack(g, new Rectangle(x, y, trackW, 3), rig.RamTotal > 0 ? rig.RamUsed / (double)rig.RamTotal : 0);
                    y += 18;
                    string disk = rig.DiskName + "  " + Rig.Gb(rig.DiskUsed) + " / " + Rig.Gb(rig.DiskTotal);
                    g.DrawString("disk", specSmall, labelInk, new RectangleF(x, y, 70, 16), sf);
                    SizeF diskSz = g.MeasureString(disk, specSmall, PointF.Empty, sf);
                    g.DrawString(disk, specSmall, valueInk, new RectangleF(right - diskSz.Width, y, diskSz.Width + 2, 16), sf);
                    y += 18;
                    DrawTrack(g, new Rectangle(x, y, trackW, 3), rig.DiskTotal > 0 ? rig.DiskUsed / (double)rig.DiskTotal : 0);
                    y += 28;
                    using (var rule = new Pen(Color.FromArgb(22, 255, 255, 255), 1f)) {
                        g.DrawLine(rule, x, y, right, y);
                    }
                    y += 18;

                    double batT = 0;
                    string batNum;
                    string batTag;
                    if (!rig.HasBattery) {
                        batNum = "AC";
                        batTag = rig.OnAc ? "plugged in" : "power";
                        batT = 1;
                    } else {
                        batNum = rig.BatPct >= 0 ? rig.BatPct.ToString() + "%" : "--";
                        batTag = rig.Charging ? "charging" : (rig.OnAc ? "plugged in" : "on battery");
                        if (rig.BatPct >= 0) batT = rig.BatPct / 100.0;
                    }
                    DrawBattery(g, x, y + 8, 54, 26, batT);
                    g.DrawString(batNum, specHuge, valueInk, new RectangleF(x + 68, y, 160, 40), sf);
                    SizeF numSz = g.MeasureString(batNum, specHuge, PointF.Empty, sf);
                    g.DrawString(batTag, specSmall, accentInk, new RectangleF(x + 68 + numSz.Width + 10, y + 14, 180, 16), sf);
                }
            }
        }
        protected override void Dispose(bool disposing) {
            if (disposing) {
                try { PaintChrome(true); } catch { }
                KillDocks();
                KillChrome();
                if (mediaStrip != null && !mediaStrip.IsDisposed) {
                    try { mediaStrip.Close(); mediaStrip.Dispose(); } catch { }
                    mediaStrip = null;
                }
                if (helpWin != null && !helpWin.IsDisposed) helpWin.Close();
                if (timer != null) timer.Dispose();
                if (promptFont != null) promptFont.Dispose();
                if (specFont != null) specFont.Dispose();
                if (specTitle != null) specTitle.Dispose();
                if (specSmall != null) specSmall.Dispose();
                if (specHuge != null) specHuge.Dispose();
                if (deskClock != null) deskClock.Dispose();
                if (font != null) font.Dispose();
                if (rainFmt != null) rainFmt.Dispose();
                DropGlyphs();
                DropPanels();
                if (rainBrushes != null) foreach (var b in rainBrushes) if (b != null) b.Dispose();
                if (foxBmp != null) foxBmp.Dispose();
            }
            base.Dispose(disposing);
        }
    }

    static class Program {
        [DllImport("user32.dll")]
        static extern bool SetProcessDPIAware();

        [STAThread]
        static void Main(string[] args) {
            try { SetProcessDPIAware(); } catch { }
            bool created;
            using (var mutex = new Mutex(true, "FoxTerminal.FoxOsLive", out created)) {
                if (!created) return;
                string state = args.Length > 0 ? args[0] : Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "FoxTerminal", "foxos", "live.json");
                try {
                    Directory.CreateDirectory(Path.GetDirectoryName(state));
                    File.WriteAllText(Path.Combine(Path.GetDirectoryName(state), "live.pid"),
                        System.Diagnostics.Process.GetCurrentProcess().Id.ToString());
                } catch { }
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                Application.Run(new Wall(state));
            }
        }
    }
}
