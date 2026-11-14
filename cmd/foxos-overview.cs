// FOX Overview — GNOME-like Activities view on Win (primary monitor).
// Does not move real windows. DWM thumbnails + app dock only while Open.
// C# 5 / .NET Framework 4.x — foxos-live.exe

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Windows.Forms;
using FoxOs.Sdk;

namespace FoxOsLive {

    enum OverviewPhase { Closed, Opening, Open, Closing }

    sealed class OverviewWin {
        public IntPtr Hwnd;
        public string Title;
        public Image Face;
        public Rectangle Slot;
        public bool Minimized;
        public uint Pid;
        public string Proc;
    }

    sealed class OverviewApp {
        public string Title;
        public string Path;
        public Image Face;
        public Rectangle Slot;
        public bool Running;
        public IntPtr LiveHwnd;
        public bool IsAllApps;
    }

    // Taskbar hide/restore with one-shot backup + heartbeat for crash recovery.
    static class OverviewTaskbar {
        static bool applied;
        static int savedState = -1;
        static readonly object gate = new object();

        public static string BakPath {
            get { return Path.Combine(FoxPaths.RuntimeDir(), "overview-taskbar.bak"); }
        }
        public static string AlivePath {
            get { return Path.Combine(FoxPaths.RuntimeDir(), "overview.alive"); }
        }

        public static void ApplyHide() {
            lock (gate) {
                try {
                    EnsureBak();
                    // Autohide bit + hard hide tray windows (no edge strip clicks)
                    int cur = GetState();
                    if ((cur & 1) == 0) SetState(cur | 1);
                    HideBars();
                    applied = true;
                    Heartbeat();
                } catch { }
            }
        }

        public static void Heartbeat() {
            try {
                File.WriteAllText(AlivePath, DateTime.UtcNow.ToString("o"), new UTF8Encoding(false));
            } catch { }
        }

        public static void Restore() {
            lock (gate) {
                try {
                    int state = savedState;
                    if (state < 0) {
                        try {
                            if (File.Exists(BakPath))
                                int.TryParse(File.ReadAllText(BakPath).Trim(), out state);
                        } catch { }
                    }
                    if (state < 0) state = 0;
                    SetState(state);
                    ShowBars();
                    // Work area refresh
                    try { SystemParametersInfo(0x002F, 0, IntPtr.Zero, 0x03); } catch { } // SPI_SETWORKAREA broadcast-ish
                } catch { }
                applied = false;
                try { if (File.Exists(AlivePath)) File.Delete(AlivePath); } catch { }
            }
        }

        static void EnsureBak() {
            if (File.Exists(BakPath)) {
                try {
                    int v;
                    if (int.TryParse(File.ReadAllText(BakPath).Trim(), out v)) {
                        if (savedState < 0) savedState = v;
                        return;
                    }
                } catch { }
            }
            try {
                savedState = GetState();
                File.WriteAllText(BakPath, savedState.ToString(), new UTF8Encoding(false));
            } catch {
                savedState = 0;
            }
        }

        static int GetState() {
            APPBARDATA d = Bar();
            return (int)SHAppBarMessage(4, ref d).ToUInt64(); // ABM_GETSTATE
        }
        static void SetState(int state) {
            APPBARDATA d = Bar();
            d.lParam = state;
            SHAppBarMessage(10, ref d); // ABM_SETSTATE
        }
        static APPBARDATA Bar() {
            APPBARDATA d = new APPBARDATA();
            d.cbSize = (uint)Marshal.SizeOf(typeof(APPBARDATA));
            d.hWnd = FindWindow("Shell_TrayWnd", null);
            return d;
        }
        static void HideBars() {
            SetVis(FindWindow("Shell_TrayWnd", null), false);
            EnumWindows(delegate(IntPtr h, IntPtr l) {
                StringBuilder sb = new StringBuilder(40);
                GetClassName(h, sb, 40);
                string c = sb.ToString();
                if (c == "Shell_TrayWnd" || c == "Shell_SecondaryTrayWnd") SetVis(h, false);
                return true;
            }, IntPtr.Zero);
        }
        static void ShowBars() {
            SetVis(FindWindow("Shell_TrayWnd", null), true);
            EnumWindows(delegate(IntPtr h, IntPtr l) {
                StringBuilder sb = new StringBuilder(40);
                GetClassName(h, sb, 40);
                string c = sb.ToString();
                if (c == "Shell_TrayWnd" || c == "Shell_SecondaryTrayWnd") SetVis(h, true);
                return true;
            }, IntPtr.Zero);
        }
        static void SetVis(IntPtr h, bool show) {
            if (h != IntPtr.Zero) ShowWindow(h, show ? 5 : 0);
        }

        [StructLayout(LayoutKind.Sequential)]
        struct RECT { public int L, T, R, B; }
        [StructLayout(LayoutKind.Sequential)]
        struct APPBARDATA {
            public uint cbSize; public IntPtr hWnd; public uint uCallbackMessage;
            public uint uEdge; public RECT rc; public int lParam;
        }
        delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
        [DllImport("shell32.dll")] static extern UIntPtr SHAppBarMessage(uint msg, ref APPBARDATA data);
        [DllImport("user32.dll", CharSet = CharSet.Auto)] static extern IntPtr FindWindow(string cls, string name);
        [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindowsProc cb, IntPtr l);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder s, int n);
        [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int n);
        [DllImport("user32.dll", CharSet = CharSet.Auto)] static extern int SystemParametersInfo(int a, int b, IntPtr c, int d);
    }

    sealed class FoxOverviewHost : IDisposable {
        readonly string foxosDir;
        readonly Action<string> runDesk;
        readonly Func<State> getState;
        FoxOverviewBoard board;
        OverviewPhase phase = OverviewPhase.Closed;
        System.Windows.Forms.Timer beat;
        System.Windows.Forms.Timer featWatch;
        bool modeOn;
        int lastRev = -1;
        IntPtr prevFocus;

        public OverviewPhase Phase { get { return phase; } }
        public bool ModeOn { get { return modeOn; } }

        public FoxOverviewHost(string dir, Action<string> desk, Func<State> stateFn) {
            foxosDir = dir ?? FoxPaths.RuntimeDir();
            runDesk = desk;
            getState = stateFn;
            Reload();
            beat = new System.Windows.Forms.Timer();
            beat.Interval = 2500;
            beat.Tick += delegate {
                if (modeOn) OverviewTaskbar.Heartbeat();
            };
            beat.Start();
            featWatch = new System.Windows.Forms.Timer();
            featWatch.Interval = 900;
            featWatch.Tick += delegate {
                try {
                    FoxFeaturesDoc d = FoxFeatures.Load();
                    if (d.revision != lastRev) Reload();
                } catch { }
            };
            featWatch.Start();
        }

        public void Reload() {
            FoxFeaturesDoc doc = FoxFeatures.Load();
            lastRev = doc.revision;
            bool want = FoxFeatures.OverviewActive(doc);
            if (want == modeOn) {
                if (board != null) board.ApplyConfig(doc.overview);
                return;
            }
            modeOn = want;
            FoxFeatures.WriteOverviewFlag(modeOn);
            if (modeOn) {
                OverviewTaskbar.ApplyHide();
                // Suppress Fox dock edge reveal while overview owns the chrome
                ForceDockSuppressed(true);
            } else {
                if (phase != OverviewPhase.Closed) CloseNow(false);
                OverviewTaskbar.Restore();
                ForceDockSuppressed(false);
            }
            if (board != null) board.ApplyConfig(doc.overview);
        }

        void ForceDockSuppressed(bool on) {
            try {
                string p = Path.Combine(foxosDir, "overview-suppress-dock.flag");
                if (on) File.WriteAllText(p, "1");
                else if (File.Exists(p)) File.Delete(p);
            } catch { }
        }

        public void Toggle() {
            if (!modeOn) return;
            if (phase == OverviewPhase.Opening || phase == OverviewPhase.Open)
                BeginClose(false, IntPtr.Zero);
            else if (phase == OverviewPhase.Closed)
                BeginOpen();
            // Closing: ignore rapid re-entry until Closed
        }

        public void BeginOpen() {
            if (!modeOn) return;
            if (phase == OverviewPhase.Opening || phase == OverviewPhase.Open) return;
            phase = OverviewPhase.Opening;
            try { prevFocus = Native.GetForegroundWindow(); } catch { prevFocus = IntPtr.Zero; }
            EnsureBoard();
            State st = getState != null ? getState() : null;
            board.Open(st, delegate {
                phase = OverviewPhase.Open;
            });
        }

        public void BeginClose(bool activate, IntPtr hwnd) {
            if (phase == OverviewPhase.Closed || phase == OverviewPhase.Closing) {
                if (activate && hwnd != IntPtr.Zero) ActivateHwnd(hwnd);
                return;
            }
            phase = OverviewPhase.Closing;
            if (board == null) {
                phase = OverviewPhase.Closed;
                return;
            }
            IntPtr target = activate ? hwnd : IntPtr.Zero;
            if (!activate && prevFocus != IntPtr.Zero) target = prevFocus;
            board.CloseAnim(delegate {
                phase = OverviewPhase.Closed;
                if (target != IntPtr.Zero) ActivateHwnd(target);
            });
        }

        public void CloseNow(bool activate) {
            phase = OverviewPhase.Closed;
            try { if (board != null) board.ForceHide(); } catch { }
            if (activate && prevFocus != IntPtr.Zero) ActivateHwnd(prevFocus);
        }

        void EnsureBoard() {
            if (board != null && !board.IsDisposed) return;
            board = new FoxOverviewBoard(foxosDir, runDesk);
            board.RequestClose += delegate { BeginClose(false, IntPtr.Zero); };
            board.ActivateWindow += delegate(IntPtr h) { BeginClose(true, h); };
            FoxFeaturesDoc doc = FoxFeatures.Load();
            board.ApplyConfig(doc.overview);
        }

        static void ActivateHwnd(IntPtr h) {
            if (h == IntPtr.Zero || !Native.IsWindow(h)) return;
            try {
                Native.ShowWindow(h, Native.IsIconic(h) ? 9 : 5); // SW_RESTORE / SW_SHOW
                Native.SetForegroundWindow(h);
            } catch { }
        }

        public void Dispose() {
            try { featWatch.Stop(); featWatch.Dispose(); } catch { }
            try { beat.Stop(); beat.Dispose(); } catch { }
            try { if (board != null) board.ForceHide(); board.Dispose(); } catch { }
            board = null;
            if (modeOn) {
                OverviewTaskbar.Restore();
                ForceDockSuppressed(false);
            }
            phase = OverviewPhase.Closed;
        }
    }

    sealed class FoxOverviewBoard : Form {
        public event Action RequestClose;
        public event Action<IntPtr> ActivateWindow;

        [DllImport("dwmapi.dll")] static extern int DwmRegisterThumbnail(IntPtr dest, IntPtr src, out IntPtr thumb);
        [DllImport("dwmapi.dll")] static extern int DwmUnregisterThumbnail(IntPtr thumb);
        [DllImport("dwmapi.dll")] static extern int DwmUpdateThumbnailProperties(IntPtr thumb, ref ThumbProps props);
        [DllImport("user32.dll")] static extern IntPtr SendMessage(IntPtr h, uint msg, IntPtr w, IntPtr l);
        [DllImport("user32.dll", EntryPoint = "GetClassLongPtrW")] static extern IntPtr GetClassLongPtr(IntPtr h, int n);
        [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);

        [StructLayout(LayoutKind.Sequential)]
        struct ThumbProps {
            public uint Flags;
            public Native.RECT Dest;
            public Native.RECT Source;
            public byte Opacity;
            public bool Visible;
            public bool ClientOnly;
        }
        const uint TNP_DEST = 0x1, TNP_OPACITY = 0x4, TNP_VISIBLE = 0x8;

        readonly string foxosDir;
        readonly Action<string> runDesk;
        readonly List<OverviewWin> wins = new List<OverviewWin>();
        readonly List<IntPtr> thumbs = new List<IntPtr>();
        readonly List<OverviewApp> dockApps = new List<OverviewApp>();
        readonly List<OverviewApp> catalog = new List<OverviewApp>();
        readonly Font titleFont, small, huge, searchFont;
        readonly System.Windows.Forms.Timer anim;
        readonly System.Windows.Forms.Timer refresh;
        readonly TextBox searchBox;

        Color night = Color.FromArgb(12, 14, 22);
        Color accent = Color.FromArgb(123, 92, 255);
        Color ink = Color.FromArgb(230, 232, 240);
        OverviewFeature cfg = new OverviewFeature();
        OverviewPhase localPhase = OverviewPhase.Closed;
        float t; // 0..1 open progress
        DateTime animStart;
        bool closing;
        Action onOpened;
        Action onClosed;
        int selWin = -1;
        int selDock = -1;
        bool allApps;
        string filter = "";
        int openMs = 220, closeMs = 180;
        float stageScale = 0.86f;
        Rectangle stageRect;
        Rectangle dockRect;
        IntPtr wallHwnd;

        public FoxOverviewBoard(string dir, Action<string> desk) {
            foxosDir = dir;
            runDesk = desk;
            Text = "FOX Overview";
            FormBorderStyle = FormBorderStyle.None;
            ShowInTaskbar = false;
            TopMost = true;
            StartPosition = FormStartPosition.Manual;
            DoubleBuffered = true;
            // Opaque surface required for DWM thumbnails
            BackColor = Color.FromArgb(16, 18, 26);
            KeyPreview = true;
            titleFont = new Font("Segoe UI Semibold", 11f, FontStyle.Bold);
            small = new Font("Segoe UI", 9f);
            huge = new Font("Segoe UI Semibold", 18f, FontStyle.Bold);
            searchFont = new Font("Segoe UI", 12f);
            anim = new System.Windows.Forms.Timer();
            anim.Interval = 16;
            anim.Tick += OnAnim;
            refresh = new System.Windows.Forms.Timer();
            refresh.Interval = 700;
            refresh.Tick += delegate {
                if (localPhase != OverviewPhase.Open && localPhase != OverviewPhase.Opening) return;
                RefreshWins(false);
                LayoutSlots();
                PlaceThumbs();
                Invalidate();
            };
            searchBox = new TextBox();
            searchBox.Font = searchFont;
            searchBox.BorderStyle = BorderStyle.FixedSingle;
            searchBox.Visible = false;
            searchBox.TextChanged += delegate {
                filter = searchBox.Text ?? "";
                BuildCatalog();
                Invalidate();
            };
            Controls.Add(searchBox);
        }

        protected override CreateParams CreateParams {
            get {
                CreateParams cp = base.CreateParams;
                cp.ExStyle |= Native.WS_EX_TOOLWINDOW;
                return cp;
            }
        }

        public void ApplyConfig(OverviewFeature f) {
            cfg = f ?? new OverviewFeature();
            openMs = Math.Max(120, cfg.openMs);
            closeMs = Math.Max(100, cfg.closeMs);
            stageScale = Math.Max(0.80f, Math.Min(0.92f, cfg.stageScalePct / 100f));
            try {
                FoxMotionConfig m = FoxMotionHost.LoadFromStyleJson();
                if (m != null && m.EffectiveEnabled() == false) {
                    openMs = 1; closeMs = 1;
                }
            } catch { }
        }

        public void Open(State st, Action opened) {
            onOpened = opened;
            closing = false;
            localPhase = OverviewPhase.Opening;
            allApps = false;
            filter = "";
            searchBox.Visible = false;
            searchBox.Text = "";
            LoadTheme(st);
            Rectangle sb = Screen.PrimaryScreen.Bounds;
            Bounds = sb;
            t = 0f;
            animStart = DateTime.UtcNow;
            try { wallHwnd = Native.FindWindow(null, "FoxOS Live"); } catch { wallHwnd = IntPtr.Zero; }
            RefreshWins(true);
            LoadDock(st);
            LayoutSlots();
            Show();
            Activate();
            BringToFront();
            RegisterThumbs();
            PlaceThumbs();
            refresh.Start();
            anim.Start();
            Invalidate();
        }

        public void CloseAnim(Action closed) {
            onClosed = closed;
            closing = true;
            localPhase = OverviewPhase.Closing;
            ClearThumbs();
            searchBox.Visible = false;
            animStart = DateTime.UtcNow;
            // reverse from current t
            if (!anim.Enabled) anim.Start();
        }

        public void ForceHide() {
            refresh.Stop();
            anim.Stop();
            ClearThumbs();
            localPhase = OverviewPhase.Closed;
            try { Hide(); } catch { }
        }

        void LoadTheme(State st) {
            if (st != null) {
                night = st.Night;
                accent = st.Accent;
                return;
            }
            try {
                string style = Path.Combine(FoxPaths.RuntimeDir(), "style.json");
                if (!File.Exists(style)) return;
                string raw = File.ReadAllText(style);
                accent = Hex(GrabHex(raw, "accent"), accent);
                night = Hex(GrabHex(raw, "bg"), night);
            } catch { }
        }

        static string GrabHex(string json, string key) {
            Match m = Regex.Match(json, "\"" + key + "\"\\s*:\\s*\"(#[0-9A-Fa-f]{6})\"");
            return m.Success ? m.Groups[1].Value : "";
        }
        static Color Hex(string h, Color fb) {
            if (string.IsNullOrEmpty(h) || h.Length < 7) return fb;
            try {
                return Color.FromArgb(
                    Convert.ToInt32(h.Substring(1, 2), 16),
                    Convert.ToInt32(h.Substring(3, 2), 16),
                    Convert.ToInt32(h.Substring(5, 2), 16));
            } catch { return fb; }
        }

        void OnAnim(object s, EventArgs e) {
            double elapsed = (DateTime.UtcNow - animStart).TotalMilliseconds;
            if (closing) {
                float dur = Math.Max(1, closeMs);
                float p = (float)(elapsed / dur);
                if (p >= 1f) {
                    t = 0f;
                    anim.Stop();
                    refresh.Stop();
                    ClearThumbs();
                    localPhase = OverviewPhase.Closed;
                    Hide();
                    if (onClosed != null) { Action a = onClosed; onClosed = null; a(); }
                    return;
                }
                t = 1f - FoxEase.EaseOutCubic(p);
            } else {
                float dur = Math.Max(1, openMs);
                float p = (float)(elapsed / dur);
                if (p >= 1f) {
                    t = 1f;
                    anim.Stop();
                    localPhase = OverviewPhase.Open;
                    if (onOpened != null) { Action a = onOpened; onOpened = null; a(); }
                } else {
                    t = FoxEase.EaseOutCubic(p);
                }
            }
            LayoutSlots();
            PlaceThumbs();
            Invalidate();
        }

        void RefreshWins(bool resetSel) {
            ClearThumbs();
            for (int i = 0; i < wins.Count; i++) {
                if (wins[i].Face != null) { try { wins[i].Face.Dispose(); } catch { } }
            }
            wins.Clear();
            Native.EnumWindows(delegate(IntPtr h, IntPtr l) {
                if (h == Handle || h == wallHwnd) return true;
                if (!Native.IsWindowVisible(h) && !IsIconic(h)) return true;
                if (Native.GetWindow(h, 4) != IntPtr.Zero) return true; // GW_OWNER
                int ex = Native.GetWindowLong(h, Native.GWL_EXSTYLE);
                if ((ex & Native.WS_EX_TOOLWINDOW) != 0) return true;
                int st = Native.GetWindowLong(h, Native.GWL_STYLE);
                if ((st & Native.WS_CAPTION) == 0 && !IsIconic(h)) return true;
                uint cloaked;
                if (Native.DwmGetWindowAttribute(h, Native.DWMWA_CLOAKED, out cloaked, 4) == 0 && cloaked != 0) return true;
                StringBuilder sb = new StringBuilder(256);
                Native.GetWindowText(h, sb, 256);
                string title = (sb.ToString() ?? "").Trim();
                if (title.Length == 0) return true;
                if (title == "FoxOS Dock" || title == "FoxOS Live" || title == "FOX Overview"
                    || title == "FoxOS Home" || title == "FoxNodes" || title == "Fox Action Wheel") return true;
                uint pid;
                Native.GetWindowThreadProcessId(h, out pid);
                string proc = "";
                try {
                    using (Process p = Process.GetProcessById((int)pid)) {
                        proc = (p.ProcessName ?? "").ToLowerInvariant();
                        if (proc == "foxos-live" || proc == "foxnodes" || proc == "foxstyle"
                            || proc == "applicationframehost") return true;
                    }
                } catch { }
                OverviewWin w = new OverviewWin();
                w.Hwnd = h;
                w.Title = title.Length > 42 ? title.Substring(0, 42) + "…" : title;
                w.Minimized = IsIconic(h);
                w.Pid = pid;
                w.Proc = proc;
                w.Face = IconFace(h);
                wins.Add(w);
                return wins.Count < 24;
            }, IntPtr.Zero);
            if (resetSel) selWin = wins.Count > 0 ? 0 : -1;
            else if (selWin >= wins.Count) selWin = wins.Count - 1;
            if (IsHandleCreated && (localPhase == OverviewPhase.Open || localPhase == OverviewPhase.Opening))
                RegisterThumbs();
        }

        void LoadDock(State st) {
            for (int i = 0; i < dockApps.Count; i++) {
                if (dockApps[i].Face != null) try { dockApps[i].Face.Dispose(); } catch { }
            }
            dockApps.Clear();
            List<FoxPin> pins = PinStore.Load(foxosDir, st);
            for (int i = 0; i < pins.Count; i++) {
                OverviewApp a = new OverviewApp();
                a.Title = pins[i].Title;
                a.Path = string.IsNullOrEmpty(pins[i].Path) ? pins[i].Act : pins[i].Path;
                a.Face = FaceFromPath(a.Path);
                // match running
                for (int w = 0; w < wins.Count; w++) {
                    if (PinMatch(pins[i], wins[w])) {
                        a.Running = true;
                        a.LiveHwnd = wins[w].Hwnd;
                        break;
                    }
                }
                dockApps.Add(a);
            }
            // running apps not pinned
            for (int w = 0; w < wins.Count; w++) {
                bool pinned = false;
                for (int i = 0; i < dockApps.Count; i++) {
                    if (dockApps[i].LiveHwnd == wins[w].Hwnd) { pinned = true; break; }
                }
                if (pinned) continue;
                OverviewApp a = new OverviewApp();
                a.Title = wins[w].Title;
                a.Path = "";
                a.Face = wins[w].Face;
                a.Running = true;
                a.LiveHwnd = wins[w].Hwnd;
                dockApps.Add(a);
                if (dockApps.Count >= 14) break;
            }
            OverviewApp all = new OverviewApp();
            all.Title = "Усі програми";
            all.IsAllApps = true;
            dockApps.Add(all);
        }

        static bool PinMatch(FoxPin pin, OverviewWin w) {
            if (pin == null || w == null) return false;
            string id = (pin.Id ?? "").ToLowerInvariant();
            if (id.Length > 0 && w.Proc.IndexOf(id, StringComparison.OrdinalIgnoreCase) >= 0) return true;
            string path = (pin.Path ?? "").ToLowerInvariant();
            if (path.Length > 0 && w.Proc.Length > 0 && path.IndexOf(w.Proc, StringComparison.OrdinalIgnoreCase) >= 0)
                return true;
            return false;
        }

        static Image FaceFromPath(string path) {
            try {
                if (string.IsNullOrEmpty(path) || !File.Exists(path)) return null;
                using (Icon ico = Icon.ExtractAssociatedIcon(path)) {
                    if (ico == null) return null;
                    return new Bitmap(ico.ToBitmap(), new Size(36, 36));
                }
            } catch { return null; }
        }

        static Bitmap IconFace(IntPtr hwnd) {
            IntPtr hi = SendMessage(hwnd, 0x007F, (IntPtr)1, IntPtr.Zero);
            if (hi == IntPtr.Zero) hi = SendMessage(hwnd, 0x007F, IntPtr.Zero, IntPtr.Zero);
            if (hi == IntPtr.Zero) hi = GetClassLongPtr(hwnd, -14);
            Bitmap bmp = new Bitmap(160, 100, PixelFormat.Format32bppArgb);
            using (Graphics g = Graphics.FromImage(bmp)) {
                g.Clear(Color.FromArgb(255, 18, 20, 28));
                if (hi != IntPtr.Zero) {
                    try {
                        using (Icon ico = Icon.FromHandle(hi))
                        using (Image img = ico.ToBitmap()) {
                            g.DrawImage(img, 58, 28, 44, 44);
                        }
                    } catch { }
                }
            }
            return bmp;
        }

        void LayoutSlots() {
            Rectangle bounds = ClientRectangle;
            int dockH = (int)(88 * (0.35f + 0.65f * t));
            dockRect = new Rectangle(0, bounds.Bottom - dockH, bounds.Width, dockH);
            float scale = 1f - (1f - stageScale) * t;
            int sw = (int)(bounds.Width * scale);
            int sh = (int)((bounds.Height - dockH) * scale);
            int sx = (bounds.Width - sw) / 2;
            int sy = (int)((bounds.Height - dockH - sh) * 0.42f);
            stageRect = new Rectangle(sx, Math.Max(24, sy), sw, Math.Max(120, sh));

            // window grid inside stage
            int n = wins.Count;
            if (n == 0) { /* empty stage ok */ }
            else {
                int cols = (int)Math.Ceiling(Math.Sqrt(n));
                if (cols < 1) cols = 1;
                int rows = (int)Math.Ceiling(n / (double)cols);
                int gap = 16;
                int cellW = Math.Max(120, (stageRect.Width - gap * (cols + 1)) / cols);
                int cellH = Math.Max(80, (stageRect.Height - gap * (rows + 1) - 28) / rows);
                if (cellW > 280) cellW = 280;
                if (cellH > 170) cellH = 170;
                int gridW = cols * cellW + (cols - 1) * gap;
                int gridH = rows * cellH + (rows - 1) * gap;
                int x0 = stageRect.X + (stageRect.Width - gridW) / 2;
                int y0 = stageRect.Y + (stageRect.Height - gridH) / 2;
                for (int i = 0; i < n; i++) {
                    int c = i % cols;
                    int r = i / cols;
                    wins[i].Slot = new Rectangle(x0 + c * (cellW + gap), y0 + r * (cellH + gap), cellW, cellH);
                }
            }

            // dock icons
            int icon = 48;
            int dg = 14;
            int total = dockApps.Count * icon + Math.Max(0, dockApps.Count - 1) * dg;
            int dx = (dockRect.Width - total) / 2;
            int dy = dockRect.Y + (dockRect.Height - icon) / 2 - 4;
            for (int i = 0; i < dockApps.Count; i++) {
                dockApps[i].Slot = new Rectangle(dx + i * (icon + dg), dy, icon, icon);
            }

            if (allApps) {
                searchBox.Bounds = new Rectangle(stageRect.X + 24, stageRect.Y + 16, Math.Min(420, stageRect.Width - 48), 32);
                searchBox.Visible = t > 0.6f;
                BuildCatalog();
            }
        }

        void BuildCatalog() {
            for (int i = 0; i < catalog.Count; i++) {
                // faces shared with disk cache — don't dispose path icons repeatedly if reused
            }
            catalog.Clear();
            string q = (filter ?? "").Trim().ToLowerInvariant();
            List<string> files = new List<string>();
            CollectLnk(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.StartMenu), "Programs"), files);
            CollectLnk(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonStartMenu), "Programs"), files);
            HashSet<string> seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            for (int i = 0; i < files.Count && catalog.Count < 80; i++) {
                string f = files[i];
                string title = Path.GetFileNameWithoutExtension(f) ?? "";
                if (title.Length == 0) continue;
                string low = title.ToLowerInvariant();
                if (low.StartsWith("uninstall")) continue;
                if (q.Length > 0 && low.IndexOf(q) < 0) continue;
                if (!seen.Add(f)) continue;
                OverviewApp a = new OverviewApp();
                a.Title = title;
                a.Path = f;
                a.Face = FaceFromPath(f);
                catalog.Add(a);
            }
            int cols = 6;
            int cell = 92;
            int gap = 12;
            int x0 = stageRect.X + 24;
            int y0 = stageRect.Y + 64;
            for (int i = 0; i < catalog.Count; i++) {
                int c = i % cols;
                int r = i / cols;
                catalog[i].Slot = new Rectangle(x0 + c * (cell + gap), y0 + r * (cell + gap), cell, cell);
            }
        }

        static void CollectLnk(string dir, List<string> into) {
            if (string.IsNullOrEmpty(dir) || !Directory.Exists(dir) || into == null) return;
            try {
                string[] files = Directory.GetFiles(dir, "*.lnk");
                for (int i = 0; i < files.Length; i++) into.Add(files[i]);
            } catch { }
            string[] subs = null;
            try { subs = Directory.GetDirectories(dir); } catch { return; }
            if (subs == null) return;
            for (int i = 0; i < subs.Length; i++) {
                try { CollectLnk(subs[i], into); } catch { }
            }
        }

        void ClearThumbs() {
            for (int i = 0; i < thumbs.Count; i++) {
                if (thumbs[i] != IntPtr.Zero) {
                    try { DwmUnregisterThumbnail(thumbs[i]); } catch { }
                }
            }
            thumbs.Clear();
        }

        void RegisterThumbs() {
            ClearThumbs();
            if (!IsHandleCreated || allApps) return;
            for (int i = 0; i < wins.Count; i++) {
                IntPtr th;
                int hr = DwmRegisterThumbnail(Handle, wins[i].Hwnd, out th);
                thumbs.Add(hr == 0 ? th : IntPtr.Zero);
            }
        }

        void PlaceThumbs() {
            if (closing || allApps || thumbs.Count != wins.Count) return;
            float fade = Math.Max(0f, Math.Min(1f, t));
            for (int i = 0; i < wins.Count; i++) {
                if (thumbs[i] == IntPtr.Zero) continue;
                Rectangle box = wins[i].Slot;
                if (box.Width < 8) continue;
                Native.RECT dest = new Native.RECT {
                    L = box.X + 4, T = box.Y + 4, R = box.Right - 4, B = box.Bottom - 22
                };
                ThumbProps props = new ThumbProps();
                props.Flags = TNP_DEST | TNP_VISIBLE | TNP_OPACITY;
                props.Dest = dest;
                props.Opacity = (byte)(255 * fade);
                props.Visible = fade > 0.05f;
                props.ClientOnly = false;
                try { DwmUpdateThumbnailProperties(thumbs[i], ref props); } catch { }
            }
        }

        protected override void OnPaint(PaintEventArgs e) {
            Graphics g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.ClearTypeGridFit;
            // dim veil
            int veil = (int)(170 * t);
            using (SolidBrush dim = new SolidBrush(Color.FromArgb(veil, 6, 8, 14)))
                g.FillRectangle(dim, ClientRectangle);

            // stage plate (zoomed workspace metaphor)
            float plateA = 0.25f + 0.55f * t;
            using (GraphicsPath path = Round(stageRect, 18))
            using (SolidBrush fill = new SolidBrush(Color.FromArgb((int)(220 * plateA), night)))
            using (Pen edge = new Pen(Color.FromArgb((int)(160 * t), accent), 1.5f)) {
                g.FillPath(fill, path);
                g.DrawPath(edge, path);
            }

            if (!allApps) {
                for (int i = 0; i < wins.Count; i++) {
                    Rectangle box = wins[i].Slot;
                    bool hot = i == selWin;
                    using (GraphicsPath wp = Round(box, 12))
                    using (SolidBrush card = new SolidBrush(Color.FromArgb(hot ? 240 : 200, 14, 16, 24)))
                    using (Pen pe = new Pen(hot ? accent : Color.FromArgb(60, 255, 255, 255), hot ? 2f : 1f)) {
                        g.FillPath(card, wp);
                        g.DrawPath(pe, wp);
                    }
                    // fallback icon if no DWM thumb
                    if (i >= thumbs.Count || thumbs[i] == IntPtr.Zero) {
                        if (wins[i].Face != null) {
                            try {
                                g.DrawImage(wins[i].Face, box.X + 8, box.Y + 8, box.Width - 16, box.Height - 36);
                            } catch { }
                        }
                    }
                    using (SolidBrush tb = new SolidBrush(ink)) {
                        string title = wins[i].Title;
                        if (wins[i].Minimized) title = "▢ " + title;
                        g.DrawString(title, small, tb, box.X + 8, box.Bottom - 20);
                    }
                }
                if (wins.Count == 0) {
                    using (SolidBrush tb = new SolidBrush(Color.FromArgb(160, ink)))
                        g.DrawString("Немає відкритих вікон", huge, tb, stageRect.X + 32, stageRect.Y + stageRect.Height / 2 - 12);
                }
            } else {
                using (SolidBrush tb = new SolidBrush(ink))
                    g.DrawString("Усі програми", titleFont, tb, stageRect.X + 24, stageRect.Y + 48);
                for (int i = 0; i < catalog.Count; i++) {
                    OverviewApp a = catalog[i];
                    using (GraphicsPath p = Round(a.Slot, 12))
                    using (SolidBrush b = new SolidBrush(Color.FromArgb(200, 18, 20, 28)))
                        g.FillPath(b, p);
                    if (a.Face != null) {
                        try { g.DrawImage(a.Face, a.Slot.X + 28, a.Slot.Y + 12, 36, 36); } catch { }
                    }
                    using (SolidBrush tb = new SolidBrush(ink)) {
                        string name = a.Title.Length > 12 ? a.Title.Substring(0, 11) + "…" : a.Title;
                        SizeF sz = g.MeasureString(name, small);
                        g.DrawString(name, small, tb, a.Slot.X + (a.Slot.Width - sz.Width) / 2, a.Slot.Bottom - 22);
                    }
                }
            }

            // dock
            if (t > 0.05f) {
                using (GraphicsPath dp = Round(new Rectangle(dockRect.X + 40, dockRect.Y + 8, dockRect.Width - 80, dockRect.Height - 16), 18))
                using (SolidBrush db = new SolidBrush(Color.FromArgb((int)(230 * t), night)))
                    g.FillPath(db, dp);
                for (int i = 0; i < dockApps.Count; i++) {
                    OverviewApp a = dockApps[i];
                    bool hot = i == selDock;
                    Rectangle r = a.Slot;
                    if (hot) {
                        using (SolidBrush hb = new SolidBrush(Color.FromArgb(70, accent)))
                            g.FillEllipse(hb, r.X - 4, r.Y - 4, r.Width + 8, r.Height + 8);
                    }
                    if (a.IsAllApps) {
                        using (SolidBrush tb = new SolidBrush(ink))
                            g.DrawString("⊞", huge, tb, r.X + 6, r.Y + 4);
                    } else if (a.Face != null) {
                        try { g.DrawImage(a.Face, r); } catch { }
                    } else {
                        using (SolidBrush tb = new SolidBrush(accent))
                            g.FillEllipse(tb, r);
                    }
                    if (a.Running) {
                        using (SolidBrush dot = new SolidBrush(accent))
                            g.FillEllipse(dot, r.X + r.Width / 2 - 3, r.Bottom + 2, 6, 6);
                    }
                }
            }

            using (SolidBrush tip = new SolidBrush(Color.FromArgb((int)(140 * t), ink)))
                g.DrawString("Win / Esc — закрити · Enter — відкрити · Усі програми — пошук", small, tip, 24, 16);
        }

        static GraphicsPath Round(Rectangle r, int rad) {
            GraphicsPath p = new GraphicsPath();
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

        protected override void OnMouseDown(MouseEventArgs e) {
            if (allApps) {
                for (int i = 0; i < catalog.Count; i++) {
                    if (catalog[i].Slot.Contains(e.Location)) {
                        LaunchPath(catalog[i].Path);
                        return;
                    }
                }
                if (!stageRect.Contains(e.Location) && !dockRect.Contains(e.Location) && !searchBox.Bounds.Contains(e.Location)) {
                    if (RequestClose != null) RequestClose();
                }
            } else {
                for (int i = 0; i < wins.Count; i++) {
                    if (wins[i].Slot.Contains(e.Location)) {
                        if (ActivateWindow != null) ActivateWindow(wins[i].Hwnd);
                        return;
                    }
                }
            }
            for (int i = 0; i < dockApps.Count; i++) {
                if (!dockApps[i].Slot.Contains(e.Location)) continue;
                OverviewApp a = dockApps[i];
                if (a.IsAllApps) {
                    allApps = !allApps;
                    ClearThumbs();
                    if (!allApps) RegisterThumbs();
                    LayoutSlots();
                    PlaceThumbs();
                    Invalidate();
                    return;
                }
                if (a.LiveHwnd != IntPtr.Zero && Native.IsWindow(a.LiveHwnd)) {
                    if (ActivateWindow != null) ActivateWindow(a.LiveHwnd);
                    return;
                }
                if (!string.IsNullOrEmpty(a.Path)) LaunchPath(a.Path);
                else if (runDesk != null && a.Title == "Terminal") runDesk("term");
                return;
            }
            if (!stageRect.Contains(e.Location) && !dockRect.Contains(e.Location)) {
                if (RequestClose != null) RequestClose();
            }
            base.OnMouseDown(e);
        }

        void LaunchPath(string path) {
            bool ok = false;
            try { ok = FoxLaunch.Open(path); } catch { ok = false; }
            if (!ok) {
                try { FoxToast.Show("FOX Overview · не вдалося запустити"); } catch { }
                return;
            }
            if (RequestClose != null) RequestClose();
        }

        protected override void OnMouseMove(MouseEventArgs e) {
            int sw = -1, sd = -1;
            for (int i = 0; i < wins.Count; i++) if (wins[i].Slot.Contains(e.Location)) { sw = i; break; }
            for (int i = 0; i < dockApps.Count; i++) if (dockApps[i].Slot.Contains(e.Location)) { sd = i; break; }
            if (sw != selWin || sd != selDock) { selWin = sw; selDock = sd; Invalidate(); }
            base.OnMouseMove(e);
        }

        protected override bool ProcessCmdKey(ref Message msg, Keys keyData) {
            if (keyData == Keys.Escape) {
                if (allApps) {
                    allApps = false;
                    searchBox.Visible = false;
                    RegisterThumbs();
                    LayoutSlots();
                    PlaceThumbs();
                    Invalidate();
                    return true;
                }
                if (RequestClose != null) RequestClose();
                return true;
            }
            if (allApps && searchBox.Focused) return base.ProcessCmdKey(ref msg, keyData);
            if (keyData == Keys.Enter) {
                if (!allApps && selWin >= 0 && selWin < wins.Count) {
                    if (ActivateWindow != null) ActivateWindow(wins[selWin].Hwnd);
                    return true;
                }
            }
            if (keyData == Keys.Right || keyData == Keys.Tab) {
                if (!allApps && wins.Count > 0) {
                    selWin = (selWin + 1) % wins.Count;
                    Invalidate();
                    return true;
                }
            }
            if (keyData == Keys.Left) {
                if (!allApps && wins.Count > 0) {
                    selWin = (selWin - 1 + wins.Count) % wins.Count;
                    Invalidate();
                    return true;
                }
            }
            if (keyData == Keys.Down || keyData == Keys.Up) {
                if (!allApps && wins.Count > 0) {
                    int cols = (int)Math.Ceiling(Math.Sqrt(wins.Count));
                    if (cols < 1) cols = 1;
                    int next = selWin + (keyData == Keys.Down ? cols : -cols);
                    if (next >= 0 && next < wins.Count) { selWin = next; Invalidate(); }
                    return true;
                }
            }
            return base.ProcessCmdKey(ref msg, keyData);
        }

        protected override void Dispose(bool disposing) {
            if (disposing) {
                try { refresh.Stop(); refresh.Dispose(); } catch { }
                try { anim.Stop(); anim.Dispose(); } catch { }
                ClearThumbs();
                titleFont.Dispose(); small.Dispose(); huge.Dispose(); searchFont.Dispose();
            }
            base.Dispose(disposing);
        }
    }
}
