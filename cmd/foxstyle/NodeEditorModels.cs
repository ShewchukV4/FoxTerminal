using System;
using System.Collections.Generic;
using System.IO;
using FoxOs.Sdk;

namespace FoxOs.Style {

    public class EditorHotkey {
        public bool ctrl = true, alt = true, shift = false, win = false;
        public string key = "Space";
    }

    public class EditorAction {
        public string kind = "";
        public string path = "";
        public string args = "";
        public string url = "";
        public string command = "";
    }

    public class EditorNodeStyle {
        public bool enabled = true;
        public string surfaceHex = "";
        public string textHex = "";
        public string accentHex = "";
    }

    public class EditorNode {
        public string id = "";
        public string title = "";
        public string icon = "";
        public string description = "";
        public int order;
        public int offsetXDip;
        public int offsetYDip;
        public List<EditorNode> children = new List<EditorNode>();
        public EditorAction action;
        public EditorNodeStyle style;
    }

    public class EditorThemeMetrics {
        public int centerNodeDip = 56, categoryNodeDip = 44, categoryRadiusDip = 140;
        public int iconDip = 17, labelHeightDip = 25, labelPadXDip = 10, labelGapDip = 6;
        public int cardWidthDip = 202, cardHeightDip = 40, cardGapDip = 7, cardRadiusDip = 11;
        public float lineWidthDip = 1f;
        public int centerEnterMs = 180, categoryEnterMs = 225, categoryStaggerMs = 15;
        public int branchOpenMs = 200, branchCloseMs = 140, cardStaggerMs = 24;
        public int hoverMs = 140, pressMs = 95, categoryTravelDip = 11, cardTravelDip = 10;
        public int shadowOffsetDip = 3;
        public string surfaceHex = "#202226", textHex = "#E6E7E9", mutedHex = "#9B9FA7";
        public int surfaceAlpha = 84, highlightAlpha = 6, outlineAlpha = 18;
        public int lineAlpha = 15, activeLineAlpha = 36;
        public int animMs = 280, glowStrength, ambientSpeed;
    }

    public class EditorPocket {
        public bool enabled = true;
        public string edge = "right";
        public int positionPercent = 48, activationDip = 5;
        public int showDelayMs = 150, hideDelayMs = 520;
        public bool marker = true, pocketed;
    }

    public class NodeEditorDocument {
        public EditorHotkey hotkey = new EditorHotkey();
        public EditorThemeMetrics theme = new EditorThemeMetrics();
        public List<EditorNode> categories = new List<EditorNode>();
        public bool desktopVisible = true, startCollapsed;
        public int glassStrength = 78, motionPercent = 100;
        public double desktopX = 0.52, desktopY = 0.48;
        public double lastNormalX = 0.52, lastNormalY = 0.48;
        public EditorPocket pocket = new EditorPocket();
        public int version = 10;
        public int revision = 1;
    }

    public class NodeEditorProfile {
        public string id = "", name = "", savedUtc = "";
        public NodeEditorDocument launcher;
        public StyleDoc style;
    }

    public class NodeEditorSnapshot {
        public NodeEditorDocument launcher;
        public StyleDoc style;
    }

    public class NodeProfileInfo {
        public string id = "", name = "", savedUtc = "";
    }

    public sealed class NodeEditorRepository {
        readonly string launcherPath;
        readonly string profilesDir;

        public NodeEditorRepository() {
            var store = new FoxStore("foxnodes");
            launcherPath = store.PathFor("launcher");
            profilesDir = Path.Combine(FoxPaths.RuntimeDir(), "node-launcher-profiles");
        }

        public string LauncherPath { get { return launcherPath; } }

        public NodeEditorDocument Load(out string error) {
            error = "";
            NodeEditorDocument doc = FoxJson.FileLoad<NodeEditorDocument>(launcherPath, null);
            if (doc == null) {
                error = "Не вдалося прочитати launcher.json.";
                doc = new NodeEditorDocument();
            }
            Normalize(doc);
            return doc;
        }

        public bool Apply(NodeEditorDocument doc, out string error) {
            return SaveLauncher(doc, out error);
        }

        public bool SaveLauncher(NodeEditorDocument doc, out string error) {
            error = Validate(doc);
            if (!string.IsNullOrEmpty(error)) return false;
            try {
                Normalize(doc);
                FoxJson.FileSave(launcherPath, doc);
                return true;
            } catch (Exception ex) {
                error = "Не вдалося зберегти: " + ex.Message;
                return false;
            }
        }

        public void SignalReload(int revision) {
            FoxNodesSync.RequestReload(revision);
        }

        public string Validate(NodeEditorDocument doc) {
            if (doc == null) return "Чернетка порожня.";
            if (doc.categories == null || doc.categories.Count == 0)
                return "Додайте хоча б одну категорію.";
            var ids = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var seen = new HashSet<EditorNode>();
            for (int i = 0; i < doc.categories.Count; i++) {
                string error = ValidateNode(doc.categories[i], ids, seen, 0);
                if (!string.IsNullOrEmpty(error)) return error;
            }
            return "";
        }

        string ValidateNode(EditorNode node, HashSet<string> ids,
            HashSet<EditorNode> seen, int depth) {
            if (node == null) return "Знайдено порожній елемент.";
            if (depth > 64) return "Гілка надто глибока (максимум безпеки — 64).";
            if (!seen.Add(node)) return "Група посилається сама на себе.";
            if (string.IsNullOrWhiteSpace(node.id) || !ids.Add(node.id))
                return "Знайдено дубльований або порожній ID біля «" + node.title + "».";
            if (string.IsNullOrWhiteSpace(node.title))
                return "Вкажіть назву елемента.";
            if (node.children == null) node.children = new List<EditorNode>();
            if (node.children.Count > 0 && node.action != null)
                return "«" + node.title + "» не може одночасно бути групою і дією.";
            for (int i = 0; i < node.children.Count; i++) {
                string error = ValidateNode(node.children[i], ids, seen, depth + 1);
                if (!string.IsNullOrEmpty(error)) return error;
            }
            if (node.action != null) {
                string kind = node.action.kind ?? "";
                if (kind == "openUrl") {
                    Uri uri;
                    if (!Uri.TryCreate(node.action.url, UriKind.Absolute, out uri) ||
                        (uri.Scheme != "http" && uri.Scheme != "https"))
                        return "Некоректне посилання у «" + node.title + "».";
                } else if ((kind == "openExe" || kind == "openPath") &&
                    string.IsNullOrWhiteSpace(node.action.path))
                    return "Не вказано шлях у «" + node.title + "».";
            }
            return "";
        }

        public static T Clone<T>(T value) {
            return FoxJson.Load<T>(FoxJson.Dump(value));
        }

        public static void Normalize(NodeEditorDocument doc) {
            if (doc.hotkey == null) doc.hotkey = new EditorHotkey();
            if (doc.theme == null) doc.theme = new EditorThemeMetrics();
            if (doc.pocket == null) doc.pocket = new EditorPocket();
            if (doc.categories == null) doc.categories = new List<EditorNode>();
            doc.version = Math.Max(10, doc.version);
            var ids = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var seen = new HashSet<EditorNode>();
            for (int i = 0; i < doc.categories.Count; i++)
                NormalizeNode(doc.categories[i], ids, seen, 0);
            Reorder(doc.categories);
        }

        static void NormalizeNode(EditorNode node, HashSet<string> ids,
            HashSet<EditorNode> seen, int depth) {
            if (node == null || depth > 64 || !seen.Add(node)) return;
            if (string.IsNullOrWhiteSpace(node.id) || !ids.Add(node.id)) {
                node.id = Guid.NewGuid().ToString("N");
                ids.Add(node.id);
            }
            if (node.children == null) node.children = new List<EditorNode>();
            for (int i = node.children.Count - 1; i >= 0; i--) {
                if (node.children[i] == null || seen.Contains(node.children[i]))
                    node.children.RemoveAt(i);
                else NormalizeNode(node.children[i], ids, seen, depth + 1);
            }
            Reorder(node.children);
        }

        public static void Reorder(List<EditorNode> nodes) {
            if (nodes == null) return;
            for (int i = 0; i < nodes.Count; i++) nodes[i].order = i;
        }

        public List<NodeProfileInfo> Profiles() {
            var result = new List<NodeProfileInfo>();
            try {
                if (!Directory.Exists(profilesDir)) return result;
                foreach (string file in Directory.GetFiles(profilesDir, "*.json")) {
                    NodeEditorProfile p = FoxJson.FileLoad<NodeEditorProfile>(file, null);
                    if (p != null && p.launcher != null)
                        result.Add(new NodeProfileInfo { id = p.id, name = p.name, savedUtc = p.savedUtc });
                }
            } catch { }
            result.Sort(delegate(NodeProfileInfo a, NodeProfileInfo b) {
                return string.Compare(a.name, b.name, StringComparison.CurrentCultureIgnoreCase);
            });
            return result;
        }

        public NodeProfileInfo SaveProfile(string name, NodeEditorDocument doc, StyleDoc style) {
            name = (name ?? "").Trim();
            if (name.Length == 0) throw new ArgumentException("Введіть назву профілю.");
            Directory.CreateDirectory(profilesDir);
            NodeProfileInfo existing = Profiles().Find(delegate(NodeProfileInfo x) {
                return string.Equals(x.name, name, StringComparison.OrdinalIgnoreCase);
            });
            string id = existing != null ? existing.id : Guid.NewGuid().ToString("N");
            var profile = new NodeEditorProfile {
                id = id, name = name, savedUtc = DateTime.UtcNow.ToString("o"),
                launcher = Clone(doc), style = Clone(style)
            };
            FoxJson.FileSave(Path.Combine(profilesDir, id + ".json"), profile);
            return new NodeProfileInfo { id = id, name = name, savedUtc = profile.savedUtc };
        }

        public NodeEditorProfile LoadProfile(string id) {
            string file;
            if (!TryProfilePath(id, out file)) return null;
            return FoxJson.FileLoad<NodeEditorProfile>(file, null);
        }

        public bool DeleteProfile(string id) {
            string file;
            if (!TryProfilePath(id, out file)) return false;
            try { if (File.Exists(file)) File.Delete(file); return true; }
            catch { return false; }
        }

        public NodeEditorProfile ImportProfile(string file, out string error) {
            error = "";
            NodeEditorProfile p = FoxJson.FileLoad<NodeEditorProfile>(file, null);
            if (p == null || p.launcher == null) {
                error = "Файл не є профілем Node Launcher.";
                return null;
            }
            string validation = Validate(p.launcher);
            if (!string.IsNullOrEmpty(validation)) {
                error = validation;
                return null;
            }
            if (p.style == null) p.style = new StyleDoc();
            return p;
        }

        public void ExportProfile(string file, string name,
            NodeEditorDocument doc, StyleDoc style) {
            FoxJson.FileSave(file, new NodeEditorProfile {
                id = Guid.NewGuid().ToString("N"),
                name = string.IsNullOrWhiteSpace(name) ? "Export" : name,
                savedUtc = DateTime.UtcNow.ToString("o"),
                launcher = Clone(doc), style = Clone(style)
            });
        }

        public static bool WouldCycle(EditorNode moving, EditorNode target) {
            return moving == null || target == null || moving == target ||
                ContainsNode(moving, target.id);
        }

        public static bool ContainsNode(EditorNode node, string id) {
            if (node == null) return false;
            if (node.id == id) return true;
            if (node.children == null) return false;
            for (int i = 0; i < node.children.Count; i++)
                if (ContainsNode(node.children[i], id)) return true;
            return false;
        }

        public static void RenewIds(EditorNode node) {
            if (node == null) return;
            node.id = Guid.NewGuid().ToString("N");
            if (node.children == null) return;
            for (int i = 0; i < node.children.Count; i++) RenewIds(node.children[i]);
        }

        public static void CollectIds(EditorNode node, HashSet<string> ids) {
            if (node == null) return;
            ids.Add(node.id ?? "");
            if (node.children == null) return;
            for (int i = 0; i < node.children.Count; i++) CollectIds(node.children[i], ids);
        }

        bool TryProfilePath(string id, out string file) {
            file = "";
            Guid parsed;
            if (!Guid.TryParseExact(id ?? "", "N", out parsed)) return false;
            file = Path.Combine(profilesDir, id + ".json");
            return true;
        }
    }
}
