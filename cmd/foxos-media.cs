using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using System.Windows.Forms;

namespace FoxOsLive {

    // Now-playing strip — taskbar-like soft glass, auto-hides at top edge.
    sealed class MediaStrip : Form {
        static readonly Color Choke = Color.FromArgb(255, 1, 2, 3);
        const int FullW = 340;
        const int FullH = 64;
        const int PeekH = 10;
        const int EdgePx = 14;

        readonly string dir;
        readonly System.Windows.Forms.Timer tick;
        readonly Font titleFont;
        readonly Font subFont;
        readonly Font glyphFont;

        Color night = Color.FromArgb(11, 15, 26);
        Color accent = Color.FromArgb(220, 122, 20);
        Color accent2 = Color.FromArgb(240, 160, 60);

        bool active;
        string title = "";
        string artist = "";
        string status = "";
        bool canPlay, canPause, canNext, canPrev;
        string artPath = "";
        Image art;
        string artLoaded = "";
        int hover;
        DateTime lastCmd = DateTime.MinValue;

        bool collapsed = true;
        DateTime leaveAt = DateTime.MinValue;
        bool leaveArmed;

        public MediaStrip(string foxOsDir) {
            dir = foxOsDir ?? Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "FoxTerminal", "foxos");
            Text = "FoxOS Media";
            FormBorderStyle = FormBorderStyle.None;
            ShowInTaskbar = false;
            StartPosition = FormStartPosition.Manual;
            TopMost = true;
            BackColor = Choke;
            TransparencyKey = Choke;
            DoubleBuffered = true;
            Width = FullW;
            Height = FullH;
            Opacity = 1;
            Visible = false;

            titleFont = new Font("Segoe UI Semibold", 10.5f, FontStyle.Bold, GraphicsUnit.Point);
            subFont = new Font("Segoe UI", 8.25f, FontStyle.Regular, GraphicsUnit.Point);
            glyphFont = new Font("Segoe UI Symbol", 10.5f, FontStyle.Regular, GraphicsUnit.Point);

            tick = new System.Windows.Forms.Timer();
            tick.Interval = 80;
            tick.Tick += delegate {
                Poll();
                if (!active) {
                    if (Visible) Hide();
                    collapsed = true;
                    leaveArmed = false;
                    return;
                }
                if (!Visible) {
                    collapsed = true;
                    Place();
                    Show();
                }
                TickHide();
                Invalidate();
            };
            tick.Start();
        }

        protected override CreateParams CreateParams {
            get {
                var cp = base.CreateParams;
                cp.ExStyle |= 0x08000000; // WS_EX_NOACTIVATE
                cp.ExStyle |= 0x00000080; // WS_EX_TOOLWINDOW
                return cp;
            }
        }

        protected override bool ShowWithoutActivation { get { return true; } }

        protected override void WndProc(ref Message m) {
            if (m.Msg == 0x0084) { // WM_NCHITTEST — logical island always clickable
                long lp = m.LParam.ToInt64();
                int sx = (short)(lp & 0xFFFF);
                int sy = (short)((lp >> 16) & 0xFFFF);
                Point pt = PointToClient(new Point(sx, sy));
                if (collapsed || Island().Contains(pt) || ClientRectangle.Contains(pt)) {
                    m.Result = new IntPtr(1); // HTCLIENT
                    return;
                }
                m.Result = new IntPtr(-1); // HTTRANSPARENT
                return;
            }
            base.WndProc(ref m);
        }

        public void Recolor(Color n, Color a, Color a2) {
            night = n; accent = a; accent2 = a2;
            Invalidate();
        }

        void Place() {
            Rectangle sb = Screen.PrimaryScreen.Bounds;
            int w = collapsed ? Math.Min(120, FullW) : FullW;
            int h = collapsed ? PeekH : FullH;
            int x = sb.X + (sb.Width - w) / 2;
            int y = collapsed ? sb.Y : (sb.Y + 10);
            Bounds = new Rectangle(x, y, w, h);
            try {
                Native.SetWindowPos(Handle, new IntPtr(-1), x, y, w, h, 0x0010);
            } catch { }
        }

        void TickHide() {
            Point c = Cursor.Position;
            Rectangle sb = Screen.PrimaryScreen.Bounds;
            bool over = Bounds.Contains(c);
            bool edgeHit = c.Y <= sb.Y + EdgePx
                && c.X >= sb.X + (sb.Width - FullW) / 2 - 40
                && c.X <= sb.X + (sb.Width + FullW) / 2 + 40;

            if (over || edgeHit) {
                leaveArmed = false;
                if (collapsed) {
                    collapsed = false;
                    Place();
                }
                return;
            }

            if (!collapsed) {
                if (!leaveArmed) {
                    leaveArmed = true;
                    leaveAt = DateTime.UtcNow;
                } else if ((DateTime.UtcNow - leaveAt).TotalMilliseconds >= 550) {
                    collapsed = true;
                    leaveArmed = false;
                    Place();
                }
            }
        }

        static string Grab(string json, string key) {
            var m = Regex.Match(json, "\"" + key + "\"\\s*:\\s*\"([^\"]*)\"");
            return m.Success ? m.Groups[1].Value.Replace("\\\\", "\\") : "";
        }
        static bool GrabBool(string json, string key) {
            var m = Regex.Match(json, "\"" + key + "\"\\s*:\\s*(true|false)", RegexOptions.IgnoreCase);
            return m.Success && m.Groups[1].Value.Equals("true", StringComparison.OrdinalIgnoreCase);
        }

        void Poll() {
            string path = Path.Combine(dir, "media.json");
            if (!File.Exists(path)) { active = false; return; }
            string json;
            try {
                using (var fs = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete))
                using (var sr = new StreamReader(fs, Encoding.UTF8)) {
                    json = sr.ReadToEnd();
                }
            } catch { active = false; return; }
            active = GrabBool(json, "active");
            if (!active) return;
            title = Grab(json, "title");
            artist = Grab(json, "artist");
            status = Grab(json, "status");
            canPlay = GrabBool(json, "canPlay");
            canPause = GrabBool(json, "canPause");
            canNext = GrabBool(json, "canNext");
            canPrev = GrabBool(json, "canPrev");
            artPath = Grab(json, "art");
            LoadArt();
        }

        void LoadArt() {
            if (string.IsNullOrEmpty(artPath) || !File.Exists(artPath)) {
                if (art != null) { art.Dispose(); art = null; artLoaded = ""; }
                return;
            }
            long ticks = 0;
            long len = 0;
            try {
                var fi = new FileInfo(artPath);
                ticks = fi.LastWriteTimeUtc.Ticks;
                len = fi.Length;
            } catch { }
            if (len < 64) {
                if (art != null) { art.Dispose(); art = null; artLoaded = ""; }
                return;
            }
            string key = artPath + "|" + ticks + "|" + len;
            if (key == artLoaded && art != null) return;
            try {
                byte[] bytes = File.ReadAllBytes(artPath);
                Image next;
                using (var ms = new MemoryStream(bytes))
                using (var tmp = Image.FromStream(ms)) {
                    next = new Bitmap(tmp, new Size(56, 56));
                }
                if (art != null) art.Dispose();
                art = next;
                artLoaded = key;
            } catch {
                if (art != null) { art.Dispose(); art = null; }
                artLoaded = "";
            }
        }

        void SendCmd(string cmd) {
            if ((DateTime.UtcNow - lastCmd).TotalMilliseconds < 120) return;
            lastCmd = DateTime.UtcNow;
            try {
                File.AppendAllText(Path.Combine(dir, "media-cmd.txt"), cmd + Environment.NewLine, Encoding.UTF8);
            } catch { }
        }

        bool HasArt { get { return art != null; } }

        Rectangle Island() { return new Rectangle(3, 3, Width - 6, Height - 6); }

        int TextLeft {
            get { return Island().X + (HasArt ? 50 : 12); }
        }

        Rectangle ArtRect() {
            var i = Island();
            return new Rectangle(i.X + 8, i.Y + (i.Height - 36) / 2, 36, 36);
        }
        Rectangle PrevRect() {
            var i = Island();
            return new Rectangle(i.Right - 112, i.Y + (i.Height - 28) / 2, 28, 28);
        }
        Rectangle PlayRect() {
            var i = Island();
            return new Rectangle(i.Right - 78, i.Y + (i.Height - 30) / 2, 30, 30);
        }
        Rectangle NextRect() {
            var i = Island();
            return new Rectangle(i.Right - 42, i.Y + (i.Height - 28) / 2, 28, 28);
        }
        Rectangle TitleRect() {
            var i = Island();
            int left = TextLeft;
            return new Rectangle(left, i.Y + 10, Math.Max(40, i.Right - 120 - left), 18);
        }
        Rectangle ArtistRect() {
            var i = Island();
            int left = TextLeft;
            return new Rectangle(left, i.Y + 30, Math.Max(40, i.Right - 120 - left), 14);
        }

        bool Playing {
            get { return status.Equals("Playing", StringComparison.OrdinalIgnoreCase); }
        }

        protected override void OnMouseDown(MouseEventArgs e) {
            if (collapsed) {
                collapsed = false;
                leaveArmed = false;
                Place();
                return;
            }
            if (PrevRect().Contains(e.Location)) { SendCmd("prev"); return; }
            if (PlayRect().Contains(e.Location)) { SendCmd("playpause"); return; }
            if (NextRect().Contains(e.Location)) { SendCmd("next"); return; }
            base.OnMouseDown(e);
        }

        protected override void OnMouseMove(MouseEventArgs e) {
            if (collapsed) {
                Cursor = Cursors.Hand;
                return;
            }
            int h = 0;
            if (PrevRect().Contains(e.Location)) h = 1;
            else if (PlayRect().Contains(e.Location)) h = 2;
            else if (NextRect().Contains(e.Location)) h = 3;
            if (h != hover) { hover = h; Cursor = h != 0 ? Cursors.Hand : Cursors.Default; Invalidate(); }
            base.OnMouseMove(e);
        }

        protected override void OnMouseEnter(EventArgs e) {
            leaveArmed = false;
            if (collapsed) {
                collapsed = false;
                Place();
            }
            base.OnMouseEnter(e);
        }

        protected override void OnMouseLeave(EventArgs e) {
            hover = 0;
            Cursor = Cursors.Default;
            leaveArmed = true;
            leaveAt = DateTime.UtcNow;
            base.OnMouseLeave(e);
        }

        static string Clip(string s, int n) {
            if (string.IsNullOrEmpty(s)) return "";
            if (s.Length <= n) return s;
            return s.Substring(0, n - 1) + "…";
        }

        protected override void OnPaint(PaintEventArgs e) {
            var g = e.Graphics;
            g.Clear(Choke);
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.PixelOffsetMode = PixelOffsetMode.HighQuality;
            g.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;

            if (collapsed) {
                // thin peek pill at top edge
                var peek = new Rectangle(2, 0, Width - 4, Height);
                QuickUi.FillRound(g, peek, 3, Color.FromArgb(200, accent));
                using (var shine = new SolidBrush(Color.FromArgb(60, 255, 255, 255)))
                    g.FillRectangle(shine, peek.X + 8, peek.Y + 1, peek.Width - 16, 2);
                return;
            }

            var isl = Island();
            int rad = 8;
            using (var path = QuickUi.RoundBox(isl, rad)) {
                // Opaque glass (TransparencyKey eats semi-transparent fills → dead clicks)
                int r = Math.Min(255, night.R + 18);
                int gg = Math.Min(255, night.G + 14);
                int b = Math.Min(255, night.B + 22);
                using (var fill = new SolidBrush(Color.FromArgb(255, r, gg, b)))
                    g.FillPath(fill, path);
                using (var wash = new SolidBrush(Color.FromArgb(255,
                    Math.Min(255, r + 12), Math.Min(255, gg + 12), Math.Min(255, b + 12)))) {
                    g.SetClip(path);
                    g.FillRectangle(wash, isl.X, isl.Y, isl.Width, isl.Height / 2);
                    g.ResetClip();
                }
                using (var tint = new SolidBrush(Color.FromArgb(255,
                    (r * 6 + accent.R) / 7, (gg * 6 + accent.G) / 7, (b * 6 + accent.B) / 7))) {
                    g.SetClip(path);
                    g.FillRectangle(tint, isl.X, isl.Y, isl.Width, 3);
                    g.ResetClip();
                }
                using (var edge = new Pen(Color.FromArgb(90, 255, 255, 255), 1f))
                    g.DrawPath(edge, path);
            }

            if (HasArt) {
                var ar = ArtRect();
                using (var path = QuickUi.RoundBox(ar, 5)) {
                    g.SetClip(path);
                    g.DrawImage(art, ar);
                    g.ResetClip();
                    using (var edge = new Pen(Color.FromArgb(36, 255, 255, 255), 1f))
                        g.DrawPath(edge, path);
                }
            }

            using (var titleInk = new SolidBrush(Color.FromArgb(240, 245, 248)))
            using (var subInk = new SolidBrush(Color.FromArgb(190, accent2))) {
                g.DrawString(Clip(string.IsNullOrEmpty(title) ? "Now playing" : title, HasArt ? 18 : 22),
                    titleFont, titleInk, TitleRect());
                string sub = string.IsNullOrEmpty(artist) ? status : artist;
                if (!string.IsNullOrEmpty(artist) && !Playing && !string.IsNullOrEmpty(status))
                    sub = artist + "  ·  " + status;
                g.DrawString(Clip(sub, HasArt ? 22 : 26), subFont, subInk, ArtistRect());
            }

            DrawSoftBtn(g, PrevRect(), "⏮", hover == 1, canPrev, false);
            DrawSoftBtn(g, PlayRect(), Playing ? "⏸" : "▶", hover == 2, canPlay || canPause, true);
            DrawSoftBtn(g, NextRect(), "⏭", hover == 3, canNext, false);
        }

        void DrawSoftBtn(Graphics g, Rectangle r, string glyph, bool hot, bool enabled, bool primary) {
            int rad = 6;
            Color fill;
            if (primary) {
                fill = hot ? Color.FromArgb(255, accent2) : Color.FromArgb(255, accent);
            } else {
                // Opaque so TransparencyKey does not punch holes through the buttons
                int lift = hot ? 48 : 28;
                fill = Color.FromArgb(255,
                    Math.Min(255, night.R + lift),
                    Math.Min(255, night.G + lift),
                    Math.Min(255, night.B + lift + 8));
            }
            QuickUi.FillRound(g, r, rad, fill);
            if (!primary) {
                using (var edge = new Pen(Color.FromArgb(hot ? 70 : 36, 255, 255, 255), 1f))
                using (var path = QuickUi.RoundBox(r, rad))
                    g.DrawPath(edge, path);
            }

            int a = enabled ? 235 : 100;
            Color ink = primary
                ? Color.FromArgb(a, 18, 20, 26)
                : Color.FromArgb(a, 236, 240, 245);
            using (var br = new SolidBrush(ink)) {
                var sf = new StringFormat();
                sf.Alignment = StringAlignment.Center;
                sf.LineAlignment = StringAlignment.Center;
                Rectangle textR = r;
                if (glyph == "▶") textR = new Rectangle(r.X + 1, r.Y, r.Width, r.Height);
                g.DrawString(glyph, glyphFont, br, textR, sf);
            }
        }

        protected override void Dispose(bool disposing) {
            if (disposing) {
                tick.Stop(); tick.Dispose();
                titleFont.Dispose(); subFont.Dispose(); glyphFont.Dispose();
                if (art != null) art.Dispose();
            }
            base.Dispose(disposing);
        }
    }

}
