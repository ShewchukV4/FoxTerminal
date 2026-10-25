using System;
using System.Collections.Generic;
using System.Drawing;
using System.Threading;
using System.Windows.Forms;
using FoxOs.Assistant;
using FoxOs.Sdk;
using FoxOs.Stt;

namespace FoxOs.Style {

    static class AssistantPage {
        public static void Build(Panel body, FoxTheme theme, AssistantConfig draft, Action changed) {
            AddLine(body, theme, "Помічник", "Локальна модель на loopback. Запити не йдуть у хмару.");
            var client = new AssistantClient();
            string detail;
            bool live = client.Probe(draft, 2200, out detail);
            AddLine(body, theme, live ? "Підключено" : "Немає відповіді",
                live ? detail : client.LastError);

            AddField(body, theme, "Модель", draft.model, delegate(string v) { draft.model = v; changed(); });
            AddField(body, theme, "API (лише loopback)", draft.url, delegate(string v) {
                if ((v ?? "").IndexOf("127.0.0.1", StringComparison.Ordinal) < 0 &&
                    (v ?? "").IndexOf("localhost", StringComparison.OrdinalIgnoreCase) < 0)
                    return;
                draft.url = v; changed();
            });

            List<MicInfo> mics = AssistantMics.List();
            string[] names = new string[Math.Max(1, mics.Count)];
            if (mics.Count == 0) names[0] = "(немає мікрофона)";
            else for (int i = 0; i < mics.Count; i++) names[i] = mics[i].name;
            if (string.IsNullOrEmpty(draft.micName) && mics.Count > 0) {
                for (int i = 0; i < mics.Count; i++)
                    if (mics[i].preferred) draft.micName = mics[i].name;
                if (string.IsNullOrEmpty(draft.micName)) draft.micName = mics[0].name;
            }
            AddChoice(body, theme, "Мікрофон FOXSTYLE", "Не змінює пристрій Windows за замовчуванням",
                names, draft.micName, delegate(string v) { draft.micName = v; changed(); });

            if (string.IsNullOrEmpty(draft.sttLanguage)) draft.sttLanguage = "uk";
            if (string.IsNullOrEmpty(draft.sttDevice)) draft.sttDevice = "cpu";
            SttRuntimeStatus stt = SttRuntime.Snapshot(draft.sttLanguage);

            AddLine(body, theme, "Розпізнавання (локальний Whisper)",
                "Модель: " + (stt.modelName.Length > 0 ? stt.modelName : SttCatalog.ModelId) +
                " · стан: " + (stt.ready ? (stt.serverUp ? "готовий" : "встановлено, сервер ще не піднято") : "не встановлено") +
                " · пристрій: " + stt.device +
                " · мова: " + draft.sttLanguage +
                " · гаряча клавіша: " + Hotkey(draft) +
                (stt.lastMs > 0 ? (" · останнє розпізнавання: " + stt.lastMs + " мс") : ""));
            AddLine(body, theme, "Джерело",
                "whisper.cpp " + SttCatalog.EngineTag + " (BLAS CPU) + " +
                SttCatalog.ModelId + " з huggingface.co/ggerganov/whisper.cpp. " +
                "Файли в %LOCALAPPDATA%\\FoxTerminal\\foxos\\stt. Без хмарного fallback.");

            string[] models = SttPaths.InstalledModels();
            if (models.Length == 0) models = new string[] { SttCatalog.FastId, SttCatalog.ModelId };
            if (string.IsNullOrEmpty(draft.sttModel)) draft.sttModel = SttRuntime.ModelName();
            AddChoice(body, theme, "STT-модель", "small-q8_0 швидша для команд; turbo-q8_0 якісніша, але ~12 с на CPU",
                models, draft.sttModel, delegate(string v) { draft.sttModel = v; changed(); });

            AddChoice(body, theme, "Мова розпізнавання", "Примусово транскрипція, не переклад",
                new string[] { "uk", "uk,en" }, draft.sttLanguage,
                delegate(string v) { draft.sttLanguage = v == "uk,en" ? "uk" : v; changed(); });

            AddToggle(body, theme, "Локальний STT увімкнено", draft.sttEnabled,
                delegate(bool v) { draft.sttEnabled = v; changed(); });
            AddToggle(body, theme, "Діагностика маршруту (assistant-trace.log)", draft.debugTrace,
                delegate(bool v) { draft.debugTrace = v; changed(); });
            AddField(body, theme, "Пауза перед надсиланням голосу (мс)",
                draft.voiceEndMs.ToString(), delegate(string v) {
                    int ms;
                    if (int.TryParse(v, out ms)) { draft.voiceEndMs = ms; changed(); }
                });
            AddLine(body, theme, "Псевдоніми",
                "У assistant.json → aliases: name/kind/value. Приклади: мій браузер, редактор, папка навчання.");

            Label progress = new Label {
                Text = stt.ready ? SttInstaller.ReadyDetail() : "Модель ще не завантажена.",
                Font = theme.Small, ForeColor = theme.Muted,
                Location = Next(body, 18), AutoSize = true,
                MaximumSize = new Size(Math.Max(320, body.Width - 24), 0)
            };
            body.Controls.Add(progress);
            body.Height = progress.Bottom + 8;

            ProgressBar bar = new ProgressBar {
                Location = Next(body, 18), Size = new Size(320, 16), Visible = false
            };
            body.Controls.Add(bar);
            body.Height = bar.Bottom + 8;

            Button install = FoxUi.Button(theme, stt.ready ? "Перевірити файли STT" : "Встановити STT", true);
            install.Location = Next(body, 36);
            install.Size = new Size(200, 30);
            body.Controls.Add(install);
            body.Height = install.Bottom + 10;

            var tick = new System.Windows.Forms.Timer { Interval = 250 };
            bool busy = false;
            install.Click += delegate {
                if (busy) return;
                busy = true;
                install.Enabled = false;
                bar.Visible = true;
                bar.Value = 0;
                progress.Text = "Готую завантаження…";
                ThreadPool.QueueUserWorkItem(delegate {
                    bool ok = SttInstaller.Install(false);
                    if (body.IsHandleCreated)
                        body.BeginInvoke(new Action(delegate {
                            tick.Stop();
                            busy = false;
                            install.Enabled = true;
                            bar.Visible = false;
                            progress.Text = ok
                                ? ("Встановлено: " + SttInstaller.ReadyDetail())
                                : ("Помилка: " + SttInstaller.Current.error);
                            if (ok) changed();
                        }));
                });
                tick.Tick += delegate {
                    SttProgress p = SttInstaller.Current;
                    bar.Value = Math.Max(0, Math.Min(100, p.percent));
                    progress.Text = (p.detail.Length > 0 ? p.detail : p.stage) +
                        (p.percent > 0 ? (" · " + p.percent + "%") : "");
                };
                tick.Start();
            };

            Button probeMic = FoxUi.Button(theme, "Перевірити мікрофон", false);
            probeMic.Location = Next(body, 36);
            probeMic.Size = new Size(200, 28);
            probeMic.Click += delegate {
                string micDetail;
                bool ok = AssistantMics.Probe(draft.micName, out micDetail);
                MessageBox.Show(micDetail, "Мікрофон", MessageBoxButtons.OK,
                    ok ? MessageBoxIcon.Information : MessageBoxIcon.Warning);
            };
            body.Controls.Add(probeMic);
            body.Height = probeMic.Bottom + 8;

            Button testStt = FoxUi.Button(theme, "Тест розпізнавання", false);
            testStt.Location = Next(body, 36);
            testStt.Size = new Size(200, 28);
            testStt.Click += delegate {
                if (!SttInstaller.IsInstalled()) {
                    MessageBox.Show("Спочатку встановіть STT.", "STT",
                        MessageBoxButtons.OK, MessageBoxIcon.Information);
                    return;
                }
                MessageBox.Show(
                    "Затисни OK, говори 2–3 секунди українською, потім відпусти кнопку на HUD або використай Ctrl+Alt+J на робочому столі.\n\n" +
                    "Ця кнопка лише піднімає сервер і перевіряє тишу — команду не виконає.",
                    "STT", MessageBoxButtons.OK, MessageBoxIcon.Information);
                ThreadPool.QueueUserWorkItem(delegate {
                    bool up = SttRuntime.EnsureServer(30000, draft.sttModel);
                    byte[] silence = SttAudio.SilenceWav(800);
                    string heard = up ? SttRuntime.Transcribe(silence, draft.sttLanguage, 30000, draft.sttModel) : "";
                    if (body.IsHandleCreated)
                        body.BeginInvoke(new Action(delegate {
                            MessageBox.Show(
                                (up ? "Сервер готовий. " : ("Сервер: " + SttRuntime.LastError + " ")) +
                                "Тиша: " + (string.IsNullOrEmpty(heard)
                                    ? ("відхилено (" + SttRuntime.LastError + ")")
                                    : ("неочікуваний текст «" + heard + "»")) +
                                (SttRuntime.LastMs > 0 ? (" · " + SttRuntime.LastMs + " мс") : ""),
                                "STT", MessageBoxButtons.OK, MessageBoxIcon.Information);
                        }));
                });
            };
            body.Controls.Add(testStt);
            body.Height = testStt.Bottom + 8;

            AddLine(body, theme, "Озвучення",
                AssistantHasUk()
                    ? "Є український голос."
                    : "Українського TTS немає. Доступні англійські голоси. Текст завжди видно.");

            AddToggle(body, theme, "Озвучувати відповіді", draft.ttsEnabled,
                delegate(bool v) { draft.ttsEnabled = v; changed(); });
            AddToggle(body, theme, "Push-to-talk (" + Hotkey(draft) + ")", draft.pttEnabled,
                delegate(bool v) { draft.pttEnabled = v; changed(); });
            AddToggle(body, theme, "Пошук і браузер", draft.allowSearch,
                delegate(bool v) { draft.allowSearch = v; changed(); });
            AddToggle(body, theme, "Програми", draft.allowApps,
                delegate(bool v) { draft.allowApps = v; changed(); });
            AddField(body, theme, "Папка проєкту", draft.projectPath ?? "",
                delegate(string v) { draft.projectPath = v; changed(); });

            Button browse = FoxUi.Button(theme, "Обрати папку…", false);
            browse.Location = Next(body, 36);
            browse.Size = new Size(140, 28);
            browse.Click += delegate {
                using (var d = new FolderBrowserDialog()) {
                    if (d.ShowDialog() == DialogResult.OK) {
                        draft.projectPath = d.SelectedPath; changed();
                    }
                }
            };
            body.Controls.Add(browse);
            body.Height = browse.Bottom + 12;

            Button test = FoxUi.Button(theme, "Перевірити модель", true);
            test.Location = Next(body, 36);
            test.Size = new Size(180, 30);
            test.Click += delegate {
                string reply;
                bool ok = client.Chat(draft, "Reply with exactly pong", "ping", 40000, out reply);
                MessageBox.Show(ok ? ("Модель відповіла: " + reply) : client.LastError,
                    "Помічник", MessageBoxButtons.OK,
                    ok ? MessageBoxIcon.Information : MessageBoxIcon.Warning);
            };
            body.Controls.Add(test);
            body.Height = test.Bottom + 12;

            Button clear = FoxUi.Button(theme, "Очистити журнал", false);
            clear.Location = Next(body, 36);
            clear.Size = new Size(160, 28);
            clear.Click += delegate { AssistantLog.Clear(); };
            body.Controls.Add(clear);
            body.Height = clear.Bottom + 16;

            List<AssistantLogItem> log = AssistantLog.Load();
            int show = Math.Min(6, log.Count);
            for (int i = 0; i < show; i++) {
                AddLine(body, theme, log[i].ok ? "ok" : "err",
                    (log[i].text ?? "") + " → " + (log[i].result ?? ""));
            }
        }

        static string Hotkey(AssistantConfig draft) {
            if (draft == null) return "Ctrl+Alt+J";
            string s = "";
            if (draft.ctrl) s += "Ctrl+";
            if (draft.alt) s += "Alt+";
            if (draft.shift) s += "Shift+";
            if (draft.win) s += "Win+";
            return s + (string.IsNullOrEmpty(draft.pttKey) ? "J" : draft.pttKey);
        }

        static bool AssistantHasUk() {
            try {
                using (var s = new System.Speech.Synthesis.SpeechSynthesizer()) {
                    foreach (var v in s.GetInstalledVoices())
                        if (v.VoiceInfo.Culture != null &&
                            v.VoiceInfo.Culture.Name.StartsWith("uk")) return true;
                }
            } catch { }
            return false;
        }

        static void AddLine(Panel body, FoxTheme theme, string title, string hint) {
            Label a = new Label { Text = title, Font = theme.Body, ForeColor = theme.Ink,
                Location = Next(body, 20), AutoSize = true };
            body.Controls.Add(a);
            Label b = new Label { Text = hint, Font = theme.Small, ForeColor = theme.Muted,
                Location = new Point(8, a.Bottom + 2), AutoSize = true,
                MaximumSize = new Size(Math.Max(320, body.Width - 24), 0) };
            body.Controls.Add(b);
            body.Height = b.Bottom + 10;
        }

        static void AddField(Panel body, FoxTheme theme, string title, string value, Action<string> set) {
            AddLine(body, theme, title, "");
            TextBox box = new TextBox { Text = value, Width = 320, Location = Next(body, 26) };
            box.TextChanged += delegate { set(box.Text); };
            body.Controls.Add(box);
            body.Height = box.Bottom + 10;
        }

        static void AddToggle(Panel body, FoxTheme theme, string title, bool value, Action<bool> set) {
            CheckBox box = new CheckBox {
                Text = title, Checked = value, AutoSize = true,
                ForeColor = theme.Ink, Location = Next(body, 24)
            };
            box.CheckedChanged += delegate { set(box.Checked); };
            body.Controls.Add(box);
            body.Height = box.Bottom + 8;
        }

        static void AddChoice(Panel body, FoxTheme theme, string title, string hint,
            string[] options, string value, Action<string> set) {
            AddLine(body, theme, title, hint);
            ComboBox combo = new ComboBox {
                DropDownStyle = ComboBoxStyle.DropDownList, Width = 320,
                Location = Next(body, 28)
            };
            combo.Items.AddRange(options);
            if (!string.IsNullOrEmpty(value) && combo.Items.Contains(value))
                combo.SelectedItem = value;
            else if (combo.Items.Count > 0) combo.SelectedIndex = 0;
            combo.SelectedIndexChanged += delegate {
                if (combo.SelectedItem != null) set(combo.SelectedItem.ToString());
            };
            body.Controls.Add(combo);
            body.Height = combo.Bottom + 10;
        }

        static Point Next(Panel body, int h) {
            int y = 8;
            foreach (Control c in body.Controls) y = Math.Max(y, c.Bottom + 8);
            return new Point(8, y);
        }
    }
}
