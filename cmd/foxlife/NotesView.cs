using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.Windows.Forms;
using FoxOs.Sdk;

namespace FoxOs.Life {

    public class NotesView : LifeView {
        readonly ListBox list = new ListBox();
        readonly TextBox search = new TextBox();
        readonly TextBox title = new TextBox();
        readonly TextBox tags = new TextBox();
        readonly TextBox body = new TextBox();
        readonly ComboBox category = new ComboBox();
        readonly ComboBox kind = new ComboBox();
        readonly Panel checks = new Panel();
        readonly Panel editorCard = new Panel();
        readonly Panel empty = new Panel();
        readonly Panel aiBox = new Panel();
        string aiText = "";
        string emptyText = "";
        NoteDoc current;
        bool quiet;

        public NotesView(ILifeHost host) : base(host) {
            Padding = new Padding(18);
            BackColor = T.Paper;
            FoxUi.Buffer(this);

            Panel top = new Panel();
            top.Dock = DockStyle.Top;
            top.Height = 48;
            top.BackColor = T.Paper;
            FoxUi.Buffer(top);
            search = FoxUi.Field(T);
            search.Width = 220;
            search.Location = new Point(0, 8);
            search.GotFocus += delegate { if (search.Text == I18n.T("search")) search.Text = ""; };
            search.TextChanged += delegate { if (!quiet) FillList(); };
            Button neu = FoxUi.Button(T, I18n.T("new"), true);
            neu.Width = 90;
            neu.Location = new Point(232, 6);
            neu.Click += delegate { NewNote(); };
            Button del = FoxUi.Button(T, I18n.T("delete"), false);
            del.Width = 90;
            del.Location = new Point(328, 6);
            del.Click += delegate { DeleteNote(); };
            top.Controls.Add(search);
            top.Controls.Add(neu);
            top.Controls.Add(del);

            list.Dock = DockStyle.Left;
            list.Width = 280;
            list.IntegralHeight = false;
            list.BorderStyle = BorderStyle.None;
            list.BackColor = T.Card;
            list.ForeColor = T.Ink;
            list.Font = T.Body;
            list.DrawMode = DrawMode.OwnerDrawFixed;
            list.ItemHeight = 64;
            list.DrawItem += DrawRow;
            list.SelectedIndexChanged += delegate { OpenSelected(); };
            FoxUi.Buffer(list);

            Panel editor = new Panel();
            editor.Dock = DockStyle.Fill;
            editor.BackColor = T.Paper;
            editor.Padding = new Padding(16, 0, 0, 0);
            FoxUi.Buffer(editor);

            title = FoxUi.Field(T);
            title.Font = T.Head;
            title.Dock = DockStyle.Top;
            title.Height = 32;

            Panel meta = new Panel();
            meta.Dock = DockStyle.Top;
            meta.Height = 44;
            meta.BackColor = T.Paper;
            FoxUi.Buffer(meta);
            category = FoxUi.Combo(T);
            category.Width = 140;
            category.Location = new Point(0, 8);
            kind = FoxUi.Combo(T);
            kind.Width = 140;
            kind.Location = new Point(150, 8);
            tags = FoxUi.Field(T);
            tags.Width = 180;
            tags.Location = new Point(300, 8);
            meta.Controls.Add(category);
            meta.Controls.Add(kind);
            meta.Controls.Add(tags);

            editorCard.Dock = DockStyle.Fill;
            editorCard.BackColor = T.Paper;
            editorCard.Padding = new Padding(12, 12, 12, 12);
            FoxUi.Buffer(editorCard);
            editorCard.Paint += PaintEditorCard;

            body.Multiline = true;
            body.ScrollBars = ScrollBars.Vertical;
            body.Dock = DockStyle.Fill;
            body.BorderStyle = BorderStyle.None;
            body.BackColor = T.Card;
            body.ForeColor = T.Ink;
            body.Font = T.Body;

            checks.Dock = DockStyle.Fill;
            checks.BackColor = T.Card;
            checks.AutoScroll = true;
            checks.Visible = false;
            checks.Paint += PaintChecksBg;
            FoxUi.Buffer(checks);

            editorCard.Controls.Add(body);
            editorCard.Controls.Add(checks);

            aiBox.Dock = DockStyle.Bottom;
            aiBox.Height = 76;
            aiBox.BackColor = T.Paper;
            aiBox.Paint += PaintAiBox;
            FoxUi.Buffer(aiBox);

            Button save = FoxUi.Button(T, I18n.T("save"), true);
            save.Dock = DockStyle.Bottom;
            save.Height = 36;
            save.Click += delegate { Persist(); };

            editor.Controls.Add(editorCard);
            editor.Controls.Add(aiBox);
            editor.Controls.Add(save);
            editor.Controls.Add(meta);
            editor.Controls.Add(title);

            empty.Dock = DockStyle.Fill;
            empty.BackColor = T.Paper;
            empty.Visible = false;
            empty.Paint += PaintEmpty;
            FoxUi.Buffer(empty);

            Controls.Add(editor);
            Controls.Add(list);
            Controls.Add(empty);
            Controls.Add(top);

            kind.SelectedIndexChanged += delegate { ToggleKind(); };
        }

        void PrepGfx(Graphics g) {
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.PixelOffsetMode = PixelOffsetMode.HighQuality;
            g.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;
            g.CompositingQuality = CompositingQuality.HighQuality;
        }

        void PaintEditorCard(object sender, PaintEventArgs e) {
            Graphics g = e.Graphics;
            PrepGfx(g);
            g.Clear(T.Paper);
            Rectangle r = new Rectangle(0, 0, editorCard.Width - 1, editorCard.Height - 1);
            FoxUi.PaintCard(g, r, T.Card, T.Line);
        }

        void PaintChecksBg(object sender, PaintEventArgs e) {
            Graphics g = e.Graphics;
            PrepGfx(g);
            using (SolidBrush b = new SolidBrush(T.Card)) {
                g.FillRectangle(b, checks.ClientRectangle);
            }
        }

        void PaintAiBox(object sender, PaintEventArgs e) {
            Graphics g = e.Graphics;
            PrepGfx(g);
            g.Clear(T.Paper);
            Rectangle r = new Rectangle(0, 4, aiBox.Width - 1, aiBox.Height - 5);
            using (GraphicsPath p = FoxUi.Round(r, 10))
            using (SolidBrush bg = new SolidBrush(T.AccentSoft)) {
                g.FillPath(bg, p);
            }
            using (SolidBrush ink = new SolidBrush(T.Muted))
            using (StringFormat sf = new StringFormat()) {
                sf.Trimming = StringTrimming.EllipsisCharacter;
                g.DrawString(aiText ?? "", T.Small, ink,
                    new RectangleF(12, 14, Math.Max(10, aiBox.Width - 24), aiBox.Height - 24), sf);
            }
        }

        void SetAiText(string text) {
            aiText = text ?? "";
            aiBox.Invalidate();
        }

        void PaintEmpty(object sender, PaintEventArgs e) {
            Graphics g = e.Graphics;
            PrepGfx(g);
            g.Clear(T.Paper);
            using (SolidBrush mute = new SolidBrush(T.Muted))
            using (StringFormat sf = new StringFormat()) {
                sf.Alignment = StringAlignment.Center;
                sf.LineAlignment = StringAlignment.Center;
                g.DrawString(emptyText ?? "", T.Body, mute, empty.ClientRectangle, sf);
            }
        }

        public override void Bind() {
            quiet = true;
            search.Text = I18n.T("search");
            FillCats();
            FillList();
            quiet = false;
            if (list.Items.Count == 0) {
                emptyText = I18n.T("notes.empty");
                empty.Visible = true;
                empty.Invalidate();
                empty.BringToFront();
            } else {
                empty.Visible = false;
                if (list.SelectedIndex < 0) list.SelectedIndex = 0;
            }
        }

        void FillCats() {
            category.Items.Clear();
            category.Items.AddRange(new object[] {
                I18n.T("cat.work"), I18n.T("cat.personal"), I18n.T("cat.ideas"), I18n.T("cat.other")
            });
            kind.Items.Clear();
            kind.Items.AddRange(new object[] {
                I18n.T("kind.note"), I18n.T("kind.check"), I18n.T("kind.idea")
            });
        }

        void FillList() {
            string q = search.Text ?? "";
            if (q == I18n.T("search")) q = "";
            q = q.Trim().ToLowerInvariant();
            list.Items.Clear();
            List<NoteDoc> notes = Host.Store.Data.notes;
            for (int i = 0; i < notes.Count; i++) {
                NoteDoc n = notes[i];
                if (n == null) continue;
                if (q.Length > 0 && !Matches(n, q)) continue;
                list.Items.Add(n);
            }
        }

        static bool Matches(NoteDoc n, string q) {
            if ((n.title ?? "").ToLowerInvariant().IndexOf(q) >= 0) return true;
            if ((n.body ?? "").ToLowerInvariant().IndexOf(q) >= 0) return true;
            if ((n.category ?? "").ToLowerInvariant().IndexOf(q) >= 0) return true;
            if (n.tags != null) {
                for (int i = 0; i < n.tags.Count; i++) {
                    if ((n.tags[i] ?? "").ToLowerInvariant().IndexOf(q) >= 0) return true;
                }
            }
            return false;
        }

        void DrawRow(object sender, DrawItemEventArgs e) {
            Graphics g = e.Graphics;
            PrepGfx(g);
            using (SolidBrush paper = new SolidBrush(T.Card)) {
                g.FillRectangle(paper, e.Bounds);
            }
            if (e.Index < 0 || e.Index >= list.Items.Count) return;
            NoteDoc n = list.Items[e.Index] as NoteDoc;
            if (n == null) return;

            bool sel = (e.State & DrawItemState.Selected) != 0;
            Rectangle card = new Rectangle(e.Bounds.X + 6, e.Bounds.Y + 4, e.Bounds.Width - 12, e.Bounds.Height - 8);
            using (GraphicsPath path = FoxUi.Round(card, 12))
            using (SolidBrush bg = new SolidBrush(sel ? T.AccentSoft : T.Paper)) {
                g.FillPath(bg, path);
                if (sel) {
                    using (Pen ring = new Pen(Color.FromArgb(90, T.Accent), 1.4f)) {
                        g.DrawPath(ring, path);
                    }
                }
            }

            Color tint = T.ForCategory(n.category);
            FoxUi.PaintDot(g, card.X + 12, card.Y + 14, 10, tint);

            string kindGlyph = n.kind == "check" ? "\uE73A" : n.kind == "idea" ? "\uE82F" : "\uE70B";
            using (SolidBrush mute = new SolidBrush(T.Muted)) {
                g.DrawString(kindGlyph, T.Icon, mute, card.Right - 28, card.Y + 10);
            }

            using (SolidBrush ink = new SolidBrush(sel ? T.Accent : T.Ink))
            using (StringFormat sf = new StringFormat()) {
                sf.Trimming = StringTrimming.EllipsisCharacter;
                sf.FormatFlags = StringFormatFlags.NoWrap;
                RectangleF titleBox = new RectangleF(card.X + 30, card.Y + 8, Math.Max(10, card.Width - 64), 22);
                g.DrawString(n.title ?? "", T.Head, ink, titleBox, sf);
            }

            int chipX = card.X + 30;
            int chipY = card.Y + 34;
            string cat = CatName(n.category);
            chipX += FoxUi.PaintChip(g, chipX, chipY, cat, tint, T.Small, false) + 6;
            if (n.tags != null && n.tags.Count > 0) {
                string tag = n.tags[0] ?? "";
                if (tag.Length > 14) tag = tag.Substring(0, 14) + "…";
                if (tag.Length > 0) {
                    FoxUi.PaintChip(g, chipX, chipY, tag, T.Muted, T.Small, false);
                }
            }
        }

        string CatName(string id) {
            if (id == "work") return I18n.T("cat.work");
            if (id == "personal") return I18n.T("cat.personal");
            if (id == "ideas") return I18n.T("cat.ideas");
            return I18n.T("cat.other");
        }

        string CatId(int idx) {
            if (idx == 0) return "work";
            if (idx == 1) return "personal";
            if (idx == 2) return "ideas";
            return "other";
        }

        string KindId(int idx) {
            if (idx == 1) return "check";
            if (idx == 2) return "idea";
            return "note";
        }

        int KindIdx(string id) {
            if (id == "check") return 1;
            if (id == "idea") return 2;
            return 0;
        }

        int CatIdx(string id) {
            if (id == "work") return 0;
            if (id == "personal") return 1;
            if (id == "ideas") return 2;
            return 3;
        }

        void OpenSelected() {
            if (list.SelectedItem == null) return;
            current = list.SelectedItem as NoteDoc;
            if (current == null) return;
            quiet = true;
            title.Text = current.title ?? "";
            tags.Text = current.tags != null ? string.Join(", ", current.tags.ToArray()) : "";
            body.Text = current.body ?? "";
            category.SelectedIndex = CatIdx(current.category);
            kind.SelectedIndex = KindIdx(current.kind);
            SetAiText(I18n.T("notes.summary") + "\n" + Host.Ai.SummarizeNote(current));
            quiet = false;
            ToggleKind();
            editorCard.Invalidate();
        }

        void ToggleKind() {
            bool check = kind.SelectedIndex == 1;
            body.Visible = !check;
            checks.Visible = check;
            body.Dock = check ? DockStyle.None : DockStyle.Fill;
            checks.Dock = check ? DockStyle.Fill : DockStyle.None;
            if (check) {
                body.Size = Size.Empty;
                RebuildChecks();
            } else {
                checks.Size = Size.Empty;
            }
            editorCard.Invalidate();
        }

        void RebuildChecks() {
            checks.Controls.Clear();
            if (current == null) return;
            if (current.items == null) current.items = new List<NoteItem>();
            int y = 14;
            for (int i = 0; i < current.items.Count; i++) {
                NoteItem it = current.items[i];
                CheckBox cb = new CheckBox();
                cb.Text = it.text ?? "";
                cb.Checked = it.done;
                cb.Font = T.Body;
                cb.ForeColor = it.done ? T.Muted : T.Ink;
                cb.BackColor = T.Card;
                cb.FlatStyle = FlatStyle.Flat;
                cb.Location = new Point(16, y);
                cb.Width = Math.Max(200, checks.ClientSize.Width - 32);
                cb.Height = 26;
                int idx = i;
                cb.CheckedChanged += delegate {
                    if (idx < current.items.Count) {
                        current.items[idx].done = cb.Checked;
                        cb.ForeColor = cb.Checked ? T.Muted : T.Ink;
                    }
                };
                checks.Controls.Add(cb);
                y += 30;
            }
            Button add = FoxUi.Button(T, I18n.T("item.add"), false);
            add.Location = new Point(16, y + 6);
            add.Width = 140;
            add.Click += delegate {
                string name = LifeDialog.Ask(Host, I18n.T("item.add"), I18n.T("title"), "");
                if (string.IsNullOrEmpty(name)) return;
                NoteItem it = new NoteItem();
                it.text = name;
                it.done = false;
                current.items.Add(it);
                RebuildChecks();
            };
            checks.Controls.Add(add);
        }

        void NewNote() {
            NoteDoc n = new NoteDoc();
            n.id = LifeStore.NewId();
            n.title = I18n.T("kind.note");
            n.kind = "note";
            n.category = "personal";
            n.created = LifeStore.Now();
            n.updated = n.created;
            Host.Store.Data.notes.Insert(0, n);
            Host.Store.SaveNotes();
            FillList();
            list.SelectedIndex = 0;
            Host.DataChanged("notes");
        }

        void DeleteNote() {
            if (current == null) return;
            Host.Store.Data.notes.Remove(current);
            Host.Store.SaveNotes();
            current = null;
            FillList();
            Host.DataChanged("notes");
        }

        void Persist() {
            if (current == null) return;
            current.title = title.Text.Trim();
            if (current.title.Length == 0) current.title = I18n.T("kind.note");
            current.body = body.Text;
            current.category = CatId(category.SelectedIndex);
            current.kind = KindId(kind.SelectedIndex);
            current.updated = LifeStore.Now();
            current.tags = new List<string>();
            string[] parts = (tags.Text ?? "").Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries);
            for (int i = 0; i < parts.Length; i++) current.tags.Add(parts[i].Trim());
            Host.Store.SaveNotes();
            FillList();
            SetAiText(I18n.T("notes.summary") + "\n" + Host.Ai.SummarizeNote(current));
            Host.DataChanged("notes");
            Host.Toast(I18n.T("save"));
        }
    }
}
