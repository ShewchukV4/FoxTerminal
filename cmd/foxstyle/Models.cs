using System;

namespace FoxOs.Style {

    public class SavedStyleSlot {
        public string id = "";
        public string name = "";
        public string savedUtc = "";
        public StyleDoc style = null;
    }

    public class StyleSlotInfo {
        public string id = "";
        public string name = "";
        public string savedUtc = "";
    }

    // Modular FoxOS look document — one JSON, independent modules.
    public class StyleDoc {
        public string version = "1";
        public string name = "FoxOS Dark";
        public string preset = "dark";

        public ColorMod colors = new ColorMod();
        public ChromeMod chrome = new ChromeMod();
        public WindowMod window = new WindowMod();
        public PanelMod panel = new PanelMod();
        public ButtonMod button = new ButtonMod();
        public MotionMod motion = new MotionMod();
        public TypeMod typography = new TypeMod();
        public TextureMod texture = new TextureMod();
        public LabsMod labs = new LabsMod();
        public NodeLauncherMod nodeLauncher = new NodeLauncherMod();

        public static StyleDoc Preset(string id) {
            StyleDoc d = new StyleDoc();
            d.preset = id ?? "dark";
            switch (d.preset) {
                case "light":
                    d.name = "FoxOS Light";
                    d.colors.theme = "light";
                    d.colors.sw = "white";
                    d.colors.accent = "#5B3FE0";
                    d.colors.accent2 = "#D9731A";
                    d.colors.bg = "#F3F1F8";
                    d.colors.surface = "#FFFFFF";
                    d.colors.ink = "#17142A";
                    d.button.style = "rounded";
                    d.texture.kind = "glass";
                    d.texture.dock = "pill";
                    d.texture.rain = 8;
                    d.texture.strength = 45;
                    d.texture.scale = 55;
                    d.texture.veil = 40;
                    break;
                case "neon":
                    d.name = "FoxOS Neon";
                    d.colors.theme = "neon";
                    d.colors.sw = "neon";
                    d.colors.accent = "#7EF06B";
                    d.colors.accent2 = "#B8FF7A";
                    d.colors.bg = "#04140A";
                    d.colors.surface = "#0C2214";
                    d.colors.ink = "#E8FFE8";
                    d.button.style = "glass";
                    d.window.openAnim = "zoom";
                    d.texture.kind = "neon";
                    d.texture.rain = 55;
                    d.texture.strength = 85;
                    d.texture.scale = 40;
                    d.texture.weight = 55;
                    d.texture.veil = 70;
                    d.labs.foxGlow = true;
                    d.labs.glowStrength = 85;
                    d.labs.glowSpeed = 70;
                    break;
                case "foxpurple":
                    d.name = "Fox Purple";
                    d.colors.theme = "foxpurple";
                    d.colors.sw = "purple";
                    d.colors.accent = "#A05AFF";
                    d.colors.accent2 = "#FFA23A";
                    d.colors.bg = "#180F2B";
                    d.colors.surface = "#241836";
                    d.colors.ink = "#F0E8FF";
                    d.button.style = "liquid";
                    d.window.openAnim = "fade";
                    d.texture.kind = "glass";
                    d.texture.rain = 35;
                    d.texture.strength = 65;
                    d.texture.scale = 50;
                    d.texture.veil = 75;
                    d.labs.glowStrength = 60;
                    d.labs.glowSpeed = 45;
                    break;
                case "custom":
                    d.name = "Custom";
                    d.colors.theme = "custom";
                    d.colors.sw = "violet";
                    d.colors.accent = "#7B5CFF";
                    d.colors.accent2 = "#FFA23A";
                    d.colors.bg = "#0B0A12";
                    d.colors.surface = "#161322";
                    d.colors.ink = "#E8E4F5";
                    break;
                default:
                    d.preset = "dark";
                    d.name = "FoxOS Dark";
                    d.colors.theme = "dark";
                    d.colors.sw = "violet";
                    d.colors.accent = "#7B5CFF";
                    d.colors.accent2 = "#DC7A14";
                    d.colors.bg = "#0B0A12";
                    d.colors.surface = "#161322";
                    d.colors.ink = "#E2E0F0";
                    d.button.style = "glass";
                    d.texture.kind = "glass";
                    d.texture.dock = "pill";
                    d.texture.rain = 30;
                    d.texture.strength = 60;
                    d.texture.scale = 50;
                    d.texture.veil = 55;
                    break;
            }
            return d;
        }
    }

    public class ColorMod {
        public string theme = "dark";
        public string sw = "violet";       // real FoxOS / sw color name
        public string accent = "#7B5CFF";
        public string accent2 = "#DC7A14";
        public string bg = "#0B0A12";
        public string surface = "#161322";
        public string ink = "#E2E0F0";
        public int glass = 72;
    }

    public class ChromeMod {
        public int opacity = 72;
        public int blur = 18;
        public int height = 36;
        public bool floating = false;
        public string icons = "line";
    }

    public class WindowMod {
        public int radius = 16;
        public int shadow = 60;
        public string openAnim = "fade"; // fade | zoom | none
    }

    public class PanelMod {
        public string enter = "fade"; // fade | slide | none
        public string speed = "normal"; // slow | normal | fast
        public int blur = 28;
    }

    public class ButtonMod {
        public string style = "glass"; // rounded | sharp | glass | liquid
        public int pressScale = 97;
    }

    public class MotionMod {
        public string scale = "full"; // full | reduced | off
        public int med = 280;
    }

    public class TypeMod {
        public int size = 13;
        public string density = "normal";
        public string tracking = "normal";
    }

    public class TextureMod {
        public string kind = "glass"; // glass | metal | fabric | neon | none
        public string dock = "pill";   // pill | bar
        public int rain = 30;         // 0..80 ASCII rain density
        public int strength = 60;     // 0..100 overall texture intensity
        public int scale = 50;        // 0..100 grid spacing (higher = larger cells)
        public int weight = 40;       // 0..100 line thickness (однакова для всієї сітки)
        public int veil = 50;         // 0..100 accent wash / glow blobs
    }

    public class LabsMod {
        public bool dynamicShadows = false;
        public bool foxGlow = false;
        public int glowStrength = 70; // 0..100 pulse amplitude on window borders
        public int glowSpeed = 50;    // 0..100 pulse rate (higher = faster)
        public bool motionBlur = false;
        public bool liquidWindows = false;
    }

    public class NodeLauncherMod {
        public string themeSource = "auto"; // auto | wallpaper | custom
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
        public string pocketEdge = "right"; // right | left | top
        public int pocketPosition = 48;
        public int pocketActivationDip = 5;
        public int pocketShowDelayMs = 150;
        public int pocketHideDelayMs = 520;
        public bool pocketMarker = true;
        public string animationStyle = "smooth"; // restrained | smooth | spring | minimal
        public int revision = 1;
    }
}
