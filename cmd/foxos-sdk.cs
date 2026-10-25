// FOXOS Application SDK
// Shared chrome, light theme, local document store, wallpaper toasts, Ollama helper.
// Compiled with the same csc.exe pipeline as foxos-live (C# 5 / .NET 4).

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Net;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Web.Script.Serialization;
using System.Windows.Forms;

namespace FoxOs.Sdk {

    public static class FoxPaths {
        // cmd\ folder of the FoxTerminal checkout; set from launcher args, else live.json.
        public static string CmdDir = "";

        public static string RepoRoot() {
            string cmd = CmdDir;
            if (string.IsNullOrEmpty(cmd)) {
                try {
                    string live = Path.Combine(RuntimeDir(), "live.json");
                    if (File.Exists(live)) {
                        Match m = Regex.Match(File.ReadAllText(live), "\"cmd\"\\s*:\\s*\"([^\"]*)\"");
                        if (m.Success) cmd = m.Groups[1].Value.Replace("\\\\", "\\");
                    }
                } catch { }
            }
            if (string.IsNullOrEmpty(cmd)) return "";
            try { return Path.GetFullPath(Path.Combine(cmd, "..")); } catch { return ""; }
        }

        public static string Asset(string rel) {
            string root = RepoRoot();
            if (string.IsNullOrEmpty(root)) return "";
            return Path.Combine(root, "FoxTerminal", "assets", rel);
        }

        public static string RuntimeDir() {
            string root = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            if (string.IsNullOrEmpty(root)) root = Path.GetTempPath();
            string dir = Path.Combine(root, "FoxTerminal", "foxos");
            try { Directory.CreateDirectory(dir); } catch { }
            return dir;
        }

        public static string AppsDir() {
            string dir = Path.Combine(RuntimeDir(), "apps");
            try { Directory.CreateDirectory(dir); } catch { }
            return dir;
        }

        // Who owns the data: FOXTERM_USER from the terminal session, otherwise the
        // user FoxTerminal persisted in cmd\current_user.txt, otherwise "local".
        // Without the fallback an app launched outside the terminal would open a
        // fresh (demo-seeded) store instead of the user's own documents.
        public static string CurrentUser() {
            string user = Environment.GetEnvironmentVariable("FOXTERM_USER");
            if (!string.IsNullOrEmpty(user)) return user.Trim();
            try {
                string root = RepoRoot();
                string state = string.IsNullOrEmpty(root) ? null : Path.Combine(root, "cmd", "current_user.txt");
                if (state != null && File.Exists(state)) {
                    string n = File.ReadAllText(state).Trim();
                    if (n.Length > 0) return n;
                }
            } catch { }
            return "local";
        }

        public static string AppDir(string appId) {
            string dir = Path.Combine(AppsDir(), appId, Sanitize(CurrentUser()));
            try { Directory.CreateDirectory(dir); } catch { }
            return dir;
        }

        public static string Sanitize(string name) {
            if (string.IsNullOrEmpty(name)) return "local";
            char[] bad = Path.GetInvalidFileNameChars();
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < name.Length; i++) {
                char c = name[i];
                bool ok = true;
                for (int j = 0; j < bad.Length; j++) {
                    if (c == bad[j]) { ok = false; break; }
                }
                sb.Append(ok ? c : '_');
            }
            string s = sb.ToString().Trim();
            return s.Length == 0 ? "local" : s;
        }
    }

    public static class FoxJson {
        static JavaScriptSerializer Ser() {
            JavaScriptSerializer s = new JavaScriptSerializer();
            s.MaxJsonLength = int.MaxValue;
            return s;
        }

        public static string Dump(object value) {
            try { return Ser().Serialize(value); }
            catch { return "{}"; }
        }

        public static T Load<T>(string json) {
            if (string.IsNullOrEmpty(json)) return default(T);
            try { return Ser().Deserialize<T>(json); }
            catch { return default(T); }
        }

        public static T FileLoad<T>(string path, T fallback) {
            if (string.IsNullOrEmpty(path) || !File.Exists(path)) return fallback;
            try {
                string raw = File.ReadAllText(path, Encoding.UTF8);
                T val = Load<T>(raw);
                if (val == null) return fallback;
                return val;
            } catch {
                return fallback;
            }
        }

        public static void FileSave(string path, object value) {
            string dir = Path.GetDirectoryName(path);
            if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir)) {
                try { Directory.CreateDirectory(dir); } catch { }
            }
            string json = Dump(value);
            string tmp = path + ".tmp";
            File.WriteAllText(tmp, json, new UTF8Encoding(false));
            try {
                if (File.Exists(path)) File.Replace(tmp, path, null);
                else File.Move(tmp, path);
            } catch {
                File.Copy(tmp, path, true);
                try { File.Delete(tmp); } catch { }
            }
        }
    }

    // foxstyle.exe and foxnodes.exe are separate processes. Apply writes
    // launcher.json + style.json, then this signal; overlay acks via foxnodes.applied.
    public static class FoxNodesSync {
        public static string SignalPath {
            get { return Path.Combine(FoxPaths.RuntimeDir(), "foxnodes.signal"); }
        }
        public static string AppliedPath {
            get { return Path.Combine(FoxPaths.RuntimeDir(), "foxnodes.applied"); }
        }

        public static void RequestReload(int revision) {
            Directory.CreateDirectory(FoxPaths.RuntimeDir());
            File.WriteAllText(SignalPath, "reload " + Math.Max(1, revision),
                new UTF8Encoding(false));
        }

        public static void WriteApplied(int revision) {
            try {
                Directory.CreateDirectory(FoxPaths.RuntimeDir());
                File.WriteAllText(AppliedPath,
                    Math.Max(1, revision) + "\r\n" + DateTime.UtcNow.ToString("o"),
                    new UTF8Encoding(false));
            } catch { }
        }

        public static bool TryReadApplied(out int revision, out string utc) {
            revision = 0;
            utc = "";
            try {
                if (!File.Exists(AppliedPath)) return false;
                string[] lines = File.ReadAllText(AppliedPath, Encoding.UTF8)
                    .Replace("\r", "").Split('\n');
                if (lines.Length == 0) return false;
                if (!int.TryParse(lines[0].Trim(), out revision)) return false;
                if (lines.Length > 1) utc = lines[1].Trim();
                return true;
            } catch { return false; }
        }

        public static bool OverlayRunning() {
            try {
                Process[] list = Process.GetProcessesByName("foxnodes");
                return list != null && list.Length > 0;
            } catch { return false; }
        }

        public static string ParseCommand(string raw, out int revision) {
            revision = 0;
            raw = (raw ?? "").Trim();
            if (raw.Length == 0) return "";
            int space = raw.IndexOf(' ');
            if (space <= 0) return raw.ToLowerInvariant();
            string cmd = raw.Substring(0, space).Trim().ToLowerInvariant();
            int.TryParse(raw.Substring(space + 1).Trim(), out revision);
            return cmd;
        }

        public static string NormalizeMotionStyle(string value) {
            value = (value ?? "smooth").Trim().ToLowerInvariant();
            if (value == "restrained" || value == "smooth" ||
                value == "spring" || value == "minimal") return value;
            return "smooth";
        }
    }

    // FOXOS storage: one JSON document per collection under the app folder.
    public class FoxStore {
        readonly string root;

        public FoxStore(string appId) {
            root = FoxPaths.AppDir(appId);
        }

        public string Root { get { return root; } }

        public string PathFor(string name) {
            return Path.Combine(root, name + ".json");
        }

        public bool Exists(string name) {
            return File.Exists(PathFor(name));
        }

        public T Get<T>(string name, T fallback) {
            return FoxJson.FileLoad<T>(PathFor(name), fallback);
        }

        public void Set(string name, object data) {
            FoxJson.FileSave(PathFor(name), data);
        }
    }

    // Writes the same toast.json that foxos-live paints on the wallpaper.
    public static class FoxToast {
        public static void Show(string text) {
            if (string.IsNullOrEmpty(text)) return;
            string safe = text.Replace("\r", " ").Replace("\n", " ").Replace("\"", "'").Trim();
            if (safe.Length > 80) safe = safe.Substring(0, 80);
            DateTime until = DateTime.UtcNow.AddSeconds(8);
            string json = "{\"text\":\"" + Escape(safe) + "\",\"until\":\"" + until.ToString("o") + "\"}";
            try {
                File.WriteAllText(Path.Combine(FoxPaths.RuntimeDir(), "toast.json"), json, new UTF8Encoding(false));
            } catch { }
        }

        static string Escape(string s) {
            return s.Replace("\\", "\\\\");
        }
    }

    public class FoxTheme {
        public Color Paper;
        public Color Sidebar;
        public Color Card;
        public Color Ink;
        public Color Muted;
        public Color Line;
        public Color Accent;
        public Color AccentSoft;
        public Color Good;
        public Color Danger;
        public Color Warn;
        public Color Purple;
        public Color Teal;
        public Color Pink;
        public Color Orange;
        public Color Night;
        public Font Title;
        public Font Head;
        public Font Body;
        public Font Small;
        public Font Mono;
        public Font Icon;
        public Font IconBig;
        public Font Digits;

        // Fixed colour per finance category so chips, dots and bars agree everywhere.
        public Color ForCategory(string id) {
            switch (id ?? "") {
                case "food": return Orange;
                case "transport": return Accent;
                case "home": return Teal;
                case "salary": return Good;
                case "fun": return Purple;
                case "work": return Accent;
                case "personal": return Teal;
                case "ideas": return Purple;
                default: return Muted;
            }
        }

        public string Id = "default";
        public bool Dark;

        // Surface that soft tints blend towards (white on light themes, card colour on dark).
        public static Color SoftBase = Color.White;

        // 18 % tint of a colour over the current surface: chip / badge backgrounds.
        public static Color Soft(Color c) {
            Color b = SoftBase;
            return Color.FromArgb(
                b.R + (c.R - b.R) * 18 / 100,
                b.G + (c.G - b.G) * 18 / 100,
                b.B + (c.B - b.B) * 18 / 100);
        }

        public static Color Darken(Color c, int pct) {
            return Color.FromArgb(c.R * (100 - pct) / 100, c.G * (100 - pct) / 100, c.B * (100 - pct) / 100);
        }

        // Available themes: id + display names (ua / en). "default" is the stock light look.
        public static readonly string[] Ids = { "default", "dark", "midnight", "slate", "mint", "sunset", "rose" };
        public static string Label(string id, bool ua) {
            switch (id ?? "") {
                case "dark": return ua ? "Темна" : "Dark";
                case "midnight": return ua ? "Північ (фіолетова)" : "Midnight (purple)";
                case "slate": return ua ? "Сланець (сіро-синя)" : "Slate";
                case "mint": return ua ? "М'ята" : "Mint";
                case "sunset": return ua ? "Захід сонця" : "Sunset";
                case "rose": return ua ? "Роза" : "Rose";
                default: return ua ? "Стандартна (світла)" : "Default (light)";
            }
        }

        // Build a theme by id; unknown ids fall back to the default light theme.
        public static FoxTheme Named(string id) {
            FoxTheme t = Light();
            t.Id = "default";
            switch (id ?? "") {
                case "dark":
                    t.Id = id; t.Dark = true;
                    t.Paper = Color.FromArgb(17, 20, 28);
                    t.Sidebar = Color.FromArgb(22, 26, 36);
                    t.Card = Color.FromArgb(28, 33, 45);
                    t.Ink = Color.FromArgb(229, 231, 235);
                    t.Muted = Color.FromArgb(139, 148, 164);
                    t.Line = Color.FromArgb(46, 52, 68);
                    t.Accent = Color.FromArgb(96, 165, 250);
                    t.AccentSoft = Color.FromArgb(32, 48, 78);
                    t.Night = Color.FromArgb(8, 10, 16);
                    break;
                case "midnight":
                    t.Id = id; t.Dark = true;
                    t.Paper = Color.FromArgb(22, 18, 38);
                    t.Sidebar = Color.FromArgb(28, 23, 48);
                    t.Card = Color.FromArgb(37, 31, 62);
                    t.Ink = Color.FromArgb(238, 234, 250);
                    t.Muted = Color.FromArgb(155, 146, 190);
                    t.Line = Color.FromArgb(60, 52, 94);
                    t.Accent = Color.FromArgb(167, 139, 250);
                    t.AccentSoft = Color.FromArgb(62, 50, 104);
                    t.Night = Color.FromArgb(12, 9, 24);
                    break;
                case "slate":
                    t.Id = id;
                    t.Paper = Color.FromArgb(234, 238, 244);
                    t.Sidebar = Color.FromArgb(226, 231, 239);
                    t.Card = Color.FromArgb(255, 255, 255);
                    t.Ink = Color.FromArgb(30, 41, 59);
                    t.Muted = Color.FromArgb(100, 116, 139);
                    t.Line = Color.FromArgb(205, 214, 226);
                    t.Accent = Color.FromArgb(71, 85, 105);
                    t.AccentSoft = Color.FromArgb(226, 232, 240);
                    t.Night = Color.FromArgb(30, 41, 59);
                    break;
                case "mint":
                    t.Id = id;
                    t.Paper = Color.FromArgb(240, 250, 246);
                    t.Sidebar = Color.FromArgb(255, 255, 255);
                    t.Card = Color.FromArgb(255, 255, 255);
                    t.Ink = Color.FromArgb(20, 52, 42);
                    t.Muted = Color.FromArgb(108, 140, 128);
                    t.Line = Color.FromArgb(214, 236, 226);
                    t.Accent = Color.FromArgb(16, 150, 110);
                    t.AccentSoft = Color.FromArgb(220, 246, 236);
                    t.Night = Color.FromArgb(10, 40, 32);
                    break;
                case "sunset":
                    t.Id = id;
                    t.Paper = Color.FromArgb(253, 246, 240);
                    t.Sidebar = Color.FromArgb(255, 251, 247);
                    t.Card = Color.FromArgb(255, 255, 255);
                    t.Ink = Color.FromArgb(62, 40, 34);
                    t.Muted = Color.FromArgb(162, 130, 120);
                    t.Line = Color.FromArgb(245, 230, 220);
                    t.Accent = Color.FromArgb(234, 88, 12);
                    t.AccentSoft = Color.FromArgb(255, 237, 222);
                    t.Night = Color.FromArgb(50, 28, 22);
                    break;
                case "rose":
                    t.Id = id;
                    t.Paper = Color.FromArgb(253, 242, 246);
                    t.Sidebar = Color.FromArgb(255, 255, 255);
                    t.Card = Color.FromArgb(255, 255, 255);
                    t.Ink = Color.FromArgb(62, 30, 46);
                    t.Muted = Color.FromArgb(162, 120, 140);
                    t.Line = Color.FromArgb(250, 222, 232);
                    t.Accent = Color.FromArgb(219, 39, 119);
                    t.AccentSoft = Color.FromArgb(252, 231, 243);
                    t.Night = Color.FromArgb(50, 20, 36);
                    break;
            }
            SoftBase = t.Dark ? t.Card : Color.White;
            return t;
        }

        public static FoxTheme Light() {
            FoxTheme t = new FoxTheme();
            t.Paper = Color.FromArgb(246, 247, 250);
            t.Sidebar = Color.FromArgb(255, 255, 255);
            t.Card = Color.FromArgb(255, 255, 255);
            t.Ink = Color.FromArgb(31, 41, 55);
            t.Muted = Color.FromArgb(148, 156, 168);
            t.Line = Color.FromArgb(236, 238, 242);
            t.Accent = Color.FromArgb(59, 130, 246);
            t.AccentSoft = Color.FromArgb(235, 243, 255);
            t.Good = Color.FromArgb(34, 197, 94);
            t.Danger = Color.FromArgb(239, 68, 68);
            t.Warn = Color.FromArgb(245, 158, 11);
            t.Purple = Color.FromArgb(139, 92, 246);
            t.Teal = Color.FromArgb(20, 184, 166);
            t.Pink = Color.FromArgb(236, 72, 153);
            t.Orange = Color.FromArgb(249, 115, 22);
            t.Night = Color.FromArgb(17, 24, 39);
            t.Title = SafeFont("Segoe UI Semibold", 20f, FontStyle.Bold);
            t.Head = SafeFont("Segoe UI Semibold", 12f, FontStyle.Bold);
            t.Body = SafeFont("Segoe UI", 10f, FontStyle.Regular);
            t.Small = SafeFont("Segoe UI", 8.5f, FontStyle.Regular);
            t.Digits = SafeFont("Segoe UI Semibold", 15f, FontStyle.Bold);
            t.Mono = SafeFont("Cascadia Mono", 10f, FontStyle.Regular);
            if (t.Mono.Name.IndexOf("Cascadia", StringComparison.OrdinalIgnoreCase) < 0) {
                t.Mono = SafeFont("Consolas", 10f, FontStyle.Regular);
            }
            t.Icon = SafeFont("Segoe MDL2 Assets", 11f, FontStyle.Regular);
            t.IconBig = SafeFont("Segoe MDL2 Assets", 14f, FontStyle.Regular);
            return t;
        }

        public SolidBrush InkBrush() { return new SolidBrush(Ink); }
        public SolidBrush MuteBrush() { return new SolidBrush(Muted); }
        public SolidBrush AccBrush() { return new SolidBrush(Accent); }

        static Font SafeFont(string name, float size, FontStyle style) {
            try { return new Font(name, size, style, GraphicsUnit.Point); }
            catch { return new Font(FontFamily.GenericSansSerif, size, style, GraphicsUnit.Point); }
        }
    }

    public static class FoxUi {
        public static void Buffer(Control c) {
            if (c == null) return;
            try {
                PropertyInfo p = typeof(Control).GetProperty("DoubleBuffered",
                    BindingFlags.Instance | BindingFlags.NonPublic);
                if (p != null) p.SetValue(c, true, null);
            } catch { }
        }

        public static GraphicsPath Round(Rectangle r, int radius) {
            GraphicsPath p = new GraphicsPath();
            int d = radius * 2;
            if (d < 2 || r.Width < d || r.Height < d) {
                p.AddRectangle(r);
                return p;
            }
            p.AddArc(r.X, r.Y, d, d, 180, 90);
            p.AddArc(r.Right - d, r.Y, d, d, 270, 90);
            p.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90);
            p.AddArc(r.X, r.Bottom - d, d, d, 90, 90);
            p.CloseFigure();
            return p;
        }

        public static void PaintCard(Graphics g, Rectangle r, Color fill, Color line) {
            g.SmoothingMode = SmoothingMode.AntiAlias;
            Rectangle shadow = new Rectangle(r.X + 1, r.Y + 3, r.Width, r.Height);
            using (GraphicsPath sp = Round(shadow, 14))
            using (SolidBrush sb = new SolidBrush(Color.FromArgb(18, 15, 23, 42))) {
                g.FillPath(sb, sp);
            }
            using (GraphicsPath path = Round(r, 14))
            using (SolidBrush b = new SolidBrush(fill))
            using (Pen p = new Pen(line)) {
                g.FillPath(b, path);
                g.DrawPath(p, path);
            }
        }

        // Rounded coloured square with a glyph inside (card headers, nav, AI rail).
        public static void PaintBadge(Graphics g, Rectangle r, Color color, string glyph, Font font) {
            g.SmoothingMode = SmoothingMode.AntiAlias;
            using (GraphicsPath path = Round(r, 8))
            using (SolidBrush b = new SolidBrush(FoxTheme.Soft(color)))
            using (SolidBrush ink = new SolidBrush(color)) {
                g.FillPath(b, path);
                if (!string.IsNullOrEmpty(glyph)) {
                    SizeF sz = g.MeasureString(glyph, font);
                    g.DrawString(glyph, font, ink, r.X + (r.Width - sz.Width) / 2f, r.Y + (r.Height - sz.Height) / 2f + 1);
                }
            }
        }

        // Pill with text; returns the drawn width so callers can chain chips.
        public static int PaintChip(Graphics g, int x, int y, string text, Color color, Font font, bool filled) {
            g.SmoothingMode = SmoothingMode.AntiAlias;
            SizeF sz = g.MeasureString(text, font);
            int w = (int)Math.Ceiling(sz.Width) + 16;
            int h = (int)Math.Ceiling(sz.Height) + 6;
            Rectangle r = new Rectangle(x, y, w, h);
            using (GraphicsPath path = Round(r, h / 2))
            using (SolidBrush bg = new SolidBrush(filled ? color : FoxTheme.Soft(color)))
            using (SolidBrush fg = new SolidBrush(filled ? Color.White : color)) {
                g.FillPath(bg, path);
                g.DrawString(text, font, fg, x + 8, y + 3);
            }
            return w;
        }

        public static void PaintDot(Graphics g, int x, int y, int d, Color color) {
            g.SmoothingMode = SmoothingMode.AntiAlias;
            using (SolidBrush b = new SolidBrush(color)) {
                g.FillEllipse(b, x, y, d, d);
            }
        }

        public static void PaintBar(Graphics g, Rectangle r, Color color) {
            if (r.Height < 2) r.Height = 2;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            using (GraphicsPath path = Round(r, Math.Min(6, r.Width / 2)))
            using (LinearGradientBrush b = new LinearGradientBrush(r, color, FoxTheme.Soft(color), 90f)) {
                g.FillPath(b, path);
            }
        }

        public static Label Label(FoxTheme t, string text, Font font, Color color) {
            Label l = new Label();
            l.Text = text;
            l.Font = font;
            l.ForeColor = color;
            l.BackColor = Color.Transparent;
            l.AutoSize = true;
            return l;
        }

        public static Button Button(FoxTheme t, string text, bool primary) {
            Button b = new Button();
            b.Text = text;
            b.Font = t.Body;
            b.FlatStyle = FlatStyle.Flat;
            b.FlatAppearance.BorderSize = 0;
            b.Height = 32;
            b.Cursor = Cursors.Hand;
            b.Padding = new Padding(10, 0, 10, 0);
            if (primary) {
                b.BackColor = t.Accent;
                b.ForeColor = Color.White;
                b.FlatAppearance.MouseOverBackColor = FoxTheme.Darken(t.Accent, 12);
            } else {
                b.BackColor = t.Card;
                b.ForeColor = t.Ink;
                b.FlatAppearance.BorderSize = 1;
                b.FlatAppearance.BorderColor = t.Line;
                b.FlatAppearance.MouseOverBackColor = t.AccentSoft;
            }
            return b;
        }

        public static TextBox Field(FoxTheme t) {
            TextBox x = new TextBox();
            x.BorderStyle = BorderStyle.FixedSingle;
            x.Font = t.Body;
            x.BackColor = t.Card;
            x.ForeColor = t.Ink;
            return x;
        }

        public static void StyleGrid(DataGridView g, FoxTheme t) {
            g.BackgroundColor = t.Card;
            g.GridColor = t.Line;
            g.BorderStyle = BorderStyle.None;
            g.EnableHeadersVisualStyles = false;
            g.ColumnHeadersBorderStyle = DataGridViewHeaderBorderStyle.None;
            g.RowHeadersVisible = false;
            g.AllowUserToResizeRows = false;
            g.SelectionMode = DataGridViewSelectionMode.FullRowSelect;
            g.MultiSelect = false;
            g.AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill;
            g.ColumnHeadersDefaultCellStyle.BackColor = t.Paper;
            g.ColumnHeadersDefaultCellStyle.ForeColor = t.Muted;
            g.ColumnHeadersDefaultCellStyle.Font = t.Small;
            g.ColumnHeadersDefaultCellStyle.SelectionBackColor = t.Paper;
            g.ColumnHeadersDefaultCellStyle.Padding = new Padding(6, 0, 6, 0);
            g.ColumnHeadersHeightSizeMode = DataGridViewColumnHeadersHeightSizeMode.DisableResizing;
            g.ColumnHeadersHeight = 34;
            g.DefaultCellStyle.BackColor = t.Card;
            g.DefaultCellStyle.ForeColor = t.Ink;
            g.DefaultCellStyle.SelectionBackColor = t.AccentSoft;
            g.DefaultCellStyle.SelectionForeColor = t.Ink;
            g.DefaultCellStyle.Font = t.Body;
            g.DefaultCellStyle.Padding = new Padding(6, 4, 6, 4);
            g.RowTemplate.Height = 32;
            g.CellBorderStyle = DataGridViewCellBorderStyle.SingleHorizontal;
        }

        public static ComboBox Combo(FoxTheme t) {
            ComboBox c = new ComboBox();
            c.FlatStyle = FlatStyle.Flat;
            c.Font = t.Body;
            c.BackColor = t.Card;
            c.ForeColor = t.Ink;
            c.DropDownStyle = ComboBoxStyle.DropDownList;
            return c;
        }
    }

    // FoxTerminal\assets\fox.png is a black square with the fox head on top; crop the head.
    public static class FoxAssets {
        static Bitmap head;
        static bool tried;

        public static Bitmap FoxHead() {
            if (tried) return head;
            tried = true;
            string path = FoxPaths.Asset("fox.png");
            if (string.IsNullOrEmpty(path) || !File.Exists(path)) return null;
            try {
                using (Image src = Image.FromFile(path)) {
                    int w = src.Width;
                    int h = src.Height;
                    Rectangle crop = new Rectangle((int)(w * 0.33), (int)(h * 0.21), (int)(w * 0.34), (int)(h * 0.33));
                    head = new Bitmap(crop.Width, crop.Height, System.Drawing.Imaging.PixelFormat.Format32bppArgb);
                    using (Graphics g = Graphics.FromImage(head)) {
                        g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                        g.DrawImage(src, new Rectangle(0, 0, crop.Width, crop.Height), crop, GraphicsUnit.Pixel);
                    }
                    // Source is fox on solid black; drop the black so it sits on any dark tile.
                    for (int y = 0; y < head.Height; y++) {
                        for (int x = 0; x < head.Width; x++) {
                            Color c = head.GetPixel(x, y);
                            if (c.R < 24 && c.G < 24 && c.B < 24) head.SetPixel(x, y, Color.Transparent);
                        }
                    }
                }
            } catch {
                head = null;
            }
            return head;
        }

        // Fox head inside a dark rounded tile; readable on any light surface.
        public static void PaintFoxTile(Graphics g, Rectangle r, Color night, int radius) {
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.InterpolationMode = InterpolationMode.HighQualityBicubic;
            using (GraphicsPath path = Round(r, radius))
            using (SolidBrush b = new SolidBrush(night)) {
                g.FillPath(b, path);
                Bitmap fox = FoxHead();
                if (fox == null) return;
                GraphicsState st = g.Save();
                g.SetClip(path);
                int pad = Math.Max(4, r.Width / 8);
                Rectangle inner = new Rectangle(r.X + pad, r.Y + pad, r.Width - pad * 2, r.Height - pad * 2);
                float scale = Math.Min(inner.Width / (float)fox.Width, inner.Height / (float)fox.Height);
                int dw = (int)(fox.Width * scale);
                int dh = (int)(fox.Height * scale);
                g.DrawImage(fox, inner.X + (inner.Width - dw) / 2, inner.Y + (inner.Height - dh) / 2, dw, dh);
                g.Restore(st);
            }
        }

        static GraphicsPath Round(Rectangle r, int radius) {
            return FoxUi.Round(r, radius);
        }
    }

    public class FoxCard : Panel {
        public FoxTheme Theme;

        public FoxCard() {
            FoxUi.Buffer(this);
        }

        protected override void OnPaint(PaintEventArgs e) {
            FoxTheme t = Theme;
            if (t == null) t = FoxTheme.Light();
            e.Graphics.Clear(Parent != null ? Parent.BackColor : t.Paper);
            FoxUi.PaintCard(e.Graphics, new Rectangle(0, 0, Width - 1, Height - 1), t.Card, t.Line);
        }
    }

    public class FoxAiClient {
        public string Url = "http://127.0.0.1:11434/api/chat";
        public string Model = "gemma3:1b";
        public int TimeoutMs = 2500;

        public bool TryChat(string system, string user, out string reply) {
            reply = "";
            try {
                string body = "{\"model\":\"" + Esc(Model) + "\",\"stream\":false,\"keep_alive\":\"30s\","
                    + "\"messages\":["
                    + "{\"role\":\"system\",\"content\":\"" + Esc(system) + "\"},"
                    + "{\"role\":\"user\",\"content\":\"" + Esc(user) + "\"}]}";
                HttpWebRequest req = (HttpWebRequest)WebRequest.Create(Url);
                req.Method = "POST";
                req.ContentType = "application/json; charset=utf-8";
                req.Accept = "application/json";
                req.Timeout = TimeoutMs;
                req.ReadWriteTimeout = TimeoutMs;
                byte[] bytes = Encoding.UTF8.GetBytes(body);
                req.ContentLength = bytes.Length;
                using (Stream s = req.GetRequestStream()) {
                    s.Write(bytes, 0, bytes.Length);
                }
                using (WebResponse resp = req.GetResponse())
                using (Stream rs = resp.GetResponseStream())
                using (StreamReader sr = new StreamReader(rs, Encoding.UTF8)) {
                    string json = sr.ReadToEnd();
                    Match m = Regex.Match(json, "\"content\"\\s*:\\s*\"((?:\\\\.|[^\"])*)\"");
                    if (!m.Success) return false;
                    reply = Unesc(m.Groups[1].Value).Trim();
                    return reply.Length > 0;
                }
            } catch {
                return false;
            }
        }

        static string Esc(string s) {
            if (s == null) return "";
            return s.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\r", " ").Replace("\n", "\\n");
        }

        static string Unesc(string s) {
            if (s == null) return "";
            return s.Replace("\\n", "\n").Replace("\\\"", "\"").Replace("\\\\", "\\");
        }
    }

    public static class FoxBoot {
        [DllImport("user32.dll")]
        static extern bool SetProcessDPIAware();

        [DllImport("user32.dll")]
        static extern bool SetForegroundWindow(IntPtr hWnd);

        [DllImport("user32.dll")]
        static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

        public static void Dpi() {
            try { SetProcessDPIAware(); } catch { }
        }

        public static bool FocusExisting(string processName) {
            try {
                System.Diagnostics.Process[] all = System.Diagnostics.Process.GetProcessesByName(processName);
                int me = System.Diagnostics.Process.GetCurrentProcess().Id;
                for (int i = 0; i < all.Length; i++) {
                    try {
                        if (all[i].Id == me) continue;
                        IntPtr h = all[i].MainWindowHandle;
                        if (h == IntPtr.Zero) continue;
                        ShowWindow(h, 9);
                        SetForegroundWindow(h);
                        return true;
                    } catch { }
                    finally { all[i].Dispose(); }
                }
            } catch { }
            return false;
        }
    }
}
