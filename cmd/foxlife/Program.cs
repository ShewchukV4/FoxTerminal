using System;
using System.IO;
using System.Text;
using System.Windows.Forms;
using FoxOs.Sdk;

namespace FoxOs.Life {
    static class Program {
        [STAThread]
        static void Main(string[] args) {
            if (args != null && args.Length > 0 && Directory.Exists(args[0])) FoxPaths.CmdDir = args[0];
            Application.SetUnhandledExceptionMode(UnhandledExceptionMode.CatchException);
            Application.ThreadException += delegate(object s, System.Threading.ThreadExceptionEventArgs e) {
                Crash(e.Exception);
            };
            AppDomain.CurrentDomain.UnhandledException += delegate(object s, UnhandledExceptionEventArgs e) {
                Crash(e.ExceptionObject as Exception);
            };
            try {
                FoxBoot.Dpi();
                if (FoxBoot.FocusExisting("foxlife")) return;
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                Application.Run(new Shell());
            } catch (Exception ex) {
                Crash(ex);
            }
        }

        static void Crash(Exception ex) {
            if (ex == null) return;
            try {
                File.WriteAllText(
                    Path.Combine(FoxPaths.RuntimeDir(), "foxlife.crash.log"),
                    DateTime.Now.ToString("o") + "\r\n" + ex.ToString(),
                    Encoding.UTF8);
            } catch { }
            try { MessageBox.Show(ex.Message, "FOXOS Life"); } catch { }
        }
    }
}
