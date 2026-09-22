// Home dashboard: notes card, finance card with stat pills, reminders card.

using System;
using System.Collections.Generic;
using System.Drawing;
using System.Globalization;
using System.Windows.Forms;
using FoxOs.Sdk;

namespace FoxOs.Life {

    public class DashboardView : LifeView {
        readonly Panel stack = new Panel();
        readonly IconCard notesCard;
        readonly IconCard finCard;
        readonly IconCard remCard;
        readonly Button addNote = new Button();
        readonly Button addTx = new Button();
        readonly Button addRem = new Button();
        readonly Button openEditor = new Button();
        readonly Panel noteRows = new Panel();
        readonly Panel noteDetail = new Panel();
        readonly TextBox noteTitle = new TextBox();
        readonly TextBox noteBody = new TextBox();
        readonly Panel checkList = new Panel();
        readonly TextBox newItem = new TextBox();
        readonly Timer autosave = new Timer();
        readonly ToolTip tips = new ToolTip();
        NoteDoc editing;     // note currently bound to the inline editor
        bool loading;
        bool dirty;
        readonly StatPill pillIn;
        readonly StatPill pillOut;
        readonly StatPill pillBal;
        readonly DataGridView grid = new DataGridView();
        readonly Panel remRows = new Panel();
        NoteDoc selected;

        public DashboardView(ILifeHost host) : base(host) {
            AutoScroll = true;
            stack.Location = new Point(0, 0);
            stack.BackColor = T.Paper;
            Controls.Add(stack);

            notesCard = new IconCard(T);
            notesCard.Title = I18n.T("dash.notes");
            notesCard.Glyph = "\uE70B";
            notesCard.Tint = T.Accent;
            notesCard.Size = new Size(720, 268);
            BuildNotesCard();

            finCard = new IconCard(T);
            finCard.Title = I18n.T("dash.finance");
            finCard.Glyph = "\uE825";
            finCard.Tint = T.Good;
            finCard.Size = new Size(720, 300);
            pillIn = new StatPill(T);
            pillOut = new StatPill(T);
            pillBal = new StatPill(T);
            BuildFinCard();

            remCard = new IconCard(T);
            remCard.Title = I18n.T("rem.title");
            remCard.Glyph = "\uE823";
            remCard.Tint = T.Orange;
            remCard.Size = new Size(720, 190);
            BuildRemCard();

            stack.Controls.Add(notesCard);
            stack.Controls.Add(finCard);
            stack.Controls.Add(remCard);
            Resize += delegate { LayoutCards(); };
        }

        void LayoutCards() {
            int w = Math.Max(520, ClientSize.Width - 20);
            int y = 4;
            notesCard.Bounds = new Rectangle(4, y, w, notesCard.Height);
            y += notesCard.Height + 14;
            finCard.Bounds = new Rectangle(4, y, w, finCard.Height);
            y += finCard.Height + 14;
            remCard.Bounds = new Rectangle(4, y, w, remCard.Height);
            y += remCard.Height + 8;
            stack.Size = new Size(w + 8, y);

            addNote.Location = new Point(w - 168, 14);
            openEditor.Location = new Point(w - 206, 14);
            addTx.Location = new Point(w - 168, 14);
            addRem.Location = new Point(w - 168, 14);

            noteRows.Size = new Size(260, notesCard.Height - 70);
            noteDetail.Bounds = new Rectangle(290, 56, w - 306, notesCard.Height - 70);
            noteTitle.Bounds = new Rectangle(14, 10, Math.Max(80, noteDetail.Width - 230), 26);
            noteBody.Bounds = new Rectangle(14, 44, noteDetail.Width - 28, noteDetail.Height - 56);
            checkList.Bounds = new Rectangle(14, 44, noteDetail.Width - 28, noteDetail.Height - 86);
            newItem.Bounds = new Rectangle(14, noteDetail.Height - 36, noteDetail.Width - 28, 24);

            int pw = (w - 32 - 24) / 3;
            pillIn.Bounds = new Rectangle(16, 56, pw, 60);
            pillOut.Bounds = new Rectangle(16 + pw + 12, 56, pw, 60);
            pillBal.Bounds = new Rectangle(16 + (pw + 12) * 2, 56, w - 32 - (pw + 12) * 2, 60);
            grid.Bounds = new Rectangle(16, 128, w - 32, finCard.Height - 144);

            remRows.Bounds = new Rectangle(12, 54, w - 24, remCard.Height - 66);
        }

        // ── notes ────────────────────────────────────────────────

        void BuildNotesCard() {
            StyleGhost(addNote, I18n.T("dash.newnote"), true);
            addNote.Click += delegate {
                NoteDoc n = new NoteDoc();
                n.id = LifeStore.NewId();
                n.title = I18n.T("kind.note");
                n.kind = "note";
                n.category = "personal";
                n.created = LifeStore.Now();
                n.updated = n.created;
                Host.Store.Data.notes.Insert(0, n);
                Host.Store.SaveNotes();
                Host.ShowPage("editor");
                Host.DataChanged("notes");
            };
            StyleGhost(openEditor, "\uE70F", false);
            openEditor.Font = T.Icon;
            openEditor.Width = 32;
            openEditor.Click += delegate { Host.ShowPage("editor"); };

            noteRows.Location = new Point(14, 56);
            noteRows.BackColor = T.Card;
            noteRows.AutoScroll = true;

            noteDetail.BackColor = T.Card;
            FoxUi.Buffer(noteDetail);
            noteDetail.Paint += PaintNoteDetail;

            // Inline editor: title + body (or checklist) saved automatically.
            noteTitle.BorderStyle = BorderStyle.None;
            noteTitle.Font = T.Head;
            noteTitle.ForeColor = T.Ink;
            noteTitle.BackColor = T.Paper;
            noteTitle.TextChanged += delegate { MarkDirty(); };
            noteTitle.Leave += delegate { Flush(); };
            noteTitle.KeyDown += delegate(object s, KeyEventArgs e) {
                if (e.KeyCode == Keys.Enter) { e.SuppressKeyPress = true; noteBody.Focus(); }
            };

            noteBody.Multiline = true;
            noteBody.ScrollBars = ScrollBars.Vertical;
            noteBody.BorderStyle = BorderStyle.None;
            noteBody.Font = T.Body;
            noteBody.ForeColor = T.Ink;
            noteBody.BackColor = T.Paper;
            noteBody.AcceptsReturn = true;
            noteBody.TextChanged += delegate { MarkDirty(); };
            noteBody.Leave += delegate { Flush(); };

            checkList.BackColor = T.Paper;
            checkList.AutoScroll = true;
            checkList.Visible = false;

            newItem.BorderStyle = BorderStyle.FixedSingle;
            newItem.Font = T.Body;
            newItem.ForeColor = T.Muted;
            newItem.BackColor = T.Card;
            newItem.Visible = false;
            newItem.GotFocus += delegate {
                if (newItem.ForeColor == T.Muted) { newItem.Text = ""; newItem.ForeColor = T.Ink; }
            };
            newItem.KeyDown += delegate(object s, KeyEventArgs e) {
                if (e.KeyCode != Keys.Enter) return;
                e.SuppressKeyPress = true;
                string text = newItem.Text.Trim();
                if (selected == null || text.Length == 0 || newItem.ForeColor == T.Muted) return;
                NoteItem it = new NoteItem();
                it.text = text;
                it.done = false;
                if (selected.items == null) selected.items = new List<NoteItem>();
                selected.items.Add(it);
                newItem.Text = "";
                SaveSelected();
                RebuildChecks();
            };

            autosave.Interval = 700;
            autosave.Tick += delegate { autosave.Stop(); Flush(); };

            noteDetail.Controls.Add(noteTitle);
            noteDetail.Controls.Add(noteBody);
            noteDetail.Controls.Add(checkList);
            noteDetail.Controls.Add(newItem);
            tips.SetToolTip(noteRows, I18n.T("hint.notes"));
            tips.SetToolTip(noteBody, I18n.T("hint.notes"));

            notesCard.Controls.Add(addNote);
            notesCard.Controls.Add(openEditor);
            notesCard.Controls.Add(noteRows);
            notesCard.Controls.Add(noteDetail);
        }

        void PaintNoteDetail(object sender, PaintEventArgs e) {
            Graphics g = e.Graphics;
            g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
            g.PixelOffsetMode = System.Drawing.Drawing2D.PixelOffsetMode.HighQuality;
            g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.ClearTypeGridFit;
            g.Clear(T.Card);
            Rectangle r = new Rectangle(0, 0, noteDetail.Width - 1, noteDetail.Height - 1);
            using (System.Drawing.Drawing2D.GraphicsPath p = FoxUi.Round(r, 12))
            using (SolidBrush b = new SolidBrush(T.Paper)) {
                g.FillPath(b, p);
            }
            if (selected == null) {
                using (SolidBrush mute = new SolidBrush(T.Muted))
                using (StringFormat sf = new StringFormat()) {
                    sf.Alignment = StringAlignment.Center;
                    sf.LineAlignment = StringAlignment.Center;
                    g.DrawString(I18n.T("notes.empty"), T.Body, mute,
                        new RectangleF(16, 16, noteDetail.Width - 32, Math.Max(40, noteDetail.Height - 32)), sf);
                }
                return;
            }
            int x = noteDetail.Width - 12;
            string kind = selected.kind == "check" ? I18n.T("kind.check") : selected.kind == "idea" ? I18n.T("kind.idea") : I18n.T("kind.note");
            SizeF ks = g.MeasureString(kind, T.Small);
            x -= (int)ks.Width + 16;
            FoxUi.PaintChip(g, x, 12, kind, T.ForCategory(selected.category), T.Small, true);
            string cat = CatName(selected.category);
            SizeF cs = g.MeasureString(cat, T.Small);
            x -= (int)cs.Width + 24;
            FoxUi.PaintChip(g, x, 12, cat, T.ForCategory(selected.category), T.Small, false);
        }

        string CatName(string id) {
            if (id == "work") return I18n.T("cat.work");
            if (id == "personal") return I18n.T("cat.personal");
            if (id == "ideas") return I18n.T("cat.ideas");
            return I18n.T("cat.other");
        }

        void FillNotes() {
            noteRows.Controls.Clear();
            List<NoteDoc> notes = Host.Store.Data.notes;
            if (notes.Count == 0) {
                selected = null;
                ShowNote(null);
                return;
            }
            bool found = false;
            for (int i = 0; i < notes.Count; i++) if (selected != null && notes[i] != null && notes[i].id == selected.id) found = true;
            if (!found) selected = notes[0];
            int y = 0;
            for (int i = 0; i < notes.Count && i < 12; i++) {
                NoteDoc n = notes[i];
                if (n == null) continue;
                NoteRow row = new NoteRow(T, n);
                row.Active = selected != null && selected.id == n.id;
                row.Location = new Point(0, y);
                row.Width = noteRows.Width - 20;
                NoteDoc copy = n;
                row.Click += delegate {
                    selected = copy;
                    FillNotes();
                };
                row.DoubleClick += delegate { Host.ShowPage("editor"); };
                noteRows.Controls.Add(row);
                y += row.Height + 2;
            }
            ShowNote(selected);
        }

        void ShowNote(NoteDoc n) {
            Flush();            // persist pending edits of the previously shown note
            editing = n;
            loading = true;
            noteDetail.Invalidate();
            bool check = n != null && n.kind == "check";
            noteTitle.Visible = n != null;
            noteBody.Visible = n != null && !check;
            checkList.Visible = check;
            newItem.Visible = check;
            if (n == null) {
                noteBody.Text = "";
                noteTitle.Text = "";
                loading = false;
                return;
            }
            noteTitle.Text = n.title ?? "";
            if (check) {
                RebuildChecks();
                newItem.Text = I18n.T("item.add");
                newItem.ForeColor = T.Muted;
            } else {
                noteBody.Text = (n.body ?? "").Replace("\r\n", "\n").Replace("\n", "\r\n");
            }
            loading = false;
        }

        void RebuildChecks() {
            checkList.Controls.Clear();
            if (selected == null) return;
            if (selected.items == null) selected.items = new List<NoteItem>();
            int y = 4;
            for (int i = 0; i < selected.items.Count; i++) {
                NoteItem it = selected.items[i];
                if (it == null) continue;
                CheckBox cb = new CheckBox();
                cb.Text = it.text ?? "";
                cb.Checked = it.done;
                cb.Font = T.Body;
                cb.ForeColor = it.done ? T.Muted : T.Ink;
                cb.BackColor = T.Paper;
                cb.AutoSize = false;
                cb.Bounds = new Rectangle(4, y, checkList.Width - 30, 26);
                NoteItem copy = it;
                cb.CheckedChanged += delegate {
                    copy.done = cb.Checked;
                    cb.ForeColor = cb.Checked ? T.Muted : T.Ink;
                    SaveSelected();
                };
                checkList.Controls.Add(cb);
                y += 28;
            }
        }

        void MarkDirty() {
            if (loading || editing == null) return;
            dirty = true;
            autosave.Stop();
            autosave.Start();
        }

        // Push inline edits into the note bound to the editor and persist.
        void Flush() {
            if (!dirty || editing == null) { dirty = false; return; }
            dirty = false;
            string title = noteTitle.Text.Trim();
            editing.title = title.Length == 0 ? I18n.T("kind.note") : title;
            if (editing.kind != "check") editing.body = noteBody.Text.Replace("\r\n", "\n");
            SaveNote(editing);
            RefreshRowsOnly();
        }

        void SaveSelected() { SaveNote(selected); }

        // Public flush used by Ctrl+S and window close.
        public void Commit() { autosave.Stop(); Flush(); }

        void SaveNote(NoteDoc n) {
            if (n == null) return;
            n.updated = LifeStore.Now();
            Host.Store.SaveNotes();
            notesCard.Caption = I18n.T("saved") + " " + DateTime.Now.ToString("HH:mm");
            notesCard.Invalidate();
            Host.DataChanged("notes-inline");
        }

        void RefreshRowsOnly() {
            foreach (Control c in noteRows.Controls) {
                NoteRow row = c as NoteRow;
                if (row != null) row.Invalidate();
            }
        }

        // ── finance ──────────────────────────────────────────────

        void BuildFinCard() {
            StyleGhost(addTx, I18n.T("dash.newtx"), true);
            addTx.Click += delegate {
                TxDoc t = LifeDialog.AskTx(Host, null);
                if (t == null) return;
                Host.Store.Data.txs.Add(t);
                Host.Store.SaveTxs();
                Bind();
                Host.DataChanged("finance");
            };
            pillIn.Caption = I18n.T("fin.income");
            pillIn.Tint = T.Good;
            pillIn.Glyph = "\uE8FA";
            pillOut.Caption = I18n.T("fin.expense");
            pillOut.Tint = T.Danger;
            pillOut.Glyph = "\uE8FB";
            pillBal.Caption = I18n.T("fin.balance");
            pillBal.Tint = T.Accent;
            pillBal.Glyph = "\uE825";

            grid.ReadOnly = true;
            grid.AllowUserToAddRows = false;
            FoxUi.StyleGrid(grid, T);
            grid.ColumnHeadersHeight = 30;
            grid.RowTemplate.Height = 30;
            tips.SetToolTip(grid, I18n.T("edit") + ": double-click");
            // Double-click a row to edit that transaction in place.
            grid.CellDoubleClick += delegate(object s, DataGridViewCellEventArgs e) {
                if (e.RowIndex < 0) return;
                object id = grid.Rows[e.RowIndex].Cells["id"].Value;
                if (id == null) return;
                TxDoc target = null;
                List<TxDoc> all = Host.Store.Data.txs;
                for (int i = 0; i < all.Count; i++) {
                    if (all[i] != null && all[i].id == id.ToString()) { target = all[i]; break; }
                }
                if (target == null) return;
                if (LifeDialog.AskTx(Host, target) == null) return;
                Host.Store.SaveTxs();
                Bind();
                Host.DataChanged("finance");
            };

            finCard.Controls.Add(addTx);
            finCard.Controls.Add(pillIn);
            finCard.Controls.Add(pillOut);
            finCard.Controls.Add(pillBal);
            finCard.Controls.Add(grid);
        }

        void FillFinance() {
            string ym = DateTime.Now.ToString("yyyy-MM", CultureInfo.InvariantCulture);
            MonthSum s = Host.Ai.Month(ym);
            pillIn.Value = Host.Ai.Money(s.income);
            pillOut.Value = Host.Ai.Money(s.expense);
            pillBal.Value = Host.Ai.Money(s.income - s.expense);
            pillBal.Tint = (s.income - s.expense) >= 0 ? T.Accent : T.Danger;
            pillIn.Invalidate();
            pillOut.Invalidate();
            pillBal.Invalidate();

            grid.Columns.Clear();
            grid.Rows.Clear();
            grid.Columns.Add("date", I18n.T("fin.date"));
            grid.Columns.Add("cat", I18n.T("category"));
            grid.Columns.Add("note", I18n.T("fin.note"));
            grid.Columns.Add("amt", I18n.T("fin.amount"));
            grid.Columns.Add("id", "id");
            grid.Columns["id"].Visible = false;
            grid.Columns["date"].FillWeight = 70;
            grid.Columns["cat"].FillWeight = 80;
            grid.Columns["note"].FillWeight = 140;
            grid.Columns["amt"].FillWeight = 90;
            grid.Columns["amt"].DefaultCellStyle.Alignment = DataGridViewContentAlignment.MiddleRight;
            grid.Columns["amt"].DefaultCellStyle.Font = T.Head;

            List<TxDoc> txs = new List<TxDoc>(Host.Store.Data.txs);
            txs.Sort(delegate(TxDoc a, TxDoc b) {
                string da = a != null && a.date != null ? a.date : "";
                string db = b != null && b.date != null ? b.date : "";
                return string.CompareOrdinal(db, da);
            });
            int shown = 0;
            for (int i = 0; i < txs.Count && shown < 5; i++) {
                TxDoc t = txs[i];
                if (t == null) continue;
                bool inc = t.type == "income";
                int idx = grid.Rows.Add(new object[] {
                    t.date, Host.Ai.CatLabel(t.category), t.note, (inc ? "+ " : "- ") + Host.Ai.Money(t.amount), t.id
                });
                grid.Rows[idx].Cells["amt"].Style.ForeColor = inc ? T.Good : T.Danger;
                grid.Rows[idx].Cells["cat"].Style.ForeColor = T.ForCategory(t.category);
                shown++;
            }
        }

        // ── reminders ────────────────────────────────────────────

        void BuildRemCard() {
            StyleGhost(addRem, I18n.T("dash.newrem"), true);
            addRem.Click += delegate {
                ReminderDoc r = LifeDialog.AskRem(Host);
                if (r == null) return;
                Host.Store.Data.reminders.Add(r);
                Host.Store.SaveReminders();
                FoxToast.Show(r.text);
                Bind();
                Host.DataChanged("reminders");
            };
            remRows.BackColor = T.Card;
            remRows.AutoScroll = true;
            remCard.Controls.Add(addRem);
            remCard.Controls.Add(remRows);
        }

        void FillReminders() {
            remRows.Controls.Clear();
            List<ReminderDoc> list = Host.Store.Data.reminders;
            int y = 0;
            int n = 0;
            for (int i = 0; i < list.Count; i++) {
                ReminderDoc r = list[i];
                if (r == null || r.done) continue;
                ReminderRow row = new ReminderRow(T, r);
                row.Location = new Point(0, y);
                row.Width = remRows.Width - 20;
                ReminderDoc copy = r;
                row.Done += delegate {
                    copy.done = true;
                    Host.Store.SaveReminders();
                    Bind();
                    Host.DataChanged("reminders");
                };
                row.Edit += delegate {
                    if (LifeDialog.AskRem(Host, copy) == null) return;
                    Host.Store.SaveReminders();
                    Bind();
                    Host.DataChanged("reminders");
                };
                tips.SetToolTip(row, I18n.T("hint.rem"));
                remRows.Controls.Add(row);
                y += row.Height + 2;
                n++;
            }
            if (n == 0) {
                Label empty = FoxUi.Label(T, I18n.T("rem.none"), T.Small, T.Muted);
                empty.Location = new Point(8, 8);
                remRows.Controls.Add(empty);
            }
        }

        // ── shared ───────────────────────────────────────────────

        void StyleGhost(Button b, string text, bool primary) {
            b.Text = text;
            b.Font = T.Body;
            b.FlatStyle = FlatStyle.Flat;
            b.Cursor = Cursors.Hand;
            b.Width = 152;
            b.Height = 30;
            if (primary) {
                b.FlatAppearance.BorderSize = 0;
                b.BackColor = T.Accent;
                b.ForeColor = Color.White;
                b.FlatAppearance.MouseOverBackColor = FoxTheme.Darken(T.Accent, 12);
            } else {
                b.FlatAppearance.BorderSize = 1;
                b.FlatAppearance.BorderColor = T.Line;
                b.FlatAppearance.MouseOverBackColor = T.AccentSoft;
                b.BackColor = T.Card;
                b.ForeColor = T.Muted;
            }
        }

        // Keep the page where it is when a text box inside a card takes focus
        // (default AutoScroll behaviour would yank the card to the top).
        protected override Point ScrollToControl(Control activeControl) {
            return DisplayRectangle.Location;
        }

        public override void Bind() {
            LayoutCards();
            FillNotes();
            FillFinance();
            FillReminders();
        }
    }
}
