using System;
using System.IO;
using System.Text;
using System.Windows.Forms;
using FoxOs.Sdk;

namespace FoxOs.Style {
    static class Program {
        [STAThread]
        static void Main(string[] args) {
            if (args != null && args.Length > 0 && Directory.Exists(args[0])) FoxPaths.CmdDir = args[0];
            bool nodeEditor = HasFlag(args, "-NodeEditor");
            if (HasFlag(args, "-SelfTest")) {
                try { NodeEditorSelfTest.Run(); }
                catch (Exception ex) {
                    try {
                        File.WriteAllText(
                            Path.Combine(FoxPaths.RuntimeDir(), "foxstyle-selftest.log"),
                            "FAIL\r\n" + ex, Encoding.UTF8);
                    } catch { }
                    Environment.Exit(1);
                }
                return;
            }
            Application.SetUnhandledExceptionMode(UnhandledExceptionMode.CatchException);
            Application.ThreadException += delegate(object s, System.Threading.ThreadExceptionEventArgs e) {
                // Paint/GDI noise: log only — MessageBox on every repaint freezes the app.
                Log(e.Exception);
            };
            AppDomain.CurrentDomain.UnhandledException += delegate(object s, UnhandledExceptionEventArgs e) {
                Crash(e.ExceptionObject as Exception);
            };
            try {
                FoxBoot.Dpi();
                if (!nodeEditor && FoxBoot.FocusExisting("foxstyle")) return;
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                if (nodeEditor) {
                    var store = new StyleStore();
                    bool light = store.Doc != null && store.Doc.colors != null &&
                        string.Equals(store.Doc.colors.theme, "light",
                            StringComparison.OrdinalIgnoreCase);
                    Application.Run(new NodeEditorForm(
                        FoxTheme.Named(light ? "slate" : "midnight"), store));
                    return;
                }
                Application.Run(new Shell());
            } catch (Exception ex) {
                Crash(ex);
            }
        }

        static bool HasFlag(string[] args, string flag) {
            if (args == null) return false;
            for (int i = 0; i < args.Length; i++)
                if (string.Equals(args[i], flag,
                    StringComparison.OrdinalIgnoreCase)) return true;
            return false;
        }

        static void Log(Exception ex) {
            if (ex == null) return;
            try {
                File.AppendAllText(
                    Path.Combine(FoxPaths.RuntimeDir(), "foxstyle.crash.log"),
                    DateTime.Now.ToString("o") + "\r\n" + ex.ToString() + "\r\n\r\n",
                    Encoding.UTF8);
            } catch { }
        }

        static void Crash(Exception ex) {
            Log(ex);
            try { MessageBox.Show(ex != null ? ex.Message : "fatal", "FOXSTYLE"); } catch { }
        }
    }
}
