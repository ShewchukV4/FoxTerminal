using System;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using Microsoft.Win32;
using FoxOs.Sdk;

namespace FoxOs.Nodes {

    sealed class FoxStyleColors {
        public string theme = "dark";
        public string accent = "#7B5CFF";
        public string accent2 = "#DC7A14";
        public string bg = "#0B0A12";
        public string surface = "#161322";
        public string ink = "#E2E0F0";
        public int glass = 72;
    }

    sealed class FoxStyleMotion {
        public string scale = "full";
        public int med = 280;
    }

    sealed class FoxStyleNodes {
        public string themeSource = "auto";
        public string customSurface = "#202226";
        public string customInk = "#E6E7E9";
        public string customAccent = "#9B9FA7";
        public int opacity = 84;
        public int blur = 0;
        public int nodeScale = 100;
        public int textScale = 100;
        public int spacing = 100;
        public int lineContrast = 100;
        public bool animations = true;
        public int animationSpeed = 100;
        public int motionIntensity = 100;
        public bool respectSystemMotion = true;
        public bool pocketEnabled = true;
        public string pocketEdge = "right";
        public int pocketPosition = 48;
        public int pocketActivationDip = 5;
        public int pocketShowDelayMs = 150;
        public int pocketHideDelayMs = 520;
        public bool pocketMarker = true;
        public string animationStyle = "smooth";
        public int revision = 1;
    }

    sealed class FoxStyleCompat {
        public FoxStyleColors colors = new FoxStyleColors();
        public FoxStyleMotion motion = new FoxStyleMotion();
        public FoxStyleNodes nodeLauncher = new FoxStyleNodes();
    }

    sealed class NodeStyleProfile {
        public Color Surface;
        public Color Ink;
        public Color Muted;
        public Color Accent;
        public Color Accent2;
        public int Opacity = 84;
        public int NodeScale = 100;
        public int TextScale = 100;
        public int Spacing = 100;
        public int LineContrast = 100;
        public bool Animations = true;
        public int AnimationSpeed = 100;
        public int MotionIntensity = 100;
        public bool RespectSystemMotion = true;
        public bool PocketEnabled = true;
        public string PocketEdge = "right";
        public int PocketPosition = 48;
        public int PocketActivationDip = 5;
        public int PocketShowDelayMs = 150;
        public int PocketHideDelayMs = 520;
        public bool PocketMarker = true;
        public string AnimationStyle = "smooth";
        public int Revision = 1;
        public DateTime SourceStampUtc;
    }

    static class ThemeBridge {
        [DllImport("dwmapi.dll")]
        static extern int DwmGetColorizationColor(out uint color, out bool opaque);

        public static string StylePath {
            get { return Path.Combine(FoxPaths.RuntimeDir(), "style.json"); }
        }

        public static NodeStyleProfile Load() {
            FoxStyleCompat doc = null;
            DateTime stamp = DateTime.MinValue;
            try {
                if (File.Exists(StylePath)) {
                    doc = FoxJson.FileLoad<FoxStyleCompat>(StylePath, null);
                    stamp = File.GetLastWriteTimeUtc(StylePath);
                }
            } catch { }
            if (doc == null) doc = new FoxStyleCompat();
            if (doc.colors == null) doc.colors = new FoxStyleColors();
            if (doc.motion == null) doc.motion = new FoxStyleMotion();
            if (doc.nodeLauncher == null) doc.nodeLauncher = new FoxStyleNodes();

            FoxStyleNodes n = doc.nodeLauncher;
            var p = new NodeStyleProfile();
            string source = (n.themeSource ?? "auto").ToLowerInvariant();
            bool custom = source == "custom";
            Color winAccent = WindowsAccent();
            bool light = IsWindowsLight();
            p.Surface = custom
                ? Parse(n.customSurface, Color.FromArgb(32, 34, 38))
                : Parse(doc.colors.surface, light ? Color.FromArgb(246, 246, 248) : Color.FromArgb(32, 34, 38));
            p.Ink = custom
                ? Parse(n.customInk, light ? Color.FromArgb(30, 31, 35) : Color.FromArgb(230, 231, 233))
                : Parse(doc.colors.ink, light ? Color.FromArgb(30, 31, 35) : Color.FromArgb(230, 231, 233));
            p.Accent = custom
                ? Parse(n.customAccent, winAccent)
                : Parse(doc.colors.accent, winAccent);
            p.Accent2 = custom
                ? p.Accent
                : Parse(doc.colors.accent2, winAccent);
            p.Muted = Mix(p.Ink, p.Surface, 48);
            p.Opacity = Clamp(n.opacity, 55, 100);
            p.NodeScale = Clamp(n.nodeScale, 75, 140);
            p.TextScale = Clamp(n.textScale, 80, 140);
            p.Spacing = Clamp(n.spacing, 75, 150);
            p.LineContrast = Clamp(n.lineContrast, 50, 180);
            p.Animations = n.animations &&
                !string.Equals(doc.motion.scale, "off", StringComparison.OrdinalIgnoreCase);
            p.AnimationSpeed = Clamp(n.animationSpeed, 40, 180);
            if (string.Equals(doc.motion.scale, "reduced", StringComparison.OrdinalIgnoreCase))
                p.AnimationSpeed = Math.Min(p.AnimationSpeed, 75);
            p.MotionIntensity = Clamp(n.motionIntensity, 0, 150);
            p.RespectSystemMotion = n.respectSystemMotion;
            p.PocketEnabled = n.pocketEnabled;
            p.PocketEdge = NormalizeEdge(n.pocketEdge);
            p.PocketPosition = Clamp(n.pocketPosition, 5, 95);
            p.PocketActivationDip = Clamp(n.pocketActivationDip, 3, 12);
            p.PocketShowDelayMs = Clamp(n.pocketShowDelayMs, 0, 500);
            p.PocketHideDelayMs = Clamp(n.pocketHideDelayMs, 200, 1200);
            p.PocketMarker = n.pocketMarker;
            p.AnimationStyle = FoxNodesSync.NormalizeMotionStyle(n.animationStyle);
            p.Revision = n.revision;
            p.SourceStampUtc = stamp;
            return p;
        }

        static string NormalizeEdge(string edge) {
            edge = (edge ?? "right").ToLowerInvariant();
            return edge == "left" || edge == "top" ? edge : "right";
        }

        static bool IsWindowsLight() {
            try {
                object value = Registry.GetValue(
                    @"HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize",
                    "AppsUseLightTheme", 0);
                return Convert.ToInt32(value) != 0;
            } catch { return false; }
        }

        static Color WindowsAccent() {
            try {
                uint argb;
                bool opaque;
                if (DwmGetColorizationColor(out argb, out opaque) == 0)
                    return Color.FromArgb((int)((argb >> 16) & 255),
                        (int)((argb >> 8) & 255), (int)(argb & 255));
            } catch { }
            return Color.FromArgb(125, 147, 176);
        }

        static Color Parse(string value, Color fallback) {
            if (string.IsNullOrEmpty(value)) return fallback;
            string h = value.Trim().TrimStart('#');
            if (h.Length != 6) return fallback;
            try {
                return Color.FromArgb(Convert.ToInt32(h.Substring(0, 2), 16),
                    Convert.ToInt32(h.Substring(2, 2), 16),
                    Convert.ToInt32(h.Substring(4, 2), 16));
            } catch { return fallback; }
        }

        static Color Mix(Color a, Color b, int pct) {
            pct = Clamp(pct, 0, 100);
            int q = 100 - pct;
            return Color.FromArgb((a.R * q + b.R * pct) / 100,
                (a.G * q + b.G * pct) / 100,
                (a.B * q + b.B * pct) / 100);
        }

        static int Clamp(int value, int lo, int hi) {
            return Math.Max(lo, Math.Min(hi, value));
        }
    }
}
