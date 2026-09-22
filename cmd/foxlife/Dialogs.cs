// Small themed dialogs for transactions, reminders, names.

using System;
using System.Drawing;
using System.Globalization;
using System.Windows.Forms;
using FoxOs.Sdk;

namespace FoxOs.Life {

    public static class LifeDialog {
        public static Form Frame(ILifeHost host, string title, int w, int h) {
            Form f = new Form();
            f.Text = title;
            f.StartPosition = FormStartPosition.CenterParent;
            f.FormBorderStyle = FormBorderStyle.FixedDialog;
            f.MaximizeBox = false;
            f.MinimizeBox = false;
            f.ClientSize = new Size(w, h);
            f.BackColor = host.Theme.Paper;
            f.ForeColor = host.Theme.Ink;
            f.Font = host.Theme.Body;
            f.ShowInTaskbar = false;
            return f;
        }

        public static string Ask(ILifeHost host, string title, string label, string value) {
            Form f = Frame(host, title, 360, 150);
            Label l = FoxUi.Label(host.Theme, label, host.Theme.Small, host.Theme.Muted);
            l.Location = new Point(16, 16);
            TextBox box = FoxUi.Field(host.Theme);
            box.Location = new Point(16, 36);
            box.Width = 320;
            box.Text = value ?? "";
            Button ok = FoxUi.Button(host.Theme, I18n.T("ok"), true);
            ok.Location = new Point(170, 90);
            ok.Width = 80;
            Button cancel = FoxUi.Button(host.Theme, I18n.T("cancel"), false);
            cancel.Location = new Point(256, 90);
            cancel.Width = 80;
            f.Controls.Add(l);
            f.Controls.Add(box);
            f.Controls.Add(ok);
            f.Controls.Add(cancel);
            string result = null;
            ok.Click += delegate { result = box.Text.Trim(); f.DialogResult = DialogResult.OK; f.Close(); };
            cancel.Click += delegate { f.DialogResult = DialogResult.Cancel; f.Close(); };
            f.AcceptButton = ok;
            f.CancelButton = cancel;
            if (f.ShowDialog() == DialogResult.OK && !string.IsNullOrEmpty(result)) return result;
            return null;
        }

        public static TxDoc AskTx(ILifeHost host, TxDoc existing) {
            Form f = Frame(host, I18n.T("fin.add"), 400, 280);
            DateTimePicker date = new DateTimePicker();
            date.Format = DateTimePickerFormat.Short;
            date.Location = new Point(16, 16);
            date.Width = 160;
            DateTime parsed;
            if (existing != null && DateTime.TryParse(existing.date, out parsed)) date.Value = parsed;

            ComboBox type = FoxUi.Combo(host.Theme);
            type.Items.Add(I18n.T("fin.income"));
            type.Items.Add(I18n.T("fin.expense"));
            type.SelectedIndex = existing != null && existing.type == "income" ? 0 : 1;
            type.Location = new Point(190, 16);
            type.Width = 190;

            ComboBox cat = FoxUi.Combo(host.Theme);
            string[] cats = new[] { "food", "transport", "home", "salary", "fun", "other" };
            int catIdx = 5;
            for (int i = 0; i < cats.Length; i++) {
                cat.Items.Add(host.Ai.CatLabel(cats[i]));
                if (existing != null && existing.category == cats[i]) catIdx = i;
            }
            cat.SelectedIndex = catIdx;
            cat.Location = new Point(16, 56);
            cat.Width = 364;

            NumericUpDown amt = new NumericUpDown();
            amt.Maximum = 10000000;
            amt.DecimalPlaces = 2;
            amt.Location = new Point(16, 96);
            amt.Width = 160;
            if (existing != null) amt.Value = (decimal)Math.Max(0, existing.amount);

            TextBox note = FoxUi.Field(host.Theme);
            note.Location = new Point(190, 96);
            note.Width = 190;
            note.Text = existing != null ? existing.note : "";

            Button ok = FoxUi.Button(host.Theme, I18n.T("save"), true);
            ok.Location = new Point(210, 210);
            ok.Width = 80;
            Button cancel = FoxUi.Button(host.Theme, I18n.T("cancel"), false);
            cancel.Location = new Point(300, 210);
            cancel.Width = 80;

            f.Controls.Add(date);
            f.Controls.Add(type);
            f.Controls.Add(cat);
            f.Controls.Add(amt);
            f.Controls.Add(note);
            f.Controls.Add(ok);
            f.Controls.Add(cancel);

            TxDoc result = null;
            ok.Click += delegate {
                result = existing != null ? existing : new TxDoc();
                if (string.IsNullOrEmpty(result.id)) result.id = LifeStore.NewId();
                result.date = date.Value.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
                result.type = type.SelectedIndex == 0 ? "income" : "expense";
                result.category = cats[Math.Max(0, cat.SelectedIndex)];
                result.amount = (double)amt.Value;
                result.note = note.Text.Trim();
                f.DialogResult = DialogResult.OK;
                f.Close();
            };
            cancel.Click += delegate { f.DialogResult = DialogResult.Cancel; f.Close(); };
            if (f.ShowDialog() == DialogResult.OK) return result;
            return null;
        }

        public static ReminderDoc AskRem(ILifeHost host) {
            return AskRem(host, null);
        }

        // Pass an existing reminder to edit it in place; returns the same object.
        public static ReminderDoc AskRem(ILifeHost host, ReminderDoc existing) {
            Form f = Frame(host, existing != null ? I18n.T("edit") : I18n.T("rem.add"), 400, 190);
            TextBox box = FoxUi.Field(host.Theme);
            box.Location = new Point(16, 20);
            box.Width = 360;
            if (existing != null) box.Text = existing.text ?? "";
            DateTimePicker due = new DateTimePicker();
            due.Format = DateTimePickerFormat.Short;
            due.Location = new Point(16, 60);
            due.Width = 160;
            DateTime parsedDue;
            if (existing != null && DateTime.TryParse(existing.due, out parsedDue)) due.Value = parsedDue;
            Button ok = FoxUi.Button(host.Theme, I18n.T("save"), true);
            ok.Location = new Point(210, 120);
            ok.Width = 80;
            Button cancel = FoxUi.Button(host.Theme, I18n.T("cancel"), false);
            cancel.Location = new Point(300, 120);
            cancel.Width = 80;
            f.Controls.Add(box);
            f.Controls.Add(due);
            f.Controls.Add(ok);
            f.Controls.Add(cancel);
            ReminderDoc result = null;
            ok.Click += delegate {
                if (string.IsNullOrEmpty(box.Text.Trim())) return;
                result = existing != null ? existing : new ReminderDoc();
                if (string.IsNullOrEmpty(result.id)) result.id = LifeStore.NewId();
                result.text = box.Text.Trim();
                result.due = due.Value.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
                if (existing == null) {
                    result.source = "manual";
                    result.done = false;
                    result.created = LifeStore.Now();
                }
                f.DialogResult = DialogResult.OK;
                f.Close();
            };
            cancel.Click += delegate { f.Close(); };
            if (f.ShowDialog() == DialogResult.OK) return result;
            return null;
        }
    }
}
