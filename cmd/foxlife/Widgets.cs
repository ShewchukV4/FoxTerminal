// Reusable painted widgets: icon cards, stat tiles, chip rows, nav/tab buttons.

using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;
using FoxOs.Sdk;

namespace FoxOs.Life {

    // White rounded card with a coloured icon badge and a title in the header.
    public class IconCard : Panel {
        public string Title = "";
        public string Glyph = "";
        public Color Tint;
        public string Caption = "";
        readonly FoxTheme t;

        public IconCard(FoxTheme theme) {
            t = theme;
            Tint = theme.Accent;
            BackColor = theme.Paper;
            FoxUi.Buffer(this);
        }

        public int HeaderBottom { get { return 56; } }

        protected override void OnPaint(PaintEventArgs e) {
            Graphics g = e.Graphics;
            g.Clear(Parent != null ? Parent.BackColor : t.Paper);
            FoxUi.PaintCard(g, new Rectangle(0, 0, Width - 1, Height - 1), t.Card, t.Line);
            FoxUi.PaintBadge(g, new Rectangle(16, 14, 30, 30), Tint, Glyph, t.Icon);
            using (SolidBrush ink = new SolidBrush(t.Ink))
            using (SolidBrush mute = new SolidBrush(t.Muted)) {
                g.DrawString(Title, t.Head, ink, 54, 15);
                if (!string.IsNullOrEmpty(Caption)) {
                    SizeF sz = g.MeasureString(Title, t.Head);
                    g.DrawString(Caption, t.Small, mute, 54 + sz.Width + 4, 20);
                }
            }
        }
    }

    // Small stat pill: caption + value tinted.
    public class StatPill : Control {
        public string Caption = "";
        public string Value = "";
        public Color Tint;
        public string Glyph = "";
        readonly FoxTheme t;

        public StatPill(FoxTheme theme) {
            t = theme;
            Tint = theme.Accent;
            FoxUi.Buffer(this);
        }

        protected override void OnPaint(PaintEventArgs e) {
            Graphics g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.Clear(Parent != null ? Parent.BackColor : t.Card);
            using (GraphicsPath path = FoxUi.Round(new Rectangle(0, 0, Width - 1, Height - 1), 12))
            using (SolidBrush bg = new SolidBrush(FoxTheme.Soft(Tint)))
            using (SolidBrush ink = new SolidBrush(Tint))
            using (SolidBrush mute = new SolidBrush(t.Muted)) {
                g.FillPath(bg, path);
                if (!string.IsNullOrEmpty(Glyph)) {
                    g.DrawString(Glyph, t.Icon, ink, 12, 12);
                    g.DrawString(Caption, t.Small, mute, 32, 11);
                } else {
                    g.DrawString(Caption, t.Small, mute, 12, 11);
                }
                g.DrawString(Value, t.Digits, ink, 10, 28);
            }
        }
    }

    // One reminder line: date chip + text + done tick.
    public class ReminderRow : Control {
        public ReminderDoc Item;
        public event EventHandler Done;
        public event EventHandler Edit;
        readonly FoxTheme t;
        bool hover;
        bool overTick;

        public ReminderRow(FoxTheme theme, ReminderDoc r) {
            t = theme;
            Item = r;
            Height = 34;
            Cursor = Cursors.Hand;
            FoxUi.Buffer(this);
        }

        protected override void OnPaint(PaintEventArgs e) {
            Graphics g = e.Graphics;
            g.Clear(Parent != null ? Parent.BackColor : t.Card);
            if (hover) {
                using (GraphicsPath p = FoxUi.Round(new Rectangle(0, 0, Width - 1, Height - 1), 8))
                using (SolidBrush b = new SolidBrush(t.Paper)) {
                    g.FillPath(b, p);
                }
            }
            bool ai = Item != null && Item.source == "ai";
            Color tint = ai ? t.Purple : t.Accent;
            string due = Item != null && Item.due != null && Item.due.Length >= 10
                ? Item.due.Substring(8, 2) + "." + Item.due.Substring(5, 2)
                : "";
            int x = 6;
            // Circle "tick" target on the left; fills in when hovered.
            g.SmoothingMode = SmoothingMode.AntiAlias;
            if (overTick) {
                using (SolidBrush fill = new SolidBrush(t.Good))
                using (Pen w = new Pen(Color.White, 2f)) {
                    g.FillEllipse(fill, x, 8, 16, 16);
                    g.DrawLine(w, x + 4, 16, x + 7, 19);
                    g.DrawLine(w, x + 7, 19, x + 12, 12);
                }
            } else {
                using (Pen p = new Pen(hover ? tint : t.Line, 1.5f)) {
                    g.DrawEllipse(p, x, 8, 16, 16);
                }
            }
            x += 26;
            x += FoxUi.PaintChip(g, x, 7, due, tint, t.Small, false) + 8;
            int right = ai ? Width - 30 : Width - 6;
            using (SolidBrush ink = new SolidBrush(t.Ink))
            using (StringFormat sf = new StringFormat()) {
                sf.Trimming = StringTrimming.EllipsisCharacter;
                sf.FormatFlags = StringFormatFlags.NoWrap;
                RectangleF box = new RectangleF(x, 8, Math.Max(10, right - x), Height - 10);
                g.DrawString(Item != null ? Item.text : "", t.Body, ink, box, sf);
            }
            if (ai) {
                using (SolidBrush mute = new SolidBrush(t.Purple)) {
                    g.DrawString("\uE945", t.Icon, mute, Width - 26, 10);
                }
            }
        }

        protected override void OnMouseEnter(EventArgs e) { hover = true; Invalidate(); }
        protected override void OnMouseLeave(EventArgs e) { hover = false; overTick = false; Invalidate(); }
        protected override void OnMouseMove(MouseEventArgs e) {
            bool now = e.X < 30;
            if (now != overTick) { overTick = now; Invalidate(); }
            Cursor = Cursors.Hand;
        }
        protected override void OnMouseClick(MouseEventArgs e) {
            base.OnMouseClick(e);
            if (e.Button != MouseButtons.Left) return;
            if (e.X < 30) {
                if (Done != null) Done(this, EventArgs.Empty);
            } else {
                if (Edit != null) Edit(this, EventArgs.Empty);
            }
        }
    }

    // Note row in the dashboard list: category dot + title + kind chip.
    public class NoteRow : Control {
        public NoteDoc Item;
        public bool Active;
        readonly FoxTheme t;
        bool hover;

        public NoteRow(FoxTheme theme, NoteDoc n) {
            t = theme;
            Item = n;
            Height = 40;
            Cursor = Cursors.Hand;
            FoxUi.Buffer(this);
        }

        protected override void OnPaint(PaintEventArgs e) {
            Graphics g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.PixelOffsetMode = PixelOffsetMode.HighQuality;
            g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.ClearTypeGridFit;
            g.Clear(Parent != null ? Parent.BackColor : t.Card);
            if (Active || hover) {
                using (GraphicsPath p = FoxUi.Round(new Rectangle(0, 0, Width - 1, Height - 1), 10))
                using (SolidBrush b = new SolidBrush(Active ? t.AccentSoft : t.Paper)) {
                    g.FillPath(b, p);
                }
                if (Active) {
                    using (GraphicsPath p = FoxUi.Round(new Rectangle(0, 0, Width - 1, Height - 1), 10))
                    using (Pen ring = new Pen(Color.FromArgb(80, t.Accent), 1.2f)) {
                        g.DrawPath(ring, p);
                    }
                }
            }
            Color c = t.ForCategory(Item != null ? Item.category : "");
            FoxUi.PaintDot(g, 12, 15, 10, c);
            using (SolidBrush ink = new SolidBrush(Active ? t.Accent : t.Ink))
            using (StringFormat sf = new StringFormat()) {
                sf.Trimming = StringTrimming.EllipsisCharacter;
                sf.FormatFlags = StringFormatFlags.NoWrap;
                g.DrawString(Item != null ? Item.title : "", Active ? t.Head : t.Body, ink,
                    new RectangleF(30, 10, Math.Max(10, Width - 62), 24), sf);
            }
            string kind = Item != null && Item.kind == "check" ? "\uE73A" : Item != null && Item.kind == "idea" ? "\uE82F" : "\uE70B";
            using (SolidBrush mute = new SolidBrush(t.Muted)) {
                g.DrawString(kind, t.Icon, mute, Width - 28, 12);
            }
        }

        protected override void OnMouseEnter(EventArgs e) { hover = true; Invalidate(); }
        protected override void OnMouseLeave(EventArgs e) { hover = false; Invalidate(); }
    }

    public class NavBtn : Control {
        public string Id;
        public bool Active;
        public Color Tint;
        readonly FoxTheme t;
        readonly string icon;
        bool hover;

        public NavBtn(FoxTheme theme, string id, string text, string glyph, Color tint) {
            t = theme;
            Id = id;
            Text = text;
            icon = glyph;
            Tint = tint;
            Cursor = Cursors.Hand;
            FoxUi.Buffer(this);
        }

        protected override void OnPaint(PaintEventArgs e) {
            Graphics g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.Clear(Parent != null ? Parent.BackColor : t.Sidebar);
            Rectangle r = new Rectangle(0, 0, Width - 1, Height - 1);
            if (Active) {
                using (GraphicsPath p = FoxUi.Round(r, 12))
                using (LinearGradientBrush b = new LinearGradientBrush(r, Tint, Blend(Tint, t.Accent), 0f)) {
                    g.FillPath(b, p);
                }
            } else if (hover) {
                using (GraphicsPath p = FoxUi.Round(r, 12))
                using (SolidBrush b = new SolidBrush(t.Paper)) {
                    g.FillPath(b, p);
                }
            }
            if (Active) {
                using (SolidBrush w = new SolidBrush(Color.White)) {
                    g.DrawString(icon, t.IconBig, w, 14, 12);
                    g.DrawString(Text, t.Head, w, 46, 12);
                }
            } else {
                FoxUi.PaintBadge(g, new Rectangle(8, 8, 28, 28), Tint, icon, t.Icon);
                using (SolidBrush ink = new SolidBrush(t.Ink)) {
                    g.DrawString(Text, t.Body, ink, 46, 13);
                }
            }
        }

        static Color Blend(Color a, Color b) {
            return Color.FromArgb((a.R + b.R) / 2, (a.G + b.G) / 2, (a.B + b.B) / 2);
        }

        protected override void OnMouseEnter(EventArgs e) { hover = true; Invalidate(); }
        protected override void OnMouseLeave(EventArgs e) { hover = false; Invalidate(); }
    }

    public class TabBtn : Control {
        public string Id;
        public bool Active;
        readonly FoxTheme t;
        readonly string icon;

        public TabBtn(FoxTheme theme, string id, string text, string glyph) {
            t = theme;
            Id = id;
            Text = text;
            icon = glyph;
            Cursor = Cursors.Hand;
            FoxUi.Buffer(this);
        }

        protected override void OnPaint(PaintEventArgs e) {
            Graphics g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.Clear(Parent != null ? Parent.BackColor : t.Paper);
            if (Active) {
                using (GraphicsPath p = FoxUi.Round(new Rectangle(0, 0, Width - 1, Height - 1), 10))
                using (SolidBrush b = new SolidBrush(t.Card))
                using (Pen line = new Pen(t.Line)) {
                    g.FillPath(b, p);
                    g.DrawPath(line, p);
                }
            }
            Color ink = Active ? t.Accent : t.Muted;
            using (SolidBrush b = new SolidBrush(ink))
            using (SolidBrush txt = new SolidBrush(Active ? t.Ink : t.Muted)) {
                g.DrawString(icon, t.Icon, b, 12, 9);
                g.DrawString(Text, Active ? t.Head : t.Body, txt, 34, 8);
            }
        }
    }

    // Dark tile with the real fox head plus a caption; used bottom-left in the sidebar.
    public class FoxHero : Control {
        public string Line1 = "";
        public string Line2 = "";
        readonly FoxTheme t;

        public FoxHero(FoxTheme theme) {
            t = theme;
            FoxUi.Buffer(this);
        }

        protected override void OnPaint(PaintEventArgs e) {
            Graphics g = e.Graphics;
            g.Clear(Parent != null ? Parent.BackColor : t.Sidebar);
            Rectangle r = new Rectangle(0, 0, Width - 1, Height - 1);
            g.SmoothingMode = SmoothingMode.AntiAlias;
            using (GraphicsPath p = FoxUi.Round(r, 16))
            using (LinearGradientBrush b = new LinearGradientBrush(r, t.Night, Color.FromArgb(38, 30, 60), 60f)) {
                g.FillPath(b, p);
            }
            int tile = Height - 24;
            FoxAssets.PaintFoxTile(g, new Rectangle(12, 12, tile, tile), Color.Transparent, 12);
            using (SolidBrush w = new SolidBrush(Color.White))
            using (SolidBrush dim = new SolidBrush(Color.FromArgb(170, 255, 255, 255))) {
                g.DrawString(Line1, t.Head, w, tile + 22, Height / 2 - 20);
                g.DrawString(Line2, t.Small, dim, tile + 22, Height / 2 + 2);
            }
        }
    }
}
