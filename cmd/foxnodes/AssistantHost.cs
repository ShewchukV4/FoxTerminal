using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Threading;
using System.Windows.Forms;
using FoxOs.Assistant;
using FoxOs.Sdk;
using FoxOs.Stt;

namespace FoxOs.Nodes {

    sealed class AssistantCard {
        public string title = "";
        public string detail = "";
        public StepStatus status = StepStatus.Waiting;
        public Rectangle bounds;
    }

    sealed class AssistantHost : IDisposable {
        public event Action Changed;
        public AssistantState State = AssistantState.Ready;
        public string StatusText = "Готовий";
        public string HeardText = "";
        public string ResultText = "";
        public string ModelLine = "";
        public int LastSttMs;
        public readonly List<AssistantCard> Cards = new List<AssistantCard>();
        public AssistantConfig Config;
        public readonly AssistantSpeech Speech = new AssistantSpeech();
        public float MicLevel { get { return Speech.Level; } }
        public bool Listening { get { return Speech.Recording; } }

        readonly ActionRunner runner;
        readonly NodeStore nodes;
        readonly AssistantClient client = new AssistantClient();
        readonly AssistantTalk talk = new AssistantTalk();
        readonly SynchronizationContext ui;
        int token;
        bool cancel;
        System.Windows.Forms.Timer timerClock;
        System.Windows.Forms.Timer voiceWait;
        string pendingHeard = "";
        DateTime timerUntil = DateTime.MinValue;

        public AssistantHost(NodeStore store, ActionRunner actions) {
            nodes = store;
            runner = actions;
            ui = SynchronizationContext.Current;
            Config = AssistantStore.Load();
            if (string.IsNullOrEmpty(Config.micName))
                Config.micName = AssistantSpeech.DefaultMicName();
            if (!AssistantSpeech.HasUkrainianVoice())
                Config.speakConfirmations = false;
            RefreshModelLine();
            ThreadPool.QueueUserWorkItem(delegate { Warmup(); });
        }

        void Warmup() {
            string detail;
            bool ok = client.Probe(Config, 2500, out detail);
            if (SttInstaller.IsInstalled())
                SttRuntime.EnsureServer(25000, Config.sttModel);
            Post(delegate {
                RefreshModelLine();
                if (!ok) {
                    State = AssistantState.Error;
                    StatusText = "Модель недоступна";
                    ModelLine = client.LastError.Length > 0 ? client.LastError : detail;
                } else if (!string.IsNullOrEmpty(detail)) {
                    ModelLine = detail + " · " + SttLine();
                }
                Raise();
            });
        }

        public void ReloadConfig() {
            Config = AssistantStore.Load();
            RefreshModelLine();
            Raise();
        }

        void RefreshModelLine() {
            ModelLine = (Config.runtime ?? "ollama") + " · " + Config.model +
                " · " + (Config.micName.Length > 0 ? Config.micName : "мікрофон не вибрано") +
                " · " + SttLine();
        }

        string SttLine() {
            if (!SttInstaller.IsInstalled()) return "STT немає";
            string ms = LastSttMs > 0 ? (" · " + LastSttMs + " мс") : "";
            return SttRuntime.ModelName() + " / " + SttRuntime.Device + ms;
        }

        public void SubmitText(string text) {
            StopVoiceWait();
            pendingHeard = "";
            BeginRequest(text, "text");
        }

        public void SubmitNow() {
            StopVoiceWait();
            string text = pendingHeard.Length > 0 ? pendingHeard : HeardText;
            pendingHeard = "";
            if (string.IsNullOrWhiteSpace(text)) return;
            BeginRequest(text, "voice");
        }

        public void NewConversation() {
            StopVoiceWait();
            talk.Clear();
            pendingHeard = "";
            HeardText = "";
            ResultText = "Нова розмова.";
            StatusText = "Готовий";
            Cards.Clear();
            State = AssistantState.Ready;
            Raise();
        }

        public bool BeginPush() {
            if (Speech.Speaking) Speech.StopSpeak();
            StopVoiceWait();
            if (State == AssistantState.Listening) return true;
            if (!Speech.StartListen(Config)) {
                State = AssistantState.Error;
                StatusText = Speech.LastError;
                ResultText = Speech.LastError;
                Raise();
                return false;
            }
            State = AssistantState.Listening;
            StatusText = "Слухаю";
            HeardText = "";
            ResultText = "";
            Raise();
            return true;
        }

        public void EndPush() {
            if (!Speech.Recording && State != AssistantState.Listening) return;
            State = AssistantState.Recognizing;
            StatusText = "Розпізнаю";
            Raise();
            ThreadPool.QueueUserWorkItem(delegate {
                string heard = Speech.StopListen(Config);
                Post(delegate {
                    LastSttMs = Speech.LastMs;
                    if (string.IsNullOrEmpty(heard)) {
                        State = string.IsNullOrEmpty(Speech.LastError)
                            ? AssistantState.Ready : AssistantState.Error;
                        StatusText = string.IsNullOrEmpty(Speech.LastError)
                            ? "Готовий" : Speech.LastError;
                        ResultText = Speech.LastError;
                        Raise();
                        return;
                    }
                    pendingHeard = pendingHeard.Length == 0 ? heard : (pendingHeard + " " + heard);
                    HeardText = pendingHeard;
                    State = AssistantState.Reviewing;
                    StatusText = "Перевір текст або зачекай";
                    ResultText = "Можна виправити й натиснути «Надіслати зараз».";
                    Raise();
                    StartVoiceWait();
                });
            });
        }

        void StartVoiceWait() {
            StopVoiceWait();
            voiceWait = new System.Windows.Forms.Timer();
            voiceWait.Interval = Math.Max(300, Config.voiceEndMs);
            voiceWait.Tick += delegate {
                StopVoiceWait();
                if (State != AssistantState.Reviewing) return;
                string text = pendingHeard;
                pendingHeard = "";
                if (!string.IsNullOrWhiteSpace(text)) BeginRequest(text, "voice");
            };
            voiceWait.Start();
        }

        void StopVoiceWait() {
            if (voiceWait == null) return;
            try { voiceWait.Stop(); voiceWait.Dispose(); } catch { }
            voiceWait = null;
        }

        public void CancelPush() {
            Speech.CancelListen();
            if (State == AssistantState.Listening) {
                State = AssistantState.Ready;
                StatusText = "Готовий";
                Raise();
            }
        }

        public void CancelAll() {
            cancel = true;
            client.Cancel();
            StopVoiceWait();
            pendingHeard = "";
            Speech.CancelListen();
            Speech.StopSpeak();
            SttRuntime.Cancel();
            for (int i = 0; i < Cards.Count; i++) {
                if (Cards[i].status == StepStatus.Waiting || Cards[i].status == StepStatus.Running) {
                    Cards[i].status = StepStatus.Cancelled;
                    Cards[i].detail = "Скасовано";
                }
            }
            State = AssistantState.Ready;
            StatusText = "Скасовано";
            AssistantGuard.End();
            Raise();
        }

        public void TestModel() {
            State = AssistantState.Thinking;
            StatusText = "Перевіряю модель…";
            Raise();
            ThreadPool.QueueUserWorkItem(delegate {
                string detail;
                bool live = client.Probe(Config, 3000, out detail);
                string reply = "";
                bool chat = live && client.Chat(Config,
                    "Reply with exactly pong", "ping", 40000, out reply);
                Post(delegate {
                    if (!live) {
                        State = AssistantState.Error;
                        StatusText = "Модель недоступна";
                        ResultText = client.LastError;
                    } else if (!chat) {
                        State = AssistantState.Error;
                        StatusText = "Модель не відповіла";
                        ResultText = client.LastError;
                    } else {
                        State = AssistantState.Ready;
                        StatusText = "Модель відповідає";
                        ResultText = reply;
                        ModelLine = detail;
                    }
                    Raise();
                });
            });
        }

        void BeginRequest(string text, string source) {
            text = (text ?? "").Trim();
            if (text.Length == 0) return;
            if (!AssistantGuard.TryBegin(text)) {
                ResultText = "Вже виконую цей запит.";
                Raise();
                return;
            }
            cancel = false;
            int mine = Interlocked.Increment(ref token);
            HeardText = text;
            ResultText = "";
            Cards.Clear();
            State = AssistantState.Thinking;
            StatusText = "Обробляю";
            Raise();
            ThreadPool.QueueUserWorkItem(delegate {
                try {
                    AssistantPlan plan = AssistantIntents.Parse(text, Config, talk);
                    bool usedLlm = false;
                    string modelReply = "";
                    string validation = "";
                    if (plan.source == "ai" && plan.steps.Count == 0 &&
                        string.IsNullOrEmpty(plan.error)) {
                        string json;
                        string prompt = AssistantUnderstand.ModelUser(text, Config, talk);
                        if (!client.Chat(Config, AssistantIntents.ModelSystem, prompt, 50000, out json)) {
                            if (AssistantTrace.Enabled(Config))
                                AssistantTrace.Write(text, true, client.LastError, "llm-error", plan, "");
                            Post(delegate {
                                if (mine != token) return;
                                State = AssistantState.Error;
                                StatusText = "Модель зараз недоступна.";
                                ResultText = client.LastError;
                                AssistantLog.Add(text, source, client.LastError, false);
                                AssistantGuard.End();
                                Raise();
                            });
                            return;
                        }
                        usedLlm = true;
                        modelReply = json;
                        plan = AssistantIntents.FromModelJson(json);
                        plan = AssistantUnderstand.GuardPlan(text, plan);
                        validation = AssistantActions.ValidatePlan(plan, Config);
                        if (!string.IsNullOrEmpty(validation) && validation != "NEED_PROJECT") {
                            plan.steps.Clear();
                            plan.error = "Модель повернула невалідний план. Нічого не виконую. " + validation;
                        } else if (plan.steps.Count == 0 && string.IsNullOrEmpty(plan.error) &&
                            string.IsNullOrEmpty(plan.say) &&
                            plan.kind != "reply" && plan.kind != "clarify") {
                            plan.error = "Модель не запропонувала дозволену дію. Нічого не виконую.";
                        }
                    } else {
                        plan = AssistantUnderstand.GuardPlan(text, plan);
                    }
                    if (AssistantTrace.Enabled(Config))
                        AssistantTrace.Write(text, usedLlm, modelReply, validation, plan, "");
                    Post(delegate {
                        if (mine != token) return;
                        talk.Remember(text, plan);
                        RunPlan(text, source, plan);
                    });
                } catch (Exception ex) {
                    Post(delegate {
                        State = AssistantState.Error;
                        StatusText = "Помилка";
                        ResultText = ex.Message;
                        AssistantGuard.End();
                        Raise();
                    });
                }
            });
        }

        void RunPlan(string text, string source, AssistantPlan plan) {
            if (plan == null) {
                Finish(text, source, false, "Немає плану.");
                return;
            }
            if (!string.IsNullOrEmpty(plan.error) && plan.steps.Count == 0) {
                Finish(text, source, false, plan.error);
                return;
            }
            if ((plan.kind == "clarify" || plan.kind == "reply" || plan.kind == "unsupported") &&
                (plan.steps.Count == 0 || (plan.steps.Count == 1 && plan.steps[0].action == "AskClarify"))) {
                Finish(text, source, plan.kind != "unsupported",
                    plan.say.Length > 0 ? plan.say : "Потрібне уточнення.");
                return;
            }
            Cards.Clear();
            for (int i = 0; i < plan.steps.Count; i++) {
                Cards.Add(new AssistantCard {
                    title = plan.steps[i].action,
                    detail = plan.steps[i].query.Length > 0 ? plan.steps[i].query : plan.steps[i].url,
                    status = StepStatus.Waiting
                });
            }
            if (!string.IsNullOrEmpty(plan.say)) ResultText = plan.say;
            State = AssistantState.Running;
            StatusText = plan.say.Length > 0 ? plan.say : "Виконую";
            Raise();

            bool ok = true;
            var lines = new List<string>();
            Dictionary<string, bool> done = new Dictionary<string, bool>();
            for (int i = 0; i < plan.steps.Count; i++) {
                AssistantStep step = plan.steps[i];
                if (cancel) {
                    Cards[i].status = StepStatus.Cancelled;
                    lines.Add((i + 1) + ". " + step.action + " — скасовано");
                    ok = false;
                    break;
                }
                if (!string.IsNullOrEmpty(step.dependsOn) && done.ContainsKey(step.dependsOn) &&
                    !done[step.dependsOn] && !step.continueOnError) {
                    Cards[i].status = StepStatus.Cancelled;
                    lines.Add((i + 1) + ". " + step.action + " — пропущено: попередній крок не вдався");
                    continue;
                }
                Cards[i].status = StepStatus.Running;
                Raise();
                string err = RunStep(step);
                string id = string.IsNullOrEmpty(step.id) ? (i + 1).ToString() : step.id;
                if (string.IsNullOrEmpty(err)) {
                    Cards[i].status = StepStatus.Done;
                    Cards[i].detail = step.result;
                    done[id] = true;
                    lines.Add((i + 1) + ". " + LabelOf(step) + " — виконано: " + step.result);
                } else if (err == "NEED_PROJECT") {
                    Cards[i].status = StepStatus.Error;
                    done[id] = false;
                    ok = false;
                    lines.Add((i + 1) + ". " + step.action + " — помилка: немає папки проєкту");
                    if (!step.continueOnError) break;
                } else {
                    Cards[i].status = StepStatus.Error;
                    Cards[i].detail = err;
                    done[id] = false;
                    ok = false;
                    lines.Add((i + 1) + ". " + LabelOf(step) + " — помилка: " + err);
                    if (!step.continueOnError) break;
                }
                Raise();
            }
            string summary = string.Join(Environment.NewLine, lines.ToArray());
            if (string.IsNullOrEmpty(summary))
                summary = ok ? (plan.say.Length > 0 ? plan.say : "Готово") : "Помилка виконання.";
            Finish(text, source, ok, summary);
        }

        static string LabelOf(AssistantStep s) {
            if (s == null) return "дія";
            if (s.action == "OpenUrl") return "сайт";
            if (s.action == "SearchWeb") return "пошук";
            if (s.action == "SearchYouTube") return "YouTube";
            if (s.action == "OpenApplication") return "програма";
            if (s.action == "SetTimer") return "таймер";
            return s.action;
        }

        string RunStep(AssistantStep step) {
            string hooked = "";
            string err = AssistantActions.Execute(step, Config, delegate(AssistantStep s) {
                hooked = HandleHook(s);
                if (hooked != "HOOK" && !string.IsNullOrEmpty(hooked) &&
                    hooked.IndexOf("помил", StringComparison.OrdinalIgnoreCase) < 0 &&
                    hooked != "NEED_PROJECT") {
                    s.result = hooked;
                    s.status = StepStatus.Done;
                }
            });
            if (err == "HOOK") err = hooked == "HOOK" ? HandleHook(step) : hooked;
            if (string.IsNullOrEmpty(err) || err == "HOOK") {
                if (string.IsNullOrEmpty(step.result))
                    step.result = hooked.Length > 0 && hooked != "HOOK" ? hooked : "Готово";
                return "";
            }
            return err;
        }

        string HandleHook(AssistantStep step) {
            if (step.action == "SetTimer") {
                StartTimer(step.seconds);
                step.result = "Таймер " + step.seconds + " с";
                return step.result;
            }
            if (step.action == "OpenSettings") {
                try {
                    File.WriteAllText(
                        Path.Combine(FoxPaths.RuntimeDir(), "foxnodes.signal"),
                        string.Equals(step.name, "editor", StringComparison.OrdinalIgnoreCase)
                            ? "settings" : "settings");
                } catch { }
                string fox = Path.Combine(FoxPaths.RuntimeDir(), "foxstyle.exe");
                if (File.Exists(fox)) {
                    try {
                        System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(fox) {
                            UseShellExecute = true
                        });
                    } catch { }
                }
                step.result = "Відкриваю редактор";
                return step.result;
            }
            if (step.action == "FindLauncherItem") {
                string found = FindNode(step.name);
                step.result = found;
                return found.StartsWith("Не ") ? found : found;
            }
            if (step.action == "RunWorkflow") {
                return RunNamedWorkflow(step.name);
            }
            if (step.action == "SetTheme") {
                ApplyFoxTheme(step.theme);
                step.result = "Тему передано в FOXSTYLE";
                return step.result;
            }
            return "HOOK";
        }

        string FindNode(string name) {
            if (nodes == null || nodes.Config == null) return "Меню порожнє.";
            MenuNodeSpec hit = FindByTitle(nodes.Config.categories, name);
            if (hit == null) return "Не знайшов «" + name + "» у меню чи серед установлених програм.";
            if (hit.action == null) return "Знайшов «" + hit.title + "», але дії немає.";
            if (AssistantActions.DryRun) return "Запустив би «" + hit.title + "».";
            string err = runner != null ? runner.Run(hit.action, null) : "Немає виконавця.";
            if (!string.IsNullOrEmpty(err)) return err;
            return "Запущено «" + hit.title + "».";
        }

        static MenuNodeSpec FindByTitle(List<MenuNodeSpec> nodes, string name) {
            if (nodes == null) return null;
            string n = AssistantGuard.Normalize(name);
            for (int i = 0; i < nodes.Count; i++) {
                if (nodes[i] == null) continue;
                if (AssistantGuard.Normalize(nodes[i].title).IndexOf(n, StringComparison.Ordinal) >= 0)
                    return nodes[i];
                MenuNodeSpec child = FindByTitle(nodes[i].children, name);
                if (child != null) return child;
            }
            return null;
        }

        string RunNamedWorkflow(string name) {
            if (Config.workflows == null) return "Немає сценаріїв.";
            for (int i = 0; i < Config.workflows.Count; i++) {
                if (!string.Equals(Config.workflows[i].name, name, StringComparison.OrdinalIgnoreCase))
                    continue;
                List<AssistantStep> steps = Config.workflows[i].steps;
                for (int s = 0; s < steps.Count; s++) {
                    string err = RunStep(steps[s]);
                    if (!string.IsNullOrEmpty(err)) return err;
                }
                return "Сценарій виконано";
            }
            return "Сценарій не знайдено.";
        }

        void ApplyFoxTheme(string theme) {
            if (runner == null) throw new InvalidOperationException("Немає виконавця.");
            string err = runner.Run(new MenuActionSpec {
                kind = "foxCommand",
                command = "sw -" + theme
            }, null);
            if (!string.IsNullOrEmpty(err)) throw new InvalidOperationException(err);
        }

        void StartTimer(int seconds) {
            timerUntil = DateTime.UtcNow.AddSeconds(seconds);
            if (timerClock == null) {
                timerClock = new System.Windows.Forms.Timer();
                timerClock.Interval = 500;
                timerClock.Tick += delegate {
                    if (DateTime.UtcNow >= timerUntil) {
                        timerClock.Stop();
                        ResultText = "Таймер.";
                        StatusText = "Таймер завершено";
                        if (Config.speakConfirmations) Speech.Speak(Config, "Timer done");
                        FoxToast.Show("Помічник · таймер");
                        Raise();
                    }
                };
            }
            timerClock.Start();
        }

        void Finish(string text, string source, bool ok, string result) {
            ResultText = result ?? "";
            State = ok ? AssistantState.Ready : AssistantState.Error;
            StatusText = ok ? (result ?? "Готово") : (result ?? "Помилка");
            if (AssistantTrace.Enabled(Config))
                AssistantTrace.Write(text, false, "", "finish", null,
                    (ok ? "ok " : "fail ") + (result ?? ""));
            AssistantLog.Add(text, source, ResultText, ok);
            AssistantGuard.End();
            if (ok && Config.speakConfirmations && !Speech.Recording)
                Speech.Speak(Config, LatinSafe(ResultText));
            Raise();
        }

        static string LatinSafe(string text) {
            if (string.IsNullOrEmpty(text)) return "";
            if (AssistantSpeech.HasUkrainianVoice()) return text;
            if (text.IndexOf("Google", StringComparison.OrdinalIgnoreCase) >= 0) return "Opening Google";
            if (text.IndexOf("пошук", StringComparison.OrdinalIgnoreCase) >= 0) return "Search opened";
            if (text.IndexOf("YouTube", StringComparison.OrdinalIgnoreCase) >= 0) return "Opening YouTube";
            return "Done";
        }

        void Post(Action a) {
            if (ui != null) ui.Post(delegate { a(); }, null);
            else a();
        }

        void Raise() {
            if (Changed != null) Changed();
        }

        public void Dispose() {
            cancel = true;
            client.Cancel();
            Speech.Dispose();
            StopVoiceWait();
            SttRuntime.StopServer();
            if (timerClock != null) timerClock.Dispose();
        }
    }
}
