using System;
using System.Drawing;
using System.Windows.Forms;
using FoxOs.Sdk;

namespace FoxOs.Nodes {

    sealed class SettingsForm : Form {
        readonly NodeStore store;
        readonly Func<HotkeySpec, bool> applyHotkey;
        readonly TextBox hotkeyBox;
        readonly Label hotkeyStatus;
        readonly TreeView catList;
        readonly TextBox titleBox;
        readonly TextBox pathBox;
        readonly TextBox argsBox;
        readonly ComboBox kindBox;
        readonly Button saveBtn;
        readonly CheckBox startCollapsedBox;
        readonly TrackBar glassBar;
        readonly TrackBar motionBar;
        MenuNodeSpec selectedItem;
        MenuNodeSpec selectedCat;

        public SettingsForm(NodeStore nodeStore, Func<HotkeySpec, bool> onHotkey) {
            store = nodeStore;
            applyHotkey = onHotkey;
            Text = "FoxNodes · налаштування";
            Size = new Size(760, 650);
            StartPosition = FormStartPosition.CenterScreen;
            Font = new Font("Segoe UI", 10f);
            BackColor = Color.FromArgb(28, 32, 42);
            ForeColor = Color.FromArgb(235, 240, 245);

            var top = new Panel { Dock = DockStyle.Top, Height = 72, BackColor = Color.FromArgb(22, 26, 36) };
            var hotLabel = new Label { Text = "Гаряча клавіша (Ctrl+Alt+Space за замовч.):", AutoSize = true, Location = new Point(12, 12), ForeColor = ForeColor };
            hotkeyBox = new TextBox { Location = new Point(12, 34), Width = 280, Text = NativeWin.HotkeyLabel(store.Config.hotkey) };
            hotkeyStatus = new Label { Location = new Point(300, 36), AutoSize = true, ForeColor = Color.FromArgb(250, 180, 120) };
            var applyHk = new Button { Text = "Застосувати", Location = new Point(520, 32), Width = 120 };
            applyHk.Click += delegate { TryApplyHotkey(); };
            top.Controls.Add(hotLabel);
            top.Controls.Add(hotkeyBox);
            top.Controls.Add(hotkeyStatus);
            top.Controls.Add(applyHk);

            catList = new TreeView {
                Dock = DockStyle.Fill,
                BackColor = Color.FromArgb(22, 26, 36),
                ForeColor = ForeColor,
                BorderStyle = BorderStyle.FixedSingle,
                HideSelection = false,
                AllowDrop = true
            };
            catList.AfterSelect += delegate { PickCategory(); };
            catList.ItemDrag += delegate(object s, ItemDragEventArgs e) {
                TreeNode node = e.Item as TreeNode;
                if (node != null && node.Parent != null)
                    catList.DoDragDrop(node, DragDropEffects.Move);
            };
            catList.DragEnter += delegate(object s, DragEventArgs e) {
                e.Effect = e.Data.GetDataPresent(typeof(TreeNode))
                    ? DragDropEffects.Move : DragDropEffects.None;
            };
            catList.DragDrop += MoveTreeNode;

            var treeHost = new Panel { Dock = DockStyle.Left, Width = 240 };
            var treeButtons = new FlowLayoutPanel {
                Dock = DockStyle.Bottom,
                Height = 68,
                Padding = new Padding(4),
                BackColor = Color.FromArgb(22, 26, 36)
            };
            Button addGroup = new Button { Text = "+ Група", Width = 72, Height = 26 };
            Button addAction = new Button { Text = "+ Дія", Width = 66, Height = 26 };
            Button remove = new Button { Text = "Видалити", Width = 82, Height = 26 };
            Button up = new Button { Text = "↑", Width = 34, Height = 26 };
            Button down = new Button { Text = "↓", Width = 34, Height = 26 };
            addGroup.Click += delegate { AddNode(true); };
            addAction.Click += delegate { AddNode(false); };
            remove.Click += delegate { RemoveNode(); };
            up.Click += delegate { MoveSelected(-1); };
            down.Click += delegate { MoveSelected(1); };
            treeButtons.Controls.AddRange(new Control[] { addGroup, addAction, remove, up, down });
            treeHost.Controls.Add(catList);
            treeHost.Controls.Add(treeButtons);

            var right = new Panel { Dock = DockStyle.Fill, Padding = new Padding(12) };
            titleBox = new TextBox { Width = 400, Location = new Point(0, 28) };
            kindBox = new ComboBox { Width = 200, Location = new Point(0, 78), DropDownStyle = ComboBoxStyle.DropDownList };
            kindBox.Items.AddRange(new object[] { "openExe", "openPath", "openUrl", "foxCommand", "internal", "(folder)" });
            pathBox = new TextBox { Width = 460, Location = new Point(0, 128) };
            argsBox = new TextBox { Width = 460, Location = new Point(0, 178) };
            saveBtn = new Button { Text = "Зберегти пункт", Location = new Point(0, 230), Width = 160 };
            saveBtn.Click += delegate { SaveItem(); };
            startCollapsedBox = new CheckBox {
                Text = "Після запуску показувати лише центральну кнопку",
                Location = new Point(0, 300),
                Width = 310,
                Checked = store.Config.startCollapsed,
                ForeColor = ForeColor
            };
            glassBar = new TrackBar {
                Location = new Point(0, 342),
                Width = 250,
                Minimum = 20,
                Maximum = 100,
                TickFrequency = 10,
                Value = Math.Max(20, Math.Min(100, store.Config.glassStrength))
            };
            motionBar = new TrackBar {
                Location = new Point(270, 342),
                Width = 250,
                Minimum = 50,
                Maximum = 160,
                TickFrequency = 10,
                Value = Math.Max(50, Math.Min(160, store.Config.motionPercent))
            };
            var saveVisual = new Button {
                Text = "Зберегти вигляд",
                Location = new Point(0, 402),
                Width = 160
            };
            saveVisual.Click += delegate {
                store.Config.startCollapsed = startCollapsedBox.Checked;
                store.Config.glassStrength = glassBar.Value;
                store.Config.motionPercent = motionBar.Value;
                store.Save();
                FoxToast.Show("foxnodes · вигляд збережено");
            };

            right.Controls.Add(new Label { Text = "Назва", Location = new Point(0, 8), AutoSize = true, ForeColor = ForeColor });
            right.Controls.Add(titleBox);
            right.Controls.Add(new Label { Text = "Тип дії", Location = new Point(0, 58), AutoSize = true, ForeColor = ForeColor });
            right.Controls.Add(kindBox);
            right.Controls.Add(new Label { Text = "Шлях / URL / команда", Location = new Point(0, 108), AutoSize = true, ForeColor = ForeColor });
            right.Controls.Add(pathBox);
            right.Controls.Add(new Label { Text = "Аргументи (exe)", Location = new Point(0, 158), AutoSize = true, ForeColor = ForeColor });
            right.Controls.Add(argsBox);
            right.Controls.Add(saveBtn);
            right.Controls.Add(new Label {
                Text = "Поведінка та liquid glass",
                Location = new Point(0, 276),
                AutoSize = true,
                ForeColor = ForeColor
            });
            right.Controls.Add(startCollapsedBox);
            right.Controls.Add(new Label {
                Text = "Скло",
                Location = new Point(0, 330),
                AutoSize = true,
                ForeColor = ForeColor
            });
            right.Controls.Add(glassBar);
            right.Controls.Add(new Label {
                Text = "Швидкість анімацій",
                Location = new Point(270, 330),
                AutoSize = true,
                ForeColor = ForeColor
            });
            right.Controls.Add(motionBar);
            right.Controls.Add(saveVisual);
            right.Controls.Add(new Label {
                Text = "Підказка: оберіть категорію зліва, редагуйте перший пункт або додайте в JSON.\r\nКонфіг: " + store.ConfigPath,
                Location = new Point(0, 455),
                Size = new Size(480, 80),
                ForeColor = Color.FromArgb(160, 170, 185)
            });

            Controls.Add(right);
            Controls.Add(treeHost);
            Controls.Add(top);

            ReloadCategories();
        }

        void ReloadCategories() {
            catList.Nodes.Clear();
            if (store.Config.categories == null) return;
            for (int i = 0; i < store.Config.categories.Count; i++) {
                catList.Nodes.Add(BuildTreeNode(store.Config.categories[i]));
            }
            catList.ExpandAll();
            if (catList.Nodes.Count > 0) catList.SelectedNode = catList.Nodes[0];
        }

        void PickCategory() {
            TreeNode tree = catList.SelectedNode;
            if (tree == null) return;
            MenuNodeSpec node = tree.Tag as MenuNodeSpec;
            if (node == null) return;
            selectedCat = tree.Parent == null ? node :
                RootOf(tree).Tag as MenuNodeSpec;
            selectedItem = node;
            FillItem(node);
        }

        TreeNode BuildTreeNode(MenuNodeSpec node) {
            var tree = new TreeNode(node.title) { Tag = node };
            if (node.children != null)
                for (int i = 0; i < node.children.Count; i++)
                    tree.Nodes.Add(BuildTreeNode(node.children[i]));
            return tree;
        }

        static TreeNode RootOf(TreeNode node) {
            while (node != null && node.Parent != null) node = node.Parent;
            return node;
        }

        void AddNode(bool group) {
            TreeNode targetTree = catList.SelectedNode;
            if (targetTree == null) return;
            MenuNodeSpec target = targetTree.Tag as MenuNodeSpec;
            if (target == null) return;
            if (target.action != null && targetTree.Parent != null) {
                targetTree = targetTree.Parent;
                target = targetTree.Tag as MenuNodeSpec;
            }
            if (target == null) return;
            if (target.children == null)
                target.children = new System.Collections.Generic.List<MenuNodeSpec>();
            var node = new MenuNodeSpec {
                id = Guid.NewGuid().ToString("N"),
                title = group ? "Нова група" : "Нова дія",
                icon = group ? "\uE8B7" : "\uE8A7",
                order = target.children.Count,
                action = group ? null : new MenuActionSpec { kind = "openPath" }
            };
            target.children.Add(node);
            NodeStore.Normalize(store.Config);
            store.Save();
            ReloadCategories();
            SelectNodeById(node.id, catList.Nodes);
        }

        void RemoveNode() {
            TreeNode tree = catList.SelectedNode;
            if (tree == null || tree.Parent == null) return;
            MenuNodeSpec parent = tree.Parent.Tag as MenuNodeSpec;
            MenuNodeSpec node = tree.Tag as MenuNodeSpec;
            if (parent == null || node == null || parent.children == null) return;
            parent.children.Remove(node);
            Reorder(parent.children);
            store.Save();
            ReloadCategories();
        }

        void MoveSelected(int delta) {
            TreeNode tree = catList.SelectedNode;
            if (tree == null || tree.Parent == null) return;
            MenuNodeSpec parent = tree.Parent.Tag as MenuNodeSpec;
            MenuNodeSpec node = tree.Tag as MenuNodeSpec;
            if (parent == null || node == null) return;
            int index = parent.children.IndexOf(node);
            int next = index + delta;
            if (index < 0 || next < 0 || next >= parent.children.Count) return;
            parent.children.RemoveAt(index);
            parent.children.Insert(next, node);
            Reorder(parent.children);
            store.Save();
            ReloadCategories();
            SelectNodeById(node.id, catList.Nodes);
        }

        void MoveTreeNode(object sender, DragEventArgs e) {
            TreeNode source = e.Data.GetData(typeof(TreeNode)) as TreeNode;
            Point pt = catList.PointToClient(new Point(e.X, e.Y));
            TreeNode targetTree = catList.GetNodeAt(pt);
            if (source == null || source.Parent == null || targetTree == null ||
                source == targetTree) return;
            for (TreeNode p = targetTree; p != null; p = p.Parent)
                if (p == source) return;
            MenuNodeSpec target = targetTree.Tag as MenuNodeSpec;
            if (target == null || target.action != null) return;
            MenuNodeSpec oldParent = source.Parent.Tag as MenuNodeSpec;
            MenuNodeSpec moved = source.Tag as MenuNodeSpec;
            if (oldParent == null || moved == null) return;
            oldParent.children.Remove(moved);
            if (target.children == null)
                target.children = new System.Collections.Generic.List<MenuNodeSpec>();
            target.children.Add(moved);
            Reorder(oldParent.children);
            Reorder(target.children);
            NodeStore.Normalize(store.Config);
            store.Save();
            ReloadCategories();
            SelectNodeById(moved.id, catList.Nodes);
        }

        static void Reorder(System.Collections.Generic.List<MenuNodeSpec> nodes) {
            if (nodes == null) return;
            for (int i = 0; i < nodes.Count; i++) nodes[i].order = i;
        }

        bool SelectNodeById(string id, TreeNodeCollection nodes) {
            foreach (TreeNode node in nodes) {
                MenuNodeSpec spec = node.Tag as MenuNodeSpec;
                if (spec != null && spec.id == id) {
                    catList.SelectedNode = node;
                    node.EnsureVisible();
                    return true;
                }
                if (SelectNodeById(id, node.Nodes)) return true;
            }
            return false;
        }

        void FillItem(MenuNodeSpec n) {
            titleBox.Text = n.title;
            if (n.action == null) {
                kindBox.SelectedIndex = 5;
                pathBox.Text = "";
                argsBox.Text = "";
                return;
            }
            string k = n.action.kind ?? "";
            int ki = kindBox.Items.IndexOf(k);
            kindBox.SelectedIndex = ki >= 0 ? ki : 0;
            pathBox.Text = FirstNonEmpty(n.action.path, n.action.url, n.action.command);
            argsBox.Text = n.action.args ?? "";
        }

        static string FirstNonEmpty(params string[] parts) {
            for (int i = 0; i < parts.Length; i++) {
                if (!string.IsNullOrEmpty(parts[i])) return parts[i];
            }
            return "";
        }

        void SaveItem() {
            if (selectedCat == null) return;
            if (selectedCat.children == null) selectedCat.children = new System.Collections.Generic.List<MenuNodeSpec>();
            if (selectedItem == null) {
                selectedItem = new MenuNodeSpec();
                selectedItem.id = Guid.NewGuid().ToString("N");
                selectedItem.order = selectedCat.children.Count;
                selectedCat.children.Add(selectedItem);
            }
            selectedItem.title = titleBox.Text.Trim();
            string kind = kindBox.SelectedItem as string;
            if (kind == "(folder)" || string.IsNullOrEmpty(kind)) {
                selectedItem.action = null;
            } else {
                if (selectedItem.action == null) selectedItem.action = new MenuActionSpec();
                selectedItem.action.kind = kind;
                selectedItem.action.args = argsBox.Text.Trim();
                selectedItem.action.path = "";
                selectedItem.action.url = "";
                selectedItem.action.command = "";
                if (kind == "openUrl") selectedItem.action.url = pathBox.Text.Trim();
                else if (kind == "foxCommand" || kind == "internal") selectedItem.action.command = pathBox.Text.Trim();
                else selectedItem.action.path = pathBox.Text.Trim();
            }
            NodeStore.Normalize(store.Config);
            store.Save();
            string savedId = selectedItem.id;
            ReloadCategories();
            SelectNodeById(savedId, catList.Nodes);
            FoxToast.Show("foxnodes · збережено");
        }

        void TryApplyHotkey() {
            HotkeySpec hk = ParseHotkey(hotkeyBox.Text);
            if (hk == null) {
                hotkeyStatus.Text = "Не вдалось розібрати";
                return;
            }
            store.Config.hotkey = hk;
            store.Save();
            if (applyHotkey != null) {
                bool ok = applyHotkey(hk);
                hotkeyStatus.Text = ok ? "OK" : "Зайнята або помилка";
            } else {
                hotkeyStatus.Text = "Збережено (перезапустіть daemon)";
            }
        }

        static HotkeySpec ParseHotkey(string text) {
            if (string.IsNullOrWhiteSpace(text)) return null;
            var hk = new HotkeySpec();
            hk.ctrl = hk.alt = hk.shift = hk.win = false;
            string[] parts = text.Split('+');
            for (int i = 0; i < parts.Length; i++) {
                string p = parts[i].Trim();
                if (p.Length == 0) continue;
                if (string.Equals(p, "Ctrl", StringComparison.OrdinalIgnoreCase)) { hk.ctrl = true; continue; }
                if (string.Equals(p, "Alt", StringComparison.OrdinalIgnoreCase)) { hk.alt = true; continue; }
                if (string.Equals(p, "Shift", StringComparison.OrdinalIgnoreCase)) { hk.shift = true; continue; }
                if (string.Equals(p, "Win", StringComparison.OrdinalIgnoreCase)) { hk.win = true; continue; }
                hk.key = p;
            }
            if (string.IsNullOrEmpty(hk.key)) hk.key = "Space";
            return hk;
        }
    }
}
