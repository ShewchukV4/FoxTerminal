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
using System.Windows.Forms;

namespace FoxOsLive {

    // pins.json: [{id,title,path,act}, ...] — user-editable dock pins
    static class PinStore {
        public static string PathIn(string foxosDir) {
            return System.IO.Path.Combine(foxosDir ?? "", "pins.json");
        }

        public static List<FoxPin> Load(string foxosDir, State state) {
            var list = new List<FoxPin>();
            string path = PathIn(foxosDir);
            if (File.Exists(path)) {
                try {
                    string json = File.ReadAllText(path);
                    foreach (Match block in Regex.Matches(json, "\\{[^}]+\\}")) {
                        string o = block.Value;
                        string id = Grab(o, "id");
                        string title = Grab(o, "title");
                        string pth = Grab(o, "path");
                        string act = Grab(o, "act");
                        if (string.IsNullOrEmpty(id) && string.IsNullOrEmpty(pth)) continue;
                        var p = new FoxPin();
                        p.Id = id;
                        p.Title = string.IsNullOrEmpty(title) ? id : title;
                        p.Path = pth;
                        p.Act = act ?? "";
                        list.Add(p);
                    }
                } catch { }
            }
            if (list.Count == 0) {
                Add(list, "cursor", "Cursor", state != null ? state.PinCursor : "", "");
                Add(list, "zen", "Zen", state != null ? state.PinZen : "", "");
                Add(list, "term", "Terminal", state != null ? state.PinTerm : "", "term");
            }
            return list;
        }

        static string Grab(string json, string key) {
            var m = Regex.Match(json, "\"" + key + "\"\\s*:\\s*\"([^\"]*)\"");
            return m.Success ? Unesc(m.Groups[1].Value) : "";
        }

        static void Add(List<FoxPin> list, string id, string title, string path, string act) {
            var p = new FoxPin();
            p.Id = id; p.Title = title; p.Path = path ?? ""; p.Act = act ?? "";
            list.Add(p);
        }

        public static void Save(string foxosDir, List<FoxPin> pins) {
            if (string.IsNullOrEmpty(foxosDir) || pins == null) return;
            try {
                Directory.CreateDirectory(foxosDir);
                var sb = new StringBuilder();
                sb.Append("[\n");
                for (int i = 0; i < pins.Count; i++) {
                    FoxPin p = pins[i];
                    if (i > 0) sb.Append(",\n");
                    sb.Append("  {\"id\":\"").Append(Esc(p.Id))
                      .Append("\",\"title\":\"").Append(Esc(p.Title))
                      .Append("\",\"path\":\"").Append(Esc(p.Path))
                      .Append("\",\"act\":\"").Append(Esc(p.Act)).Append("\"}");
                }
                sb.Append("\n]\n");
                File.WriteAllText(PathIn(foxosDir), sb.ToString());
            } catch { }
        }

        static string Esc(string s) {
            if (string.IsNullOrEmpty(s)) return "";
            return s.Replace("\\", "\\\\").Replace("\"", "\\\"");
        }
        static string Unesc(string s) {
            if (string.IsNullOrEmpty(s)) return "";
            return s.Replace("\\\"", "\"").Replace("\\\\", "\\");
        }
    }

    // Hover thumbnail for dock window icons
    sealed class ThumbPeek : Form {
        [DllImport("user32.dll")] static extern bool PrintWindow(IntPtr hwnd, IntPtr hdcBlt, uint nFlags);

        Bitmap shot;
        IntPtr target;
        readonly Font font;

        public ThumbPeek() {
            FormBorderStyle = FormBorderStyle.None;
            ShowInTaskbar = false;
            TopMost = true;
            StartPosition = FormStartPosition.Manual;
            BackColor = Color.FromArgb(18, 20, 28);
            DoubleBuffered = true;
            font = new Font("Consolas", 11f, FontStyle.Regular, GraphicsUnit.Pixel);
            Size = new Size(220, 140);
        }

        public void ShowFor(IntPtr hwnd, string title, Point screenNear, Color accent) {
            if (hwnd == IntPtr.Zero || !Native.IsWindow(hwnd)) { Hide(); return; }
            if (target != hwnd) {
                target = hwnd;
                if (shot != null) { shot.Dispose(); shot = null; }
                shot = Capture(hwnd);
            }
            Text = title ?? "";
            int x = screenNear.X - Width / 2;
            int y = screenNear.Y - Height - 12;
            Rectangle vs = SystemInformation.VirtualScreen;
            if (x < vs.X + 4) x = vs.X + 4;
            if (y < vs.Y + 4) y = screenNear.Y + 28;
            if (x + Width > vs.Right - 4) x = vs.Right - Width - 4;
            Bounds = new Rectangle(x, y, Width, Height);
            Tag = accent;
            if (!Visible) Show();
            else Invalidate();
        }

        static Bitmap Capture(IntPtr hwnd) {
            Native.RECT r;
            if (!Native.GetWindowRect(hwnd, out r)) return null;
            int w = Math.Max(1, r.R - r.L);
            int h = Math.Max(1, r.B - r.T);
            if (w > 2400 || h > 1600) { w = Math.Min(w, 1600); h = Math.Min(h, 900); }
            try {
                using (var full = new Bitmap(Math.Max(1, r.R - r.L), Math.Max(1, r.B - r.T), PixelFormat.Format32bppArgb)) {
                    using (var g = Graphics.FromImage(full)) {
                        IntPtr hdc = g.GetHdc();
                        try { PrintWindow(hwnd, hdc, 2); } catch { }
                        g.ReleaseHdc(hdc);
                    }
                    var small = new Bitmap(200, 112, PixelFormat.Format32bppArgb);
                    using (var g2 = Graphics.FromImage(small)) {
                        g2.Clear(Color.FromArgb(12, 14, 20));
                        g2.InterpolationMode = InterpolationMode.HighQualityBicubic;
                        g2.DrawImage(full, new Rectangle(0, 0, 200, 112));
                    }
                    return small;
                }
            } catch { return null; }
        }

        protected override void OnPaint(PaintEventArgs e) {
            var g = e.Graphics;
            g.Clear(BackColor);
            Color accent = Tag is Color ? (Color)Tag : Color.Orange;
            using (var edge = new Pen(Color.FromArgb(180, accent), 1f))
                g.DrawRectangle(edge, 0, 0, Width - 1, Height - 1);
            if (shot != null) g.DrawImage(shot, 10, 10, 200, 112);
            using (var br = new SolidBrush(Color.FromArgb(200, 210, 220))) {
                string t = Text ?? "";
                if (t.Length > 28) t = t.Substring(0, 28) + "…";
                g.DrawString(t, font, br, 10, Height - 22);
            }
        }

        protected override void Dispose(bool disposing) {
            if (disposing) {
                if (shot != null) shot.Dispose();
                if (font != null) font.Dispose();
            }
            base.Dispose(disposing);
        }
    }

    // Alt+Tab — DWM live thumbs (real window content, even when inactive)
    sealed class AltTabBoard : Form {
        [DllImport("dwmapi.dll")] static extern int DwmRegisterThumbnail(IntPtr dest, IntPtr src, out IntPtr thumb);
        [DllImport("dwmapi.dll")] static extern int DwmUnregisterThumbnail(IntPtr thumb);
        [DllImport("dwmapi.dll")] static extern int DwmUpdateThumbnailProperties(IntPtr thumb, ref ThumbProps props);
        [DllImport("user32.dll")] static extern IntPtr SendMessage(IntPtr h, uint msg, IntPtr w, IntPtr l);
        [DllImport("user32.dll", EntryPoint = "GetClassLongPtrW")] static extern IntPtr GetClassLongPtr(IntPtr h, int n);

        [StructLayout(LayoutKind.Sequential)]
        struct ThumbProps {
            public uint Flags;
            public Native.RECT Dest;
            public Native.RECT Source;
            public byte Opacity;
            public bool Visible;
            public bool ClientOnly;
        }

        const uint TNP_DEST = 0x1;
        const uint TNP_OPACITY = 0x4;
        const uint TNP_VISIBLE = 0x8;
        const uint TNP_CLIENT = 0x10;

        readonly List<FoxWin> wins = new List<FoxWin>();
        readonly List<IntPtr> thumbs = new List<IntPtr>();
        readonly Action<IntPtr> activate;
        readonly Font titleFont;
        readonly Font small;
        readonly System.Windows.Forms.Timer hold;
        readonly System.Windows.Forms.Timer slideTimer;
        Color night, accent;
        int sel;
        int restY;
        float slide; // 0..1 entrance
        const int ThumbW = 148;
        const int ThumbH = 90;
        const int Gap = 12;
        const int Pad = 16;

        public AltTabBoard(Color night, Color accent, Action<IntPtr> activate) {
            this.night = night;
            this.accent = accent;
            this.activate = activate;
            FormBorderStyle = FormBorderStyle.None;
            ShowInTaskbar = false;
            TopMost = true;
            StartPosition = FormStartPosition.Manual;
            DoubleBuffered = true;
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint | ControlStyles.OptimizedDoubleBuffer, true);
            // No TransparencyKey — DWM thumbnails need a real window surface.
            BackColor = Color.FromArgb(18, 20, 26);
            Opacity = 0.92;
            titleFont = new Font("Consolas", 13f, FontStyle.Bold, GraphicsUnit.Pixel);
            small = new Font("Consolas", 11f, FontStyle.Regular, GraphicsUnit.Pixel);
            KeyPreview = true;
            hold = new System.Windows.Forms.Timer();
            hold.Interval = 40;
            hold.Tick += delegate {
                if ((Control.ModifierKeys & Keys.Alt) == 0) Commit();
            };
            slideTimer = new System.Windows.Forms.Timer();
            slideTimer.Interval = 16;
            slideTimer.Tick += TickSlide;
        }

        void TickSlide(object s, EventArgs e) {
            if (slide >= 1f) { slide = 1f; slideTimer.Stop(); PlaceThumbs(); Invalidate(); return; }
            slide += (1f - slide) * 0.28f + 0.04f;
            if (slide > 0.995f) slide = 1f;
            float ease = 1f - (1f - slide) * (1f - slide);
            Top = restY + (int)((1f - ease) * 56f);
            Opacity = 0.72 + 0.20 * ease;
            PlaceThumbs();
            Invalidate();
        }

        public void Recolor(Color n, Color a) {
            night = n;
            accent = a;
            BackColor = Color.FromArgb(
                Math.Max(12, Math.Min(40, (int)n.R)),
                Math.Max(12, Math.Min(40, (int)n.G)),
                Math.Max(14, Math.Min(48, (int)n.B)));
            Invalidate();
        }

        public void ShowCycle(bool forward) {
            bool first = !Visible;
            if (first) EnumWins();
            if (wins.Count == 0) { Hide(); return; }
            if (first) {
                sel = wins.Count > 1 ? 1 : 0;
                if (!forward) sel = wins.Count - 1;
            } else {
                sel = (sel + (forward ? 1 : wins.Count - 1)) % wins.Count;
            }
            LayoutBoard();
            if (first) {
                restY = Top;
                Top = restY + 56;
                slide = 0f;
                Opacity = 0.72;
                Show();
                Activate();
                hold.Start();
                RegisterThumbs();
                slideTimer.Start();
            }
            PlaceThumbs();
            Invalidate();
        }

        void LayoutBoard() {
            int n = Math.Max(1, wins.Count);
            int inner = n * ThumbW + (n - 1) * Gap;
            int w = Math.Min(Screen.PrimaryScreen.WorkingArea.Width - 40, inner + Pad * 2);
            int h = ThumbH + 58;
            Rectangle sb = Screen.PrimaryScreen.WorkingArea;
            restY = sb.Bottom - h - 40;
            Bounds = new Rectangle(sb.X + (sb.Width - w) / 2, Visible ? Top : restY, w, h);
        }

        void EnumWins() {
            ClearThumbs();
            foreach (FoxWin w in wins) {
                if (w.Face != null) { w.Face.Dispose(); w.Face = null; }
            }
            wins.Clear();
            Native.EnumWindows(delegate(IntPtr h, IntPtr l) {
                if (!Native.IsWindowVisible(h)) return true;
                if (Native.GetWindow(h, 4) != IntPtr.Zero) return true;
                var sb = new StringBuilder(256);
                Native.GetWindowText(h, sb, 256);
                string title = (sb.ToString() ?? "").Trim();
                if (title.Length == 0) return true;
                uint pid;
                Native.GetWindowThreadProcessId(h, out pid);
                try {
                    using (var p = Process.GetProcessById((int)pid)) {
                        string n = (p.ProcessName ?? "").ToLowerInvariant();
                        if (n == "foxos-live" || n == "applicationframehost") return true;
                    }
                } catch { }
                var fw = new FoxWin();
                fw.Hwnd = h;
                fw.Title = title.Length > 36 ? title.Substring(0, 36) + "…" : title;
                fw.Face = IconFace(h);
                wins.Add(fw);
                return wins.Count < 9;
            }, IntPtr.Zero);
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
            if (!IsHandleCreated) return;
            for (int i = 0; i < wins.Count; i++) {
                IntPtr th;
                int hr = DwmRegisterThumbnail(Handle, wins[i].Hwnd, out th);
                thumbs.Add(hr == 0 ? th : IntPtr.Zero);
            }
        }

        Rectangle SlotRect(int i) {
            int total = wins.Count * ThumbW + Math.Max(0, wins.Count - 1) * Gap;
            int x0 = (Width - total) / 2;
            return new Rectangle(x0 + i * (ThumbW + Gap), 12, ThumbW, ThumbH);
        }

        void PlaceThumbs() {
            if (thumbs.Count != wins.Count) return;
            for (int i = 0; i < wins.Count; i++) {
                if (thumbs[i] == IntPtr.Zero) continue;
                Rectangle box = SlotRect(i);
                // inset so our border stays visible; client-only = no desktop bleed outside window
                var dest = new Native.RECT {
                    L = box.X + 3,
                    T = box.Y + 3,
                    R = box.Right - 3,
                    B = box.Bottom - 3
                };
                var props = new ThumbProps();
                props.Flags = TNP_DEST | TNP_VISIBLE | TNP_OPACITY | TNP_CLIENT;
                props.Dest = dest;
                props.Opacity = 255;
                props.Visible = true;
                props.ClientOnly = true;
                try { DwmUpdateThumbnailProperties(thumbs[i], ref props); } catch { }
            }
        }

        static Bitmap IconFace(IntPtr hwnd) {
            IntPtr hi = SendMessage(hwnd, 0x007F, (IntPtr)1, IntPtr.Zero);
            if (hi == IntPtr.Zero) hi = SendMessage(hwnd, 0x007F, IntPtr.Zero, IntPtr.Zero);
            if (hi == IntPtr.Zero) hi = GetClassLongPtr(hwnd, -14);
            if (hi == IntPtr.Zero) hi = GetClassLongPtr(hwnd, -34);
            var bmp = new Bitmap(ThumbW, ThumbH, PixelFormat.Format32bppArgb);
            using (var g = Graphics.FromImage(bmp)) {
                g.Clear(Color.FromArgb(255, 16, 18, 24));
                g.SmoothingMode = SmoothingMode.AntiAlias;
                if (hi != IntPtr.Zero) {
                    try {
                        using (var ico = Icon.FromHandle(hi))
                        using (var img = ico.ToBitmap()) {
                            int sz = 44;
                            g.DrawImage(img, (ThumbW - sz) / 2, (ThumbH - sz) / 2, sz, sz);
                        }
                    } catch { }
                }
            }
            return bmp;
        }

        void Commit() {
            hold.Stop();
            slideTimer.Stop();
            ClearThumbs();
            if (sel >= 0 && sel < wins.Count && activate != null) activate(wins[sel].Hwnd);
            Hide();
        }

        protected override void OnKeyDown(KeyEventArgs e) {
            if (e.KeyCode == Keys.Escape) {
                hold.Stop();
                slideTimer.Stop();
                ClearThumbs();
                Hide();
                return;
            }
            if (e.KeyCode == Keys.Tab) {
                ShowCycle(!e.Shift);
                e.Handled = true;
            }
            base.OnKeyDown(e);
        }

        protected override void OnVisibleChanged(EventArgs e) {
            base.OnVisibleChanged(e);
            if (!Visible) ClearThumbs();
        }

        protected override void OnPaint(PaintEventArgs e) {
            var g = e.Graphics;
            g.Clear(BackColor);
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.ClearTypeGridFit;

            // soft top accent line
            using (var wash = new SolidBrush(Color.FromArgb(28, accent))) {
                g.FillRectangle(wash, 0, 0, Width, 6);
            }
            using (var edge = new Pen(Color.FromArgb(110, accent), 1f)) {
                g.DrawRectangle(edge, 0, 0, Width - 1, Height - 1);
            }

            if (wins.Count == 0) return;

            using (var ink = new SolidBrush(Color.FromArgb(240, 242, 246)))
            using (var mute = new SolidBrush(Color.FromArgb(150, 158, 170)))
            using (var slotBg = new SolidBrush(Color.FromArgb(255, 12, 14, 20))) {
                for (int i = 0; i < wins.Count; i++) {
                    bool on = i == sel;
                    Rectangle box = SlotRect(i);
                    // fallback icon under DWM (shows if thumb fails / minimized)
                    g.FillRectangle(slotBg, box);
                    if (wins[i].Face != null && (i >= thumbs.Count || thumbs[i] == IntPtr.Zero)) {
                        g.DrawImage(wins[i].Face, box);
                    } else if (wins[i].Face != null) {
                        // tiny icon badge bottom-left as identity cue
                        g.DrawImage(wins[i].Face, new Rectangle(box.X + 4, box.Bottom - 22, 18, 18));
                    }
                    using (var pe = new Pen(on ? accent : Color.FromArgb(40, 255, 255, 255), on ? 2.2f : 1f)) {
                        g.DrawRectangle(pe, box);
                    }
                    if (on) {
                        using (var rail = new SolidBrush(accent)) {
                            g.FillRectangle(rail, box.X + 20, box.Bottom + 5, box.Width - 40, 2);
                        }
                    }
                }

                g.DrawString(wins[sel].Title, titleFont, ink, new Rectangle(Pad, Height - 34, Width - Pad * 2, 18),
                    new StringFormat { Alignment = StringAlignment.Center, Trimming = StringTrimming.EllipsisCharacter });
                g.DrawString("hold alt · tab cycle · esc cancel", small, mute, new Rectangle(0, Height - 16, Width, 14),
                    new StringFormat { Alignment = StringAlignment.Center });
            }

            // keep DWM dest rects in sync after paint/layout
            PlaceThumbs();
        }

        protected override void Dispose(bool disposing) {
            if (disposing) {
                hold.Stop(); hold.Dispose();
                slideTimer.Stop(); slideTimer.Dispose();
                ClearThumbs();
                titleFont.Dispose(); small.Dispose();
                foreach (FoxWin w in wins) { if (w.Face != null) w.Face.Dispose(); }
            }
            base.Dispose(disposing);
        }
    }

    // Wi-Fi picker — scan / connect / disconnect from the dock glyph
    sealed class WifiBoard : Form {
        static readonly Color Choke = Color.FromArgb(255, 1, 2, 3);
        const int Edge = 10;
        const int RowH = 44;
        const int DetailH = 108;
        const int Pad = 24;

        struct NetProp {
            public string Ssid;
            public int Signal;
            public bool Secured;
            public bool Connected;
            public bool HasProfile;
            public string Auth; // WPA2PSK / WPA3SAE / open
        }

        readonly Font titleFont;
        readonly Font rowFont;
        readonly Font small;
        readonly Font micro;
        readonly System.Windows.Forms.Timer blink;
        readonly System.Windows.Forms.Timer anim;
        Color night, accent;
        readonly List<NetProp> nets = new List<NetProp>();
        string status = "scanning…";
        string filter = "";
        string ifaceName = "WiFi";
        int sel;
        int scroll;
        int hover = -1;
        int hoverBtn; // 0 none, 1 close, 2 refresh, 3 disconnect, 4 action
        bool busy;
        bool acting; // connect/disconnect in flight
        bool caretOn = true;
        bool passMode;
        string passBuf = "";
        string passSsid = "";
        string passAuth = "WPA2PSK";
        int restY;
        float popT = 1f; // 0..1 entrance
        float selGlow; // selection pulse
        string actingSsid = "";
        readonly QuickUi.SoftOut soft = new QuickUi.SoftOut();

        public WifiBoard(Color nightColor, Color accentColor) {
            night = nightColor;
            accent = accentColor;
            Text = "FoxOS Wi-Fi";
            FormBorderStyle = FormBorderStyle.None;
            ShowInTaskbar = false;
            TopMost = true;
            StartPosition = FormStartPosition.Manual;
            DoubleBuffered = true;
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint | ControlStyles.OptimizedDoubleBuffer, true);
            BackColor = Choke;
            TransparencyKey = Choke;
            Opacity = 0.94;
            Size = new Size(448, 560);
            KeyPreview = true;
            titleFont = new Font("Consolas", 22f, FontStyle.Bold, GraphicsUnit.Pixel);
            rowFont = new Font("Consolas", 15f, FontStyle.Regular, GraphicsUnit.Pixel);
            small = new Font("Consolas", 12f, FontStyle.Regular, GraphicsUnit.Pixel);
            micro = new Font("Consolas", 11f, FontStyle.Bold, GraphicsUnit.Pixel);
            blink = new System.Windows.Forms.Timer();
            blink.Interval = 480;
            blink.Tick += delegate { caretOn = !caretOn; Invalidate(FilterRect()); };
            anim = new System.Windows.Forms.Timer();
            anim.Interval = 16;
            anim.Tick += TickAnim;
            PlaceNearTray();
            blink.Start();
            RefreshListAsync();
        }

        void TickAnim(object s, EventArgs e) {
            if (soft.Tick(this)) { Invalidate(); return; }
            bool dirty = false;
            if (popT < 1f) {
                popT += 0.11f;
                if (popT > 1f) popT = 1f;
                float ease = 1f - (1f - popT) * (1f - popT);
                Top = restY + (int)((1f - ease) * 36f);
                Opacity = 0.78 + 0.16 * ease;
                dirty = true;
            }
            if (acting || busy) {
                selGlow = (float)(0.5 + 0.5 * Math.Sin(Environment.TickCount / 220.0));
                dirty = true;
            } else if (selGlow > 0.02f) {
                selGlow *= 0.86f;
                dirty = true;
            } else selGlow = 0f;
            if (popT >= 1f && !acting && !busy && selGlow <= 0.02f && !soft.On) anim.Stop();
            if (dirty) Invalidate();
        }

        public void Recolor(Color n, Color a) {
            night = n; accent = a; Invalidate();
        }

        public void SoftClose() {
            soft.Begin(this);
            if (!anim.Enabled) anim.Start();
        }

        public void Pop() {
            soft.Cancel();
            PlaceNearTray();
            restY = Top;
            if (!Visible) {
                popT = 0f;
                Top = restY + 36;
                Opacity = 0.78;
                Show();
                Activate();
                anim.Start();
            } else {
                Activate();
                BringToFront();
                popT = 1f;
                Opacity = 0.94;
            }
            RefreshListAsync();
        }

        void PlaceNearTray() {
            Rectangle wa = Screen.PrimaryScreen.WorkingArea;
            int x = wa.Right - Width - 18;
            int y = wa.Bottom - Height - 48;
            if (x < wa.X + 12) x = wa.X + 12;
            if (y < wa.Y + 12) y = wa.Y + 12;
            Location = new Point(x, y);
        }

        Rectangle Island() { return new Rectangle(Edge, Edge, Width - Edge * 2, Height - Edge * 2); }
        int ListTop { get { return Island().Y + 156; } }
        int ListBottom { get { return Island().Bottom - DetailH - 14; } }
        int VisibleRows { get { return Math.Max(1, (ListBottom - ListTop) / RowH); } }

        Rectangle CloseRect() {
            var isl = Island();
            return new Rectangle(isl.Right - Pad - 30, isl.Y + 18, 30, 30);
        }
        Rectangle FilterRect() {
            var isl = Island();
            return new Rectangle(isl.X + Pad, isl.Y + 72, isl.Width - Pad * 2, 30);
        }
        Rectangle RefreshRect() {
            var isl = Island();
            return new Rectangle(isl.X + Pad, isl.Y + 112, 108, 28);
        }
        Rectangle DisconnectRect() {
            var isl = Island();
            return new Rectangle(isl.X + Pad + 116, isl.Y + 112, 118, 28);
        }
        Rectangle DetailRect() {
            var isl = Island();
            return new Rectangle(isl.X + Pad, isl.Bottom - DetailH, isl.Width - Pad * 2, DetailH - 16);
        }
        Rectangle ActionRect() {
            var d = DetailRect();
            return new Rectangle(d.Right - 118, d.Y + 12, 102, 28);
        }

        void RefreshListAsync() {
            if (acting) return;
            if (busy) return;
            busy = true;
            status = "scanning…";
            if (!anim.Enabled) anim.Start();
            Invalidate();
            System.Threading.ThreadPool.QueueUserWorkItem(delegate {
                string iface;
                var list = ScanNets(out iface);
                try {
                    BeginInvoke(new Action(delegate {
                        if (!string.IsNullOrEmpty(iface)) ifaceName = iface;
                        nets.Clear();
                        nets.AddRange(list);
                        if (sel >= nets.Count) sel = Math.Max(0, nets.Count - 1);
                        status = nets.Count == 0 ? "no networks" : (nets.Count + " networks");
                        busy = false;
                        Invalidate();
                    }));
                } catch { busy = false; }
            });
        }

        static string AfterColon(string line) {
            int c = line.IndexOf(':');
            return c >= 0 ? line.Substring(c + 1).Trim() : "";
        }

        static bool IsSsidLine(string t) {
            return t.StartsWith("SSID", StringComparison.OrdinalIgnoreCase)
                && !t.StartsWith("BSSID", StringComparison.OrdinalIgnoreCase);
        }

        static List<NetProp> ScanNets(out string iface) {
            iface = "WiFi";
            var map = new Dictionary<string, NetProp>(StringComparer.OrdinalIgnoreCase);
            string current = "";
            foreach (string line in Netsh("wlan show interfaces")) {
                string t = line.Trim();
                if (t.StartsWith("Name", StringComparison.OrdinalIgnoreCase) && t.Contains(":")) {
                    string v = AfterColon(t);
                    if (v.Length > 0) iface = v;
                } else if (IsSsidLine(t) && t.Contains(":")) {
                    current = AfterColon(t);
                }
            }
            var profiles = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (string line in Netsh("wlan show profiles")) {
                string t = line.Trim();
                if (t.IndexOf("All User Profile", StringComparison.OrdinalIgnoreCase) >= 0
                    || t.IndexOf("User Profile", StringComparison.OrdinalIgnoreCase) >= 0) {
                    string p = AfterColon(t);
                    if (p.Length > 0) profiles.Add(p);
                }
            }
            // force a radio scan (don't filter by interface — some drivers hide APs then)
            Netsh("wlan show networks mode=bssid");
            string ssid = null;
            int signal = 0;
            bool secured = false;
            string auth = "WPA2PSK";
            foreach (string line in Netsh("wlan show networks mode=bssid")) {
                string t = line.Trim();
                if (IsSsidLine(t)) {
                    if (!string.IsNullOrEmpty(ssid) && !map.ContainsKey(ssid)) {
                        map[ssid] = MakeNet(ssid, signal, secured, current, profiles, auth);
                    }
                    ssid = AfterColon(t);
                    if (ssid.Length == 0) ssid = null;
                    signal = 0; secured = false; auth = "WPA2PSK";
                } else if (t.StartsWith("Signal", StringComparison.OrdinalIgnoreCase)) {
                    string v = AfterColon(t).Replace("%", "").Trim();
                    int.TryParse(v, out signal);
                } else if (t.StartsWith("Authentication", StringComparison.OrdinalIgnoreCase)) {
                    secured = t.IndexOf("Open", StringComparison.OrdinalIgnoreCase) < 0;
                    auth = MapAuth(t);
                }
            }
            if (!string.IsNullOrEmpty(ssid) && !map.ContainsKey(ssid)) {
                map[ssid] = MakeNet(ssid, signal, secured, current, profiles, auth);
            }
            foreach (string p in profiles) {
                if (map.ContainsKey(p)) continue;
                map[p] = MakeNet(p, -1, true, current, profiles, "WPA2PSK");
            }
            var list = new List<NetProp>(map.Values);
            list.Sort(delegate(NetProp a, NetProp b) {
                if (a.Connected != b.Connected) return a.Connected ? -1 : 1;
                return b.Signal.CompareTo(a.Signal);
            });
            return list;
        }

        static string MapAuth(string line) {
            string u = (line ?? "").ToUpperInvariant();
            if (u.IndexOf("WPA3") >= 0) return "WPA3SAE";
            if (u.IndexOf("WPA2") >= 0) return "WPA2PSK";
            if (u.IndexOf("WPA") >= 0) return "WPAPSK";
            if (u.IndexOf("OPEN") >= 0) return "open";
            return "WPA2PSK";
        }

        static NetProp MakeNet(string ssid, int signal, bool secured, string current, HashSet<string> profiles, string auth) {
            var np = new NetProp();
            np.Ssid = ssid;
            np.Signal = signal;
            np.Secured = secured;
            np.Connected = string.Equals(ssid, current, StringComparison.OrdinalIgnoreCase);
            np.HasProfile = profiles.Contains(ssid);
            np.Auth = string.IsNullOrEmpty(auth) ? "WPA2PSK" : auth;
            return np;
        }

        static string Esc(string s) {
            return (s ?? "").Replace("\"", "");
        }

        static string[] Netsh(string args) {
            try {
                var psi = new ProcessStartInfo();
                psi.FileName = "netsh";
                psi.Arguments = args;
                psi.UseShellExecute = false;
                psi.RedirectStandardOutput = true;
                psi.RedirectStandardError = true;
                psi.CreateNoWindow = true;
                // netsh speaks OEM / system ANSI — UTF8 garbles names on some locales
                try { psi.StandardOutputEncoding = Encoding.Default; } catch { }
                using (var p = Process.Start(psi)) {
                    string o = p.StandardOutput.ReadToEnd();
                    p.WaitForExit(12000);
                    return (o ?? "").Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
                }
            } catch { return new string[0]; }
        }

        static string ReadConnectedSsid(string iface) {
            foreach (string line in Netsh("wlan show interfaces")) {
                string t = line.Trim();
                if (IsSsidLine(t) && t.Contains(":")) return AfterColon(t);
            }
            return "";
        }

        static string ReadInterfaceState(string iface) {
            foreach (string line in Netsh("wlan show interfaces")) {
                string t = line.Trim();
                if (t.StartsWith("State", StringComparison.OrdinalIgnoreCase)) return AfterColon(t).ToLowerInvariant();
            }
            return "";
        }

        List<int> Filtered() {
            var idx = new List<int>();
            string q = (filter ?? "").Trim().ToLowerInvariant();
            for (int i = 0; i < nets.Count; i++) {
                if (q.Length == 0 || nets[i].Ssid.ToLowerInvariant().IndexOf(q) >= 0) idx.Add(i);
            }
            return idx;
        }

        void ActivateSel() {
            if (acting) return;
            var idx = Filtered();
            if (sel < 0 || sel >= idx.Count) return;
            NetProp n = nets[idx[sel]];
            if (n.Connected) { DoDisconnect(); return; }
            DoConnect(n);
        }

        void DoDisconnect() {
            if (acting) return;
            acting = true;
            busy = true;
            actingSsid = "";
            status = "disconnecting…";
            if (!anim.Enabled) anim.Start();
            Invalidate();
            string iface = ifaceName;
            System.Threading.ThreadPool.QueueUserWorkItem(delegate {
                Netsh("wlan disconnect interface=\"" + Esc(iface) + "\"");
                Netsh("wlan disconnect");
                bool ok = false;
                for (int i = 0; i < 12; i++) {
                    System.Threading.Thread.Sleep(400);
                    string st = ReadInterfaceState(iface);
                    if (st.IndexOf("disconnect", StringComparison.OrdinalIgnoreCase) >= 0) { ok = true; break; }
                    if (string.IsNullOrEmpty(ReadConnectedSsid(iface))) { ok = true; break; }
                }
                try {
                    BeginInvoke(new Action(delegate {
                        acting = false;
                        busy = false;
                        status = ok ? "disconnected" : "disconnect failed";
                        RefreshListAsync();
                    }));
                } catch { acting = false; busy = false; }
            });
        }

        void DoConnect(NetProp n) {
            if (acting) return;
            if (!n.HasProfile && n.Secured) {
                BeginPass(n);
                return;
            }
            StartConnect(n.Ssid, n.Auth, null, !n.HasProfile && !n.Secured);
        }

        void BeginPass(NetProp n) {
            passMode = true;
            passBuf = "";
            passSsid = n.Ssid ?? "";
            passAuth = string.IsNullOrEmpty(n.Auth) ? "WPA2PSK" : n.Auth;
            status = "password · " + passSsid;
            Invalidate();
        }

        void CancelPass() {
            passMode = false;
            passBuf = "";
            passSsid = "";
            status = nets.Count + " networks";
            Invalidate();
        }

        void SubmitPass() {
            if (!passMode || passSsid.Length == 0) return;
            if (passBuf.Length < 8) {
                status = "password too short";
                Invalidate();
                return;
            }
            string ssid = passSsid;
            string auth = passAuth;
            string key = passBuf;
            passMode = false;
            passBuf = "";
            StartConnect(ssid, auth, key, false);
        }

        void StartConnect(string ssid, string auth, string password, bool openNoProfile) {
            acting = true;
            busy = true;
            actingSsid = ssid ?? "";
            status = "connecting…";
            if (!anim.Enabled) anim.Start();
            Invalidate();
            string iface = ifaceName;
            System.Threading.ThreadPool.QueueUserWorkItem(delegate {
                if (!string.IsNullOrEmpty(password)) {
                    string xmlPath = WriteWifiProfile(ssid, auth, password);
                    if (xmlPath != null) {
                        Netsh("wlan add profile filename=\"" + xmlPath + "\" user=current");
                        try { File.Delete(xmlPath); } catch { }
                    }
                }
                string cur = ReadConnectedSsid(iface);
                if (!string.IsNullOrEmpty(cur) && !string.Equals(cur, ssid, StringComparison.OrdinalIgnoreCase)) {
                    Netsh("wlan disconnect interface=\"" + Esc(iface) + "\"");
                    System.Threading.Thread.Sleep(500);
                }
                string cmd = "wlan connect name=\"" + Esc(ssid) + "\" ssid=\"" + Esc(ssid)
                    + "\" interface=\"" + Esc(iface) + "\"";
                string[] outLines = Netsh(cmd);
                string joined = string.Join(" ", outLines);
                bool accepted = joined.IndexOf("success", StringComparison.OrdinalIgnoreCase) >= 0
                    || joined.IndexOf("completed", StringComparison.OrdinalIgnoreCase) >= 0
                    || openNoProfile
                    || !string.IsNullOrEmpty(password);
                bool ok = false;
                for (int i = 0; i < 20; i++) {
                    System.Threading.Thread.Sleep(450);
                    string now = ReadConnectedSsid(iface);
                    if (string.Equals(now, ssid, StringComparison.OrdinalIgnoreCase)) { ok = true; break; }
                    if (!accepted && i >= 3) break;
                }
                try {
                    BeginInvoke(new Action(delegate {
                        acting = false;
                        busy = false;
                        actingSsid = "";
                        status = ok ? ("connected · " + ssid) : "connect failed";
                        RefreshListAsync();
                    }));
                } catch { acting = false; busy = false; actingSsid = ""; }
            });
        }

        static string XmlEsc(string s) {
            return (s ?? "").Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;")
                .Replace("\"", "&quot;").Replace("'", "&apos;");
        }

        static string WriteWifiProfile(string ssid, string auth, string password) {
            try {
                string dir = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "FoxTerminal", "foxos");
                Directory.CreateDirectory(dir);
                string path = Path.Combine(dir, "wifi-join.xml");
                string a = string.IsNullOrEmpty(auth) || auth == "open" ? "WPA2PSK" : auth;
                string enc = a == "WPA3SAE" ? "AES" : "AES";
                string xml =
                    "<?xml version=\"1.0\"?>\r\n" +
                    "<WLANProfile xmlns=\"http://www.microsoft.com/networking/WLAN/profile/v1\">\r\n" +
                    "\t<name>" + XmlEsc(ssid) + "</name>\r\n" +
                    "\t<SSIDConfig>\r\n\t\t<SSID>\r\n\t\t\t<name>" + XmlEsc(ssid) + "</name>\r\n\t\t</SSID>\r\n\t</SSIDConfig>\r\n" +
                    "\t<connectionType>ESS</connectionType>\r\n" +
                    "\t<connectionMode>auto</connectionMode>\r\n" +
                    "\t<MSM>\r\n\t\t<security>\r\n\t\t\t<authEncryption>\r\n" +
                    "\t\t\t\t<authentication>" + a + "</authentication>\r\n" +
                    "\t\t\t\t<encryption>" + enc + "</encryption>\r\n" +
                    "\t\t\t\t<useOneX>false</useOneX>\r\n" +
                    "\t\t\t</authEncryption>\r\n" +
                    "\t\t\t<sharedKey>\r\n\t\t\t\t<keyType>passPhrase</keyType>\r\n" +
                    "\t\t\t\t<protected>false</protected>\r\n" +
                    "\t\t\t\t<keyMaterial>" + XmlEsc(password) + "</keyMaterial>\r\n" +
                    "\t\t\t</sharedKey>\r\n\t\t</security>\r\n\t</MSM>\r\n</WLANProfile>\r\n";
                File.WriteAllText(path, xml, new UTF8Encoding(false));
                return path;
            } catch { return null; }
        }

        protected override bool ProcessCmdKey(ref Message msg, Keys keyData) {
            if (keyData == Keys.Escape) {
                if (passMode) { CancelPass(); return true; }
                SoftClose(); return true;
            }
            if (passMode) {
                if (keyData == Keys.Enter) { SubmitPass(); return true; }
                if (keyData == Keys.Back) {
                    if (passBuf.Length > 0) { passBuf = passBuf.Substring(0, passBuf.Length - 1); Invalidate(); }
                    return true;
                }
                return base.ProcessCmdKey(ref msg, keyData);
            }
            if (keyData == Keys.Enter) { ActivateSel(); return true; }
            if (keyData == Keys.F5) { RefreshListAsync(); return true; }
            if (keyData == Keys.Up) { sel = Math.Max(0, sel - 1); ClampScroll(); Invalidate(); return true; }
            if (keyData == Keys.Down) { sel++; ClampScroll(); Invalidate(); return true; }
            if (keyData == Keys.Back) {
                if (filter.Length > 0) { filter = filter.Substring(0, filter.Length - 1); sel = 0; Invalidate(); }
                return true;
            }
            return base.ProcessCmdKey(ref msg, keyData);
        }

        protected override void OnKeyPress(KeyPressEventArgs e) {
            if (passMode) {
                if (!char.IsControl(e.KeyChar) && passBuf.Length < 63) {
                    passBuf += e.KeyChar; Invalidate(); e.Handled = true;
                }
                base.OnKeyPress(e);
                return;
            }
            if (!char.IsControl(e.KeyChar) && filter.Length < 32) {
                filter += e.KeyChar; sel = 0; Invalidate(); e.Handled = true;
            }
            base.OnKeyPress(e);
        }

        void ClampScroll() {
            var idx = Filtered();
            if (sel >= idx.Count) sel = Math.Max(0, idx.Count - 1);
            int vis = VisibleRows;
            if (sel < scroll) scroll = sel;
            if (sel >= scroll + vis) scroll = sel - vis + 1;
            if (scroll < 0) scroll = 0;
        }

        int HitBtn(Point p) {
            if (CloseRect().Contains(p)) return 1;
            if (RefreshRect().Contains(p)) return 2;
            if (DisconnectRect().Contains(p)) return 3;
            if (ActionRect().Contains(p)) return 4;
            return 0;
        }

        protected override void OnMouseDown(MouseEventArgs e) {
            if (acting) return;
            int b = HitBtn(e.Location);
            if (b == 1) { SoftClose(); return; }
            if (b == 2) { RefreshListAsync(); return; }
            if (b == 3) { DoDisconnect(); return; }
            if (ActionRect().Contains(e.Location)) {
                if (passMode) SubmitPass();
                else ActivateSel();
                return;
            }
            if (e.Y >= ListTop && e.Y < ListBottom) {
                int row = scroll + (e.Y - ListTop) / RowH;
                var idx = Filtered();
                if (row >= 0 && row < idx.Count) {
                    sel = row;
                    Invalidate();
                    if (e.Clicks > 1) ActivateSel();
                }
            }
            base.OnMouseDown(e);
        }

        protected override void OnMouseMove(MouseEventArgs e) {
            int h = -1;
            if (e.Y >= ListTop && e.Y < ListBottom) h = scroll + (e.Y - ListTop) / RowH;
            int hb = HitBtn(e.Location);
            if (h != hover || hb != hoverBtn) {
                hover = h; hoverBtn = hb;
                Cursor = hb != 0 ? Cursors.Hand : Cursors.Default;
                Invalidate();
            }
            base.OnMouseMove(e);
        }

        protected override void OnMouseWheel(MouseEventArgs e) {
            if (e.Delta > 0) sel = Math.Max(0, sel - 1);
            else sel++;
            ClampScroll();
            Invalidate();
            base.OnMouseWheel(e);
        }

        static GraphicsPath RoundBox(Rectangle r, int rad) {
            var p = new GraphicsPath();
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

        void FillRound(Graphics g, Rectangle r, int rad, Color c) {
            SmoothingMode old = g.SmoothingMode;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            using (var path = RoundBox(r, rad))
            using (var br = new SolidBrush(c))
                g.FillPath(br, path);
            g.SmoothingMode = old;
        }

        void StrokeRound(Graphics g, Rectangle r, int rad, Color c, float w) {
            SmoothingMode old = g.SmoothingMode;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            using (var path = RoundBox(r, rad))
            using (var pe = new Pen(c, w)) {
                pe.Alignment = PenAlignment.Inset;
                g.DrawPath(pe, path);
            }
            g.SmoothingMode = old;
        }

        Color FlatWash(Color over, int a) {
            // opaque blend onto night — avoids AA light rims from translucent fills
            int ia = 255 - a;
            return Color.FromArgb(
                (night.R * ia + over.R * a) / 255,
                (night.G * ia + over.G * a) / 255,
                (night.B * ia + over.B * a) / 255);
        }

        void DrawShell(Graphics g, Rectangle box) {
            using (var path = RoundBox(box, 16)) {
                using (var fill = new SolidBrush(Color.FromArgb(255, night.R, night.G, night.B)))
                    g.FillPath(fill, path);
                using (var wash = new SolidBrush(FlatWash(accent, 34))) {
                    g.SetClip(path);
                    g.FillRectangle(wash, box.X, box.Y, box.Width, 68);
                    g.ResetClip();
                }
                using (var edge = new Pen(FlatWash(accent, 90), 1f))
                    g.DrawPath(edge, path);
            }
        }

        void DrawPrompt(Graphics g, Rectangle bar, string text, bool live) {
            FillRound(g, bar, 8, Color.FromArgb(255, 7, 9, 16));
            using (var rail = new SolidBrush(live ? accent : FlatWash(accent, 140)))
                g.FillRectangle(rail, bar.X + 1, bar.Y + 5, 3, bar.Height - 10);
            StrokeRound(g, bar, 8, FlatWash(accent, live ? 100 : 45), 1f);
            using (var sf = (StringFormat)StringFormat.GenericTypographic.Clone()) {
                sf.LineAlignment = StringAlignment.Center;
                sf.FormatFlags = StringFormatFlags.NoWrap;
                using (var ink = new SolidBrush(live ? Color.FromArgb(236, 238, 242) : FlatWash(accent, 160)))
                    g.DrawString(text, rowFont, ink, new RectangleF(bar.X + 14, bar.Y, bar.Width - 24, bar.Height), sf);
            }
        }

        void DrawPill(Graphics g, Rectangle r, string label, bool hot, bool solid) {
            Color fill = solid
                ? (hot ? accent : FlatWash(accent, 200))
                : FlatWash(accent, hot ? 55 : 28);
            // flat fill, no AA fringe that reads as a second rectangle
            SmoothingMode old = g.SmoothingMode;
            g.SmoothingMode = SmoothingMode.None;
            FillRound(g, r, 8, fill);
            g.SmoothingMode = old;
            Color ink = solid ? Color.FromArgb(18, 20, 26) : Color.FromArgb(230, 235, 242);
            using (var br = new SolidBrush(ink))
            using (var sf = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center })
                g.DrawString(label, small, br, r, sf);
        }

        void DrawSignal(Graphics g, int x, int y, int pct, bool hot) {
            int bars = pct < 0 ? 0 : (pct >= 75 ? 4 : (pct >= 50 ? 3 : (pct >= 25 ? 2 : 1)));
            for (int i = 0; i < 4; i++) {
                int h = 5 + i * 3;
                var bar = new Rectangle(x + i * 5, y + 14 - h, 3, h);
                bool on = i < bars;
                using (var br = new SolidBrush(on
                    ? Color.FromArgb(hot ? 240 : 180, accent)
                    : Color.FromArgb(40, 255, 255, 255)))
                    g.FillRectangle(br, bar);
            }
        }

        void DrawLock(Graphics g, int x, int y, bool open) {
            using (var pe = new Pen(Color.FromArgb(open ? 90 : 170, accent), 1.4f)) {
                g.DrawRectangle(pe, x, y + 6, 9, 7);
                if (!open) g.DrawArc(pe, x + 1, y + 1, 7, 8, 200, 140);
                else g.DrawArc(pe, x + 1, y + 1, 7, 8, 200, 100);
            }
        }

        protected override void OnPaint(PaintEventArgs e) {
            var g = e.Graphics;
            g.Clear(Choke);
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.ClearTypeGridFit;

            var isl = Island();
            DrawShell(g, isl);

            using (var kick = new SolidBrush(Color.FromArgb(230, accent)))
            using (var title = new SolidBrush(Color.FromArgb(236, 238, 242)))
            using (var mute = new SolidBrush(Color.FromArgb(130, 142, 156))) {
                g.DrawString("FOXOS", small, kick, isl.X + Pad + 6, isl.Y + 18);
                g.DrawString("wi-fi", titleFont, title, isl.X + Pad + 6, isl.Y + 36);
                SizeF ts = g.MeasureString("wi-fi", titleFont);
                Color stc = (acting || busy)
                    ? FlatWash(accent, 140 + (int)(80 * selGlow))
                    : Color.FromArgb(130, 142, 156);
                using (var stBr = new SolidBrush(stc))
                    g.DrawString(status, small, stBr, isl.X + Pad + 10 + ts.Width, isl.Y + 44);
            }

            DrawPill(g, CloseRect(), "x", hoverBtn == 1, false);
            bool liveFilter = passMode || filter.Length > 0 || caretOn;
            string q;
            if (passMode) {
                q = "> " + new string('•', Math.Min(passBuf.Length, 24));
                if (caretOn) q += "_";
            } else {
                q = filter.Length > 0 ? ("> " + filter) : "> filter";
                if (caretOn) q += "_";
            }
            DrawPrompt(g, FilterRect(), q, liveFilter);
            DrawPill(g, RefreshRect(), busy ? "…" : "refresh", hoverBtn == 2, false);
            DrawPill(g, DisconnectRect(), "disconnect", hoverBtn == 3, false);

            var idx = Filtered();
            ClampScroll();
            int vis = VisibleRows;
            int y = ListTop;
            int listW = isl.Width - Pad * 2 - 10;

            using (var sf = (StringFormat)StringFormat.GenericTypographic.Clone()) {
                sf.LineAlignment = StringAlignment.Center;
                sf.Trimming = StringTrimming.EllipsisCharacter;
                sf.FormatFlags = StringFormatFlags.NoWrap;

                for (int row = scroll; row < idx.Count && row < scroll + vis; row++) {
                    NetProp n = nets[idx[row]];
                    var box = new Rectangle(isl.X + Pad + 4, y, listW, RowH - 6);
                    bool on = row == sel;
                    bool over = row == hover && !on;
                    bool linking = acting && actingSsid.Length > 0
                        && string.Equals(n.Ssid, actingSsid, StringComparison.OrdinalIgnoreCase);
                    int washA = on ? 48 : (over ? 22 : 0);
                    if (linking) washA = 36 + (int)(40 * selGlow);
                    if (washA > 0) FillRound(g, box, 10, FlatWash(accent, washA));
                    if (on || linking) {
                        using (var mark = new SolidBrush(accent))
                            g.FillRectangle(mark, box.X + 2, box.Y + 8, 3, box.Height - 16);
                    }

                    int textLeft = box.X + 14;
                    if (n.Connected) {
                        var badge = new Rectangle(box.X + 12, box.Y + 10, 34, 18);
                        FillRound(g, badge, 6, FlatWash(accent, 210));
                        using (var ink = new SolidBrush(Color.FromArgb(16, 18, 24)))
                        using (var bsf = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center })
                            g.DrawString("ON", micro, ink, badge, bsf);
                        textLeft = badge.Right + 10;
                    }

                    using (var nameInk = new SolidBrush(on ? Color.FromArgb(236, 238, 242) : Color.FromArgb(175, 186, 200)))
                        g.DrawString(n.Ssid, rowFont, nameInk, new RectangleF(textLeft, box.Y, box.Width - 100 - (textLeft - box.X), box.Height), sf);

                    int rx = box.Right - 58;
                    DrawSignal(g, rx, box.Y + 12, n.Signal, on || n.Connected);
                    DrawLock(g, box.Right - 22, box.Y + 12, !n.Secured);

                    if (n.Signal < 0) {
                        using (var dim = new SolidBrush(Color.FromArgb(110, 128, 148)))
                            g.DrawString("saved", micro, dim, new RectangleF(rx - 42, box.Y, 40, box.Height), sf);
                    }
                    y += RowH;
                }

                if (idx.Count == 0) {
                    using (var dim = new SolidBrush(Color.FromArgb(124, 140, 156)))
                        g.DrawString(busy ? "scanning…" : "no matches", rowFont, dim, isl.X + Pad + 12, ListTop + 20);
                }
            }

            if (idx.Count > vis) {
                int trackX = isl.Right - Pad - 2;
                int trackH = ListBottom - ListTop;
                using (var bg = new SolidBrush(FlatWash(Color.White, 18)))
                    g.FillRectangle(bg, trackX, ListTop, 3, trackH);
                int thumbH = Math.Max(18, trackH * vis / Math.Max(1, idx.Count));
                int thumbY = ListTop + (trackH - thumbH) * scroll / Math.Max(1, idx.Count - vis);
                using (var th = new SolidBrush(FlatWash(accent, 200)))
                    g.FillRectangle(th, trackX, thumbY, 3, thumbH);
            }

            var detail = DetailRect();
            FillRound(g, detail, 12, Color.FromArgb(255, 6, 8, 14));

            using (var ink = new SolidBrush(Color.FromArgb(236, 238, 242)))
            using (var mute = new SolidBrush(Color.FromArgb(124, 140, 156)))
            using (var acc = new SolidBrush(Color.FromArgb(220, accent)))
            using (var sf = (StringFormat)StringFormat.GenericTypographic.Clone()) {
                sf.LineAlignment = StringAlignment.Center;
                sf.FormatFlags = StringFormatFlags.NoWrap;
                sf.Trimming = StringTrimming.EllipsisCharacter;
                if (sel >= 0 && sel < idx.Count) {
                    NetProp n = nets[idx[sel]];
                    Rectangle act = ActionRect();
                    // one header row: SSID + action, same vertical center
                    var nameBox = new RectangleF(detail.X + 16, detail.Y + 8, act.X - detail.X - 28, 36);
                    g.DrawString(n.Ssid, rowFont, ink, nameBox, sf);
                    string actLabel = acting && string.Equals(actingSsid, n.Ssid, StringComparison.OrdinalIgnoreCase)
                        ? "…"
                        : (passMode && string.Equals(passSsid, n.Ssid, StringComparison.OrdinalIgnoreCase)
                            ? "join"
                            : (n.Connected ? "disconnect" : (n.HasProfile || !n.Secured ? "connect" : "password")));
                    DrawPill(g, act, actLabel, hoverBtn == 4 || acting, true);
                    string tip = passMode
                        ? ("enter join · esc cancel")
                        : (n.Connected ? "connected"
                        : (n.Signal < 0 ? "saved profile · out of range"
                        : ((n.Secured ? "secured" : "open") + " · " + n.Signal + "%")));
                    g.DrawString(tip, small, acc, detail.X + 16, detail.Y + 48);
                    g.DrawString(passMode ? "type password above" : "enter · f5 · esc", small, mute, detail.X + 16, detail.Y + 68);
                } else {
                    g.DrawString("pick a network", rowFont, mute, detail.X + 16, detail.Y + 28);
                }
            }
        }

        protected override void Dispose(bool disposing) {
            if (disposing) {
                blink.Stop(); blink.Dispose();
                anim.Stop(); anim.Dispose();
                titleFont.Dispose(); rowFont.Dispose(); small.Dispose(); micro.Dispose();
            }
            base.Dispose(disposing);
        }
    }
    // Desktop widgets strip (clock / weather line / note hint)
    sealed class DeskWidgets : Form {
        readonly State state;
        readonly Font big;
        readonly Font small;
        readonly System.Windows.Forms.Timer timer;
        string weather = "";
        string note = "";
        DateTime lastFetch;
        readonly string foxosDir;
        Screen screen;

        public DeskWidgets(State state, string foxosDir, Screen screen) {
            this.state = state;
            this.foxosDir = foxosDir ?? "";
            this.screen = screen ?? Screen.PrimaryScreen;
            FormBorderStyle = FormBorderStyle.None;
            ShowInTaskbar = false;
            TopMost = false;
            StartPosition = FormStartPosition.Manual;
            BackColor = Color.FromArgb(255, 1, 2, 3);
            TransparencyKey = BackColor;
            DoubleBuffered = true;
            big = new Font("Consolas", 42f, FontStyle.Bold, GraphicsUnit.Pixel);
            small = new Font("Consolas", 13f, FontStyle.Regular, GraphicsUnit.Pixel);
            Size = new Size(320, 140);
            Place();
            timer = new System.Windows.Forms.Timer();
            timer.Interval = 1000;
            timer.Tick += delegate {
                if ((DateTime.UtcNow - lastFetch).TotalSeconds > 30) LoadSide();
                Invalidate();
            };
            timer.Start();
            LoadSide();
        }

        public void Recolor() { Place(); Invalidate(); }

        void Place() {
            Rectangle sb = screen.WorkingArea;
            Location = new Point(sb.Right - Width - 24, sb.Top + 24);
            try {
                Native.SetWindowPos(Handle, Native.HWND_BOTTOM, Left, Top, Width, Height, 0x0010);
            } catch { }
        }

        void LoadSide() {
            lastFetch = DateTime.UtcNow;
            try {
                string w = System.IO.Path.Combine(foxosDir, "widget-weather.txt");
                if (File.Exists(w)) weather = File.ReadAllText(w).Trim();
                string n = System.IO.Path.Combine(foxosDir, "widget-note.txt");
                if (File.Exists(n)) note = File.ReadAllText(n).Trim();
            } catch { }
            if (weather.Length > 40) weather = weather.Substring(0, 40);
            if (note.Length > 40) note = note.Substring(0, 40);
        }

        protected override void OnPaint(PaintEventArgs e) {
            var g = e.Graphics;
            g.Clear(TransparencyKey);
            g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.ClearTypeGridFit;
            string clock = DateTime.Now.ToString("HH:mm");
            string day = DateTime.Now.ToString("ddd  d MMM", System.Globalization.CultureInfo.GetCultureInfo("uk-UA"));
            using (var ink = new SolidBrush(Color.FromArgb(230, 235, 242)))
            using (var mute = new SolidBrush(Color.FromArgb(150, 160, 172)))
            using (var accent = new SolidBrush(state.Accent)) {
                g.DrawString(clock, big, ink, 4, 4);
                g.DrawString(day, small, mute, 8, 58);
                if (weather.Length > 0) g.DrawString(weather, small, accent, 8, 82);
                if (note.Length > 0) g.DrawString(note, small, mute, 8, 104);
            }
        }

        protected override void Dispose(bool disposing) {
            if (disposing) {
                timer.Stop(); timer.Dispose();
                big.Dispose(); small.Dispose();
            }
            base.Dispose(disposing);
        }
    }

    // Home — floating glass island (dock language), not a dialog box
    sealed class HomeLaunch : Form {
        static readonly Color Choke = Color.FromArgb(255, 1, 2, 3);
        const int Edge = 10;
        const int MinW = 520;
        const int MinH = 420;
        const int DefW = 720;
        const int DefH = 560;
        const int RowH = 32;
        const int DetailH = 100;
        const int Pad = 28;

        readonly Action<string> runDesk;
        readonly Action<string> fillPrompt;
        readonly Font titleFont;
        readonly Font tabFont;
        readonly Font rowFont;
        readonly Font smallFont;
        readonly System.Windows.Forms.Timer blink;
        Color night, accent;
        string themeName = "";
        string filter = "";
        bool wallTab = true;
        int sel;
        int scroll;
        int hover = -1;
        int wheelAcc;
        bool caretOn = true;
        bool dragging;
        bool resizing;
        int resizeMask;
        Point dragDelta;
        Rectangle resizeStart;
        Point resizeOrigin;
        readonly List<Line> lines = new List<Line>();

        struct Line {
            public bool Head;
            public string Text;
            public HelpItem Item;
        }

        public HomeLaunch(Color nightColor, Color accentColor, Color accent2Color, string foxPath, string theme, Action<string> runDesk)
            : this(nightColor, accentColor, accent2Color, foxPath, theme, runDesk, null) { }

        public HomeLaunch(Color nightColor, Color accentColor, Color accent2Color, string foxPath, string theme, Action<string> runDesk, Action<string> fillPrompt) {
            night = nightColor;
            accent = accentColor;
            themeName = string.IsNullOrEmpty(theme) ? "foxos" : theme;
            this.runDesk = runDesk;
            this.fillPrompt = fillPrompt;
            Text = "FoxOS Home";
            FormBorderStyle = FormBorderStyle.None;
            ShowInTaskbar = false;
            TopMost = true;
            StartPosition = FormStartPosition.Manual;
            DoubleBuffered = true;
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint | ControlStyles.OptimizedDoubleBuffer, true);
            BackColor = Choke;
            TransparencyKey = Choke;
            Opacity = 0.88;
            KeyPreview = true;
            MinimumSize = new Size(MinW, MinH);
            Size = new Size(DefW, DefH);
            titleFont = new Font("Consolas", 22f, FontStyle.Bold, GraphicsUnit.Pixel);
            tabFont = new Font("Consolas", 15f, FontStyle.Bold, GraphicsUnit.Pixel);
            rowFont = new Font("Consolas", 15f, FontStyle.Regular, GraphicsUnit.Pixel);
            smallFont = new Font("Consolas", 12f, FontStyle.Regular, GraphicsUnit.Pixel);
            blink = new System.Windows.Forms.Timer();
            blink.Interval = 480;
            blink.Tick += delegate { caretOn = !caretOn; Invalidate(FilterRect()); };
            blink.Start();
            RestoreBounds();
            Rebuild();
        }

        string PosPath() {
            return Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "FoxTerminal", "foxos", "home-pos.txt");
        }

        int MaxW() {
            try { return Math.Max(MinW, Screen.FromControl(this).WorkingArea.Width - 48); }
            catch { return Screen.PrimaryScreen.WorkingArea.Width - 48; }
        }

        int MaxH() {
            try { return Math.Max(MinH, Screen.FromControl(this).WorkingArea.Height - 48); }
            catch { return Screen.PrimaryScreen.WorkingArea.Height - 48; }
        }

        void RestoreBounds() {
            Rectangle sb = Screen.PrimaryScreen.WorkingArea;
            int w = DefW, h = DefH;
            int x = sb.X + (sb.Width - w) / 2;
            int y = sb.Y + (sb.Height - h) / 2 - 20;
            try {
                string p = PosPath();
                if (File.Exists(p)) {
                    string[] parts = File.ReadAllText(p).Trim().Split(',');
                    int px, py, pw, ph;
                    if (parts.Length >= 2 && int.TryParse(parts[0], out px) && int.TryParse(parts[1], out py)) {
                        x = px; y = py;
                    }
                    if (parts.Length >= 4 && int.TryParse(parts[2], out pw) && int.TryParse(parts[3], out ph)) {
                        w = pw; h = ph;
                    }
                }
            } catch { }
            w = Math.Max(MinW, Math.Min(sb.Width - 48, w));
            h = Math.Max(MinH, Math.Min(sb.Height - 48, h));
            Rectangle vs = SystemInformation.VirtualScreen;
            if (x < vs.X) x = vs.X + 24;
            if (y < vs.Y) y = vs.Y + 24;
            if (x + w > vs.Right) x = vs.Right - w - 24;
            if (y + h > vs.Bottom) y = vs.Bottom - h - 24;
            Bounds = new Rectangle(x, y, w, h);
        }

        void SavePos() {
            try {
                Directory.CreateDirectory(Path.GetDirectoryName(PosPath()));
                File.WriteAllText(PosPath(), Left + "," + Top + "," + Width + "," + Height);
            } catch { }
        }

        public void Recolor(Color n, Color a) {
            night = n;
            accent = a;
            Invalidate();
        }

        Rectangle Island() {
            return new Rectangle(12, 12, Width - 24, Height - 24);
        }

        int ListTop { get { return Island().Y + 162; } }
        int ListBottom { get { return Island().Bottom - DetailH - 12; } }
        int VisibleRows { get { return Math.Max(1, (ListBottom - ListTop) / RowH); } }

        int CmdCount {
            get {
                int n = 0;
                for (int i = 0; i < lines.Count; i++) if (!lines[i].Head) n++;
                return n;
            }
        }

        Rectangle CloseRect() {
            var isl = Island();
            return new Rectangle(isl.Right - 40, isl.Y + 16, 28, 28);
        }

        Rectangle FilterRect() {
            var isl = Island();
            return new Rectangle(isl.X + Pad, isl.Y + 72, isl.Width - Pad * 2, 36);
        }

        Rectangle TabRect(bool wall) {
            var isl = Island();
            int x = isl.X + Pad + (wall ? 0 : 168);
            return new Rectangle(x, isl.Y + 118, 156, 30);
        }

        Rectangle DetailRect() {
            var isl = Island();
            return new Rectangle(isl.X + Pad, isl.Bottom - DetailH, isl.Width - Pad * 2, DetailH - 14);
        }

        Rectangle GripRect() {
            var isl = Island();
            return new Rectangle(isl.Right - 22, isl.Bottom - 22, 18, 18);
        }

        void Rebuild() {
            lines.Clear();
            string q = (filter ?? "").Trim().ToLowerInvariant();
            string last = "";
            if (wallTab) {
                var extra = new HelpItem("files", "files", "open user profile folder", "launch", true, false);
                AppendItem(extra, q, ref last);
            }
            HelpItem[] cat = HelpBoard.Catalog;
            for (int i = 0; i < cat.Length; i++) {
                HelpItem it = cat[i];
                if (it.Wall != wallTab) continue;
                if (wallTab && it.Name == "home") continue;
                AppendItem(it, q, ref last);
            }
            if (sel >= lines.Count) sel = lines.Count - 1;
            if (sel < 0) sel = 0;
            EnsureItem();
            ClampScroll();
        }

        void AppendItem(HelpItem it, string q, ref string last) {
            if (q.Length > 0) {
                string hay = (it.Name + " " + it.Usage + " " + it.Desc + " " + it.Group).ToLowerInvariant();
                if (hay.IndexOf(q) < 0) return;
            }
            if (it.Group != last) {
                lines.Add(new Line { Head = true, Text = it.Group, Item = null });
                last = it.Group;
            }
            lines.Add(new Line { Head = false, Text = it.Usage, Item = it });
        }

        void EnsureItem() {
            if (lines.Count == 0) return;
            if (sel < 0) sel = 0;
            if (sel >= lines.Count) sel = lines.Count - 1;
            if (!lines[sel].Head) return;
            for (int i = sel + 1; i < lines.Count; i++) {
                if (!lines[i].Head) { sel = i; return; }
            }
            for (int i = sel - 1; i >= 0; i--) {
                if (!lines[i].Head) { sel = i; return; }
            }
        }

        void MoveSel(int dir) {
            if (lines.Count == 0) return;
            int i = sel + dir;
            while (i >= 0 && i < lines.Count) {
                if (!lines[i].Head) { sel = i; ClampScroll(); Invalidate(); return; }
                i += dir;
            }
        }

        void ClampScroll() {
            int vis = VisibleRows;
            if (sel < scroll) scroll = sel;
            if (sel >= scroll + vis) scroll = sel - vis + 1;
            if (scroll < 0) scroll = 0;
            int max = Math.Max(0, lines.Count - vis);
            if (scroll > max) scroll = max;
        }

        HelpItem Current() {
            if (sel < 0 || sel >= lines.Count) return null;
            return lines[sel].Item;
        }

        void ActivateSel() {
            HelpItem item = Current();
            if (item == null) return;
            if (item.Wall) {
                if (item.Name == "home") return;
                if (item.Name == "foxhelp") {
                    SavePos();
                    Hide();
                    if (runDesk != null) runDesk("foxhelp");
                    return;
                }
                if (item.Name == "files") {
                    string home = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
                    SavePos();
                    Hide();
                    try { Process.Start("explorer.exe", "/e," + home); } catch { }
                    return;
                }
                if (item.NeedsArg) {
                    SavePos();
                    Hide();
                    if (fillPrompt != null) fillPrompt(item.Name + " ");
                    else if (runDesk != null) runDesk(item.Name);
                    return;
                }
                SavePos();
                Hide();
                if (runDesk != null) runDesk(item.Name);
                return;
            }
            // terminal tab → run in ghostty after login
            SavePos();
            Hide();
            if (runDesk != null) runDesk("term " + item.Name);
        }

        void SwitchTab(bool wall) {
            if (wall == wallTab) return;
            wallTab = wall;
            sel = 0;
            scroll = 0;
            hover = -1;
            Rebuild();
            Invalidate();
        }

        int HitResize(Point p) {
            var isl = Island();
            var hit = Rectangle.Inflate(isl, 4, 4);
            if (!hit.Contains(p)) return 0;
            int m = 0;
            if (p.X <= isl.X + Edge) m |= 1;
            if (p.X >= isl.Right - Edge) m |= 2;
            if (p.Y <= isl.Y + Edge) m |= 4;
            if (p.Y >= isl.Bottom - Edge) m |= 8;
            if (GripRect().Contains(p)) m |= 2 | 8;
            return m;
        }

        static Cursor CursorForMask(int m) {
            bool l = (m & 1) != 0, r = (m & 2) != 0, t = (m & 4) != 0, b = (m & 8) != 0;
            if ((l && t) || (r && b)) return Cursors.SizeNWSE;
            if ((r && t) || (l && b)) return Cursors.SizeNESW;
            if (l || r) return Cursors.SizeWE;
            if (t || b) return Cursors.SizeNS;
            return Cursors.Default;
        }

        int HitRow(int y) {
            if (y < ListTop || y >= ListBottom) return -1;
            int row = scroll + (y - ListTop) / RowH;
            if (row < 0 || row >= lines.Count) return -1;
            if (lines[row].Head) return -1;
            return row;
        }

        protected override bool ProcessCmdKey(ref Message msg, Keys keyData) {
            if (keyData == Keys.Escape) { SavePos(); Hide(); return true; }
            if (keyData == Keys.Enter) { ActivateSel(); return true; }
            if (keyData == Keys.Tab || keyData == (Keys.Tab | Keys.Shift)) {
                SwitchTab(!wallTab);
                return true;
            }
            if (keyData == Keys.Up) { MoveSel(-1); return true; }
            if (keyData == Keys.Down) { MoveSel(1); return true; }
            if (keyData == Keys.PageUp) { for (int i = 0; i < VisibleRows; i++) MoveSel(-1); return true; }
            if (keyData == Keys.PageDown) { for (int i = 0; i < VisibleRows; i++) MoveSel(1); return true; }
            if (keyData == Keys.Home) { sel = 0; EnsureItem(); ClampScroll(); Invalidate(); return true; }
            if (keyData == Keys.End) { sel = lines.Count - 1; EnsureItem(); ClampScroll(); Invalidate(); return true; }
            if (keyData == Keys.Back) {
                if (filter.Length > 0) {
                    filter = filter.Substring(0, filter.Length - 1);
                    sel = 0; scroll = 0; Rebuild(); Invalidate();
                }
                return true;
            }
            return base.ProcessCmdKey(ref msg, keyData);
        }

        protected override void OnKeyPress(KeyPressEventArgs e) {
            if (!char.IsControl(e.KeyChar) && filter.Length < 40) {
                filter += e.KeyChar;
                sel = 0; scroll = 0; Rebuild(); Invalidate();
                e.Handled = true;
            }
            base.OnKeyPress(e);
        }

        protected override void OnMouseWheel(MouseEventArgs e) {
            wheelAcc += e.Delta;
            while (wheelAcc >= 120) { MoveSel(-1); wheelAcc -= 120; }
            while (wheelAcc <= -120) { MoveSel(1); wheelAcc += 120; }
            base.OnMouseWheel(e);
        }

        protected override void OnMouseDown(MouseEventArgs e) {
            int rz = HitResize(e.Location);
            if (rz != 0 && e.Button == MouseButtons.Left) {
                resizing = true;
                resizeMask = rz;
                resizeStart = Bounds;
                resizeOrigin = Cursor.Position;
                Capture = true;
                return;
            }
            if (CloseRect().Contains(e.Location)) { SavePos(); Hide(); return; }
            Rectangle wallR = TabRect(true);
            Rectangle termR = TabRect(false);
            if (wallR.Contains(e.Location) || termR.Contains(e.Location)) {
                SwitchTab(wallR.Contains(e.Location));
                return;
            }
            var isl = Island();
            if (e.Y < isl.Y + 68 && !FilterRect().Contains(e.Location) && !CloseRect().Contains(e.Location)) {
                dragging = true;
                dragDelta = e.Location;
                Capture = true;
                return;
            }
            int idx = HitRow(e.Y);
            if (idx >= 0) {
                sel = idx;
                EnsureItem();
                Invalidate();
                if (e.Clicks > 1) ActivateSel();
            }
            base.OnMouseDown(e);
        }

        protected override void OnMouseMove(MouseEventArgs e) {
            if (resizing) {
                int dx = Cursor.Position.X - resizeOrigin.X;
                int dy = Cursor.Position.Y - resizeOrigin.Y;
                int x = resizeStart.X, y = resizeStart.Y, w = resizeStart.Width, h = resizeStart.Height;
                if ((resizeMask & 1) != 0) { x = resizeStart.X + dx; w = resizeStart.Width - dx; }
                if ((resizeMask & 2) != 0) w = resizeStart.Width + dx;
                if ((resizeMask & 4) != 0) { y = resizeStart.Y + dy; h = resizeStart.Height - dy; }
                if ((resizeMask & 8) != 0) h = resizeStart.Height + dy;
                if (w < MinW) { if ((resizeMask & 1) != 0) x = resizeStart.Right - MinW; w = MinW; }
                if (h < MinH) { if ((resizeMask & 4) != 0) y = resizeStart.Bottom - MinH; h = MinH; }
                if (w > MaxW()) { if ((resizeMask & 1) != 0) x = resizeStart.Right - MaxW(); w = MaxW(); }
                if (h > MaxH()) { if ((resizeMask & 4) != 0) y = resizeStart.Bottom - MaxH(); h = MaxH(); }
                Bounds = new Rectangle(x, y, w, h);
                ClampScroll();
                Invalidate();
                return;
            }
            if (dragging) {
                Left += e.X - dragDelta.X;
                Top += e.Y - dragDelta.Y;
                return;
            }
            int rz2 = HitResize(e.Location);
            if (rz2 != 0) { Cursor = CursorForMask(rz2); return; }
            Cursor = (e.Y < Island().Y + 68) ? Cursors.SizeAll : Cursors.Default;
            int idx = HitRow(e.Y);
            if (idx != hover) { hover = idx; Invalidate(); }
            base.OnMouseMove(e);
        }

        protected override void OnMouseUp(MouseEventArgs e) {
            if (dragging || resizing) SavePos();
            dragging = false;
            resizing = false;
            resizeMask = 0;
            Capture = false;
            base.OnMouseUp(e);
        }

        protected override void OnMouseLeave(EventArgs e) {
            hover = -1;
            if (!resizing && !dragging) Cursor = Cursors.Default;
            Invalidate();
            base.OnMouseLeave(e);
        }

        protected override void OnResize(EventArgs e) {
            base.OnResize(e);
            ClampScroll();
            Invalidate();
        }

        protected override void OnVisibleChanged(EventArgs e) {
            base.OnVisibleChanged(e);
            if (Visible) {
                filter = "";
                sel = 0;
                scroll = 0;
                Rebuild();
            }
        }

        void DrawCard(Graphics g, Rectangle box) {
            using (var path = RoundBox(box, 14)) {
                using (var fill = new SolidBrush(Color.FromArgb(245, night.R, night.G, night.B))) {
                    g.FillPath(fill, path);
                }
                using (var wash = new SolidBrush(Color.FromArgb(28, accent))) {
                    g.SetClip(path);
                    g.FillRectangle(wash, box.X, box.Y, box.Width, 64);
                    g.ResetClip();
                }
                using (var rail = new SolidBrush(Color.FromArgb(230, accent))) {
                    g.FillRectangle(rail, box.X + 1, box.Y + 12, 2, box.Height - 24);
                }
                using (var edge = new Pen(Color.FromArgb(140, accent), 1.2f)) {
                    g.DrawPath(edge, path);
                }
            }
            var grip = GripRect();
            using (var pen = new Pen(Color.FromArgb(100, accent), 1.4f)) {
                for (int i = 0; i < 3; i++) {
                    int o = 4 + i * 4;
                    g.DrawLine(pen, grip.Right - 2, grip.Bottom - o, grip.Right - o, grip.Bottom - 2);
                }
            }
        }

        static GraphicsPath RoundBox(Rectangle r, int rad) {
            var p = new GraphicsPath();
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

        void DrawPromptBar(Graphics g, Rectangle bar, string text, bool live) {
            using (var fill = new SolidBrush(Color.FromArgb(live ? 230 : 190, 7, 9, 16))) {
                g.FillRectangle(fill, bar);
            }
            using (var rail = new SolidBrush(Color.FromArgb(live ? 255 : 170, accent))) {
                g.FillRectangle(rail, bar.X, bar.Y, 3, bar.Height);
            }
            using (var outer = new Pen(Color.FromArgb(live ? 40 : 22, 255, 255, 255), 1f)) {
                g.DrawRectangle(outer, bar.X, bar.Y, bar.Width - 1, bar.Height - 1);
            }
            using (var inner = new Pen(Color.FromArgb(live ? 210 : 95, accent), 1f)) {
                g.DrawRectangle(inner, bar.X + 1, bar.Y + 1, bar.Width - 3, bar.Height - 3);
            }
            using (var sf = (StringFormat)StringFormat.GenericTypographic.Clone()) {
                sf.Alignment = StringAlignment.Near;
                sf.LineAlignment = StringAlignment.Center;
                sf.FormatFlags = StringFormatFlags.NoWrap;
                using (var ink = new SolidBrush(live ? Color.FromArgb(236, 238, 242) : Color.FromArgb(160, accent))) {
                    g.DrawString(text, rowFont, ink, new RectangleF(bar.X + 14, bar.Y, bar.Width - 28, bar.Height), sf);
                }
            }
        }

        protected override void OnPaint(PaintEventArgs e) {
            var g = e.Graphics;
            g.Clear(Choke);
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.ClearTypeGridFit;

            var isl = Island();
            DrawCard(g, isl);

            using (var sf = (StringFormat)StringFormat.GenericTypographic.Clone()) {
                sf.Alignment = StringAlignment.Near;
                sf.LineAlignment = StringAlignment.Center;
                sf.FormatFlags = StringFormatFlags.NoWrap;
                sf.Trimming = StringTrimming.EllipsisCharacter;

                using (var kick = new SolidBrush(Color.FromArgb(230, accent)))
                using (var title = new SolidBrush(Color.FromArgb(236, 238, 242))) {
                    g.DrawString("FOXOS", smallFont, kick, new RectangleF(isl.X + Pad + 8, isl.Y + 14, 180, 16), sf);
                    g.DrawString("home", titleFont, title, new RectangleF(isl.X + Pad + 8, isl.Y + 32, 320, 28), sf);
                    string meta = (wallTab ? "WALL  " : "TERM  ") + CmdCount + "  " + themeName;
                    SizeF ms = g.MeasureString(meta, smallFont, PointF.Empty, sf);
                    g.DrawString(meta, smallFont, kick, new RectangleF(isl.Right - 52 - ms.Width, isl.Y + 20, ms.Width + 2, 16), sf);
                }

                Rectangle xr = CloseRect();
                using (var xFill = new SolidBrush(Color.FromArgb(36, accent))) {
                    g.FillRectangle(xFill, xr);
                }
                using (var xEdge = new Pen(Color.FromArgb(80, accent), 1f)) {
                    g.DrawRectangle(xEdge, xr.X, xr.Y, xr.Width - 1, xr.Height - 1);
                }
                using (var xInk = new SolidBrush(Color.FromArgb(220, accent)))
                using (var xsf = (StringFormat)sf.Clone()) {
                    xsf.Alignment = StringAlignment.Center;
                    g.DrawString("x", tabFont, xInk, xr, xsf);
                }

                Rectangle fr = FilterRect();
                bool typed = filter.Length > 0;
                string q = typed ? ("> " + filter) : "> filter";
                if (caretOn) q += "_";
                DrawPromptBar(g, fr, q, typed || caretOn);

                DrawTab(g, sf, TabRect(true), "WALLPAPER", wallTab);
                DrawTab(g, sf, TabRect(false), "TERMINAL", !wallTab);

                int vis = VisibleRows;
                int y = ListTop;
                int listW = isl.Width - Pad * 2 - 10;
                for (int i = scroll; i < lines.Count && i < scroll + vis; i++) {
                    Rectangle row = new Rectangle(isl.X + Pad + 6, y, listW, RowH);
                    Line line = lines[i];
                    if (line.Head) {
                        using (var hInk = new SolidBrush(Color.FromArgb(200, accent))) {
                            g.DrawString(line.Text.ToUpperInvariant(), smallFont, hInk, new RectangleF(row.X, row.Y, 140, row.Height), sf);
                        }
                        int ruleY = row.Y + row.Height / 2;
                        using (var rule = new Pen(Color.FromArgb(28, 255, 255, 255), 1f)) {
                            g.DrawLine(rule, row.X + 150, ruleY, row.Right, ruleY);
                        }
                    } else {
                        bool on = i == sel;
                        bool over = i == hover && !on;
                        if (on) {
                            using (var wash = new SolidBrush(Color.FromArgb(48, accent))) {
                                g.FillRectangle(wash, row);
                            }
                            using (var mark = new SolidBrush(accent)) {
                                g.FillRectangle(mark, row.X, row.Y + 4, 3, row.Height - 8);
                            }
                        } else if (over) {
                            using (var wash = new SolidBrush(Color.FromArgb(22, accent))) {
                                g.FillRectangle(wash, row);
                            }
                        }
                        using (var nameInk = new SolidBrush(on ? Color.FromArgb(236, 238, 242) : Color.FromArgb(188, 196, 210))) {
                            g.DrawString((on ? "> " : "  ") + line.Item.Usage, rowFont, nameInk, new RectangleF(row.X + 12, row.Y, 280, row.Height), sf);
                        }
                        using (var descInk = new SolidBrush(on ? Color.FromArgb(220, accent) : Color.FromArgb(110, 128, 148))) {
                            g.DrawString(line.Item.Desc, smallFont, descInk, new RectangleF(row.X + 300, row.Y, row.Width - 312, row.Height), sf);
                        }
                    }
                    y += RowH;
                }

                if (lines.Count == 0) {
                    using (var dim = new SolidBrush(Color.FromArgb(124, 140, 156))) {
                        g.DrawString("no matches", rowFont, dim, new RectangleF(isl.X + Pad + 12, ListTop + 16, 400, 28), sf);
                    }
                }

                if (lines.Count > vis) {
                    int trackX = isl.Right - Pad - 2;
                    int trackH = ListBottom - ListTop;
                    using (var bg = new SolidBrush(Color.FromArgb(26, 255, 255, 255))) {
                        g.FillRectangle(bg, trackX, ListTop, 3, trackH);
                    }
                    int thumbH = Math.Max(18, trackH * vis / Math.Max(1, lines.Count));
                    int thumbY = ListTop + (trackH - thumbH) * scroll / Math.Max(1, lines.Count - vis);
                    using (var th = new SolidBrush(Color.FromArgb(200, accent))) {
                        g.FillRectangle(th, trackX, thumbY, 3, thumbH);
                    }
                }

                Rectangle detail = DetailRect();
                using (var fill = new SolidBrush(Color.FromArgb(220, 6, 8, 14))) {
                    g.FillRectangle(fill, detail);
                }
                using (var wash = new SolidBrush(Color.FromArgb(26, accent))) {
                    g.FillRectangle(wash, detail.X, detail.Y, detail.Width, 34);
                }
                using (var rail = new SolidBrush(Color.FromArgb(230, accent))) {
                    g.FillRectangle(rail, detail.X, detail.Y, 2, detail.Height);
                }
                using (var edge = new Pen(Color.FromArgb(28, 255, 255, 255), 1f)) {
                    g.DrawRectangle(edge, detail.X, detail.Y, detail.Width - 1, detail.Height - 1);
                }
                HelpItem cur = Current();
                using (var val = new SolidBrush(Color.FromArgb(236, 238, 242)))
                using (var dim = new SolidBrush(Color.FromArgb(124, 140, 156)))
                using (var acc = new SolidBrush(Color.FromArgb(220, accent))) {
                    if (cur != null) {
                        string where = cur.Wall ? "WALLPAPER" : "TERMINAL";
                        string act = cur.Wall
                            ? (cur.NeedsArg ? "enter  type the rest on the desk" : "enter  run on wallpaper")
                            : "enter  run in ghostty after login";
                        g.DrawString(cur.Usage, tabFont, val, new RectangleF(detail.X + 14, detail.Y + 6, detail.Width - 160, 22), sf);
                        SizeF chip = g.MeasureString(where, smallFont, PointF.Empty, sf);
                        Rectangle chipR = new Rectangle(detail.Right - 14 - (int)chip.Width - 16, detail.Y + 8, (int)chip.Width + 16, 20);
                        using (var chipFill = new SolidBrush(Color.FromArgb(40, accent))) {
                            g.FillRectangle(chipFill, chipR);
                        }
                        using (var chipSf = (StringFormat)sf.Clone()) {
                            chipSf.Alignment = StringAlignment.Center;
                            g.DrawString(where, smallFont, acc, chipR, chipSf);
                        }
                        g.DrawString(cur.Desc, smallFont, acc, new RectangleF(detail.X + 14, detail.Y + 38, detail.Width - 28, 18), sf);
                        g.DrawString(act + "    tab  section    esc  close", smallFont, dim, new RectangleF(detail.X + 14, detail.Y + 62, detail.Width - 28, 16), sf);
                    } else {
                        g.DrawString("no command selected", tabFont, dim, new RectangleF(detail.X + 14, detail.Y + 24, detail.Width - 28, 24), sf);
                    }
                }
            }
        }

        void DrawTab(Graphics g, StringFormat sf, Rectangle r, string label, bool on) {
            using (var fill = new SolidBrush(on ? Color.FromArgb(42, accent) : Color.FromArgb(18, 255, 255, 255))) {
                g.FillRectangle(fill, r);
            }
            if (on) {
                using (var rail = new SolidBrush(accent)) {
                    g.FillRectangle(rail, r.X, r.Bottom - 2, r.Width, 2);
                }
            }
            using (var edge = new Pen(Color.FromArgb(on ? 70 : 24, on ? accent : Color.White), 1f)) {
                g.DrawRectangle(edge, r.X, r.Y, r.Width - 1, r.Height - 1);
            }
            using (var ink = new SolidBrush(on ? Color.FromArgb(236, 238, 242) : Color.FromArgb(124, 140, 156)))
            using (var tsf = (StringFormat)sf.Clone()) {
                tsf.Alignment = StringAlignment.Center;
                g.DrawString(label, tabFont, ink, r, tsf);
            }
        }

        protected override void Dispose(bool disposing) {
            if (disposing) {
                if (blink != null) { blink.Stop(); blink.Dispose(); }
                titleFont.Dispose();
                tabFont.Dispose();
                rowFont.Dispose();
                smallFont.Dispose();
            }
            base.Dispose(disposing);
        }
    }
}
