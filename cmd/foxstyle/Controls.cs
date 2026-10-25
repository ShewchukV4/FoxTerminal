using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;
using FoxOs.Sdk;

namespace FoxOs.Style {

    public class StyleNav : Control {
        public string Id;
        public string Title;
        public string Glyph;
        public bool Active;
        public event EventHandler Chosen;
        readonly FoxTheme t;
        bool hover;

        public StyleNav(FoxTheme theme, string id, string title, string glyph) {
            t = theme; Id = id; Title = title; Glyph = glyph;
            Height = 40; Cursor = Cursors.Hand; FoxUi.Buffer(this);
        }

        protected override void OnPaint(PaintEventArgs e) {
            Graphics g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.Clear(Parent != null ? Parent.BackColor : t.Sidebar);
            Rectangle r = new Rectangle(6, 2, Width - 12, Height - 4);
            if (Active || hover) {
                using (GraphicsPath p = FoxUi.Round(r, 10))
                using (SolidBrush b = new SolidBrush(Active ? t.AccentSoft : Color.FromArgb(28, t.Ink))) {
                    g.FillPath(b, p);
                }
            }
            if (Active) {
                using (SolidBrush a = new SolidBrush(t.Accent)) {
                    g.FillRectangle(a, 6, 10, 3, Height - 20);
                }
            }
            using (SolidBrush ink = new SolidBrush(Active ? t.Accent : (hover ? t.Ink : t.Muted))) {
                g.DrawString(Glyph, t.Icon, ink, 16, 10);
                g.DrawString(Title, t.Body, ink, 42, 11);
            }
        }

        protected override void OnMouseEnter(EventArgs e) { hover = true; Invalidate(); }
        protected override void OnMouseLeave(EventArgs e) { hover = false; Invalidate(); }
        protected override void OnClick(EventArgs e) {
            base.OnClick(e);
            if (Chosen != null) Chosen(this, EventArgs.Empty);
        }
    }

    public class PresetCard : Control {
        public string PresetId;
        public string Title;
        public Color A, B, Win;
        public bool Selected;
        public event EventHandler Chosen;
        readonly FoxTheme t;
        bool hover;

        public PresetCard(FoxTheme theme, string id, string title, Color a, Color b, Color win) {
            t = theme; PresetId = id; Title = title; A = a; B = b; Win = win;
            Size = new Size(148, 108); Cursor = Cursors.Hand; FoxUi.Buffer(this);
        }

        protected override void OnPaint(PaintEventArgs e) {
            Graphics g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.Clear(Parent != null ? Parent.BackColor : t.Paper);
            Rectangle r = new Rectangle(0, 0, Width - 1, Height - 1);
            using (GraphicsPath path = FoxUi.Round(r, 12))
            using (LinearGradientBrush bg = new LinearGradientBrush(r, A, B, 135f))
            using (Pen edge = new Pen(Selected ? t.Accent : (hover ? t.Line : Color.FromArgb(40, 255, 255, 255)), Selected ? 2f : 1f)) {
                g.FillPath(bg, path);
                Rectangle win = new Rectangle(18, 22, 72, 42);
                using (GraphicsPath wp = FoxUi.Round(win, 6))
                using (SolidBrush wb = new SolidBrush(Win)) {
                    g.FillPath(wb, wp);
                }
                g.DrawPath(edge, path);
            }
            using (SolidBrush ink = new SolidBrush(Color.FromArgb(230, 255, 255, 255))) {
                g.DrawString(Title, t.Small, ink, 12, Height - 26);
            }
            if (Selected) {
                using (SolidBrush d = new SolidBrush(t.Accent)) {
                    g.FillEllipse(d, Width - 22, 8, 12, 12);
                }
            }
        }

        protected override void OnMouseEnter(EventArgs e) { hover = true; Invalidate(); }
        protected override void OnMouseLeave(EventArgs e) { hover = false; Invalidate(); }
        protected override void OnClick(EventArgs e) {
            base.OnClick(e);
            if (Chosen != null) Chosen(this, EventArgs.Empty);
        }
    }

    public class StyleSlider : Panel {
        public string Caption;
        public string Hint;
        public int Min = 0, Max = 100, Value = 50;
        public event EventHandler Changed;
        readonly FoxTheme t;
        readonly TrackBar bar;
        readonly Label val;

        public StyleSlider(FoxTheme theme, string caption, string hint, int min, int max, int value) {
            t = theme; Caption = caption; Hint = hint; Min = min; Max = max; Value = value;
            Height = 56; BackColor = Color.Transparent;
            Label title = FoxUi.Label(t, caption, t.Body, t.Ink);
            title.Location = new Point(0, 4);
            Controls.Add(title);
            if (!string.IsNullOrEmpty(hint)) {
                Label h = FoxUi.Label(t, hint, t.Small, t.Muted);
                h.Location = new Point(0, 22);
                Controls.Add(h);
            }
            bar = new TrackBar();
            bar.Minimum = min; bar.Maximum = max; bar.Value = Math.Max(min, Math.Min(max, value));
            bar.TickStyle = TickStyle.None;
            bar.AutoSize = false;
            bar.Height = 28;
            bar.Width = 180;
            bar.BackColor = t.Card;
            bar.ValueChanged += delegate {
                Value = bar.Value;
                val.Text = Value.ToString();
                if (Changed != null) Changed(this, EventArgs.Empty);
            };
            Controls.Add(bar);
            val = FoxUi.Label(t, Value.ToString(), t.Small, t.Muted);
            Controls.Add(val);
            Resize += LayoutNow;
            LayoutNow(null, null);
        }

        void LayoutNow(object s, EventArgs e) {
            bar.Location = new Point(Width - 220, 12);
            val.Location = new Point(Width - 36, 18);
        }

        public void SetValue(int v) {
            v = Math.Max(Min, Math.Min(Max, v));
            if (bar.Value != v) bar.Value = v;
            Value = v;
            val.Text = v.ToString();
        }
    }

    public class StyleToggle : Panel {
        public string Caption;
        public string Hint;
        public bool On;
        public event EventHandler Changed;
        readonly FoxTheme t;
        readonly CheckBox box;

        public StyleToggle(FoxTheme theme, string caption, string hint, bool on) {
            t = theme; Caption = caption; Hint = hint; On = on;
            Height = 48; BackColor = Color.Transparent;
            Label title = FoxUi.Label(t, caption, t.Body, t.Ink);
            title.Location = new Point(0, 4);
            Controls.Add(title);
            if (!string.IsNullOrEmpty(hint)) {
                Label h = FoxUi.Label(t, hint, t.Small, t.Muted);
                h.Location = new Point(0, 22);
                Controls.Add(h);
            }
            box = new CheckBox();
            box.Appearance = Appearance.Button;
            box.FlatStyle = FlatStyle.Flat;
            box.FlatAppearance.BorderSize = 0;
            box.Text = on ? "ON" : "OFF";
            box.Checked = on;
            box.Size = new Size(52, 26);
            box.TextAlign = ContentAlignment.MiddleCenter;
            box.Cursor = Cursors.Hand;
            PaintBox();
            box.CheckedChanged += delegate {
                On = box.Checked;
                box.Text = On ? "ON" : "OFF";
                PaintBox();
                if (Changed != null) Changed(this, EventArgs.Empty);
            };
            Controls.Add(box);
            Resize += delegate { box.Location = new Point(Width - 56, 10); };
            box.Location = new Point(Width - 56, 10);
        }

        void PaintBox() {
            if (On) {
                box.BackColor = t.Accent;
                box.ForeColor = Color.White;
            } else {
                box.BackColor = t.Line;
                box.ForeColor = t.Muted;
            }
        }

        public void SetOn(bool v) {
            if (box.Checked != v) box.Checked = v;
            On = v;
        }
    }

    public class ChoiceRow : Panel {
        public string Caption;
        public string[] Options;
        public string Value;
        public event EventHandler Changed;
        readonly FoxTheme t;
        readonly Button[] btns;

        public ChoiceRow(FoxTheme theme, string caption, string[] options, string value) {
            t = theme; Caption = caption; Options = options; Value = value;
            Height = 52; BackColor = Color.Transparent;
            Label title = FoxUi.Label(t, caption, t.Body, t.Ink);
            title.Location = new Point(0, 14);
            Controls.Add(title);
            btns = new Button[options.Length];
            for (int i = 0; i < options.Length; i++) {
                Button b = FoxUi.Button(t, options[i], false);
                b.Tag = options[i];
                b.Width = 72;
                b.Height = 28;
                string opt = options[i];
                b.Click += delegate {
                    Value = opt;
                    Sync();
                    if (Changed != null) Changed(this, EventArgs.Empty);
                };
                btns[i] = b;
                Controls.Add(b);
            }
            Resize += LayoutNow;
            LayoutNow(null, null);
            Sync();
        }

        void LayoutNow(object s, EventArgs e) {
            int x = Width - 8;
            for (int i = btns.Length - 1; i >= 0; i--) {
                x -= btns[i].Width + 6;
                btns[i].Location = new Point(x, 12);
            }
        }

        void Sync() {
            for (int i = 0; i < btns.Length; i++) {
                bool on = string.Equals(btns[i].Tag as string, Value, StringComparison.OrdinalIgnoreCase);
                btns[i].BackColor = on ? t.Accent : t.Card;
                btns[i].ForeColor = on ? Color.White : t.Ink;
            }
        }

        public void SetValue(string v) {
            Value = v;
            Sync();
        }
    }
}
