using System;
using System.Drawing;
using System.Windows.Forms;
using FoxOs.Assistant;
using FoxOs.Sdk;

namespace FoxOs.Style {

    public class EditorView : Panel {
        readonly FoxTheme theme;
        readonly StyleStore store;
        readonly Action dirty;
        readonly Action<string> focus;
        readonly Action replayOpen;
        string page = "themes";
        readonly Panel body;
        NodeStudioView studio;
        AssistantConfig assistantCfg;

        public EditorView(FoxTheme t, StyleStore s, Action onDirty, Action<string> onFocus, Action onReplayOpen) {
            theme = t; store = s; dirty = onDirty; focus = onFocus; replayOpen = onReplayOpen;
            BackColor = t.Paper;
            AutoScroll = true;
            FoxUi.Buffer(this);
            body = new Panel();
            body.Dock = DockStyle.Top;
            body.BackColor = t.Paper;
            Controls.Add(body);
            Resize += delegate { RelayoutWidth(); };
            ShowPage("themes");
        }

        void RelayoutWidth() {
            int w = Math.Max(480, ClientSize.Width - 24);
            foreach (Control c in body.Controls) {
                string tag = c.Tag as string;
                if (tag == "card" || tag == "row") c.Width = w;
            }
        }

        public void ShowPage(string id) {
            page = id ?? "themes";
            if (focus != null) focus(page);
            if (motionPreview != null) {
                try { motionPreview.Stop(); } catch { }
                motionPreview = null;
            }
            if (page == "nodes") {
                ShowStudio();
                return;
            }
            HideStudio();
            body.SuspendLayout();
            body.Controls.Clear();
            body.Height = 8;
            switch (page) {
                case "themes": BuildThemes(); break;
                case "colors": BuildColors(); break;
                case "dock":
                case "chrome":
                case "texture": BuildDockWall(); break;
                case "windows": BuildWindows(); break;
                case "buttons": BuildButtons(); break;
                case "motion": BuildMotion(); break;
                case "nodes": BuildNodeLauncher(); break;
                case "labs": BuildLabs(); break;
                case "assistant": BuildAssistant(); break;
                default: BuildThemes(); break;
            }
            RelayoutWidth();
            body.ResumeLayout();
        }

        void BuildAssistant() {
            if (assistantCfg == null) assistantCfg = AssistantStore.Load();
            AddHead("Помічник", "Локальний AI на Ollama · loopback.");
            AssistantPage.Build(body, theme, assistantCfg, delegate { Touch("assistant"); });
        }

        public void SaveAssistant() {
            if (assistantCfg == null) return;
            assistantCfg.revision++;
            AssistantStore.Save(assistantCfg);
        }

        void Touch(string mod) {
            if (focus != null) focus(mod);
            if (dirty != null) dirty();
        }

        void BuildThemes() {
            AddHead("Режими", "Готові пакети кольорів FoxOS (= команда sw).");
            AddImpact("Після Apply: theme.txt + колір Ghostty + desk accent.");

            FlowLayoutPanel row = new FlowLayoutPanel();
            row.Tag = "row";
            row.Location = new Point(8, body.Height);
            row.Width = Math.Max(480, Width - 24);
            row.Height = 250;
            row.WrapContents = true;

            AddPreset(row, "dark", "Dark", Color.FromArgb(11, 10, 18), Color.FromArgb(42, 36, 64), Color.FromArgb(160, 123, 92, 255));
            AddPreset(row, "light", "Light", Color.FromArgb(243, 241, 248), Color.FromArgb(220, 215, 234), Color.FromArgb(120, 91, 63, 224));
            AddPreset(row, "neon", "Neon", Color.FromArgb(4, 20, 10), Color.FromArgb(20, 90, 40), Color.FromArgb(220, 126, 240, 107));
            AddPreset(row, "foxpurple", "Purple", Color.FromArgb(24, 15, 43), Color.FromArgb(160, 90, 255), Color.FromArgb(180, 255, 162, 58));
            AddPreset(row, "custom", "Custom", Color.FromArgb(20, 16, 36), Color.FromArgb(80, 60, 120), Color.FromArgb(140, 255, 255, 255));
            Add(row, 258);

            AddHint("CUSTOM: обери Custom → вкладка Colors → клікни свотч (neon/purple/…) → крути Glass → Apply.");
            BuildStyleSlots();
        }

        void BuildStyleSlots() {
            AddHead("Збережені слоти", "Повний знімок усіх налаштувань FOXSTYLE, включно з Node Launcher.");
            Panel saveCard = Card();
            Label caption = FoxUi.Label(theme, "Назва нового слота", theme.Body, theme.Ink);
            caption.Location = new Point(16, 10);
            saveCard.Controls.Add(caption);
            TextBox name = new TextBox {
                Text = "Мій стиль",
                Width = 210,
                Location = new Point(16, 34)
            };
            saveCard.Controls.Add(name);
            Button save = FoxUi.Button(theme, "Save / overwrite", true);
            save.Width = 140;
            save.Location = new Point(220, 32);
            save.Click += delegate {
                try {
                    StyleSlotInfo slot = store.SaveSlot(name.Text);
                    FoxToast.Show("FOXSTYLE · slot " + slot.name);
                    ShowPage("themes");
                } catch (Exception ex) {
                    MessageBox.Show(ex.Message, "FOXSTYLE");
                }
            };
            saveCard.Controls.Add(save);
            Button makeDefault = FoxUi.Button(theme, "Make current Default", false);
            makeDefault.Width = 170;
            makeDefault.Location = new Point(16, 70);
            makeDefault.Click += delegate {
                store.SaveDefault();
                FoxToast.Show("FOXSTYLE · current = Default");
            };
            saveCard.Controls.Add(makeDefault);
            Button loadDefault = FoxUi.Button(theme, "Load Default", false);
            loadDefault.Width = 120;
            loadDefault.Location = new Point(196, 70);
            loadDefault.Click += delegate {
                if (!store.LoadDefault()) return;
                Touch("themes");
                ShowPage("themes");
            };
            saveCard.Controls.Add(loadDefault);
            saveCard.Height = 108;
            Add(saveCard, 116);

            System.Collections.Generic.List<StyleSlotInfo> slots = store.ListSlots();
            if (slots.Count == 0) {
                AddHint("Ще немає іменованих слотів. Поточний стиль уже збережено як Default.");
                return;
            }
            for (int i = 0; i < slots.Count; i++) {
                StyleSlotInfo current = slots[i];
                Panel card = Card();
                Label title = FoxUi.Label(theme, current.name, theme.Body, theme.Ink);
                title.Location = new Point(16, 10);
                card.Controls.Add(title);
                Label stamp = FoxUi.Label(theme, FriendlyDate(current.savedUtc),
                    theme.Small, theme.Muted);
                stamp.Location = new Point(16, 31);
                card.Controls.Add(stamp);
                Button load = FoxUi.Button(theme, "Load", true);
                load.Width = 82;
                load.Location = new Point(card.Width - 190, 14);
                load.Anchor = AnchorStyles.Top | AnchorStyles.Right;
                string loadId = current.id;
                load.Click += delegate {
                    if (!store.LoadSlot(loadId)) return;
                    Touch("themes");
                    ShowPage("themes");
                };
                card.Controls.Add(load);
                Button delete = FoxUi.Button(theme, "Delete", false);
                delete.Width = 82;
                delete.Location = new Point(card.Width - 98, 14);
                delete.Anchor = AnchorStyles.Top | AnchorStyles.Right;
                string deleteId = current.id;
                string deleteName = current.name;
                delete.Click += delegate {
                    DialogResult answer = MessageBox.Show(
                        "Видалити слот \"" + deleteName + "\"?",
                        "FOXSTYLE", MessageBoxButtons.YesNo,
                        MessageBoxIcon.Question);
                    if (answer != DialogResult.Yes) return;
                    store.DeleteSlot(deleteId);
                    ShowPage("themes");
                };
                card.Controls.Add(delete);
                card.Height = 58;
                Add(card, 66);
            }
        }

        static string FriendlyDate(string value) {
            DateTime dt;
            if (DateTime.TryParse(value, out dt))
                return dt.ToLocalTime().ToString("yyyy-MM-dd HH:mm");
            return "saved";
        }

        void AddPreset(FlowLayoutPanel row, string id, string title, Color a, Color b, Color win) {
            PresetCard c = new PresetCard(theme, id, title, a, b, win);
            c.Selected = string.Equals(store.Doc.preset, id, StringComparison.OrdinalIgnoreCase);
            c.Margin = new Padding(4);
            c.Size = new Size(150, 112);
            string pid = id;
            c.Chosen += delegate {
                store.LoadPreset(pid);
                Touch("themes");
                ShowPage("themes");
            };
            row.Controls.Add(c);
        }

        void BuildColors() {
            AddHead("Кольори (sw)", "Клік по квадрату = колір системи. Це як `sw neon`.");
            AddImpact("Apply → wallpaper + accent + Ghostty bg/fg/cursor/palette + усі відкриті panes.");

            FlowLayoutPanel grid = new FlowLayoutPanel();
            grid.Tag = "row";
            grid.Location = new Point(8, body.Height);
            grid.Width = Math.Max(480, Width - 24);
            grid.Height = 160;
            grid.WrapContents = true;

            AddSwatch(grid, "violet", "#8356E6", "#B794FF");
            AddSwatch(grid, "purple", "#A05AFF", "#FFA23A");
            AddSwatch(grid, "neon", "#7EF06B", "#B8FF7A");
            AddSwatch(grid, "orange", "#DC7A14", "#FFB04A");
            AddSwatch(grid, "blue", "#5A8CFF", "#8FB0FF");
            AddSwatch(grid, "cyan", "#46DCC8", "#7EF0E0");
            AddSwatch(grid, "rose", "#E05A9A", "#FF8AC0");
            AddSwatch(grid, "slate", "#7D93B0", "#A8B8CC");
            AddSwatch(grid, "white", "#F2F2F2", "#5B3FE0");
            AddSwatch(grid, "black", "#111111", "#888888");
            Add(grid, 168);

            ColorMod c = store.Doc.colors;
            AddSlider("Glass UI", "Праворуч панель «GLASS N%» — чим вище, тим щільніше скло", 10, 100, c.glass, delegate(int v) {
                c.glass = v; Touch("colors");
            });
            AddHint("Зараз sw=" + (c.sw ?? "?") + "  accent=" + c.accent + "  bg=" + c.bg);
            AddHint("Custom = будь-який свотч вище (пресет стане custom).");
        }

        void AddSwatch(FlowLayoutPanel grid, string name, string hex, string hex2) {
            Panel p = new Panel();
            p.Size = new Size(92, 70);
            p.Margin = new Padding(4);
            p.Cursor = Cursors.Hand;
            Color col = Parse(hex);
            bool on = string.Equals(store.Doc.colors.sw, name, StringComparison.OrdinalIgnoreCase);
            p.Paint += delegate(object s, PaintEventArgs e) {
                e.Graphics.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
                using (var path = FoxUi.Round(new Rectangle(0, 0, p.Width - 1, p.Height - 1), 10))
                using (var br = new SolidBrush(col))
                using (var pe = new Pen(on ? Color.White : theme.Line, on ? 2.5f : 1f)) {
                    e.Graphics.FillPath(br, path);
                    e.Graphics.DrawPath(pe, path);
                }
                using (var ink = new SolidBrush(Bright(col) > 140 ? Color.Black : Color.White)) {
                    e.Graphics.DrawString(name, theme.Small, ink, 8, 44);
                }
            };
            string n = name, h = hex, h2 = hex2;
            p.Click += delegate {
                store.Doc.colors.sw = n;
                store.Doc.colors.accent = h;
                store.Doc.colors.accent2 = h2;
                store.Doc.preset = "custom";
                store.Doc.name = "Custom / " + n;
                if (n == "neon") {
                    store.Doc.colors.bg = "#04140A"; store.Doc.colors.surface = "#0C2214";
                    store.Doc.colors.ink = "#E8FFE8"; store.Doc.colors.theme = "neon";
                } else if (n == "white") {
                    store.Doc.colors.bg = "#F3F1F8"; store.Doc.colors.surface = "#FFFFFF";
                    store.Doc.colors.ink = "#17142A"; store.Doc.colors.theme = "light";
                } else if (n == "purple" || n == "violet") {
                    store.Doc.colors.bg = "#180F2B"; store.Doc.colors.surface = "#241836";
                    store.Doc.colors.ink = "#F0E8FF"; store.Doc.colors.theme = "foxpurple";
                } else {
                    store.Doc.colors.bg = "#0B0A12"; store.Doc.colors.surface = "#161322";
                    store.Doc.colors.ink = "#E2E0F0"; store.Doc.colors.theme = "custom";
                }
                Touch("colors");
                ShowPage("colors");
            };
            grid.Controls.Add(p);
        }

        void BuildDockWall() {
            AddHead("Dock / Wallpaper", "Одна вкладка: панель внизу + текстура шпалер. Не браузер — це FoxOS dock.");
            AddImpact("Тягни — дивись низ екрана і фон desk. Texture/Rain одразу на live wallpaper.");
            ChromeMod c = store.Doc.chrome;
            TextureMod x = store.Doc.texture;
            AddSlider("Прозорість панелі", "Скло dock: менше % = легше (іконки лишаються клікабельні)", 20, 100, c.opacity, delegate(int v) {
                c.opacity = v; Touch("dock");
            });
            AddSlider("Висота панелі", "Товщина dock у пікселях", 36, 80, Math.Max(36, c.height), delegate(int v) {
                c.height = v; Touch("dock");
            });
            AddSlider("Розмиття (малюнок)", "Легше скло на панелі (без DWM acrylic — щоб кліки працювали)", 0, 40, c.blur, delegate(int v) {
                c.blur = v; Touch("dock");
            });
            AddToggle("Відступ від краю", "ON = pill з відступом · OFF = rail на всю ширину знизу", c.floating, delegate(bool v) {
                c.floating = v; Touch("dock");
            });
            AddChoice("Dock форма", new[] { "pill", "bar" }, x.dock, delegate(string v) {
                x.dock = v; Touch("dock");
            });
            AddHead("Текстура шпалер", "Гнучкі параметри live desk (overlay). Тягни — одразу видно.");
            AddChoice("Тип текстури", new[] { "glass", "neon", "metal", "fabric", "none" }, x.kind, delegate(string v) {
                x.kind = v; Touch("dock");
            });
            AddSlider("Сила текстури", "0 = майже плоско · 100 = максимум сітки/блиску", 0, 100, x.strength, delegate(int v) {
                x.strength = v; Touch("dock");
            });
            AddSlider("Масштаб сітки", "Відстань між лініями (дрібніше ↔ рідше)", 0, 100, x.scale, delegate(int v) {
                x.scale = v; Touch("dock");
            });
            AddSlider("Грубість ліній", "Товщина ВСІХ ліній однакова (тонко ↔ грубо)", 0, 100, x.weight, delegate(int v) {
                x.weight = v; Touch("dock");
            });
            AddSlider("Veil / світіння", "Плями accent на glass · блиск на metal/neon", 0, 100, x.veil, delegate(int v) {
                x.veil = v; Touch("dock");
            });
            AddSlider("Rain density", "Густота ASCII-дощу на desk", 0, 80, x.rain, delegate(int v) {
                x.rain = v; Touch("dock");
            });
            AddHint("Якщо панелі не видно — курсор до низу екрана (auto-hide) або foxlook shell on.");
        }

        void BuildWindows() {
            AddHead("Вікна (вся система)", "Radius у пікселях ріже кути ВСІХ вікон + dock/таскбар (на льоту).");
            AddImpact("0 = гострі кути · 1–28 = реальне заокруглення в px (не лише 2 режими Windows).");
            WindowMod w = store.Doc.window;
            AddSlider("Radius", "СИСТЕМА: точні px на вікнах + dock (тягни — видно одразу)", 0, 28, w.radius, delegate(int v) {
                w.radius = v; Touch("windows");
            });
            AddSlider("Shadow", "Тільки preview (Windows не дає міняти тінь)", 0, 100, w.shadow, delegate(int v) {
                w.shadow = v; Touch("windows");
            });
            AddChoice("Open anim", new[] { "fade", "zoom", "none" }, w.openAnim, delegate(string v) {
                w.openAnim = v; Touch("windows");
                if (replayOpen != null) replayOpen();
            });
            Button replay = FoxUi.Button(theme, "Replay open anim", true);
            replay.Width = 160;
            replay.Click += delegate { if (replayOpen != null) replayOpen(); };
            Panel card = Card();
            replay.Location = new Point(16, 14);
            card.Controls.Add(replay);
            Label h = FoxUi.Label(theme, "fade=прояв, zoom=збільшення, none=без анімації", theme.Small, theme.Muted);
            h.Location = new Point(16, 48);
            card.Controls.Add(h);
            card.Height = 78;
            Add(card, 86);
        }

        void BuildButtons() {
            AddHead("Кнопки", "Тільки preview та FoxOS-панелі; звичайні кнопки Windows не міняються.");
            AddImpact("Preview: rounded/sharp/glass/liquid.");
            ButtonMod b = store.Doc.button;
            AddChoice("Style", new[] { "rounded", "sharp", "glass", "liquid" }, b.style, delegate(string v) {
                b.style = v; Touch("buttons");
            });
        }

        MotionPreviewPanel motionPreview;

        void BuildMotion() {
            MotionMod m = store.Doc.motion;
            m.Ensure();
            AddHead("Анімації", "Система Фокс · плавний рух без важких ефектів.");
            AddImpact("Apply пише style.json → live / Node Launcher. «Застосовано» лише після ack overlay.");
            AddToggle("Увімкнути анімації", "Майстер-перемикач для всіх власних поверхонь Фокс", m.enabled, delegate(bool v) {
                m.enabled = v;
                if (!v) { m.preset = "off"; m.scale = "off"; }
                else if (m.preset == "off") { m.preset = "balanced"; m.scale = "full"; m.ApplyPreset("balanced"); }
                Touch("motion");
                RebuildMotion();
            });
            AddChoice("Пресет", new[] { "off", "economy", "balanced", "smooth", "custom" },
                FoxMotionConfig.NormalizePreset(m.preset), delegate(string v) {
                    m.ApplyPreset(v);
                    Touch("motion");
                    RebuildMotion();
                });
            AddHint("off = без анімацій · economy = короткі fade · balanced = типово · smooth = м’якше · custom = ручні значення.");
            AddSlider("Загальна швидкість %", "Вище = швидше (коротша тривалість)", 40, 180, m.speedPercent, delegate(int v) {
                m.speedPercent = v; m.preset = "custom"; Touch("motion");
            });
            AddSlider("Інтенсивність руху %", "Зміщення / масштаб. 0 = лише fade", 0, 150, m.intensityPercent, delegate(int v) {
                m.intensityPercent = v; m.preset = "custom"; Touch("motion");
            });
            AddChoice("Обмеження FPS", new[] { "30", "60", "auto" }, FoxMotionConfig.NormalizeFps(m.fps), delegate(string v) {
                m.fps = v; m.preset = "custom"; Touch("motion");
            });
            AddToggle("Зменшений рух", "Скорочує тривалість і амплітуду (також читає Windows)", m.reducedMotion, delegate(bool v) {
                m.reducedMotion = v;
                if (v && m.scale == "full") m.scale = "reduced";
                m.preset = "custom"; Touch("motion");
            });
            AddChoice("На батареї", new[] { "auto", "economy", "full" }, FoxMotionConfig.NormalizeBattery(m.battery), delegate(string v) {
                m.battery = v; m.preset = "custom"; Touch("motion");
            });
            AddChoice("Системна шкала (legacy)", new[] { "full", "reduced", "off" }, FoxMotionConfig.NormalizeScale(m.scale), delegate(string v) {
                m.scale = v; m.preset = "custom";
                if (v == "off") m.enabled = false;
                Touch("motion");
            });
            AddSlider("Палітра preview ms", "Лише колір у LIVE DEMO (не dock/launcher)", 80, 600, m.med, delegate(int v) {
                m.med = v; Touch("motion");
            });

            AddCategoryBlock("Node Launcher", m.launcher, "launcher");
            AddCategoryBlock("FOXSTYLE студія", m.studio, "studio");
            AddCategoryBlock("Dock", m.dock, "dock");
            AddCategoryBlock("Alt+Tab", m.altTab, "alttab");
            AddCategoryBlock("FoxOS панелі", m.foxos, "foxos");
            AddCategoryBlock("Hover", m.hover, "hover");
            AddCategoryBlock("Press", m.press, "press");

            AddHead("Локальний preview", "Не перезапускає desktop. Зупиняється при зміні розділу.");
            motionPreview = new MotionPreviewPanel(theme, m);
            motionPreview.Tag = "card";
            motionPreview.Width = Math.Max(480, ClientSize.Width - 24);
            motionPreview.Height = 120;
            motionPreview.Location = new Point(8, body.Height);
            body.Controls.Add(motionPreview);
            body.Height += 128;
            SyncBody();
            motionPreview.Play();
        }

        void RebuildMotion() {
            // Rebuild page so preset cards refresh values (safe: only while on motion).
            if (page == "motion") ShowPage("motion");
        }

        void AddCategoryBlock(string title, FoxAnimCategory cat, string kind) {
            if (cat == null) return;
            AddHead(title, "Окреме ввімкнення й типи переходу для цієї поверхні.");
            AddToggle(title + " · увімкнено", "Вимкни, щоб миттєво показувати без руху", cat.enabled, delegate(bool v) {
                cat.enabled = v; store.Doc.motion.preset = "custom"; Touch("motion");
            });
            string[] trans = kind == "hover" || kind == "press"
                ? new[] { "fade", "zoom", "none" }
                : new[] { "fade", "fade-slide", "zoom", "none" };
            AddChoice("Тип переходу", trans, FoxAnimCategory.NormalizeTransition(cat.transition), delegate(string v) {
                cat.transition = v; store.Doc.motion.preset = "custom"; Touch("motion");
            });
            AddChoice("Easing", new[] { "easeOut", "easeInOut", "spring", "linear" },
                NormalizeEaseChoice(cat.easing), delegate(string v) {
                    cat.easing = v; store.Doc.motion.preset = "custom"; Touch("motion");
                });
            AddSlider("Поява ms", "Типово 140–220", 40, 500, cat.openMs, delegate(int v) {
                cat.openMs = v; store.Doc.motion.preset = "custom"; Touch("motion");
            });
            AddSlider("Закриття ms", "Типово 100–160", 40, 400, cat.closeMs, delegate(int v) {
                cat.closeMs = v; store.Doc.motion.preset = "custom"; Touch("motion");
            });
            if (kind != "hover" && kind != "press") {
                AddSlider("Зміщення dip", "Логічні пікселі × DPI", 0, 24, cat.offsetDip, delegate(int v) {
                    cat.offsetDip = v; store.Doc.motion.preset = "custom"; Touch("motion");
                });
            }
            if (kind == "launcher" || kind == "press" || kind == "studio") {
                AddSlider("Масштаб від %", "97 → 100 типово", 90, 100, cat.scaleFromPct, delegate(int v) {
                    cat.scaleFromPct = v; store.Doc.motion.preset = "custom"; Touch("motion");
                });
            }
            if (kind == "launcher" || kind == "dock" || kind == "alttab" || kind == "studio") {
                AddSlider("Прозорість від %", "0 = з повної прозорості", 0, 100, cat.opacityFrom, delegate(int v) {
                    cat.opacityFrom = v; store.Doc.motion.preset = "custom"; Touch("motion");
                });
            }
            if (kind == "launcher") {
                AddSlider("Stagger ms", "Затримка між елементами (жорсткий ліміт)", 0, 40, cat.staggerMs, delegate(int v) {
                    cat.staggerMs = v; store.Doc.motion.preset = "custom"; Touch("motion");
                });
            }
            Button reset = FoxUi.Button(theme, "Скинути категорію", false);
            reset.Width = 160;
            Panel card = Card();
            reset.Location = new Point(16, 12);
            string k = kind;
            reset.Click += delegate {
                FoxAnimCategory fresh = FoxAnimCategory.Defaults(k);
                CopyCat(fresh, cat);
                store.Doc.motion.preset = "custom";
                Touch("motion");
                RebuildMotion();
            };
            card.Controls.Add(reset);
            card.Height = 48;
            Add(card, 56);
        }

        static void CopyCat(FoxAnimCategory src, FoxAnimCategory dst) {
            if (src == null || dst == null) return;
            dst.enabled = src.enabled;
            dst.transition = src.transition;
            dst.easing = src.easing;
            dst.openMs = src.openMs;
            dst.closeMs = src.closeMs;
            dst.offsetDip = src.offsetDip;
            dst.scaleFromPct = src.scaleFromPct;
            dst.opacityFrom = src.opacityFrom;
            dst.staggerMs = src.staggerMs;
        }

        static string NormalizeEaseChoice(string v) {
            v = FoxAnimCategory.NormalizeEasing(v);
            if (v == "ease-in-out" || v == "easeinout") return "easeInOut";
            if (v == "easeoutback") return "spring";
            if (v == "easeout") return "easeOut";
            return v;
        }

        // Tiny local preview card for motion section.
        sealed class MotionPreviewPanel : Panel {
            readonly FoxTheme theme;
            readonly MotionMod motion;
            readonly FoxTween tween = new FoxTween();
            readonly FoxAnimClock clock = new FoxAnimClock();
            Action<DateTime, float> tickFn;
            bool playing;

            public MotionPreviewPanel(FoxTheme t, MotionMod m) {
                theme = t; motion = m;
                DoubleBuffered = true;
                BackColor = t.Card;
                Disposed += delegate {
                    Stop();
                    clock.Dispose();
                };
                VisibleChanged += delegate {
                    if (!Visible) Stop();
                };
                Paint += OnPaint;
            }

            public void Play() {
                FoxMotionConfig cfg = motion != null ? motion.ToConfig() : FoxMotionConfig.CreateDefault();
                clock.SetFpsCap(cfg.fps);
                if (!cfg.EffectiveEnabled() || motion.studio == null || !motion.studio.enabled) {
                    tween.Snap(1f);
                    Invalidate();
                    return;
                }
                tween.Snap(0f);
                int ms = cfg.ScaleDuration(motion.studio.openMs);
                tween.Go(1f, ms, motion.studio.easing, null);
                if (tickFn == null) {
                    tickFn = delegate(DateTime now, float dt) {
                        bool need = tween.Tick(now);
                        Invalidate();
                        if (!need) {
                            playing = false;
                            clock.Remove(tickFn);
                        }
                    };
                }
                playing = true;
                clock.Add(tickFn);
            }

            public void Stop() {
                playing = false;
                if (tickFn != null) clock.Remove(tickFn);
                tween.Cancel();
            }

            void OnPaint(object s, PaintEventArgs e) {
                Graphics g = e.Graphics;
                g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
                FoxUi.PaintCard(g, new Rectangle(0, 0, Width - 1, Height - 1), theme.Card, theme.Line);
                float t = tween.Value;
                FoxMotionConfig cfg = motion != null ? motion.ToConfig() : FoxMotionConfig.CreateDefault();
                float offset = cfg.ScaleIntensity(motion != null && motion.studio != null ? motion.studio.offsetDip : 8);
                int y = 28 + (int)((1f - t) * offset);
                int alpha = (int)(255 * FoxEase.Lerp(
                    (motion != null && motion.studio != null ? motion.studio.opacityFrom : 0) / 100f, 1f, t));
                if (alpha < 0) alpha = 0; if (alpha > 255) alpha = 255;
                Rectangle card = new Rectangle(24, y, Math.Max(80, Width - 48), 56);
                using (var path = FoxUi.Round(card, 12))
                using (var fill = new SolidBrush(Color.FromArgb(alpha, theme.AccentSoft)))
                using (var ink = new SolidBrush(Color.FromArgb(alpha, theme.Ink)))
                using (var mute = new SolidBrush(Color.FromArgb(alpha, theme.Muted))) {
                    g.FillPath(fill, path);
                    g.DrawString("Preview панелі", theme.Body, ink, card.X + 14, card.Y + 12);
                    g.DrawString(playing ? "грає…" : "готово", theme.Small, mute, card.X + 14, card.Y + 32);
                }
            }
        }

        void ShowStudio() {
            AutoScroll = false;
            body.Visible = false;
            if (studio == null) {
                studio = new NodeStudioView(theme, store);
                studio.Dock = DockStyle.Fill;
                Controls.Add(studio);
            }
            studio.Visible = true;
            studio.BringToFront();
            studio.SyncFromStoreIfClean();
        }

        public bool HandleStudioKeys(Keys keyData) {
            return studio != null && studio.Visible && studio.HandleCommandKeys(keyData);
        }

        void HideStudio() {
            AutoScroll = true;
            if (studio != null) studio.Visible = false;
            body.Visible = true;
        }

        public bool ConfirmLeaveStudio() {
            return studio == null || !studio.Visible || studio.QueryClose();
        }

        void BuildNodeLauncher() {
            ShowStudio();
        }

        void BuildLabs() {
            AddHead("FoxGlow", "Пульс рамки ВСІХ вікон Windows (DWM border). На льоту після перемикання.");
            AddImpact("Сила = амплітуда · Швидкість = частота пульсу accent ↔ accent2.");
            LabsMod l = store.Doc.labs;
            AddToggle("FoxGlow", "СИСТЕМА: увімкнути пульс рамок", l.foxGlow, delegate(bool v) {
                l.foxGlow = v; Touch("labs");
            });
            AddSlider("Сила світіння", "0 = ледь помітно · 100 = сильний пульс кольору", 0, 100, l.glowStrength, delegate(int v) {
                l.glowStrength = v; Touch("labs");
            });
            AddSlider("Швидкість пульсу", "0 = повільно · 100 = швидко", 0, 100, l.glowSpeed, delegate(int v) {
                l.glowSpeed = v; Touch("labs");
            });
            AddHint("Виключи FoxGlow, якщо рамки «мигають» занадто сильно.");
            AddHead("Інше", "Експериментальні опції (частина — лише preview).");
            AddToggle("Dynamic shadows", "Тільки preview", l.dynamicShadows, delegate(bool v) {
                l.dynamicShadows = v; Touch("labs");
            });
        }

        void AddHead(string title, string desc) {
            Panel card = Card();
            Label t = FoxUi.Label(theme, title, theme.Head, theme.Ink);
            t.Location = new Point(16, 12);
            card.Controls.Add(t);
            Label d = FoxUi.Label(theme, desc, theme.Small, theme.Muted);
            d.Location = new Point(16, 38);
            d.MaximumSize = new Size(Math.Max(400, Width - 80), 48);
            card.Controls.Add(d);
            card.Height = 86;
            Add(card, 94);
        }

        void AddImpact(string text) {
            Label l = FoxUi.Label(theme, text, theme.Small, theme.Accent);
            l.Location = new Point(18, body.Height);
            l.MaximumSize = new Size(Math.Max(400, Width - 50), 40);
            l.AutoSize = true;
            body.Controls.Add(l);
            body.Height += 26;
            SyncBody();
        }

        void AddHint(string text) {
            Label l = FoxUi.Label(theme, text, theme.Small, theme.Muted);
            l.Location = new Point(18, body.Height + 2);
            l.AutoSize = true;
            body.Controls.Add(l);
            body.Height += 22;
            SyncBody();
        }

        void AddSlider(string cap, string hint, int min, int max, int val, Action<int> set) {
            Panel card = Card();
            StyleSlider s = new StyleSlider(theme, cap, hint, min, max, val);
            s.Location = new Point(12, 6);
            s.Width = Math.Max(400, card.Width - 24);
            s.Anchor = AnchorStyles.Left | AnchorStyles.Right | AnchorStyles.Top;
            s.Changed += delegate { set(s.Value); };
            card.Controls.Add(s);
            card.Height = 64;
            Add(card, 72);
        }

        void AddToggle(string cap, string hint, bool on, Action<bool> set) {
            Panel card = Card();
            StyleToggle t = new StyleToggle(theme, cap, hint, on);
            t.Location = new Point(12, 4);
            t.Width = Math.Max(400, card.Width - 24);
            t.Anchor = AnchorStyles.Left | AnchorStyles.Right | AnchorStyles.Top;
            t.Changed += delegate { set(t.On); };
            card.Controls.Add(t);
            card.Height = 56;
            Add(card, 64);
        }

        void AddChoice(string cap, string[] opts, string val, Action<string> set) {
            Panel card = Card();
            ChoiceRow r = new ChoiceRow(theme, cap, opts, val);
            r.Location = new Point(12, 4);
            r.Width = Math.Max(400, card.Width - 24);
            r.Anchor = AnchorStyles.Left | AnchorStyles.Right | AnchorStyles.Top;
            r.Changed += delegate { set(r.Value); };
            card.Controls.Add(r);
            card.Height = 58;
            Add(card, 66);
        }

        void AddText(string cap, string hint, string value, Action<string> set) {
            Panel card = Card();
            Label title = FoxUi.Label(theme, cap, theme.Body, theme.Ink);
            title.Location = new Point(12, 10);
            card.Controls.Add(title);
            Label help = FoxUi.Label(theme, hint, theme.Small, theme.Muted);
            help.Location = new Point(12, 31);
            card.Controls.Add(help);
            TextBox box = new TextBox {
                Text = value ?? "",
                Width = 180,
                Location = new Point(Math.Max(260, card.Width - 210), 14),
                Anchor = AnchorStyles.Top | AnchorStyles.Right
            };
            box.TextChanged += delegate { set(box.Text.Trim()); };
            card.Controls.Add(box);
            card.Height = 58;
            Add(card, 66);
        }

        Panel Card() {
            Panel p = new Panel();
            p.Tag = "card";
            p.BackColor = theme.Card;
            p.Width = Math.Max(480, ClientSize.Width - 24);
            p.Location = new Point(8, body.Height);
            p.Anchor = AnchorStyles.Left | AnchorStyles.Right | AnchorStyles.Top;
            p.Paint += delegate(object s, PaintEventArgs e) {
                FoxUi.PaintCard(e.Graphics, new Rectangle(0, 0, p.Width - 1, p.Height - 1), theme.Card, theme.Line);
            };
            return p;
        }

        void Add(Control c, int advance) {
            body.Controls.Add(c);
            body.Height += advance;
            SyncBody();
        }

        void SyncBody() {
            body.Width = Math.Max(ClientSize.Width - 8, 480);
            AutoScrollMinSize = new Size(0, body.Height + 24);
        }

        static Color Parse(string hex) {
            try {
                string h = hex.Trim().TrimStart('#');
                return Color.FromArgb(
                    Convert.ToInt32(h.Substring(0, 2), 16),
                    Convert.ToInt32(h.Substring(2, 2), 16),
                    Convert.ToInt32(h.Substring(4, 2), 16));
            } catch { return Color.Gray; }
        }

        static int Bright(Color c) { return (c.R * 299 + c.G * 587 + c.B * 114) / 1000; }
    }
}
