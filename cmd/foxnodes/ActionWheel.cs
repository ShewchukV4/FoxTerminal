// Radial action wheel near the cursor. Hold hotkey → aim → release once.
// Does not replace Node Launcher. C# 5 / .NET Framework 4.x.

using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows.Forms;
using FoxOs.Sdk;

namespace FoxOs.Nodes {

    sealed class ActionWheelHost : IDisposable {
        public const int HOTKEY_WHEEL = 0x4E03;

        readonly HotkeyHost pump;
        readonly ActionRunner runner;
        readonly ActionWheelOverlay overlay;
        readonly System.Windows.Forms.Timer holdTimer;
        ActionWheelFeature cfg = new ActionWheelFeature();
        bool armed;
        bool visible;
        bool cancelled;
        uint boundVk;
        uint boundMod;
        int lastRev = -1;

        public ActionWheelHost(HotkeyHost host, ActionRunner actions) {
            pump = host;
            runner = actions;
            overlay = new ActionWheelOverlay();
            overlay.EscapeCancel += delegate { CancelGesture(); };
            holdTimer = new System.Windows.Forms.Timer();
            holdTimer.Interval = 16;
            holdTimer.Tick += OnHoldTick;
            Reload();
        }

        public void Reload() {
            FoxFeaturesDoc doc = FoxFeatures.Load();
            cfg = doc.actionWheel ?? new ActionWheelFeature();
            FoxFeatures.Normalize(doc);
            cfg = doc.actionWheel;
            lastRev = doc.revision;
            overlay.ApplyConfig(cfg);
            Rebind();
        }

        void Rebind() {
            try { NativeWin.UnregisterHotKey(pump.Handle, HOTKEY_WHEEL); } catch { }
            armed = false;
            boundVk = 0;
            boundMod = 0;
            if (cfg == null || !cfg.enabled) return;
            HotkeySpec hk = new HotkeySpec {
                ctrl = cfg.ctrl,
                alt = cfg.alt,
                shift = cfg.shift,
                win = cfg.win,
                key = cfg.key
            };
            boundMod = NativeWin.ModifiersFromHotkey(hk);
            boundVk = NativeWin.VkFromHotkey(hk);
            if (boundVk == 0) return;
            // Avoid clobbering Node Launcher Ctrl+Alt+Space
            if (boundVk == (uint)Keys.Space && cfg.ctrl && cfg.alt && !cfg.shift && !cfg.win) {
                FoxToast.Show("колесо · конфлікт з Node Launcher — змініть комбінацію");
                return;
            }
            if (!NativeWin.RegisterHotKey(pump.Handle, HOTKEY_WHEEL, boundMod, boundVk)) {
                FoxToast.Show("колесо · комбінація зайнята");
                return;
            }
            armed = true;
        }

        public bool HandleHotkeyMessage(int id) {
            if (id != HOTKEY_WHEEL) return false;
            if (!armed || cfg == null || !cfg.enabled) return false;
            BeginGesture();
            return true;
        }

        void BeginGesture() {
            cancelled = false;
            visible = true;
            Point pt = Control.MousePosition;
            overlay.ShowAt(pt);
            if (!holdTimer.Enabled) holdTimer.Start();
        }

        void OnHoldTick(object sender, EventArgs e) {
            if (!visible) {
                holdTimer.Stop();
                return;
            }
            // Poll features reload lightly
            try {
                FoxFeaturesDoc doc = FoxFeatures.Load();
                if (doc.revision != lastRev) Reload();
            } catch { }

            if (cancelled || !KeysStillDown()) {
                holdTimer.Stop();
                FinishGesture();
                return;
            }
            overlay.TrackCursor(Control.MousePosition);
        }

        bool KeysStillDown() {
            if (boundVk == 0) return false;
            if ((NativeWin.GetAsyncKeyState((int)boundVk) & 0x8000) == 0) return false;
            if ((boundMod & NativeWin.MOD_CONTROL) != 0 &&
                (NativeWin.GetAsyncKeyState((int)Keys.ControlKey) & 0x8000) == 0) return false;
            if ((boundMod & NativeWin.MOD_ALT) != 0 &&
                (NativeWin.GetAsyncKeyState((int)Keys.Menu) & 0x8000) == 0) return false;
            if ((boundMod & NativeWin.MOD_SHIFT) != 0 &&
                (NativeWin.GetAsyncKeyState((int)Keys.ShiftKey) & 0x8000) == 0) return false;
            if ((boundMod & NativeWin.MOD_WIN) != 0) {
                if ((NativeWin.GetAsyncKeyState((int)Keys.LWin) & 0x8000) == 0 &&
                    (NativeWin.GetAsyncKeyState((int)Keys.RWin) & 0x8000) == 0) return false;
            }
            return true;
        }

        void CancelGesture() {
            cancelled = true;
            visible = false;
            holdTimer.Stop();
            overlay.HideWheel();
        }

        void FinishGesture() {
            visible = false;
            ActionWheelSector chosen = null;
            if (!cancelled) chosen = overlay.SelectedSector;
            overlay.HideWheel();
            if (cancelled || chosen == null) return;
            RunSector(chosen);
        }

        void RunSector(ActionWheelSector s) {
            if (s == null) return;
            string kind = (s.kind ?? "").Trim().ToLowerInvariant();
            string cmd = (s.command ?? "").Trim();
            try {
                if (kind == "media") {
                    WriteMedia(cmd.Length == 0 ? "playpause" : cmd);
                    return;
                }
                if (kind == "internal") {
                    if (cmd == "vol" || cmd == "mixer") {
                        File.WriteAllText(Path.Combine(FoxPaths.RuntimeDir(), "vol.req"), "1");
                        return;
                    }
                    if (cmd == "screenshot" || cmd == "shot") {
                        TakeScreenshot();
                        return;
                    }
                    if (cmd == "headphones-resume") {
                        File.WriteAllText(Path.Combine(FoxPaths.RuntimeDir(), "headphones-resume.act"), "1");
                        return;
                    }
                    return;
                }
                MenuActionSpec act = new MenuActionSpec();
                act.kind = kind;
                act.command = cmd;
                act.path = cmd;
                runner.Run(act, null);
            } catch (Exception ex) {
                FoxToast.Show("колесо · " + ex.Message);
            }
        }

        static void WriteMedia(string line) {
            try {
                File.AppendAllText(
                    Path.Combine(FoxPaths.RuntimeDir(), "media-cmd.txt"),
                    line + Environment.NewLine, Encoding.UTF8);
            } catch { }
        }

        static void TakeScreenshot() {
            try {
                Rectangle bounds = SystemInformation.VirtualScreen;
                using (Bitmap bmp = new Bitmap(bounds.Width, bounds.Height, PixelFormat.Format32bppArgb)) {
                    using (Graphics g = Graphics.FromImage(bmp)) {
                        g.CopyFromScreen(bounds.Left, bounds.Top, 0, 0, bounds.Size);
                    }
                    string dir = Path.Combine(
                        Environment.GetFolderPath(Environment.SpecialFolder.MyPictures),
                        "Screenshots");
                    Directory.CreateDirectory(dir);
                    string file = Path.Combine(dir,
                        "FOX-" + DateTime.Now.ToString("yyyyMMdd-HHmmss") + ".png");
                    bmp.Save(file, ImageFormat.Png);
                    FoxToast.Show("скриншот · " + Path.GetFileName(file));
                }
            } catch {
                try {
                    // Fallback: PrintScreen key
                    NativeWin.keybd_event(0x2C, 0, 0, UIntPtr.Zero);
                    NativeWin.keybd_event(0x2C, 0, 2, UIntPtr.Zero);
                    FoxToast.Show("скриншот · PrintScreen");
                } catch { }
            }
        }

        public void Dispose() {
            try { holdTimer.Stop(); holdTimer.Dispose(); } catch { }
            try { NativeWin.UnregisterHotKey(pump.Handle, HOTKEY_WHEEL); } catch { }
            try { overlay.Dispose(); } catch { }
        }
    }

    sealed class ActionWheelOverlay : Form {
        public event Action EscapeCancel;
        public ActionWheelSector SelectedSector { get; private set; }

        ActionWheelFeature cfg = new ActionWheelFeature();
        List<ActionWheelSector> sectors = new List<ActionWheelSector>();
        Point centerScreen;
        int radius = 168;
        int dead = 28;
        int selected = -1;
        float pop = 0f;
        readonly System.Windows.Forms.Timer anim;
        readonly Font titleFont;
        readonly Font iconFont;
        readonly Font tipFont;
        Color night = Color.FromArgb(16, 18, 28);
        Color accent = Color.FromArgb(123, 92, 255);
        Color ink = Color.FromArgb(230, 232, 240);

        public ActionWheelOverlay() {
            Text = "Fox Action Wheel";
            FormBorderStyle = FormBorderStyle.None;
            ShowInTaskbar = false;
            StartPosition = FormStartPosition.Manual;
            TopMost = true;
            DoubleBuffered = true;
            BackColor = Color.Magenta;
            TransparencyKey = Color.Magenta;
            Width = 1; Height = 1;
            Opacity = 0;
            titleFont = new Font("Segoe UI Semibold", 11f, FontStyle.Bold);
            iconFont = new Font("Segoe UI Symbol", 18f, FontStyle.Regular);
            tipFont = new Font("Segoe UI", 8.5f, FontStyle.Regular);
            anim = new System.Windows.Forms.Timer();
            anim.Interval = 16;
            anim.Tick += OnAnim;
            KeyPreview = true;
            LoadTheme();
        }

        protected override CreateParams CreateParams {
            get {
                CreateParams cp = base.CreateParams;
                cp.ExStyle |= 0x08000000; // WS_EX_NOACTIVATE
                cp.ExStyle |= 0x00000080; // WS_EX_TOOLWINDOW
                return cp;
            }
        }

        protected override bool ShowWithoutActivation { get { return true; } }

        protected override bool ProcessCmdKey(ref Message msg, Keys keyData) {
            if (keyData == Keys.Escape) {
                if (EscapeCancel != null) EscapeCancel();
                return true;
            }
            return base.ProcessCmdKey(ref msg, keyData);
        }

        public void ApplyConfig(ActionWheelFeature feature) {
            cfg = feature ?? new ActionWheelFeature();
            sectors = new List<ActionWheelSector>();
            if (cfg.sectors != null) {
                for (int i = 0; i < cfg.sectors.Count; i++) {
                    if (cfg.sectors[i] != null) sectors.Add(cfg.sectors[i]);
                }
            }
            if (sectors.Count == 0) sectors = FoxFeatures.DefaultWheelSectors();
            radius = Math.Max(120, Math.Min(260, cfg.sizeDip));
            dead = Math.Max(12, cfg.deadZoneDip);
        }

        void LoadTheme() {
            try {
                string style = Path.Combine(FoxPaths.RuntimeDir(), "style.json");
                if (!File.Exists(style)) return;
                string raw = File.ReadAllText(style);
                night = Hex(Grab(raw, "bg"), night);
                if (night.R < 8 && night.G < 8 && night.B < 8)
                    night = Hex(Grab(raw, "surface"), night);
                accent = Hex(Grab(raw, "accent"), accent);
                ink = Hex(Grab(raw, "ink"), ink);
            } catch { }
        }

        static string Grab(string json, string key) {
            System.Text.RegularExpressions.Match m = System.Text.RegularExpressions.Regex.Match(
                json, "\"" + key + "\"\\s*:\\s*\"(#[0-9A-Fa-f]{6})\"");
            return m.Success ? m.Groups[1].Value : "";
        }

        static Color Hex(string h, Color fallback) {
            if (string.IsNullOrEmpty(h) || h.Length < 7) return fallback;
            try {
                return Color.FromArgb(
                    Convert.ToInt32(h.Substring(1, 2), 16),
                    Convert.ToInt32(h.Substring(3, 2), 16),
                    Convert.ToInt32(h.Substring(5, 2), 16));
            } catch { return fallback; }
        }

        public void ShowAt(Point cursorScreen) {
            LoadTheme();
            SelectedSector = null;
            selected = -1;
            int size = radius * 2 + 48;
            Screen scr = Screen.FromPoint(cursorScreen);
            Rectangle wa = scr.WorkingArea;
            int cx = cursorScreen.X;
            int cy = cursorScreen.Y;
            // Keep full wheel on-screen (multi-monitor / negative coords)
            if (cx - radius - 24 < wa.Left) cx = wa.Left + radius + 24;
            if (cy - radius - 24 < wa.Top) cy = wa.Top + radius + 24;
            if (cx + radius + 24 > wa.Right) cx = wa.Right - radius - 24;
            if (cy + radius + 24 > wa.Bottom) cy = wa.Bottom - radius - 24;
            centerScreen = new Point(cx, cy);
            Bounds = new Rectangle(cx - size / 2, cy - size / 2, size, size);
            pop = 0f;
            Opacity = 0.05;
            if (!Visible) Show();
            else { Location = Bounds.Location; Size = Bounds.Size; }
            BringToFront();
            if (!anim.Enabled) anim.Start();
            Invalidate();
        }

        public void TrackCursor(Point cursorScreen) {
            if (!Visible) return;
            int dx = cursorScreen.X - centerScreen.X;
            int dy = cursorScreen.Y - centerScreen.Y;
            double dist = Math.Sqrt(dx * (double)dx + dy * (double)dy);
            int next = -1;
            if (dist >= dead && sectors.Count > 0) {
                double ang = Math.Atan2(dy, dx); // -pi..pi, 0 = east
                if (ang < 0) ang += Math.PI * 2;
                double slice = (Math.PI * 2) / sectors.Count;
                // offset so sector 0 starts at top (-90deg)
                ang = (ang + Math.PI / 2);
                if (ang >= Math.PI * 2) ang -= Math.PI * 2;
                next = (int)(ang / slice);
                if (next < 0) next = 0;
                if (next >= sectors.Count) next = sectors.Count - 1;
            }
            if (next != selected) {
                selected = next;
                SelectedSector = (selected >= 0 && selected < sectors.Count) ? sectors[selected] : null;
                Invalidate();
            }
        }

        public void HideWheel() {
            SelectedSector = null;
            selected = -1;
            pop = 0f;
            try { anim.Stop(); } catch { }
            try { Hide(); Opacity = 0; } catch { }
        }

        void OnAnim(object sender, EventArgs e) {
            if (!Visible) { anim.Stop(); return; }
            if (pop < 1f) {
                pop += 0.14f;
                if (pop > 1f) pop = 1f;
                float e2 = FoxEase.EaseOutCubic(pop);
                Opacity = 0.2 + 0.75 * e2;
                Invalidate();
            } else {
                // Idle — stop timer; TrackCursor still invalidates on selection change
                anim.Stop();
            }
        }

        protected override void OnPaint(PaintEventArgs e) {
            Graphics g = e.Graphics;
            g.Clear(Color.Magenta);
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.ClearTypeGridFit;
            float scale = 0.86f + 0.14f * FoxEase.EaseOutCubic(pop);
            int cx = Width / 2;
            int cy = Height / 2;
            int r = (int)(radius * scale);

            using (GraphicsPath ring = new GraphicsPath()) {
                ring.AddEllipse(cx - r, cy - r, r * 2, r * 2);
                using (SolidBrush fill = new SolidBrush(Color.FromArgb(230, night)))
                    g.FillPath(fill, ring);
                using (Pen edge = new Pen(Color.FromArgb(180, accent), 2f))
                    g.DrawPath(edge, ring);
            }

            // dead zone
            using (SolidBrush dz = new SolidBrush(Color.FromArgb(40, 255, 255, 255)))
                g.FillEllipse(dz, cx - dead, cy - dead, dead * 2, dead * 2);

            int n = sectors.Count;
            if (n == 0) return;
            double slice = (Math.PI * 2) / n;
            for (int i = 0; i < n; i++) {
                double a0 = -Math.PI / 2 + i * slice;
                double a1 = a0 + slice;
                double mid = (a0 + a1) / 2;
                int ix = cx + (int)(Math.Cos(mid) * (r * 0.62));
                int iy = cy + (int)(Math.Sin(mid) * (r * 0.62));
                bool hot = i == selected;
                if (hot) {
                    using (SolidBrush hotBr = new SolidBrush(Color.FromArgb(90, accent)))
                        g.FillPie(hotBr, cx - r + 4, cy - r + 4, (r - 4) * 2, (r - 4) * 2,
                            (float)(a0 * 180 / Math.PI), (float)(slice * 180 / Math.PI));
                }
                ActionWheelSector s = sectors[i];
                using (SolidBrush ibr = new SolidBrush(hot ? accent : ink)) {
                    string icon = string.IsNullOrEmpty(s.icon) ? "·" : s.icon;
                    SizeF sz = g.MeasureString(icon, iconFont);
                    g.DrawString(icon, iconFont, ibr, ix - sz.Width / 2, iy - sz.Height / 2 - 6);
                }
            }

            string label = selected >= 0 && selected < n ? sectors[selected].title : "скасувати";
            using (SolidBrush tb = new SolidBrush(ink)) {
                SizeF ts = g.MeasureString(label, titleFont);
                g.DrawString(label, titleFont, tb, cx - ts.Width / 2, cy - ts.Height / 2);
            }
            using (SolidBrush tip = new SolidBrush(Color.FromArgb(140, ink))) {
                string hint = "відпустити = дія · Esc / центр = скасувати";
                SizeF hs = g.MeasureString(hint, tipFont);
                g.DrawString(hint, tipFont, tip, cx - hs.Width / 2, cy + r - 22);
            }
        }

        protected override void Dispose(bool disposing) {
            if (disposing) {
                try { anim.Stop(); anim.Dispose(); } catch { }
                titleFont.Dispose(); iconFont.Dispose(); tipFont.Dispose();
            }
            base.Dispose(disposing);
        }
    }
}
