(function (root) {
  "use strict";

  function adjust(hex, factor) {
    const h = String(hex || "").replace("#", "");
    if (h.length !== 6) {
      return "#ffffff";
    }
    const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
    const r = clamp(parseInt(h.slice(0, 2), 16) * factor);
    const g = clamp(parseInt(h.slice(2, 4), 16) * factor);
    const b = clamp(parseInt(h.slice(4, 6), 16) * factor);
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  }

  function fromAccent(id, label, accent, group, extras = {}) {
    const base = extras.base || "#0B0F1A";
    const text = extras.text || "#E6E6E6";
    return {
      id,
      label,
      group,
      accent,
      accent2: extras.accent2 || adjust(accent, 1.15),
      accent3: extras.accent3 || adjust(accent, 0.85),
      accent4: extras.accent4 || adjust(accent, 1.3),
      dim: extras.dim || adjust(accent, 0.65),
      base,
      text,
      bg: extras.bg || base,
      panel: extras.panel || adjust(base, 1.15),
      panel2: extras.panel2 || adjust(base, 1.35),
      border: extras.border || adjust(accent, 0.35),
      ok: extras.ok || "#7de8b5",
      danger: extras.danger || "#ff9eb4",
      gradient: extras.gradient || null,
      glass: extras.glass !== false
    };
  }

  const COLOR_MAP = {
    orange: "#DC7A14",
    blue: "#5A8CFF",
    purple: "#A05AFF",
    cyan: "#46DCC8",
    crimson: "#D14A5A",
    rose: "#E05A9A",
    magenta: "#D44BBD",
    violet: "#8356E6",
    indigo: "#4E75D8",
    sky: "#6FC4F0",
    teal: "#36B8B3",
    mint: "#6BD3B0",
    emerald: "#4CB874",
    lime: "#9BD94A",
    gold: "#E0B148",
    amber: "#E5943A",
    peach: "#E7A37C",
    coral: "#E07D69",
    ruby: "#C83B5C",
    slate: "#7D93B0",
    ice: "#7CC8E8",
    neon: "#7EF06B",
    forest: "#4E8C66",
    mocha: "#A17A5A",
    black: "#111111",
    white: "#F2F2F2"
  };

  const SPECIAL = [
    fromAccent("orange", "Orange (default)", COLOR_MAP.orange, "core"),
    fromAccent("apple", "Apple", "#FF4D6D", "special", {
      accent2: "#FF8FA3",
      accent3: "#C9184A",
      accent4: "#FFB3C1",
      base: "#12080C",
      text: "#FFE5EC",
      gradient: "linear-gradient(135deg, #FF4D6D, #FF8FA3, #FFD6E0)"
    }),
    fromAccent("noir", "Noir", "#888888", "special", {
      accent2: "#686868",
      accent3: "#585858",
      accent4: "#A0A0A0",
      dim: "#606060",
      base: "#0A0A0A",
      text: "#E0E0E0",
      panel: "#121212",
      panel2: "#1A1A1A",
      border: "#2A2A2A"
    }),
    fromAccent("dnote", "Dnote", "#B11212", "special", {
      accent2: "#D01616",
      accent3: "#8F1010",
      accent4: "#FF4A4A",
      dim: "#8C7A7A",
      base: "#050505",
      text: "#F2E9E9"
    }),
    fromAccent("arthas-dark", "Arthas Dark", "#58B8FF", "special", {
      accent2: "#86CCFF",
      accent3: "#2F86D8",
      accent4: "#C1E8FF",
      dim: "#3B6F96",
      base: "#060A12",
      text: "#D7F1FF",
      gradient: "linear-gradient(135deg, #2F86D8, #58B8FF, #C1E8FF)"
    }),
    fromAccent("arthas-light", "Arthas Light", "#E8C36A", "special", {
      accent2: "#F3D992",
      accent3: "#C49D43",
      accent4: "#FFE7B8",
      dim: "#A88746",
      base: "#120F07",
      text: "#FFF1D0",
      gradient: "linear-gradient(135deg, #C49D43, #E8C36A, #FFE7B8)"
    }),
    fromAccent("pride-gay", "Pride Gay", "#26CEAA", "pride", {
      accent2: "#7BADE2",
      accent3: "#078D70",
      accent4: "#5049CC",
      gradient: "linear-gradient(135deg, #078D70, #26CEAA, #98E8C1, #7BADE2, #5049CC, #3D1A78)"
    }),
    fromAccent("pride-bi", "Pride Bi", "#D60270", "pride", {
      accent2: "#9B4F96",
      accent3: "#0038A8",
      accent4: "#FF4FA3",
      gradient: "linear-gradient(135deg, #D60270, #9B4F96, #0038A8)"
    }),
    fromAccent("pride-lesbian", "Pride Lesbian", "#EF7627", "pride", {
      accent2: "#D162A4",
      accent3: "#D52D00",
      accent4: "#FF9A56",
      gradient: "linear-gradient(135deg, #D52D00, #EF7627, #FF9A56, #D162A4)"
    }),
    fromAccent("pride-trans", "Pride Trans", "#5BCEFA", "pride", {
      accent2: "#F5A9B8",
      accent3: "#FFFFFF",
      accent4: "#5BCEFA",
      gradient: "linear-gradient(135deg, #5BCEFA, #F5A9B8, #FFFFFF, #F5A9B8, #5BCEFA)"
    }),
    fromAccent("pride-femboy", "Pride Femboy", "#FF97BD", "pride", {
      accent2: "#9EC6FF",
      accent3: "#FFADD6",
      accent4: "#7BA7E1",
      gradient: "linear-gradient(135deg, #FF97BD, #FFADD6, #FFFFFF, #9EC6FF, #7BA7E1)"
    })
  ];

  const COLORS = Object.keys(COLOR_MAP)
    .filter((id) => id !== "orange")
    .map((id) => {
      const extras = {};
      if (id === "black") {
        extras.base = "#050505";
        extras.text = "#F0F0F0";
      }
      if (id === "white") {
        extras.base = "#141820";
        extras.text = "#F7F7F7";
        extras.panel = "#1C2230";
      }
      return fromAccent(id, id[0].toUpperCase() + id.slice(1), COLOR_MAP[id], "colors", extras);
    });

  const FOX_THEMES = SPECIAL.concat(COLORS);
  const FOX_THEME_MAP = Object.create(null);
  for (const theme of FOX_THEMES) {
    FOX_THEME_MAP[theme.id] = theme;
  }

  function getFoxTheme(id) {
    return FOX_THEME_MAP[id] || FOX_THEME_MAP.orange;
  }

  function listFoxThemes() {
    return FOX_THEMES.slice();
  }

  function hexToRgba(hex, alpha) {
    const h = String(hex || "").replace("#", "");
    if (h.length !== 6) {
      return `rgba(108, 141, 255, ${alpha})`;
    }
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function applyFoxTheme(themeOrId, doc) {
    const theme = typeof themeOrId === "string" ? getFoxTheme(themeOrId) : themeOrId || getFoxTheme("orange");
    const documentRef = doc || (typeof document !== "undefined" ? document : null);
    if (!documentRef || !documentRef.documentElement) {
      return theme;
    }
    const root = documentRef.documentElement;
    const gradient = theme.gradient || `linear-gradient(130deg, ${theme.accent}, ${theme.accent2})`;
    const map = {
      "--fox-bg": theme.bg,
      "--fox-bg-2": theme.panel2 || theme.panel || theme.bg,
      "--fox-panel": theme.panel,
      "--fox-panel-2": theme.panel2,
      "--fox-border": theme.border,
      "--fox-accent": theme.accent,
      "--fox-accent-2": theme.accent2,
      "--fox-accent-3": theme.accent3,
      "--fox-accent-4": theme.accent4,
      "--fox-dim": theme.dim,
      "--fox-text": theme.text,
      "--fox-ok": theme.ok,
      "--fox-danger": theme.danger,
      "--fox-gradient": gradient,
      "--fox-glow-a": hexToRgba(theme.accent, 0.3),
      "--fox-glow-b": hexToRgba(theme.accent2, 0.24)
    };
    for (const [key, value] of Object.entries(map)) {
      root.style.setProperty(key, value);
    }
    root.dataset.theme = theme.id;
    root.classList.add("fox-themed");

    if (documentRef.body) {
      documentRef.body.style.backgroundColor = theme.bg;
      documentRef.body.style.color = theme.text;
    }
    return theme;
  }

  function mixHex(a, b, t) {
    const parse = (hex) => {
      const h = String(hex || "").replace("#", "");
      if (h.length !== 6) {
        return [11, 15, 26];
      }
      return [
        parseInt(h.slice(0, 2), 16),
        parseInt(h.slice(2, 4), 16),
        parseInt(h.slice(4, 6), 16)
      ];
    };
    const A = parse(a);
    const B = parse(b);
    const k = Math.max(0, Math.min(1, Number(t) || 0));
    const mix = (i) => Math.round(A[i] * (1 - k) + B[i] * k);
    const to = (n) => n.toString(16).padStart(2, "0");
    return `#${to(mix(0))}${to(mix(1))}${to(mix(2))}`;
  }

  function toBrowserTheme(themeOrId) {
    const theme = typeof themeOrId === "string" ? getFoxTheme(themeOrId) : themeOrId || getFoxTheme("orange");
    const accent = theme.accent || "#6c8dff";
    const frame = mixHex(theme.bg || "#0B0F1A", accent, 0.3);
    const toolbar = mixHex(theme.panel || frame, accent, 0.22);
    const field = mixHex(theme.panel2 || toolbar, accent, 0.16);
    const text = theme.text || "#E6E6E6";
    const dim = theme.dim || text;
    const border = mixHex(theme.border || accent, accent, 0.25);
    return {
      colors: {
        frame,
        frame_inactive: mixHex(frame, "#000000", 0.12),
        tab_background_text: dim,
        tab_text: "#ffffff",
        tab_line: accent,
        tab_loading: accent,
        tab_selected: accent,
        toolbar,
        toolbar_text: text,
        toolbar_field: field,
        toolbar_field_text: text,
        toolbar_field_border: border,
        toolbar_field_focus: mixHex(field, accent, 0.12),
        toolbar_top_separator: border,
        toolbar_bottom_separator: border,
        toolbar_vertical_separator: border,
        popup: toolbar,
        popup_text: text,
        popup_border: border,
        popup_highlight: accent,
        popup_highlight_text: "#ffffff",
        sidebar: frame,
        sidebar_text: text,
        sidebar_border: border,
        sidebar_highlight: accent,
        sidebar_highlight_text: "#ffffff",
        ntp_background: frame,
        ntp_text: text,
        bookmark_text: text,
        button_background_hover: hexToRgba(accent, 0.22),
        button_background_active: hexToRgba(accent, 0.35),
        icons: dim,
        icons_attention: accent
      },
      properties: {
        color_scheme: "dark"
      }
    };
  }

  const api = {
    FOX_THEMES,
    getFoxTheme,
    listFoxThemes,
    applyFoxTheme,
    toBrowserTheme,
    hexToRgba
  };

  if (typeof root !== "undefined") {
    root.FoxThemes = api;
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
