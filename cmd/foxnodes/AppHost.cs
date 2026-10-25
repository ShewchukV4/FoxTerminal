using System;
using System.Drawing;
using System.IO;
using System.Threading;
using System.Windows.Forms;
using FoxOs.Sdk;

namespace FoxOs.Nodes {

    sealed class AppHost : ApplicationContext {
        static Mutex appMutex;
        readonly NodeStore store;
        readonly ActionRunner runner;
        readonly HotkeyHost hotkeyHost;
        readonly LauncherView launcher;
        readonly AssistantHost assistant;
        readonly AssistantHud hud;
        readonly NotifyIcon tray;
        readonly System.Windows.Forms.Timer fallbackTimer;
        readonly SynchronizationContext ui;
        FileSystemWatcher signalWatcher;
        FileSystemWatcher styleWatcher;
        FileSystemWatcher assistantWatcher;
        int lastSignalTick;
        int lastStyleTick;

        public AppHost(NodeStore nodeStore) {
            store = nodeStore;
            runner = new ActionRunner();
            ui = SynchronizationContext.Current;

            hotkeyHost = new HotkeyHost();
            hotkeyHost.HotkeyPressed += delegate { ToggleLauncher(); };
            hotkeyHost.Load += delegate {
                if (!hotkeyHost.ApplyHotkey(store.Config.hotkey)) {
                    FoxToast.Show("foxnodes · " + hotkeyHost.LastHotkeyError);
                }
            };
            hotkeyHost.Show();

            launcher = new LauncherView(store, runner, OpenSettings);
            assistant = new AssistantHost(store, runner);
            hud = new AssistantHud(assistant);
            launcher.AttachAssistant(assistant, hud);
            hotkeyHost.PttPressed += delegate {
                if (assistant.Listening) assistant.EndPush();
                else assistant.BeginPush();
            };
            BindPtt();
            if (store.Config.desktopVisible) launcher.ShowDesktop();
            FoxNodesSync.WriteApplied(launcher.CurrentRevision);

            tray = new NotifyIcon();
            tray.Text = "FoxNodes";
            tray.Icon = SystemIcons.Application;
            tray.Visible = true;
            var menu = new ContextMenuStrip();
            menu.Items.Add("Показати / активувати", null, delegate { ActivateLauncher(); });
            menu.Items.Add("Сховати з робочого столу", null, delegate { HideLauncher(); });
            menu.Items.Add("Налаштування…", null, delegate { OpenSettings(); });
            menu.Items.Add("Вихід", null, delegate { Exit(); });
            tray.ContextMenuStrip = menu;
            tray.DoubleClick += delegate { ActivateLauncher(); };

            ArmWatchers();
            fallbackTimer = new System.Windows.Forms.Timer();
            fallbackTimer.Interval = 700;
            fallbackTimer.Tick += delegate { ProcessSignal(false); };
            fallbackTimer.Start();
            Microsoft.Win32.SystemEvents.DisplaySettingsChanged += OnDisplaySettingsChanged;
            Microsoft.Win32.SystemEvents.UserPreferenceChanged += OnUserPreferenceChanged;

            Application.ApplicationExit += delegate { Cleanup(); };
        }

        void ArmWatchers() {
            string run = FoxPaths.RuntimeDir();
            try { Directory.CreateDirectory(run); } catch { }
            signalWatcher = Watch(run, "foxnodes.signal", delegate {
                QueueUi(delegate { ProcessSignal(true); });
            });
            styleWatcher = Watch(run, "style.json", delegate {
                QueueUi(ProcessStyle);
            });
            assistantWatcher = Watch(run, "assistant.json", delegate {
                QueueUi(delegate { assistant.ReloadConfig(); BindPtt(); });
            });
        }

        void BindPtt() {
            if (assistant == null || assistant.Config == null || !assistant.Config.pttEnabled)
                return;
            var hk = new HotkeySpec {
                ctrl = assistant.Config.ctrl,
                alt = assistant.Config.alt,
                shift = assistant.Config.shift,
                win = assistant.Config.win,
                key = assistant.Config.pttKey
            };
            hotkeyHost.ApplyPttHotkey(hk);
        }

        static FileSystemWatcher Watch(string dir, string filter, Action handler) {
            var watcher = new FileSystemWatcher(dir, filter);
            watcher.NotifyFilter = NotifyFilters.LastWrite | NotifyFilters.Size |
                NotifyFilters.CreationTime | NotifyFilters.FileName;
            FileSystemEventHandler onChange = delegate {
                handler();
            };
            watcher.Changed += onChange;
            watcher.Created += onChange;
            watcher.EnableRaisingEvents = true;
            return watcher;
        }

        void QueueUi(Action action) {
            try {
                if (launcher != null && launcher.IsHandleCreated)
                    launcher.BeginInvoke(action);
                else if (ui != null)
                    ui.Post(delegate { action(); }, null);
                else action();
            } catch (Exception ex) {
                LogSync("ui-queue", ex);
            }
        }

        void OnDisplaySettingsChanged(object sender, EventArgs e) {
            QueueUi(launcher.ReflowDisplays);
        }

        void OnUserPreferenceChanged(object sender,
            Microsoft.Win32.UserPreferenceChangedEventArgs e) {
            QueueUi(delegate { launcher.RefreshExternalTheme(true); });
        }

        void ProcessStyle() {
            int now = Environment.TickCount;
            if (now - lastStyleTick < 60) return;
            lastStyleTick = now;
            try {
                launcher.RefreshExternalTheme(true);
                FoxNodesSync.WriteApplied(launcher.CurrentRevision);
            } catch (Exception ex) {
                LogSync("style", ex);
            }
        }

        void ProcessSignal(bool fromWatch) {
            try {
                if (!File.Exists(FoxNodesSync.SignalPath)) return;
                int now = Environment.TickCount;
                if (fromWatch && now - lastSignalTick < 40) return;
                lastSignalTick = now;
                string raw = File.ReadAllText(FoxNodesSync.SignalPath);
                try { File.Delete(FoxNodesSync.SignalPath); } catch { }
                int revision;
                string cmd = FoxNodesSync.ParseCommand(raw, out revision);
                if (cmd == "toggle" || cmd == "activate" || cmd == "show") ActivateLauncher();
                else if (cmd == "hide") HideLauncher();
                else if (cmd == "settings") OpenSettings();
                else if (cmd == "reload") {
                    store.Reload();
                    launcher.ReloadConfig();
                    assistant.ReloadConfig();
                    BindPtt();
                    if (!hotkeyHost.ApplyHotkey(store.Config.hotkey))
                        FoxToast.Show("foxnodes · " + hotkeyHost.LastHotkeyError);
                    FoxNodesSync.WriteApplied(Math.Max(revision, launcher.CurrentRevision));
                    launcher.NotifyApplied();
                }
                else if (cmd == "exit") Exit();
            } catch (Exception ex) {
                LogSync("signal", ex);
            }
        }

        void ToggleLauncher() {
            ActivateLauncher();
        }

        void ActivateLauncher() {
            store.Reload();
            store.Config.desktopVisible = true;
            store.Save();
            launcher.ShowDesktop();
            launcher.ActivateGraph();
        }

        void HideLauncher() {
            store.Reload();
            store.Config.desktopVisible = false;
            store.Save();
            launcher.HideGraph();
        }

        void OpenSettings() {
            using (var f = new SettingsForm(store, RebindHotkey)) {
                f.ShowDialog();
            }
        }

        bool RebindHotkey(HotkeySpec hk) {
            bool ok = hotkeyHost.ApplyHotkey(hk);
            if (!ok) FoxToast.Show("foxnodes · " + hotkeyHost.LastHotkeyError);
            return ok;
        }

        void Exit() {
            Cleanup();
            ExitThread();
        }

        void Cleanup() {
            try { fallbackTimer.Stop(); } catch { }
            try { if (signalWatcher != null) signalWatcher.Dispose(); } catch { }
            try { if (styleWatcher != null) styleWatcher.Dispose(); } catch { }
            try { if (assistantWatcher != null) assistantWatcher.Dispose(); } catch { }
            try {
                Microsoft.Win32.SystemEvents.DisplaySettingsChanged -= OnDisplaySettingsChanged;
                Microsoft.Win32.SystemEvents.UserPreferenceChanged -= OnUserPreferenceChanged;
            } catch { }
            try { hotkeyHost.Unregister(); hotkeyHost.Close(); } catch { }
            try { tray.Visible = false; tray.Dispose(); } catch { }
            try { if (hud != null) hud.Dispose(); } catch { }
            try { if (assistant != null) assistant.Dispose(); } catch { }
            try { launcher.Dispose(); } catch { }
        }

        static void LogSync(string where, Exception ex) {
            try {
                File.AppendAllText(
                    Path.Combine(FoxPaths.RuntimeDir(), "foxnodes.sync.log"),
                    DateTime.Now.ToString("o") + " " + where + "\r\n" +
                    (ex != null ? ex.ToString() : "") + "\r\n\r\n");
            } catch { }
        }

        public static bool TryAcquireMutex() {
            bool created;
            appMutex = new Mutex(true, "FoxTerminal.FoxNodes", out created);
            if (!created) {
                try {
                    File.WriteAllText(FoxNodesSync.SignalPath, "activate");
                } catch { }
                return false;
            }
            return true;
        }
    }
}
