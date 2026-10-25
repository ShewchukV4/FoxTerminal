using System;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using FoxOs.Sdk;

namespace FoxOs.Style {

    // Pushes FOXSTYLE doc into real FoxOS: theme.txt + live.json (+ optional apply.ps1).
    public static class SystemBridge {

        public static string MapSwName(StyleDoc doc) {
            if (doc == null) return "orange";
            // Always prefer the swatch the user picked.
            if (doc.colors != null && !string.IsNullOrEmpty(doc.colors.sw))
                return doc.colors.sw.Trim().ToLowerInvariant();
            string p = (doc.preset ?? "").ToLowerInvariant();
            if (p == "neon") return "neon";
            if (p == "foxpurple") return "purple";
            if (p == "light") return "white";
            if (p == "dark") return "violet";
            string t = doc.colors != null ? (doc.colors.theme ?? "") : "";
            t = t.ToLowerInvariant();
            if (t == "neon") return "neon";
            if (t == "light") return "white";
            return "violet";
        }

        public static string MapDockStyle(StyleDoc doc) {
            string d = doc != null && doc.texture != null ? doc.texture.dock : "pill";
            // bar = full-width rail (old mapping to slim only shrunk the island)
            if (string.Equals(d, "bar", StringComparison.OrdinalIgnoreCase)) return "rail";
            if (string.Equals(d, "rail", StringComparison.OrdinalIgnoreCase)) return "rail";
            if (string.Equals(d, "glass", StringComparison.OrdinalIgnoreCase)) return "glass";
            if (string.Equals(d, "slim", StringComparison.OrdinalIgnoreCase)) return "slim";
            return "pill";
        }

        public static string NightFor(StyleDoc doc) {
            if (doc == null || doc.colors == null || string.IsNullOrEmpty(doc.colors.bg))
                return "#0B0A12";
            return doc.colors.bg;
        }

        // Fast live path (no PowerShell): window corners, taskbar/dock shape, alpha, colors.
        // foxos-live picks live.json up within ~0.5s and restyles every window.
        public static void ApplyFast(StyleDoc doc) {
            if (doc == null) return;
            try {
                string dir = FoxPaths.RuntimeDir();
                int radius = doc.window != null ? doc.window.radius : 12;
                string corner = radius <= 2 ? "square" : (radius <= 9 ? "small" : "round");
                bool floating = doc.chrome != null && doc.chrome.floating;
                int opacity = doc.chrome != null ? Math.Max(20, Math.Min(100, doc.chrome.opacity)) : 72;
                int barH = doc.chrome != null ? Math.Max(36, Math.Min(80, doc.chrome.height)) : 56;
                int blur = doc.chrome != null ? Math.Max(0, Math.Min(40, doc.chrome.blur)) : 0;
                int tbRadius = Math.Max(0, Math.Min(28, radius));
                int tbInset = floating ? 8 : 0;
                int dockRadius = Math.Min(60, radius * 2);
                int dockPad = floating ? 16 : 0;
                string accent = doc.colors != null ? doc.colors.accent : "#7B5CFF";
                string accent2 = doc.colors != null ? doc.colors.accent2 : "#DC7A14";
                string night = NightFor(doc);
                string dock = MapDockStyle(doc);
                string sw = MapSwName(doc);
                string wallKind = doc.texture != null && !string.IsNullOrEmpty(doc.texture.kind) ? doc.texture.kind : "glass";
                int wallRain = doc.texture != null ? Math.Max(0, Math.Min(80, doc.texture.rain)) : 30;
                int wallStrength = doc.texture != null ? Math.Max(0, Math.Min(100, doc.texture.strength)) : 60;
                int wallScale = doc.texture != null ? Math.Max(0, Math.Min(100, doc.texture.scale)) : 50;
                int wallWeight = doc.texture != null ? Math.Max(0, Math.Min(100, doc.texture.weight)) : 40;
                int wallVeil = doc.texture != null ? Math.Max(0, Math.Min(100, doc.texture.veil)) : 50;
                string glow = (doc.labs != null && doc.labs.foxGlow) ? "on" : "off";
                int glowStrength = doc.labs != null ? Math.Max(0, Math.Min(100, doc.labs.glowStrength)) : 70;
                int glowSpeed = doc.labs != null ? Math.Max(0, Math.Min(100, doc.labs.glowSpeed)) : 50;

                // overlay survives Write-FoxOsLiveState rewrites
                string ap = Path.Combine(dir, "style-applied.json");
                string aj = File.Exists(ap) ? File.ReadAllText(ap, Encoding.UTF8) : "{}";
                aj = SetJsonString(aj, "sw", sw);
                aj = SetJsonString(aj, "accent", accent);
                aj = SetJsonString(aj, "accent2", accent2);
                aj = SetJsonString(aj, "night", night);
                aj = SetJsonString(aj, "dockStyle", dock);
                aj = SetJsonString(aj, "winCorner", corner);
                aj = SetJsonString(aj, "winRadius", radius.ToString());
                aj = SetJsonString(aj, "tbRadius", tbRadius.ToString());
                aj = SetJsonString(aj, "tbInset", tbInset.ToString());
                aj = SetJsonString(aj, "dockRadius", dockRadius.ToString());
                aj = SetJsonString(aj, "dockPad", dockPad.ToString());
                aj = SetJsonString(aj, "dockAlpha", opacity.ToString());
                aj = SetJsonString(aj, "dockBarH", barH.ToString());
                aj = SetJsonString(aj, "dockBlur", blur.ToString());
                aj = SetJsonString(aj, "wallKind", wallKind);
                aj = SetJsonString(aj, "wallRain", wallRain.ToString());
                aj = SetJsonString(aj, "wallStrength", wallStrength.ToString());
                aj = SetJsonString(aj, "wallScale", wallScale.ToString());
                aj = SetJsonString(aj, "wallWeight", wallWeight.ToString());
                aj = SetJsonString(aj, "wallVeil", wallVeil.ToString());
                aj = SetJsonString(aj, "foxGlow", glow);
                aj = SetJsonString(aj, "foxGlowStrength", glowStrength.ToString());
                aj = SetJsonString(aj, "foxGlowSpeed", glowSpeed.ToString());
                aj = SetJsonString(aj, "tbAccent", "on");
                File.WriteAllText(ap, aj, new UTF8Encoding(false));

                string livePath = Path.Combine(dir, "live.json");
                string json = File.Exists(livePath) ? File.ReadAllText(livePath, Encoding.UTF8) : "{}";
                json = SetJsonString(json, "accent", accent);
                json = SetJsonString(json, "accent2", accent2);
                json = SetJsonString(json, "night", night);
                json = SetJsonString(json, "theme", sw);
                json = SetJsonString(json, "dockStyle", dock);
                json = SetJsonString(json, "winCorner", corner);
                json = SetJsonString(json, "winRadius", radius.ToString());
                json = SetJsonString(json, "tbRadius", tbRadius.ToString());
                json = SetJsonString(json, "tbInset", tbInset.ToString());
                json = SetJsonString(json, "dockRadius", dockRadius.ToString());
                json = SetJsonString(json, "dockPad", dockPad.ToString());
                json = SetJsonString(json, "dockAlpha", opacity.ToString());
                json = SetJsonString(json, "dockBarH", barH.ToString());
                json = SetJsonString(json, "dockBlur", blur.ToString());
                json = SetJsonString(json, "wallKind", wallKind);
                json = SetJsonString(json, "wallRain", wallRain.ToString());
                json = SetJsonString(json, "wallStrength", wallStrength.ToString());
                json = SetJsonString(json, "wallScale", wallScale.ToString());
                json = SetJsonString(json, "wallWeight", wallWeight.ToString());
                json = SetJsonString(json, "wallVeil", wallVeil.ToString());
                json = SetJsonString(json, "foxGlow", glow);
                json = SetJsonString(json, "foxGlowStrength", glowStrength.ToString());
                json = SetJsonString(json, "foxGlowSpeed", glowSpeed.ToString());
                File.WriteAllText(livePath, json, new UTF8Encoding(false));
            } catch { }
        }

        public static void ApplyToSystem(StyleDoc doc) {
            if (doc == null) return;
            string sw = MapSwName(doc);
            string accent = doc.colors != null ? doc.colors.accent : "#7B5CFF";
            string accent2 = doc.colors != null ? doc.colors.accent2 : "#DC7A14";
            string night = NightFor(doc);
            string dock = MapDockStyle(doc);

            // 1) terminal theme name
            try {
                string cmd = FoxPaths.CmdDir;
                if (string.IsNullOrEmpty(cmd)) cmd = Path.Combine(FoxPaths.RepoRoot(), "cmd");
                if (!string.IsNullOrEmpty(cmd) && Directory.Exists(cmd)) {
                    File.WriteAllText(Path.Combine(cmd, "theme.txt"), sw + Environment.NewLine, new UTF8Encoding(false));
                }
            } catch { }

            // 2) live.json — foxos-live polls this
            try {
                string livePath = Path.Combine(FoxPaths.RuntimeDir(), "live.json");
                string json = File.Exists(livePath) ? File.ReadAllText(livePath, Encoding.UTF8) : "{}";
                json = SetJsonString(json, "theme", sw);
                json = SetJsonString(json, "accent", accent);
                json = SetJsonString(json, "accent2", accent2);
                json = SetJsonString(json, "night", night);
                json = SetJsonString(json, "dockStyle", dock);
                // floating = pad from edge (bottom), NOT move dock to top (that killed media clicks)
                json = SetJsonString(json, "dockPos", "bottom");
                string wallKind = doc.texture != null && !string.IsNullOrEmpty(doc.texture.kind) ? doc.texture.kind : "glass";
                int wallRain = doc.texture != null ? Math.Max(0, Math.Min(80, doc.texture.rain)) : 30;
                int wallStrength = doc.texture != null ? Math.Max(0, Math.Min(100, doc.texture.strength)) : 60;
                int wallScale = doc.texture != null ? Math.Max(0, Math.Min(100, doc.texture.scale)) : 50;
                int wallWeight = doc.texture != null ? Math.Max(0, Math.Min(100, doc.texture.weight)) : 40;
                int wallVeil = doc.texture != null ? Math.Max(0, Math.Min(100, doc.texture.veil)) : 50;
                string glow = (doc.labs != null && doc.labs.foxGlow) ? "on" : "off";
                int glowStrength = doc.labs != null ? Math.Max(0, Math.Min(100, doc.labs.glowStrength)) : 70;
                int glowSpeed = doc.labs != null ? Math.Max(0, Math.Min(100, doc.labs.glowSpeed)) : 50;
                json = SetJsonString(json, "wallKind", wallKind);
                json = SetJsonString(json, "wallRain", wallRain.ToString());
                json = SetJsonString(json, "wallStrength", wallStrength.ToString());
                json = SetJsonString(json, "wallScale", wallScale.ToString());
                json = SetJsonString(json, "wallWeight", wallWeight.ToString());
                json = SetJsonString(json, "wallVeil", wallVeil.ToString());
                json = SetJsonString(json, "foxGlow", glow);
                json = SetJsonString(json, "foxGlowStrength", glowStrength.ToString());
                json = SetJsonString(json, "foxGlowSpeed", glowSpeed.ToString());
                File.WriteAllText(livePath, json, new UTF8Encoding(false));
            } catch { }

            // 3) look.json dock (foxlook)
            try {
                string lookPath = Path.Combine(FoxPaths.RuntimeDir(), "look.json");
                string json = File.Exists(lookPath) ? File.ReadAllText(lookPath, Encoding.UTF8) : "{\"parts\":{}}";
                json = SetJsonString(json, "dockStyle", dock);
                File.WriteAllText(lookPath, json, new UTF8Encoding(false));
            } catch { }

            // 4) full system apply (wall + DWM + ghostty) — wait so Apply is real
            try {
                string cmd = FoxPaths.CmdDir;
                if (string.IsNullOrEmpty(cmd)) cmd = Path.Combine(FoxPaths.RepoRoot(), "cmd");
                string ps1 = Path.Combine(cmd, "foxstyle-apply.ps1");
                string log = Path.Combine(FoxPaths.RuntimeDir(), "foxstyle-apply.log");
                if (File.Exists(ps1)) {
                    ProcessStartInfo psi = new ProcessStartInfo();
                    psi.FileName = "powershell.exe";
                    psi.Arguments = "-NoProfile -ExecutionPolicy Bypass -File \"" + ps1 + "\"";
                    psi.UseShellExecute = false;
                    psi.CreateNoWindow = true;
                    psi.WindowStyle = ProcessWindowStyle.Hidden;
                    psi.RedirectStandardOutput = true;
                    psi.RedirectStandardError = true;
                    Process p = Process.Start(psi);
                    if (p != null) {
                        string stdout = p.StandardOutput.ReadToEnd();
                        string stderr = p.StandardError.ReadToEnd();
                        p.WaitForExit(90000);
                        try {
                            File.WriteAllText(log,
                                DateTime.Now.ToString("o") + "\r\nexit=" + p.ExitCode + "\r\n" + stdout + "\r\n" + stderr,
                                new UTF8Encoding(false));
                        } catch { }
                    }
                }
            } catch { }

            FoxToast.Show("FOXSTYLE system · " + sw);
        }

        static string SetJsonString(string json, string key, string value) {
            if (json == null) json = "{}";
            if (value == null) value = "";
            string esc = value.Replace("\\", "\\\\").Replace("\"", "\\\"");
            string pattern = "\"" + key + "\"\\s*:\\s*\"(?:\\\\.|[^\"\\\\])*\"";
            string repl = "\"" + key + "\":\"" + esc + "\"";
            if (Regex.IsMatch(json, pattern)) {
                return Regex.Replace(json, pattern, repl);
            }
            // insert before last }
            int idx = json.LastIndexOf('}');
            if (idx < 0) return "{\"" + key + "\":\"" + esc + "\"}";
            string insert = repl;
            string head = json.Substring(0, idx).TrimEnd();
            if (head.EndsWith("{")) return head + insert + "}";
            if (!head.EndsWith(",")) head = head + ",";
            return head + insert + "}";
        }
    }
}
