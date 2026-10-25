using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Threading;
using System.Windows.Forms;
using FoxOs.Assistant;
using FoxOs.Sdk;

namespace FoxOs.Style {

    public sealed class NodeStudioView : Panel {
        readonly FoxTheme theme;
        readonly StyleStore styleStore;
        readonly NodeEditorRepository repo = new NodeEditorRepository();
        NodeEditorDocument applied;
        NodeEditorDocument draft;
        StyleDoc appliedStyle;
        StyleDoc styleDraft;
        AssistantConfig assistantDraft;
        readonly Stack<string> undo = new Stack<string>();
        readonly Stack<string> redo = new Stack<string>();
        bool dirty;
        bool rebuilding;
        string selectedId = "";
        EditorNode selected;
        bool centralSelected;

        readonly Panel top = new Panel();
        readonly Panel pageNav = new Panel();
        readonly Panel pageHost = new Panel();
        readonly Label profileLabel = new Label();
        readonly Label status = new Label();
        readonly Button undoButton;
        readonly Button redoButton;
        readonly Button modeButton;
        readonly Button applyButton;
        readonly Button cancelButton;
        readonly Button leftToggle;
        readonly Button rightToggle;
        readonly List<Button> pages = new List<Button>();
        int nextPageX = 12;
        string currentPage = "editor";
        bool testMode;
        string lookPreset = "";
        string lastApplyDetail = "";

        Panel leftPanel;
        Panel rightPanel;
        TreeView tree;
        TextBox search;
        NodePreviewCanvas canvas;
        NodePreviewCanvas settingsPreview;
        ComboBox backgroundChoice;
        Label dropStatus;
        TreeNode draggedTree;
        string dropMode = "";
        TreeNode dropTarget;

        public NodeStudioView(FoxTheme t, StyleStore store) {
            theme = t;
            styleStore = store;
            Dock = DockStyle.Fill;
            Font = new Font("Segoe UI", 9.5f);
            BackColor = theme.Paper;
            ForeColor = theme.Ink;
            FoxUi.Buffer(this);

            string error;
            applied = repo.Load(out error);
            draft = NodeEditorRepository.Clone(applied);
            appliedStyle = NodeEditorRepository.Clone(styleStore.Doc);
            styleDraft = NodeEditorRepository.Clone(appliedStyle);
            assistantDraft = AssistantStore.Load();
            if (string.IsNullOrEmpty(assistantDraft.micName)) {
                List<MicInfo> mics = AssistantMics.List();
                for (int i = 0; i < mics.Count; i++)
                    if (mics[i].preferred) { assistantDraft.micName = mics[i].name; break; }
                if (string.IsNullOrEmpty(assistantDraft.micName) && mics.Count > 0)
                    assistantDraft.micName = mics[0].name;
            }

            pageHost.Dock = DockStyle.Fill;
            pageHost.BackColor = theme.Paper;
            Controls.Add(pageHost);
            pageNav.Dock = DockStyle.Top;
            pageNav.Height = 46;
            pageNav.BackColor = theme.Sidebar;
            Controls.Add(pageNav);
            top.Dock = DockStyle.Top;
            top.Height = 62;
            top.BackColor = theme.Sidebar;
            Controls.Add(top);

            profileLabel.Text = "Node Launcher · Чернетка";
            profileLabel.Font = new Font("Segoe UI Semibold", 13f, FontStyle.Bold);
            profileLabel.ForeColor = theme.Ink;
            profileLabel.AutoSize = true;
            profileLabel.Location = new Point(18, 9);
            top.Controls.Add(profileLabel);
            status.Text = string.IsNullOrEmpty(error) ? "Збережено" : error;
            status.Font = theme.Small;
            status.ForeColor = string.IsNullOrEmpty(error) ? theme.Good : theme.Danger;
            status.AutoSize = true;
            status.Location = new Point(20, 37);
            top.Controls.Add(status);

            undoButton = ToolButton("Скасувати", 96);
            redoButton = ToolButton("Повторити", 96);
            modeButton = ToolButton("Редагування", 128);
            leftToggle = ToolButton("Структура", 100);
            rightToggle = ToolButton("Властивості", 112);
            cancelButton = ToolButton("Відкинути", 92);
            applyButton = FoxUi.Button(theme, "Застосувати", true);
            applyButton.Size = new Size(116, 34);
            undoButton.Click += delegate { Undo(); };
            redoButton.Click += delegate { Redo(); };
            modeButton.Click += delegate { ToggleTestMode(); };
            leftToggle.Click += delegate { if (leftPanel != null) leftPanel.Visible = !leftPanel.Visible; };
            rightToggle.Click += delegate { if (rightPanel != null) rightPanel.Visible = !rightPanel.Visible; };
            cancelButton.Click += delegate { RevertDraft(); };
            applyButton.Click += delegate { ApplyChanges(); };
            top.Controls.Add(undoButton); top.Controls.Add(redoButton);
            top.Controls.Add(modeButton); top.Controls.Add(leftToggle); top.Controls.Add(rightToggle);
            top.Controls.Add(cancelButton); top.Controls.Add(applyButton);
            top.Resize += delegate { LayoutTop(); };
            LayoutTop();

            AddPageButton("editor", "", "Редактор меню");
            AddPageButton("appearance", "", "Вигляд");
            AddPageButton("motion", "", "Анімації");
            AddPageButton("control", "", "Керування й кишеня");
            AddPageButton("profiles", "", "Профілі");
            AddPageButton("assistant", "", "Помічник");

            Resize += delegate { ApplyResponsiveLayout(); };
            ApplyThemeFromDraft();
            ShowPage("editor");
            SetDirty(false);
        }

        protected override bool ProcessCmdKey(ref Message msg, Keys keyData) {
            if (HandleCommandKeys(keyData)) return true;
            return base.ProcessCmdKey(ref msg, keyData);
        }

        public bool HandleCommandKeys(Keys keyData) {
            if (keyData == (Keys.Control | Keys.Z)) { Undo(); return true; }
            if (keyData == (Keys.Control | Keys.Y)) { Redo(); return true; }
            if (keyData == (Keys.Control | Keys.S)) { ApplyChanges(); return true; }
            Form host = FindForm();
            Control focus = host != null ? host.ActiveControl : null;
            if (keyData == Keys.Delete && currentPage == "editor" &&
                !(focus is TextBox) && !(focus is ComboBox) &&
                !(focus is NumericUpDown)) {
                DeleteSelected();
                return true;
            }
            return false;
        }

        public void SyncFromStoreIfClean() {
            if (dirty) return;
            appliedStyle = NodeEditorRepository.Clone(styleStore.Doc);
            styleDraft = NodeEditorRepository.Clone(appliedStyle);
            ApplyThemeFromDraft();
            ShowPage(currentPage);
        }

        void ApplyThemeFromDraft() {
            if (styleDraft == null || styleDraft.colors == null) return;
            Color bg = ParseHex(styleDraft.colors.bg, theme.Paper);
            Color surface = ParseHex(styleDraft.colors.surface, theme.Card);
            Color ink = ParseHex(styleDraft.colors.ink, theme.Ink);
            Color accent = ParseHex(styleDraft.colors.accent, theme.Accent);
            bool light = string.Equals(styleDraft.colors.theme, "light",
                StringComparison.OrdinalIgnoreCase) || IsLight(bg);
            theme.Paper = bg;
            theme.Card = surface;
            theme.Ink = ink;
            theme.Accent = accent;
            theme.Sidebar = Mix(bg, surface, 38);
            theme.Line = Color.FromArgb(light ? 48 : 36, ink);
            theme.Muted = Color.FromArgb(light ? 150 : 168, ink);
            theme.Dark = !light;
            BackColor = theme.Paper;
            ForeColor = theme.Ink;
            top.BackColor = theme.Sidebar;
            pageNav.BackColor = theme.Sidebar;
            pageHost.BackColor = theme.Paper;
        }

        static Color ParseHex(string value, Color fallback) {
            try {
                string h = (value ?? "").Trim().TrimStart('#');
                return h.Length == 6
                    ? Color.FromArgb(Convert.ToInt32(h.Substring(0, 2), 16),
                        Convert.ToInt32(h.Substring(2, 2), 16),
                        Convert.ToInt32(h.Substring(4, 2), 16))
                    : fallback;
            } catch { return fallback; }
        }
        static bool IsLight(Color c) { return (c.R * 299 + c.G * 587 + c.B * 114) > 140000; }
        static Color Mix(Color a, Color b, int pct) {
            int q = 100 - pct;
            return Color.FromArgb((a.R * q + b.R * pct) / 100,
                (a.G * q + b.G * pct) / 100, (a.B * q + b.B * pct) / 100);
        }

        Button ToolButton(string text, int width) {
            Button b = FoxUi.Button(theme, text, false);
            b.Size = new Size(width, 32);
            return b;
        }

        void LayoutTop() {
            int x = top.Width - 14;
            Control[] right = { applyButton, cancelButton, rightToggle, leftToggle,
                modeButton, redoButton, undoButton };
            for (int i = 0; i < right.Length; i++) {
                x -= right[i].Width;
                right[i].Location = new Point(x, 14);
                x -= 7;
            }
        }

        void AddPageButton(string id, string glyph, string title) {
            Button b = FoxUi.Button(theme, title, false);
            b.Tag = id;
            b.Font = theme.Body;
            b.Size = new Size(Math.Max(118, title.Length * 9 + 28), 32);
            b.Location = new Point(nextPageX, 7);
            nextPageX += b.Width + 8;
            string page = id;
            b.Click += delegate { ShowPage(page); };
            pages.Add(b);
            pageNav.Controls.Add(b);
        }

        void ShowPage(string id) {
            currentPage = id;
            ApplyThemeFromDraft();
            pageHost.Controls.Clear();
            settingsPreview = null;
            leftPanel = rightPanel = null;
            for (int i = 0; i < pages.Count; i++) {
                bool active = (string)pages[i].Tag == id;
                pages[i].BackColor = active ? theme.Accent : theme.Card;
                pages[i].ForeColor = active ? Color.White : theme.Ink;
            }
            if (id == "editor") BuildEditorPage();
            else if (id == "appearance") BuildAppearancePage();
            else if (id == "motion") BuildMotionPage();
            else if (id == "control") BuildControlPage();
            else if (id == "assistant") BuildAssistantPage();
            else BuildProfilesPage();
            ApplyResponsiveLayout();
        }

        void BuildEditorPage() {
            Panel center = new Panel { Dock = DockStyle.Fill, BackColor = theme.Paper, Padding = new Padding(8) };
            leftPanel = BuildTreePanel();
            rightPanel = BuildPropertiesPanel();
            pageHost.Controls.Add(center);
            pageHost.Controls.Add(rightPanel);
            pageHost.Controls.Add(leftPanel);

            Panel canvasTools = new Panel { Dock = DockStyle.Bottom, Height = 46, BackColor = theme.Card };
            Button fit = ToolButton("Вмістити все", 112);
            Button home = ToolButton("До центру", 94);
            Button actual = ToolButton("100%", 64);
            fit.Location = new Point(8, 7); home.Location = new Point(126, 7); actual.Location = new Point(226, 7);
            fit.Click += delegate { canvas.FitAll(); };
            home.Click += delegate { canvas.CenterNode(); };
            actual.Click += delegate { canvas.ResetZoom(); };
            backgroundChoice = new ComboBox {
                DropDownStyle = ComboBoxStyle.DropDownList,
                Width = 170, Location = new Point(302, 9),
                BackColor = theme.Card, ForeColor = theme.Ink
            };
            backgroundChoice.Items.AddRange(new object[] {
                "Темний нейтральний", "Світлий нейтральний", "Поточні шпалери"
            });
            backgroundChoice.SelectedIndex = 0;
            backgroundChoice.SelectedIndexChanged += delegate {
                string mode = backgroundChoice.SelectedIndex == 1 ? "light" :
                    backgroundChoice.SelectedIndex == 2 ? "wallpaper" : "dark";
                canvas.SetBackgroundMode(mode);
            };
            canvasTools.Controls.Add(fit); canvasTools.Controls.Add(home);
            canvasTools.Controls.Add(actual); canvasTools.Controls.Add(backgroundChoice);

            canvas = new NodePreviewCanvas(theme) { Dock = DockStyle.Fill };
            canvas.SetDocument(draft, styleDraft);
            canvas.SelectedId = selectedId;
            canvas.TestMode = testMode;
            canvas.SelectionChanged += SelectNode;
            canvas.RenameRequested += BeginRename;
            canvas.ActionPreview += delegate(EditorNode node) {
                MessageBox.Show(ActionSummary(node), "Тестування · команда не запущена",
                    MessageBoxButtons.OK, MessageBoxIcon.Information);
            };
            center.Controls.Add(canvas);
            center.Controls.Add(canvasTools);
            RebuildTree();
            BuildProperties();
        }

        Panel BuildTreePanel() {
            Panel p = new Panel { Dock = DockStyle.Left, Width = 270, Padding = new Padding(10), BackColor = theme.Sidebar };
            Panel treeHead = new Panel { Dock = DockStyle.Top, Height = 92, BackColor = theme.Sidebar };
            Label title = Header("Структура меню", "Категорії, групи та дії");
            title.Location = new Point(0, 0); title.Width = 245;
            treeHead.Controls.Add(title);
            search = new TextBox {
                Location = new Point(0, 58), Width = 245, Height = 28,
                Anchor = AnchorStyles.Left | AnchorStyles.Right | AnchorStyles.Top,
                BackColor = theme.Card, ForeColor = theme.Ink
            };
            new ToolTip().SetToolTip(search, "Пошук за назвою");
            search.TextChanged += delegate { RebuildTree(); };
            treeHead.Controls.Add(search);
            FlowLayoutPanel commands = new FlowLayoutPanel {
                Dock = DockStyle.Bottom, Height = 76, Padding = new Padding(0, 6, 0, 0),
                BackColor = theme.Sidebar, WrapContents = true
            };
            AddSmall(commands, "+ Група", delegate { AddNode(true); });
            AddSmall(commands, "+ Дія", delegate { AddNode(false); });
            AddSmall(commands, "Дублювати", delegate { DuplicateSelected(); });
            AddSmall(commands, "Видалити", delegate { DeleteSelected(); });
            AddSmall(commands, "Вище", delegate { MoveSelected(-1); });
            AddSmall(commands, "Нижче", delegate { MoveSelected(1); });
            AddSmall(commands, "Перемістити…", delegate { MoveToDialog(); });

            dropStatus = new Label {
                Dock = DockStyle.Bottom, Height = 24, Text = "Перетягніть для зміни структури",
                ForeColor = theme.Muted, Font = theme.Small, TextAlign = ContentAlignment.MiddleLeft
            };
            tree = new TreeView {
                Dock = DockStyle.Fill, BorderStyle = BorderStyle.None,
                BackColor = theme.Sidebar, ForeColor = theme.Ink,
                Font = theme.Body, HideSelection = false, AllowDrop = true,
                ShowLines = false, ShowPlusMinus = true, Indent = 18,
                ItemHeight = 26
            };
            tree.ImageList = BuildTreeIcons();
            tree.AfterSelect += delegate { SelectTreeNode(); };
            tree.ItemDrag += BeginTreeDrag;
            tree.DragEnter += delegate(object s, DragEventArgs e) {
                e.Effect = e.Data.GetDataPresent(typeof(TreeNode)) ? DragDropEffects.Move : DragDropEffects.None;
            };
            tree.DragOver += TreeDragOver;
            tree.DragDrop += TreeDragDrop;
            tree.NodeMouseDoubleClick += delegate(object s, TreeNodeMouseClickEventArgs e) {
                EditorNode node = e.Node.Tag as EditorNode;
                if (node != null) BeginRename(node);
            };
            p.Controls.Add(tree);
            p.Controls.Add(dropStatus);
            p.Controls.Add(commands);
            p.Controls.Add(treeHead);
            return p;
        }

        ImageList BuildTreeIcons() {
            var list = new ImageList { ImageSize = new Size(18, 18), ColorDepth = ColorDepth.Depth32Bit };
            list.Images.Add("center", GlyphBitmap("\uE80F"));
            list.Images.Add("category", GlyphBitmap("\uE8A1"));
            list.Images.Add("group", GlyphBitmap("\uE8B7"));
            list.Images.Add("action", GlyphBitmap("\uE8A7"));
            return list;
        }

        Bitmap GlyphBitmap(string glyph) {
            var bitmap = new Bitmap(18, 18);
            using (Graphics g = Graphics.FromImage(bitmap))
            using (Font font = new Font("Segoe Fluent Icons", 10f))
            using (Brush brush = new SolidBrush(theme.Muted))
            using (var sf = new StringFormat {
                Alignment = StringAlignment.Center,
                LineAlignment = StringAlignment.Center
            }) {
                g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
                g.DrawString(glyph, font, brush, new RectangleF(0, 0, 18, 18), sf);
            }
            return bitmap;
        }

        Panel BuildPropertiesPanel() {
            Panel p = new Panel { Dock = DockStyle.Right, Width = 330, Padding = new Padding(12),
                BackColor = theme.Sidebar, AutoScroll = true };
            return p;
        }

        Label Header(string title, string subtitle) {
            Label label = new Label {
                Text = title + "\r\n" + subtitle,
                Font = theme.Head, ForeColor = theme.Ink,
                Height = 56, AutoEllipsis = true
            };
            return label;
        }

        void AddSmall(FlowLayoutPanel panel, string text, Action action) {
            Button b = FoxUi.Button(theme, text, false);
            b.AutoSize = true; b.Height = 28; b.Margin = new Padding(2);
            b.Click += delegate { action(); };
            panel.Controls.Add(b);
        }

        void RebuildTree() {
            if (tree == null || draft == null) return;
            rebuilding = true;
            tree.BeginUpdate();
            tree.Nodes.Clear();
            TreeNode center = new TreeNode("Центральна кнопка") {
                Tag = "__center", ImageKey = "center", SelectedImageKey = "center"
            };
            tree.Nodes.Add(center);
            string filter = search != null ? search.Text.Trim() : "";
            for (int i = 0; i < draft.categories.Count; i++) {
                TreeNode node = BuildTree(draft.categories[i], filter, true);
                if (node != null) tree.Nodes.Add(node);
            }
            tree.ExpandAll();
            if (!SelectTreeById(selectedId, tree.Nodes) && draft.categories.Count > 0) {
                selectedId = draft.categories[0].id;
                selected = draft.categories[0];
                SelectTreeById(selectedId, tree.Nodes);
                if (canvas != null) canvas.SelectedId = selectedId;
            }
            tree.EndUpdate();
            rebuilding = false;
        }

        TreeNode BuildTree(EditorNode node, string filter, bool category = false) {
            var children = new List<TreeNode>();
            for (int i = 0; i < node.children.Count; i++) {
                TreeNode child = BuildTree(node.children[i], filter, false);
                if (child != null) children.Add(child);
            }
            bool matches = string.IsNullOrEmpty(filter) ||
                (node.title ?? "").IndexOf(filter, StringComparison.CurrentCultureIgnoreCase) >= 0;
            if (!matches && children.Count == 0) return null;
            string image = category ? "category" :
                (node.action == null ? "group" : "action");
            TreeNode result = new TreeNode(node.title) {
                Tag = node, Name = node.id,
                ImageKey = image, SelectedImageKey = image
            };
            result.Nodes.AddRange(children.ToArray());
            return result;
        }

        bool SelectTreeById(string id, TreeNodeCollection nodes) {
            if (string.IsNullOrEmpty(id)) return false;
            foreach (TreeNode node in nodes) {
                EditorNode data = node.Tag as EditorNode;
                if (data != null && data.id == id) {
                    tree.SelectedNode = node; node.EnsureVisible(); return true;
                }
                if (SelectTreeById(id, node.Nodes)) return true;
            }
            return false;
        }

        void SelectTreeNode() {
            if (rebuilding || tree.SelectedNode == null) return;
            if (tree.SelectedNode.Tag as string == "__center") {
                centralSelected = true; selected = null; selectedId = "__center";
                if (canvas != null) canvas.SelectedId = "";
                BuildProperties();
                return;
            }
            EditorNode node = tree.SelectedNode.Tag as EditorNode;
            SelectNode(node);
        }

        void SelectNode(EditorNode node) {
            centralSelected = false;
            selected = node;
            selectedId = node != null ? node.id : "";
            if (canvas != null) canvas.SelectedId = selectedId;
            if (tree != null && node != null && (tree.SelectedNode == null ||
                tree.SelectedNode.Tag != node)) SelectTreeById(node.id, tree.Nodes);
            BuildProperties();
        }

        void BuildProperties() {
            if (rightPanel == null) return;
            rightPanel.SuspendLayout();
            rightPanel.Controls.Clear();
            int y = 4;
            AddRightLabel(selected == null
                ? (centralSelected ? "Центральна кнопка" : "Властивості")
                : selected.title,
                theme.Head, theme.Ink, ref y, 28);
            if (centralSelected) {
                AddRightText("Головна точка меню: відкриває та згортає категорії.", ref y);
                CheckBox collapsed = new CheckBox {
                    Text = "Починати згорнутим",
                    Checked = draft.startCollapsed,
                    ForeColor = theme.Ink,
                    Location = new Point(0, y),
                    Width = 260
                };
                collapsed.CheckedChanged += delegate {
                    Checkpoint(); draft.startCollapsed = collapsed.Checked; Changed();
                };
                rightPanel.Controls.Add(collapsed); y += 36;
                AddRightButton("До центральної кнопки", delegate {
                    if (canvas != null) canvas.CenterNode();
                }, ref y);
                rightPanel.ResumeLayout();
                return;
            }
            if (selected == null) {
                AddRightText("Виберіть вузол на полотні або у дереві. Тут з’являться лише доречні поля.", ref y);
                AddRightButton(draft.categories.Count == 0
                    ? "Додати першу категорію"
                    : "Вибрати першу категорію", delegate {
                        if (draft.categories.Count == 0) AddCategory();
                        else SelectNode(draft.categories[0]);
                    }, ref y);
                rightPanel.ResumeLayout(); return;
            }

            TextBox title = AddRightInput("Назва", selected.title, ref y);
            BindText(title, delegate(string v) { selected.title = v; }, true);
            Panel iconRow = new Panel { Location = new Point(0, y), Width = 290, Height = 58 };
            Label il = new Label { Text = "Іконка", ForeColor = theme.Muted, AutoSize = true, Location = new Point(0, 0) };
            TextBox icon = new TextBox { Text = selected.icon, Width = 90, Location = new Point(0, 24) };
            Button choose = FoxUi.Button(theme, "Обрати…", false);
            choose.Size = new Size(100, 28); choose.Location = new Point(100, 22);
            choose.Click += delegate {
                using (var picker = new NodeIconPicker(theme, selected.icon)) {
                    if (picker.ShowDialog(FindForm()) == DialogResult.OK) {
                        Checkpoint();
                        selected.icon = picker.SelectedIcon;
                        icon.Text = selected.icon;
                        Changed();
                    }
                }
            };
            iconRow.Controls.Add(il); iconRow.Controls.Add(icon); iconRow.Controls.Add(choose);
            rightPanel.Controls.Add(iconRow); y += 66;
            BindText(icon, delegate(string v) { selected.icon = v; }, false);

            string currentType = NodeType(selected);
            ComboBox type = AddRightChoice("Тип", new[] {
                "Група", "Програма", "Папка", "Файл", "Посилання", "FOXSTYLE / FoxOS"
            }, currentType, ref y);
            type.SelectedIndexChanged += delegate {
                if (rebuilding) return;
                if (!ConfirmTypeChange(selected, type.SelectedItem as string)) {
                    rebuilding = true;
                    type.SelectedItem = currentType;
                    rebuilding = false;
                    return;
                }
                Checkpoint();
                ChangeNodeType(selected, type.SelectedItem as string);
                Changed();
                BuildProperties();
            };

            if (selected.action != null) {
                string kind = selected.action.kind ?? "";
                if (kind == "openExe" || kind == "openPath") {
                    TextBox path = AddRightInput(kind == "openExe" ? "Програма або команда" : "Шлях", selected.action.path, ref y);
                    BindText(path, delegate(string v) { selected.action.path = v; }, false);
                    AddBrowseButton(path, kind == "openExe", ref y);
                } else if (kind == "openUrl") {
                    TextBox url = AddRightInput("Посилання", selected.action.url, ref y);
                    BindText(url, delegate(string v) { selected.action.url = v; }, false);
                } else {
                    ComboBox cmd = AddRightChoice("Дія FoxOS", new[] {
                        "foxstyle", "foxnodes", "foxos", "foxlook", "foxhelp",
                        "home", "settings", "lock", "pulse", "foxlife", "custom"
                    }, KnownFoxCommand(selected.action.command), ref y);
                    TextBox command = AddRightInput("Команда", selected.action.command, ref y);
                    BindText(command, delegate(string v) { selected.action.command = v; }, false);
                    cmd.SelectedIndexChanged += delegate {
                        if (rebuilding) return;
                        string pick = cmd.SelectedItem as string;
                        if (pick != "custom") {
                            Checkpoint(); selected.action.command = pick;
                            command.Text = pick; Changed();
                        }
                    };
                }
                if (kind == "openExe") {
                    TextBox args = AddRightInput("Аргументи (окремо)", selected.action.args, ref y);
                    BindText(args, delegate(string v) { selected.action.args = v; }, false);
                }
                AddRightButton("Перевірити дію…", delegate { TestAction(selected); }, ref y);
            } else {
                AddRightText("Група може містити дії та інші групи будь-якої глибини.", ref y);
                AddRightButton("Додати всередину", delegate { AddNode(false); }, ref y);
            }
            AddRightButton("Дублювати гілку", delegate { DuplicateSelected(); }, ref y);
            if (selected.style == null) {
                AddRightButton("Додати локальне оформлення", delegate {
                    Checkpoint();
                    selected.style = new EditorNodeStyle {
                        surfaceHex = styleDraft.colors.surface,
                        textHex = styleDraft.colors.ink,
                        accentHex = styleDraft.colors.accent
                    };
                    Changed();
                }, ref y);
            } else {
                AddRightLabel("Локальне оформлення", theme.Body, theme.Accent, ref y, 22);
                TextBox localSurface = AddRightInput("Поверхня #RRGGBB",
                    selected.style.surfaceHex, ref y);
                BindText(localSurface, delegate(string v) {
                    selected.style.surfaceHex = v;
                }, false);
                TextBox localText = AddRightInput("Текст #RRGGBB",
                    selected.style.textHex, ref y);
                BindText(localText, delegate(string v) {
                    selected.style.textHex = v;
                }, false);
                TextBox localAccent = AddRightInput("Акцент #RRGGBB",
                    selected.style.accentHex, ref y);
                BindText(localAccent, delegate(string v) {
                    selected.style.accentHex = v;
                }, false);
            }
            AddRightButton("Відновити успадковане оформлення", delegate {
                Checkpoint(); selected.offsetXDip = selected.offsetYDip = 0;
                selected.style = null; Changed();
            }, ref y);
            rightPanel.AutoScrollMinSize = new Size(0, y + 20);
            rightPanel.ResumeLayout();
        }

        void AddRightLabel(string text, Font font, Color color, ref int y, int height) {
            Label l = new Label { Text = text, Font = font, ForeColor = color,
                Location = new Point(0, y), Size = new Size(290, height), AutoEllipsis = true };
            rightPanel.Controls.Add(l); y += height + 6;
        }
        void AddRightText(string text, ref int y) {
            Label l = new Label { Text = text, Font = theme.Small, ForeColor = theme.Muted,
                Location = new Point(0, y), Size = new Size(290, 52) };
            rightPanel.Controls.Add(l); y += 60;
        }
        TextBox AddRightInput(string label, string value, ref int y) {
            AddRightLabel(label, theme.Small, theme.Muted, ref y, 18);
            TextBox box = new TextBox { Text = value ?? "", Location = new Point(0, y),
                Width = 290, BackColor = theme.Card, ForeColor = theme.Ink };
            rightPanel.Controls.Add(box); y += 36; return box;
        }
        ComboBox AddRightChoice(string label, string[] options, string value, ref int y) {
            AddRightLabel(label, theme.Small, theme.Muted, ref y, 18);
            ComboBox box = new ComboBox { DropDownStyle = ComboBoxStyle.DropDownList,
                Location = new Point(0, y), Width = 290, BackColor = theme.Card, ForeColor = theme.Ink };
            box.Items.AddRange(options);
            rebuilding = true; box.SelectedItem = value; rebuilding = false;
            rightPanel.Controls.Add(box); y += 38; return box;
        }
        void AddRightButton(string text, Action action, ref int y) {
            Button b = FoxUi.Button(theme, text, false);
            b.Location = new Point(0, y); b.Size = new Size(290, 32);
            b.Click += delegate { action(); };
            rightPanel.Controls.Add(b); y += 40;
        }
        void AddBrowseButton(TextBox target, bool executable, ref int y) {
            bool folder = selected != null && selected.action != null &&
                selected.action.kind == "openPath" && NodeType(selected) == "Папка";
            Button b = FoxUi.Button(theme, executable ? "Обрати програму…" :
                (folder ? "Обрати папку…" : "Обрати файл…"), false);
            b.Location = new Point(0, y); b.Size = new Size(200, 28);
            b.Click += delegate {
                Form owner = FindForm();
                if (executable) {
                    using (var dialog = new OpenFileDialog { Filter = "Програми|*.exe;*.cmd;*.bat;*.ps1|Усі файли|*.*" })
                        if (dialog.ShowDialog(owner) == DialogResult.OK) target.Text = dialog.FileName;
                } else if (folder) {
                    using (var dialog = new FolderBrowserDialog())
                        if (dialog.ShowDialog(owner) == DialogResult.OK) target.Text = dialog.SelectedPath;
                } else {
                    using (var dialog = new OpenFileDialog { Filter = "Усі файли|*.*" })
                        if (dialog.ShowDialog(owner) == DialogResult.OK) target.Text = dialog.FileName;
                }
            };
            rightPanel.Controls.Add(b); y += 36;
        }

        void BindText(TextBox box, Action<string> setter, bool rebuildTree) {
            string before = "";
            box.Enter += delegate { before = Snapshot(); };
            box.TextChanged += delegate {
                if (rebuilding) return;
                setter(box.Text);
                SetDirty(true);
                if (canvas != null) { canvas.SetDocument(draft, styleDraft); canvas.Invalidate(); }
            };
            box.Leave += delegate {
                if (!string.IsNullOrEmpty(before) && before != Snapshot()) {
                    PushUndo(before);
                    if (rebuildTree) RebuildTree();
                }
                before = "";
            };
        }

        void AddCategory() {
            Checkpoint();
            var node = NewNode("Нова категорія", true);
            node.icon = "\uE8B7";
            draft.categories.Add(node);
            NodeEditorRepository.Reorder(draft.categories);
            selectedId = node.id; Changed(true);
        }

        void AddNode(bool group) {
            if (selected == null) { AddCategory(); return; }
            EditorNode parent = selected.action == null ? selected : ParentOf(selected.id);
            if (parent == null) return;
            Checkpoint();
            EditorNode node = NewNode(group ? "Нова група" : "Нова дія", group);
            if (!group) node.action = new EditorAction { kind = "openExe", path = "notepad.exe" };
            parent.children.Add(node);
            NodeEditorRepository.Reorder(parent.children);
            selectedId = node.id; Changed(true);
        }

        EditorNode NewNode(string title, bool group) {
            return new EditorNode { id = Guid.NewGuid().ToString("N"), title = title,
                icon = group ? "\uE8B7" : "\uE8A5", action = null };
        }

        void DuplicateSelected() {
            if (selected == null) return;
            Checkpoint();
            EditorNode copy = NodeEditorRepository.Clone(selected);
            RenewIds(copy);
            copy.title += " — копія";
            List<EditorNode> siblings = Siblings(selected.id);
            int index = siblings.IndexOf(selected);
            siblings.Insert(index + 1, copy);
            NodeEditorRepository.Reorder(siblings);
            selectedId = copy.id; Changed(true);
        }

        void RenewIds(EditorNode node) {
            node.id = Guid.NewGuid().ToString("N");
            for (int i = 0; i < node.children.Count; i++) RenewIds(node.children[i]);
        }

        void DeleteSelected() {
            if (selected == null) return;
            if (MessageBox.Show("Видалити «" + selected.title + "» та всю вкладену гілку?",
                "Node Launcher", MessageBoxButtons.YesNo, MessageBoxIcon.Warning) != DialogResult.Yes) return;
            Checkpoint();
            List<EditorNode> siblings = Siblings(selected.id);
            siblings.Remove(selected);
            NodeEditorRepository.Reorder(siblings);
            selected = null; selectedId = ""; Changed(true);
        }

        void MoveSelected(int delta) {
            if (selected == null) return;
            List<EditorNode> siblings = Siblings(selected.id);
            int index = siblings.IndexOf(selected), next = index + delta;
            if (index < 0 || next < 0 || next >= siblings.Count) return;
            Checkpoint();
            siblings.RemoveAt(index); siblings.Insert(next, selected);
            NodeEditorRepository.Reorder(siblings); Changed(true);
        }

        void MoveToDialog() {
            if (selected == null) return;
            var groups = new List<EditorNode>();
            for (int i = 0; i < draft.categories.Count; i++) CollectGroups(draft.categories[i], groups);
            using (var dialog = new Form {
                Text = "Перемістити до…", Size = new Size(420, 180),
                StartPosition = FormStartPosition.CenterParent, BackColor = theme.Paper,
                ForeColor = theme.Ink, Font = Font
            }) {
                ComboBox choice = new ComboBox { DropDownStyle = ComboBoxStyle.DropDownList,
                    Location = new Point(16, 20), Width = 370 };
                for (int i = 0; i < groups.Count; i++)
                    if (groups[i] != selected && !Contains(selected, groups[i].id))
                        choice.Items.Add(new GroupChoice(groups[i]));
                Button ok = FoxUi.Button(theme, "Перемістити", true);
                ok.Location = new Point(250, 72); ok.DialogResult = DialogResult.OK;
                Button cancel = FoxUi.Button(theme, "Скасувати", false);
                cancel.Location = new Point(140, 72); cancel.DialogResult = DialogResult.Cancel;
                dialog.Controls.Add(choice); dialog.Controls.Add(ok); dialog.Controls.Add(cancel);
                dialog.AcceptButton = ok; dialog.CancelButton = cancel;
                if (choice.Items.Count > 0) choice.SelectedIndex = 0;
                if (dialog.ShowDialog(FindForm()) != DialogResult.OK) return;
                GroupChoice target = choice.SelectedItem as GroupChoice;
                if (target == null) return;
                Checkpoint();
                List<EditorNode> old = Siblings(selected.id); old.Remove(selected);
                target.Node.children.Add(selected);
                NodeEditorRepository.Reorder(old); NodeEditorRepository.Reorder(target.Node.children);
                Changed(true);
            }
        }

        sealed class GroupChoice {
            public EditorNode Node;
            public GroupChoice(EditorNode n) { Node = n; }
            public override string ToString() { return Node.title; }
        }

        void BeginTreeDrag(object sender, ItemDragEventArgs e) {
            draggedTree = e.Item as TreeNode;
            if (draggedTree == null || !(draggedTree.Tag is EditorNode)) return;
            tree.DoDragDrop(draggedTree, DragDropEffects.Move);
        }

        void TreeDragOver(object sender, DragEventArgs e) {
            Point p = tree.PointToClient(new Point(e.X, e.Y));
            TreeNode target = tree.GetNodeAt(p);
            if (target == null || !(target.Tag is EditorNode) || draggedTree == null) {
                e.Effect = DragDropEffects.None; return;
            }
            EditorNode moving = draggedTree.Tag as EditorNode;
            EditorNode targetNode = target.Tag as EditorNode;
            if (moving == targetNode || Contains(moving, targetNode.id)) {
                e.Effect = DragDropEffects.None;
                dropStatus.Text = "Не можна перенести групу в саму себе";
                return;
            }
            Rectangle bounds = target.Bounds;
            int third = Math.Max(4, bounds.Height / 3);
            dropMode = p.Y < bounds.Top + third ? "before" :
                p.Y > bounds.Bottom - third ? "after" : "inside";
            if (dropMode == "inside" && targetNode.action != null) dropMode = "after";
            dropTarget = target;
            tree.SelectedNode = target;
            dropStatus.Text = dropMode == "inside" ? "Всередину «" + targetNode.title + "»" :
                dropMode == "before" ? "Перед «" + targetNode.title + "»" :
                "Після «" + targetNode.title + "»";
            e.Effect = DragDropEffects.Move;
        }

        void TreeDragDrop(object sender, DragEventArgs e) {
            if (draggedTree == null || dropTarget == null || e.Effect != DragDropEffects.Move) return;
            EditorNode moving = draggedTree.Tag as EditorNode;
            EditorNode target = dropTarget.Tag as EditorNode;
            if (moving == null || target == null || Contains(moving, target.id)) return;
            Checkpoint();
            List<EditorNode> old = Siblings(moving.id); old.Remove(moving);
            if (dropMode == "inside") target.children.Add(moving);
            else {
                List<EditorNode> destination = Siblings(target.id);
                int index = destination.IndexOf(target) + (dropMode == "after" ? 1 : 0);
                destination.Insert(index, moving);
                NodeEditorRepository.Reorder(destination);
            }
            NodeEditorRepository.Reorder(old);
            selectedId = moving.id; Changed(true);
            dropStatus.Text = "Структуру оновлено";
            draggedTree = null; dropTarget = null; dropMode = "";
        }

        void BeginRename(EditorNode node) {
            if (node == null) return;
            string value = PromptText("Перейменувати", "Нова назва:", node.title);
            if (string.IsNullOrWhiteSpace(value) || value == node.title) return;
            Checkpoint(); node.title = value.Trim(); selectedId = node.id; Changed(true);
        }

        string PromptText(string title, string label, string initial) {
            using (var dialog = new Form {
                Text = title, Size = new Size(430, 170),
                StartPosition = FormStartPosition.CenterParent,
                BackColor = theme.Paper, ForeColor = theme.Ink, Font = Font
            }) {
                Label l = new Label { Text = label, AutoSize = true,
                    Location = new Point(16, 16), ForeColor = theme.Ink };
                TextBox input = new TextBox { Text = initial ?? "",
                    Location = new Point(16, 42), Width = 380 };
                Button ok = FoxUi.Button(theme, "Готово", true);
                ok.Location = new Point(286, 82); ok.DialogResult = DialogResult.OK;
                Button cancel = FoxUi.Button(theme, "Скасувати", false);
                cancel.Location = new Point(176, 82); cancel.DialogResult = DialogResult.Cancel;
                dialog.Controls.Add(l); dialog.Controls.Add(input);
                dialog.Controls.Add(ok); dialog.Controls.Add(cancel);
                dialog.AcceptButton = ok; dialog.CancelButton = cancel;
                if (dialog.ShowDialog(FindForm()) != DialogResult.OK) return null;
                return input.Text;
            }
        }

        bool ConfirmTypeChange(EditorNode node, string type) {
            if (type == "Група" || node.children.Count == 0) return true;
            return MessageBox.Show("Перетворення на дію видалить вкладені елементи. Продовжити?",
                "Node Launcher", MessageBoxButtons.YesNo, MessageBoxIcon.Warning) == DialogResult.Yes;
        }

        void ChangeNodeType(EditorNode node, string type) {
            if (type == "Група") { node.action = null; return; }
            node.children.Clear();
            node.action = new EditorAction();
            if (type == "Програма") node.action.kind = "openExe";
            else if (type == "Папка" || type == "Файл") node.action.kind = "openPath";
            else if (type == "Посилання") node.action.kind = "openUrl";
            else node.action.kind = "foxCommand";
        }

        static string KnownFoxCommand(string command) {
            switch ((command ?? "").Trim().ToLowerInvariant()) {
                case "foxstyle":
                case "foxnodes":
                case "foxos":
                case "foxlook":
                case "foxhelp":
                case "home":
                case "settings":
                case "lock":
                case "pulse":
                case "foxlife":
                    return command.Trim().ToLowerInvariant();
                default: return "custom";
            }
        }

        string NodeType(EditorNode node) {
            if (node.action == null) return "Група";
            if (node.action.kind == "openExe") return "Програма";
            if (node.action.kind == "openUrl") return "Посилання";
            if (node.action.kind == "foxCommand" || node.action.kind == "internal") return "FOXSTYLE / FoxOS";
            if (node.action.kind == "openPath") {
                try { return Directory.Exists(node.action.path) ? "Папка" : "Файл"; }
                catch { return "Файл"; }
            }
            return "Програма";
        }

        void TestAction(EditorNode node) {
            if (node == null || node.action == null) return;
            if (MessageBox.Show(ActionSummary(node) + "\r\n\r\nЗапустити зараз?",
                "Перевірити дію", MessageBoxButtons.YesNo,
                MessageBoxIcon.Question) != DialogResult.Yes) return;
            try {
                EditorAction a = node.action;
                if (a.kind == "openUrl")
                    Process.Start(new ProcessStartInfo(a.url) { UseShellExecute = true });
                else if (a.kind == "openPath")
                    Process.Start(new ProcessStartInfo(a.path) { UseShellExecute = true });
                else if (a.kind == "openExe")
                    Process.Start(new ProcessStartInfo(a.path, a.args ?? "") { UseShellExecute = true });
                else MessageBox.Show("FoxOS виконає команду: " + a.command,
                    "Перевірка безпечного preview");
            } catch (Exception ex) { MessageBox.Show(ex.Message, "Помилка дії"); }
        }

        string ActionSummary(EditorNode node) {
            if (node == null || node.action == null) return "Група без команди";
            EditorAction a = node.action;
            if (a.kind == "openUrl") return "Буде відкрито посилання:\r\n" + a.url;
            if (a.kind == "openExe") return "Буде запущено:\r\n" + a.path + "\r\nАргументи: " + a.args;
            if (a.kind == "openPath") return "Буде відкрито:\r\n" + a.path;
            return "Буде виконано у FoxOS:\r\n" + a.command;
        }

        void BuildAppearancePage() {
            Panel body = SettingsBody("Вигляд", "Тема, читабельність і геометрія Node Launcher.");
            NodeLauncherMod n = styleDraft.nodeLauncher;
            AddPresetCards(body);
            AddChoiceSetting(body, "Джерело кольорів", "Автоматично бере активну тему FOXSTYLE",
                new[] { "auto", "wallpaper", "custom" }, n.themeSource,
                delegate(string v) {
                    n.themeSource = v;
                    ShowPage("appearance");
                });
            if (n.themeSource == "custom") {
                AddTextSetting(body, "Поверхня", "Наприклад #202226", n.customSurface,
                    delegate(string v) { n.customSurface = v; });
                AddTextSetting(body, "Текст", "Наприклад #E6E7E9", n.customInk,
                    delegate(string v) { n.customInk = v; });
                AddTextSetting(body, "Акцент", "Наприклад #9B9FA7", n.customAccent,
                    delegate(string v) { n.customAccent = v; });
            }
            AddSliderSetting(body, "Прозорість поверхонь", "%", 55, 100, n.opacity, 84,
                delegate(int v) { n.opacity = v; });
            AddSliderSetting(body, "Розмір кнопок", "%", 75, 140, n.nodeScale, 100,
                delegate(int v) { n.nodeScale = v; });
            AddSliderSetting(body, "Розмір тексту", "%", 80, 140, n.textScale, 100,
                delegate(int v) { n.textScale = v; });
            AddSliderSetting(body, "Відстань між кнопками", "%", 75, 150, n.spacing, 100,
                delegate(int v) { n.spacing = v; });
            AddSliderSetting(body, "Помітність з’єднань", "%", 50, 180, n.lineContrast, 100,
                delegate(int v) { n.lineContrast = v; });
            AddNote(body, "Скло мальоване, без DWM blur — інакше кліки на робочому столі провалюються крізь меню.");
        }

        void AddPresetCards(Panel body) {
            Label hint = new Label {
                Text = "Готові вигляди змінюють лише оформлення. Меню і команди залишаються.",
                Font = theme.Small, ForeColor = theme.Muted,
                Location = NextSettingLocation(body, 22), AutoSize = true
            };
            body.Controls.Add(hint);
            FlowLayoutPanel row = new FlowLayoutPanel {
                Width = body.Width - 36, Height = 132,
                Location = NextSettingLocation(body, 132),
                Anchor = AnchorStyles.Left | AnchorStyles.Right | AnchorStyles.Top
            };
            AddLookCard(row, "compact", "Компактний", "Менші кнопки, щільніше",
                Color.FromArgb(36, 38, 44), Color.FromArgb(90, 94, 102), delegate {
                    ApplyLookPreset(76, 68, 86, 94, 90);
                });
            AddLookCard(row, "glass", "М’яке скло", "Легші прозорі поверхні",
                Color.FromArgb(48, 50, 58), Color.FromArgb(170, 176, 188), delegate {
                    ApplyLookPreset(110, 128, 100, 56, 70);
                });
            AddLookCard(row, "contrast", "Контрастний", "Більший текст і жирні лінії",
                Color.FromArgb(18, 18, 20), Color.FromArgb(230, 232, 236), delegate {
                    ApplyLookPreset(104, 100, 122, 100, 175);
                });
            AddLookCard(row, "foxstyle", "За темою FOXSTYLE", "Стандартні розміри теми",
                theme.Card, theme.Accent, delegate {
                    NodeLauncherMod keep = styleDraft.nodeLauncher;
                    bool pocket = keep.pocketEnabled;
                    string edge = keep.pocketEdge;
                    int pos = keep.pocketPosition;
                    string motion = keep.animationStyle;
                    styleDraft.nodeLauncher = new NodeLauncherMod();
                    styleDraft.nodeLauncher.themeSource = "auto";
                    styleDraft.nodeLauncher.pocketEnabled = pocket;
                    styleDraft.nodeLauncher.pocketEdge = edge;
                    styleDraft.nodeLauncher.pocketPosition = pos;
                    styleDraft.nodeLauncher.animationStyle = motion;
                });
            body.Controls.Add(row); body.Height = row.Bottom + 12;
        }

        void ApplyLookPreset(int nodeScale, int spacing, int textScale, int opacity, int lines) {
            NodeLauncherMod n = styleDraft.nodeLauncher;
            n.nodeScale = nodeScale;
            n.spacing = spacing;
            n.textScale = textScale;
            n.opacity = opacity;
            n.lineContrast = lines;
        }

        void AddLookCard(FlowLayoutPanel row, string id, string title, string hint, Color a, Color b, Action apply) {
            bool selected = lookPreset == id;
            Button card = new Button {
                Size = new Size(168, 118), Margin = new Padding(4),
                Cursor = Cursors.Hand, FlatStyle = FlatStyle.Flat, TabStop = true,
                BackColor = theme.Card, Text = ""
            };
            card.FlatAppearance.BorderSize = 0;
            card.Paint += delegate(object s, PaintEventArgs e) {
                e.Graphics.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
                Rectangle r = new Rectangle(0, 0, card.Width - 1, card.Height - 1);
                using (var path = FoxUi.Round(r, 12))
                using (var fill = new System.Drawing.Drawing2D.LinearGradientBrush(r, a, b, 125f))
                using (var pen = new Pen(selected ? theme.Accent : theme.Line, selected ? 2.4f : 1f)) {
                    e.Graphics.FillPath(fill, path);
                    e.Graphics.DrawPath(pen, path);
                }
                bool lightCard = (a.R * 299 + a.G * 587 + a.B * 114) > 140000;
                Color inkColor = lightCard ? Color.FromArgb(22, 22, 26) : Color.White;
                Color muteColor = lightCard ? Color.FromArgb(90, 22, 22, 26) : Color.FromArgb(210, 255, 255, 255);
                using (var ink = new SolidBrush(inkColor))
                using (var mute = new SolidBrush(muteColor)) {
                    e.Graphics.FillEllipse(ink, 18, 16, 18, 18);
                    e.Graphics.FillEllipse(mute, 52, 20, 14, 14);
                    e.Graphics.FillEllipse(mute, 78, 20, 14, 14);
                    e.Graphics.DrawString(title, theme.Body, ink, 12, 58);
                    e.Graphics.DrawString(hint, theme.Small, mute, 12, 82);
                }
            };
            card.Click += delegate {
                Checkpoint();
                apply();
                lookPreset = id;
                Changed();
                ShowPage("appearance");
                if (settingsPreview != null) settingsPreview.ReplayOpening();
            };
            row.Controls.Add(card);
        }

        void BuildMotionPage() {
            Panel body = SettingsBody("Анімації", "Рух пояснює структуру, але не заважає швидкому керуванню.");
            NodeLauncherMod n = styleDraft.nodeLauncher;
            n.animationStyle = FoxNodesSync.NormalizeMotionStyle(n.animationStyle);
            AddToggleSetting(body, "Анімації", "Плавні появи вузлів і гілок", n.animations,
                delegate(bool v) { n.animations = v; });
            AddToggleSetting(body, "Поважати налаштування Windows", "Reduced motion вимикає зайві переходи",
                n.respectSystemMotion, delegate(bool v) { n.respectSystemMotion = v; });
            AddNote(body, "Пресети змінюють і preview, і живе меню: появу з центру, гілки, hover, кишеню та зміну палітри.");
            FlowLayoutPanel row = new FlowLayoutPanel {
                Width = body.Width - 36, Height = 118,
                Location = NextSettingLocation(body, 118),
                Anchor = AnchorStyles.Left | AnchorStyles.Right | AnchorStyles.Top
            };
            AddMotionCard(row, "restrained", "Стриманий", "Короткі fade і невеликі зміщення",
                118, 70);
            AddMotionCard(row, "smooth", "Плавний", "М’яке розкриття гілок",
                100, 100);
            AddMotionCard(row, "spring", "Пружний", "Легка контрольована пружність",
                108, 120);
            AddMotionCard(row, "minimal", "Мінімальний рух", "Майже без переміщень",
                160, 20);
            body.Controls.Add(row); body.Height = row.Bottom + 12;
            AddSliderSetting(body, "Швидкість", "%", 40, 180, n.animationSpeed, 100,
                delegate(int v) { n.animationSpeed = v; });
            AddSliderSetting(body, "Інтенсивність руху", "%", 0, 150, n.motionIntensity, 100,
                delegate(int v) { n.motionIntensity = v; });
            Button replay = FoxUi.Button(theme, "Відтворити приклад", true);
            replay.Size = new Size(180, 34); replay.Location = NextSettingLocation(body, 46);
            replay.Click += delegate {
                if (settingsPreview != null) settingsPreview.ReplayOpening();
            };
            body.Controls.Add(replay); body.Height = replay.Bottom + 20;
        }

        void AddMotionCard(FlowLayoutPanel row, string id, string title, string hint,
            int speed, int intensity) {
            bool selected = FoxNodesSync.NormalizeMotionStyle(
                styleDraft.nodeLauncher.animationStyle) == id;
            Button card = new Button {
                Size = new Size(168, 104), Margin = new Padding(4),
                Cursor = Cursors.Hand, FlatStyle = FlatStyle.Flat, TabStop = true,
                BackColor = theme.Card, Text = ""
            };
            card.FlatAppearance.BorderSize = 0;
            card.Paint += delegate(object s, PaintEventArgs e) {
                e.Graphics.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
                Rectangle r = new Rectangle(0, 0, card.Width - 1, card.Height - 1);
                using (var path = FoxUi.Round(r, 12))
                using (var fill = new SolidBrush(selected ? theme.Card : theme.Paper))
                using (var pen = new Pen(selected ? theme.Accent : theme.Line, selected ? 2f : 1f)) {
                    e.Graphics.FillPath(fill, path);
                    e.Graphics.DrawPath(pen, path);
                }
                using (var ink = new SolidBrush(theme.Ink))
                using (var mute = new SolidBrush(theme.Muted)) {
                    e.Graphics.DrawString(title, theme.Body, ink, 12, 16);
                    e.Graphics.DrawString(hint, theme.Small, mute, new RectangleF(12, 44, 144, 48));
                }
            };
            card.Click += delegate {
                Checkpoint();
                NodeLauncherMod n = styleDraft.nodeLauncher;
                n.animationStyle = id;
                n.animationSpeed = speed;
                n.motionIntensity = intensity;
                Changed();
                ShowPage("motion");
                if (settingsPreview != null) settingsPreview.ReplayOpening();
            };
            row.Controls.Add(card);
        }

        void BuildControlPage() {
            Panel body = SettingsBody("Керування та кишеня",
                "Гаряча клавіша, згортання та повернення з краю екрана.");
            AddTextSetting(body, "Гаряча клавіша", "Наприклад Ctrl+Alt+Space",
                HotkeyLabel(draft.hotkey), delegate(string v) { ParseHotkey(v, draft.hotkey); });
            NodeLauncherMod n = styleDraft.nodeLauncher;
            AddToggleSetting(body, "Кишеня біля краю", "Сховати центральну кнопку локально",
                n.pocketEnabled, delegate(bool v) { n.pocketEnabled = v; });
            PocketDiagram diagram = new PocketDiagram(theme) {
                Width = Math.Max(520, body.Width - 36), Height = 230,
                Location = NextSettingLocation(body, 238),
                Edge = n.pocketEdge, PositionPercent = n.pocketPosition,
                Anchor = AnchorStyles.Left | AnchorStyles.Right | AnchorStyles.Top
            };
            bool pocketGesture = false;
            diagram.MouseDown += delegate {
                if (!pocketGesture) { Checkpoint(); pocketGesture = true; }
            };
            diagram.MouseUp += delegate { pocketGesture = false; };
            diagram.Changed += delegate {
                n.pocketEdge = diagram.Edge;
                n.pocketPosition = diagram.PositionPercent; Changed();
            };
            body.Controls.Add(diagram); body.Height = diagram.Bottom + 12;
            AddChoiceSetting(body, "Край екрана", "Також змінюється на схемі",
                new[] { "right", "left", "top" }, n.pocketEdge,
                delegate(string v) {
                    n.pocketEdge = v; diagram.Edge = v; diagram.Invalidate();
                });
            AddSliderSetting(body, "Позиція вздовж краю", "%", 5, 95,
                n.pocketPosition, 48, delegate(int v) {
                    n.pocketPosition = v; diagram.PositionPercent = v; diagram.Invalidate();
                });
            AddSliderSetting(body, "Затримка появи", "мс", 0, 500,
                n.pocketShowDelayMs, 150, delegate(int v) { n.pocketShowDelayMs = v; });
            AddSliderSetting(body, "Затримка приховування", "мс", 200, 1200,
                n.pocketHideDelayMs, 520, delegate(int v) { n.pocketHideDelayMs = v; });
            AddToggleSetting(body, "Ледь видимий маркер", "Допомагає знайти приховану кишеню",
                n.pocketMarker, delegate(bool v) { n.pocketMarker = v; });
            AddToggleSetting(body, "Починати зі згорнутої кнопки",
                "Після запуску видно лише центр, категорії відкриваються кліком",
                draft.startCollapsed, delegate(bool v) { draft.startCollapsed = v; });

            Panel advanced = SettingCard(body, 210);
            Label adv = new Label {
                Text = "Додатково", Font = theme.Head, ForeColor = theme.Ink,
                Location = new Point(16, 10), AutoSize = true
            };
            advanced.Controls.Add(adv);
            advanced.Controls.Add(new Label {
                Text = "Рідко потрібні точні значення. Основні зміни вже вище.",
                Font = theme.Small, ForeColor = theme.Muted,
                Location = new Point(16, 34), AutoSize = true
            });
            AddMiniSlider(advanced, "Смуга активації", "DIP", 3, 12,
                n.pocketActivationDip, 5, 56, delegate(int v) { n.pocketActivationDip = v; });
            AddMiniSlider(advanced, "Щільність скла", "%", 20, 100,
                draft.glassStrength, 78, 104, delegate(int v) { draft.glassStrength = v; });
            AddMiniSlider(advanced, "Загальна швидкість меню", "%", 50, 160,
                draft.motionPercent, 100, 152, delegate(int v) { draft.motionPercent = v; });
        }

        void AddMiniSlider(Panel card, string title, string unit, int min, int max,
            int value, int reset, int y, Action<int> setter) {
            card.Controls.Add(new Label {
                Text = title, Font = theme.Small, ForeColor = theme.Muted,
                Location = new Point(16, y), AutoSize = true
            });
            TrackBar bar = new TrackBar {
                Minimum = min, Maximum = max,
                Value = Math.Max(min, Math.Min(max, value)),
                TickStyle = TickStyle.None, AutoSize = false,
                Height = 28, Width = 220, Location = new Point(card.Width - 320, y - 4),
                Anchor = AnchorStyles.Top | AnchorStyles.Right, BackColor = theme.Card
            };
            NumericUpDown exact = new NumericUpDown {
                Minimum = min, Maximum = max, Value = bar.Value, Width = 58,
                Location = new Point(card.Width - 90, y),
                Anchor = AnchorStyles.Top | AnchorStyles.Right
            };
            bool syncing = false;
            bar.MouseDown += delegate { Checkpoint(); };
            bar.ValueChanged += delegate {
                if (syncing) return;
                syncing = true; exact.Value = bar.Value; syncing = false;
                setter(bar.Value); Changed();
            };
            exact.ValueChanged += delegate {
                if (syncing) return; Checkpoint();
                syncing = true; bar.Value = (int)exact.Value; syncing = false;
                setter((int)exact.Value); Changed();
            };
            card.Controls.Add(new Label {
                Text = unit, Font = theme.Small, ForeColor = theme.Muted,
                Location = new Point(card.Width - 28, y), AutoSize = true,
                Anchor = AnchorStyles.Top | AnchorStyles.Right
            });
            Button resetBtn = FoxUi.Button(theme, "↺", false);
            resetBtn.Size = new Size(26, 24);
            resetBtn.Location = new Point(16, y + 18);
            resetBtn.Click += delegate { exact.Value = reset; };
            card.Controls.Add(bar); card.Controls.Add(exact); card.Controls.Add(resetBtn);
        }

        void BuildAssistantPage() {
            Panel body = SettingsBody("Помічник",
                "Локальна модель, мікрофон і дозволені дії. Застосувати оновлює живе меню.");
            AssistantPage.Build(body, theme, assistantDraft, delegate { SetDirty(true); });
        }

        void BuildProfilesPage() {
            Panel body = SettingsBody("Профілі", "Збереження структури, команд і оформлення одним набором.");
            Panel create = SettingCard(body, 88);
            TextBox name = new TextBox { Text = "Мій профіль", Location = new Point(16, 38), Width = 220 };
            create.Controls.Add(new Label { Text = "Назва профілю", ForeColor = theme.Ink,
                Font = theme.Body, Location = new Point(16, 12), AutoSize = true });
            create.Controls.Add(name);
            Button save = FoxUi.Button(theme, "Зберегти / перезаписати", true);
            save.Location = new Point(250, 34); save.Size = new Size(180, 32);
            save.Click += delegate {
                try {
                    NodeProfileInfo saved = repo.SaveProfile(name.Text, draft, styleDraft);
                    SetProfileCaption(saved.name);
                    ShowPage("profiles");
                }
                catch (Exception ex) { MessageBox.Show(ex.Message, "Профіль"); }
            };
            create.Controls.Add(save);
            Button import = FoxUi.Button(theme, "Імпорт…", false);
            import.Location = new Point(440, 34); import.Size = new Size(92, 32);
            import.Click += delegate { ImportProfile(); }; create.Controls.Add(import);
            Button export = FoxUi.Button(theme, "Експорт…", false);
            export.Location = new Point(540, 34); export.Size = new Size(92, 32);
            export.Click += delegate { ExportProfile(name.Text); }; create.Controls.Add(export);

            List<NodeProfileInfo> profiles = repo.Profiles();
            for (int i = 0; i < profiles.Count; i++) {
                NodeProfileInfo p = profiles[i];
                Panel card = SettingCard(body, 64);
                card.Controls.Add(new Label { Text = p.name, Font = theme.Body,
                    ForeColor = theme.Ink, Location = new Point(16, 12), AutoSize = true });
                card.Controls.Add(new Label { Text = FriendlyDate(p.savedUtc), Font = theme.Small,
                    ForeColor = theme.Muted, Location = new Point(16, 34), AutoSize = true });
                Button load = FoxUi.Button(theme, "Завантажити", true);
                load.Location = new Point(card.Width - 250, 15); load.Size = new Size(110, 32);
                load.Anchor = AnchorStyles.Top | AnchorStyles.Right;
                string id = p.id;
                load.Click += delegate {
                    NodeEditorProfile profile = repo.LoadProfile(id);
                    if (profile == null) return;
                    Checkpoint(); draft = NodeEditorRepository.Clone(profile.launcher);
                    styleDraft = NodeEditorRepository.Clone(profile.style ?? styleStore.Doc);
                    selected = null; selectedId = "";
                    SetProfileCaption(profile.name);
                    Changed(); ShowPage("editor");
                };
                card.Controls.Add(load);
                Button duplicate = FoxUi.Button(theme, "Копія", false);
                duplicate.Location = new Point(card.Width - 370, 15);
                duplicate.Size = new Size(90, 32);
                duplicate.Anchor = AnchorStyles.Top | AnchorStyles.Right;
                string duplicateId = p.id, duplicateName = p.name;
                duplicate.Click += delegate {
                    NodeEditorProfile source = repo.LoadProfile(duplicateId);
                    if (source == null) return;
                    string newName = PromptText("Дублювати профіль",
                        "Назва копії:", duplicateName + " — копія");
                    if (string.IsNullOrWhiteSpace(newName)) return;
                    repo.SaveProfile(newName, source.launcher, source.style);
                    ShowPage("profiles");
                };
                card.Controls.Add(duplicate);
                Button rename = FoxUi.Button(theme, "Назва", false);
                rename.Location = new Point(card.Width - 470, 15);
                rename.Size = new Size(90, 32);
                rename.Anchor = AnchorStyles.Top | AnchorStyles.Right;
                string renameId = p.id, renameName = p.name;
                rename.Click += delegate {
                    NodeEditorProfile source = repo.LoadProfile(renameId);
                    if (source == null) return;
                    string newName = PromptText("Перейменувати профіль",
                        "Нова назва:", renameName);
                    if (string.IsNullOrWhiteSpace(newName) || newName == renameName) return;
                    repo.SaveProfile(newName, source.launcher, source.style);
                    repo.DeleteProfile(renameId);
                    ShowPage("profiles");
                };
                card.Controls.Add(rename);
                Button delete = FoxUi.Button(theme, "Видалити", false);
                delete.Location = new Point(card.Width - 130, 15); delete.Size = new Size(100, 32);
                delete.Anchor = AnchorStyles.Top | AnchorStyles.Right;
                string deleteId = p.id, deleteName = p.name;
                delete.Click += delegate {
                    if (MessageBox.Show("Видалити профіль «" + deleteName + "»?",
                        "Профілі", MessageBoxButtons.YesNo) == DialogResult.Yes) {
                        repo.DeleteProfile(deleteId); ShowPage("profiles");
                    }
                };
                card.Controls.Add(delete);
            }

            Panel diag = SettingCard(body, 96);
            int overlayRev;
            string overlayUtc;
            FoxNodesSync.TryReadApplied(out overlayRev, out overlayUtc);
            string overlay = FoxNodesSync.OverlayRunning() ? "меню запущене" : "меню не запущене";
            diag.Controls.Add(new Label {
                Text = "Діагностика", Font = theme.Head, ForeColor = theme.Muted,
                Location = new Point(16, 10), AutoSize = true
            });
            diag.Controls.Add(new Label {
                Text = "Чернетка rev " + draft.revision +
                    "  ·  збережено rev " + applied.revision +
                    "  ·  overlay rev " + overlayRev + " (" + overlay + ")\r\n" +
                    (string.IsNullOrEmpty(lastApplyDetail) ? "Останнє застосування ще не було." : lastApplyDetail),
                Font = theme.Small, ForeColor = theme.Muted,
                Location = new Point(16, 36), AutoSize = true
            });
        }

        Panel SettingsBody(string title, string description) {
            bool withPreview = currentPage != "profiles";
            TableLayoutPanel split = new TableLayoutPanel {
                Dock = DockStyle.Fill, ColumnCount = withPreview ? 2 : 1, RowCount = 1,
                BackColor = theme.Paper, Padding = new Padding(0)
            };
            split.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100f));
            if (withPreview) split.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 400f));
            split.RowStyles.Add(new RowStyle(SizeType.Percent, 100f));

            Panel viewport = new Panel { Dock = DockStyle.Fill, AutoScroll = true, BackColor = theme.Paper };
            Panel body = new Panel {
                Width = 680, Height = 110, Location = new Point(16, 12),
                BackColor = theme.Paper
            };
            Label h = new Label { Text = title, Font = new Font("Segoe UI", 19f, FontStyle.Regular),
                ForeColor = theme.Ink, Location = new Point(8, 4), AutoSize = true };
            Label d = new Label { Text = description, Font = theme.Body, ForeColor = theme.Muted,
                Location = new Point(10, 42), AutoSize = true };
            body.Controls.Add(h); body.Controls.Add(d);
            viewport.Controls.Add(body);
            viewport.Resize += delegate {
                int w = Math.Max(560, viewport.ClientSize.Width - 28);
                if (Math.Abs(body.Width - w) > 8) body.Width = w;
            };
            split.Controls.Add(viewport, 0, 0);

            if (withPreview) {
                Panel previewHost = new Panel { Dock = DockStyle.Fill, Padding = new Padding(10),
                    BackColor = theme.Sidebar };
                Label previewTitle = new Label { Text = "Живий перегляд", Font = theme.Head,
                    ForeColor = theme.Ink, Dock = DockStyle.Top, Height = 32 };
                Panel buttons = new Panel { Dock = DockStyle.Bottom, Height = 44, BackColor = theme.Sidebar };
                settingsPreview = new NodePreviewCanvas(theme) { Dock = DockStyle.Fill };
                settingsPreview.SetDocument(draft, styleDraft);
                settingsPreview.TestMode = true;
                settingsPreview.ActionPreview += delegate(EditorNode node) {
                    MessageBox.Show(ActionSummary(node), "Тестування · команда не запущена",
                        MessageBoxButtons.OK, MessageBoxIcon.Information);
                };
                Button replay = FoxUi.Button(theme, "Відтворити", true);
                replay.Size = new Size(120, 32); replay.Location = new Point(0, 6);
                replay.Click += delegate { settingsPreview.ReplayOpening(); };
                buttons.Controls.Add(replay);
                previewHost.Controls.Add(settingsPreview);
                previewHost.Controls.Add(buttons);
                previewHost.Controls.Add(previewTitle);
                split.Controls.Add(previewHost, 1, 0);
            }
            pageHost.Controls.Add(split);
            return body;
        }

        Point NextSettingLocation(Panel body, int height) {
            int y = 82;
            foreach (Control c in body.Controls) y = Math.Max(y, c.Bottom + 8);
            return new Point(8, y);
        }

        Panel SettingCard(Panel body, int height) {
            Panel card = new Panel { Width = body.Width - 24, Height = height,
                Location = NextSettingLocation(body, height), BackColor = theme.Card,
                Anchor = AnchorStyles.Left | AnchorStyles.Top };
            card.Paint += delegate(object s, PaintEventArgs e) {
                FoxUi.PaintCard(e.Graphics, new Rectangle(0, 0, card.Width - 1, card.Height - 1),
                    theme.Card, theme.Line);
            };
            body.Controls.Add(card); body.Height = card.Bottom + 16;
            return card;
        }

        void AddNote(Panel body, string text) {
            Label note = new Label {
                Text = text, Font = theme.Small, ForeColor = theme.Muted,
                Location = NextSettingLocation(body, 36), AutoSize = true,
                MaximumSize = new Size(Math.Max(280, body.Width - 36), 0)
            };
            body.Controls.Add(note);
            body.Height = note.Bottom + 16;
        }

        void AddSliderSetting(Panel body, string title, string unit, int min, int max,
            int value, int reset, Action<int> setter) {
            Panel card = SettingCard(body, 80);
            card.Controls.Add(new Label { Text = title, Font = theme.Body, ForeColor = theme.Ink,
                Location = new Point(16, 10), AutoSize = true });
            TrackBar bar = new TrackBar { Minimum = min, Maximum = max,
                Value = Math.Max(min, Math.Min(max, value)), TickStyle = TickStyle.None,
                AutoSize = false, Height = 28, Width = 220,
                Location = new Point(16, 34), BackColor = theme.Card };
            NumericUpDown exact = new NumericUpDown { Minimum = min, Maximum = max,
                Value = bar.Value, Width = 68, Location = new Point(244, 36) };
            Label units = new Label { Text = unit, ForeColor = theme.Muted,
                Location = new Point(318, 39), AutoSize = true };
            Button resetButton = FoxUi.Button(theme, "скинути", false);
            resetButton.Size = new Size(78, 26); resetButton.Location = new Point(card.Width - 94, 36);
            resetButton.Anchor = AnchorStyles.Top | AnchorStyles.Right;
            bool syncing = false, gesture = false;
            bar.MouseDown += delegate { Checkpoint(); gesture = true; };
            bar.MouseUp += delegate { gesture = false; };
            bar.ValueChanged += delegate {
                if (syncing) return;
                if (!gesture) Checkpoint();
                syncing = true; exact.Value = bar.Value; syncing = false;
                setter(bar.Value); Changed();
            };
            exact.ValueChanged += delegate {
                if (syncing) return; Checkpoint(); syncing = true;
                bar.Value = (int)exact.Value; syncing = false;
                setter((int)exact.Value); Changed();
            };
            resetButton.Click += delegate { exact.Value = reset; };
            card.Controls.Add(bar); card.Controls.Add(exact); card.Controls.Add(units);
            card.Controls.Add(resetButton);
        }

        void AddToggleSetting(Panel body, string title, string hint, bool value, Action<bool> setter) {
            Panel card = SettingCard(body, 66);
            card.Controls.Add(new Label { Text = title, Font = theme.Body, ForeColor = theme.Ink,
                Location = new Point(16, 10), AutoSize = true });
            card.Controls.Add(new Label { Text = hint, Font = theme.Small, ForeColor = theme.Muted,
                Location = new Point(16, 34), AutoSize = true });
            CheckBox toggle = new CheckBox { Appearance = Appearance.Button, FlatStyle = FlatStyle.Flat,
                Checked = value, Text = value ? "ON" : "OFF", TextAlign = ContentAlignment.MiddleCenter,
                Size = new Size(58, 30), Location = new Point(card.Width - 78, 18),
                Anchor = AnchorStyles.Top | AnchorStyles.Right,
                BackColor = value ? theme.Accent : theme.Line,
                ForeColor = value ? Color.White : theme.Muted };
            toggle.CheckedChanged += delegate {
                Checkpoint(); toggle.Text = toggle.Checked ? "ON" : "OFF";
                toggle.BackColor = toggle.Checked ? theme.Accent : theme.Line;
                setter(toggle.Checked); Changed();
            };
            card.Controls.Add(toggle);
        }

        void AddChoiceSetting(Panel body, string title, string hint, string[] options,
            string value, Action<string> setter) {
            Panel card = SettingCard(body, 70);
            card.Controls.Add(new Label { Text = title, Font = theme.Body, ForeColor = theme.Ink,
                Location = new Point(16, 10), AutoSize = true });
            card.Controls.Add(new Label { Text = hint, Font = theme.Small, ForeColor = theme.Muted,
                Location = new Point(16, 36), AutoSize = true });
            ComboBox combo = new ComboBox { DropDownStyle = ComboBoxStyle.DropDownList,
                Width = 200, Location = new Point(Math.Max(280, card.Width - 220), 22),
                Anchor = AnchorStyles.Top | AnchorStyles.Right };
            combo.Items.AddRange(options); combo.SelectedItem = value;
            combo.SelectedIndexChanged += delegate {
                if (combo.SelectedItem == null) return;
                Checkpoint(); setter(combo.SelectedItem.ToString()); Changed();
            };
            card.Controls.Add(combo);
        }

        void AddTextSetting(Panel body, string title, string hint, string value, Action<string> setter) {
            Panel card = SettingCard(body, 70);
            card.Controls.Add(new Label { Text = title, Font = theme.Body, ForeColor = theme.Ink,
                Location = new Point(16, 10), AutoSize = true });
            card.Controls.Add(new Label { Text = hint, Font = theme.Small, ForeColor = theme.Muted,
                Location = new Point(16, 36), AutoSize = true });
            TextBox box = new TextBox { Text = value, Width = 200,
                Location = new Point(Math.Max(280, card.Width - 220), 23),
                Anchor = AnchorStyles.Top | AnchorStyles.Right };
            string before = "";
            box.Enter += delegate { before = Snapshot(); };
            box.TextChanged += delegate { setter(box.Text); SetDirty(true); };
            box.Leave += delegate { if (before != Snapshot()) PushUndo(before); };
            card.Controls.Add(box);
        }

        void ToggleTestMode() {
            testMode = !testMode;
            modeButton.Text = testMode ? "Тестування" : "Редагування";
            if (canvas != null) { canvas.TestMode = testMode; canvas.Invalidate(); }
        }

        void ApplyResponsiveLayout() {
            bool narrow = Width < 1080;
            leftToggle.Visible = rightToggle.Visible = narrow && currentPage == "editor";
            if (currentPage == "editor") {
                if (!narrow) {
                    if (leftPanel != null) leftPanel.Visible = true;
                    if (rightPanel != null) rightPanel.Visible = true;
                } else {
                    if (leftPanel != null) leftPanel.Visible = false;
                    if (rightPanel != null) rightPanel.Visible = false;
                }
            }
            LayoutTop();
        }

        void Checkpoint() { PushUndo(Snapshot()); }
        void PushUndo(string snapshot) {
            if (string.IsNullOrEmpty(snapshot)) return;
            if (undo.Count == 0 || undo.Peek() != snapshot) undo.Push(snapshot);
            while (undo.Count > 80) {
                string[] all = undo.ToArray(); undo.Clear();
                for (int i = Math.Min(79, all.Length - 1); i >= 0; i--) undo.Push(all[i]);
            }
            redo.Clear(); UpdateHistoryButtons();
        }
        string Snapshot() {
            return FoxJson.Dump(new NodeEditorSnapshot {
                launcher = draft, style = styleDraft
            });
        }
        void RestoreSnapshot(string json) {
            NodeEditorSnapshot value = FoxJson.Load<NodeEditorSnapshot>(json);
            if (value == null || value.launcher == null || value.style == null) return;
            draft = value.launcher; styleDraft = value.style;
            selected = FindNode(selectedId);
            SetDirty(true); ShowPage(currentPage);
        }
        void Undo() {
            if (undo.Count == 0) return;
            redo.Push(Snapshot()); RestoreSnapshot(undo.Pop()); UpdateHistoryButtons();
        }
        void Redo() {
            if (redo.Count == 0) return;
            undo.Push(Snapshot()); RestoreSnapshot(redo.Pop()); UpdateHistoryButtons();
        }
        void UpdateHistoryButtons() {
            undoButton.Enabled = undo.Count > 0; redoButton.Enabled = redo.Count > 0;
        }

        void Changed(bool rebuild = false) {
            SetDirty(true);
            if (rebuild && tree != null) RebuildTree();
            selected = FindNode(selectedId);
            if (canvas != null) canvas.SetDocument(draft, styleDraft);
            if (settingsPreview != null)
                settingsPreview.SetDocument(draft, styleDraft);
            BuildProperties();
        }
        void SetDirty(bool value) {
            dirty = value;
            status.Text = value ? "Є незастосовані зміни" : "Збережено";
            status.ForeColor = value ? theme.Warn : theme.Good;
            applyButton.Enabled = value; cancelButton.Enabled = value;
            applyButton.BackColor = value ? theme.Accent : theme.Line;
            applyButton.ForeColor = value ? Color.White : theme.Muted;
            cancelButton.ForeColor = value ? theme.Ink : theme.Muted;
            UpdateHistoryButtons();
        }

        bool ApplyChanges() {
            status.Text = "Збереження…"; status.ForeColor = theme.Muted;
            if (styleDraft.nodeLauncher == null) styleDraft.nodeLauncher = new NodeLauncherMod();
            SyncPocketToDraft();
            int revision = Math.Max(draft.revision, styleDraft.nodeLauncher.revision) + 1;
            draft.revision = revision;
            styleDraft.nodeLauncher.revision = revision;
            string error;
            if (!repo.SaveLauncher(draft, out error)) {
                status.Text = error; status.ForeColor = theme.Danger;
                lastApplyDetail = "save-launcher failed rev " + revision + ": " + error;
                MessageBox.Show(error + "\r\n\r\nЧернетку збережено в редакторі. Натисніть «Застосувати» ще раз.",
                    "Не вдалося зберегти", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return false;
            }
            try {
                styleStore.Import(NodeEditorRepository.Clone(styleDraft));
                styleStore.Save(true);
            } catch (Exception ex) {
                status.Text = "Структуру збережено, вигляд — ні";
                status.ForeColor = theme.Danger;
                lastApplyDetail = "save-style failed rev " + revision + ": " + ex.Message;
                MessageBox.Show("Структуру меню записано, але style.json не збережено:\r\n" +
                    ex.Message + "\r\n\r\nЧернетка залишається. Повторіть «Застосувати».",
                    "Часткове збереження", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return false;
            }
            assistantDraft.revision = revision;
            AssistantStore.Save(assistantDraft);
            SystemBridge.ApplyFast(styleStore.Doc);
            repo.SignalReload(revision);
            applied = NodeEditorRepository.Clone(draft);
            appliedStyle = NodeEditorRepository.Clone(styleDraft);

            if (!FoxNodesSync.OverlayRunning()) {
                undo.Clear(); redo.Clear(); SetDirty(false);
                status.Text = "Збережено. Буде застосовано після запуску меню";
                status.ForeColor = theme.Warn;
                lastApplyDetail = "saved rev " + revision + " · overlay not running";
                FoxToast.Show("Node Launcher · збережено, меню не запущене");
                return true;
            }

            status.Text = "Очікую підтвердження меню…";
            status.ForeColor = theme.Muted;
            applyButton.Enabled = false;
            bool acked = WaitOverlayAck(revision, 1600);
            applyButton.Enabled = true;
            if (acked) {
                undo.Clear(); redo.Clear(); SetDirty(false);
                status.Text = "Застосовано до меню";
                status.ForeColor = theme.Good;
                lastApplyDetail = "applied rev " + revision + " overlay ack";
                if (canvas != null) canvas.FlashApplied();
                if (settingsPreview != null) settingsPreview.FlashApplied();
                FoxToast.Show("Node Launcher · застосовано");
                return true;
            }

            SetDirty(true);
            status.Text = "Збережено. Меню не підтвердило оновлення";
            status.ForeColor = theme.Warn;
            lastApplyDetail = "saved rev " + revision + " · overlay no ack";
            MessageBox.Show(
                "Налаштування записано, але живе меню не підтвердило оновлення.\r\n" +
                "Перевірте, що Node Launcher запущено, і натисніть «Застосувати» ще раз.\r\n\r\n" +
                "Чернетка збережена.",
                "Меню не відповіло", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return false;
        }

        static bool WaitOverlayAck(int revision, int timeoutMs) {
            DateTime until = DateTime.UtcNow.AddMilliseconds(Math.Max(200, timeoutMs));
            while (DateTime.UtcNow < until) {
                int got;
                string utc;
                if (FoxNodesSync.TryReadApplied(out got, out utc) && got >= revision)
                    return true;
                Application.DoEvents();
                Thread.Sleep(30);
            }
            return false;
        }

        void RevertDraft() {
            if (!dirty) return;
            draft = NodeEditorRepository.Clone(applied);
            styleDraft = NodeEditorRepository.Clone(appliedStyle);
            undo.Clear(); redo.Clear(); selected = null; selectedId = "";
            SetDirty(false); ShowPage(currentPage);
        }

        public bool QueryClose() {
            if (!dirty) return true;
            DialogResult result = MessageBox.Show(FindForm(),
                "Застосувати зміни перед виходом?\r\n\r\nТак — застосувати · Ні — відкинути · Скасувати — повернутися",
                "Node Launcher", MessageBoxButtons.YesNoCancel, MessageBoxIcon.Question);
            if (result == DialogResult.Cancel) return false;
            if (result == DialogResult.Yes) return ApplyChanges();
            RevertDraft();
            return true;
        }

        void ImportProfile() {
            using (var dialog = new OpenFileDialog { Filter = "Node Launcher profile|*.json|Усі файли|*.*" }) {
                if (dialog.ShowDialog(FindForm()) != DialogResult.OK) return;
                string error;
                NodeEditorProfile profile = repo.ImportProfile(dialog.FileName, out error);
                if (profile == null) { MessageBox.Show(error, "Імпорт"); return; }
                Checkpoint(); draft = profile.launcher; styleDraft = profile.style;
                selected = null; selectedId = ""; Changed(); ShowPage("editor");
            }
        }

        void ExportProfile(string name) {
            using (var dialog = new SaveFileDialog {
                Filter = "Node Launcher profile|*.json", FileName = "node-launcher-profile.json"
            }) {
                if (dialog.ShowDialog(FindForm()) != DialogResult.OK) return;
                repo.ExportProfile(dialog.FileName, name, draft, styleDraft);
                FoxToast.Show("Профіль експортовано");
            }
        }

        List<EditorNode> Siblings(string id) {
            for (int i = 0; i < draft.categories.Count; i++) {
                if (draft.categories[i].id == id) return draft.categories;
                List<EditorNode> found = Siblings(draft.categories[i], id);
                if (found != null) return found;
            }
            return draft.categories;
        }
        List<EditorNode> Siblings(EditorNode parent, string id) {
            for (int i = 0; i < parent.children.Count; i++) {
                if (parent.children[i].id == id) return parent.children;
                List<EditorNode> found = Siblings(parent.children[i], id);
                if (found != null) return found;
            }
            return null;
        }
        EditorNode ParentOf(string id) {
            for (int i = 0; i < draft.categories.Count; i++) {
                EditorNode found = ParentOf(draft.categories[i], id);
                if (found != null) return found;
            }
            return null;
        }
        EditorNode ParentOf(EditorNode parent, string id) {
            for (int i = 0; i < parent.children.Count; i++) {
                if (parent.children[i].id == id) return parent;
                EditorNode found = ParentOf(parent.children[i], id);
                if (found != null) return found;
            }
            return null;
        }
        EditorNode FindNode(string id) {
            for (int i = 0; i < draft.categories.Count; i++) {
                EditorNode found = FindNode(draft.categories[i], id);
                if (found != null) return found;
            }
            return null;
        }
        EditorNode FindNode(EditorNode node, string id) {
            if (node.id == id) return node;
            for (int i = 0; i < node.children.Count; i++) {
                EditorNode found = FindNode(node.children[i], id);
                if (found != null) return found;
            }
            return null;
        }
        static bool Contains(EditorNode node, string id) {
            if (node.id == id) return true;
            for (int i = 0; i < node.children.Count; i++)
                if (Contains(node.children[i], id)) return true;
            return false;
        }
        void CollectGroups(EditorNode node, List<EditorNode> result) {
            if (node.action == null) result.Add(node);
            for (int i = 0; i < node.children.Count; i++) CollectGroups(node.children[i], result);
        }
        static string HotkeyLabel(EditorHotkey h) {
            var p = new List<string>();
            if (h.ctrl) p.Add("Ctrl"); if (h.alt) p.Add("Alt");
            if (h.shift) p.Add("Shift"); if (h.win) p.Add("Win");
            p.Add(string.IsNullOrEmpty(h.key) ? "Space" : h.key);
            return string.Join("+", p.ToArray());
        }
        static void ParseHotkey(string value, EditorHotkey h) {
            h.ctrl = h.alt = h.shift = h.win = false; h.key = "Space";
            string[] parts = (value ?? "").Split('+');
            for (int i = 0; i < parts.Length; i++) {
                string p = parts[i].Trim();
                if (p.Equals("Ctrl", StringComparison.OrdinalIgnoreCase)) h.ctrl = true;
                else if (p.Equals("Alt", StringComparison.OrdinalIgnoreCase)) h.alt = true;
                else if (p.Equals("Shift", StringComparison.OrdinalIgnoreCase)) h.shift = true;
                else if (p.Equals("Win", StringComparison.OrdinalIgnoreCase)) h.win = true;
                else if (p.Length > 0) h.key = p;
            }
        }
        static string FriendlyDate(string value) {
            DateTime d; return DateTime.TryParse(value, out d)
                ? d.ToLocalTime().ToString("yyyy-MM-dd HH:mm") : "saved";
        }

        void SyncPocketToDraft() {
            if (draft == null || draft.pocket == null || styleDraft == null ||
                styleDraft.nodeLauncher == null) return;
            NodeLauncherMod n = styleDraft.nodeLauncher;
            draft.pocket.enabled = n.pocketEnabled;
            draft.pocket.edge = n.pocketEdge;
            draft.pocket.positionPercent = n.pocketPosition;
            draft.pocket.activationDip = n.pocketActivationDip;
            draft.pocket.showDelayMs = n.pocketShowDelayMs;
            draft.pocket.hideDelayMs = n.pocketHideDelayMs;
            draft.pocket.marker = n.pocketMarker;
        }

        void SetProfileCaption(string name) {
            profileLabel.Text = string.IsNullOrWhiteSpace(name)
                ? "Node Launcher · Чернетка"
                : ("Профіль · " + name);
        }
    }

    public sealed class NodeEditorForm : Form {
        readonly NodeStudioView studio;
        public NodeEditorForm(FoxTheme t, StyleStore store) {
            studio = new NodeStudioView(t, store);
            studio.Dock = DockStyle.Fill;
            Controls.Add(studio);
            Text = "FOXSTYLE · Node Launcher";
            MinimumSize = new Size(980, 680);
            Size = new Size(1420, 860);
            StartPosition = FormStartPosition.CenterScreen;
            BackColor = t.Paper;
            FormClosing += delegate(object s, FormClosingEventArgs e) {
                if (!studio.QueryClose()) e.Cancel = true;
            };
        }
    }

    public sealed class PocketDiagram : Control {
        readonly FoxTheme theme;
        public string Edge = "right";
        public int PositionPercent = 48;
        public event Action Changed;
        public PocketDiagram(FoxTheme t) {
            theme = t; Cursor = Cursors.Hand; FoxUi.Buffer(this);
            MouseDown += delegate(object s, MouseEventArgs e) { SetMarker(e.Location); };
            MouseMove += delegate(object s, MouseEventArgs e) {
                if (e.Button == MouseButtons.Left) SetMarker(e.Location);
            };
        }
        protected override void OnPaint(PaintEventArgs e) {
            e.Graphics.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
            e.Graphics.Clear(theme.Sidebar);
            Rectangle monitor = new Rectangle(36, 24, Width - 72, Height - 58);
            using (var brush = new SolidBrush(theme.Card))
            using (var pen = new Pen(theme.Ink, 2)) {
                e.Graphics.FillRectangle(brush, monitor); e.Graphics.DrawRectangle(pen, monitor);
            }
            Point p = Marker(monitor);
            using (var brush = new SolidBrush(theme.Accent))
                e.Graphics.FillEllipse(brush, p.X - 9, p.Y - 9, 18, 18);
            using (var brush = new SolidBrush(theme.Muted))
                e.Graphics.DrawString("Перетягніть маркер до потрібного краю",
                    theme.Small, brush, 36, Height - 26);
        }
        Point Marker(Rectangle r) {
            if (Edge == "left") return new Point(r.Left, r.Top + r.Height * PositionPercent / 100);
            if (Edge == "top") return new Point(r.Left + r.Width * PositionPercent / 100, r.Top);
            return new Point(r.Right, r.Top + r.Height * PositionPercent / 100);
        }
        void SetMarker(Point p) {
            Rectangle r = new Rectangle(36, 24, Width - 72, Height - 58);
            int dl = Math.Abs(p.X - r.Left), dr = Math.Abs(p.X - r.Right), dt = Math.Abs(p.Y - r.Top);
            if (dt <= dl && dt <= dr) {
                Edge = "top"; PositionPercent = Clamp((p.X - r.Left) * 100 / Math.Max(1, r.Width));
            } else if (dl < dr) {
                Edge = "left"; PositionPercent = Clamp((p.Y - r.Top) * 100 / Math.Max(1, r.Height));
            } else {
                Edge = "right"; PositionPercent = Clamp((p.Y - r.Top) * 100 / Math.Max(1, r.Height));
            }
            Invalidate(); if (Changed != null) Changed();
        }
        static int Clamp(int v) { return Math.Max(5, Math.Min(95, v)); }
    }

    public sealed class NodeIconPicker : Form {
        readonly FoxTheme theme;
        readonly FlowLayoutPanel grid = new FlowLayoutPanel();
        readonly TextBox search = new TextBox();
        readonly ComboBox category = new ComboBox();
        readonly Label preview = new Label();
        public string SelectedIcon { get; private set; }
        sealed class IconItem { public string Glyph; public string Name; public string Group; }
        static readonly IconItem[] Icons = {
            Item("\uE71D", "Програми", "Програми"), Item("\uE8A5", "Документ", "Програми"),
            Item("\uE756", "Термінал", "Програми"), Item("\uE8A1", "Застосунок", "Програми"),
            Item("\uE8B7", "Папка", "Папки"), Item("\uE8F1", "Бібліотека", "Папки"),
            Item("\uE71B", "Посилання", "Посилання"), Item("\uE8A7", "Глобус", "Посилання"),
            Item("\uE8B2", "Медіа", "Медіа"), Item("\uE768", "Відтворення", "Медіа"),
            Item("\uE8D6", "Музика", "Медіа"), Item("\uE8EA", "Дзеркало", "Медіа"),
            Item("\uE770", "Система", "Система"), Item("\uE713", "Налаштування", "Система"),
            Item("\uE90F", "Інструменти", "Система"), Item("\uE80F", "Дім", "Система"),
            Item("\uE72E", "Замок", "Система"), Item("\uE790", "Колір", "Система"),
            Item("\uE734", "Обране", "Обране"), Item("\uE735", "Зірка", "Обране"),
            Item("\uE943", "Код", "Інструменти"), Item("\uE946", "Довідка", "Інструменти"),
            Item("\uE9D9", "Пульс", "Інструменти"), Item("\uE7F8", "FoxOS", "Інструменти"),
            Item("\uE70F", "Редагувати", "Інструменти"), Item("\uE72C", "Оновити", "Інструменти")
        };
        static IconItem Item(string g, string n, string c) {
            return new IconItem { Glyph = g, Name = n, Group = c };
        }
        public NodeIconPicker(FoxTheme t, string current) {
            theme = t; SelectedIcon = current;
            Text = "Обрати іконку"; Size = new Size(560, 520);
            StartPosition = FormStartPosition.CenterParent;
            BackColor = theme.Paper; ForeColor = theme.Ink;
            Panel head = new Panel { Dock = DockStyle.Top, Height = 96, Padding = new Padding(14) };
            search.Location = new Point(14, 14); search.Width = 240;
            search.BackColor = theme.Card; search.ForeColor = theme.Ink;
            new ToolTip().SetToolTip(search, "Пошук: папка, музика, дім…");
            search.TextChanged += delegate { BuildGrid(); };
            category.DropDownStyle = ComboBoxStyle.DropDownList;
            category.Location = new Point(266, 14); category.Width = 150;
            category.Items.AddRange(new object[] {
                "Усі", "Програми", "Папки", "Посилання", "Медіа", "Система", "Обране", "Інструменти"
            });
            category.SelectedIndex = 0;
            category.SelectedIndexChanged += delegate { BuildGrid(); };
            preview.Font = new Font("Segoe Fluent Icons", 22f);
            preview.Text = current ?? "";
            preview.Location = new Point(430, 8); preview.Size = new Size(90, 40);
            preview.TextAlign = ContentAlignment.MiddleCenter;
            preview.ForeColor = theme.Ink;
            head.Controls.Add(search); head.Controls.Add(category); head.Controls.Add(preview);
            grid.Dock = DockStyle.Fill; grid.AutoScroll = true; grid.Padding = new Padding(12);
            Controls.Add(grid); Controls.Add(head); BuildGrid();
        }
        void BuildGrid() {
            grid.Controls.Clear();
            string q = (search.Text ?? "").Trim();
            string group = category.SelectedItem as string;
            for (int i = 0; i < Icons.Length; i++) {
                IconItem item = Icons[i];
                bool matchGroup = group == "Усі" || item.Group == group;
                bool matchText = q.Length == 0 ||
                    item.Name.IndexOf(q, StringComparison.CurrentCultureIgnoreCase) >= 0 ||
                    item.Group.IndexOf(q, StringComparison.CurrentCultureIgnoreCase) >= 0;
                if (!matchGroup || !matchText) continue;
                Button b = FoxUi.Button(theme, item.Glyph, false);
                b.Font = new Font("Segoe Fluent Icons", 16f);
                b.Size = new Size(64, 64); b.Margin = new Padding(6);
                new ToolTip().SetToolTip(b, item.Name);
                string glyph = item.Glyph;
                b.Click += delegate {
                    SelectedIcon = glyph;
                    DialogResult = DialogResult.OK;
                    Close();
                };
                grid.Controls.Add(b);
            }
        }
    }
}
