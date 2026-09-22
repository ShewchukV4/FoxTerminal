// FOXOS Life chrome: white sidebar with the fox, tabbed top bar, card pages, AI rail.

using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Globalization;
using System.Windows.Forms;
using FoxOs.Sdk;

namespace FoxOs.Life {

    public class Shell : Form, ILifeHost {
        public FoxTheme Theme { get; private set; }
        public LifeStore Store { get; private set; }
        public AiEngine Ai { get; private set; }

        readonly Panel sidebar = new Panel();
        readonly Panel top = new Panel();
        readonly Panel content = new Panel();
        readonly Panel dock = new Panel();
        readonly Panel chartCard = new Panel();
        readonly Label insight = new Label();
        readonly Panel remList = new Panel();
        readonly Label noteSum = new Label();
        readonly Label tip = new Label();
        readonly Label aiMeta = new Label();
        readonly List<NavBtn> nav = new List<NavBtn>();
        readonly List<TabBtn> tabs = new List<TabBtn>();
        FoxHero hero;
        DashboardView dash;
        NotesView notes;
        FinanceView finance;
        TablesView tables;
        StatsView stats;
        SettingsView settings;
        string page = "dash";
        Timer pulse;
        List<KeyValuePair<string, double>> bars = new List<KeyValuePair<string, double>>();
        double monthIncome;
        double monthExpense;

        public Shell() {
            Store = new LifeStore();
            I18n.Use(Store.Data.meta.lang);
            Theme = FoxTheme.Named(Store.Data.meta.theme);
            Ai = new AiEngine(Store);

            Text = I18n.T("app.title");
            StartPosition = FormStartPosition.CenterScreen;
            MinimumSize = new Size(1180, 720);
            Size = new Size(1380, 860);
            BackColor = Theme.Paper;
            ForeColor = Theme.Ink;
            Font = Theme.Body;
            DoubleBuffered = true;
            KeyPreview = true;

            BuildChrome();
            ShowPage("dash");
            Shown += delegate {
                RefreshAiAsync();
                Ai.ToastDue();
            };

            pulse = new Timer();
            pulse.Interval = 60000;
            pulse.Tick += delegate { Ai.ToastDue(); };
            pulse.Start();
            KeyDown += OnKeys;
        }

        // ── chrome ───────────────────────────────────────────────

        void BuildChrome() {
            sidebar.Dock = DockStyle.Left;
            sidebar.Width = 232;
            sidebar.BackColor = Theme.Sidebar;
            sidebar.Paint += PaintSidebar;
            FoxUi.Buffer(sidebar);

            dock.Dock = DockStyle.Right;
            dock.Width = 328;
            dock.BackColor = Theme.Paper;
            dock.AutoScroll = true;
            FoxUi.Buffer(dock);
            BuildDock();

            top.Dock = DockStyle.Top;
            top.Height = 64;
            top.BackColor = Theme.Paper;
            top.Paint += PaintTop;
            top.Resize += delegate { top.Invalidate(); }; // date chip is right-aligned; repaint fully on resize
            FoxUi.Buffer(top);

            content.Dock = DockStyle.Fill;
            content.BackColor = Theme.Paper;
            content.Padding = new Padding(12, 4, 4, 12);

            Controls.Add(content);
            Controls.Add(top);
            Controls.Add(dock);
            Controls.Add(sidebar);

            BuildNav();
            BuildTabs();
        }

        void BuildNav() {
            sidebar.Controls.Clear();
            nav.Clear();

            string[] ids = new[] { "dash", "finance", "tables", "stats", "settings" };
            string[] keys = new[] { "nav.notes", "nav.finance", "nav.tables", "nav.stats", "nav.settings" };
            string[] icons = new[] { "\uE70B", "\uE825", "\uE80A", "\uE9D2", "\uE713" };
            Color[] tints = new[] { Theme.Accent, Theme.Good, Theme.Orange, Theme.Purple, Theme.Muted };
            for (int i = 0; i < ids.Length; i++) {
                NavBtn b = new NavBtn(Theme, ids[i], I18n.T(keys[i]), icons[i], tints[i]);
                b.Location = new Point(16, 84 + i * 50);
                b.Size = new Size(200, 44);
                string id = ids[i];
                b.Click += delegate { ShowPage(id); };
                nav.Add(b);
                sidebar.Controls.Add(b);
            }

            hero = new FoxHero(Theme);
            hero.Size = new Size(200, 96);
            hero.Line1 = "FOXOS Life";
            string user = Environment.GetEnvironmentVariable("FOXTERM_USER");
            hero.Line2 = string.IsNullOrEmpty(user) ? DateTime.Now.ToString("ddd, d MMM", CultureInfo.CurrentCulture) : user;
            hero.Location = new Point(16, sidebar.Height - 116);
            sidebar.Resize += delegate { hero.Location = new Point(16, sidebar.Height - 116); };
            sidebar.Controls.Add(hero);
        }

        void BuildTabs() {
            top.Controls.Clear();
            tabs.Clear();
            string[] ids = new[] { "dash", "finance", "tables" };
            string[] keys = new[] { "dash.notes", "dash.finance", "dash.tables" };
            string[] icons = new[] { "\uE70B", "\uE825", "\uE80A" };
            for (int i = 0; i < ids.Length; i++) {
                TabBtn t = new TabBtn(Theme, ids[i], I18n.T(keys[i]), icons[i]);
                t.Location = new Point(12 + i * 152, 14);
                t.Size = new Size(144, 36);
                string id = ids[i];
                t.Click += delegate { ShowPage(id); };
                tabs.Add(t);
                top.Controls.Add(t);
            }
        }

        void PaintSidebar(object sender, PaintEventArgs e) {
            Graphics g = e.Graphics;
            g.Clear(Theme.Sidebar);
            using (Pen p = new Pen(Theme.Line)) {
                g.DrawLine(p, sidebar.Width - 1, 0, sidebar.Width - 1, sidebar.Height);
            }
            // Brand: fox avatar tile + wordmark.
            FoxAssets.PaintFoxTile(g, new Rectangle(16, 18, 40, 40), Theme.Night, 12);
            using (SolidBrush ink = new SolidBrush(Theme.Ink))
            using (SolidBrush mute = new SolidBrush(Theme.Muted)) {
                g.DrawString(I18n.T("app.title"), Theme.Title, ink, 62, 14);
                g.DrawString(I18n.T("app.sub"), Theme.Small, mute, 66, 42);
            }
        }

        void PaintTop(object sender, PaintEventArgs e) {
            Graphics g = e.Graphics;
            g.Clear(Theme.Paper);
            using (Pen p = new Pen(Theme.Line)) {
                g.DrawLine(p, 0, top.Height - 1, top.Width, top.Height - 1);
            }
            // Right side: date chip + AI status.
            string date = DateTime.Now.ToString("dddd, d MMMM", CultureInfo.CurrentCulture);
            SizeF sz = g.MeasureString(date, Theme.Small);
            int x = top.Width - (int)sz.Width - 40;
            FoxUi.PaintChip(g, x, 20, date, Theme.Accent, Theme.Small, false);
        }

        // ── AI rail ──────────────────────────────────────────────

        void BuildDock() {
            dock.Controls.Clear();
            int y = 18;
            int w = 296;

            Panel head = new Panel();
            head.Location = new Point(12, y);
            head.Size = new Size(w, 40);
            head.BackColor = Theme.Paper;
            FoxUi.Buffer(head);
            head.Paint += delegate(object s, PaintEventArgs e) {
                FoxUi.PaintBadge(e.Graphics, new Rectangle(0, 4, 32, 32), Theme.Purple, "\uE945", Theme.IconBig);
                using (SolidBrush ink = new SolidBrush(Theme.Ink)) {
                    e.Graphics.DrawString(I18n.T("ai.title"), Theme.Head, ink, 42, 10);
                }
            };
            dock.Controls.Add(head);
            aiMeta.Location = new Point(w - 90, y + 12);
            aiMeta.Size = new Size(100, 18);
            aiMeta.Font = Theme.Small;
            aiMeta.ForeColor = Theme.Muted;
            aiMeta.TextAlign = ContentAlignment.MiddleRight;
            aiMeta.BackColor = Theme.Paper;
            dock.Controls.Add(aiMeta);
            y += 54;

            IconCard chartWrap = new IconCard(Theme);
            chartWrap.Title = I18n.T("ai.month");
            chartWrap.Glyph = "\uE9D2";
            chartWrap.Tint = Theme.Accent;
            chartWrap.Location = new Point(12, y);
            chartWrap.Size = new Size(w, 214);
            chartCard.Location = new Point(12, 52);
            chartCard.Size = new Size(w - 24, 150);
            chartCard.BackColor = Theme.Card;
            FoxUi.Buffer(chartCard);
            chartCard.Paint += PaintChart;
            chartWrap.Controls.Add(chartCard);
            dock.Controls.Add(chartWrap);
            y += 226;

            y = AddRailCard(I18n.T("st.month"), "\uE8FA", Theme.Good, insight, y, 96);

            IconCard remCard = new IconCard(Theme);
            remCard.Title = I18n.T("rem.title");
            remCard.Glyph = "\uE823";
            remCard.Tint = Theme.Orange;
            remCard.Location = new Point(12, y);
            remCard.Size = new Size(w, 160);
            remList.Location = new Point(10, 52);
            remList.Size = new Size(w - 20, 98);
            remList.BackColor = Theme.Card;
            remList.AutoScroll = true;
            remCard.Controls.Add(remList);
            Button addRem = FoxUi.Button(Theme, "\uE710", false);
            addRem.Font = Theme.Icon;
            addRem.ForeColor = Theme.Orange;
            addRem.Padding = new Padding(0);
            addRem.TextAlign = ContentAlignment.MiddleCenter;
            addRem.Size = new Size(30, 28);
            addRem.Location = new Point(w - 44, 15);
            addRem.Click += delegate {
                ReminderDoc r = LifeDialog.AskRem(this);
                if (r == null) return;
                Store.Data.reminders.Add(r);
                Store.SaveReminders();
                FoxToast.Show(r.text);
                FillReminders();
                if (dash != null && page == "dash") dash.Bind();
            };
            remCard.Controls.Add(addRem);
            dock.Controls.Add(remCard);
            y += 172;

            y = AddRailCard(I18n.T("ai.notesum"), "\uE70B", Theme.Accent, noteSum, y, 110);
            y = AddRailCard(I18n.T("ai.tip"), "\uE82F", Theme.Warn, tip, y, 110);
        }

        int AddRailCard(string title, string glyph, Color tint, Label body, int y, int h) {
            IconCard card = new IconCard(Theme);
            card.Title = title;
            card.Glyph = glyph;
            card.Tint = tint;
            card.Location = new Point(12, y);
            card.Size = new Size(296, h);
            body.Location = new Point(16, card.HeaderBottom - 6);
            body.Size = new Size(264, h - card.HeaderBottom - 6);
            body.Font = Theme.Body;
            body.ForeColor = Theme.Ink;
            body.BackColor = Theme.Card;
            card.Controls.Add(body);
            dock.Controls.Add(card);
            return y + h + 12;
        }

        void PaintChart(object sender, PaintEventArgs e) {
            Graphics g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.Clear(Theme.Card);
            // Income vs expense strip on top.
            double total = monthIncome + monthExpense;
            Rectangle strip = new Rectangle(0, 0, chartCard.Width, 10);
            using (GraphicsPath p = FoxUi.Round(strip, 5))
            using (SolidBrush bg = new SolidBrush(Theme.Line)) {
                g.FillPath(bg, p);
            }
            if (total > 0) {
                int incW = (int)(chartCard.Width * monthIncome / total);
                FoxUi.PaintBar(g, new Rectangle(0, 0, Math.Max(6, incW), 10), Theme.Good);
                FoxUi.PaintBar(g, new Rectangle(incW, 0, Math.Max(6, chartCard.Width - incW), 10), Theme.Danger);
            }
            using (SolidBrush good = new SolidBrush(Theme.Good))
            using (SolidBrush bad = new SolidBrush(Theme.Danger))
            using (SolidBrush mute = new SolidBrush(Theme.Muted)) {
                g.DrawString("+" + Ai.Money(monthIncome), Theme.Small, good, 0, 14);
                string ex = "-" + Ai.Money(monthExpense);
                SizeF sz = g.MeasureString(ex, Theme.Small);
                g.DrawString(ex, Theme.Small, bad, chartCard.Width - sz.Width, 14);

                if (bars.Count == 0) {
                    g.DrawString(I18n.T("ai.empty"), Theme.Small, mute, new RectangleF(0, 44, chartCard.Width, 80));
                    return;
                }
                // Category bars.
                Rectangle area = new Rectangle(0, 40, chartCard.Width, 86);
                double max = 1;
                for (int i = 0; i < bars.Count; i++) if (bars[i].Value > max) max = bars[i].Value;
                int n = Math.Min(bars.Count, 6);
                int gap = 10;
                int w = Math.Max(14, (area.Width - gap * (n - 1)) / n);
                for (int i = 0; i < n; i++) {
                    Color c = Theme.ForCategory(bars[i].Key);
                    int h = (int)Math.Round((bars[i].Value / max) * (area.Height - 4));
                    int x = i * (w + gap);
                    FoxUi.PaintBar(g, new Rectangle(x, area.Bottom - h, w, h), c);
                    string label = Ai.CatLabel(bars[i].Key);
                    if (label.Length > 6) label = label.Substring(0, 5) + "…";
                    SizeF ls = g.MeasureString(label, Theme.Small);
                    g.DrawString(label, Theme.Small, mute, x + (w - ls.Width) / 2f, area.Bottom + 4);
                }
            }
        }

        // ── pages ────────────────────────────────────────────────

        public void ShowPage(string id) {
            if (id == "notes") id = "dash";
            page = id;
            content.Controls.Clear();
            LifeView view = ViewFor(id);
            if (view != null) {
                view.Bind();
                content.Controls.Add(view);
            }
            for (int i = 0; i < nav.Count; i++) {
                nav[i].Active = nav[i].Id == id || (id == "editor" && nav[i].Id == "dash");
                nav[i].Invalidate();
            }
            for (int i = 0; i < tabs.Count; i++) {
                tabs[i].Active = tabs[i].Id == id || (id == "editor" && tabs[i].Id == "dash");
                tabs[i].Invalidate();
            }
        }

        LifeView ViewFor(string id) {
            if (id == "dash") {
                if (dash == null) dash = new DashboardView(this);
                return dash;
            }
            if (id == "editor") {
                if (notes == null) notes = new NotesView(this);
                return notes;
            }
            if (id == "finance") {
                if (finance == null) finance = new FinanceView(this);
                return finance;
            }
            if (id == "tables") {
                if (tables == null) tables = new TablesView(this);
                return tables;
            }
            if (id == "stats") {
                if (stats == null) stats = new StatsView(this);
                return stats;
            }
            if (id == "settings") {
                if (settings == null) settings = new SettingsView(this);
                return settings;
            }
            return null;
        }

        public void ReloadUi() {
            I18n.Use(Store.Data.meta.lang);
            Theme = FoxTheme.Named(Store.Data.meta.theme);
            BackColor = Theme.Paper;
            ForeColor = Theme.Ink;
            Text = I18n.T("app.title");
            dash = null;
            notes = null;
            finance = null;
            tables = null;
            stats = null;
            settings = null;
            Controls.Clear();
            BuildChrome();
            ShowPage(page);
            RefreshAiAsync();
        }

        public void DataChanged(string module) {
            RefreshAiAsync();
            // Inline note edits already updated the dashboard; a full Bind would steal the caret.
            if (page == "dash" && dash != null && module != "notes-inline") dash.Bind();
            if (page == "stats" && stats != null) stats.Bind();
            if (page == "finance" && module != "finance" && finance != null) finance.Bind();
        }

        public void Toast(string text) {
            FoxToast.Show(text);
        }

        // ── AI refresh ───────────────────────────────────────────

        void RefreshAiAsync() {
            ApplyBrief(Ai.LocalBrief(), false);
            System.Threading.ThreadPool.QueueUserWorkItem(delegate {
                AiBrief brief = null;
                try { brief = Ai.Analyse(); }
                catch { brief = null; }
                if (brief == null || brief.source != "ollama") return;
                AiBrief copy = brief;
                try {
                    BeginInvoke(new Action(delegate { ApplyBrief(copy, true); }));
                } catch { }
            });
        }

        void ApplyBrief(AiBrief brief, bool fromOllama) {
            if (brief == null) return;
            Ai.MergeSuggestions(brief.suggestions);
            aiMeta.Text = fromOllama ? I18n.T("ai.ollama") : I18n.T("ai.local");

            string ym = DateTime.Now.ToString("yyyy-MM", CultureInfo.InvariantCulture);
            MonthSum s = Ai.Month(ym);
            monthIncome = s.income;
            monthExpense = s.expense;
            Dictionary<string, double> acc = new Dictionary<string, double>();
            List<TxDoc> txs = Store.Data.txs;
            for (int i = 0; i < txs.Count; i++) {
                TxDoc t = txs[i];
                if (t == null || t.type != "expense") continue;
                if (t.date == null || t.date.Length < 7 || t.date.Substring(0, 7) != ym) continue;
                string k = string.IsNullOrEmpty(t.category) ? "other" : t.category;
                if (!acc.ContainsKey(k)) acc[k] = 0;
                acc[k] += t.amount;
            }
            bars = new List<KeyValuePair<string, double>>(acc);
            bars.Sort(delegate(KeyValuePair<string, double> a, KeyValuePair<string, double> b) {
                return b.Value.CompareTo(a.Value);
            });
            chartCard.Invalidate();

            List<string> lines = brief.lines;
            insight.Text = lines.Count > 1 ? lines[0] + "\n" + lines[1] : (lines.Count > 0 ? lines[0] : "");

            string note = "";
            string advice = "";
            for (int i = 0; i < lines.Count; i++) {
                string line = lines[i];
                if (Has(line, "нотат") || Has(line, "замітк") || Has(line, "завдан") || Has(line, "note") || Has(line, "task")) note = line;
                if (line.IndexOf("10%") >= 0 || Has(line, "спробуй") || Has(line, "try") || Has(line, "витрач") || Has(line, "spent")) advice = line;
            }
            if (note.Length == 0 && lines.Count > 2) note = lines[2];
            if (advice.Length == 0 && lines.Count > 3) advice = lines[lines.Count - 1];
            if (note.Length == 0) note = I18n.T("ai.notesum.empty");
            if (advice.Length == 0) advice = I18n.T("ai.tip.empty");
            noteSum.Text = note;
            tip.Text = advice;
            FillReminders();
        }

        static bool Has(string s, string needle) {
            return s.IndexOf(needle, StringComparison.OrdinalIgnoreCase) >= 0;
        }

        void FillReminders() {
            remList.Controls.Clear();
            List<ReminderDoc> list = Store.Data.reminders;
            int y = 0;
            int shown = 0;
            for (int i = 0; i < list.Count; i++) {
                ReminderDoc r = list[i];
                if (r == null || r.done) continue;
                ReminderRow row = new ReminderRow(Theme, r);
                row.Location = new Point(0, y);
                row.Width = remList.Width - 20;
                ReminderDoc copy = r;
                row.Done += delegate {
                    copy.done = true;
                    Store.SaveReminders();
                    FillReminders();
                    if (dash != null && page == "dash") dash.Bind();
                };
                row.Edit += delegate {
                    if (LifeDialog.AskRem(this, copy) == null) return;
                    Store.SaveReminders();
                    FillReminders();
                    if (dash != null && page == "dash") dash.Bind();
                };
                remList.Controls.Add(row);
                y += row.Height + 2;
                shown++;
            }
            if (shown == 0) {
                Label empty = FoxUi.Label(Theme, I18n.T("rem.none"), Theme.Small, Theme.Muted);
                empty.Location = new Point(8, 8);
                remList.Controls.Add(empty);
            }
        }

        // Write every collection to disk and confirm with a wallpaper toast.
        public void SaveAll() {
            if (dash != null) dash.Commit();
            Store.Save();
            Toast(I18n.T("saved") + "  " + FoxPaths.CurrentUser());
        }

        void OnKeys(object sender, KeyEventArgs e) {
            if (e.Control && e.KeyCode == Keys.S) { SaveAll(); e.Handled = true; e.SuppressKeyPress = true; }
            if (e.Control && e.KeyCode == Keys.N) { ShowPage("dash"); e.Handled = true; }
            if (e.Control && e.KeyCode == Keys.F) { ShowPage("finance"); e.Handled = true; }
            if (e.Control && e.KeyCode == Keys.T) { ShowPage("tables"); e.Handled = true; }
            if (e.Control && e.KeyCode == Keys.D1) { ShowPage("dash"); e.Handled = true; }
            if (e.Control && e.KeyCode == Keys.D2) { ShowPage("finance"); e.Handled = true; }
            if (e.Control && e.KeyCode == Keys.D3) { ShowPage("tables"); e.Handled = true; }
            if (e.Control && e.KeyCode == Keys.D4) { ShowPage("stats"); e.Handled = true; }
            if (e.Control && e.KeyCode == Keys.D5) { ShowPage("settings"); e.Handled = true; }
        }

        // Closing the window always flushes pending inline edits and saves everything.
        protected override void OnFormClosing(FormClosingEventArgs e) {
            try {
                if (dash != null) dash.Commit();
                Store.Save();
            } catch { }
            base.OnFormClosing(e);
        }

        protected override void OnFormClosed(FormClosedEventArgs e) {
            if (pulse != null) pulse.Stop();
            base.OnFormClosed(e);
        }
    }
}
