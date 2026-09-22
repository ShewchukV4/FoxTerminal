using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Globalization;
using System.IO;
using System.Management;
using System.Text;
using System.Text.RegularExpressions;
using System.Windows.Forms;

namespace FoxOsLive {

    // Shared chrome for quick dock panels (volume / bright / battery / bt / reminders).
    static class QuickUi {
        public static readonly Color Choke = Color.FromArgb(255, 1, 2, 3);

        public static GraphicsPath RoundBox(Rectangle r, int rad) {
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

        public static void FillRound(Graphics g, Rectangle r, int rad, Color c) {
            using (var path = RoundBox(r, rad))
            using (var br = new SolidBrush(c))
                g.FillPath(br, path);
        }

        public static Color Wash(Color night, Color over, int a) {
            int ia = 255 - a;
            return Color.FromArgb(
                (night.R * ia + over.R * a) / 255,
                (night.G * ia + over.G * a) / 255,
                (night.B * ia + over.B * a) / 255);
        }

        public static void DrawShell(Graphics g, Rectangle box, Color night, Color accent) {
            using (var path = RoundBox(box, 16)) {
                using (var fill = new SolidBrush(Color.FromArgb(255, night.R, night.G, night.B)))
                    g.FillPath(fill, path);
                using (var wash = new SolidBrush(Wash(night, accent, 34))) {
                    g.SetClip(path);
                    g.FillRectangle(wash, box.X, box.Y, box.Width, 64);
                    g.ResetClip();
                }
                using (var edge = new Pen(Wash(night, accent, 90), 1f))
                    g.DrawPath(edge, path);
            }
        }

        public static void DrawPill(Graphics g, Rectangle r, string label, Font font, Color night, Color accent, bool hot, bool solid) {
            Color fill = solid
                ? (hot ? accent : Wash(night, accent, 200))
                : Wash(night, accent, hot ? 55 : 28);
            FillRound(g, r, 8, fill);
            Color ink = solid ? Color.FromArgb(18, 20, 26) : Color.FromArgb(230, 235, 242);
            using (var br = new SolidBrush(ink))
            using (var sf = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center })
                g.DrawString(label, font, br, r, sf);
        }

        public static void PlaceNearTray(Form f) {
            Rectangle wa = Screen.PrimaryScreen.WorkingArea;
            int x = wa.Right - f.Width - 18;
            int y = wa.Bottom - f.Height - 48;
            if (x < wa.X + 12) x = wa.X + 12;
            if (y < wa.Y + 12) y = wa.Y + 12;
            f.Location = new Point(x, y);
        }

        // slide-down + fade, then Hide — used when focus leaves or another panel opens
        public sealed class SoftOut {
            public bool On;
            public float T = 1f;
            public int RestY;
            public void Begin(Form f) {
                if (f == null || f.IsDisposed) return;
                if (!f.Visible) return;
                // restart cleanly if already closing
                On = true;
                T = 1f;
                RestY = f.Top;
            }
            public void Cancel() { On = false; T = 1f; }
            // returns true while animating (caller should keep timer alive)
            public bool Tick(Form f) {
                if (!On || f == null || f.IsDisposed) { On = false; return false; }
                T -= 0.12f;
                if (T <= 0f) {
                    On = false;
                    T = 0f;
                    try {
                        f.Hide();
                        f.Opacity = 0.94;
                        f.Top = RestY;
                    } catch { }
                    return false;
                }
                // smooth ease-out: fast start, soft land
                float outp = 1f - T;
                float e = outp * outp * (3f - 2f * outp);
                try {
                    f.Top = RestY + (int)(e * 56f);
                    double op = 0.94 * (1.0 - e);
                    if (op < 0.04) op = 0.04;
                    f.Opacity = op;
                } catch { }
                return true;
            }
        }

        public static string PsLines(string command) {
            try {
                var psi = new ProcessStartInfo();
                psi.FileName = "powershell.exe";
                psi.Arguments = "-NoProfile -NonInteractive -ExecutionPolicy Bypass -Command " + command;
                psi.UseShellExecute = false;
                psi.RedirectStandardOutput = true;
                psi.RedirectStandardError = true;
                psi.CreateNoWindow = true;
                try { psi.StandardOutputEncoding = Encoding.UTF8; } catch { }
                using (var p = Process.Start(psi)) {
                    string o = p.StandardOutput.ReadToEnd();
                    p.WaitForExit(12000);
                    return o ?? "";
                }
            } catch { return ""; }
        }

        public static string GrabJson(string block, string key) {
            var m = Regex.Match(block, "\"" + Regex.Escape(key) + "\"\\s*:\\s*\"([^\"]*)\"", RegexOptions.IgnoreCase);
            if (m.Success) return m.Groups[1].Value;
            m = Regex.Match(block, "\"" + Regex.Escape(key) + "\"\\s*:\\s*(true|false|null|[0-9.\\-]+)", RegexOptions.IgnoreCase);
            return m.Success ? m.Groups[1].Value : "";
        }
    }

    // ── Volume ──────────────────────────────────────────────────────────────
    sealed class VolumeBoard : Form {
        readonly Font titleFont, rowFont, small;
        readonly System.Windows.Forms.Timer tick;
        Color night, accent;
        int pct;
        bool mute;
        int hoverBtn;
        float popT = 1f;
        int restY;
        readonly QuickUi.SoftOut soft = new QuickUi.SoftOut();

        public VolumeBoard(Color n, Color a) {
            night = n; accent = a;
            Text = "FoxOS Volume";
            FormBorderStyle = FormBorderStyle.None;
            ShowInTaskbar = false; TopMost = true;
            StartPosition = FormStartPosition.Manual;
            DoubleBuffered = true;
            BackColor = QuickUi.Choke; TransparencyKey = QuickUi.Choke;
            Opacity = 0.94; Size = new Size(340, 200); KeyPreview = true;
            titleFont = new Font("Consolas", 22f, FontStyle.Bold, GraphicsUnit.Pixel);
            rowFont = new Font("Consolas", 15f, FontStyle.Regular, GraphicsUnit.Pixel);
            small = new Font("Consolas", 12f, FontStyle.Regular, GraphicsUnit.Pixel);
            tick = new System.Windows.Forms.Timer();
            tick.Interval = 16;
            tick.Tick += TickAnim;
            RefreshVals();
            QuickUi.PlaceNearTray(this);
        }

        void RefreshVals() {
            pct = FoxAudio.GetPct();
            mute = FoxAudio.GetMute();
            if (pct < 0) pct = 0;
        }

        void TickAnim(object s, EventArgs e) {
            if (soft.Tick(this)) { Invalidate(); return; }
            if (popT < 1f) {
                popT += 0.12f;
                if (popT > 1f) popT = 1f;
                float ease = 1f - (1f - popT) * (1f - popT);
                Top = restY + (int)((1f - ease) * 28f);
                Opacity = 0.8 + 0.14 * ease;
                Invalidate();
            } else tick.Stop();
        }

        public void Recolor(Color n, Color a) { night = n; accent = a; Invalidate(); }

        public void SoftClose() {
            soft.Begin(this);
            if (!tick.Enabled) tick.Start();
        }

        public void Pop() {
            soft.Cancel();
            QuickUi.PlaceNearTray(this);
            restY = Top;
            RefreshVals();
            if (!Visible) {
                popT = 0f; Top = restY + 28; Opacity = 0.8;
                Show(); Activate(); tick.Start();
            } else { Activate(); BringToFront(); }
            Invalidate();
        }

        Rectangle Island() { return new Rectangle(10, 10, Width - 20, Height - 20); }
        Rectangle CloseRect() { var i = Island(); return new Rectangle(i.Right - 46, i.Y + 16, 30, 30); }
        Rectangle MuteRect() { var i = Island(); return new Rectangle(i.X + 24, i.Bottom - 52, 90, 30); }
        Rectangle TrackRect() {
            var i = Island();
            return new Rectangle(i.X + 24, i.Y + 96, i.Width - 48, 16);
        }

        protected override bool ProcessCmdKey(ref Message msg, Keys keyData) {
            if (keyData == Keys.Escape) { SoftClose(); return true; }
            if (keyData == Keys.Up || keyData == Keys.Right) { FoxAudio.VolUp(); RefreshVals(); Invalidate(); return true; }
            if (keyData == Keys.Down || keyData == Keys.Left) { FoxAudio.VolDown(); RefreshVals(); Invalidate(); return true; }
            if (keyData == Keys.M || keyData == Keys.Space) { FoxAudio.VolMute(); RefreshVals(); Invalidate(); return true; }
            return base.ProcessCmdKey(ref msg, keyData);
        }

        protected override void OnMouseDown(MouseEventArgs e) {
            if (CloseRect().Contains(e.Location)) { SoftClose(); return; }
            if (MuteRect().Contains(e.Location)) { FoxAudio.VolMute(); RefreshVals(); Invalidate(); return; }
            var tr = TrackRect();
            if (tr.Contains(e.Location) || (e.Y >= tr.Y - 8 && e.Y <= tr.Bottom + 8 && e.X >= tr.X && e.X <= tr.Right)) {
                float t = (e.X - tr.X) / (float)Math.Max(1, tr.Width);
                if (t < 0) t = 0; if (t > 1) t = 1;
                FoxAudio.SetPct((int)Math.Round(t * 100));
                RefreshVals();
                Invalidate();
            }
            base.OnMouseDown(e);
        }

        protected override void OnMouseMove(MouseEventArgs e) {
            int h = 0;
            if (CloseRect().Contains(e.Location)) h = 1;
            else if (MuteRect().Contains(e.Location)) h = 2;
            else if (TrackRect().Contains(e.Location)) h = 3;
            if (h != hoverBtn) { hoverBtn = h; Cursor = h != 0 ? Cursors.Hand : Cursors.Default; Invalidate(); }
            if (e.Button == MouseButtons.Left && hoverBtn == 3) OnMouseDown(e);
            base.OnMouseMove(e);
        }

        protected override void OnMouseWheel(MouseEventArgs e) {
            if (e.Delta > 0) FoxAudio.VolUp(); else FoxAudio.VolDown();
            RefreshVals(); Invalidate();
            base.OnMouseWheel(e);
        }

        protected override void OnPaint(PaintEventArgs e) {
            var g = e.Graphics;
            g.Clear(QuickUi.Choke);
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.ClearTypeGridFit;
            var isl = Island();
            QuickUi.DrawShell(g, isl, night, accent);
            using (var kick = new SolidBrush(Color.FromArgb(230, accent)))
            using (var title = new SolidBrush(Color.FromArgb(236, 238, 242)))
            using (var muteInk = new SolidBrush(Color.FromArgb(130, 142, 156))) {
                g.DrawString("FOXOS", small, kick, isl.X + 24, isl.Y + 16);
                g.DrawString("volume", titleFont, title, isl.X + 24, isl.Y + 34);
                g.DrawString(mute ? "muted" : (pct + "%"), small, muteInk, isl.X + 140, isl.Y + 44);
            }
            QuickUi.DrawPill(g, CloseRect(), "x", small, night, accent, hoverBtn == 1, false);
            var tr = TrackRect();
            QuickUi.FillRound(g, tr, 8, Color.FromArgb(255, 7, 9, 16));
            int fillW = (int)(tr.Width * (pct / 100.0));
            if (fillW > 0) QuickUi.FillRound(g, new Rectangle(tr.X, tr.Y, Math.Max(8, fillW), tr.Height), 8, accent);
            QuickUi.DrawPill(g, MuteRect(), mute ? "unmute" : "mute", small, night, accent, hoverBtn == 2, true);
        }

        protected override void Dispose(bool disposing) {
            if (disposing) {
                tick.Stop(); tick.Dispose();
                titleFont.Dispose(); rowFont.Dispose(); small.Dispose();
            }
            base.Dispose(disposing);
        }
    }

    // ── Brightness ──────────────────────────────────────────────────────────
    sealed class BrightBoard : Form {
        readonly Font titleFont, small;
        readonly System.Windows.Forms.Timer tick;
        Color night, accent;
        int pct = 80;
        bool supported = true;
        int hoverBtn;
        float popT = 1f;
        int restY;
        readonly QuickUi.SoftOut soft = new QuickUi.SoftOut();

        public BrightBoard(Color n, Color a) {
            night = n; accent = a;
            Text = "FoxOS Brightness";
            FormBorderStyle = FormBorderStyle.None;
            ShowInTaskbar = false; TopMost = true;
            StartPosition = FormStartPosition.Manual;
            DoubleBuffered = true;
            BackColor = QuickUi.Choke; TransparencyKey = QuickUi.Choke;
            Opacity = 0.94; Size = new Size(340, 180); KeyPreview = true;
            titleFont = new Font("Consolas", 22f, FontStyle.Bold, GraphicsUnit.Pixel);
            small = new Font("Consolas", 12f, FontStyle.Regular, GraphicsUnit.Pixel);
            tick = new System.Windows.Forms.Timer();
            tick.Interval = 16;
            tick.Tick += delegate {
                if (soft.Tick(this)) { Invalidate(); return; }
                if (popT < 1f) {
                    popT += 0.12f; if (popT > 1f) popT = 1f;
                    float ease = 1f - (1f - popT) * (1f - popT);
                    Top = restY + (int)((1f - ease) * 28f);
                    Opacity = 0.8 + 0.14 * ease;
                    Invalidate();
                } else tick.Stop();
            };
            pct = FoxBright.GetPct();
            if (pct < 0) { pct = 80; supported = false; }
            QuickUi.PlaceNearTray(this);
        }

        public void Recolor(Color n, Color a) { night = n; accent = a; Invalidate(); }

        public void SoftClose() {
            soft.Begin(this);
            if (!tick.Enabled) tick.Start();
        }

        public void Pop() {
            soft.Cancel();
            QuickUi.PlaceNearTray(this);
            restY = Top;
            int v = FoxBright.GetPct();
            if (v >= 0) { pct = v; supported = true; }
            if (!Visible) {
                popT = 0f; Top = restY + 28; Opacity = 0.8;
                Show(); Activate(); tick.Start();
            } else { Activate(); BringToFront(); }
            Invalidate();
        }

        Rectangle Island() { return new Rectangle(10, 10, Width - 20, Height - 20); }
        Rectangle CloseRect() { var i = Island(); return new Rectangle(i.Right - 46, i.Y + 16, 30, 30); }
        Rectangle TrackRect() { var i = Island(); return new Rectangle(i.X + 24, i.Y + 96, i.Width - 48, 16); }

        protected override bool ProcessCmdKey(ref Message msg, Keys keyData) {
            if (keyData == Keys.Escape) { SoftClose(); return true; }
            if (keyData == Keys.Right || keyData == Keys.Up) { Set(pct + 5); return true; }
            if (keyData == Keys.Left || keyData == Keys.Down) { Set(pct - 5); return true; }
            return base.ProcessCmdKey(ref msg, keyData);
        }

        void Set(int v) {
            if (v < 0) v = 0; if (v > 100) v = 100;
            pct = v;
            supported = FoxBright.SetPct(v) || supported;
            Invalidate();
        }

        protected override void OnMouseDown(MouseEventArgs e) {
            if (CloseRect().Contains(e.Location)) { SoftClose(); return; }
            var tr = TrackRect();
            if (e.X >= tr.X && e.X <= tr.Right && e.Y >= tr.Y - 10 && e.Y <= tr.Bottom + 10) {
                float t = (e.X - tr.X) / (float)Math.Max(1, tr.Width);
                Set((int)Math.Round(t * 100));
            }
            base.OnMouseDown(e);
        }

        protected override void OnMouseMove(MouseEventArgs e) {
            int h = CloseRect().Contains(e.Location) ? 1 : (TrackRect().Contains(e.Location) ? 2 : 0);
            if (h != hoverBtn) { hoverBtn = h; Cursor = h != 0 ? Cursors.Hand : Cursors.Default; Invalidate(); }
            if (e.Button == MouseButtons.Left && hoverBtn == 2) OnMouseDown(e);
            base.OnMouseMove(e);
        }

        protected override void OnMouseWheel(MouseEventArgs e) {
            Set(pct + (e.Delta > 0 ? 5 : -5));
            base.OnMouseWheel(e);
        }

        protected override void OnPaint(PaintEventArgs e) {
            var g = e.Graphics;
            g.Clear(QuickUi.Choke);
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.ClearTypeGridFit;
            var isl = Island();
            QuickUi.DrawShell(g, isl, night, accent);
            using (var kick = new SolidBrush(Color.FromArgb(230, accent)))
            using (var title = new SolidBrush(Color.FromArgb(236, 238, 242)))
            using (var mute = new SolidBrush(Color.FromArgb(130, 142, 156))) {
                g.DrawString("FOXOS", small, kick, isl.X + 24, isl.Y + 16);
                g.DrawString("bright", titleFont, title, isl.X + 24, isl.Y + 34);
                g.DrawString(supported ? (pct + "%") : "unsupported", small, mute, isl.X + 140, isl.Y + 44);
            }
            QuickUi.DrawPill(g, CloseRect(), "x", small, night, accent, hoverBtn == 1, false);
            var tr = TrackRect();
            QuickUi.FillRound(g, tr, 8, Color.FromArgb(255, 7, 9, 16));
            int fillW = (int)(tr.Width * (pct / 100.0));
            if (fillW > 0) QuickUi.FillRound(g, new Rectangle(tr.X, tr.Y, Math.Max(8, fillW), tr.Height), 8, accent);
        }

        protected override void Dispose(bool disposing) {
            if (disposing) { tick.Stop(); tick.Dispose(); titleFont.Dispose(); small.Dispose(); }
            base.Dispose(disposing);
        }
    }

    static class FoxBright {
        public static int GetPct() {
            try {
                using (var s = new ManagementObjectSearcher("root\\WMI", "SELECT CurrentBrightness FROM WmiMonitorBrightness")) {
                    foreach (ManagementObject o in s.Get()) {
                        return Convert.ToInt32(o["CurrentBrightness"]);
                    }
                }
            } catch { }
            return -1;
        }

        public static bool SetPct(int pct) {
            if (pct < 0) pct = 0; if (pct > 100) pct = 100;
            try {
                using (var s = new ManagementObjectSearcher("root\\WMI", "SELECT * FROM WmiMonitorBrightnessMethods")) {
                    foreach (ManagementObject o in s.Get()) {
                        o.InvokeMethod("WmiSetBrightness", new object[] { uint.MaxValue, (byte)pct });
                        return true;
                    }
                }
            } catch { }
            return false;
        }
    }

    // ── Battery ─────────────────────────────────────────────────────────────
    sealed class BatteryBoard : Form {
        readonly Font titleFont, rowFont, small;
        readonly System.Windows.Forms.Timer pulse;
        Color night, accent;
        int pct = -1;
        bool onAc;
        string line2 = "";
        int hoverBtn;
        float popT = 1f;
        int restY;
        readonly QuickUi.SoftOut soft = new QuickUi.SoftOut();
        public Action OpenBright;

        public BatteryBoard(Color n, Color a) {
            night = n; accent = a;
            Text = "FoxOS Battery";
            FormBorderStyle = FormBorderStyle.None;
            ShowInTaskbar = false; TopMost = true;
            StartPosition = FormStartPosition.Manual;
            DoubleBuffered = true;
            BackColor = QuickUi.Choke; TransparencyKey = QuickUi.Choke;
            Opacity = 0.94; Size = new Size(360, 230); KeyPreview = true;
            titleFont = new Font("Consolas", 22f, FontStyle.Bold, GraphicsUnit.Pixel);
            rowFont = new Font("Consolas", 15f, FontStyle.Regular, GraphicsUnit.Pixel);
            small = new Font("Consolas", 12f, FontStyle.Regular, GraphicsUnit.Pixel);
            pulse = new System.Windows.Forms.Timer();
            pulse.Interval = 16;
            pulse.Tick += delegate {
                if (soft.Tick(this)) { Invalidate(); return; }
                if (popT < 1f) {
                    popT += 0.12f; if (popT > 1f) popT = 1f;
                    float ease = 1f - (1f - popT) * (1f - popT);
                    Top = restY + (int)((1f - ease) * 28f);
                    Opacity = 0.8 + 0.14 * ease;
                    Invalidate();
                } else pulse.Stop();
            };
            QuickUi.PlaceNearTray(this);
        }

        void Read() {
            try {
                PowerStatus ps = SystemInformation.PowerStatus;
                onAc = ps.PowerLineStatus == PowerLineStatus.Online;
                float p = ps.BatteryLifePercent;
                pct = (p >= 0 && p <= 1) ? (int)Math.Round(p * 100) : -1;
                int sec = ps.BatteryLifeRemaining;
                if (sec > 0) {
                    int h = sec / 3600, m = (sec % 3600) / 60;
                    line2 = h > 0 ? (h + "h " + m + "m left") : (m + "m left");
                } else line2 = onAc ? "plugged in" : "estimating…";
            } catch { pct = -1; line2 = ""; }
        }

        public void Recolor(Color n, Color a) { night = n; accent = a; Invalidate(); }

        public void SoftClose() {
            soft.Begin(this);
            if (!pulse.Enabled) pulse.Start();
        }

        public void Pop() {
            soft.Cancel();
            QuickUi.PlaceNearTray(this);
            restY = Top; Read();
            if (!Visible) {
                popT = 0f; Top = restY + 28; Opacity = 0.8;
                Show(); Activate(); pulse.Start();
            } else { Activate(); BringToFront(); }
            Invalidate();
        }

        Rectangle Island() { return new Rectangle(10, 10, Width - 20, Height - 20); }
        Rectangle CloseRect() { var i = Island(); return new Rectangle(i.Right - 46, i.Y + 16, 30, 30); }
        Rectangle BrightRect() { var i = Island(); return new Rectangle(i.X + 24, i.Bottom - 52, 110, 30); }
        Rectangle SaverRect() { var i = Island(); return new Rectangle(i.X + 144, i.Bottom - 52, 120, 30); }

        protected override bool ProcessCmdKey(ref Message msg, Keys keyData) {
            if (keyData == Keys.Escape) { SoftClose(); return true; }
            return base.ProcessCmdKey(ref msg, keyData);
        }

        protected override void OnMouseDown(MouseEventArgs e) {
            if (CloseRect().Contains(e.Location)) { SoftClose(); return; }
            if (BrightRect().Contains(e.Location)) {
                if (OpenBright != null) OpenBright();
                return;
            }
            if (SaverRect().Contains(e.Location)) {
                try { Process.Start("ms-settings:batterysaver"); } catch { }
                return;
            }
            base.OnMouseDown(e);
        }

        protected override void OnMouseMove(MouseEventArgs e) {
            int h = 0;
            if (CloseRect().Contains(e.Location)) h = 1;
            else if (BrightRect().Contains(e.Location)) h = 2;
            else if (SaverRect().Contains(e.Location)) h = 3;
            if (h != hoverBtn) { hoverBtn = h; Cursor = h != 0 ? Cursors.Hand : Cursors.Default; Invalidate(); }
            base.OnMouseMove(e);
        }

        protected override void OnPaint(PaintEventArgs e) {
            var g = e.Graphics;
            g.Clear(QuickUi.Choke);
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.ClearTypeGridFit;
            var isl = Island();
            QuickUi.DrawShell(g, isl, night, accent);
            string head = pct >= 0 ? (pct + "%") : (onAc ? "AC" : "—");
            using (var kick = new SolidBrush(Color.FromArgb(230, accent)))
            using (var title = new SolidBrush(Color.FromArgb(236, 238, 242)))
            using (var mute = new SolidBrush(Color.FromArgb(130, 142, 156))) {
                g.DrawString("FOXOS", small, kick, isl.X + 24, isl.Y + 16);
                g.DrawString("battery", titleFont, title, isl.X + 24, isl.Y + 34);
                g.DrawString(head, small, mute, isl.X + 150, isl.Y + 44);
                g.DrawString(onAc ? "charging / AC" : "on battery", rowFont, title, isl.X + 24, isl.Y + 78);
                g.DrawString(line2, small, mute, isl.X + 24, isl.Y + 104);
            }
            QuickUi.DrawPill(g, CloseRect(), "x", small, night, accent, hoverBtn == 1, false);
            if (pct >= 0) {
                var tr = new Rectangle(isl.X + 24, isl.Y + 132, isl.Width - 48, 10);
                QuickUi.FillRound(g, tr, 5, Color.FromArgb(255, 7, 9, 16));
                int w = (int)(tr.Width * (pct / 100.0));
                if (w > 0) QuickUi.FillRound(g, new Rectangle(tr.X, tr.Y, Math.Max(6, w), tr.Height), 5, accent);
            }
            QuickUi.DrawPill(g, BrightRect(), "bright", small, night, accent, hoverBtn == 2, true);
            QuickUi.DrawPill(g, SaverRect(), "saver", small, night, accent, hoverBtn == 3, false);
        }

        protected override void Dispose(bool disposing) {
            if (disposing) { pulse.Stop(); pulse.Dispose(); titleFont.Dispose(); rowFont.Dispose(); small.Dispose(); }
            base.Dispose(disposing);
        }
    }

    // ── Bluetooth ───────────────────────────────────────────────────────────
    sealed class BluetoothBoard : Form {
        struct BtDev {
            public string Name;
            public string Status;
            public string Id;
        }

        readonly Font titleFont, rowFont, small;
        readonly System.Windows.Forms.Timer blink;
        Color night, accent;
        readonly List<BtDev> devices = new List<BtDev>();
        string status = "scanning…";
        int sel, scroll, hover = -1, hoverBtn;
        bool busy;
        bool caretOn = true;
        string filter = "";
        float popT = 1f;
        int restY;
        readonly QuickUi.SoftOut soft = new QuickUi.SoftOut();
        const int RowH = 40;
        const int Pad = 22;

        public BluetoothBoard(Color n, Color a) {
            night = n; accent = a;
            Text = "FoxOS Bluetooth";
            FormBorderStyle = FormBorderStyle.None;
            ShowInTaskbar = false; TopMost = true;
            StartPosition = FormStartPosition.Manual;
            DoubleBuffered = true;
            BackColor = QuickUi.Choke; TransparencyKey = QuickUi.Choke;
            Opacity = 0.94; Size = new Size(420, 500); KeyPreview = true;
            titleFont = new Font("Consolas", 22f, FontStyle.Bold, GraphicsUnit.Pixel);
            rowFont = new Font("Consolas", 14f, FontStyle.Regular, GraphicsUnit.Pixel);
            small = new Font("Consolas", 12f, FontStyle.Regular, GraphicsUnit.Pixel);
            blink = new System.Windows.Forms.Timer();
            blink.Interval = 16;
            blink.Tick += delegate {
                if (soft.Tick(this)) { Invalidate(); return; }
                bool dirty = false;
                if (popT < 1f) {
                    popT += 0.11f; if (popT > 1f) popT = 1f;
                    float ease = 1f - (1f - popT) * (1f - popT);
                    Top = restY + (int)((1f - ease) * 32f);
                    Opacity = 0.78 + 0.16 * ease;
                    dirty = true;
                }
                bool caret = ((Environment.TickCount / 480) % 2) == 0;
                if (caret != caretOn) { caretOn = caret; dirty = true; }
                if (dirty) Invalidate();
            };
            QuickUi.PlaceNearTray(this);
            blink.Start();
            RefreshAsync();
        }

        public void Recolor(Color n, Color a) { night = n; accent = a; Invalidate(); }

        public void SoftClose() {
            soft.Begin(this);
            if (!blink.Enabled) blink.Start();
        }

        public void Pop() {
            soft.Cancel();
            QuickUi.PlaceNearTray(this);
            restY = Top;
            if (!Visible) {
                popT = 0f; Top = restY + 32; Opacity = 0.78;
                Show(); Activate();
            } else { Activate(); BringToFront(); }
            RefreshAsync();
        }

        Rectangle Island() { return new Rectangle(10, 10, Width - 20, Height - 20); }
        int ListTop { get { return Island().Y + 140; } }
        int ListBottom { get { return Island().Bottom - 88; } }
        int VisibleRows { get { return Math.Max(1, (ListBottom - ListTop) / RowH); } }
        Rectangle CloseRect() { var i = Island(); return new Rectangle(i.Right - Pad - 30, i.Y + 16, 30, 30); }
        Rectangle RefreshRect() { var i = Island(); return new Rectangle(i.X + Pad, i.Y + 100, 100, 28); }
        Rectangle PairRect() { var i = Island(); return new Rectangle(i.X + Pad + 110, i.Y + 100, 100, 28); }
        Rectangle FilterRect() { var i = Island(); return new Rectangle(i.X + Pad, i.Y + 64, i.Width - Pad * 2, 28); }
        Rectangle DetailRect() { var i = Island(); return new Rectangle(i.X + Pad, i.Bottom - 78, i.Width - Pad * 2, 58); }
        Rectangle ActionRect() { var d = DetailRect(); return new Rectangle(d.Right - 118, d.Y + 14, 100, 28); }

        void RefreshAsync() {
            if (busy) return;
            busy = true; status = "scanning…"; Invalidate();
            System.Threading.ThreadPool.QueueUserWorkItem(delegate {
                var list = Scan();
                try {
                    BeginInvoke(new Action(delegate {
                        devices.Clear();
                        devices.AddRange(list);
                        if (sel >= devices.Count) sel = Math.Max(0, devices.Count - 1);
                        status = devices.Count == 0 ? "no devices" : (devices.Count + " devices");
                        busy = false; Invalidate();
                    }));
                } catch { busy = false; }
            });
        }

        static List<BtDev> Scan() {
            var list = new List<BtDev>();
            string raw = QuickUi.PsLines(
                "$ErrorActionPreference='SilentlyContinue';" +
                "Get-PnpDevice -Class Bluetooth | Where-Object { " +
                "  $_.FriendlyName -and $_.Present -and " +
                "  $_.Status -match 'OK|Error|Degraded' " +
                "} | ForEach-Object { $_.FriendlyName + '|' + $_.Status + '|' + $_.InstanceId }");
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (string line in (raw ?? "").Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries)) {
                string[] p = line.Split('|');
                if (p.Length < 2) continue;
                string name = p[0].Trim();
                if (!IsUsefulBt(name)) continue;
                if (seen.Contains(name)) continue;
                seen.Add(name);
                var d = new BtDev();
                d.Name = name;
                d.Status = p.Length > 1 ? p[1].Trim() : "";
                d.Id = p.Length > 2 ? p[2].Trim() : "";
                // skip pure radio/adapter instance junk
                string id = d.Id.ToUpperInvariant();
                if (id.IndexOf("BTHLE\\") >= 0 && name.IndexOf(' ') < 0) continue;
                list.Add(d);
            }
            list.Sort(delegate(BtDev a, BtDev b) {
                bool ao = a.Status.IndexOf("OK", StringComparison.OrdinalIgnoreCase) >= 0;
                bool bo = b.Status.IndexOf("OK", StringComparison.OrdinalIgnoreCase) >= 0;
                if (ao != bo) return ao ? -1 : 1;
                return string.Compare(a.Name, b.Name, StringComparison.OrdinalIgnoreCase);
            });
            return list;
        }

        static bool IsUsefulBt(string name) {
            if (string.IsNullOrEmpty(name) || name.Length < 2) return false;
            string u = name.ToUpperInvariant();
            string[] junk = {
                "BLUETOOTH", "MICROSOFT", "GENERIC", "ADAPTER", "RADIO", "ENUMERATOR",
                "TRANSPORT", "PROTOCOL", "SERVICE", "PROFILE", "RFCOMM", "AVRCP",
                "HANDSFREE AG", "AUDIO SINK", "AUDIO SOURCE", "PNP", "INTEL ", "REALTEK",
                "QUALCOMM", "MEDIATEK", "BROADCOM", "USB ", "ROOT HUB", "COMPOSITE",
                "ATTRIBUTE", "LE DEVICE", "BTHENUM", "VIRTUAL", "UNKNOWN DEVICE",
                "STANDARD SERIAL", "COM PORT", "HID-", "INPUT DEVICE"
            };
            for (int i = 0; i < junk.Length; i++) {
                if (u.IndexOf(junk[i]) >= 0) return false;
            }
            // must look like a real product name (has a letter)
            bool letter = false;
            for (int i = 0; i < name.Length; i++) {
                if (char.IsLetter(name[i])) { letter = true; break; }
            }
            return letter;
        }

        List<int> Filtered() {
            var idx = new List<int>();
            string q = (filter ?? "").Trim().ToLowerInvariant();
            for (int i = 0; i < devices.Count; i++) {
                if (q.Length == 0 || devices[i].Name.ToLowerInvariant().IndexOf(q) >= 0) idx.Add(i);
            }
            return idx;
        }

        void ActivateSel() {
            var idx = Filtered();
            if (sel < 0 || sel >= idx.Count) return;
            BtDev d = devices[idx[sel]];
            bool on = d.Status.IndexOf("OK", StringComparison.OrdinalIgnoreCase) >= 0;
            status = on ? "disabling…" : "enabling…";
            Invalidate();
            string id = d.Id.Replace("'", "''");
            string cmd = on
                ? ("Disable-PnpDevice -InstanceId '" + id + "' -Confirm:$false")
                : ("Enable-PnpDevice -InstanceId '" + id + "' -Confirm:$false");
            System.Threading.ThreadPool.QueueUserWorkItem(delegate {
                QuickUi.PsLines(cmd);
                System.Threading.Thread.Sleep(600);
                try { BeginInvoke(new Action(RefreshAsync)); } catch { }
            });
        }

        protected override bool ProcessCmdKey(ref Message msg, Keys keyData) {
            if (keyData == Keys.Escape) { SoftClose(); return true; }
            if (keyData == Keys.Enter) { ActivateSel(); return true; }
            if (keyData == Keys.F5) { RefreshAsync(); return true; }
            if (keyData == Keys.Up) { sel = Math.Max(0, sel - 1); Clamp(); Invalidate(); return true; }
            if (keyData == Keys.Down) { sel++; Clamp(); Invalidate(); return true; }
            if (keyData == Keys.Back) {
                if (filter.Length > 0) { filter = filter.Substring(0, filter.Length - 1); sel = 0; Invalidate(); }
                return true;
            }
            return base.ProcessCmdKey(ref msg, keyData);
        }

        protected override void OnKeyPress(KeyPressEventArgs e) {
            if (!char.IsControl(e.KeyChar) && filter.Length < 32) {
                filter += e.KeyChar; sel = 0; Invalidate(); e.Handled = true;
            }
            base.OnKeyPress(e);
        }

        void Clamp() {
            var idx = Filtered();
            if (sel >= idx.Count) sel = Math.Max(0, idx.Count - 1);
            int vis = VisibleRows;
            if (sel < scroll) scroll = sel;
            if (sel >= scroll + vis) scroll = sel - vis + 1;
            if (scroll < 0) scroll = 0;
        }

        protected override void OnMouseDown(MouseEventArgs e) {
            if (CloseRect().Contains(e.Location)) { SoftClose(); return; }
            if (RefreshRect().Contains(e.Location)) { RefreshAsync(); return; }
            if (PairRect().Contains(e.Location)) {
                try { Process.Start("ms-settings:bluetooth"); } catch { }
                return;
            }
            if (ActionRect().Contains(e.Location)) { ActivateSel(); return; }
            if (e.Y >= ListTop && e.Y < ListBottom) {
                int row = scroll + (e.Y - ListTop) / RowH;
                var idx = Filtered();
                if (row >= 0 && row < idx.Count) {
                    sel = row; Invalidate();
                    if (e.Clicks > 1) ActivateSel();
                }
            }
            base.OnMouseDown(e);
        }

        protected override void OnMouseMove(MouseEventArgs e) {
            int h = -1;
            if (e.Y >= ListTop && e.Y < ListBottom) h = scroll + (e.Y - ListTop) / RowH;
            int hb = 0;
            if (CloseRect().Contains(e.Location)) hb = 1;
            else if (RefreshRect().Contains(e.Location)) hb = 2;
            else if (PairRect().Contains(e.Location)) hb = 3;
            else if (ActionRect().Contains(e.Location)) hb = 4;
            if (h != hover || hb != hoverBtn) {
                hover = h; hoverBtn = hb;
                Cursor = hb != 0 ? Cursors.Hand : Cursors.Default;
                Invalidate();
            }
            base.OnMouseMove(e);
        }

        protected override void OnMouseWheel(MouseEventArgs e) {
            if (e.Delta > 0) sel = Math.Max(0, sel - 1); else sel++;
            Clamp(); Invalidate();
            base.OnMouseWheel(e);
        }

        protected override void OnPaint(PaintEventArgs e) {
            var g = e.Graphics;
            g.Clear(QuickUi.Choke);
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.ClearTypeGridFit;
            var isl = Island();
            QuickUi.DrawShell(g, isl, night, accent);
            using (var kick = new SolidBrush(Color.FromArgb(230, accent)))
            using (var title = new SolidBrush(Color.FromArgb(236, 238, 242)))
            using (var mute = new SolidBrush(Color.FromArgb(130, 142, 156))) {
                g.DrawString("FOXOS", small, kick, isl.X + Pad, isl.Y + 16);
                g.DrawString("bluetooth", titleFont, title, isl.X + Pad, isl.Y + 34);
                g.DrawString(status, small, mute, isl.X + Pad + 150, isl.Y + 44);
            }
            QuickUi.DrawPill(g, CloseRect(), "x", small, night, accent, hoverBtn == 1, false);
            string q = filter.Length > 0 ? ("> " + filter) : "> filter";
            if (caretOn) q += "_";
            QuickUi.FillRound(g, FilterRect(), 8, Color.FromArgb(255, 7, 9, 16));
            using (var ink = new SolidBrush(Color.FromArgb(210, 218, 228)))
                g.DrawString(q, small, ink, FilterRect().X + 10, FilterRect().Y + 6);
            QuickUi.DrawPill(g, RefreshRect(), busy ? "…" : "refresh", small, night, accent, hoverBtn == 2, false);
            QuickUi.DrawPill(g, PairRect(), "pair…", small, night, accent, hoverBtn == 3, false);

            var idx = Filtered();
            Clamp();
            int y = ListTop;
            using (var sf = (StringFormat)StringFormat.GenericTypographic.Clone()) {
                sf.LineAlignment = StringAlignment.Center;
                sf.Trimming = StringTrimming.EllipsisCharacter;
                for (int row = scroll; row < idx.Count && row < scroll + VisibleRows; row++) {
                    BtDev d = devices[idx[row]];
                    var box = new Rectangle(isl.X + Pad, y, isl.Width - Pad * 2 - 8, RowH - 6);
                    bool on = row == sel;
                    if (on) QuickUi.FillRound(g, box, 10, QuickUi.Wash(night, accent, 48));
                    else if (row == hover) QuickUi.FillRound(g, box, 10, QuickUi.Wash(night, accent, 22));
                    using (var ink = new SolidBrush(on ? Color.FromArgb(236, 238, 242) : Color.FromArgb(170, 180, 194)))
                        g.DrawString(d.Name, rowFont, ink, new RectangleF(box.X + 12, box.Y, box.Width - 90, box.Height), sf);
                    using (var st = new SolidBrush(Color.FromArgb(200, accent)))
                        g.DrawString(d.Status, small, st, new RectangleF(box.Right - 80, box.Y, 70, box.Height), sf);
                    y += RowH;
                }
                if (idx.Count == 0) {
                    using (var dim = new SolidBrush(Color.FromArgb(124, 140, 156)))
                        g.DrawString(busy ? "scanning…" : "no matches", rowFont, dim, isl.X + Pad, ListTop + 16);
                }
            }

            var detail = DetailRect();
            QuickUi.FillRound(g, detail, 12, Color.FromArgb(255, 6, 8, 14));
            using (var ink = new SolidBrush(Color.FromArgb(236, 238, 242)))
            using (var mute = new SolidBrush(Color.FromArgb(124, 140, 156))) {
                if (sel >= 0 && sel < idx.Count) {
                    BtDev d = devices[idx[sel]];
                    g.DrawString(d.Name, rowFont, ink, detail.X + 14, detail.Y + 10);
                    bool ok = d.Status.IndexOf("OK", StringComparison.OrdinalIgnoreCase) >= 0;
                    g.DrawString(ok ? "enter  disable" : "enter  enable", small, mute, detail.X + 14, detail.Y + 34);
                    QuickUi.DrawPill(g, ActionRect(), ok ? "disable" : "enable", small, night, accent, hoverBtn == 4, true);
                } else g.DrawString("pick a device", rowFont, mute, detail.X + 14, detail.Y + 18);
            }
        }

        protected override void Dispose(bool disposing) {
            if (disposing) { blink.Stop(); blink.Dispose(); titleFont.Dispose(); rowFont.Dispose(); small.Dispose(); }
            base.Dispose(disposing);
        }
    }

    // ── Life reminders / calendar ───────────────────────────────────────────
    sealed class ReminderBoard : Form {
        struct RemRow {
            public string Id;
            public string Text;
            public string Due;
            public bool Done;
        }

        readonly Font titleFont, rowFont, small;
        readonly System.Windows.Forms.Timer tick;
        Color night, accent;
        readonly List<RemRow> rows = new List<RemRow>();
        string status = "loading…";
        int sel, scroll, hover = -1, hoverBtn;
        float popT = 1f;
        int restY;
        readonly QuickUi.SoftOut soft = new QuickUi.SoftOut();
        const int RowH = 44;
        const int Pad = 22;

        public ReminderBoard(Color n, Color a) {
            night = n; accent = a;
            Text = "FoxOS Reminders";
            FormBorderStyle = FormBorderStyle.None;
            ShowInTaskbar = false; TopMost = true;
            StartPosition = FormStartPosition.Manual;
            DoubleBuffered = true;
            BackColor = QuickUi.Choke; TransparencyKey = QuickUi.Choke;
            Opacity = 0.94; Size = new Size(440, 520); KeyPreview = true;
            titleFont = new Font("Consolas", 22f, FontStyle.Bold, GraphicsUnit.Pixel);
            rowFont = new Font("Consolas", 14f, FontStyle.Regular, GraphicsUnit.Pixel);
            small = new Font("Consolas", 12f, FontStyle.Regular, GraphicsUnit.Pixel);
            tick = new System.Windows.Forms.Timer();
            tick.Interval = 16;
            tick.Tick += delegate {
                if (soft.Tick(this)) { Invalidate(); return; }
                if (popT < 1f) {
                    popT += 0.11f; if (popT > 1f) popT = 1f;
                    float ease = 1f - (1f - popT) * (1f - popT);
                    Top = restY + (int)((1f - ease) * 32f);
                    Opacity = 0.78 + 0.16 * ease;
                    Invalidate();
                } else tick.Stop();
            };
            QuickUi.PlaceNearTray(this);
            Reload();
        }

        public void Recolor(Color n, Color a) { night = n; accent = a; Invalidate(); }

        public void SoftClose() {
            soft.Begin(this);
            if (!tick.Enabled) tick.Start();
        }

        public void Pop() {
            soft.Cancel();
            QuickUi.PlaceNearTray(this);
            restY = Top;
            Reload();
            if (!Visible) {
                popT = 0f; Top = restY + 32; Opacity = 0.78;
                Show(); Activate(); tick.Start();
            } else { Activate(); BringToFront(); }
            Invalidate();
        }

        static string LifeRemindersPath() {
            string root = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            string apps = Path.Combine(root, "FoxTerminal", "foxos", "apps", "foxlife");
            string user = Environment.GetEnvironmentVariable("FOXTERM_USER");
            if (string.IsNullOrEmpty(user)) {
                try {
                    // walk user folders; prefer non-empty reminders
                    if (Directory.Exists(apps)) {
                        foreach (string dir in Directory.GetDirectories(apps)) {
                            string p = Path.Combine(dir, "reminders.json");
                            if (File.Exists(p)) return p;
                        }
                    }
                } catch { }
                user = "local";
            }
            return Path.Combine(apps, user.Trim(), "reminders.json");
        }

        void Reload() {
            rows.Clear();
            try {
                string path = LifeRemindersPath();
                if (!File.Exists(path)) { status = "no life data"; return; }
                string json = File.ReadAllText(path);
                foreach (Match block in Regex.Matches(json, "\\{[^{}]*\\}")) {
                    string o = block.Value;
                    string text = QuickUi.GrabJson(o, "text");
                    if (string.IsNullOrEmpty(text)) continue;
                    var r = new RemRow();
                    r.Id = QuickUi.GrabJson(o, "id");
                    r.Text = Unescape(text);
                    r.Due = QuickUi.GrabJson(o, "due");
                    string done = QuickUi.GrabJson(o, "done");
                    r.Done = done == "true" || done == "True";
                    rows.Add(r);
                }
                rows.Sort(delegate(RemRow a, RemRow b) {
                    if (a.Done != b.Done) return a.Done ? 1 : -1;
                    return string.Compare(a.Due ?? "", b.Due ?? "", StringComparison.Ordinal);
                });
                string today = DateTime.Now.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
                int due = 0;
                for (int i = 0; i < rows.Count; i++) {
                    if (!rows[i].Done && string.Compare(rows[i].Due ?? "", today, StringComparison.Ordinal) <= 0) due++;
                }
                status = rows.Count == 0 ? "empty" : (due + " due · " + rows.Count + " total");
            } catch {
                status = "read failed";
            }
            if (sel >= rows.Count) sel = Math.Max(0, rows.Count - 1);
        }

        static string Unescape(string s) {
            return (s ?? "").Replace("\\n", " ").Replace("\\\"", "\"").Replace("\\\\", "\\");
        }

        void ToggleDone() {
            if (sel < 0 || sel >= rows.Count) return;
            RemRow r = rows[sel];
            try {
                string path = LifeRemindersPath();
                if (!File.Exists(path)) return;
                string json = File.ReadAllText(path);
                // flip "done" nearest to this id/text
                string needle = !string.IsNullOrEmpty(r.Id) ? ("\"id\"\\s*:\\s*\"" + Regex.Escape(r.Id) + "\"") : ("\"text\"\\s*:\\s*\"" + Regex.Escape(r.Text.Replace("\"", "")) + "\"");
                var m = Regex.Match(json, needle + "[\\s\\S]{0,200}?\"done\"\\s*:\\s*(true|false)", RegexOptions.IgnoreCase);
                if (m.Success) {
                    string old = m.Value;
                    string neu = Regex.Replace(old, "\"done\"\\s*:\\s*(true|false)",
                        "\"done\": " + (r.Done ? "false" : "true"), RegexOptions.IgnoreCase);
                    json = json.Substring(0, m.Index) + neu + json.Substring(m.Index + m.Length);
                    File.WriteAllText(path, json, new UTF8Encoding(false));
                }
            } catch { }
            Reload();
            Invalidate();
        }

        void OpenLife() {
            try {
                string cmd = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "FoxTerminal"); // fallback
                // deskcmd-style: run foxlife.bat next to scripts if we can find it via PATH / known cmd
                string bat = null;
                string[] probes = {
                    Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "foxlife.bat"),
                    Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
                        "Desktop", "FireFoxBot", "cmd", "foxlife.bat"),
                };
                // also walk from foxos live state
                try {
                    string fox = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                        "FoxTerminal", "foxos");
                    // cmd dir often stored elsewhere — try sibling of known scripts via PATH is hard
                    string desk = Path.Combine(fox, "deskcmd-hint.txt");
                } catch { }
                foreach (string p in probes) if (File.Exists(p)) { bat = p; break; }
                if (bat != null) Process.Start(bat);
                else {
                    // write desk req for foxlife
                    string dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                        "FoxTerminal", "foxos");
                    Directory.CreateDirectory(dir);
                    File.WriteAllText(Path.Combine(dir, "desk.req"), "foxlife");
                }
            } catch { }
        }

        Rectangle Island() { return new Rectangle(10, 10, Width - 20, Height - 20); }
        int ListTop { get { return Island().Y + 100; } }
        int ListBottom { get { return Island().Bottom - 90; } }
        int VisibleRows { get { return Math.Max(1, (ListBottom - ListTop) / RowH); } }
        Rectangle CloseRect() { var i = Island(); return new Rectangle(i.Right - Pad - 30, i.Y + 16, 30, 30); }
        Rectangle LifeRect() { var i = Island(); return new Rectangle(i.X + Pad, i.Bottom - 52, 100, 30); }
        Rectangle DoneRect() { var i = Island(); return new Rectangle(i.X + Pad + 110, i.Bottom - 52, 110, 30); }

        protected override bool ProcessCmdKey(ref Message msg, Keys keyData) {
            if (keyData == Keys.Escape) { SoftClose(); return true; }
            if (keyData == Keys.Enter || keyData == Keys.Space) { ToggleDone(); return true; }
            if (keyData == Keys.F5) { Reload(); Invalidate(); return true; }
            if (keyData == Keys.Up) { sel = Math.Max(0, sel - 1); Clamp(); Invalidate(); return true; }
            if (keyData == Keys.Down) { sel++; Clamp(); Invalidate(); return true; }
            return base.ProcessCmdKey(ref msg, keyData);
        }

        void Clamp() {
            if (sel >= rows.Count) sel = Math.Max(0, rows.Count - 1);
            int vis = VisibleRows;
            if (sel < scroll) scroll = sel;
            if (sel >= scroll + vis) scroll = sel - vis + 1;
            if (scroll < 0) scroll = 0;
        }

        protected override void OnMouseDown(MouseEventArgs e) {
            if (CloseRect().Contains(e.Location)) { SoftClose(); return; }
            if (LifeRect().Contains(e.Location)) { OpenLife(); return; }
            if (DoneRect().Contains(e.Location)) { ToggleDone(); return; }
            if (e.Y >= ListTop && e.Y < ListBottom) {
                int row = scroll + (e.Y - ListTop) / RowH;
                if (row >= 0 && row < rows.Count) {
                    sel = row; Invalidate();
                    if (e.Clicks > 1) ToggleDone();
                }
            }
            base.OnMouseDown(e);
        }

        protected override void OnMouseMove(MouseEventArgs e) {
            int h = -1;
            if (e.Y >= ListTop && e.Y < ListBottom) h = scroll + (e.Y - ListTop) / RowH;
            int hb = 0;
            if (CloseRect().Contains(e.Location)) hb = 1;
            else if (LifeRect().Contains(e.Location)) hb = 2;
            else if (DoneRect().Contains(e.Location)) hb = 3;
            if (h != hover || hb != hoverBtn) {
                hover = h; hoverBtn = hb;
                Cursor = hb != 0 ? Cursors.Hand : Cursors.Default;
                Invalidate();
            }
            base.OnMouseMove(e);
        }

        protected override void OnMouseWheel(MouseEventArgs e) {
            if (e.Delta > 0) sel = Math.Max(0, sel - 1); else sel++;
            Clamp(); Invalidate();
            base.OnMouseWheel(e);
        }

        protected override void OnPaint(PaintEventArgs e) {
            var g = e.Graphics;
            g.Clear(QuickUi.Choke);
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.ClearTypeGridFit;
            var isl = Island();
            QuickUi.DrawShell(g, isl, night, accent);
            string today = DateTime.Now.ToString("ddd  d MMM", CultureInfo.CurrentCulture);
            using (var kick = new SolidBrush(Color.FromArgb(230, accent)))
            using (var title = new SolidBrush(Color.FromArgb(236, 238, 242)))
            using (var mute = new SolidBrush(Color.FromArgb(130, 142, 156))) {
                g.DrawString("FOXOS", small, kick, isl.X + Pad, isl.Y + 16);
                g.DrawString("calendar", titleFont, title, isl.X + Pad, isl.Y + 34);
                g.DrawString(today + "  ·  " + status, small, mute, isl.X + Pad, isl.Y + 68);
            }
            QuickUi.DrawPill(g, CloseRect(), "x", small, night, accent, hoverBtn == 1, false);

            Clamp();
            int y = ListTop;
            using (var sf = (StringFormat)StringFormat.GenericTypographic.Clone()) {
                sf.LineAlignment = StringAlignment.Center;
                sf.Trimming = StringTrimming.EllipsisCharacter;
                for (int row = scroll; row < rows.Count && row < scroll + VisibleRows; row++) {
                    RemRow r = rows[row];
                    var box = new Rectangle(isl.X + Pad, y, isl.Width - Pad * 2 - 8, RowH - 6);
                    bool on = row == sel;
                    if (on) QuickUi.FillRound(g, box, 10, QuickUi.Wash(night, accent, 48));
                    else if (row == hover) QuickUi.FillRound(g, box, 10, QuickUi.Wash(night, accent, 22));
                    using (var ink = new SolidBrush(r.Done
                        ? Color.FromArgb(110, 120, 132)
                        : (on ? Color.FromArgb(236, 238, 242) : Color.FromArgb(175, 186, 200))))
                        g.DrawString((r.Done ? "✓ " : "· ") + r.Text, rowFont, ink,
                            new RectangleF(box.X + 12, box.Y, box.Width - 100, box.Height), sf);
                    using (var due = new SolidBrush(Color.FromArgb(200, accent)))
                        g.DrawString(r.Due ?? "", small, due, new RectangleF(box.Right - 92, box.Y, 86, box.Height), sf);
                    y += RowH;
                }
                if (rows.Count == 0) {
                    using (var dim = new SolidBrush(Color.FromArgb(124, 140, 156)))
                        g.DrawString("no reminders — open life", rowFont, dim, isl.X + Pad, ListTop + 20);
                }
            }

            QuickUi.DrawPill(g, LifeRect(), "life", small, night, accent, hoverBtn == 2, true);
            QuickUi.DrawPill(g, DoneRect(), "toggle", small, night, accent, hoverBtn == 3, false);
            using (var mute = new SolidBrush(Color.FromArgb(120, 132, 148)))
                g.DrawString("enter toggle · esc close", small, mute, Island().X + Pad + 230, Island().Bottom - 44);
        }

        protected override void Dispose(bool disposing) {
            if (disposing) { tick.Stop(); tick.Dispose(); titleFont.Dispose(); rowFont.Dispose(); small.Dispose(); }
            base.Dispose(disposing);
        }
    }
}
