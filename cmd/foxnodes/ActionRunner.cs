using System;
using System.Diagnostics;
using System.IO;
using System.Text;
using FoxOs.Sdk;

namespace FoxOs.Nodes {

    public sealed class ActionRunner {
        readonly string cmdDir;

        public ActionRunner() {
            cmdDir = FoxPaths.CmdDir;
            if (string.IsNullOrEmpty(cmdDir)) {
                try {
                    string live = Path.Combine(FoxPaths.RuntimeDir(), "live.json");
                    if (File.Exists(live)) {
                        string raw = File.ReadAllText(live);
                        int i = raw.IndexOf("\"cmd\"", StringComparison.OrdinalIgnoreCase);
                        if (i >= 0) {
                            int q = raw.IndexOf('"', i + 6);
                            int q2 = raw.IndexOf('"', q + 1);
                            if (q >= 0 && q2 > q) cmdDir = raw.Substring(q + 1, q2 - q - 1).Replace("\\\\", "\\");
                        }
                    }
                } catch { }
            }
        }

        public string Run(MenuActionSpec act, Action<string> internalHandler) {
            if (act == null) return "Немає дії";
            string kind = (act.kind ?? "").Trim().ToLowerInvariant();
            try {
                switch (kind) {
                    case "internal":
                        if (internalHandler != null) internalHandler(act.command ?? "");
                        return null;
                    case "openexe":
                        return RunExe(act.path, act.args);
                    case "openpath":
                        return RunPath(act.path);
                    case "openurl":
                        return RunUrl(act.url);
                    case "foxcommand":
                        return RunFoxCommand(act.command);
                    default:
                        return "Невідомий тип дії: " + kind;
                }
            } catch (Exception ex) {
                return ex.Message;
            }
        }

        string RunExe(string path, string args) {
            if (string.IsNullOrWhiteSpace(path)) return "Не вказано program path";
            string file = path.Trim();
            if (!Path.IsPathRooted(file)) {
                string sys = Environment.GetFolderPath(Environment.SpecialFolder.System);
                string cand = Path.Combine(sys, file);
                if (File.Exists(cand)) file = cand;
            }
            if (!File.Exists(file)) return "Файл не знайдено: " + file;
            var psi = new ProcessStartInfo();
            psi.FileName = file;
            psi.UseShellExecute = true;
            psi.WorkingDirectory = Path.GetDirectoryName(file) ?? Environment.CurrentDirectory;
            if (!string.IsNullOrWhiteSpace(args)) psi.Arguments = args;
            Process.Start(psi);
            return null;
        }

        string RunPath(string path) {
            if (string.IsNullOrWhiteSpace(path)) return "Не вказано шлях";
            string p = path.Trim();
            if (!Directory.Exists(p) && !File.Exists(p)) return "Шлях не існує: " + p;
            var psi = new ProcessStartInfo();
            psi.FileName = p;
            psi.UseShellExecute = true;
            Process.Start(psi);
            return null;
        }

        string RunUrl(string url) {
            if (string.IsNullOrWhiteSpace(url)) return "Порожній URL";
            string u = url.Trim();
            var psi = new ProcessStartInfo();
            psi.FileName = u;
            psi.UseShellExecute = true;
            Process.Start(psi);
            return null;
        }

        string RunFoxCommand(string command) {
            if (string.IsNullOrWhiteSpace(command)) return "Порожня команда";
            if (string.IsNullOrEmpty(cmdDir) || !Directory.Exists(cmdDir)) {
                return "cmdDir не знайдено — запустіть foxnodes з терміналу FoxTerminal";
            }
            string line = command.Trim();
            string ps1 = Path.Combine(cmdDir, line.Split(' ')[0] + ".ps1");
            if (File.Exists(ps1)) {
                var psi = new ProcessStartInfo();
                psi.FileName = "powershell.exe";
                psi.UseShellExecute = false;
                psi.CreateNoWindow = false;
                var sb = new StringBuilder();
                sb.Append("-NoProfile -ExecutionPolicy Bypass -File \"");
                sb.Append(ps1);
                sb.Append("\"");
                int sp = line.IndexOf(' ');
                if (sp > 0) sb.Append(" ").Append(line.Substring(sp + 1));
                psi.Arguments = sb.ToString();
                psi.WorkingDirectory = cmdDir;
                Process.Start(psi);
                return null;
            }
            string desk = Path.Combine(cmdDir, "foxos-deskcmd.ps1");
            if (File.Exists(desk)) {
                var psi = new ProcessStartInfo();
                psi.FileName = "powershell.exe";
                psi.UseShellExecute = false;
                psi.CreateNoWindow = true;
                psi.Arguments = "-NoProfile -ExecutionPolicy Bypass -File \"" + desk + "\" \"" + line.Replace("\"", "") + "\"";
                psi.WorkingDirectory = cmdDir;
                Process.Start(psi);
                return null;
            }
            return "Не знайдено скрипт для: " + line;
        }
    }
}
