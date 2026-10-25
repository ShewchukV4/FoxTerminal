using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows.Forms;

namespace FoxOsLive {
    sealed class FoxWin {
        public IntPtr Hwnd;
        public string Title;
        public string Mark;
        public Image Face;
        public Rectangle Slot;
    }

    sealed class FoxPin {
        public string Id;
        public string Title;
        public string Path;
        public string Act;
        public Image Face;
        public Rectangle Slot;
        public IntPtr Live;
    }

    static class FoxAudio {
        public static void VolUp() { Key(0xAF); }
        public static void VolDown() { Key(0xAE); }
        public static void VolMute() { Key(0xAD); }

        static void Key(byte vk) {
            Native.keybd_event(vk, 0, 0, UIntPtr.Zero);
            Native.keybd_event(vk, 0, 2, UIntPtr.Zero);
        }

        public static int GetPct() {
            IAudioEndpointVolume vol = null;
            try {
                vol = Open();
                if (vol == null) return -1;
                float v;
                vol.GetMasterVolumeLevelScalar(out v);
                bool mute;
                vol.GetMute(out mute);
                if (mute) return 0;
                int n = (int)Math.Round(v * 100.0);
                if (n < 0) n = 0;
                if (n > 100) n = 100;
                return n;
            } catch {
                return -1;
            } finally {
                if (vol != null) Marshal.ReleaseComObject(vol);
            }
        }

        public static bool GetMute() {
            IAudioEndpointVolume vol = null;
            try {
                vol = Open();
                if (vol == null) return false;
                bool mute;
                vol.GetMute(out mute);
                return mute;
            } catch { return false; }
            finally { if (vol != null) Marshal.ReleaseComObject(vol); }
        }

        public static void SetPct(int pct) {
            if (pct < 0) pct = 0; if (pct > 100) pct = 100;
            IAudioEndpointVolume vol = null;
            try {
                vol = Open();
                if (vol == null) return;
                Guid ctx = Guid.Empty;
                vol.SetMute(false, ctx);
                vol.SetMasterVolumeLevelScalar(pct / 100f, ctx);
            } catch { }
            finally { if (vol != null) Marshal.ReleaseComObject(vol); }
        }

        static IAudioEndpointVolume Open() {
            IMMDeviceEnumerator en = null;
            IMMDevice dev = null;
            try {
                en = (IMMDeviceEnumerator)new MMDeviceEnumeratorCom();
                en.GetDefaultAudioEndpoint(0, 1, out dev);
                if (dev == null) return null;
                Guid iid = typeof(IAudioEndpointVolume).GUID;
                object o;
                dev.Activate(ref iid, 1, IntPtr.Zero, out o);
                return o as IAudioEndpointVolume;
            } catch {
                return null;
            } finally {
                if (dev != null) Marshal.ReleaseComObject(dev);
                if (en != null) Marshal.ReleaseComObject(en);
            }
        }

        [ComImport]
        [Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
        class MMDeviceEnumeratorCom { }

        [Guid("A95664D2-9614-4F35-A746-DE8DB63617E6")]
        [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        interface IMMDeviceEnumerator {
            void NotImpl1();
            [PreserveSig]
            int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice ppDevice);
        }

        [Guid("D666063F-1587-4E43-81F1-B948E807363F")]
        [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        interface IMMDevice {
            [PreserveSig]
            int Activate(ref Guid iid, int dwClsCtx, IntPtr pActivationParams,
                [MarshalAs(UnmanagedType.IUnknown)] out object ppInterface);
        }

        [Guid("5CDF2C82-841E-4546-9722-0CF74078229A")]
        [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        interface IAudioEndpointVolume {
            int RegisterControlChangeNotify(IntPtr p);
            int UnregisterControlChangeNotify(IntPtr p);
            int GetChannelCount(out int n);
            int SetMasterVolumeLevel(float db, Guid ctx);
            int SetMasterVolumeLevelScalar(float v, Guid ctx);
            int GetMasterVolumeLevel(out float db);
            int GetMasterVolumeLevelScalar(out float v);
            int SetChannelVolumeLevel(uint ch, float db, Guid ctx);
            int SetChannelVolumeLevelScalar(uint ch, float v, Guid ctx);
            int GetChannelVolumeLevel(uint ch, out float db);
            int GetChannelVolumeLevelScalar(uint ch, out float v);
            int SetMute([MarshalAs(UnmanagedType.Bool)] bool mute, Guid ctx);
            int GetMute(out bool mute);
        }
    }

    sealed class ShellBar : Form {
        public static int LastBarH = 52;
        const int MenuW = 280;
        const int MenuRow = 36;

        static readonly string[] MenuActs = { "term", "home", "foxlife", "foxstyle", "mirror", "ytm", "settings", "files", "sites", "lock", "off", "windows" };
        static readonly string[] MenuLabels = { "term", "home", "foxlife", "foxstyle", "mirror", "music", "settings", "files", "sites", "lock", "power off", "restore windows" };

        readonly State state;
        readonly Action<string> runDesk;
        readonly IntPtr wallHwnd;
        readonly string foxosDir;
        readonly Screen screen;
        readonly Font font;
        readonly Font small;
        readonly Font micro;
        readonly Font clockFont;
        readonly Font iconFont;
        readonly Dictionary<string, Image> faces = new Dictionary<string, Image>();
        readonly ToolTip tips = new ToolTip();
        readonly ThumbPeek peek = new ThumbPeek();
        WifiBoard wifiWin;
        VolumeBoard volWin;
        BatteryBoard batWin;
        BrightBoard brightWin;
        BluetoothBoard btWin;
        ReminderBoard remWin;
        readonly System.Windows.Forms.Timer timer;
        Image foxMark;

        bool dying;
        bool menuOpen;
        bool collapsed;
        List<FoxWin> wins = new List<FoxWin>();
        readonly List<FoxPin> pins = new List<FoxPin>();
        DateTime lastHideBar;
        DateTime lastEnum;
        int volPct = -1;
        string net = "";
        int bat = -1;
        bool onAc;
        Rectangle foxR, volR, wifiR, batR, clockR, btR, barR;
        DateTime lastRig;
        int hoverKind; // 0 none, 1 fox, 2 vol, 3 wifi, 4 bat, 5 clock, 6 bt, 10+ window index
        int lastPlaceKey;
        bool blurOn;
        int lastClockMin = -1;
        int lastVolDraw = -2;
        string lastNetDraw = "";
        int lastBatDraw = -2;
        int lastWinSig;
        int bounceKind;
        float bounce = 1f;
        int dragPin = -1;
        Point dragStart;
        bool dragging;

        public ShellBar(State state, Action<string> runDesk, IntPtr wallHwnd, string foxosDir, Screen screen) {
            this.state = state;
            this.runDesk = runDesk;
            this.wallHwnd = wallHwnd;
            this.foxosDir = foxosDir ?? "";
            this.screen = screen ?? Screen.PrimaryScreen;
            Text = "FoxOS Dock";
            FormBorderStyle = FormBorderStyle.None;
            ShowInTaskbar = false;
            StartPosition = FormStartPosition.Manual;
            TopMost = true;
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint | ControlStyles.OptimizedDoubleBuffer, true);
            BackColor = Color.FromArgb(255, 1, 2, 3);
            TransparencyKey = Color.FromArgb(255, 1, 2, 3);
            DoubleBuffered = true;
            font = new Font("Consolas", 13f, FontStyle.Bold, GraphicsUnit.Pixel);
            small = new Font("Consolas", 12f, FontStyle.Regular, GraphicsUnit.Pixel);
            micro = new Font("Consolas", 10f, FontStyle.Regular, GraphicsUnit.Pixel);
            clockFont = new Font("Consolas", 13f, FontStyle.Bold, GraphicsUnit.Pixel);
            iconFont = IconFamily(16f);
            tips.ShowAlways = false;
            tips.InitialDelay = 280;
            AllowDrop = true;
            LoadPins();
            Place(false);
            HideWinBar();
            timer = new System.Windows.Forms.Timer();
            timer.Interval = 250;
            timer.Tick += delegate {
                bool dirty = false;
                if ((DateTime.UtcNow - lastEnum).TotalMilliseconds > 800) {
                    int sig = lastWinSig;
                    EnumWins();
                    if (lastWinSig != sig) dirty = true;
                }
                if ((DateTime.UtcNow - lastRig).TotalMilliseconds > 2000) {
                    lastRig = DateTime.UtcNow;
                    int v = FoxAudio.GetPct();
                    ReadRig();
                    if (v != lastVolDraw || bat != lastBatDraw || net != lastNetDraw) {
                        volPct = v;
                        lastVolDraw = v;
                        lastBatDraw = bat;
                        lastNetDraw = net;
                        dirty = true;
                    } else volPct = v;
                }
                if ((DateTime.UtcNow - lastHideBar).TotalMilliseconds > 1200) {
                    lastHideBar = DateTime.UtcNow;
                    HideWinBar();
                }
                TickHide();
                if (PlaceKey() != lastPlaceKey) { Place(menuOpen); dirty = true; }
                int min = DateTime.Now.Minute;
                if (min != lastClockMin) { lastClockMin = min; dirty = true; }
                TickPanelFocus();
                if (bounce != 1f) {
                    bounce += (1f - bounce) * 0.32f;
                    if (Math.Abs(bounce - 1f) < 0.02f) {
                        bounce = 1f;
                        timer.Interval = 50;
                    } else timer.Interval = 16;
                    dirty = true;
                } else if (timer.Interval != 50) timer.Interval = 50;
                dirty = true; // desk breathe
                if (dirty) Invalidate();
            };
            Shown += delegate {
                TryBlur();
                timer.Start();
            };
        }

        protected override CreateParams CreateParams {
            get {
                var cp = base.CreateParams;
                cp.ExStyle |= Native.WS_EX_TOOLWINDOW;
                return cp;
            }
        }

        public void Kill() {
            dying = true;
            try { Close(); } catch { }
        }

        protected override void OnFormClosing(FormClosingEventArgs e) {
            if (!dying && e.CloseReason == CloseReason.UserClosing) e.Cancel = true;
        }

        string Style() {
            string s = state.DockStyle ?? "pill";
            if (s == "bar") return "rail"; // FOXSTYLE "bar" = full-width
            if (s == "rail" || s == "glass" || s == "slim") return s;
            return "pill";
        }
        bool TopBar() { return state.DockPos == "top"; }
        string WinsMode() {
            string s = state.DockWins ?? "titles";
            if (s == "dots" || s == "off") return s;
            return "titles";
        }
        string TrayMode() {
            string s = state.DockTray ?? "full";
            if (s == "off" || s == "clock") return "off";
            return "full";
        }
        int BarH() {
            // FOXSTYLE Chrome → Height (exact px)
            if (state.DockBarH >= 36) return Math.Max(40, Math.Min(88, state.DockBarH));
            if (Style() == "slim") return 52;
            if (state.DockSize == "compact") return 58;
            if (state.DockSize == "large") return 74;
            return 66;
        }
        int Halo() { return 0; }
        int Radius() {
            if (state.DockRadius >= 0) return Math.Min(state.DockRadius, BarH() / 2);
            if (Style() == "rail") return 0;
            return BarH() / 2;
        }
        int IconPx() {
            if (state.DockBarH >= 36) {
                int h = BarH();
                if (h >= 74) return 44;
                if (h <= 48) return 30;
                return 36;
            }
            if (Style() == "slim" || state.DockSize == "compact") return 32;
            if (state.DockSize == "large") return 44;
            return 38;
        }
        int IslandW(int screenW) {
            if (Style() == "rail") return screenW;
            int n = WinsMode() == "off" ? 0 : Math.Min(wins.Count, 12);
            int ic = IconPx();
            int tray = TrayMode() == "full" ? 130 : 0; // bt+wifi+vol+bat with spacing
            int pinsN = pins.Count > 0 ? pins.Count : 3;
            int cells = 1 + pinsN + n;
            int w = 22 + cells * (ic + 12) + tray + 22;
            if (w < 260) w = 260;
            if (w > screenW - 200) w = screenW - 200;
            return w;
        }
        int PlaceKey() {
            int k = BarH();
            k = k * 31 + Style().GetHashCode();
            k = k * 31 + (TopBar() ? 1 : 0);
            k = k * 31 + (state.DockHide ? 1 : 0);
            k = k * 31 + state.DockPad;
            k = k * 31 + state.DockBarH;
            k = k * 31 + state.DockBlur;
            k = k * 31 + state.DockAlpha;
            k = k * 31 + (collapsed ? 1 : 0);
            k = k * 31 + (menuOpen ? 1 : 0);
            k = k * 31 + wins.Count;
            k = k * 31 + TrayMode().GetHashCode();
            k = k * 31 + WinsMode().GetHashCode();
            k = k * 31 + screen.Bounds.Width;
            k = k * 31 + screen.Bounds.X;
            return k;
        }

        [StructLayout(LayoutKind.Sequential)]
        struct BlurBehind {
            public uint Flags;
            public int Enable;
            public IntPtr Region;
            public int Transition;
        }
        [DllImport("dwmapi.dll")]
        static extern int DwmEnableBlurBehindWindow(IntPtr h, ref BlurBehind b);
        [DllImport("user32.dll")]
        static extern IntPtr SendMessage(IntPtr h, uint msg, IntPtr w, IntPtr l);
        [DllImport("user32.dll")]
        static extern bool DestroyIcon(IntPtr h);
        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
        struct SHFILEINFO {
            public IntPtr hIcon;
            public int iIcon;
            public uint dwAttributes;
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)]
            public string szDisplayName;
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 80)]
            public string szTypeName;
        }
        [DllImport("shell32.dll", CharSet = CharSet.Auto)]
        static extern IntPtr SHGetFileInfo(string path, uint fa, ref SHFILEINFO fi, uint size, uint flags);
        [DllImport("shell32.dll", CharSet = CharSet.Auto)]
        static extern uint ExtractIconEx(string file, int index, out IntPtr large, out IntPtr small, uint n);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        static extern int PrivateExtractIcons(string file, int index, int cx, int cy, [Out] IntPtr[] icons, [Out] int[] ids, int n, int flags);
        [DllImport("user32.dll", EntryPoint = "GetClassLongPtrW")]
        static extern IntPtr GetClassLongPtr(IntPtr h, int n);
        [DllImport("kernel32.dll")]
        static extern IntPtr OpenProcess(uint access, bool inherit, uint pid);
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
        static extern bool QueryFullProcessImageName(IntPtr h, int flags, StringBuilder path, ref int size);
        [DllImport("kernel32.dll")]
        static extern bool CloseHandle(IntPtr h);
        [DllImport("user32.dll")]
        static extern bool GetIconInfo(IntPtr icon, out IconInfo info);
        [DllImport("user32.dll")]
        static extern bool DrawIconEx(IntPtr hdc, int x, int y, IntPtr icon, int cx, int cy, int step, IntPtr flicker, int flags);
        [DllImport("gdi32.dll")]
        static extern int GetObject(IntPtr h, int sz, out GdiBitmap bmp);
        [DllImport("gdi32.dll")]
        static extern bool DeleteObject(IntPtr h);

        [StructLayout(LayoutKind.Sequential)]
        struct IconInfo {
            public bool Icon;
            public int HotX;
            public int HotY;
            public IntPtr Mask;
            public IntPtr Color;
        }
        [StructLayout(LayoutKind.Sequential)]
        struct GdiBitmap {
            public int Type;
            public int Width;
            public int Height;
            public int WidthBytes;
            public short Planes;
            public short BitCount;
            public IntPtr Bits;
        }

        [StructLayout(LayoutKind.Sequential)]
        struct AccentPolicy {
            public int AccentState;
            public int AccentFlags;
            public int GradientColor;
            public int AnimationId;
        }
        [StructLayout(LayoutKind.Sequential)]
        struct WinComp {
            public int Attribute;
            public IntPtr Data;
            public int SizeOfData;
        }
        [DllImport("user32.dll")]
        static extern int SetWindowCompositionAttribute(IntPtr h, ref WinComp data);

        static Font IconFamily(float px) {
            try {
                var fluent = new Font("Segoe Fluent Icons", px, FontStyle.Regular, GraphicsUnit.Pixel);
                if (string.Equals(fluent.Name, "Segoe Fluent Icons", StringComparison.OrdinalIgnoreCase)) return fluent;
                fluent.Dispose();
            } catch { }
            return new Font("Segoe MDL2 Assets", px, FontStyle.Regular, GraphicsUnit.Pixel);
        }

        protected override void OnPaintBackground(PaintEventArgs e) { }

        Image FaceOf(IntPtr hwnd, uint pid) {
            string key = pid.ToString();
            try {
                using (var p = Process.GetProcessById((int)pid)) {
                    if (p.ProcessName != null) key = p.ProcessName.ToLowerInvariant();
                }
            } catch { }
            Image cached;
            if (faces.TryGetValue(key, out cached) && cached != null) return cached;
            Image img = GrabFace(hwnd, pid);
            if (img != null) faces[key] = img;
            return img;
        }

        Image GrabFace(IntPtr hwnd, uint pid) {
            string path = ExePath(pid);
            Image fromFile = FromFileIcon(path);
            if (fromFile != null) return fromFile;
            IntPtr h = SendMessage(hwnd, 0x007F, new IntPtr(1), IntPtr.Zero);
            if (h == IntPtr.Zero) h = GetClassLongPtr(hwnd, -14);
            if (h != IntPtr.Zero) return CopyIcon(h, false);
            h = SendMessage(hwnd, 0x007F, new IntPtr(0), IntPtr.Zero);
            if (h != IntPtr.Zero) return CopyIcon(h, false);
            return null;
        }

        static string ExePath(uint pid) {
            try {
                using (var p = Process.GetProcessById((int)pid)) {
                    if (p.MainModule != null && !string.IsNullOrEmpty(p.MainModule.FileName))
                        return p.MainModule.FileName;
                }
            } catch { }
            IntPtr h = OpenProcess(0x1000, false, pid);
            if (h == IntPtr.Zero) return "";
            try {
                var sb = new StringBuilder(512);
                int n = sb.Capacity;
                if (QueryFullProcessImageName(h, 0, sb, ref n)) return sb.ToString();
            } catch { } finally {
                CloseHandle(h);
            }
            return "";
        }

        static Image FromFileIcon(string path) {
            if (string.IsNullOrEmpty(path) || !System.IO.File.Exists(path)) return null;
            Image img = ExtractSized(path, 256);
            if (img != null) return img;
            img = ExtractSized(path, 48);
            if (img != null) return img;
            IntPtr large, small;
            if (ExtractIconEx(path, 0, out large, out small, 1) > 0 && large != IntPtr.Zero) {
                if (small != IntPtr.Zero) try { DestroyIcon(small); } catch { }
                return CopyIcon(large, true);
            }
            var fi = new SHFILEINFO();
            SHGetFileInfo(path, 0, ref fi, (uint)Marshal.SizeOf(typeof(SHFILEINFO)), 0x100);
            if (fi.hIcon == IntPtr.Zero) return null;
            return CopyIcon(fi.hIcon, true);
        }

        static Image ExtractSized(string path, int px) {
            var icons = new IntPtr[1];
            var ids = new int[1];
            try {
                if (PrivateExtractIcons(path, 0, px, px, icons, ids, 1, 0) < 1 || icons[0] == IntPtr.Zero)
                    return null;
                return CopyIcon(icons[0], true);
            } catch {
                return null;
            }
        }

        static Image CopyIcon(IntPtr h, bool destroy) {
            try {
                int cx = 256, cy = 256;
                IconInfo ii;
                if (GetIconInfo(h, out ii)) {
                    GdiBitmap bm;
                    if (ii.Color != IntPtr.Zero && GetObject(ii.Color, Marshal.SizeOf(typeof(GdiBitmap)), out bm) != 0) {
                        if (bm.Width > 0) { cx = bm.Width; cy = bm.Height; }
                    }
                    if (ii.Color != IntPtr.Zero) DeleteObject(ii.Color);
                    if (ii.Mask != IntPtr.Zero) DeleteObject(ii.Mask);
                }
                var raw = new Bitmap(cx, cy, System.Drawing.Imaging.PixelFormat.Format32bppPArgb);
                using (var g = Graphics.FromImage(raw)) {
                    g.Clear(Color.Transparent);
                    IntPtr hdc = g.GetHdc();
                    try { DrawIconEx(hdc, 0, 0, h, cx, cy, 0, IntPtr.Zero, 3); }
                    finally { g.ReleaseHdc(hdc); }
                }
                Image scaled = ScaleFace(raw);
                raw.Dispose();
                return scaled;
            } catch {
                return null;
            } finally {
                if (destroy) try { DestroyIcon(h); } catch { }
            }
        }

        static Image ScaleFace(Image src) {
            const int n = 64;
            var bmp = new Bitmap(n, n, System.Drawing.Imaging.PixelFormat.Format32bppPArgb);
            using (var g = Graphics.FromImage(bmp)) {
                g.Clear(Color.Transparent);
                g.InterpolationMode = src.Width >= n ? InterpolationMode.HighQualityBicubic : InterpolationMode.NearestNeighbor;
                g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                g.CompositingQuality = CompositingQuality.HighQuality;
                g.SmoothingMode = SmoothingMode.HighQuality;
                g.DrawImage(src, 0, 0, n, n);
            }
            return bmp;
        }

        static readonly Color Choke = Color.FromArgb(255, 1, 2, 3);

        void TryBlur() {
            // IMPORTANT: real DWM acrylic (AccentState=4) eats mouse clicks on Win11.
            // Never enable acrylic. TransparencyKey + WM_NCHITTEST keep island clickable.
            try { SetAccent(0, 0); } catch { }
            blurOn = state.DockBlur > 0 && Style() != "rail";
            BackColor = Choke;
            TransparencyKey = Choke;
            Opacity = 1.0;
        }

        protected override void WndProc(ref Message m) {
            // Force hit-test on logical dock/menu even if glass pixels match TransparencyKey.
            if (m.Msg == 0x0084) { // WM_NCHITTEST
                long lp = m.LParam.ToInt64();
                int sx = (short)(lp & 0xFFFF);
                int sy = (short)((lp >> 16) & 0xFFFF);
                Point pt = PointToClient(new Point(sx, sy));
                if (collapsed) {
                    m.Result = new IntPtr(1); // HTCLIENT
                    return;
                }
                if (PillRect().Contains(pt)) { m.Result = new IntPtr(1); return; }
                if (menuOpen) {
                    int menuTop = MenuTop();
                    var menu = new Rectangle(0, menuTop, MenuW + 8, MenuActs.Length * MenuRow + 8);
                    if (menu.Contains(pt)) { m.Result = new IntPtr(1); return; }
                }
                m.Result = new IntPtr(-1); // HTTRANSPARENT
                return;
            }
            base.WndProc(ref m);
        }

        void SetAccent(int stateCode, uint gradient) {
            try {
                var acc = new AccentPolicy();
                acc.AccentState = stateCode;
                acc.AccentFlags = 2;
                acc.GradientColor = unchecked((int)gradient);
                int sz = Marshal.SizeOf(typeof(AccentPolicy));
                IntPtr p = Marshal.AllocHGlobal(sz);
                try {
                    Marshal.StructureToPtr(acc, p, false);
                    var data = new WinComp();
                    data.Attribute = 19;
                    data.Data = p;
                    data.SizeOfData = sz;
                    SetWindowCompositionAttribute(Handle, ref data);
                } finally {
                    Marshal.FreeHGlobal(p);
                }
            } catch { }
        }

        void Place(bool menu) {
            menuOpen = menu;
            Rectangle sb = screen.Bounds;
            string st = Style();
            int pad = (st == "rail") ? 0 : 10;
            if (state.DockPad >= 0) pad = state.DockPad;
            int barH = BarH();
            LastBarH = barH;
            int menuH = (menu && !collapsed) ? (MenuActs.Length * MenuRow + 10) : 0;
            int h = collapsed ? 6 : (barH + menuH);
            int w = collapsed ? 72 : IslandW(sb.Width);
            if (menu && w < MenuW + 20) w = MenuW + 20;
            int x = sb.X + (sb.Width - w) / 2;
            if (st == "rail") { x = sb.X; w = sb.Width; }
            int y = TopBar() ? (sb.Y + pad) : (sb.Bottom - h - pad);
            Bounds = new Rectangle(x, y, w, h);
            lastPlaceKey = PlaceKey();
            TryBlur();
            ShapeIsland();
        }

        void ShapeIsland() {
            if (Region != null) { Region.Dispose(); Region = null; }
        }

        void TickHide() {
            if (!state.DockHide || menuOpen) {
                if (collapsed) { collapsed = false; Place(false); }
                return;
            }
            Point c = Cursor.Position;
            bool over = Bounds.Contains(c);
            Rectangle sb = screen.Bounds;
            int edge = TopBar() ? sb.Y + 6 : sb.Bottom - 6;
            bool edgeHit = TopBar() ? (c.Y <= edge) : (c.Y >= edge);
            bool want = !(over || edgeHit);
            if (want != collapsed) {
                collapsed = want;
                Place(false);
            }
        }

        void ReadRig() {
            try {
                PowerStatus ps = SystemInformation.PowerStatus;
                bool has = (ps.BatteryChargeStatus & BatteryChargeStatus.NoSystemBattery) == 0;
                onAc = ps.PowerLineStatus == PowerLineStatus.Online;
                if (has && ps.BatteryLifePercent >= 0f && ps.BatteryLifePercent <= 1.01f)
                    bat = (int)Math.Round(ps.BatteryLifePercent * 100.0);
                else
                    bat = -1;
            } catch { }
            try {
                net = "";
                foreach (System.Net.NetworkInformation.NetworkInterface nic in
                    System.Net.NetworkInformation.NetworkInterface.GetAllNetworkInterfaces()) {
                    if (nic.OperationalStatus != System.Net.NetworkInformation.OperationalStatus.Up) continue;
                    if (nic.NetworkInterfaceType == System.Net.NetworkInformation.NetworkInterfaceType.Loopback) continue;
                    if (nic.NetworkInterfaceType == System.Net.NetworkInformation.NetworkInterfaceType.Wireless80211) {
                        net = "wifi";
                        break;
                    }
                    if (net.Length == 0) net = "lan";
                }
                if (net.Length == 0) net = "off";
            } catch { net = ""; }
        }

        void EnumWins() {
            lastEnum = DateTime.UtcNow;
            for (int i = 0; i < pins.Count; i++) pins[i].Live = IntPtr.Zero;
            var next = new List<FoxWin>();
            IntPtr self = IntPtr.Zero;
            try { self = Handle; } catch { }
            Native.EnumWindows(delegate(IntPtr h, IntPtr l) {
                if (h == self || h == wallHwnd) return true;
                if (!Native.IsWindowVisible(h)) return true;
                int ex = Native.GetWindowLong(h, Native.GWL_EXSTYLE);
                if ((ex & Native.WS_EX_TOOLWINDOW) != 0) return true;
                int st = Native.GetWindowLong(h, Native.GWL_STYLE);
                if ((st & Native.WS_CAPTION) == 0) return true;
                var cls = new StringBuilder(64);
                Native.GetClassName(h, cls, cls.Capacity);
                if (Wall.SkipChromeClass(cls.ToString())) return true;
                uint cloaked;
                if (Native.DwmGetWindowAttribute(h, Native.DWMWA_CLOAKED, out cloaked, 4) == 0 && cloaked != 0) return true;
                var title = new StringBuilder(200);
                Native.GetWindowText(h, title, title.Capacity);
                string t = (title.ToString() ?? "").Trim();
                if (t.Length == 0) return true;
                if (t == "FoxOS Dock" || t == "FoxOS Live") return true;
                uint pid;
                Native.GetWindowThreadProcessId(h, out pid);
                try {
                    using (var p = Process.GetProcessById((int)pid)) {
                        string n = (p.ProcessName ?? "").ToLowerInvariant();
                        if (n == "foxos-live") return true;
                    }
                } catch { }
                string proc = "";
                try {
                    using (var p = Process.GetProcessById((int)pid)) proc = (p.ProcessName ?? "").ToLowerInvariant();
                } catch { }
                bool pinned = false;
                for (int i = 0; i < pins.Count; i++) {
                    if (!PinName(proc, pins[i].Id)) continue;
                    pins[i].Live = h;
                    pinned = true;
                    break;
                }
                if (pinned) return true;
                FoxWin w = new FoxWin();
                w.Hwnd = h;
                w.Title = Rig.Clip(t, 28);
                w.Mark = WinMark(t, pid);
                w.Face = FaceOf(h, pid);
                next.Add(w);
                return next.Count < 16;
            }, IntPtr.Zero);
            wins = next;
            int sig = next.Count;
            for (int i = 0; i < next.Count; i++) sig = sig * 31 + next[i].Hwnd.GetHashCode();
            lastWinSig = sig;
        }

        int HitKind(Point p) {
            if (foxR.Contains(p)) return 1;
            if (volR.Contains(p)) return 2;
            if (wifiR.Contains(p)) return 3;
            if (batR.Contains(p)) return 4;
            if (clockR.Contains(p)) return 5;
            if (btR.Contains(p)) return 6;
            for (int i = 0; i < pins.Count; i++) {
                if (pins[i].Slot.Contains(p)) return 20 + i;
            }
            for (int i = 0; i < wins.Count; i++) {
                if (wins[i].Slot.Contains(p)) return 10 + i;
            }
            return 0;
        }

        protected override void OnMouseMove(MouseEventArgs e) {
            if (dragging && dragPin >= 0 && dragPin < pins.Count) {
                int over = -1;
                for (int i = 0; i < pins.Count; i++) {
                    if (pins[i].Slot.Contains(e.Location)) { over = i; break; }
                }
                if (over >= 0 && over != dragPin) {
                    FoxPin tmp = pins[dragPin];
                    pins.RemoveAt(dragPin);
                    pins.Insert(over, tmp);
                    dragPin = over;
                    Place(menuOpen);
                    Invalidate();
                }
                return;
            }
            if (dragPin >= 0 && !dragging) {
                if (Math.Abs(e.X - dragStart.X) + Math.Abs(e.Y - dragStart.Y) > 8) dragging = true;
            }
            int k = HitKind(e.Location);
            if (k != hoverKind) {
                hoverKind = k;
                if (k >= 20 && (k - 20) < pins.Count) tips.SetToolTip(this, pins[k - 20].Title);
                else if (k >= 10 && (k - 10) < wins.Count) tips.SetToolTip(this, wins[k - 10].Title);
                else if (k == 2) tips.SetToolTip(this, volPct >= 0 ? ("volume  " + volPct + "%") : "volume");
                else if (k == 3) tips.SetToolTip(this, net);
                else if (k == 4) tips.SetToolTip(this, bat >= 0 ? (bat + "%") : (onAc ? "AC" : "power"));
                else if (k == 5) tips.SetToolTip(this, "calendar · reminders");
                else if (k == 6) tips.SetToolTip(this, "bluetooth");
                else tips.SetToolTip(this, "");
                Invalidate();
            }
            if (k >= 10 && (k - 10) < wins.Count) {
                Point near = PointToScreen(new Point(wins[k - 10].Slot.X + wins[k - 10].Slot.Width / 2, wins[k - 10].Slot.Y));
                peek.ShowFor(wins[k - 10].Hwnd, wins[k - 10].Title, near, state.Accent);
            } else if (peek.Visible) peek.Hide();
            base.OnMouseMove(e);
        }

        protected override void OnMouseLeave(EventArgs e) {
            hoverKind = 0;
            if (peek.Visible) peek.Hide();
            Invalidate();
            base.OnMouseLeave(e);
        }

        protected override void OnMouseUp(MouseEventArgs e) {
            if (dragging && dragPin >= 0) {
                SavePins();
                WriteToast("pins saved");
            } else if (dragPin >= 0 && dragPin < pins.Count && !dragging) {
                LaunchPin(pins[dragPin]);
            }
            dragging = false;
            dragPin = -1;
            base.OnMouseUp(e);
        }

        static void WriteToast(string text) {
            try {
                string root = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                string dir = System.IO.Path.Combine(root, "FoxTerminal", "foxos");
                Directory.CreateDirectory(dir);
                string until = DateTime.UtcNow.AddSeconds(5).ToString("o");
                string safe = (text ?? "").Replace("\"", "'");
                File.WriteAllText(System.IO.Path.Combine(dir, "toast.json"),
                    "{\"text\":\"" + safe + "\",\"until\":\"" + until + "\"}");
            } catch { }
        }

        protected override void OnMouseDown(MouseEventArgs e) {
            if (collapsed) { collapsed = false; Place(false); return; }
            Point p = e.Location;
            int menuTop = MenuTop();
            if (menuOpen && p.Y >= menuTop && p.Y < menuTop + MenuActs.Length * MenuRow + 12) {
                int i = (p.Y - menuTop - 6) / MenuRow;
                if (i >= 0 && i < MenuActs.Length && p.X >= Halo() + 10 && p.X <= Halo() + MenuW) {
                    string act = MenuActs[i];
                    menuOpen = false;
                    Place(false);
                    RunMenu(act);
                    return;
                }
                menuOpen = false;
                Place(false);
                return;
            }
            int k = HitKind(p);
            Punch(k);
            if (k == 1) {
                menuOpen = !menuOpen;
                Place(menuOpen);
                Invalidate();
                return;
            }
            if (k >= 20) {
                dragPin = k - 20;
                dragStart = p;
                dragging = false;
                return;
            }
            if (k >= 10) {
                ActivateWin(wins[k - 10].Hwnd);
                return;
            }
            if (k == 2) {
                if (e.Button == MouseButtons.Right) { FoxAudio.VolMute(); volPct = FoxAudio.GetPct(); Invalidate(); }
                else OpenVol();
                return;
            }
            if (k == 3) { OpenWifi(); return; }
            if (k == 4) {
                if (e.Button == MouseButtons.Right) OpenBright();
                else OpenBat();
                return;
            }
            if (k == 5) return; // clock removed from tray
            if (k == 6) { OpenBt(); return; }
            base.OnMouseDown(e);
        }

        DateTime panelHoldUntil;

        void NotePanelOpen() {
            panelHoldUntil = DateTime.UtcNow.AddMilliseconds(700);
        }

        bool IsOurPanel(IntPtr h) {
            if (h == IntPtr.Zero) return false;
            try {
                if (wifiWin != null && !wifiWin.IsDisposed && wifiWin.Visible && wifiWin.Handle == h) return true;
                if (volWin != null && !volWin.IsDisposed && volWin.Visible && volWin.Handle == h) return true;
                if (batWin != null && !batWin.IsDisposed && batWin.Visible && batWin.Handle == h) return true;
                if (brightWin != null && !brightWin.IsDisposed && brightWin.Visible && brightWin.Handle == h) return true;
                if (btWin != null && !btWin.IsDisposed && btWin.Visible && btWin.Handle == h) return true;
                if (remWin != null && !remWin.IsDisposed && remWin.Visible && remWin.Handle == h) return true;
            } catch { }
            return false;
        }

        void SoftCloseAllPanels() {
            SoftCloseOthers(null);
        }

        void SoftCloseOthers(Form keep) {
            try { if (wifiWin != null && !wifiWin.IsDisposed && wifiWin.Visible && !object.ReferenceEquals(wifiWin, keep)) wifiWin.SoftClose(); } catch { }
            try { if (volWin != null && !volWin.IsDisposed && volWin.Visible && !object.ReferenceEquals(volWin, keep)) volWin.SoftClose(); } catch { }
            try { if (batWin != null && !batWin.IsDisposed && batWin.Visible && !object.ReferenceEquals(batWin, keep)) batWin.SoftClose(); } catch { }
            try { if (brightWin != null && !brightWin.IsDisposed && brightWin.Visible && !object.ReferenceEquals(brightWin, keep)) brightWin.SoftClose(); } catch { }
            try { if (btWin != null && !btWin.IsDisposed && btWin.Visible && !object.ReferenceEquals(btWin, keep)) btWin.SoftClose(); } catch { }
            try { if (remWin != null && !remWin.IsDisposed && remWin.Visible && !object.ReferenceEquals(remWin, keep)) remWin.SoftClose(); } catch { }
        }

        void TickPanelFocus() {
            if (DateTime.UtcNow < panelHoldUntil) return;
            IntPtr fg = Native.GetForegroundWindow();
            if (fg == IntPtr.Zero) return;
            if (fg == Handle) return;
            if (IsOurPanel(fg)) return;
            SoftCloseAllPanels();
        }

        void OpenVol() {
            if (volWin == null || volWin.IsDisposed) {
                volWin = new VolumeBoard(state.Night, state.Accent);
                volWin.FormClosed += delegate { volWin = null; };
            } else volWin.Recolor(state.Night, state.Accent);
            SoftCloseOthers(volWin);
            volWin.Pop();
            NotePanelOpen();
        }

        void OpenWifi() {
            if (wifiWin == null || wifiWin.IsDisposed) {
                wifiWin = new WifiBoard(state.Night, state.Accent);
                wifiWin.FormClosed += delegate { wifiWin = null; };
            } else wifiWin.Recolor(state.Night, state.Accent);
            SoftCloseOthers(wifiWin);
            wifiWin.Pop();
            NotePanelOpen();
        }

        void OpenBat() {
            if (batWin == null || batWin.IsDisposed) {
                batWin = new BatteryBoard(state.Night, state.Accent);
                batWin.OpenBright = delegate { OpenBright(); };
                batWin.FormClosed += delegate { batWin = null; };
            } else batWin.Recolor(state.Night, state.Accent);
            SoftCloseOthers(batWin);
            batWin.Pop();
            NotePanelOpen();
        }

        void OpenBright() {
            SoftCloseOthers(EnsureBright());
            EnsureBright().Pop();
            NotePanelOpen();
        }

        void OpenBt() {
            if (btWin == null || btWin.IsDisposed) {
                btWin = new BluetoothBoard(state.Night, state.Accent);
                btWin.FormClosed += delegate { btWin = null; };
            } else btWin.Recolor(state.Night, state.Accent);
            SoftCloseOthers(btWin);
            btWin.Pop();
            NotePanelOpen();
        }

        BrightBoard EnsureBright() {
            if (brightWin == null || brightWin.IsDisposed) {
                brightWin = new BrightBoard(state.Night, state.Accent);
                brightWin.FormClosed += delegate { brightWin = null; };
            } else brightWin.Recolor(state.Night, state.Accent);
            return brightWin;
        }

        protected override void OnDragEnter(DragEventArgs drgevent) {
            if (drgevent.Data.GetDataPresent(DataFormats.FileDrop))
                drgevent.Effect = DragDropEffects.Copy;
            else base.OnDragEnter(drgevent);
        }

        protected override void OnDragDrop(DragEventArgs drgevent) {
            try {
                string[] files = drgevent.Data.GetData(DataFormats.FileDrop) as string[];
                if (files == null) return;
                for (int i = 0; i < files.Length; i++) {
                    string f = files[i];
                    if (string.IsNullOrEmpty(f)) continue;
                    string path = f;
                    string title = System.IO.Path.GetFileNameWithoutExtension(f);
                    if (string.Equals(System.IO.Path.GetExtension(f), ".lnk", StringComparison.OrdinalIgnoreCase)) {
                        // keep .lnk path; shell execute resolves it
                    } else if (!string.Equals(System.IO.Path.GetExtension(f), ".exe", StringComparison.OrdinalIgnoreCase)
                        && !Directory.Exists(f)) {
                        continue;
                    }
                    var pin = new FoxPin();
                    pin.Id = title.ToLowerInvariant().Replace(" ", "");
                    if (pin.Id.Length > 24) pin.Id = pin.Id.Substring(0, 24);
                    pin.Title = title;
                    pin.Path = path;
                    pin.Act = "";
                    if (System.IO.File.Exists(path)) pin.Face = FromFileIcon(path);
                    pins.Add(pin);
                }
                SavePins();
                Place(menuOpen);
                Invalidate();
                WriteToast("pin added");
            } catch { }
            base.OnDragDrop(drgevent);
        }

        protected override void OnMouseWheel(MouseEventArgs e) {
            if (e.Delta > 0) FoxAudio.VolUp();
            else FoxAudio.VolDown();
            volPct = FoxAudio.GetPct();
            Invalidate();
        }

        void Punch(int k) {
            if (k == 0) return;
            bounceKind = k;
            bounce = 0.78f;
            timer.Interval = 16;
            Invalidate();
        }

        void LaunchPin(FoxPin pin) {
            if (pin == null) return;
            if (pin.Act == "term") {
                string dir = state.CmdDir;
                if (string.IsNullOrEmpty(dir)) dir = foxosDir;
                if (!GhosttyTalk.Open(dir)) {
                    if (!FoxLaunch.Open(pin.Path)) runDesk("term");
                }
                return;
            }
            if (pin.Live != IntPtr.Zero && Native.IsWindow(pin.Live)) {
                ActivateWin(pin.Live);
                return;
            }
            FoxLaunch.Open(pin.Path);
        }

        void RunMenu(string act) {
            if (act == "term") runDesk("term");
            else if (act == "home") {
                try {
                    string req = System.IO.Path.Combine(foxosDir, "home.req");
                    File.WriteAllText(req, "1");
                } catch { runDesk("home"); }
            }
            else if (act == "foxlife") runDesk("foxlife");
            else if (act == "foxstyle") runDesk("foxstyle");
            else if (act == "mirror") runDesk("mirror");
            else if (act == "ytm") runDesk("ytm");
            else if (act == "settings") runDesk("term settings");
            else if (act == "sites") runDesk("sites");
            else if (act == "lock") runDesk("lock");
            else if (act == "off") runDesk("off");
            else if (act == "files") {
                string home = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
                try { Process.Start("explorer.exe", "/e," + home); } catch { }
            } else if (act == "windows") {
                string cmd = System.IO.Path.Combine(foxosDir, "restore-windows.cmd");
                if (System.IO.File.Exists(cmd)) {
                    try { Process.Start(new ProcessStartInfo(cmd) { UseShellExecute = true }); } catch { }
                } else {
                    runDesk("foxlook shell off");
                }
            }
        }

        static string WinMark(string title, uint pid) {
            try {
                using (var p = Process.GetProcessById((int)pid)) {
                    string n = (p.ProcessName ?? "").Trim();
                    if (n.Length > 0 && n.IndexOf("host", StringComparison.OrdinalIgnoreCase) < 0) {
                        return n.Substring(0, 1).ToUpperInvariant();
                    }
                }
            } catch { }
            if (!string.IsNullOrEmpty(title)) {
                for (int i = 0; i < title.Length; i++) {
                    if (char.IsLetterOrDigit(title[i])) return title.Substring(i, 1).ToUpperInvariant();
                }
            }
            return "·";
        }

        static void ActivateWin(IntPtr h) {
            if (h == IntPtr.Zero || !Native.IsWindow(h)) return;
            try { Native.AllowSetForegroundWindow(-1); } catch { }
            if (Native.IsIconic(h)) Native.ShowWindow(h, 9);
            else Native.ShowWindow(h, 5);
            Native.SetWindowPos(h, IntPtr.Zero, 0, 0, 0, 0, 0x0003);
            uint destPid;
            uint destTid = Native.GetWindowThreadProcessId(h, out destPid);
            IntPtr fg = Native.GetForegroundWindow();
            uint fgPid;
            uint fgTid = fg != IntPtr.Zero ? Native.GetWindowThreadProcessId(fg, out fgPid) : 0;
            uint me = Native.GetCurrentThreadId();
            if (fgTid != 0 && fgTid != me) Native.AttachThreadInput(me, fgTid, true);
            if (destTid != 0 && destTid != me) Native.AttachThreadInput(me, destTid, true);
            Native.SetForegroundWindow(h);
            if (destTid != 0 && destTid != me) Native.AttachThreadInput(me, destTid, false);
            if (fgTid != 0 && fgTid != me) Native.AttachThreadInput(me, fgTid, false);
        }

        Rectangle ZoomBox(Rectangle box, int kind) {
            if (bounceKind != kind || Math.Abs(bounce - 1f) < 0.01f) return box;
            int s = Math.Max(12, (int)Math.Round(box.Width * bounce));
            int dy = bounce < 1f ? 2 : 0;
            return new Rectangle(box.X + (box.Width - s) / 2, box.Y + (box.Height - s) / 2 + dy, s, s);
        }

        static GraphicsPath RoundBox(Rectangle r, int rad) {
            var p = new GraphicsPath();
            if (rad < 1) { p.AddRectangle(r); return p; }
            int d = rad * 2;
            if (d > r.Width) d = r.Width;
            if (d > r.Height) d = r.Height;
            p.AddArc(r.X, r.Y, d, d, 180, 90);
            p.AddArc(r.Right - d, r.Y, d, d, 270, 90);
            p.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90);
            p.AddArc(r.X, r.Bottom - d, d, d, 90, 90);
            p.CloseFigure();
            return p;
        }

        void LoadPins() {
            pins.Clear();
            List<FoxPin> loaded = PinStore.Load(foxosDir, state);
            for (int i = 0; i < loaded.Count; i++) {
                FoxPin p = loaded[i];
                if (!string.IsNullOrEmpty(p.Path) && System.IO.File.Exists(p.Path))
                    p.Face = FromFileIcon(p.Path);
                pins.Add(p);
            }
        }

        public void ReloadPins() {
            LoadPins();
            Place(menuOpen);
            Invalidate();
        }

        void SavePins() {
            PinStore.Save(foxosDir, pins);
        }

        static bool PinName(string n, string id) {
            if (string.IsNullOrEmpty(n) || string.IsNullOrEmpty(id)) return false;
            if (id == "cursor") return n.IndexOf("cursor", StringComparison.OrdinalIgnoreCase) >= 0;
            if (id == "zen") return n.Equals("zen", StringComparison.OrdinalIgnoreCase);
            if (id == "term") return n.IndexOf("ghostty", StringComparison.OrdinalIgnoreCase) >= 0
                || n.IndexOf("winghostty", StringComparison.OrdinalIgnoreCase) >= 0;
            return n.IndexOf(id, StringComparison.OrdinalIgnoreCase) >= 0;
        }

        void HideWinBar() {
            try {
                IntPtr t = Native.FindWindow("Shell_TrayWnd", null);
                if (t != IntPtr.Zero) Native.ShowWindow(t, 0);
                Native.EnumWindows(delegate(IntPtr h, IntPtr l) {
                    var cls = new StringBuilder(40);
                    Native.GetClassName(h, cls, cls.Capacity);
                    if (cls.ToString() == "Shell_SecondaryTrayWnd") Native.ShowWindow(h, 0);
                    return true;
                }, IntPtr.Zero);
            } catch { }
        }

        void DrawCard(Graphics g, Rectangle box, bool hot) {
            int rad = Math.Min(Radius(), Math.Max(8, box.Height / 2));
            float breath = (float)(0.5 + 0.5 * Math.Sin(Environment.TickCount / 920.0));
            int glassA = hot ? 150 : (110 + (int)(18 * breath));
            if (state.DockAlpha >= 0) {
                int baseA = Math.Max(30, Math.Min(250, state.DockAlpha * 255 / 100));
                glassA = hot ? Math.Min(255, baseA + 30) : (baseA + (int)(10 * breath));
                if (glassA > 255) glassA = 255;
            }
            // Blur slider = lighter frosted look (no DWM acrylic)
            if (blurOn && state.DockBlur > 0) {
                glassA = Math.Max(70, Math.Min(200, glassA - state.DockBlur));
            }
            // Opaque blend over night — semi-transparent fills become click-through via TransparencyKey
            Color night = state.Night.A > 0 ? state.Night : Color.FromArgb(11, 15, 26);
            int r = (18 * glassA + night.R * (255 - glassA)) / 255;
            int gg = (20 * glassA + night.G * (255 - glassA)) / 255;
            int b = (28 * glassA + night.B * (255 - glassA)) / 255;
            FillRound(g, box, rad, Color.FromArgb(255, r, gg, b));
            int edgeA = 55 + (int)(50 * breath);
            StrokeRound(g, box, rad, Color.FromArgb(edgeA, state.Accent), 1.2f);
        }

        void FillRound(Graphics g, Rectangle r, int rad, Color c) {
            using (var path = RoundBox(r, rad))
            using (var br = new SolidBrush(c)) {
                g.FillPath(br, path);
            }
        }

        void StrokeRound(Graphics g, Rectangle r, int rad, Color c, float w) {
            using (var path = RoundBox(r, rad))
            using (var pen = new Pen(c, w)) {
                g.DrawPath(pen, path);
            }
        }

        int MenuTop() {
            int halo = Halo();
            if (TopBar()) return halo + BarH() + 4;
            return halo;
        }

        Rectangle PillRect() {
            int halo = Halo();
            int barH = BarH();
            if (TopBar()) return new Rectangle(halo, halo, Width - halo * 2, barH);
            return new Rectangle(halo, Height - halo - barH, Width - halo * 2, barH);
        }

        void DrawGlyph(Graphics g, Rectangle r, string glyph, Color c) {
            var hint = g.TextRenderingHint;
            g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.AntiAliasGridFit;
            using (var br = new SolidBrush(c))
            using (var sf = (StringFormat)StringFormat.GenericTypographic.Clone()) {
                sf.Alignment = StringAlignment.Center;
                sf.LineAlignment = StringAlignment.Center;
                g.DrawString(glyph, iconFont, br, r, sf);
            }
            g.TextRenderingHint = hint;
        }

        string WifiGlyph() {
            if (net == "lan") return "\uE839";
            if (net == "off") return "\uE704";
            return "\uE701";
        }
        string BtGlyph() { return "\uE702"; }
        string VolGlyph() {
            if (volPct == 0) return "\uE74F";
            if (volPct < 34) return "\uE993";
            if (volPct < 67) return "\uE994";
            return "\uE995";
        }
        string BatGlyph() {
            if (onAc) return "\uE83E";
            if (bat < 0) return "\uE83F";
            if (bat <= 10) return "\uE850";
            if (bat <= 40) return "\uE851";
            if (bat <= 70) return "\uE852";
            return "\uE83F";
        }

        void EnsureFoxMark() {
            if (foxMark != null) return;
            if (string.IsNullOrEmpty(state.FoxPath) || !System.IO.File.Exists(state.FoxPath)) return;
            try {
                using (var src = Image.FromFile(state.FoxPath)) {
                    int fw = src.Width, fh = src.Height;
                    var crop = new Rectangle(
                        (int)(fw * 0.34), (int)(fh * 0.23),
                        Math.Max(8, (int)(fw * 0.32)), Math.Max(8, (int)(fh * 0.30)));
                    var bmp = new Bitmap(64, 64, System.Drawing.Imaging.PixelFormat.Format32bppPArgb);
                    using (var g = Graphics.FromImage(bmp)) {
                        g.Clear(Color.Transparent);
                        g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                        g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                        g.DrawImage(src, new Rectangle(0, 0, 64, 64), crop, GraphicsUnit.Pixel);
                    }
                    foxMark = bmp;
                }
            } catch { }
        }

        void DrawFoxMark(Graphics g, Rectangle r, bool hot) {
            EnsureFoxMark();
            int d = Math.Min(r.Width, r.Height);
            var box = new Rectangle(r.X + (r.Width - d) / 2, r.Y + (r.Height - d) / 2, d, d);
            if (foxMark != null) {
                g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                g.DrawImage(foxMark, box);
                return;
            }
            DrawGlyph(g, r, "\uE737", state.Accent);
        }

        void DrawFace(Graphics g, Image face, Rectangle box, bool on, bool hv) {
            if (hv) FillRound(g, new Rectangle(box.X - 3, box.Y - 3, box.Width + 6, box.Height + 6), 10, Color.FromArgb(24, 255, 255, 255));
            if (face != null) {
                g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                g.DrawImage(face, box);
            } else {
                FillRound(g, box, 8, Color.FromArgb(32, 255, 255, 255));
            }
            if (on) {
                int cx = box.X + box.Width / 2;
                using (var pip = new SolidBrush(state.Accent)) {
                    g.FillEllipse(pip, cx - 2, box.Bottom + 3, 4, 4);
                }
            }
        }

        protected override void OnPaint(PaintEventArgs e) {
            var g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.PixelOffsetMode = PixelOffsetMode.HighQuality;
            g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.ClearTypeGridFit;
            g.Clear(Choke);
            if (collapsed) {
                var nub = new Rectangle((Width - 48) / 2, 2, 48, Math.Max(3, Height - 3));
                using (var br = new SolidBrush(state.Accent)) g.FillRectangle(br, nub);
                return;
            }

            int barH = BarH();
            barR = PillRect();
            var inner = barR;
                if (Style() == "rail") {
                float breath = (float)(0.5 + 0.5 * Math.Sin(Environment.TickCount / 920.0));
                Color night = state.Night.A > 0 ? state.Night : Color.FromArgb(11, 15, 26);
                int a = state.DockAlpha >= 0 ? Math.Max(40, Math.Min(240, state.DockAlpha * 255 / 100)) : 180;
                int rr = (night.R * (255 - a) + 16 * a) / 255;
                int rg = (night.G * (255 - a) + 18 * a) / 255;
                int rb = (night.B * (255 - a) + 24 * a) / 255;
                using (var wash = new SolidBrush(Color.FromArgb(255, rr, rg, rb))) g.FillRectangle(wash, barR);
                using (var rail = new SolidBrush(Color.FromArgb(200 + (int)(55 * breath), state.Accent))) {
                    g.FillRectangle(rail, 0, TopBar() ? barR.Bottom - 2 : barR.Y, Width, 2);
                }
                inner = new Rectangle(barR.X + 10, barR.Y + 6, barR.Width - 20, barR.Height - 12);
            } else {
                DrawCard(g, inner, menuOpen || hoverKind == 1);
                inner = new Rectangle(barR.X + 16, barR.Y + 8, barR.Width - 32, barR.Height - 16);
            }

            using (var sf = (StringFormat)StringFormat.GenericTypographic.Clone()) {
                sf.Alignment = StringAlignment.Center;
                sf.LineAlignment = StringAlignment.Center;
                sf.FormatFlags = StringFormatFlags.NoWrap;
                using (var accent = new SolidBrush(state.Accent))
                using (var mute = new SolidBrush(Color.FromArgb(140, 150, 162))) {
                    int ic = IconPx();
                    int tile = ic + 8;
                    int padY = inner.Y + Math.Max(0, (inner.Height - tile) / 2);
                    int gap = 10;
                    int tw = ic + 10;
                    string tray = TrayMode();
                    Color trayC = Color.FromArgb(170, 188, 198);
                    int right = inner.Right;
                    int slot = 28;
                    if (tray == "full") {
                        batR = new Rectangle(right - slot, padY, slot, tile);
                        DrawGlyph(g, ZoomBox(batR, 4), BatGlyph(), hoverKind == 4 ? state.Accent : trayC);
                        right = batR.X - 2;
                        volR = new Rectangle(right - slot, padY, slot, tile);
                        DrawGlyph(g, ZoomBox(volR, 2), VolGlyph(), hoverKind == 2 ? state.Accent : trayC);
                        right = volR.X - 2;
                        wifiR = new Rectangle(right - slot, padY, slot, tile);
                        DrawGlyph(g, ZoomBox(wifiR, 3), WifiGlyph(), hoverKind == 3 ? state.Accent : trayC);
                        right = wifiR.X - 2;
                        btR = new Rectangle(right - slot, padY, slot, tile);
                        DrawGlyph(g, ZoomBox(btR, 6), BtGlyph(), hoverKind == 6 ? state.Accent : trayC);
                        right = btR.X - 10;
                        clockR = Rectangle.Empty;
                    } else {
                        batR = volR = wifiR = btR = clockR = Rectangle.Empty;
                    }

                    string wm = WinsMode();
                    IntPtr fgWin = Native.GetForegroundWindow();
                    int shown = 0;
                    if (wm != "off") {
                        int room = Math.Max(0, right - (inner.X + tw + gap + pins.Count * (tw + gap)));
                        shown = Math.Min(wins.Count, Math.Max(0, room / (tw + gap)));
                    }
                    int x = inner.X;
                    foxR = new Rectangle(x, padY, tw, tile);
                    DrawFoxMark(g, ZoomBox(new Rectangle(x + (tw - ic) / 2, padY, ic, ic), 1), hoverKind == 1 || menuOpen);
                    x += tw + gap;
                    for (int i = 0; i < pins.Count; i++) {
                        pins[i].Slot = new Rectangle(x, padY, tw, tile);
                        bool on = pins[i].Live != IntPtr.Zero && pins[i].Live == fgWin;
                        bool hv = hoverKind == 20 + i;
                        DrawFace(g, pins[i].Face, ZoomBox(new Rectangle(x + (tw - ic) / 2, padY, ic, ic), 20 + i), on || pins[i].Live != IntPtr.Zero, hv);
                        x += tw + gap;
                    }
                    if (wm == "off") {
                        foreach (FoxWin w in wins) w.Slot = Rectangle.Empty;
                    } else {
                        for (int i = 0; i < wins.Count; i++) {
                            if (i >= shown) { wins[i].Slot = Rectangle.Empty; continue; }
                            wins[i].Slot = new Rectangle(x, padY, tw, tile);
                            bool on = wins[i].Hwnd == fgWin;
                            bool hv = hoverKind == 10 + i;
                            var box = ZoomBox(new Rectangle(x + (tw - ic) / 2, padY, ic, ic), 10 + i);
                            DrawFace(g, wins[i].Face, box, on, hv);
                            if (wins[i].Face == null) {
                                string mark = string.IsNullOrEmpty(wins[i].Mark) ? "·" : wins[i].Mark;
                                g.DrawString(mark, small, on || hv ? accent : mute, box, sf);
                            }
                            x += tw + gap;
                        }
                    }
                }
            }

            if (menuOpen) {
                int menuTop = MenuTop();
                var menu = new Rectangle(0, menuTop, MenuW + 8, MenuActs.Length * MenuRow + 8);
                FillRound(g, menu, 14, Color.FromArgb(160, 0, 0, 0));
                using (var sf = (StringFormat)StringFormat.GenericTypographic.Clone()) {
                    sf.Alignment = StringAlignment.Near;
                    sf.LineAlignment = StringAlignment.Center;
                    using (var ink = new SolidBrush(Color.FromArgb(228, 230, 236)))
                    using (var accent = new SolidBrush(state.Accent))
                    using (var mute = new SolidBrush(Color.FromArgb(120, 130, 142))) {
                        for (int i = 0; i < MenuActs.Length; i++) {
                            var row = new Rectangle(menu.X + 14, menu.Y + 4 + i * MenuRow, menu.Width - 22, MenuRow - 2);
                            bool last = i == MenuActs.Length - 1;
                            string line = (last ? "> " : "  ") + MenuLabels[i];
                            g.DrawString(line, font, last ? accent : ink, row, sf);
                            if (last) g.DrawString("esc", micro, mute, new Rectangle(row.Right - 36, row.Y, 34, row.Height), sf);
                        }
                    }
                }
            }
        }

        public void Recolor() {
            TryBlur();
            Place(menuOpen);
            if (wifiWin != null && !wifiWin.IsDisposed) wifiWin.Recolor(state.Night, state.Accent);
            if (volWin != null && !volWin.IsDisposed) volWin.Recolor(state.Night, state.Accent);
            if (batWin != null && !batWin.IsDisposed) batWin.Recolor(state.Night, state.Accent);
            if (brightWin != null && !brightWin.IsDisposed) brightWin.Recolor(state.Night, state.Accent);
            if (btWin != null && !btWin.IsDisposed) btWin.Recolor(state.Night, state.Accent);
            if (remWin != null && !remWin.IsDisposed) remWin.Recolor(state.Night, state.Accent);
            Invalidate();
        }

        protected override void Dispose(bool disposing) {
            if (disposing) {
                if (timer != null) timer.Dispose();
                if (font != null) font.Dispose();
                if (small != null) small.Dispose();
                if (micro != null) micro.Dispose();
                if (clockFont != null) clockFont.Dispose();
                if (iconFont != null) iconFont.Dispose();
                if (tips != null) tips.Dispose();
                try { if (peek != null) peek.Dispose(); } catch { }
                foreach (var kv in faces) { if (kv.Value != null) kv.Value.Dispose(); }
                faces.Clear();
                if (foxMark != null) foxMark.Dispose();
            }
            base.Dispose(disposing);
        }
    }
}
