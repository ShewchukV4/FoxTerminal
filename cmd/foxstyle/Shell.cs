using System;
using System.Collections.Generic;
using System.Drawing;
using System.Windows.Forms;
using FoxOs.Sdk;

namespace FoxOs.Style {

    public class Shell : Form {
        readonly FoxTheme theme;
        readonly StyleStore store;
        readonly Panel sidebar = new Panel();
        readonly Panel top = new Panel();
        readonly Panel previewHost = new Panel();
        readonly Panel content = new Panel();
        readonly Panel foot = new Panel();
        readonly List<StyleNav> nav = new List<StyleNav>();
        PreviewCanvas preview;
        EditorView editor;
        Label status;
        Label impact;
        Button applyBtn;
        string page = "themes";
        bool isDirty;

        public Shell() {
            store = new StyleStore();
            theme = FoxTheme.Named("midnight");

            Text = "FOXSTYLE";
            StartPosition = FormStartPosition.CenterScreen;
            MinimumSize = new Size(1080, 680);
            Size = new Size(1320, 840);
            BackColor = theme.Paper;
            ForeColor = theme.Ink;
            Font = theme.Body;
            DoubleBuffered = true;
            KeyPreview = true;

            Build();
            ShowPage("themes");
            KeyDown += OnKeys;
            Resize += delegate { LayoutPreview(); top.Invalidate(); };
            FormClosing += delegate(object s, FormClosingEventArgs e) {
                if (page == "nodes" && editor != null && !editor.ConfirmLeaveStudio())
                    e.Cancel = true;
            };
        }

        void Build() {
            sidebar.Dock = DockStyle.Left;
            sidebar.Width = 210;
            sidebar.BackColor = theme.Sidebar;
            sidebar.Paint += PaintSidebar;
            FoxUi.Buffer(sidebar);

            top.Dock = DockStyle.Top;
            top.Height = 58;
            top.BackColor = theme.Paper;
            top.Paint += PaintTop;
            FoxUi.Buffer(top);

            foot.Dock = DockStyle.Bottom;
            foot.Height = 68;
            foot.BackColor = theme.Paper;
            foot.Paint += PaintFoot;
            FoxUi.Buffer(foot);

            previewHost.Dock = DockStyle.Right;
            previewHost.Width = 400;
            previewHost.BackColor = theme.Paper;
            FoxUi.Buffer(previewHost);

            content.Dock = DockStyle.Fill;
            content.BackColor = theme.Paper;
            content.Padding = new Padding(6, 4, 4, 6);
            FoxUi.Buffer(content);

            Controls.Add(content);
            Controls.Add(previewHost);
            Controls.Add(top);
            Controls.Add(foot);
            Controls.Add(sidebar);

            BuildNav();
            BuildPreview();
            BuildFoot();

            editor = new EditorView(theme, store, MarkDirty, SetFocusModule, ReplayPreviewOpen);
            editor.Dock = DockStyle.Fill;
            content.Controls.Add(editor);
            LayoutPreview();
        }

        void ReplayPreviewOpen() {
            if (preview != null) preview.ReplayOpen();
        }

        void BuildNav() {
            string[] ids = new[] { "themes", "colors", "dock", "windows", "buttons", "motion", "nodes", "assistant", "labs" };
            string[] titles = new[] { "Modes", "Colors", "Dock / Wall", "Windows", "Buttons", "Motion", "Node Launcher", "Помічник", "Labs" };
            string[] glyphs = new[] { "\uE8F1", "\uE790", "\uE8A1", "\uE8A7", "\uE8FD", "\uE916", "\uE8EF", "\uE13D", "\uE950" };
            for (int i = 0; i < ids.Length; i++) {
                StyleNav n = new StyleNav(theme, ids[i], titles[i], glyphs[i]);
                n.Location = new Point(6, 78 + i * 44);
                n.Size = new Size(198, 40);
                string id = ids[i];
                n.Chosen += delegate { ShowPage(id); };
                nav.Add(n);
                sidebar.Controls.Add(n);
            }
        }

        void BuildPreview() {
            Label head = FoxUi.Label(theme, "Live FoxOS", theme.Head, theme.Ink);
            head.Name = "prevHead";
            previewHost.Controls.Add(head);

            preview = new PreviewCanvas(theme);
            preview.Name = "prevCanvas";
            previewHost.Controls.Add(preview);
            preview.SetDoc(store.Doc, true);

            impact = FoxUi.Label(theme, "LIVE DEMO. Apply → wallpaper + Windows accent + dock + Ghostty + sw", theme.Small, theme.Muted);
            impact.Name = "prevTip";
            impact.MaximumSize = new Size(360, 60);
            previewHost.Controls.Add(impact);
        }

        void LayoutPreview() {
            if (preview == null) return;
            int w = Math.Max(280, previewHost.ClientSize.Width - 24);
            Control head = previewHost.Controls["prevHead"];
            if (head != null) head.Bounds = new Rectangle(14, 10, w, 22);
            int tipH = 48;
            int canvasH = Math.Max(260, previewHost.ClientSize.Height - 90 - tipH);
            preview.Bounds = new Rectangle(12, 40, w, canvasH);
            if (impact != null) {
                impact.MaximumSize = new Size(w, 60);
                impact.Location = new Point(14, preview.Bottom + 8);
            }
        }

        void BuildFoot() {
            status = FoxUi.Label(theme, "готово", theme.Small, theme.Muted);
            status.Location = new Point(14, 26);
            foot.Controls.Add(status);

            Button reset = FoxUi.Button(theme, "Reset", false);
            reset.Width = 90;
            reset.Click += delegate {
                if (!store.LoadDefault())
                    store.LoadPreset(store.Doc.preset ?? "dark");
                RefreshAll();
                isDirty = true;
                UpdateDirty();
            };
            foot.Controls.Add(reset);

            applyBtn = FoxUi.Button(theme, "Apply to FoxOS", true);
            applyBtn.Width = 150;
            applyBtn.Height = 36;
            applyBtn.Font = theme.Head;
            applyBtn.Click += delegate { Apply(); };
            foot.Controls.Add(applyBtn);

            foot.Resize += delegate {
                applyBtn.Location = new Point(foot.Width - 170, 16);
                reset.Location = new Point(foot.Width - 270, 18);
            };
            applyBtn.Location = new Point(foot.Width - 170, 16);
            reset.Location = new Point(foot.Width - 270, 18);
        }

        void ShowPage(string id) {
            // Old tabs "chrome" / "texture" merged into dock
            if (id == "chrome" || id == "texture") id = "dock";
            if (page == "nodes" && id != "nodes" && editor != null &&
                !editor.ConfirmLeaveStudio()) return;
            page = id;
            for (int i = 0; i < nav.Count; i++) {
                nav[i].Active = nav[i].Id == id;
                nav[i].Invalidate();
            }
            bool studio = id == "nodes";
            previewHost.Visible = !studio;
            foot.Visible = !studio;
            if (editor != null) editor.ShowPage(id);
            top.Invalidate();
            SetFocusModule(id);
        }

        void SetFocusModule(string mod) {
            if (mod == "chrome" || mod == "texture") mod = "dock";
            if (preview != null) preview.SetFocus(mod);
            if (impact == null) return;
            switch (mod) {
                case "colors": impact.Text = "Apply → accent + wallpaper + Ghostty тема (усі panes)."; break;
                case "dock": impact.Text = "Одна вкладка: панель внизу + текстура шпалер/дощу. Тягни — дивись низ і фон."; break;
                case "windows": impact.Text = "Radius px → кути всіх вікон на льоту. Shadow лише preview."; break;
                case "buttons": impact.Text = "Стиль кнопок у preview (OK/Cancel/Fox)."; break;
                case "motion": impact.Text = "Duration = швидкість кольору в preview."; break;
                case "nodes": impact.Text = "Візуальний редактор меню: дерево, полотно, властивості."; break;
                case "assistant": impact.Text = "Локальний помічник: модель, мікрофон, дозволені дії."; break;
                case "themes": impact.Text = "Пресет = sw. Apply ставить theme.txt і всю шкіру."; break;
                case "labs": impact.Text = "FoxGlow: сила + швидкість пульсу рамок усіх вікон."; break;
                default: impact.Text = "Apply пише на систему: wall, accent, dock, Ghostty, sw."; break;
            }
        }

        Timer liveDebounce;
        Timer saveDebounce;

        void MarkDirty() {
            isDirty = true;
            UpdateDirty();
            // Live to the real system (corners / dock / wall) while you drag — no process restart.
            if (liveDebounce == null) {
                liveDebounce = new Timer();
                liveDebounce.Interval = 280;
                liveDebounce.Tick += delegate {
                    liveDebounce.Stop();
                    SystemBridge.ApplyFast(store.Doc);
                };
            }
            liveDebounce.Stop();
            liveDebounce.Start();
            // Quiet autosave style.json — no toast, no Ghostty/wallpaper reload.
            if (saveDebounce == null) {
                saveDebounce = new Timer();
                saveDebounce.Interval = 700;
                saveDebounce.Tick += delegate {
                    saveDebounce.Stop();
                    try {
                        store.Save(true);
                        isDirty = false;
                        UpdateDirty();
                        if (status != null) {
                            status.Text = "автозбережено · " + SystemBridge.MapSwName(store.Doc);
                            status.ForeColor = theme.Good;
                        }
                    } catch { }
                };
            }
            saveDebounce.Stop();
            saveDebounce.Start();
            if (preview != null) preview.SetDoc(store.Doc, false);
            top.Invalidate();
        }

        void UpdateDirty() {
            if (status == null) return;
            string sw = SystemBridge.MapSwName(store.Doc);
            status.Text = isDirty
                ? ("зміна… live + автозбереження · " + sw)
                : ("збережено · " + sw + " · Apply = wall+Ghostty");
            status.ForeColor = isDirty ? theme.Warn : theme.Muted;
        }

        void Apply() {
            store.Save();
            if (editor != null) editor.SaveAssistant();
            applyBtn.Enabled = false;
            applyBtn.Text = "Applying…";
            status.Text = "пише wallpaper + accent + dock + Ghostty…";
            status.ForeColor = theme.Accent;
            StyleDoc snap = store.Doc;
            System.Threading.ThreadPool.QueueUserWorkItem(delegate {
                Exception err = null;
                try { SystemBridge.ApplyToSystem(snap); }
                catch (Exception ex) { err = ex; }
                BeginInvoke(new Action(delegate {
                    isDirty = false;
                    UpdateDirty();
                    applyBtn.Enabled = true;
                    if (err != null) {
                        applyBtn.Text = "Apply failed";
                        status.Text = err.Message;
                        status.ForeColor = theme.Warn;
                    } else {
                        applyBtn.Text = "Applied ✓";
                        applyBtn.BackColor = theme.Good;
                        status.Text = "на системі: " + SystemBridge.MapSwName(store.Doc) + " · wall+accent+dock+Ghostty";
                        status.ForeColor = theme.Good;
                    }
                    Timer t = new Timer();
                    t.Interval = 1400;
                    t.Tick += delegate {
                        t.Stop(); t.Dispose();
                        applyBtn.Text = "Apply to FoxOS";
                        applyBtn.BackColor = theme.Accent;
                    };
                    t.Start();
                }));
            });
        }

        void RefreshAll() {
            if (editor != null) editor.ShowPage(page);
            if (preview != null) preview.SetDoc(store.Doc, true);
            top.Invalidate();
        }

        void PaintSidebar(object sender, PaintEventArgs e) {
            try {
                Graphics g = e.Graphics;
                g.Clear(theme.Sidebar);
                using (Pen p = new Pen(theme.Line)) {
                    g.DrawLine(p, sidebar.Width - 1, 0, sidebar.Width - 1, sidebar.Height);
                }
                FoxAssets.PaintFoxTile(g, new Rectangle(14, 14, 34, 34), theme.Night, 10);
                using (SolidBrush ink = new SolidBrush(theme.Ink))
                using (SolidBrush mute = new SolidBrush(theme.Muted)) {
                    SafeDraw(g, "FOXSTYLE", theme.Head, ink, 56, 14);
                    SafeDraw(g, "system look", theme.Small, mute, 56, 34);
                }
            } catch { }
        }

        void PaintTop(object sender, PaintEventArgs e) {
            try {
                Graphics g = e.Graphics;
                g.Clear(theme.Paper);
                using (Pen p = new Pen(theme.Line)) {
                    g.DrawLine(p, 0, top.Height - 1, top.Width, top.Height - 1);
                }
                string sw = SystemBridge.MapSwName(store.Doc);
                using (SolidBrush ink = new SolidBrush(theme.Ink))
                using (SolidBrush mute = new SolidBrush(theme.Muted))
                using (SolidBrush acc = new SolidBrush(theme.Accent)) {
                    SafeDraw(g, TitleFor(page), theme.Head, ink, 14, 8);
                    SafeDraw(g, (store.Doc.name ?? "") + "  |  sw " + sw + "  |  night " + (store.Doc.colors != null ? store.Doc.colors.bg : ""), theme.Small, mute, 14, 32);
                    FoxUi.PaintChip(g, top.Width - 120, 16, "sw " + sw, theme.Accent, theme.Small, true);
                }
            } catch { }
        }

        void PaintFoot(object sender, PaintEventArgs e) {
            try {
                Graphics g = e.Graphics;
                g.Clear(theme.Paper);
                using (Pen p = new Pen(theme.Line)) g.DrawLine(p, 0, 0, foot.Width, 0);
            } catch { }
        }

        static void SafeDraw(Graphics g, string text, Font font, Brush brush, float x, float y) {
            if (string.IsNullOrEmpty(text) || brush == null) return;
            try { g.DrawString(text, font ?? SystemFonts.DefaultFont, brush, x, y); }
            catch { try { g.DrawString(text, SystemFonts.DefaultFont, brush, x, y); } catch { } }
        }

        static string TitleFor(string id) {
            switch (id) {
                case "colors": return "Кольори системи";
                case "dock":
                case "chrome":
                case "texture": return "Dock / Wallpaper";
                case "windows": return "Вікна";
                case "buttons": return "Кнопки";
                case "motion": return "Motion";
                case "labs": return "Labs";
                case "nodes": return "Редактор меню";
                case "assistant": return "Помічник";
                default: return "Режими FoxOS";
            }
        }

        protected override bool ProcessCmdKey(ref Message msg, Keys keyData) {
            if (page == "nodes" && editor != null && editor.HandleStudioKeys(keyData))
                return true;
            return base.ProcessCmdKey(ref msg, keyData);
        }

        void OnKeys(object sender, KeyEventArgs e) {
            if (page == "nodes") return;
            if (e.Control && e.KeyCode == Keys.S) { Apply(); e.Handled = true; }
            if (e.KeyCode == Keys.Escape) { Close(); e.Handled = true; }
        }
    }
}
