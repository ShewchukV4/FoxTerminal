// Statistics: month tiles, category bars with legend, local AI analysis.

using System;
using System.Collections.Generic;
using System.Drawing;
using System.Globalization;
using System.Windows.Forms;
using FoxOs.Sdk;

namespace FoxOs.Life {

    public class StatsView : LifeView {
        readonly Panel tiles = new Panel();
        readonly Panel chart = new Panel();
        readonly Panel analysisCard = new Panel();
        readonly Label analysis = new Label();
        List<KeyValuePair<string, double>> bars = new List<KeyValuePair<string, double>>();
        double income;
        double expense;

        public StatsView(ILifeHost host) : base(host) {
            Padding = new Padding(12, 8, 12, 12);

            tiles.Dock = DockStyle.Top;
            tiles.Height = 104;
            tiles.BackColor = T.Paper;
            FoxUi.Buffer(tiles);
            tiles.Paint += PaintTiles;

            analysisCard.Dock = DockStyle.Bottom;
            analysisCard.Height = 150;
            analysisCard.BackColor = T.Paper;
            analysisCard.Padding = new Padding(0, 12, 0, 0);
            FoxUi.Buffer(analysisCard);
            analysisCard.Paint += delegate(object s, PaintEventArgs e) {
                Rectangle r = new Rectangle(0, 12, analysisCard.Width - 1, analysisCard.Height - 13);
                FoxUi.PaintCard(e.Graphics, r, T.Card, T.Line);
                FoxUi.PaintBadge(e.Graphics, new Rectangle(16, 26, 28, 28), T.Purple, "\uE82F", T.Icon);
                using (SolidBrush ink = new SolidBrush(T.Ink)) {
                    e.Graphics.DrawString(I18n.T("ai.title"), T.Head, ink, 52, 30);
                }
            };
            analysis.Location = new Point(52, 60);
            analysis.Font = T.Body;
            analysis.ForeColor = T.Ink;
            analysis.BackColor = T.Card;
            analysis.AutoSize = false;
            analysis.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right | AnchorStyles.Bottom;
            analysisCard.Controls.Add(analysis);
            analysisCard.Resize += delegate {
                analysis.Size = new Size(analysisCard.Width - 72, analysisCard.Height - 76);
            };

            chart.Dock = DockStyle.Fill;
            chart.BackColor = T.Paper;
            FoxUi.Buffer(chart);
            chart.Paint += PaintChart;

            Controls.Add(chart);
            Controls.Add(analysisCard);
            Controls.Add(tiles);
        }

        public override void Bind() {
            string ym = DateTime.Now.ToString("yyyy-MM", CultureInfo.InvariantCulture);
            MonthSum s = Host.Ai.Month(ym);
            income = s.income;
            expense = s.expense;

            Dictionary<string, double> acc = new Dictionary<string, double>();
            List<TxDoc> txs = Host.Store.Data.txs;
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

            AiBrief brief = Host.Ai.LocalBrief();
            analysis.Text = string.Join("\n", brief.lines.ToArray());
            analysis.Size = new Size(analysisCard.Width - 72, analysisCard.Height - 76);
            tiles.Invalidate();
            chart.Invalidate();
        }

        void PaintTiles(object sender, PaintEventArgs e) {
            Graphics g = e.Graphics;
            g.Clear(T.Paper);
            int gap = 12;
            int w = (tiles.Width - gap * 2) / 3;
            DrawTile(g, new Rectangle(0, 0, w, 92), I18n.T("fin.income"), Host.Ai.Money(income), T.Good, "\uE8FA");
            DrawTile(g, new Rectangle(w + gap, 0, w, 92), I18n.T("fin.expense"), Host.Ai.Money(expense), T.Danger, "\uE8FB");
            double bal = income - expense;
            DrawTile(g, new Rectangle((w + gap) * 2, 0, tiles.Width - (w + gap) * 2, 92), I18n.T("fin.balance"), Host.Ai.Money(bal), bal >= 0 ? T.Accent : T.Danger, "\uE825");
        }

        void DrawTile(Graphics g, Rectangle r, string cap, string value, Color color, string glyph) {
            FoxUi.PaintCard(g, new Rectangle(r.X, r.Y, r.Width - 1, r.Height - 1), T.Card, T.Line);
            FoxUi.PaintBadge(g, new Rectangle(r.X + 16, r.Y + 18, 36, 36), color, glyph, T.IconBig);
            using (SolidBrush mute = new SolidBrush(T.Muted))
            using (SolidBrush ink = new SolidBrush(color)) {
                g.DrawString(cap, T.Small, mute, r.X + 64, r.Y + 20);
                g.DrawString(value, T.Digits, ink, r.X + 62, r.Y + 38);
            }
        }

        void PaintChart(object sender, PaintEventArgs e) {
            Graphics g = e.Graphics;
            g.Clear(T.Paper);
            Rectangle card = new Rectangle(0, 12, chart.Width - 1, chart.Height - 13);
            if (card.Width < 80 || card.Height < 80) return;
            FoxUi.PaintCard(g, card, T.Card, T.Line);
            FoxUi.PaintBadge(g, new Rectangle(16, 26, 28, 28), T.Accent, "\uE9D2", T.Icon);
            using (SolidBrush ink = new SolidBrush(T.Ink))
            using (SolidBrush mute = new SolidBrush(T.Muted)) {
                g.DrawString(I18n.T("st.bycat"), T.Head, ink, 52, 30);
                if (bars.Count == 0) {
                    g.DrawString(I18n.T("ai.empty"), T.Body, mute, 20, 80);
                    return;
                }

                // Legend on the right, bars on the left.
                int legendW = Math.Min(240, card.Width / 3);
                Rectangle area = new Rectangle(24, 76, card.Width - legendW - 48, card.Height - 120);
                double max = 1;
                for (int i = 0; i < bars.Count; i++) if (bars[i].Value > max) max = bars[i].Value;

                // Soft horizontal guide lines.
                using (Pen guide = new Pen(T.Line)) {
                    for (int i = 0; i <= 4; i++) {
                        int gy = area.Y + area.Height * i / 4;
                        g.DrawLine(guide, area.X, gy, area.Right, gy);
                    }
                }

                int n = bars.Count;
                int gap = Math.Max(10, area.Width / (n * 4));
                int w = Math.Max(18, (area.Width - gap * (n + 1)) / n);
                for (int i = 0; i < n; i++) {
                    Color c = T.ForCategory(bars[i].Key);
                    int h = (int)Math.Round((bars[i].Value / max) * (area.Height - 4));
                    int x = area.X + gap + i * (w + gap);
                    Rectangle bar = new Rectangle(x, area.Bottom - h, w, h);
                    FoxUi.PaintBar(g, bar, c);
                    string label = Host.Ai.CatLabel(bars[i].Key);
                    SizeF sz = g.MeasureString(label, T.Small);
                    g.DrawString(label, T.Small, mute, x + (w - sz.Width) / 2f, area.Bottom + 6);
                }

                int lx = card.Right - legendW - 8;
                int ly = 80;
                double total = 0;
                for (int i = 0; i < n; i++) total += bars[i].Value;
                for (int i = 0; i < n && ly < card.Bottom - 30; i++) {
                    Color c = T.ForCategory(bars[i].Key);
                    FoxUi.PaintDot(g, lx, ly + 4, 10, c);
                    g.DrawString(Host.Ai.CatLabel(bars[i].Key), T.Body, ink, lx + 18, ly);
                    string pct = total > 0 ? ((int)Math.Round(bars[i].Value * 100 / total)).ToString() + "%" : "";
                    string val = Host.Ai.Money(bars[i].Value) + "   " + pct;
                    g.DrawString(val, T.Small, mute, lx + 18, ly + 20);
                    ly += 46;
                }
            }
        }
    }
}
