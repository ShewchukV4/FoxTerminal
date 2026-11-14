// FOX features config — mixer / action wheel / headphone pause.
// Shared by foxos-live, foxnodes, foxstyle. C# 5 / .NET Framework 4.x.

using System;
using System.Collections.Generic;
using System.IO;

namespace FoxOs.Sdk {

    public class FoxFeaturesDoc {
        public int version = 1;
        public int revision = 1;
        public MixerFeature mixer = new MixerFeature();
        public ActionWheelFeature actionWheel = new ActionWheelFeature();
        public HeadphonesFeature headphones = new HeadphonesFeature();
        public OverviewFeature overview = new OverviewFeature();
    }

    // panelMode: "classic" = previous taskbar/dock edge behaviour;
    // "overview" = no persistent bars; Win alone opens FOX Overview.
    public class OverviewFeature {
        public bool enabled = false;
        public string panelMode = "classic"; // classic | overview
        public int openMs = 220;
        public int closeMs = 180;
        public int stageScalePct = 86; // 80..90 visual stage scale
    }

    public class MixerFeature {
        public bool enabled = true;
        public bool showInactive = false;
    }

    public class ActionWheelFeature {
        public bool enabled = false;
        public bool ctrl = true;
        public bool alt = true;
        public bool shift = false;
        public bool win = false;
        public string key = "W";
        public int sizeDip = 168;
        public int deadZoneDip = 28;
        public List<ActionWheelSector> sectors = new List<ActionWheelSector>();
    }

    public class ActionWheelSector {
        public string id = "";
        public string title = "";
        public string icon = "";
        public string kind = "internal"; // internal | foxcommand | media | openpath
        public string command = "";
        public int order = 0;
    }

    public class HeadphonesFeature {
        public bool enabled = false;
        public string deviceId = "";
        public string deviceName = "";
        // When true, after the same headphones return and stabilize, Play the
        // session FOX itself paused — only if the user did not take over.
        public bool autoResume = false;
        public int debounceMs = 700;
        public int resumeStabilizeMs = 1200;
        public int resumeOfferSec = 45;
    }

    public static class FoxFeatures {
        public static string PathFile {
            get { return System.IO.Path.Combine(FoxPaths.RuntimeDir(), "features.json"); }
        }

        public static FoxFeaturesDoc Defaults() {
            FoxFeaturesDoc d = new FoxFeaturesDoc();
            d.actionWheel.sectors = DefaultWheelSectors();
            d.overview = new OverviewFeature();
            return d;
        }

        public static bool OverviewActive(FoxFeaturesDoc d) {
            if (d == null || d.overview == null) return false;
            if (!d.overview.enabled) return false;
            return string.Equals(d.overview.panelMode, "overview", StringComparison.OrdinalIgnoreCase);
        }

        public static void WriteOverviewFlag(bool on) {
            try {
                string p = System.IO.Path.Combine(FoxPaths.RuntimeDir(), "overview.mode");
                File.WriteAllText(p, on ? "on" : "off", new System.Text.UTF8Encoding(false));
            } catch { }
        }

        public static List<ActionWheelSector> DefaultWheelSectors() {
            List<ActionWheelSector> list = new List<ActionWheelSector>();
            list.Add(Sec("mixer", "Мікшер", "♪", "internal", "vol", 0));
            list.Add(Sec("playpause", "Play / Pause", "▶", "media", "playpause", 1));
            list.Add(Sec("next", "Далі", "⏭", "media", "next", 2));
            list.Add(Sec("shot", "Скриншот", "▣", "internal", "screenshot", 3));
            return list;
        }

        static ActionWheelSector Sec(string id, string title, string icon, string kind, string cmd, int order) {
            ActionWheelSector s = new ActionWheelSector();
            s.id = id; s.title = title; s.icon = icon; s.kind = kind; s.command = cmd; s.order = order;
            return s;
        }

        public static FoxFeaturesDoc Load() {
            FoxFeaturesDoc d = FoxJson.FileLoad<FoxFeaturesDoc>(PathFile, null);
            if (d == null) d = Defaults();
            Normalize(d);
            return d;
        }

        public static void Save(FoxFeaturesDoc d) {
            if (d == null) return;
            Normalize(d);
            d.revision = Math.Max(1, d.revision + 1);
            FoxJson.FileSave(PathFile, d);
            try {
                string sig = System.IO.Path.Combine(FoxPaths.RuntimeDir(), "features.signal");
                File.WriteAllText(sig, "reload " + d.revision, new System.Text.UTF8Encoding(false));
            } catch { }
        }

        public static void Normalize(FoxFeaturesDoc d) {
            if (d == null) return;
            if (d.version < 1) d.version = 1;
            if (d.revision < 1) d.revision = 1;
            if (d.mixer == null) d.mixer = new MixerFeature();
            if (d.actionWheel == null) d.actionWheel = new ActionWheelFeature();
            if (d.headphones == null) d.headphones = new HeadphonesFeature();
            if (d.overview == null) d.overview = new OverviewFeature();
            if (d.actionWheel.sectors == null || d.actionWheel.sectors.Count == 0)
                d.actionWheel.sectors = DefaultWheelSectors();
            if (string.IsNullOrEmpty(d.actionWheel.key)) d.actionWheel.key = "W";
            if (d.actionWheel.sizeDip < 120) d.actionWheel.sizeDip = 120;
            if (d.actionWheel.sizeDip > 260) d.actionWheel.sizeDip = 260;
            if (d.actionWheel.deadZoneDip < 12) d.actionWheel.deadZoneDip = 12;
            if (d.headphones.debounceMs < 200) d.headphones.debounceMs = 200;
            if (d.headphones.debounceMs > 3000) d.headphones.debounceMs = 3000;
            if (d.headphones.resumeStabilizeMs < 400) d.headphones.resumeStabilizeMs = 400;
            if (d.headphones.resumeOfferSec < 10) d.headphones.resumeOfferSec = 10;
            if (d.headphones.resumeOfferSec > 180) d.headphones.resumeOfferSec = 180;
            if (string.IsNullOrEmpty(d.overview.panelMode)) d.overview.panelMode = "classic";
            string pm = d.overview.panelMode.Trim().ToLowerInvariant();
            if (pm != "overview" && pm != "classic") d.overview.panelMode = "classic";
            if (d.overview.openMs < 120) d.overview.openMs = 120;
            if (d.overview.openMs > 400) d.overview.openMs = 400;
            if (d.overview.closeMs < 100) d.overview.closeMs = 100;
            if (d.overview.closeMs > 360) d.overview.closeMs = 360;
            if (d.overview.stageScalePct < 80) d.overview.stageScalePct = 80;
            if (d.overview.stageScalePct > 92) d.overview.stageScalePct = 92;
            // Sort sectors by order
            d.actionWheel.sectors.Sort(delegate(ActionWheelSector a, ActionWheelSector b) {
                return a.order.CompareTo(b.order);
            });
            WriteOverviewFlag(OverviewActive(d));
        }
    }
}
