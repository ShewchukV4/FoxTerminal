using System;
using System.IO;
using System.Text;
using System.Threading;
using System.Windows.Forms;
using FoxOs.Sdk;

namespace FoxOs.Nodes {
    static class Program {
        [STAThread]
        static void Main(string[] args) {
            if (args != null && args.Length > 0 && Directory.Exists(args[0])) FoxPaths.CmdDir = args[0];

            bool settingsOnly = HasFlag(args, "-Settings");
            bool stop = HasFlag(args, "-Stop");
            bool hide = HasFlag(args, "-Hide");
            bool show = HasFlag(args, "-Show");
            bool selfTest = HasFlag(args, "-SelfTest");

            if (selfTest) {
                try { NodeSelfTest.Run(); }
                catch (Exception ex) {
                    try {
                        File.WriteAllText(
                            Path.Combine(FoxPaths.RuntimeDir(), "foxnodes-selftest.log"),
                            "FAIL\r\n" + ex, Encoding.UTF8);
                    } catch { }
                    Environment.Exit(1);
                }
                return;
            }

            if (stop) {
                try {
                    File.WriteAllText(Path.Combine(FoxPaths.RuntimeDir(), "foxnodes.signal"), "exit");
                } catch { }
                foreach (var p in System.Diagnostics.Process.GetProcessesByName("foxnodes")) {
                    try { if (p.Id != System.Diagnostics.Process.GetCurrentProcess().Id) p.Kill(); } catch { }
                }
                return;
            }

            if (hide || show) {
                try {
                    File.WriteAllText(
                        Path.Combine(FoxPaths.RuntimeDir(), "foxnodes.signal"),
                        hide ? "hide" : "show");
                } catch { }
                return;
            }

            Application.SetUnhandledExceptionMode(UnhandledExceptionMode.CatchException);
            Application.ThreadException += delegate(object s, ThreadExceptionEventArgs e) { Crash(e.Exception); };
            AppDomain.CurrentDomain.UnhandledException += delegate(object s, UnhandledExceptionEventArgs e) {
                Crash(e.ExceptionObject as Exception);
            };

            try {
                NativeWin.EnablePerMonitorDpi();
                FoxBoot.Dpi();
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);

                if (settingsOnly) {
                    var store = new NodeStore();
                    Application.Run(new SettingsForm(store, null));
                    return;
                }

                if (!AppHost.TryAcquireMutex()) return;

                var nodeStore = new NodeStore();
                Application.Run(new AppHost(nodeStore));
            } catch (Exception ex) {
                Crash(ex);
            }
        }

        static bool HasFlag(string[] args, string flag) {
            if (args == null) return false;
            for (int i = 0; i < args.Length; i++) {
                if (string.Equals(args[i], flag, StringComparison.OrdinalIgnoreCase)) return true;
            }
            return false;
        }

        static void Crash(Exception ex) {
            if (ex == null) return;
            try {
                File.WriteAllText(
                    Path.Combine(FoxPaths.RuntimeDir(), "foxnodes.crash.log"),
                    DateTime.Now.ToString("o") + "\r\n" + ex.ToString(),
                    Encoding.UTF8);
            } catch { }
            try { MessageBox.Show(ex.Message, "FoxNodes"); } catch { }
        }
    }
}
