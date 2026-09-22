using System;
using System.Collections.Generic;
using System.Drawing;
using System.Globalization;
using System.Windows.Forms;
using FoxOs.Sdk;

namespace FoxOs.Life {

    public class FinanceView : LifeView {
        readonly Label inc = new Label();
        readonly Label exp = new Label();
        readonly Label bal = new Label();
        readonly ComboBox month = new ComboBox();
        readonly ComboBox cat = new ComboBox();
        readonly DataGridView grid = new DataGridView();
        readonly string[] cats = new[] { "", "food", "transport", "home", "salary", "fun", "other" };

        public FinanceView(ILifeHost host) : base(host) {
            Padding = new Padding(18);

            Panel cards = new Panel();
            cards.Dock = DockStyle.Top;
            cards.Height = 88;
            cards.BackColor = T.Paper;
            MakeCard(cards, inc, 0);
            MakeCard(cards, exp, 1);
            MakeCard(cards, bal, 2);

            Panel bar = new Panel();
            bar.Dock = DockStyle.Top;
            bar.Height = 44;
            bar.BackColor = T.Paper;
            month = FoxUi.Combo(T);
            month.Width = 160;
            month.Location = new Point(0, 6);
            month.SelectedIndexChanged += delegate { FillGrid(); };
            cat = FoxUi.Combo(T);
            cat.Width = 160;
            cat.Location = new Point(172, 6);
            cat.SelectedIndexChanged += delegate { FillGrid(); };
            Button add = FoxUi.Button(T, I18n.T("fin.add"), true);
            add.Width = 150;
            add.Location = new Point(344, 4);
            add.Click += delegate { Edit(null); };
            Button del = FoxUi.Button(T, I18n.T("delete"), false);
            del.Width = 100;
            del.Location = new Point(502, 4);
            del.Click += delegate { DeleteSel(); };
            bar.Controls.Add(month);
            bar.Controls.Add(cat);
            bar.Controls.Add(add);
            bar.Controls.Add(del);

            grid.Dock = DockStyle.Fill;
            grid.ReadOnly = true;
            grid.AllowUserToAddRows = false;
            FoxUi.StyleGrid(grid, T);
            grid.CellDoubleClick += delegate { EditSel(); };

            Controls.Add(grid);
            Controls.Add(bar);
            Controls.Add(cards);
        }

        void MakeCard(Panel parent, Label value, int slot) {
            Panel p = new Panel();
            p.Size = new Size(200, 76);
            p.Location = new Point(slot * 216, 0);
            p.BackColor = T.Card;
            p.Paint += delegate(object s, PaintEventArgs e) {
                FoxUi.PaintCard(e.Graphics, new Rectangle(0, 0, p.Width - 1, p.Height - 1), T.Card, T.Line);
            };
            value.AutoSize = false;
            value.Bounds = new Rectangle(14, 28, 170, 36);
            value.Font = T.Head;
            value.ForeColor = T.Ink;
            value.BackColor = Color.Transparent;
            Label cap = new Label();
            cap.AutoSize = false;
            cap.Bounds = new Rectangle(14, 10, 170, 18);
            cap.Font = T.Small;
            cap.ForeColor = T.Muted;
            cap.BackColor = Color.Transparent;
            cap.Tag = slot;
            cap.Text = slot == 0 ? I18n.T("fin.income") : slot == 1 ? I18n.T("fin.expense") : I18n.T("fin.balance");
            p.Controls.Add(cap);
            p.Controls.Add(value);
            parent.Controls.Add(p);
        }

        public override void Bind() {
            string keep = month.SelectedItem != null ? month.SelectedItem.ToString() : "";
            month.Items.Clear();
            month.Items.Add(I18n.T("fin.all"));
            Dictionary<string, bool> seen = new Dictionary<string, bool>();
            List<TxDoc> txs = Host.Store.Data.txs;
            for (int i = 0; i < txs.Count; i++) {
                if (txs[i] == null || string.IsNullOrEmpty(txs[i].date) || txs[i].date.Length < 7) continue;
                string ym = txs[i].date.Substring(0, 7);
                if (seen.ContainsKey(ym)) continue;
                seen[ym] = true;
                month.Items.Add(ym);
            }
            string now = DateTime.Now.ToString("yyyy-MM", CultureInfo.InvariantCulture);
            if (!seen.ContainsKey(now)) month.Items.Add(now);
            int pick = 0;
            for (int i = 0; i < month.Items.Count; i++) {
                if (month.Items[i].ToString() == keep || (keep.Length == 0 && month.Items[i].ToString() == now)) {
                    pick = i;
                }
            }
            month.SelectedIndex = pick;

            cat.Items.Clear();
            cat.Items.Add(I18n.T("fin.all"));
            for (int i = 1; i < cats.Length; i++) cat.Items.Add(Host.Ai.CatLabel(cats[i]));
            if (cat.SelectedIndex < 0) cat.SelectedIndex = 0;

            foreach (Control c in Controls[2].Controls) {
                foreach (Control inner in c.Controls) {
                    Label cap = inner as Label;
                    if (cap == null || cap.Tag == null) continue;
                    int slot = (int)cap.Tag;
                    cap.Text = slot == 0 ? I18n.T("fin.income") : slot == 1 ? I18n.T("fin.expense") : I18n.T("fin.balance");
                }
            }
            FillGrid();
        }

        string MonthFilter() {
            if (month.SelectedIndex <= 0 || month.SelectedItem == null) return "";
            string s = month.SelectedItem.ToString();
            return s == I18n.T("fin.all") ? "" : s;
        }

        string CatFilter() {
            if (cat.SelectedIndex <= 0) return "";
            return cats[cat.SelectedIndex];
        }

        void FillGrid() {
            string mf = MonthFilter();
            string cf = CatFilter();
            double income = 0, expense = 0;
            grid.Columns.Clear();
            grid.Rows.Clear();
            grid.Columns.Add("date", I18n.T("fin.date"));
            grid.Columns.Add("type", I18n.T("fin.type"));
            grid.Columns.Add("cat", I18n.T("category"));
            grid.Columns.Add("amt", I18n.T("fin.amount"));
            grid.Columns.Add("note", I18n.T("fin.note"));
            grid.Columns.Add("id", "id");
            grid.Columns["id"].Visible = false;
            List<TxDoc> txs = Host.Store.Data.txs;
            txs.Sort(delegate(TxDoc a, TxDoc b) {
                string da = a != null && a.date != null ? a.date : "";
                string db = b != null && b.date != null ? b.date : "";
                return string.CompareOrdinal(db, da);
            });
            for (int i = 0; i < txs.Count; i++) {
                TxDoc t = txs[i];
                if (t == null) continue;
                if (mf.Length > 0 && (t.date == null || t.date.IndexOf(mf) != 0)) continue;
                if (cf.Length > 0 && t.category != cf) continue;
                if (t.type == "income") income += t.amount;
                else expense += t.amount;
                string sign = t.type == "income" ? "+" : "−";
                grid.Rows.Add(new object[] {
                    t.date,
                    t.type == "income" ? I18n.T("fin.income") : I18n.T("fin.expense"),
                    Host.Ai.CatLabel(t.category),
                    sign + " " + Host.Ai.Money(t.amount),
                    t.note,
                    t.id
                });
            }
            inc.Text = Host.Ai.Money(income);
            inc.ForeColor = T.Good;
            exp.Text = Host.Ai.Money(expense);
            exp.ForeColor = T.Danger;
            double balance = income - expense;
            bal.Text = Host.Ai.Money(balance);
            bal.ForeColor = balance >= 0 ? T.Good : T.Danger;
        }

        void Edit(TxDoc existing) {
            TxDoc t = LifeDialog.AskTx(Host, existing);
            if (t == null) return;
            if (existing == null) Host.Store.Data.txs.Add(t);
            Host.Store.SaveTxs();
            Bind();
            Host.DataChanged("finance");
        }

        void EditSel() {
            TxDoc t = Selected();
            if (t != null) Edit(t);
        }

        void DeleteSel() {
            TxDoc t = Selected();
            if (t == null) return;
            Host.Store.Data.txs.Remove(t);
            Host.Store.SaveTxs();
            Bind();
            Host.DataChanged("finance");
        }

        TxDoc Selected() {
            if (grid.CurrentRow == null) return null;
            object id = grid.CurrentRow.Cells["id"].Value;
            if (id == null) return null;
            string sid = id.ToString();
            List<TxDoc> txs = Host.Store.Data.txs;
            for (int i = 0; i < txs.Count; i++) {
                if (txs[i] != null && txs[i].id == sid) return txs[i];
            }
            return null;
        }
    }
}
