using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;
using FoxOs.Sdk;

namespace FoxOs.Style {

    // Demo desk: every FOXSTYLE control must be visible here.
    public class PreviewCanvas : Control {
        readonly FoxTheme ui;
        StyleDoc doc;
        Color bg, surface, accent, accent2, ink;
        Color tBg, tSurface, tAccent, tAccent2, tInk;
        readonly Timer lerp;
        readonly Timer anim;
        float glow;
        string focus = "themes";
        float openT = 1f; // 0..1 window open animation
        string lastOpen = "";

        public PreviewCanvas(FoxTheme theme) {
            ui = theme;
            FoxUi.Buffer(this);
            lerp = new Timer();
            lerp.Interval = 16;
            lerp.Tick += OnLerp;
            anim = new Timer();
            anim.Interval = 16;
            anim.Tick += OnAnim;
            SetDoc(StyleDoc.Preset("dark"), true);
        }

        public void SetFocus(string module) {
            focus = module ?? "themes";
            Invalidate();
        }

        public void ReplayOpen() {
            openT = 0f;
            if (!anim.Enabled) anim.Start();
        }

        public void SetDoc(StyleDoc d, bool immediate) {
            doc = d ?? StyleDoc.Preset("dark");
            tBg = Parse(doc.colors.bg, Color.FromArgb(11, 10, 18));
            tSurface = Parse(doc.colors.surface, Color.FromArgb(22, 19, 34));
            tAccent = Parse(doc.colors.accent, Color.FromArgb(123, 92, 255));
            tAccent2 = Parse(doc.colors.accent2, Color.FromArgb(220, 122, 20));
            tInk = Parse(doc.colors.ink, Color.FromArgb(226, 224, 240));

            string oa = doc.window != null ? (doc.window.openAnim ?? "fade") : "fade";
            if (!string.Equals(oa, lastOpen, StringComparison.OrdinalIgnoreCase)) {
                lastOpen = oa;
                if (!immediate) ReplayOpen();
            }

            bool motionOff = doc.motion != null && doc.motion.scale == "off";
            if (immediate || motionOff) {
                bg = tBg; surface = tSurface; accent = tAccent; accent2 = tAccent2; ink = tInk;
                lerp.Stop();
                Invalidate();
                return;
            }
            if (bg.A == 0) { bg = tBg; surface = tSurface; accent = tAccent; accent2 = tAccent2; ink = tInk; }
            if (!lerp.Enabled) lerp.Start();
            Invalidate();
        }

        void OnLerp(object sender, EventArgs e) {
            // motion.med = target ms for color settle → step size
            int med = 280;
            if (doc != null && doc.motion != null && doc.motion.med > 0) med = doc.motion.med;
            float k = 16f / Math.Max(80f, med); // one frame toward target
            if (doc != null && doc.motion != null && doc.motion.scale == "reduced") k *= 1.6f;
            if (k > 0.45f) k = 0.45f;
            bg = Mix(bg, tBg, k);
            surface = Mix(surface, tSurface, k);
            accent = Mix(accent, tAccent, k);
            accent2 = Mix(accent2, tAccent2, k);
            ink = Mix(ink, tInk, k);
            glow += 0.07f;
            if (glow > 6.28f) glow -= 6.28f;
            Invalidate();
            if (Near(bg, tBg) && Near(accent, tAccent) && (doc == null || doc.labs == null || !doc.labs.foxGlow))
                lerp.Stop();
        }

        void OnAnim(object sender, EventArgs e) {
            openT += 0.05f;
            if (openT >= 1f) { openT = 1f; anim.Stop(); }
            Invalidate();
        }

        protected override void OnPaint(PaintEventArgs e) {
            Graphics g = e.Graphics;
            try {
                g.SmoothingMode = SmoothingMode.AntiAlias;
                g.Clear(Parent != null ? Parent.BackColor : ui.Paper);
                int W = Math.Max(40, Width - 1), H = Math.Max(40, Height - 1);
                Rectangle outer = new Rectangle(0, 0, W, H);
                FoxUi.PaintCard(g, outer, surface.IsEmpty ? ui.Card : surface, ui.Line);

                Rectangle desk = new Rectangle(8, 8, Math.Max(20, W - 16), Math.Max(20, H - 28));
                using (GraphicsPath deskPath = FoxUi.Round(desk, 12))
                using (SolidBrush deskBrush = new SolidBrush(bg.IsEmpty ? Color.FromArgb(11, 10, 18) : bg)) {
                    g.FillPath(deskBrush, deskPath);
                    Region old = g.Clip;
                    try {
                        g.SetClip(deskPath);
                        PaintDesk(g, desk);
                    } finally { g.Clip = old; }
                }

                Font small = ui.Small ?? SystemFonts.DefaultFont;
                using (SolidBrush mute = new SolidBrush(ui.Muted))
                using (SolidBrush acc = new SolidBrush(accent.IsEmpty ? ui.Accent : accent)) {
                    SafeDraw(g, "LIVE DEMO", small, mute, 12, Math.Max(2, Height - 16));
                    string tag = FocusTag();
                    SizeF sz = g.MeasureString(tag, small);
                    SafeDraw(g, tag, small, acc, Width - sz.Width - 12, Math.Max(2, Height - 16));
                }
            } catch {
                try { g.Clear(Color.FromArgb(16, 20, 14)); g.DrawString("preview", SystemFonts.DefaultFont, Brushes.Lime, 8, 8); } catch { }
            }
        }

        string FocusTag() {
            switch (focus) {
                case "dock":
                case "chrome":
                case "texture": return "DOCK / WALL <<";
                case "windows": return "WINDOW <<";
                case "colors": return "GLASS / COLOR <<";
                case "buttons": return "BUTTONS <<";
                case "motion": return "MOTION <<";
                case "labs": return "GLOW <<";
                case "themes": return "MODE <<";
                default: return focus;
            }
        }

        void PaintDesk(Graphics g, Rectangle desk) {
            Font small = ui.Small ?? SystemFonts.DefaultFont;
            Font body = ui.Body ?? SystemFonts.DefaultFont;

            // reserved bands so nothing overlaps
            int dockBand = 44;
            int btnBand = 42;
            int chromeH = 36, chromeOp = 72;
            bool flot = false;
            if (doc != null && doc.chrome != null) {
                chromeH = Math.Max(24, Math.Min(48, doc.chrome.height));
                chromeOp = Math.Max(20, Math.Min(100, doc.chrome.opacity));
                flot = doc.chrome.floating;
            }
            int chromeBand = flot ? chromeH + 16 : chromeH;
            int contentTop = desk.Y + chromeBand + 6;
            int contentBottom = desk.Bottom - dockBand - 4;
            int midBottom = contentBottom - btnBand;

            // --- wallpaper rain / texture ---
            string tex = doc != null && doc.texture != null ? doc.texture.kind : "glass";
            int rain = doc != null && doc.texture != null ? Math.Max(0, Math.Min(80, doc.texture.rain)) : 30;
            int tStr = doc != null && doc.texture != null ? Math.Max(0, Math.Min(100, doc.texture.strength)) : 60;
            int tSc = doc != null && doc.texture != null ? Math.Max(0, Math.Min(100, doc.texture.scale)) : 50;
            int tWt = doc != null && doc.texture != null ? Math.Max(0, Math.Min(100, doc.texture.weight)) : 40;
            int tVeil = doc != null && doc.texture != null ? Math.Max(0, Math.Min(100, doc.texture.veil)) : 50;
            float stroke = 1f + tWt * 3.5f / 100f; // preview: 1..4.5
            int aRain = Math.Max(10, rain * (40 + tStr) / 140);
            using (Pen rp = new Pen(Color.FromArgb(aRain, accent), 1f)) {
                int step = Math.Max(8, 44 - rain / 2);
                for (int x = desk.X + 4; x < desk.Right; x += step) {
                    int y0 = desk.Y + 4 + ((x * 5) % 17);
                    g.DrawLine(rp, x, y0, x, Math.Min(desk.Bottom - 2, y0 + 10 + rain / 8));
                }
            }
            int grid = Math.Max(10, 14 + tSc / 3);
            int texA = 20 + tStr * 90 / 100;
            if (tex == "neon") {
                using (Pen gp = new Pen(Color.FromArgb(Math.Min(200, texA), accent), stroke)) {
                    for (int x = desk.X; x < desk.Right; x += grid) g.DrawLine(gp, x, desk.Y, x, desk.Bottom);
                    for (int y = desk.Y; y < desk.Bottom; y += grid) g.DrawLine(gp, desk.X, y, desk.Right, y);
                }
            } else if (tex == "metal") {
                using (Pen mp = new Pen(Color.FromArgb(Math.Min(160, 16 + tStr / 2), ink), stroke)) {
                    int metalGap = Math.Max(3, grid / 3);
                    for (int y = desk.Y; y < desk.Bottom; y += metalGap) g.DrawLine(mp, desk.X, y, desk.Right, y);
                }
            } else if (tex == "fabric") {
                using (Pen fp = new Pen(Color.FromArgb(Math.Min(140, texA / 2), accent), stroke)) {
                    for (int x = desk.X - desk.Height; x < desk.Right; x += Math.Max(6, grid / 2))
                        g.DrawLine(fp, x, desk.Y, x + desk.Height, desk.Bottom);
                }
            } else if (tex == "glass" && tVeil > 10) {
                using (SolidBrush vb = new SolidBrush(Color.FromArgb(tVeil / 3, accent)))
                    g.FillEllipse(vb, desk.X - 20, desk.Y - 10, desk.Width * 2 / 3, desk.Height / 2);
            }

            // --- CHROME (top band only) ---
            Rectangle chrome = flot
                ? new Rectangle(desk.X + 18, desk.Y + 8, Math.Max(40, desk.Width - 36), chromeH)
                : new Rectangle(desk.X, desk.Y, desk.Width, chromeH);
            using (SolidBrush cb = new SolidBrush(Color.FromArgb(chromeOp * 255 / 100, Mix(surface, accent, 0.15f)))) {
                if (flot) { using (GraphicsPath cp = FoxUi.Round(chrome, 12)) g.FillPath(cb, cp); }
                else g.FillRectangle(cb, chrome);
            }
            using (SolidBrush ai = new SolidBrush(accent))
            using (SolidBrush ii = new SolidBrush(Color.FromArgb(220, ink))) {
                SafeDraw(g, flot ? "ПАНЕЛЬ · ВІДСТУП" : "ПАНЕЛЬ · ДО КРАЮ", small, ai, chrome.X + 8, chrome.Y + Math.Max(2, (chromeH - 11) / 2));
                SafeDraw(g, chromeOp + "%  h" + chromeH, small, ii, chrome.Right - 78, chrome.Y + Math.Max(2, (chromeH - 11) / 2));
            }
            if (focus == "dock" || focus == "chrome") Halo(g, chrome, accent, flot ? 12 : 2);

            // --- WINDOW (glass = frost alpha on the window itself, not a second panel) ---
            int glass = doc != null && doc.colors != null ? Math.Max(10, Math.Min(100, doc.colors.glass)) : 72;
            int rad = 10, sh = 50;
            string openAnim = "fade";
            if (doc != null && doc.window != null) {
                rad = Math.Max(0, Math.Min(28, doc.window.radius));
                sh = Math.Max(0, Math.Min(100, doc.window.shadow));
                openAnim = doc.window.openAnim ?? "fade";
            }
            int maxWh = Math.Max(72, midBottom - contentTop - 4);
            int ww = Math.Max(100, Math.Min(desk.Width - 36, desk.Width * 3 / 5));
            int wh = Math.Min(maxWh, Math.Max(80, desk.Height / 3 + 20));
            int wx = desk.X + (desk.Width - ww) / 2;
            int wy = contentTop + Math.Max(0, (maxWh - wh) / 6);

            float t = openT;
            if (t < 0f) t = 0f; if (t > 1f) t = 1f;
            Rectangle win = new Rectangle(wx, wy, ww, wh);
            if (openAnim == "zoom") {
                float s = 0.55f + 0.45f * t;
                int nw = (int)(ww * s), nh = (int)(wh * s);
                win = new Rectangle(wx + (ww - nw) / 2, wy + (wh - nh) / 2, nw, nh);
            }
            int frost = 90 + glass * 140 / 100; // glass % → window fill opacity
            if (frost > 245) frost = 245;
            int winAlpha = openAnim == "fade" ? (int)(40 + frost * t) : frost;
            if (winAlpha > 255) winAlpha = 255;

            int shadowOff = 4 + sh / 8;
            int shadowA = Math.Max(10, sh);
            Rectangle shadow = new Rectangle(win.X + shadowOff / 2, win.Y + shadowOff, win.Width, win.Height);
            int drawRad = Math.Max(1, rad / 2 + 2);
            using (GraphicsPath sp = FoxUi.Round(shadow, drawRad))
            using (SolidBrush sb = new SolidBrush(Color.FromArgb(shadowA, 0, 0, 0))) {
                g.FillPath(sb, sp);
            }
            int edgeA = 150;
            Color edgeC = accent;
            if (doc != null && doc.labs != null && doc.labs.foxGlow) {
                double amp = Math.Max(0, Math.Min(100, doc.labs.glowStrength)) / 100.0;
                double sp = Math.Max(0, Math.Min(100, doc.labs.glowSpeed)) / 100.0;
                double pulse = (1.0 - amp * 0.5) + amp * 0.5 * Math.Sin(glow * (0.8 + sp * 1.6));
                edgeA = 140 + (int)(90 * amp * (0.5 + 0.5 * Math.Sin(glow * (1 + sp))));
                edgeC = Mix(accent, accent2, (float)(1.0 - pulse));
            }
            using (GraphicsPath wp = FoxUi.Round(win, drawRad))
            using (SolidBrush wb = new SolidBrush(Color.FromArgb(winAlpha, surface)))
            using (Pen we = new Pen(Color.FromArgb(Math.Min(255, edgeA), edgeC),
                (focus == "windows" || focus == "labs" || focus == "colors") ? 2.4f : 1.3f)) {
                g.FillPath(wb, wp);
                g.DrawPath(we, wp);
            }
            using (SolidBrush titleBg = new SolidBrush(Color.FromArgb(60, accent))) {
                g.FillRectangle(titleBg, win.X, win.Y, win.Width, 20);
            }
            FoxUi.PaintDot(g, win.X + 8, win.Y + 7, 6, Color.FromArgb(220, 80, 80));
            FoxUi.PaintDot(g, win.X + 18, win.Y + 7, 6, Color.FromArgb(220, 180, 60));
            FoxUi.PaintDot(g, win.X + 28, win.Y + 7, 6, Color.FromArgb(80, 180, 100));
            string sw = doc != null && doc.colors != null ? (doc.colors.sw ?? "?") : "?";
            using (SolidBrush ti = new SolidBrush(Color.FromArgb(Math.Min(255, winAlpha), ink)))
            using (SolidBrush ac = new SolidBrush(Color.FromArgb(Math.Min(255, winAlpha), accent))) {
                SafeDraw(g, "GLASS " + glass + "%", body, ac, win.X + 10, win.Y + 26);
                SafeDraw(g, "radius " + rad + " · shadow " + sh, small, ti, win.X + 10, win.Y + 46);
                SafeDraw(g, "open " + openAnim + " · sw " + sw, small, ti, win.X + 10, win.Y + 62);
            }
            if (focus == "windows" || focus == "colors")
                Halo(g, Rectangle.Inflate(win, 4, 4), accent, drawRad + 2);

            // --- DEMO BUTTONS (between window and dock) ---
            string bstyle = doc != null && doc.button != null ? doc.button.style : "glass";
            int bh = 26, gap = 8;
            int bw = Math.Min(68, (desk.Width - 40) / 3);
            int by = midBottom + 6;
            if (by + bh <= contentBottom) {
                string[] labels = new string[] { "OK", "Cancel", "Fox" };
                int bx = desk.X + (desk.Width - (bw * 3 + gap * 2)) / 2;
                for (int i = 0; i < 3; i++) {
                    Rectangle br = new Rectangle(bx + i * (bw + gap), by, bw, bh);
                    int brad = 6;
                    if (bstyle == "sharp") brad = 2;
                    if (bstyle == "rounded") brad = 14;
                    if (bstyle == "liquid") brad = 16;
                    Color bfill = i == 0 ? accent : (i == 2 ? accent2 : Mix(surface, ink, 0.12f));
                    int ba = bstyle == "glass" ? 160 : 230;
                    using (GraphicsPath bp = FoxUi.Round(br, brad))
                    using (SolidBrush bb = new SolidBrush(Color.FromArgb(ba, bfill)))
                    using (Pen bp2 = new Pen(Color.FromArgb(120, ink), 1f)) {
                        g.FillPath(bb, bp);
                        if (bstyle == "glass") g.DrawPath(bp2, bp);
                    }
                    using (SolidBrush bi = new SolidBrush(Color.White)) {
                        SizeF s = g.MeasureString(labels[i], small);
                        SafeDraw(g, labels[i], small, bi, br.X + (br.Width - s.Width) / 2, br.Y + (br.Height - s.Height) / 2);
                    }
                }
                using (SolidBrush hint = new SolidBrush(Color.FromArgb(180, accent))) {
                    SafeDraw(g, "buttons: " + bstyle, small, hint, desk.X + 10, by - 14);
                }
                if (focus == "buttons")
                    Halo(g, new Rectangle(bx - 4, by - 4, bw * 3 + gap * 2 + 8, bh + 8), accent, 10);
            }

            // --- DOCK (bottom band) ---
            string dockStyle = doc != null && doc.texture != null ? doc.texture.dock : "pill";
            bool bar = string.Equals(dockStyle, "bar", StringComparison.OrdinalIgnoreCase)
                || string.Equals(dockStyle, "slim", StringComparison.OrdinalIgnoreCase);
            int dw = Math.Min(160, desk.Width - 24), dh = 32;
            Rectangle dock = bar
                ? new Rectangle(desk.X, desk.Bottom - dh, desk.Width, dh)
                : new Rectangle(desk.X + (desk.Width - dw) / 2, desk.Bottom - dh - 4, dw, dh);
            using (GraphicsPath dp = FoxUi.Round(dock, bar ? 0 : 16))
            using (SolidBrush db = new SolidBrush(Color.FromArgb(200, surface))) {
                g.FillPath(db, dp);
            }
            string dockLabel = bar ? "DOCK BAR" : (string.Equals(dockStyle, "rail", StringComparison.OrdinalIgnoreCase) ? "DOCK RAIL" : "DOCK PILL");
            using (SolidBrush di = new SolidBrush(accent)) {
                SafeDraw(g, dockLabel, small, di, dock.X + 10, dock.Y + 3);
            }
            int cx = dock.X + (bar ? dock.Width / 2 - 50 : 20);
            Color[] dots = new Color[] { accent, accent2, Color.FromArgb(140, ink), accent };
            for (int i = 0; i < 4; i++) {
                FoxUi.PaintDot(g, cx + i * 26, dock.Y + 18, 10, dots[i]);
            }
            if (focus == "dock" || focus == "texture" || focus == "themes") Halo(g, dock, accent2, bar ? 2 : 14);

            if (focus == "motion" && doc != null && doc.motion != null) {
                string m = "lerp " + doc.motion.scale + " · " + doc.motion.med + "ms";
                using (SolidBrush mb = new SolidBrush(Color.FromArgb(210, 10, 10, 16)))
                using (SolidBrush mi = new SolidBrush(accent2)) {
                    int my = Math.Max(contentTop, midBottom - 20);
                    g.FillRectangle(mb, desk.X + 8, my, 168, 18);
                    SafeDraw(g, m, small, mi, desk.X + 12, my + 2);
                }
            }
        }

        static void Halo(Graphics g, Rectangle r, Color c, int rad) {
            using (Pen p = new Pen(Color.FromArgb(200, c), 2f))
            using (GraphicsPath path = FoxUi.Round(Rectangle.Inflate(r, 3, 3), Math.Max(1, rad))) {
                g.DrawPath(p, path);
            }
        }

        static void SafeDraw(Graphics g, string text, Font font, Brush brush, float x, float y) {
            if (string.IsNullOrEmpty(text) || brush == null) return;
            try { g.DrawString(text, font ?? SystemFonts.DefaultFont, brush, x, y); }
            catch { try { g.DrawString(text, SystemFonts.DefaultFont, brush, x, y); } catch { } }
        }

        static Color Parse(string hex, Color fallback) {
            if (string.IsNullOrEmpty(hex)) return fallback;
            try {
                string h = hex.Trim().TrimStart('#');
                if (h.Length != 6) return fallback;
                return Color.FromArgb(
                    Convert.ToInt32(h.Substring(0, 2), 16),
                    Convert.ToInt32(h.Substring(2, 2), 16),
                    Convert.ToInt32(h.Substring(4, 2), 16));
            } catch { return fallback; }
        }

        static Color Mix(Color a, Color b, float t) {
            if (t < 0f) t = 0f; if (t > 1f) t = 1f;
            return Color.FromArgb(
                (int)(a.R + (b.R - a.R) * t),
                (int)(a.G + (b.G - a.G) * t),
                (int)(a.B + (b.B - a.B) * t));
        }

        static bool Near(Color a, Color b) {
            return Math.Abs(a.R - b.R) < 4 && Math.Abs(a.G - b.G) < 4 && Math.Abs(a.B - b.B) < 4;
        }
    }
}
