using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;
using FoxOs.Sdk;

namespace FoxOs.Life {

    // Settings: language, currency, AI mode/model, theme, explicit save / backup, demo reset.
    public class SettingsView : LifeView {
        readonly ComboBox lang = new ComboBox();
        readonly ComboBox currency = new ComboBox();
        readonly ComboBox ai = new ComboBox();
        readonly TextBox model = new TextBox();
        readonly Label about = new Label();
        readonly Panel swatches = new Panel();
        const int SwatchCols = 4;
        bool quiet;

        public SettingsView(ILifeHost host) : base(host) {
            Padding = new Padding(24);
            AutoScroll = true;

            about.AutoSize = false;
            about.Dock = DockStyle.Top;
            about.Height = 48;
            about.Font = T.Body;
            about.ForeColor = T.Muted;

            Panel form = new Panel();
            form.Dock = DockStyle.Top;
            form.Height = 520;
            form.BackColor = T.Paper;

            int y = 8;
            AddRow(form, ref y, I18n.T("set.lang"), lang = FoxUi.Combo(T));
            lang.Items.AddRange(new object[] { "Українська", "English" });
            lang.SelectedIndexChanged += delegate { if (!quiet) ApplyLang(); };

            AddRow(form, ref y, I18n.T("set.currency"), currency = FoxUi.Combo(T));
            currency.Items.AddRange(new object[] { "UAH", "USD", "EUR" });
            currency.SelectedIndexChanged += delegate { if (!quiet) ApplyMeta(); };

            AddRow(form, ref y, I18n.T("set.ai"), ai = FoxUi.Combo(T));
            ai.Items.AddRange(new object[] { I18n.T("ai.auto"), I18n.T("ai.onlylocal"), I18n.T("ai.onlyollama") });
            ai.SelectedIndexChanged += delegate { if (!quiet) ApplyMeta(); };

            AddRow(form, ref y, I18n.T("set.model"), model = FoxUi.Field(T));
            model.Leave += delegate { if (!quiet) ApplyMeta(); };

            // Theme: a row of clickable swatches, each previewing paper/card/accent.
            Label tl = FoxUi.Label(T, I18n.T("set.theme"), T.Small, T.Muted);
            tl.Location = new Point(0, y);
            form.Controls.Add(tl);
            swatches.Location = new Point(180, y - 6);
            int rows = (FoxTheme.Ids.Length + SwatchCols - 1) / SwatchCols;
            swatches.Size = new Size(SwatchCols * 96, rows * 96);
            swatches.BackColor = T.Paper;
            BuildSwatches();
            form.Controls.Add(swatches);
            y += rows * 96 + 12;

            // Persistence actions.
            Button save = FoxUi.Button(T, I18n.T("set.save"), true);
            save.Location = new Point(180, y);
            save.Width = 220;
            save.Click += delegate { Host.SaveAll(); };
            form.Controls.Add(save);

            Button backup = FoxUi.Button(T, I18n.T("set.backup"), false);
            backup.Location = new Point(410, y);
            backup.Width = 160;
            backup.Click += delegate {
                try {
                    string dir = Host.Store.Backup();
                    Host.Toast(I18n.T("set.backup.done"));
                    about.Text = I18n.T("set.backup.done") + ": " + dir;
                } catch (Exception ex) {
                    MessageBox.Show(ex.Message, I18n.T("set.backup"), MessageBoxButtons.OK, MessageBoxIcon.Warning);
                }
            };
            form.Controls.Add(backup);
            y += 44;

            // Demo data: destructive, so ask first.
            Button seed = FoxUi.Button(T, I18n.T("set.reseed"), false);
            seed.Location = new Point(180, y);
            seed.Width = 220;
            seed.ForeColor = T.Danger;
            seed.Click += delegate {
                DialogResult r = MessageBox.Show(I18n.T("set.reseed.ask"), I18n.T("set.reseed"),
                    MessageBoxButtons.YesNo, MessageBoxIcon.Warning, MessageBoxDefaultButton.Button2);
                if (r != DialogResult.Yes) return;
                Host.Store.Backup();
                Host.Store.Reseed();
                Host.Toast(I18n.T("set.reseed"));
                Host.DataChanged("all");
                Host.ReloadUi();
            };
            form.Controls.Add(seed);

            Controls.Add(form);
            Controls.Add(about);
        }

        void AddRow(Panel p, ref int y, string label, Control field) {
            Label l = FoxUi.Label(T, label, T.Small, T.Muted);
            l.Location = new Point(0, y);
            field.Location = new Point(180, y - 2);
            field.Width = 240;
            p.Controls.Add(l);
            p.Controls.Add(field);
            y += 40;
        }

        void BuildSwatches() {
            swatches.Controls.Clear();
            bool ua = I18n.Lang != "en";
            string current = Host.Store.Data.meta.theme;
            if (string.IsNullOrEmpty(current)) current = "default";
            for (int i = 0; i < FoxTheme.Ids.Length; i++) {
                string id = FoxTheme.Ids[i];
                ThemeSwatch s = new ThemeSwatch(T, id, FoxTheme.Label(id, ua));
                s.Location = new Point((i % SwatchCols) * 96, (i / SwatchCols) * 96);
                s.Size = new Size(88, 88);
                s.Active = id == current;
                s.Click += delegate { ApplyTheme(id); };
                swatches.Controls.Add(s);
            }
        }

        public override void Bind() {
            quiet = true;
            about.Text = I18n.T("set.about") + "\n" + I18n.T("set.user") + ": " + FoxPaths.CurrentUser()
                + "   ·   " + Host.Store.Root;
            LifeMeta m = Host.Store.Data.meta;
            lang.SelectedIndex = m.lang == "en" ? 1 : 0;
            currency.SelectedIndex = m.currency == "USD" ? 1 : m.currency == "EUR" ? 2 : 0;
            if (m.aiMode == "local") ai.SelectedIndex = 1;
            else if (m.aiMode == "ollama") ai.SelectedIndex = 2;
            else ai.SelectedIndex = 0;
            model.Text = string.IsNullOrEmpty(m.model) ? "gemma3:1b" : m.model;
            quiet = false;
        }

        void ApplyLang() {
            Host.Store.Data.meta.lang = lang.SelectedIndex == 1 ? "en" : "ua";
            Host.Store.SaveMeta();
            I18n.Use(Host.Store.Data.meta.lang);
            Host.ReloadUi();
        }

        void ApplyTheme(string id) {
            Host.Store.Data.meta.theme = id;
            Host.Store.SaveMeta();
            Host.ReloadUi();     // rebuilds chrome and views with the new FoxTheme
        }

        void ApplyMeta() {
            LifeMeta m = Host.Store.Data.meta;
            m.currency = currency.SelectedItem != null ? currency.SelectedItem.ToString() : "UAH";
            if (ai.SelectedIndex == 1) m.aiMode = "local";
            else if (ai.SelectedIndex == 2) m.aiMode = "ollama";
            else m.aiMode = "auto";
            m.model = model.Text.Trim();
            Host.Store.SaveMeta();
            Host.DataChanged("settings");
        }
    }

    // Mini preview of a theme: paper background, a card, an accent bar, name below.
    public class ThemeSwatch : Control {
        public bool Active;
        readonly FoxTheme ui;      // theme of the settings page (for label/ring colours)
        readonly FoxTheme preview; // the theme being previewed
        bool hover;

        public ThemeSwatch(FoxTheme ui, string id, string name) {
            this.ui = ui;
            // Named() flips the shared SoftBase; restore it for the active UI afterwards.
            preview = FoxTheme.Named(id);
            FoxTheme.SoftBase = ui.Dark ? ui.Card : Color.White;
            Text = name;
            Cursor = Cursors.Hand;
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer
                | ControlStyles.UserPaint | ControlStyles.ResizeRedraw, true);
        }

        protected override void OnPaint(PaintEventArgs e) {
            Graphics g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.Clear(ui.Paper);
            Rectangle tile = new Rectangle(0, 0, Width - 1, Height - 26);
            using (GraphicsPath p = FoxUi.Round(tile, 10))
            using (SolidBrush paper = new SolidBrush(preview.Paper))
            using (Pen ring = new Pen(Active ? ui.Accent : (hover ? ui.Muted : ui.Line), Active ? 2f : 1f)) {
                g.FillPath(paper, p);
                g.DrawPath(ring, p);
            }
            // sidebar strip + card + accent bar
            using (SolidBrush side = new SolidBrush(preview.Sidebar))
            using (SolidBrush card = new SolidBrush(preview.Card))
            using (SolidBrush acc = new SolidBrush(preview.Accent))
            using (SolidBrush ink = new SolidBrush(preview.Ink))
            using (Pen line = new Pen(preview.Line)) {
                g.FillRectangle(side, 6, 6, 18, tile.Height - 12);
                Rectangle c = new Rectangle(30, 10, tile.Width - 38, 22);
                using (GraphicsPath cp = FoxUi.Round(c, 6)) { g.FillPath(card, cp); g.DrawPath(line, cp); }
                Rectangle c2 = new Rectangle(30, 36, tile.Width - 38, 18);
                using (GraphicsPath cp = FoxUi.Round(c2, 6)) { g.FillPath(card, cp); g.DrawPath(line, cp); }
                g.FillRectangle(acc, 34, 15, 10, 10);
                g.FillRectangle(ink, 48, 17, tile.Width - 62, 3);
                g.FillRectangle(acc, 34, 42, tile.Width - 46, 6);
            }
            using (SolidBrush label = new SolidBrush(Active ? ui.Ink : ui.Muted)) {
                StringFormat sf = new StringFormat();
                sf.Alignment = StringAlignment.Center;
                sf.Trimming = StringTrimming.EllipsisCharacter;
                sf.FormatFlags = StringFormatFlags.NoWrap;
                g.DrawString(Text, ui.Small, label, new RectangleF(-4, Height - 22, Width + 8, 20), sf);
            }
        }

        protected override void OnMouseEnter(EventArgs e) { hover = true; Invalidate(); }
        protected override void OnMouseLeave(EventArgs e) { hover = false; Invalidate(); }
    }
}
