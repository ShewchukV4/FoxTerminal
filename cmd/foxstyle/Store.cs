using System;
using System.Collections.Generic;
using System.IO;
using FoxOs.Sdk;

namespace FoxOs.Style {

    public class StyleStore {
        readonly string path;
        readonly string slotsDir;

        public StyleDoc Doc { get; private set; }

        public StyleStore() {
            path = Path.Combine(FoxPaths.RuntimeDir(), "style.json");
            slotsDir = Path.Combine(FoxPaths.RuntimeDir(), "style-slots");
            Doc = FoxJson.FileLoad<StyleDoc>(path, null);
            if (Doc == null) Doc = StyleDoc.Preset("dark");
            Normalize(Doc);
            try {
                Directory.CreateDirectory(slotsDir);
                if (!File.Exists(DefaultSlotPath))
                    SaveSlotFile(DefaultSlotPath, "default", "Default", Doc);
            } catch { }
        }

        public string FilePath { get { return path; } }
        public string SlotsDirectory { get { return slotsDir; } }
        string DefaultSlotPath { get { return Path.Combine(slotsDir, "default.json"); } }

        public void Save() { Save(false); }

        public void Save(bool quiet) {
            if (Doc == null) return;
            FoxJson.FileSave(path, Doc);
            if (!quiet) FoxToast.Show("FOXSTYLE · saved");
        }

        public void LoadPreset(string id) {
            Doc = StyleDoc.Preset(id);
            Normalize(Doc);
        }

        public void Import(StyleDoc other) {
            if (other == null) return;
            Doc = other;
            Normalize(Doc);
        }

        public void SaveDefault() {
            Directory.CreateDirectory(slotsDir);
            SaveSlotFile(DefaultSlotPath, "default", "Default", Doc);
        }

        public bool LoadDefault() {
            return LoadSlotFile(DefaultSlotPath);
        }

        public StyleSlotInfo SaveSlot(string name) {
            name = (name ?? "").Trim();
            if (name.Length == 0) throw new ArgumentException("Назва слота порожня.");
            if (name.Length > 60) name = name.Substring(0, 60);
            Directory.CreateDirectory(slotsDir);
            StyleSlotInfo existing = null;
            List<StyleSlotInfo> slots = ListSlots();
            for (int i = 0; i < slots.Count; i++) {
                if (string.Equals(slots[i].name, name,
                    StringComparison.OrdinalIgnoreCase)) {
                    existing = slots[i];
                    break;
                }
            }
            string id = existing != null ? existing.id : Guid.NewGuid().ToString("N");
            string file = Path.Combine(slotsDir, id + ".json");
            SaveSlotFile(file, id, name, Doc);
            return new StyleSlotInfo {
                id = id,
                name = name,
                savedUtc = DateTime.UtcNow.ToString("o")
            };
        }

        public bool LoadSlot(string id) {
            string file;
            if (!TrySlotPath(id, out file)) return false;
            return LoadSlotFile(file);
        }

        public bool DeleteSlot(string id) {
            string file;
            if (!TrySlotPath(id, out file)) return false;
            try {
                if (!File.Exists(file)) return false;
                File.Delete(file);
                return true;
            } catch { return false; }
        }

        public List<StyleSlotInfo> ListSlots() {
            var result = new List<StyleSlotInfo>();
            try {
                if (!Directory.Exists(slotsDir)) return result;
                string[] files = Directory.GetFiles(slotsDir, "*.json");
                for (int i = 0; i < files.Length; i++) {
                    if (string.Equals(Path.GetFileName(files[i]), "default.json",
                        StringComparison.OrdinalIgnoreCase)) continue;
                    SavedStyleSlot slot = FoxJson.FileLoad<SavedStyleSlot>(files[i], null);
                    if (slot == null || slot.style == null ||
                        string.IsNullOrWhiteSpace(slot.id)) continue;
                    result.Add(new StyleSlotInfo {
                        id = slot.id,
                        name = string.IsNullOrWhiteSpace(slot.name) ? slot.id : slot.name,
                        savedUtc = slot.savedUtc ?? ""
                    });
                }
            } catch { }
            result.Sort(delegate(StyleSlotInfo a, StyleSlotInfo b) {
                return string.Compare(a.name, b.name,
                    StringComparison.CurrentCultureIgnoreCase);
            });
            return result;
        }

        bool LoadSlotFile(string file) {
            try {
                SavedStyleSlot slot = FoxJson.FileLoad<SavedStyleSlot>(file, null);
                if (slot == null || slot.style == null) return false;
                Doc = slot.style;
                Normalize(Doc);
                Save(true);
                return true;
            } catch { return false; }
        }

        void SaveSlotFile(string file, string id, string name, StyleDoc style) {
            var slot = new SavedStyleSlot {
                id = id,
                name = name,
                savedUtc = DateTime.UtcNow.ToString("o"),
                style = style
            };
            FoxJson.FileSave(file, slot);
        }

        bool TrySlotPath(string id, out string file) {
            file = "";
            if (string.IsNullOrWhiteSpace(id)) return false;
            Guid parsed;
            if (!Guid.TryParseExact(id, "N", out parsed)) return false;
            file = Path.Combine(slotsDir, id + ".json");
            return true;
        }

        static void Normalize(StyleDoc d) {
            if (d.colors == null) d.colors = new ColorMod();
            if (d.chrome == null) d.chrome = new ChromeMod();
            if (d.window == null) d.window = new WindowMod();
            if (d.panel == null) d.panel = new PanelMod();
            if (d.button == null) d.button = new ButtonMod();
            if (d.motion == null) d.motion = new MotionMod();
            if (d.typography == null) d.typography = new TypeMod();
            if (d.texture == null) d.texture = new TextureMod();
            if (d.labs == null) d.labs = new LabsMod();
            if (d.nodeLauncher == null) d.nodeLauncher = new NodeLauncherMod();
            if (string.IsNullOrEmpty(d.preset)) d.preset = "dark";
            if (string.IsNullOrEmpty(d.name)) d.name = d.preset;
            if (string.IsNullOrEmpty(d.colors.sw)) {
                d.colors.sw = SystemBridge.MapSwName(d);
            }
            d.texture.rain = Clamp(d.texture.rain, 0, 80);
            d.texture.strength = Clamp(d.texture.strength, 0, 100);
            d.texture.scale = Clamp(d.texture.scale, 0, 100);
            d.texture.weight = Clamp(d.texture.weight, 0, 100);
            d.texture.veil = Clamp(d.texture.veil, 0, 100);
            if (string.IsNullOrEmpty(d.texture.kind)) d.texture.kind = "glass";
            d.labs.glowStrength = Clamp(d.labs.glowStrength, 0, 100);
            d.labs.glowSpeed = Clamp(d.labs.glowSpeed, 0, 100);
            d.nodeLauncher.opacity = Clamp(d.nodeLauncher.opacity, 55, 100);
            d.nodeLauncher.blur = Clamp(d.nodeLauncher.blur, 0, 40);
            d.nodeLauncher.nodeScale = Clamp(d.nodeLauncher.nodeScale, 75, 140);
            d.nodeLauncher.textScale = Clamp(d.nodeLauncher.textScale, 80, 140);
            d.nodeLauncher.spacing = Clamp(d.nodeLauncher.spacing, 75, 150);
            d.nodeLauncher.lineContrast = Clamp(d.nodeLauncher.lineContrast, 50, 180);
            d.nodeLauncher.animationSpeed = Clamp(d.nodeLauncher.animationSpeed, 40, 180);
            d.nodeLauncher.motionIntensity = Clamp(d.nodeLauncher.motionIntensity, 0, 150);
            d.nodeLauncher.pocketPosition = Clamp(d.nodeLauncher.pocketPosition, 5, 95);
            d.nodeLauncher.pocketActivationDip = Clamp(d.nodeLauncher.pocketActivationDip, 3, 12);
            d.nodeLauncher.pocketShowDelayMs = Clamp(d.nodeLauncher.pocketShowDelayMs, 0, 500);
            d.nodeLauncher.pocketHideDelayMs = Clamp(d.nodeLauncher.pocketHideDelayMs, 200, 1200);
            d.nodeLauncher.animationStyle =
                FoxNodesSync.NormalizeMotionStyle(d.nodeLauncher.animationStyle);
            if (d.nodeLauncher.revision < 1) d.nodeLauncher.revision = 1;
        }

        static int Clamp(int v, int lo, int hi) {
            if (v < lo) return lo;
            if (v > hi) return hi;
            return v;
        }
    }
}
