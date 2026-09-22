using System;
using System.Collections.Generic;
using System.Drawing;
using System.Windows.Forms;
using FoxOs.Sdk;

namespace FoxOs.Life {

    public class TablesView : LifeView {
        readonly ComboBox picker = new ComboBox();
        readonly TextBox filter = new TextBox();
        readonly DataGridView grid = new DataGridView();
        TableDoc current;
        bool quiet;

        public TablesView(ILifeHost host) : base(host) {
            Padding = new Padding(18);

            Panel bar = new Panel();
            bar.Dock = DockStyle.Top;
            bar.Height = 44;
            bar.BackColor = T.Paper;
            picker = FoxUi.Combo(T);
            picker.Width = 150;
            picker.Location = new Point(0, 6);
            picker.SelectedIndexChanged += delegate { if (!quiet) OpenSelected(); };
            filter = FoxUi.Field(T);
            filter.Width = 130;
            filter.Location = new Point(158, 6);
            filter.TextChanged += delegate { ApplyFilter(); };
            Button neu = FoxUi.Button(T, "\uE710", true);
            neu.Font = T.Icon;
            neu.Padding = new Padding(0);
            neu.Width = 34;
            neu.Location = new Point(296, 4);
            neu.Click += delegate { NewTable(); };
            Button col = FoxUi.Button(T, I18n.T("tbl.addcol"), false);
            col.Width = 86;
            col.Location = new Point(336, 4);
            col.Click += delegate { AddCol(); };
            Button row = FoxUi.Button(T, I18n.T("tbl.addrow"), false);
            row.Width = 76;
            row.Location = new Point(428, 4);
            row.Click += delegate { AddRow(); };
            Button del = FoxUi.Button(T, "\uE74D", false);
            del.Font = T.Icon;
            del.Padding = new Padding(0);
            del.ForeColor = T.Danger;
            del.Width = 34;
            del.Location = new Point(510, 4);
            del.Anchor = AnchorStyles.Top | AnchorStyles.Right;
            del.Click += delegate { DeleteTable(); };
            bar.Resize += delegate { del.Location = new Point(Math.Max(510, bar.Width - 40), 4); };
            bar.Controls.Add(picker);
            bar.Controls.Add(filter);
            bar.Controls.Add(neu);
            bar.Controls.Add(col);
            bar.Controls.Add(row);
            bar.Controls.Add(del);

            grid.Dock = DockStyle.Fill;
            grid.AllowUserToAddRows = false;
            FoxUi.StyleGrid(grid, T);
            grid.CellEndEdit += delegate { PersistGrid(); };
            grid.ColumnHeaderMouseClick += SortHeader;
            // Header double-click renames the column; right-click removes it.
            grid.ColumnHeaderMouseDoubleClick += delegate(object s, DataGridViewCellMouseEventArgs e) {
                if (e.Button == MouseButtons.Left) RenameCol(e.ColumnIndex);
            };
            // Delete key removes the selected rows.
            grid.KeyDown += delegate(object s, KeyEventArgs e) {
                if (e.KeyCode == Keys.Delete && !grid.IsCurrentCellInEditMode) { e.Handled = true; DeleteRows(); }
            };
            // Double-click the table name to rename the table.
            picker.MouseDoubleClick += delegate { RenameTable(); };

            Controls.Add(grid);
            Controls.Add(bar);
        }

        public override void Bind() {
            quiet = true;
            filter.Text = I18n.T("tbl.filter");
            picker.Items.Clear();
            List<TableDoc> tables = Host.Store.Data.tables;
            int pick = 0;
            for (int i = 0; i < tables.Count; i++) {
                if (tables[i] == null) continue;
                picker.Items.Add(tables[i].name);
                if (current != null && current.id == tables[i].id) pick = picker.Items.Count - 1;
            }
            if (picker.Items.Count > 0) picker.SelectedIndex = pick;
            quiet = false;
            OpenSelected();
        }

        void OpenSelected() {
            current = null;
            if (picker.SelectedIndex < 0) {
                grid.Columns.Clear();
                grid.Rows.Clear();
                return;
            }
            int n = -1;
            List<TableDoc> tables = Host.Store.Data.tables;
            for (int i = 0; i < tables.Count; i++) {
                if (tables[i] == null) continue;
                n++;
                if (n == picker.SelectedIndex) { current = tables[i]; break; }
            }
            RebuildGrid();
        }

        void RebuildGrid() {
            grid.Columns.Clear();
            grid.Rows.Clear();
            if (current == null) return;
            if (current.columns == null) current.columns = new List<TableCol>();
            grid.Columns.Add("id", "id");
            grid.Columns["id"].Visible = false;
            for (int i = 0; i < current.columns.Count; i++) {
                TableCol c = current.columns[i];
                if (c == null) continue;
                grid.Columns.Add(c.id, c.name);
            }
            if (current.rows == null) current.rows = new List<TableRow>();
            for (int i = 0; i < current.rows.Count; i++) {
                TableRow r = current.rows[i];
                if (r == null) continue;
                object[] cells = new object[current.columns.Count + 1];
                cells[0] = r.id;
                for (int c = 0; c < current.columns.Count; c++) {
                    string key = current.columns[c].id;
                    string val = "";
                    if (r.cells != null && r.cells.ContainsKey(key)) val = r.cells[key];
                    cells[c + 1] = val;
                }
                grid.Rows.Add(cells);
            }
            ApplyFilter();
        }

        void ApplyFilter() {
            string q = filter.Text ?? "";
            if (q == I18n.T("tbl.filter")) q = "";
            q = q.Trim().ToLowerInvariant();
            for (int i = 0; i < grid.Rows.Count; i++) {
                bool show = q.Length == 0;
                if (!show) {
                    for (int c = 1; c < grid.Columns.Count; c++) {
                        object v = grid.Rows[i].Cells[c].Value;
                        if (v != null && v.ToString().ToLowerInvariant().IndexOf(q) >= 0) {
                            show = true;
                            break;
                        }
                    }
                }
                grid.Rows[i].Visible = show;
            }
        }

        void PersistGrid() {
            if (current == null) return;
            for (int i = 0; i < grid.Rows.Count; i++) {
                object idObj = grid.Rows[i].Cells[0].Value;
                if (idObj == null) continue;
                string id = idObj.ToString();
                TableRow row = FindRow(id);
                if (row == null) continue;
                if (row.cells == null) row.cells = new Dictionary<string, string>();
                for (int c = 0; c < current.columns.Count; c++) {
                    object v = grid.Rows[i].Cells[c + 1].Value;
                    row.cells[current.columns[c].id] = v != null ? v.ToString() : "";
                }
            }
            Host.Store.SaveTables();
            Host.DataChanged("tables");
        }

        TableRow FindRow(string id) {
            if (current.rows == null) return null;
            for (int i = 0; i < current.rows.Count; i++) {
                if (current.rows[i] != null && current.rows[i].id == id) return current.rows[i];
            }
            return null;
        }

        void NewTable() {
            string name = LifeDialog.Ask(Host, I18n.T("tbl.new"), I18n.T("title"), "");
            if (string.IsNullOrEmpty(name)) return;
            TableDoc t = new TableDoc();
            t.id = LifeStore.NewId();
            t.name = name;
            t.created = LifeStore.Today();
            TableCol c = new TableCol();
            c.id = "c1";
            c.name = I18n.T("tbl.col");
            c.type = "text";
            t.columns.Add(c);
            Host.Store.Data.tables.Add(t);
            Host.Store.SaveTables();
            current = t;
            Bind();
            Host.DataChanged("tables");
        }

        void AddCol() {
            if (current == null) return;
            string name = LifeDialog.Ask(Host, I18n.T("tbl.addcol"), I18n.T("title"), "");
            if (string.IsNullOrEmpty(name)) return;
            TableCol c = new TableCol();
            c.id = "c" + LifeStore.NewId();
            c.name = name;
            c.type = "text";
            current.columns.Add(c);
            Host.Store.SaveTables();
            RebuildGrid();
        }

        void AddRow() {
            if (current == null) return;
            TableRow r = new TableRow();
            r.id = LifeStore.NewId();
            current.rows.Add(r);
            Host.Store.SaveTables();
            RebuildGrid();
        }

        void DeleteTable() {
            if (current == null) return;
            Host.Store.Data.tables.Remove(current);
            Host.Store.SaveTables();
            current = null;
            Bind();
            Host.DataChanged("tables");
        }

        void SortHeader(object sender, DataGridViewCellMouseEventArgs e) {
            if (e.ColumnIndex <= 0) return;
            if (e.Button == MouseButtons.Right) {
                if (current.columns.Count <= 1) return;
                TableCol gone = FindCol(grid.Columns[e.ColumnIndex].Name);
                if (gone == null) return;
                if (MessageBox.Show(gone.name, I18n.T("delete") + "?", MessageBoxButtons.YesNo, MessageBoxIcon.Question) != DialogResult.Yes) return;
                current.columns.Remove(gone);
                Host.Store.SaveTables();
                RebuildGrid();
                Host.DataChanged("tables");
                return;
            }
            grid.Sort(grid.Columns[e.ColumnIndex], System.ComponentModel.ListSortDirection.Ascending);
        }

        TableCol FindCol(string id) {
            if (current == null || current.columns == null) return null;
            for (int i = 0; i < current.columns.Count; i++) {
                if (current.columns[i] != null && current.columns[i].id == id) return current.columns[i];
            }
            return null;
        }

        void RenameCol(int gridIndex) {
            if (current == null || gridIndex <= 0 || gridIndex >= grid.Columns.Count) return;
            TableCol c = FindCol(grid.Columns[gridIndex].Name);
            if (c == null) return;
            string name = LifeDialog.Ask(Host, I18n.T("rename.col"), I18n.T("title"), c.name ?? "");
            if (string.IsNullOrEmpty(name)) return;
            c.name = name;
            grid.Columns[gridIndex].HeaderText = name;
            Host.Store.SaveTables();
            Host.DataChanged("tables");
        }

        void RenameTable() {
            if (current == null) return;
            string name = LifeDialog.Ask(Host, I18n.T("edit"), I18n.T("title"), current.name ?? "");
            if (string.IsNullOrEmpty(name)) return;
            current.name = name;
            Host.Store.SaveTables();
            Bind();
            Host.DataChanged("tables");
        }

        void DeleteRows() {
            if (current == null || grid.SelectedCells.Count == 0) return;
            List<string> ids = new List<string>();
            foreach (DataGridViewCell cell in grid.SelectedCells) {
                object id = grid.Rows[cell.RowIndex].Cells[0].Value;
                if (id != null && !ids.Contains(id.ToString())) ids.Add(id.ToString());
            }
            if (ids.Count == 0) return;
            for (int i = 0; i < ids.Count; i++) {
                TableRow r = FindRow(ids[i]);
                if (r != null) current.rows.Remove(r);
            }
            Host.Store.SaveTables();
            RebuildGrid();
            Host.DataChanged("tables");
        }
    }
}
