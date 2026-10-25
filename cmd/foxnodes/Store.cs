using System;
using System.Collections.Generic;
using System.IO;
using FoxOs.Sdk;

namespace FoxOs.Nodes {

    public class NodeStore {
        readonly FoxStore store;
        public NodeLauncherConfig Config { get; private set; }

        public NodeStore() {
            store = new FoxStore("foxnodes");
            Config = store.Get<NodeLauncherConfig>("launcher", null);
            if (Config == null) {
                Config = DefaultConfig();
                Save();
            } else {
                int oldVersion = Config.version;
                Normalize(Config);
                if (oldVersion != Config.version) Save();
            }
        }

        public string ConfigPath { get { return store.PathFor("launcher"); } }

        public void Save() {
            Normalize(Config);
            store.Set("launcher", Config);
        }

        public void Reload() {
            Config = store.Get<NodeLauncherConfig>("launcher", DefaultConfig());
            Normalize(Config);
        }

        public static void Normalize(NodeLauncherConfig c) {
            if (c == null) return;
            if (c.hotkey == null) c.hotkey = new HotkeySpec();
            if (c.theme == null) c.theme = new ThemeMetrics();
            if (c.categories == null) c.categories = new List<MenuNodeSpec>();
            if (c.version < 2) {
                c.theme.centerNodeDip = 82;
                c.theme.categoryNodeDip = 58;
                c.theme.categoryRadiusDip = 184;
                c.theme.cardWidthDip = 236;
                c.theme.cardHeightDip = 52;
                c.theme.cardGapDip = 12;
                c.theme.lineWidthDip = 1.4f;
                c.theme.animMs = 420;
                c.theme.glowStrength = 70;
                c.theme.ambientSpeed = 50;
                c.desktopVisible = true;
                c.desktopX = 0.52;
                c.desktopY = 0.48;
                c.version = 2;
            }
            if (c.version < 3) {
                // Match the compact neutral graph language from the reference:
                // small nodes, short branches and restrained monochrome motion.
                c.theme.centerNodeDip = 62;
                c.theme.categoryNodeDip = 44;
                c.theme.categoryRadiusDip = 132;
                c.theme.cardWidthDip = 202;
                c.theme.cardHeightDip = 40;
                c.theme.cardGapDip = 8;
                c.theme.lineWidthDip = 1.0f;
                c.theme.animMs = 280;
                c.theme.glowStrength = 22;
                c.theme.ambientSpeed = 20;
                c.version = 3;
            }
            if (c.version < 4) {
                AddCategoryIfMissing(c, Cat("media", "Медіа", "", 6, new[] {
                    Item("ytm-ui", "YouTube Music", "", 0, ActFox("ytm-ui")),
                    Item("sp-ui", "Spotify", "", 1, ActFox("sp-ui")),
                    Item("foxmirror", "Дзеркало iPhone", "", 2, ActFox("foxmirror"))
                }));
                AddCategoryIfMissing(c, Cat("system", "Система", "", 7, new[] {
                    Item("home", "FoxOS Home", "", 0, ActFox("home")),
                    Item("lock", "Lock", "", 1, ActFox("lock")),
                    Item("foxstyle", "FoxStyle", "", 2, ActFox("foxstyle"))
                }));
                c.startCollapsed = false;
                c.glassStrength = 78;
                c.motionPercent = 100;
                c.version = 4;
            }
            if (c.version < 5) {
                ApplyReferenceTheme(c.theme);
                RenameCategory(c, "tools", "Інструменти", "\uE90F");
                RenameCategory(c, "menu-settings", "Налаштування", "\uE713");
                SetCategoryDescription(c, "tools", "Інструменти проєкту");
                SetCategoryDescription(c, "menu-settings", "Налаштування меню");
                RenameCategory(c, "programs", "Програми", "\uE71D");
                RenameCategory(c, "folders", "Папки", "\uE8B7");
                RenameCategory(c, "links", "Посилання", "\uE71B");
                RenameCategory(c, "media", "Медіа", "\uE8B2");
                RenameCategory(c, "system", "Система", "\uE770");
                RenameCategory(c, "favorites", "Обране", "\uE734");
                MenuNodeSpec tools = FindCategory(c, "tools");
                if (tools != null && FindChild(tools, "foxos-suite") == null) {
                    var suite = new MenuNodeSpec();
                    suite.id = "foxos-suite";
                    suite.title = "FoxOS";
                    suite.icon = "\uE7F8";
                    suite.description = "Home, look та lock";
                    suite.order = tools.children.Count;
                    suite.children = new List<MenuNodeSpec>(new[] {
                        Item("suite-home", "Home", "\uE80F", 0, ActFox("home")),
                        Item("suite-style", "FoxStyle", "\uE790", 1, ActFox("foxstyle")),
                        Item("suite-lock", "Lock", "\uE72E", 2, ActFox("lock"))
                    });
                    tools.children.Add(suite);
                }
                c.version = 5;
            }
            if (c.version < 6) {
                // v5 development builds could persist pointer deltas from synthetic
                // click tests. Start the finalized geometry from a balanced layout.
                for (int i = 0; i < c.categories.Count; i++)
                    ResetOffsets(c.categories[i]);
                SetNodeIcon(c, "ytm-ui", "\uE768");
                SetNodeIcon(c, "sp-ui", "\uE8D6");
                SetNodeIcon(c, "foxmirror", "\uE8EA");
                SetNodeIcon(c, "home", "\uE80F");
                SetNodeIcon(c, "lock", "\uE72E");
                SetNodeIcon(c, "foxstyle", "\uE790");
                c.version = 6;
            }
            if (c.version < 7) {
                // The redesigned branch columns use the balanced radial layout as
                // their collision boundary.
                for (int i = 0; i < c.categories.Count; i++)
                    ResetOffsets(c.categories[i]);
                c.version = 7;
            }
            if (c.version < 8) {
                c.lastNormalX = c.desktopX;
                c.lastNormalY = c.desktopY;
                if (c.pocket == null) c.pocket = new EdgePocketSpec();
                c.version = 8;
            }
            if (c.version < 9) {
                AddDeepNavigationSample(c);
                c.version = 9;
            }
            if (c.version < 10) {
                // Clear offsets left by pre-threshold click handling. From v10 a
                // node is not moved until the pointer crosses the drag threshold.
                for (int i = 0; i < c.categories.Count; i++)
                    ResetOffsets(c.categories[i]);
                c.version = 10;
            }
            c.glassStrength = Clamp(c.glassStrength, 20, 100);
            c.motionPercent = Clamp(c.motionPercent, 0, 160);
            if (c.pocket == null) c.pocket = new EdgePocketSpec();
            c.pocket.positionPercent = Clamp(c.pocket.positionPercent, 5, 95);
            c.pocket.activationDip = Clamp(c.pocket.activationDip, 3, 12);
            c.pocket.showDelayMs = Clamp(c.pocket.showDelayMs, 0, 500);
            c.pocket.hideDelayMs = Clamp(c.pocket.hideDelayMs, 200, 1200);
            string edge = (c.pocket.edge ?? "right").ToLowerInvariant();
            if (edge != "right" && edge != "left" && edge != "top") edge = "right";
            c.pocket.edge = edge;
            if (c.desktopX < 0.15 || c.desktopX > 0.85) c.desktopX = 0.52;
            if (c.desktopY < 0.18 || c.desktopY > 0.82) c.desktopY = 0.48;
            c.lastNormalX = Math.Max(0.05, Math.Min(0.95, c.lastNormalX));
            c.lastNormalY = Math.Max(0.05, Math.Min(0.95, c.lastNormalY));
            if (c.revision < 1) c.revision = 1;
            if (c.categories == null) c.categories = new List<MenuNodeSpec>();
            if (c.categories.Count == 0) c.categories = DefaultConfig().categories;
            var objects = new HashSet<MenuNodeSpec>();
            var ids = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            for (int i = 0; i < c.categories.Count; i++) {
                NormalizeNode(c.categories[i], objects, ids, 0);
            }
            c.categories.Sort(delegate(MenuNodeSpec a, MenuNodeSpec b) {
                int o = a.order.CompareTo(b.order);
                if (o != 0) return o;
                return string.Compare(a.title, b.title, StringComparison.OrdinalIgnoreCase);
            });
        }

        public static string PruneOpenPath(NodeLauncherConfig c, ref string categoryId,
            List<string> branch) {
            if (branch == null) branch = new List<string>();
            if (c == null || c.categories == null) {
                categoryId = "";
                branch.Clear();
                return "";
            }
            MenuNodeSpec category = null;
            for (int i = 0; i < c.categories.Count; i++) {
                if (c.categories[i] != null && c.categories[i].id == categoryId) {
                    category = c.categories[i];
                    break;
                }
            }
            if (category == null) {
                categoryId = "";
                branch.Clear();
                return "";
            }
            MenuNodeSpec parent = category;
            int keep = 0;
            for (int i = 0; i < branch.Count; i++) {
                MenuNodeSpec child = null;
                if (parent.children != null) {
                    for (int j = 0; j < parent.children.Count; j++) {
                        if (parent.children[j] != null && parent.children[j].id == branch[i]) {
                            child = parent.children[j];
                            break;
                        }
                    }
                }
                if (child == null) break;
                branch[keep++] = child.id;
                parent = child;
            }
            if (keep < branch.Count) branch.RemoveRange(keep, branch.Count - keep);
            return categoryId;
        }

        static void AddCategoryIfMissing(NodeLauncherConfig c, MenuNodeSpec category) {
            for (int i = 0; i < c.categories.Count; i++) {
                if (c.categories[i].id == category.id) return;
            }
            c.categories.Add(category);
        }

        static int Clamp(int value, int lo, int hi) {
            if (value < lo) return lo;
            if (value > hi) return hi;
            return value;
        }

        static void ApplyReferenceTheme(ThemeMetrics t) {
            t.centerNodeDip = 56;
            t.categoryNodeDip = 44;
            t.categoryRadiusDip = 140;
            t.iconDip = 17;
            t.labelHeightDip = 25;
            t.labelPadXDip = 10;
            t.labelGapDip = 6;
            t.cardWidthDip = 202;
            t.cardHeightDip = 40;
            t.cardGapDip = 7;
            t.cardRadiusDip = 11;
            t.lineWidthDip = 1f;
            t.centerEnterMs = 180;
            t.categoryEnterMs = 225;
            t.categoryStaggerMs = 15;
            t.branchOpenMs = 200;
            t.branchCloseMs = 140;
            t.cardStaggerMs = 24;
            t.hoverMs = 140;
            t.pressMs = 95;
            t.categoryTravelDip = 11;
            t.cardTravelDip = 10;
            t.shadowOffsetDip = 3;
            t.surfaceHex = "#202226";
            t.textHex = "#E6E7E9";
            t.mutedHex = "#9B9FA7";
            t.surfaceAlpha = 84;
            t.highlightAlpha = 6;
            t.outlineAlpha = 18;
            t.lineAlpha = 15;
            t.activeLineAlpha = 36;
            t.glowStrength = 0;
            t.ambientSpeed = 0;
        }

        static MenuNodeSpec FindCategory(NodeLauncherConfig c, string id) {
            for (int i = 0; i < c.categories.Count; i++)
                if (c.categories[i].id == id) return c.categories[i];
            return null;
        }

        static MenuNodeSpec FindChild(MenuNodeSpec parent, string id) {
            if (parent == null || parent.children == null) return null;
            for (int i = 0; i < parent.children.Count; i++)
                if (parent.children[i].id == id) return parent.children[i];
            return null;
        }

        static void RenameCategory(NodeLauncherConfig c, string id, string title, string icon) {
            MenuNodeSpec node = FindCategory(c, id);
            if (node == null) return;
            node.title = title;
            node.icon = icon;
        }

        static void SetCategoryDescription(NodeLauncherConfig c, string id, string description) {
            MenuNodeSpec node = FindCategory(c, id);
            if (node != null) node.description = description;
        }

        static void ResetOffsets(MenuNodeSpec node) {
            if (node == null) return;
            node.offsetXDip = 0;
            node.offsetYDip = 0;
            if (node.children == null) return;
            for (int i = 0; i < node.children.Count; i++)
                ResetOffsets(node.children[i]);
        }

        static void SetNodeIcon(NodeLauncherConfig c, string id, string icon) {
            for (int i = 0; i < c.categories.Count; i++)
                if (SetNodeIcon(c.categories[i], id, icon)) return;
        }

        static void AddDeepNavigationSample(NodeLauncherConfig c) {
            MenuNodeSpec programs = FindCategory(c, "programs");
            if (programs == null || FindChild(programs, "development") != null) return;
            MenuNodeSpec action = Item("dev-action", "Notepad", "\uE8A5", 0,
                ActExe("notepad.exe", ""));
            MenuNodeSpec subgroup = Item("dev-subgroup", "Підгрупа", "\uE8B7", 0, null);
            subgroup.children.Add(action);
            MenuNodeSpec group = Item("dev-group", "Група", "\uE8B7", 0, null);
            group.children.Add(subgroup);
            MenuNodeSpec tools = Item("dev-tools", "Інструменти", "\uE90F", 0, null);
            tools.children.Add(group);
            MenuNodeSpec development = Item("development", "Розробка", "\uE943",
                programs.children.Count, null);
            development.children.Add(tools);
            programs.children.Add(development);
        }

        static bool SetNodeIcon(MenuNodeSpec node, string id, string icon) {
            if (node.id == id) {
                node.icon = icon;
                return true;
            }
            if (node.children == null) return false;
            for (int i = 0; i < node.children.Count; i++)
                if (SetNodeIcon(node.children[i], id, icon)) return true;
            return false;
        }

        static void NormalizeNode(MenuNodeSpec n, HashSet<MenuNodeSpec> objects,
            HashSet<string> ids, int depth) {
            if (n == null) return;
            if (!objects.Add(n) || depth > 64) return;
            if (string.IsNullOrEmpty(n.id) || !ids.Add(n.id)) {
                n.id = Guid.NewGuid().ToString("N");
                ids.Add(n.id);
            }
            if (n.children == null) n.children = new List<MenuNodeSpec>();
            if (n.action != null && string.IsNullOrEmpty(n.action.kind)) n.action = null;
            for (int i = n.children.Count - 1; i >= 0; i--) {
                MenuNodeSpec child = n.children[i];
                if (child == null || objects.Contains(child)) {
                    n.children.RemoveAt(i);
                    continue;
                }
                NormalizeNode(child, objects, ids, depth + 1);
            }
            n.children.Sort(delegate(MenuNodeSpec a, MenuNodeSpec b) {
                int o = a.order.CompareTo(b.order);
                if (o != 0) return o;
                return string.Compare(a.title, b.title, StringComparison.OrdinalIgnoreCase);
            });
        }

        public static NodeLauncherConfig DefaultConfig() {
            string desk = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
            string docs = Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments);
            string local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);

            var c = new NodeLauncherConfig();
            c.categories = new List<MenuNodeSpec>();

            c.categories.Add(Cat("programs", "Програми", "\uE71D", 0, new[] {
                Item("notepad", "Notepad", "\uE8A5", 0, ActExe("notepad.exe", "")),
                Item("explorer", "Провідник", "\uE8B7", 1, ActExe("explorer.exe", "")),
                Item("term", "Термінал Fox", "\uE756", 2, ActFox("term")),
                Item("foxlife", "Fox Life", "\uE8A1", 3, ActFox("foxlife"))
            }));

            c.categories.Add(Cat("folders", "Папки", "\uE8B7", 1, new[] {
                Item("desktop", "Робочий стіл", "\uE8A5", 0, ActPath(desk)),
                Item("documents", "Документи", "\uE8A5", 1, ActPath(docs)),
                Item("foxdata", "FoxTerminal data", "\uE8A5", 2, ActPath(Path.Combine(local, "FoxTerminal"))),
                Item("cmdrepo", "cmd (репо)", "\uE8A5", 3, ActPath(FoxPaths.CmdDir))
            }));

            c.categories.Add(Cat("links", "Посилання", "\uE71B", 2, new[] {
                Item("hub", "Fox Hub (sites)", "\uE8A7", 0, ActFox("sites")),
                Item("gh", "FoxTerminal GitHub", "\uE8A7", 1, ActUrl("https://github.com/ShewchukV4/FoxTerminal"))
            }));

            var suite = Item("foxos-suite", "FoxOS", "\uE7F8", 4, null);
            suite.description = "Home, look та lock";
            suite.children = new List<MenuNodeSpec>(new[] {
                Item("suite-home", "Home", "\uE80F", 0, ActFox("home")),
                Item("suite-style", "FoxStyle", "\uE790", 1, ActFox("foxstyle")),
                Item("suite-lock", "Lock", "\uE72E", 2, ActFox("lock"))
            });
            c.categories.Add(Cat("tools", "Інструменти", "\uE90F", 3, new[] {
                Item("foxhelp", "foxhelp", "\uE946", 0, ActFox("foxhelp")),
                Item("foxdocs", "foxdocs", "\uE8A5", 1, ActFox("foxdocs")),
                Item("settings", "settings", "\uE713", 2, ActFox("settings")),
                Item("pulse", "pulse", "\uE9D9", 3, ActFox("pulse -Once")),
                suite
            }));

            c.categories.Add(Cat("menu-settings", "Налаштування", "\uE713", 4, new[] {
                Item("open-editor", "Редактор пунктів…", "\uE70F", 0, ActInternal("settings")),
                Item("reload", "Перезавантажити конфіг", "\uE72C", 1, ActInternal("reload"))
            }));

            c.categories.Add(Cat("favorites", "Обране", "\uE734", 5, new[] {
                Item("add-hint", "Додайте пункти в редакторі", "\uE946", 0, ActInternal("settings"))
            }));

            c.categories.Add(Cat("media", "Медіа", "\uE8B2", 6, new[] {
                Item("ytm-ui", "YouTube Music", "\uE768", 0, ActFox("ytm-ui")),
                Item("sp-ui", "Spotify", "\uE8D6", 1, ActFox("sp-ui")),
                Item("foxmirror", "Дзеркало iPhone", "\uE8EA", 2, ActFox("foxmirror"))
            }));

            c.categories.Add(Cat("system", "Система", "\uE770", 7, new[] {
                Item("home", "FoxOS Home", "\uE80F", 0, ActFox("home")),
                Item("lock", "Lock", "\uE72E", 1, ActFox("lock")),
                Item("foxstyle", "FoxStyle", "\uE790", 2, ActFox("foxstyle"))
            }));

            AddDeepNavigationSample(c);

            return c;
        }

        static MenuNodeSpec Cat(string id, string title, string icon, int order, MenuNodeSpec[] kids) {
            var n = new MenuNodeSpec();
            n.id = id;
            n.title = title;
            n.icon = icon;
            n.order = order;
            n.children = new List<MenuNodeSpec>(kids);
            if (id == "tools") n.description = "Інструменти проєкту";
            if (id == "menu-settings") n.description = "Налаштування меню";
            return n;
        }

        static MenuNodeSpec Item(string id, string title, string icon, int order, MenuActionSpec act) {
            var n = new MenuNodeSpec();
            n.id = id;
            n.title = title;
            n.icon = icon;
            n.order = order;
            n.action = act;
            return n;
        }

        static MenuActionSpec ActExe(string path, string args) {
            var a = new MenuActionSpec();
            a.kind = "openExe";
            a.path = path;
            a.args = args ?? "";
            return a;
        }

        static MenuActionSpec ActPath(string path) {
            var a = new MenuActionSpec();
            a.kind = "openPath";
            a.path = path ?? "";
            return a;
        }

        static MenuActionSpec ActUrl(string url) {
            var a = new MenuActionSpec();
            a.kind = "openUrl";
            a.url = url ?? "";
            return a;
        }

        static MenuActionSpec ActFox(string command) {
            var a = new MenuActionSpec();
            a.kind = "foxCommand";
            a.command = command ?? "";
            return a;
        }

        static MenuActionSpec ActInternal(string command) {
            var a = new MenuActionSpec();
            a.kind = "internal";
            a.command = command ?? "";
            return a;
        }
    }
}
