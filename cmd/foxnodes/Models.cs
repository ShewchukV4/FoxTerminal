using System;
using System.Collections.Generic;

namespace FoxOs.Nodes {

    public class ThemeMetrics {
        public int centerNodeDip = 56;
        public int categoryNodeDip = 44;
        public int categoryRadiusDip = 140;
        public int iconDip = 17;
        public int labelHeightDip = 25;
        public int labelPadXDip = 10;
        public int labelGapDip = 6;
        public int cardWidthDip = 202;
        public int cardHeightDip = 40;
        public int cardGapDip = 7;
        public int cardRadiusDip = 11;
        public float lineWidthDip = 1.0f;
        public int centerEnterMs = 180;
        public int categoryEnterMs = 225;
        public int categoryStaggerMs = 15;
        public int branchOpenMs = 200;
        public int branchCloseMs = 140;
        public int cardStaggerMs = 24;
        public int hoverMs = 140;
        public int pressMs = 95;
        public int categoryTravelDip = 11;
        public int cardTravelDip = 10;
        public int shadowOffsetDip = 3;
        public string surfaceHex = "#202226";
        public string textHex = "#E6E7E9";
        public string mutedHex = "#9B9FA7";
        public int surfaceAlpha = 84;
        public int highlightAlpha = 6;
        public int outlineAlpha = 18;
        public int lineAlpha = 15;
        public int activeLineAlpha = 36;
        // Legacy fields retained so older user configuration remains readable.
        public int animMs = 280;
        public int glowStrength = 0;
        public int ambientSpeed = 0;
    }

    public class HotkeySpec {
        public bool ctrl = true;
        public bool alt = true;
        public bool shift = false;
        public bool win = false;
        public string key = "Space";
    }

    public class MenuActionSpec {
        public string kind = "";
        public string path = "";
        public string args = "";
        public string url = "";
        public string command = "";
    }

    public class NodeVisualOverride {
        public bool enabled = true;
        public string surfaceHex = "";
        public string textHex = "";
        public string accentHex = "";
    }

    public class MenuNodeSpec {
        public string id = "";
        public string title = "";
        public string icon = "";
        public string description = "";
        public int order = 0;
        // User-controlled layout offsets relative to the generated graph position.
        // Categories and command cards both use these values and persist them.
        public int offsetXDip = 0;
        public int offsetYDip = 0;
        public List<MenuNodeSpec> children = new List<MenuNodeSpec>();
        public MenuActionSpec action = null;
        public NodeVisualOverride style = null;
    }

    public class EdgePocketSpec {
        public bool enabled = true;
        public string edge = "right";
        public int positionPercent = 48;
        public int activationDip = 5;
        public int showDelayMs = 150;
        public int hideDelayMs = 520;
        public bool marker = true;
        public bool pocketed = false;
    }

    public class NodeLauncherConfig {
        public HotkeySpec hotkey = new HotkeySpec();
        public ThemeMetrics theme = new ThemeMetrics();
        public List<MenuNodeSpec> categories = new List<MenuNodeSpec>();
        public bool desktopVisible = true;
        public bool startCollapsed = false;
        public int glassStrength = 78;
        public int motionPercent = 100;
        public double desktopX = 0.52;
        public double desktopY = 0.48;
        public double lastNormalX = 0.52;
        public double lastNormalY = 0.48;
        public EdgePocketSpec pocket = new EdgePocketSpec();
        public int version = 10;
        public int revision = 1;
    }
}
