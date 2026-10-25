using System;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using FoxOs.Sdk;

namespace FoxOs.Assistant {

    public enum AssistantState {
        Ready, Listening, Recognizing, Reviewing, Thinking, Running, Speaking, Error
    }

    public enum StepStatus {
        Waiting, Running, Done, Error, Cancelled
    }

    public sealed class AssistantConfig {
        public int revision = 1;
        public string runtime = "ollama";
        public string url = "http://127.0.0.1:11434/api/chat";
        public string tagsUrl = "http://127.0.0.1:11434/api/tags";
        public string model = "gemma3:1b";
        public string micName = "";
        public string sttCulture = "uk";
        public string sttModel = "large-v3-turbo-q8_0";
        public string sttDevice = "cpu";
        public string sttLanguage = "uk";
        public bool sttEnabled = true;
        public string ttsVoice = "";
        public bool ttsEnabled = false;
        public int ttsVolume = 80;
        public int ttsRate = 0;
        public bool speakConfirmations = false;
        public bool pttEnabled = true;
        public bool ctrl = true, alt = true, shift = false, win = false;
        public string pttKey = "J";
        public string language = "uk";
        public string projectPath = "";
        public bool allowSearch = true;
        public bool allowApps = true;
        public bool allowFolders = true;
        public bool allowTimer = true;
        public bool allowNotes = true;
        public bool allowTheme = true;
        public bool allowWorkflows = true;
        public int voiceEndMs = 900;
        public bool debugTrace = false;
        public List<AssistantWorkflow> workflows = new List<AssistantWorkflow>();
        public List<AssistantAlias> aliases = new List<AssistantAlias>();
    }

    public sealed class AssistantWorkflow {
        public string name = "";
        public List<AssistantStep> steps = new List<AssistantStep>();
    }

    public sealed class AssistantStep {
        public string action = "";
        public string query = "";
        public string url = "";
        public string path = "";
        public string name = "";
        public string text = "";
        public string theme = "";
        public int seconds = 0;
        public string say = "";
        public string id = "";
        public string browser = "";
        public string dependsOn = "";
        public bool continueOnError;
        public StepStatus status = StepStatus.Waiting;
        public string result = "";
    }

    public sealed class AssistantPlan {
        public string say = "";
        public string source = "local";
        public string kind = "plan";
        public string handler = "";
        public List<AssistantStep> steps = new List<AssistantStep>();
        public string error = "";
        public bool needsClarify;
    }

    public sealed class AssistantLogItem {
        public string utc = "";
        public string text = "";
        public string source = "";
        public string result = "";
        public bool ok;
    }

    public sealed class MicInfo {
        public int index;
        public string name = "";
        public bool preferred;
    }

    public static class AssistantPaths {
        public static string ConfigPath {
            get { return Path.Combine(FoxPaths.RuntimeDir(), "assistant.json"); }
        }
        public static string LogPath {
            get { return Path.Combine(FoxPaths.RuntimeDir(), "assistant-log.json"); }
        }
        public static string NotesPath {
            get {
                string user = "local";
                try {
                    string f = Path.Combine(FoxPaths.CmdDir, "current_user.txt");
                    if (File.Exists(f)) {
                        string t = File.ReadAllText(f).Trim();
                        if (t.Length > 0) user = t;
                    }
                } catch { }
                string dir = Path.Combine(FoxPaths.CmdDir, "notes", user);
                try { Directory.CreateDirectory(dir); } catch { }
                return Path.Combine(dir, "assistant.md");
            }
        }
    }

    public static class AssistantStore {
        public static AssistantConfig Load() {
            AssistantConfig c = FoxJson.FileLoad<AssistantConfig>(AssistantPaths.ConfigPath, null);
            if (c == null) c = new AssistantConfig();
            Normalize(c);
            return c;
        }

        public static void Save(AssistantConfig c) {
            if (c == null) return;
            Normalize(c);
            FoxJson.FileSave(AssistantPaths.ConfigPath, c);
        }

        public static void Normalize(AssistantConfig c) {
            if (c == null) return;
            if (string.IsNullOrEmpty(c.url)) c.url = "http://127.0.0.1:11434/api/chat";
            if (string.IsNullOrEmpty(c.tagsUrl)) c.tagsUrl = "http://127.0.0.1:11434/api/tags";
            if (string.IsNullOrEmpty(c.model)) c.model = "gemma3:1b";
            if (c.workflows == null) c.workflows = new List<AssistantWorkflow>();
            if (c.aliases == null) c.aliases = new List<AssistantAlias>();
            if (c.voiceEndMs < 300) c.voiceEndMs = 300;
            if (c.voiceEndMs > 4000) c.voiceEndMs = 4000;
            if (c.revision < 1) c.revision = 1;
            if (string.IsNullOrEmpty(c.pttKey)) c.pttKey = "J";
            if (string.IsNullOrEmpty(c.sttLanguage)) c.sttLanguage = "uk";
            if (string.IsNullOrEmpty(c.sttModel)) c.sttModel = "large-v3-turbo-q8_0";
            if (string.IsNullOrEmpty(c.sttDevice)) c.sttDevice = "cpu";
            if (string.IsNullOrEmpty(c.language)) c.language = "uk";
            c.ttsVolume = Clamp(c.ttsVolume, 0, 100);
            c.ttsRate = Clamp(c.ttsRate, -10, 10);
        }

        static int Clamp(int v, int lo, int hi) {
            if (v < lo) return lo;
            if (v > hi) return hi;
            return v;
        }
    }

    public sealed class AssistantClient {
        public string LastError = "";
        public bool LastOk;
        volatile bool cancel;
        HttpWebRequest current;

        public void Cancel() {
            cancel = true;
            try {
                if (current != null) current.Abort();
            } catch { }
        }

        public bool Probe(AssistantConfig cfg, int timeoutMs, out string detail) {
            detail = "";
            LastOk = false;
            LastError = "";
            if (cfg == null) { LastError = "Немає конфігурації."; return false; }
            try {
                HttpWebRequest req = (HttpWebRequest)WebRequest.Create(cfg.tagsUrl);
                req.Method = "GET";
                req.Timeout = Math.Max(400, timeoutMs);
                req.ReadWriteTimeout = req.Timeout;
                using (WebResponse resp = req.GetResponse())
                using (StreamReader sr = new StreamReader(resp.GetResponseStream(), Encoding.UTF8)) {
                    string json = sr.ReadToEnd();
                    if (json.IndexOf(cfg.model, StringComparison.OrdinalIgnoreCase) < 0) {
                        LastError = "Runtime доступний, модель «" + cfg.model + "» не в списку.";
                        detail = LastError;
                        return false;
                    }
                    LastOk = true;
                    detail = "Ollama · " + cfg.model + " · loopback";
                    return true;
                }
            } catch (Exception ex) {
                LastError = "Модель недоступна: " + Short(ex);
                detail = LastError;
                return false;
            }
        }

        public bool Chat(AssistantConfig cfg, string system, string user, int timeoutMs, out string reply) {
            reply = "";
            LastOk = false;
            LastError = "";
            cancel = false;
            if (cfg == null) { LastError = "Немає конфігурації."; return false; }
            try {
                string body = "{\"model\":\"" + Esc(cfg.model) + "\",\"stream\":false,\"keep_alive\":\"10m\","
                    + "\"options\":{\"temperature\":0.1,\"num_predict\":260},"
                    + "\"messages\":["
                    + "{\"role\":\"system\",\"content\":\"" + Esc(system) + "\"},"
                    + "{\"role\":\"user\",\"content\":\"" + Esc(user) + "\"}]}";
                current = (HttpWebRequest)WebRequest.Create(cfg.url);
                current.Method = "POST";
                current.ContentType = "application/json; charset=utf-8";
                current.Accept = "application/json";
                current.Timeout = Math.Max(2000, timeoutMs);
                current.ReadWriteTimeout = current.Timeout;
                byte[] bytes = Encoding.UTF8.GetBytes(body);
                current.ContentLength = bytes.Length;
                using (Stream s = current.GetRequestStream()) s.Write(bytes, 0, bytes.Length);
                if (cancel) { LastError = "Скасовано."; return false; }
                using (WebResponse resp = current.GetResponse())
                using (StreamReader sr = new StreamReader(resp.GetResponseStream(), Encoding.UTF8)) {
                    string json = sr.ReadToEnd();
                    Match m = Regex.Match(json, "\"content\"\\s*:\\s*\"((?:\\\\.|[^\"])*)\"");
                    if (!m.Success) {
                        LastError = "Модель відповіла без тексту.";
                        return false;
                    }
                    reply = Unesc(m.Groups[1].Value).Trim();
                    if (reply.Length == 0) {
                        LastError = "Порожня відповідь моделі.";
                        return false;
                    }
                    LastOk = true;
                    return true;
                }
            } catch (Exception ex) {
                if (cancel) { LastError = "Скасовано."; return false; }
                LastError = "Помилка моделі: " + Short(ex);
                return false;
            } finally {
                current = null;
            }
        }

        static string Short(Exception ex) {
            if (ex == null) return "невідома помилка";
            if (ex is WebException) return "немає відповіді runtime (127.0.0.1)";
            string m = ex.Message ?? "";
            if (m.Length > 140) m = m.Substring(0, 140);
            return m;
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

    public static class AssistantUrl {
        public static string GoogleHome { get { return "https://www.google.com/"; } }
        public static string GoogleSearch(string query) {
            return "https://www.google.com/search?q=" + Encode(query);
        }
        public static string YoutubeSearch(string query) {
            return "https://www.youtube.com/results?search_query=" + Encode(query);
        }
        public static string Encode(string query) {
            return Uri.EscapeDataString(query ?? "");
        }
        public static bool TryHttpUrl(string raw, out string url) {
            url = "";
            if (string.IsNullOrWhiteSpace(raw)) return false;
            string t = raw.Trim().Trim('"', '\'');
            if (t.IndexOf(' ') >= 0) return false;
            if (!t.StartsWith("http://", StringComparison.OrdinalIgnoreCase) &&
                !t.StartsWith("https://", StringComparison.OrdinalIgnoreCase)) {
                if (LooksLikeHost(t)) t = "https://" + t;
                else return false;
            }
            Uri uri;
            if (!Uri.TryCreate(t, UriKind.Absolute, out uri)) return false;
            if (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)
                return false;
            url = uri.AbsoluteUri;
            return true;
        }
        public static bool LooksLikeHost(string t) {
            if (string.IsNullOrEmpty(t) || t.IndexOf('.') < 0) return false;
            return Regex.IsMatch(t, @"^(?i)[a-z0-9][a-z0-9.-]+\.[a-z]{2,}(/.*)?$");
        }
    }

    public static class AssistantGuard {
        static string lastKey = "";
        static DateTime lastAt = DateTime.MinValue;
        static int inflight;

        public static bool TryBegin(string text) {
            string key = Normalize(text);
            if (key.Length == 0) return false;
            if (Interlocked.CompareExchange(ref inflight, 1, 0) != 0) return false;
            if (key == lastKey && (DateTime.UtcNow - lastAt).TotalMilliseconds < 1600) {
                Interlocked.Exchange(ref inflight, 0);
                return false;
            }
            lastKey = key;
            lastAt = DateTime.UtcNow;
            return true;
        }

        public static void End() {
            Interlocked.Exchange(ref inflight, 0);
        }

        public static void Reset() {
            lastKey = "";
            lastAt = DateTime.MinValue;
            Interlocked.Exchange(ref inflight, 0);
        }

        public static string Normalize(string text) {
            if (text == null) return "";
            string t = text.Trim().ToLowerInvariant();
            t = Regex.Replace(t, @"\s+", " ");
            return t;
        }
    }

    public static class AssistantIntents {
        static readonly string[] OpenWords = { "відкрий", "открой", "open", "запусти", "start", "launch" };
        static readonly string[] SearchWords = { "знайди", "пошукай", "погугли", "пошук", "search", "google", "find" };

        public static AssistantPlan Parse(string text, AssistantConfig cfg) {
            return Parse(text, cfg, null);
        }

        public static AssistantPlan Parse(string text, AssistantConfig cfg, AssistantTalk talk) {
            return AssistantUnderstand.Build(text, cfg, talk);
        }

        public static AssistantPlan FromModelJson(string json) {
            var plan = new AssistantPlan { source = "ai" };
            if (string.IsNullOrWhiteSpace(json)) {
                plan.error = "Модель не повернула JSON.";
                return plan;
            }
            string slice = ExtractJson(json);
            try {
                var bag = FoxJson.Load<Dictionary<string, object>>(slice);
                if (bag == null) {
                    plan.error = "Невірний JSON від моделі.";
                    return plan;
                }
                if (bag.ContainsKey("say") && bag["say"] != null)
                    plan.say = Convert.ToString(bag["say"]);
                if (bag.ContainsKey("kind") && bag["kind"] != null)
                    plan.kind = Convert.ToString(bag["kind"]);
                object stepsObj;
                if (bag.TryGetValue("steps", out stepsObj)) {
                    IList arr = stepsObj as IList;
                    if (arr != null) {
                        for (int i = 0; i < arr.Count; i++) {
                            var row = arr[i] as Dictionary<string, object>;
                            if (row == null) continue;
                            if (IsAnswerAction(Str(row, "action"))) {
                                plan.kind = "reply";
                                if (string.IsNullOrEmpty(plan.say))
                                    plan.say = FirstNonEmpty(Str(row, "text"), Str(row, "say"));
                                continue;
                            }
                            AssistantStep s = StepFromBag(row);
                            if (s != null) plan.steps.Add(s);
                        }
                    }
                }
                if (plan.steps.Count == 0 && bag.ContainsKey("action")) {
                    AssistantStep one = StepFromBag(bag);
                    if (one != null) plan.steps.Add(one);
                    else if (IsAnswerAction(Str(bag, "action"))) {
                        plan.kind = "reply";
                        if (string.IsNullOrEmpty(plan.say))
                            plan.say = FirstNonEmpty(Str(bag, "text"), Str(bag, "say"));
                    }
                }
                if (!string.IsNullOrEmpty(plan.kind) && plan.kind.IndexOf('|') >= 0) {
                    if (plan.steps.Count > 0) plan.kind = "plan";
                    else if (!string.IsNullOrEmpty(plan.say)) plan.kind = "reply";
                    else plan.kind = "clarify";
                }
                if (string.Equals(plan.kind, "clarify", StringComparison.OrdinalIgnoreCase))
                    plan.needsClarify = true;
                if (string.Equals(plan.kind, "unsupported", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(plan.kind, "reply", StringComparison.OrdinalIgnoreCase)) {
                    if (plan.steps.Count == 0 && string.IsNullOrEmpty(plan.say))
                        plan.say = "Це я ще не вмію.";
                }
            } catch {
                plan.error = "Невірний JSON від моделі.";
            }
            return plan;
        }

        static AssistantStep StepFromBag(Dictionary<string, object> row) {
            if (row == null) return null;
            var s = new AssistantStep();
            s.action = MapAction(Str(row, "action"), Str(row, "service"));
            s.query = Str(row, "query");
            s.url = Str(row, "url");
            s.path = Str(row, "path");
            s.name = Str(row, "name");
            s.text = Str(row, "text");
            s.theme = Str(row, "theme");
            s.say = Str(row, "say");
            s.id = Str(row, "id");
            s.browser = Str(row, "browser");
            s.dependsOn = Str(row, "dependsOn");
            string cont = Str(row, "continueOnError");
            s.continueOnError = cont == "1" || cont == "true";
            int sec;
            if (int.TryParse(Str(row, "seconds"), out sec)) s.seconds = sec;
            if (s.action == "SearchYouTube" && string.IsNullOrEmpty(s.url) &&
                !string.IsNullOrEmpty(s.query))
                s.url = AssistantUrl.YoutubeSearch(s.query);
            if (s.action == "SearchWeb" && string.IsNullOrEmpty(s.url) &&
                !string.IsNullOrEmpty(s.query))
                s.url = AssistantUrl.GoogleSearch(s.query);
            if (!AssistantActions.IsKnown(s.action)) return null;
            return s;
        }

        static string MapAction(string action, string service) {
            string a = AssistantGuard.Normalize(action);
            string svc = AssistantGuard.Normalize(service);
            if (a == "openwebsite" || a == "open_url") return "OpenUrl";
            if (a == "searchwebsite" || a == "search_website") {
                if (svc.IndexOf("youtube", StringComparison.Ordinal) >= 0 ||
                    svc.IndexOf("ютуб", StringComparison.Ordinal) >= 0)
                    return "SearchYouTube";
                return "SearchWeb";
            }
            if (a == "searchweb") return "SearchWeb";
            if (a == "clarify") return "AskClarify";
            if (a == "openapplication" || a == "open_application") return "OpenApplication";
            return action ?? "";
        }

        static bool IsAnswerAction(string action) {
            string a = AssistantGuard.Normalize(action);
            return a == "answer" || a == "reply";
        }

        static string FirstNonEmpty(string a, string b) {
            if (!string.IsNullOrEmpty(a)) return a;
            return b ?? "";
        }

        static string Str(Dictionary<string, object> row, string key) {
            object v;
            if (row == null || !row.TryGetValue(key, out v) || v == null) return "";
            return Convert.ToString(v) ?? "";
        }

        static string ExtractJson(string text) {
            int a = text.IndexOf('{');
            int b = text.LastIndexOf('}');
            if (a >= 0 && b > a) return text.Substring(a, b - a + 1);
            return text;
        }

        static List<string> SplitCompound(string text) {
            var parts = new List<string>();
            string[] seps = { " і знайди ", " і відкрий ", " та знайди ", " та відкрий ",
                " and search ", " and open ", " then " };
            string remain = text;
            while (true) {
                int best = -1, len = 0;
                for (int i = 0; i < seps.Length; i++) {
                    int p = IndexOfWord(remain, seps[i]);
                    if (p >= 0 && (best < 0 || p < best)) { best = p; len = seps[i].Length; }
                }
                if (best < 0) { parts.Add(remain.Trim()); break; }
                string left = remain.Substring(0, best).Trim();
                if (left.Length > 0) parts.Add(left);
                remain = remain.Substring(best + len);
            }
            return parts;
        }

        static int IndexOfWord(string text, string sep) {
            return text.IndexOf(sep, StringComparison.OrdinalIgnoreCase);
        }

        static AssistantStep ParseOne(string text, AssistantConfig cfg) {
            string n = AssistantGuard.Normalize(text);
            if (n.Length == 0) return null;

            if (Is(n, "відкрий google") || Is(n, "open google") ||
                Is(n, "відкрий гугл") || n == "google")
                return Step("OpenUrl", null, AssistantUrl.GoogleHome);

            if (LooksYoutube(n)) {
                string q = StripLead(text, new[] {
                    "знайди відео про", "знайди відео", "пошукай відео",
                    "find video", "search youtube", "на youtube", "youtube"
                });
                q = StripTail(q, new[] { "на youtube", "on youtube", "в youtube" });
                if (q.Length == 0) return null;
                return Step("SearchYouTube", q, AssistantUrl.YoutubeSearch(q));
            }

            if (LooksGoogleSearch(n)) {
                string q = StripLead(text, new[] {
                    "знайди в google", "знайди в гугл", "погугли", "пошукай в google",
                    "search google for", "google", "знайди", "пошукай", "find"
                });
                if (q.Length == 0) return Step("OpenUrl", null, AssistantUrl.GoogleHome);
                return Step("SearchWeb", q, AssistantUrl.GoogleSearch(q));
            }

            string url;
            if (TryExtractUrl(text, out url))
                return Step("OpenUrl", null, url);

            if (LooksChrome(n))
                return Step("OpenApplication", "chrome", null);

            if (LooksEditor(n))
                return Step("OpenSettings", "editor", null);

            if (LooksSettings(n))
                return Step("OpenSettings", "settings", null);

            if (LooksProject(n))
                return Step("OpenFolder", "project", (cfg != null ? cfg.projectPath : null));

            int seconds;
            if (TryTimer(n, text, out seconds)) {
                var t = Step("SetTimer", null, null);
                t.seconds = seconds;
                return t;
            }

            string note;
            if (TryNote(n, text, out note)) {
                var s = Step("CreateNote", null, null);
                s.text = note;
                return s;
            }

            string theme;
            if (TryTheme(n, out theme)) {
                var s = Step("SetTheme", null, null);
                s.theme = theme;
                return s;
            }

            string wf;
            if (TryWorkflow(n, cfg, out wf)) {
                var s = Step("RunWorkflow", null, null);
                s.name = wf;
                return s;
            }

            if (StartsAny(n, OpenWords) || StartsAny(n, SearchWords)) {
                string rest = StripLead(text, Concat(OpenWords, SearchWords));
                if (rest.Length > 0) {
                    var find = Step("FindLauncherItem", rest, null);
                    find.name = rest;
                    return find;
                }
            }
            return null;
        }

        static bool LooksYoutube(string n) {
            bool venue = Regex.IsMatch(n,
                @"(?:на|в|у|on)\s+(youtube|ютуб\w*)|(youtube|ютуб\w*)\s+(search|пошук)",
                RegexOptions.CultureInvariant);
            bool search = n.Contains("знайди") || n.Contains("пошукай") ||
                n.Contains("відео про") || n.Contains("search");
            return venue && search;
        }
        static bool LooksGoogleSearch(string n) {
            return n.Contains("погугли") || n.Contains("в google") || n.Contains("в гугл") ||
                n.StartsWith("знайди ") || n.StartsWith("пошукай ") ||
                n.StartsWith("search ") || n.StartsWith("google ");
        }
        static bool LooksChrome(string n) {
            return n.Contains("chrome") || n.Contains("хром");
        }
        static bool LooksEditor(string n) {
            return n.Contains("редактор") || n.Contains("foxstyle") || n.Contains("node editor");
        }
        static bool LooksSettings(string n) {
            return n.Contains("налаштування") || n.Contains("settings");
        }
        static bool LooksProject(string n) {
            return n.Contains("мій проєкт") || n.Contains("мій проект") ||
                n.Contains("my project") || n.Contains("проєкт");
        }

        static bool TryTimer(string n, string raw, out int seconds) {
            seconds = 0;
            if (!n.Contains("таймер") && !n.Contains("timer")) return false;
            Match m = Regex.Match(raw, @"(\d+)\s*(хв|хвилин|min|minutes|сек|секунд|sec|s)?",
                RegexOptions.IgnoreCase);
            if (!m.Success) { seconds = 60; return true; }
            int v = int.Parse(m.Groups[1].Value);
            string u = m.Groups[2].Value.ToLowerInvariant();
            if (u.StartsWith("сек") || u == "s" || u.StartsWith("sec")) seconds = v;
            else seconds = v * 60;
            if (seconds < 1) seconds = 60;
            if (seconds > 3600) seconds = 3600;
            return true;
        }

        static bool TryNote(string n, string raw, out string note) {
            note = "";
            string[] keys = { "нотатка", "запиши", "note", "запам'ятай", "запам’ятай" };
            for (int i = 0; i < keys.Length; i++) {
                int p = n.IndexOf(keys[i], StringComparison.Ordinal);
                if (p < 0) continue;
                note = StripLead(raw, keys).Trim();
                if (note.Length == 0) note = raw;
                return true;
            }
            return false;
        }

        static bool TryTheme(string n, out string theme) {
            theme = "";
            if (!n.Contains("тем") && !n.Contains("theme")) return false;
            string[] names = { "dark", "light", "neon", "foxpurple", "slate", "orange" };
            for (int i = 0; i < names.Length; i++)
                if (n.Contains(names[i])) { theme = names[i]; return true; }
            if (n.Contains("темн")) { theme = "dark"; return true; }
            if (n.Contains("світл")) { theme = "light"; return true; }
            return false;
        }

        static bool TryWorkflow(string n, AssistantConfig cfg, out string name) {
            name = "";
            if (cfg == null || cfg.workflows == null) return false;
            for (int i = 0; i < cfg.workflows.Count; i++) {
                string w = cfg.workflows[i].name ?? "";
                if (w.Length > 0 && n.Contains(w.ToLowerInvariant())) {
                    name = w; return true;
                }
            }
            return n.Contains("сценарій") || n.Contains("workflow");
        }

        public static bool TryExtractHost(string text, out string url) {
            return TryExtractUrl(text, out url);
        }

        static bool TryExtractUrl(string text, out string url) {
            url = "";
            Match m = Regex.Match(text ?? "",
                @"(?i)\b((https?://)?([a-z0-9-]+\.)+[a-z]{2,}(/[^\s]*)?)\b");
            if (!m.Success) return false;
            return AssistantUrl.TryHttpUrl(m.Groups[1].Value, out url);
        }

        static AssistantStep Step(string action, string query, string url) {
            return new AssistantStep { action = action, query = query ?? "", url = url ?? "" };
        }
        static bool Is(string n, string v) { return n == v; }
        static bool StartsAny(string n, string[] words) {
            for (int i = 0; i < words.Length; i++)
                if (n.StartsWith(words[i] + " ") || n == words[i]) return true;
            return false;
        }
        static string[] Concat(string[] a, string[] b) {
            var r = new string[a.Length + b.Length];
            a.CopyTo(r, 0); b.CopyTo(r, a.Length);
            return r;
        }
        static string StripLead(string text, string[] keys) {
            string t = text ?? "";
            string lower = t.ToLowerInvariant();
            int best = -1, len = 0;
            for (int i = 0; i < keys.Length; i++) {
                int p = lower.IndexOf(keys[i], StringComparison.Ordinal);
                if (p == 0 && keys[i].Length > len) { best = 0; len = keys[i].Length; }
            }
            if (best == 0) t = t.Substring(len).Trim(' ', ',', '.', ':', '-', '—');
            return t.Trim();
        }
        static string StripTail(string text, string[] keys) {
            string t = text ?? "";
            string lower = t.ToLowerInvariant();
            for (int i = 0; i < keys.Length; i++) {
                if (lower.EndsWith(keys[i]))
                    return t.Substring(0, t.Length - keys[i].Length).Trim();
            }
            return t;
        }
        public static string SayOne(AssistantStep s) {
            return DefaultSay(s);
        }

        static string DefaultSay(AssistantStep s) {
            if (s == null) return "";
            if (s.action == "OpenUrl" && s.url == AssistantUrl.GoogleHome) return "Відкриваю Google.";
            if (s.action == "OpenUrl" && !string.IsNullOrEmpty(s.url) &&
                s.url.IndexOf("youtube.com", StringComparison.OrdinalIgnoreCase) >= 0 &&
                s.url.IndexOf("search_query", StringComparison.OrdinalIgnoreCase) < 0)
                return "Відкриваю YouTube.";
            if (s.action == "OpenUrl" && !string.IsNullOrEmpty(s.url) &&
                s.url.IndexOf("github.com", StringComparison.OrdinalIgnoreCase) >= 0)
                return "Відкриваю GitHub.";
            if (s.action == "SearchWeb") return "Відкриваю пошук.";
            if (s.action == "SearchYouTube")
                return s.query.Length > 0 ? ("Шукаю на YouTube «" + s.query + "».") : "Шукаю на YouTube.";
            if (s.action == "OpenApplication") return "Запускаю програму.";
            if (s.action == "SetTimer") return "Ставлю таймер.";
            if (s.action == "CreateNote") return "Записую нотатку.";
            return "Виконую.";
        }

        public static string ModelSystem {
            get {
                return "Ти планувальник FOXSTYLE. Відповідь — один JSON, без markdown і без інших дій. "
                    + "kind лише одне слово: plan або reply або clarify або unsupported. "
                    + "Приклади: "
                    + "{\"kind\":\"plan\",\"say\":\"Відкриваю YouTube.\",\"steps\":[{\"id\":\"1\",\"action\":\"OpenUrl\",\"url\":\"https://www.youtube.com/\"}]} "
                    + "{\"kind\":\"plan\",\"say\":\"Шукаю.\",\"steps\":[{\"id\":\"1\",\"action\":\"SearchWeb\",\"query\":\"чому YouTube не працює\"}]} "
                    + "{\"kind\":\"plan\",\"say\":\"Шукаю на YouTube.\",\"steps\":[{\"id\":\"1\",\"action\":\"SearchYouTube\",\"query\":\"налаштування MikroTik\"}]} "
                    + "{\"kind\":\"reply\",\"say\":\"YouTube — відеохостинг.\",\"steps\":[]} "
                    + "{\"kind\":\"reply\",\"say\":\"Так, можу, але зараз не відкриваю.\",\"steps\":[]} "
                    + "Назва сервісу ≠ відкрити його. 1–2 кроки. Не копіюй перелік kind. "
                    + "Не вигадуй домени. Не давай shell.";
            }
        }
    }

    public static class AssistantActions {
        public static bool DryRun;
        public static readonly List<string> DryLog = new List<string>();

        public static void BeginDry() {
            DryRun = true;
            DryLog.Clear();
        }
        public static void EndDry() {
            DryRun = false;
        }

        public static readonly string[] Known = new[] {
            "OpenUrl","SearchWeb","SearchYouTube","OpenApplication","OpenFolder",
            "SetTimer","CreateNote","SetTheme","RunWorkflow","OpenSettings",
            "FindLauncherItem","AskClarify"
        };

        public static bool IsKnown(string action) {
            if (string.IsNullOrEmpty(action)) return false;
            for (int i = 0; i < Known.Length; i++)
                if (string.Equals(Known[i], action, StringComparison.OrdinalIgnoreCase))
                    return true;
            return false;
        }

        public static string Validate(AssistantStep step, AssistantConfig cfg) {
            if (step == null) return "Порожня дія.";
            if (!IsKnown(step.action)) return "Невідома дія: " + step.action;
            string a = step.action;
            if (a == "OpenUrl") {
                string url;
                if (!AssistantUrl.TryHttpUrl(step.url, out url)) return "Некоректне посилання.";
                step.url = url;
            }
            if ((a == "SearchWeb" || a == "SearchYouTube") &&
                string.IsNullOrWhiteSpace(step.query) && string.IsNullOrWhiteSpace(step.url))
                return "Порожній пошуковий запит.";
            if (a == "OpenFolder" && step.path == "project") {
                if (cfg == null || string.IsNullOrWhiteSpace(cfg.projectPath))
                    return "NEED_PROJECT";
                step.path = cfg.projectPath;
            }
            if (a == "OpenFolder" && !string.IsNullOrWhiteSpace(step.path) &&
                step.path != "project" && !Directory.Exists(step.path) && !File.Exists(step.path))
                return "Шлях не існує.";
            if (a == "SetTimer" && step.seconds < 1) step.seconds = 60;
            if (a == "CreateNote" && string.IsNullOrWhiteSpace(step.text))
                return "Порожня нотатка.";
            if (a == "SetTheme" && string.IsNullOrWhiteSpace(step.theme))
                return "Не вказано тему.";
            return "";
        }

        public static string ValidatePlan(AssistantPlan plan, AssistantConfig cfg) {
            if (plan == null) return "Немає плану.";
            if (!string.IsNullOrEmpty(plan.error)) return plan.error;
            if (plan.steps == null || plan.steps.Count == 0) return "";
            for (int i = 0; i < plan.steps.Count; i++) {
                string err = Validate(plan.steps[i], cfg);
                if (err == "NEED_PROJECT") return err;
                if (!string.IsNullOrEmpty(err) && plan.steps[i].action != "AskClarify")
                    return err;
            }
            return "";
        }

        public static string Execute(AssistantStep step, AssistantConfig cfg, Action<AssistantStep> hook) {
            if (step == null) return "Порожня дія.";
            if (NeedsHook(step.action) && hook != null) {
                hook(step);
                if (step.status == StepStatus.Cancelled) return "Скасовано.";
                if (!string.IsNullOrEmpty(step.result) && step.status == StepStatus.Done)
                    return "";
            }
            string err = Validate(step, cfg);
            if (err == "NEED_PROJECT") return err;
            if (!string.IsNullOrEmpty(err)) return err;
            if (cfg != null) {
                if ((step.action == "SearchWeb" || step.action == "SearchYouTube" ||
                    step.action == "OpenUrl") && !cfg.allowSearch)
                    return "Пошук вимкнено в налаштуваннях.";
                if (step.action == "OpenApplication" && !cfg.allowApps)
                    return "Запуск програм вимкнено.";
                if (step.action == "OpenFolder" && !cfg.allowFolders)
                    return "Папки вимкнено.";
                if (step.action == "SetTimer" && !cfg.allowTimer) return "Таймер вимкнено.";
                if (step.action == "CreateNote" && !cfg.allowNotes) return "Нотатки вимкнено.";
                if (step.action == "SetTheme" && !cfg.allowTheme) return "Теми вимкнено.";
                if (step.action == "RunWorkflow" && !cfg.allowWorkflows)
                    return "Сценарії вимкнено.";
            }
            try {
                string ok = "";
                switch (step.action) {
                    case "OpenUrl":
                        ok = OpenBrowser(step.url, step.browser, "Відкрито " + HostOf(step.url));
                        break;
                    case "SearchWeb":
                        if (string.IsNullOrEmpty(step.url))
                            step.url = AssistantUrl.GoogleSearch(step.query);
                        ok = OpenBrowser(step.url, step.browser, "Пошук відкрито. Результати сторінки я не читаю.");
                        break;
                    case "SearchYouTube":
                        if (string.IsNullOrEmpty(step.url))
                            step.url = AssistantUrl.YoutubeSearch(step.query);
                        ok = OpenBrowser(step.url, step.browser, "YouTube відкрито. Відео я не переглядаю.");
                        break;
                    case "OpenApplication":
                        ok = OpenApp(step);
                        break;
                    case "OpenFolder":
                        ok = OpenPath(step.path);
                        break;
                    case "CreateNote":
                        ok = WriteNote(step.text);
                        break;
                    case "SetTheme":
                        ok = ApplyThemeName(step.theme);
                        break;
                    case "AskClarify":
                        ok = step.say != null && step.say.Length > 0 ? step.say : "Уточни запит.";
                        step.result = ok;
                        return "";
                    case "SetTimer":
                    case "OpenSettings":
                    case "FindLauncherItem":
                    case "RunWorkflow":
                        if (hook != null) {
                            hook(step);
                            if (step.status == StepStatus.Cancelled) return "Скасовано.";
                            if (!string.IsNullOrEmpty(step.result)) return "";
                        }
                        return "HOOK";
                    default:
                        return "Невідома дія.";
                }
                if (IsFailure(ok)) return ok;
                step.result = ok;
                return "";
            } catch (Exception ex) {
                return ex.Message;
            }
        }

        static bool NeedsHook(string action) {
            return action == "SetTimer" || action == "OpenSettings" ||
                action == "FindLauncherItem" || action == "RunWorkflow" ||
                action == "SetTheme";
        }

        static bool IsFailure(string msg) {
            if (string.IsNullOrEmpty(msg)) return false;
            string n = msg.ToLowerInvariant();
            return n.StartsWith("не ") || n.Contains("не знай") || n.Contains("не встанов") ||
                n.Contains("некорект") || n.Contains("помил") || n.Contains("не вказано") ||
                n.Contains("не існує") || n.Contains("кілька програм") || n == "hook";
        }

        public static string FindChrome() {
            string[] cands = {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    @"Google\Chrome\Application\chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
                    @"Google\Chrome\Application\chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),
                    @"Google\Chrome\Application\chrome.exe")
            };
            for (int i = 0; i < cands.Length; i++)
                if (File.Exists(cands[i])) return cands[i];
            return "";
        }

        static string OpenApp(AssistantStep step) {
            if (!string.IsNullOrEmpty(step.path) &&
                (File.Exists(step.path) || step.path.EndsWith(".lnk", StringComparison.OrdinalIgnoreCase)))
                return StartFile(step.path, "Запущено " + (step.name.Length > 0 ? step.name : "програму"));
            string name = ((step.name ?? step.query) ?? "").Trim();
            AssistantAppHit[] hits = AssistantApps.Resolve(name, null);
            if (hits.Length == 1) return StartFile(hits[0].path, "Запущено " + hits[0].name);
            if (hits.Length > 1) return "Кілька програм: уточни назву.";
            if (name.Equals("chrome", StringComparison.OrdinalIgnoreCase) ||
                name.Equals("хром", StringComparison.OrdinalIgnoreCase)) {
                string chrome = FindChrome();
                if (chrome.Length == 0) return "Не знайшов Chrome.";
                return StartFile(chrome, "Chrome запущено");
            }
            if (File.Exists(name) && name.EndsWith(".exe", StringComparison.OrdinalIgnoreCase))
                return StartFile(name, "Запущено");
            return "Не знайшов програму «" + name + "».";
        }

        static string OpenPath(string path) {
            if (string.IsNullOrWhiteSpace(path)) return "Не вказано шлях.";
            if (!Directory.Exists(path) && !File.Exists(path)) return "Шлях не існує.";
            return StartFile(path, "Відкрито папку");
        }

        static string OpenBrowser(string url, string browser, string ok) {
            string checkedUrl;
            if (!AssistantUrl.TryHttpUrl(url, out checkedUrl)) return "Некоректне посилання.";
            if (DryRun) {
                DryLog.Add("OpenUrl " + checkedUrl + (string.IsNullOrEmpty(browser) ? "" : " in " + browser));
                return ok;
            }
            if (!string.IsNullOrEmpty(browser)) {
                string exe = AssistantApps.BrowserExe(browser);
                if (string.IsNullOrEmpty(exe))
                    return browser + " не встановлено. Можу відкрити в браузері за замовчуванням, якщо скажеш.";
                string named = Launch(exe, checkedUrl);
                return named == null ? ok : named;
            }
            string err = LaunchUrl(checkedUrl);
            return err == null ? ok : err;
        }

        static string StartFile(string path, string ok) {
            return StartFileArgs(path, null, ok);
        }

        static string StartFileArgs(string path, string args, string ok) {
            if (DryRun) {
                DryLog.Add("Start " + path + (string.IsNullOrEmpty(args) ? "" : " " + args));
                return ok;
            }
            string err = Launch(path, args);
            return err == null ? ok : err;
        }

        static string LaunchUrl(string url) {
            string chrome = FindChrome();
            if (!string.IsNullOrEmpty(chrome)) {
                string err = Launch(chrome, url);
                if (err == null) return null;
            }
            string explorer = Launch("explorer.exe", url);
            if (explorer == null) return null;
            string cmd = Launch("cmd.exe", "/c start \"\" \"" + url + "\"");
            if (cmd == null) return null;
            return "Не вдалося відкрити браузер: " + explorer;
        }

        static string Launch(string file, string args) {
            try {
                var psi = new ProcessStartInfo();
                psi.FileName = file;
                psi.UseShellExecute = true;
                psi.ErrorDialog = false;
                if (!string.IsNullOrEmpty(args)) psi.Arguments = args;
                Process p = Process.Start(psi);
                if (p != null) {
                    try { if (!p.HasExited) NativeShow(p); } catch { }
                }
                return null;
            } catch (Exception ex) {
                try {
                    var psi = new ProcessStartInfo();
                    psi.FileName = file;
                    psi.UseShellExecute = false;
                    psi.CreateNoWindow = file.IndexOf("cmd", StringComparison.OrdinalIgnoreCase) >= 0;
                    if (!string.IsNullOrEmpty(args)) psi.Arguments = args;
                    Process.Start(psi);
                    return null;
                } catch {
                    return ex.Message;
                }
            }
        }

        static void NativeShow(Process p) {
            if (p == null || p.MainWindowHandle == IntPtr.Zero) return;
            ShowWindow(p.MainWindowHandle, 9);
            SetForegroundWindow(p.MainWindowHandle);
        }

        [DllImport("user32.dll")]
        static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
        [DllImport("user32.dll")]
        static extern bool SetForegroundWindow(IntPtr hWnd);

        static string WriteNote(string text) {
            if (DryRun) {
                DryLog.Add("Note " + text);
                return "Нотатку збережено";
            }
            string path = AssistantPaths.NotesPath;
            File.AppendAllText(path,
                Environment.NewLine + "## " + DateTime.Now.ToString("yyyy-MM-dd HH:mm") +
                Environment.NewLine + text.Trim() + Environment.NewLine, Encoding.UTF8);
            return "Нотатку збережено";
        }

        static string ApplyThemeName(string theme) {
            theme = (theme ?? "").Trim().ToLowerInvariant();
            string[] ok = { "dark", "light", "neon", "foxpurple", "slate", "orange" };
            bool known = false;
            for (int i = 0; i < ok.Length; i++) if (ok[i] == theme) known = true;
            if (!known) return "Невідома тема.";
            try {
                string live = Path.Combine(FoxPaths.RuntimeDir(), "style.json");
                // Theme apply is finished by FOXSTYLE store when present.
                File.WriteAllText(Path.Combine(FoxPaths.RuntimeDir(), "assistant.theme"),
                    theme, new UTF8Encoding(false));
            } catch { }
            return "HOOK";
        }

        static string HostOf(string url) {
            Uri u;
            if (Uri.TryCreate(url, UriKind.Absolute, out u)) return u.Host;
            return url;
        }
    }

    public static class AssistantLog {
        public static List<AssistantLogItem> Load() {
            var list = FoxJson.FileLoad<List<AssistantLogItem>>(AssistantPaths.LogPath, null);
            return list ?? new List<AssistantLogItem>();
        }
        public static void Add(string text, string source, string result, bool ok) {
            try {
                List<AssistantLogItem> list = Load();
                list.Insert(0, new AssistantLogItem {
                    utc = DateTime.UtcNow.ToString("o"),
                    text = text, source = source, result = result, ok = ok
                });
                if (list.Count > 80) list.RemoveRange(80, list.Count - 80);
                FoxJson.FileSave(AssistantPaths.LogPath, list);
            } catch { }
        }
        public static void Clear() {
            try { if (File.Exists(AssistantPaths.LogPath)) File.Delete(AssistantPaths.LogPath); }
            catch { }
        }
    }

    public static class AssistantMics {
        [System.Runtime.InteropServices.StructLayout(
            System.Runtime.InteropServices.LayoutKind.Sequential,
            CharSet = System.Runtime.InteropServices.CharSet.Auto)]
        struct Caps {
            public short mid, pid;
            public int ver;
            [System.Runtime.InteropServices.MarshalAs(
                System.Runtime.InteropServices.UnmanagedType.ByValTStr, SizeConst = 32)]
            public string name;
            public int formats;
            public short channels, reserved;
        }
        [System.Runtime.InteropServices.DllImport("winmm.dll", CharSet = System.Runtime.InteropServices.CharSet.Auto)]
        static extern int waveInGetNumDevs();
        [System.Runtime.InteropServices.DllImport("winmm.dll", CharSet = System.Runtime.InteropServices.CharSet.Auto)]
        static extern int waveInGetDevCaps(IntPtr id, out Caps caps, int size);

        public static bool Probe(string preferredName, out string detail) {
            detail = "";
            List<MicInfo> mics = List();
            if (mics.Count == 0) { detail = "Немає пристрою запису."; return false; }
            int idx = 0;
            if (!string.IsNullOrEmpty(preferredName)) {
                for (int i = 0; i < mics.Count; i++)
                    if (string.Equals(mics[i].name, preferredName, StringComparison.OrdinalIgnoreCase))
                        idx = i;
            } else {
                for (int i = 0; i < mics.Count; i++)
                    if (mics[i].preferred) { idx = i; break; }
            }
            IntPtr handle;
            var fmt = new WaveFormat();
            fmt.tag = 1; fmt.channels = 1; fmt.samples = 16000; fmt.bits = 16;
            fmt.block = 2; fmt.avg = 32000;
            int r = waveInOpen(out handle, idx, ref fmt, IntPtr.Zero, IntPtr.Zero, 0);
            if (r != 0) {
                detail = "Не вдалося відкрити «" + mics[idx].name + "» (код " + r + "). Перевірте дозвіл Windows.";
                return false;
            }
            try { waveInClose(handle); } catch { }
            detail = mics[idx].name + " · відкривається, 16 кГц моно";
            return true;
        }

        [System.Runtime.InteropServices.StructLayout(
            System.Runtime.InteropServices.LayoutKind.Sequential)]
        struct WaveFormat {
            public short tag, channels;
            public int samples, avg;
            public short block, bits, extra;
        }
        [System.Runtime.InteropServices.DllImport("winmm.dll")]
        static extern int waveInOpen(out IntPtr h, int device, ref WaveFormat fmt,
            IntPtr proc, IntPtr inst, int flags);
        [System.Runtime.InteropServices.DllImport("winmm.dll")]
        static extern int waveInClose(IntPtr h);

        public static List<MicInfo> List() {
            var list = new List<MicInfo>();
            int n = waveInGetNumDevs();
            for (int i = 0; i < n; i++) {
                Caps c;
                waveInGetDevCaps(new IntPtr(i), out c, System.Runtime.InteropServices.Marshal.SizeOf(typeof(Caps)));
                string name = (c.name ?? "").Trim();
                string low = name.ToLowerInvariant();
                list.Add(new MicInfo {
                    index = i,
                    name = name,
                    preferred = low.Contains("trust") || low.Contains("gxt") ||
                        (low.Contains("usb") && !low.Contains("array"))
                });
            }
            return list;
        }
    }

    public static class AssistantSelfTest {
        public static void Run() {
            AssistantGuard.Reset();
            Assert(AssistantUrl.Encode("C#") == "C%23", "hash encode");
            Assert(AssistantUrl.Encode("a+b") == "a%2Bb", "plus encode");
            Assert(AssistantUrl.Encode("q&x") == "q%26x", "amp encode");
            Assert(AssistantUrl.Encode("що?") == "\u0449\u043E%3F" ||
                AssistantUrl.Encode("що?").EndsWith("%3F"), "ua encode");
            string url;
            Assert(AssistantUrl.TryHttpUrl("github.com", out url) &&
                url.StartsWith("https://github.com"), "host url");
            Assert(!AssistantUrl.TryHttpUrl("not a domain", out url), "space rejected");

            var cfg = new AssistantConfig();
            var talk = new AssistantTalk();
            AssistantPlan p = AssistantIntents.Parse("Відкрий Google", cfg, talk);
            Assert(p.source == "local" && p.steps.Count == 1 && p.steps[0].action == "OpenUrl", "open google");
            Assert(p.steps[0].url == AssistantUrl.GoogleHome, "google home url");

            p = AssistantIntents.Parse("Можеш мені відкрити Google?", cfg, talk);
            Assert(p.source == "local" && p.steps.Count == 1 && p.steps[0].url == AssistantUrl.GoogleHome,
                "polite google");
            p = AssistantIntents.Parse("Я хочу зараз зайти в Google, відкрий його, будь ласка", cfg, talk);
            Assert(p.source == "local" && p.steps.Count == 1 && p.steps[0].action == "OpenUrl",
                "full sentence google");

            p = AssistantIntents.Parse("Знайди в Google документація C#", cfg, talk);
            Assert(p.steps.Count == 1 && p.steps[0].action == "SearchWeb", "search web");
            Assert(p.steps[0].url.IndexOf("q=") > 0 && p.steps[0].url.Contains("C%23"),
                "search encodes hash");

            p = AssistantIntents.Parse("Погугли, як налаштувати MikroTik", cfg, talk);
            Assert(p.steps[0].action == "SearchWeb" &&
                p.steps[0].query.IndexOf("MikroTik", StringComparison.OrdinalIgnoreCase) >= 0,
                "google slang");

            p = AssistantIntents.Parse("Знайди відео про масиви в C# на YouTube", cfg, talk);
            Assert(p.steps[0].action == "SearchYouTube", "youtube search");

            p = AssistantIntents.Parse("Відкрий YouTube", cfg, talk);
            Assert(p.steps[0].action == "OpenUrl" && p.steps[0].url.Contains("youtube.com"),
                "youtube home not search");

            p = AssistantIntents.Parse("Відкрий github.com", cfg, talk);
            Assert(p.steps[0].action == "OpenUrl" && p.steps[0].url.Contains("github.com"),
                "open host");

            p = AssistantIntents.Parse("Відкрий Chrome", cfg, talk);
            Assert(p.steps[0].action == "OpenApplication", "chrome vs google");

            p = AssistantIntents.Parse("Не відкривай Chrome, відкрий Firefox", cfg, talk);
            Assert(p.source == "local" && p.steps.Count == 1, "negation count");
            Assert(p.steps[0].action == "OpenApplication", "negation is app");
            Assert(AssistantGuard.Normalize(p.steps[0].name).IndexOf("chrome") < 0, "chrome not launched");
            Assert(AssistantGuard.Normalize(p.steps[0].name).IndexOf("firefox") >= 0 ||
                AssistantGuard.Normalize(p.steps[0].name).IndexOf("фаєр") >= 0, "firefox chosen");

            p = AssistantIntents.Parse("Відкрий YouTube, хоча ні, краще GitHub", cfg, talk);
            Assert(p.steps.Count == 1 && p.steps[0].action == "OpenUrl", "correction action");
            Assert(p.steps[0].url.IndexOf("github.com", StringComparison.OrdinalIgnoreCase) >= 0,
                "correction github");

            p = AssistantIntents.Parse(
                "Відкрий Cursor, а потім знайди в Google документацію C#. Ще постав таймер на 25 хвилин",
                cfg, talk);
            Assert(p.source == "local" && p.steps.Count == 3, "multi count");
            Assert(p.steps[0].action == "OpenApplication", "multi cursor");
            Assert(p.steps[1].action == "SearchWeb" && p.steps[1].url.Contains("C%23"), "multi search");
            Assert(p.steps[2].action == "SetTimer" && p.steps[2].seconds == 1500, "multi timer 25");

            p = AssistantIntents.Parse("Постав таймер на п'ять хвилин", cfg, talk);
            Assert(p.steps.Count == 1 && p.steps[0].action == "SetTimer" && p.steps[0].seconds == 300,
                "ua number timer");

            p = AssistantIntents.Parse("Відкрий YouTube у Firefox", cfg, talk);
            Assert(p.steps[0].action == "OpenUrl" && p.steps[0].browser == "firefox", "site in firefox");

            talk.Remember("Знайди документацію C#",
                AssistantIntents.Parse("Знайди документацію C#", cfg, null));
            p = AssistantIntents.Parse("А тепер те саме про Python", cfg, talk);
            Assert(p.steps.Count == 1 && p.steps[0].action == "SearchWeb", "follow search");
            Assert(p.steps[0].query.IndexOf("Python", StringComparison.OrdinalIgnoreCase) >= 0,
                "follow topic");

            talk.Remember("Відкрий YouTube",
                AssistantIntents.Parse("Відкрий YouTube", cfg, null));
            p = AssistantIntents.Parse("Але у Firefox", cfg, talk);
            Assert(p.steps[0].action == "OpenUrl" && p.steps[0].browser == "firefox", "follow browser");

            p = AssistantIntents.Parse("Відкрий редактор і знайди в Google документацію C#", cfg, talk);
            Assert(p.steps.Count >= 1, "compound still plans");

            p = AssistantIntents.Parse("Пошукай у Google, чому YouTube не працює", cfg, talk);
            Assert(p.source == "local" && p.steps.Count == 1, "google youtube mention count");
            Assert(p.steps[0].action == "SearchWeb", "google youtube mention is google");
            Assert(p.steps[0].url.IndexOf("google.com/search", StringComparison.OrdinalIgnoreCase) >= 0,
                "google youtube mention url");
            Assert(p.steps[0].query.IndexOf("YouTube", StringComparison.OrdinalIgnoreCase) >= 0,
                "google youtube mention keeps youtube in query");
            Assert(p.handler == "web-search", "google youtube mention handler");

            p = AssistantIntents.Parse("Знайди на YouTube відео про налаштування MikroTik", cfg, talk);
            Assert(p.steps.Count == 1 && p.steps[0].action == "SearchYouTube", "yt topic action");
            Assert(p.steps[0].query.IndexOf("MikroTik", StringComparison.OrdinalIgnoreCase) >= 0,
                "yt topic query");
            Assert(p.steps[0].query.IndexOf("YouTube", StringComparison.OrdinalIgnoreCase) < 0,
                "yt topic query stripped venue");
            Assert(p.steps[0].url.IndexOf("search_query=", StringComparison.Ordinal) >= 0,
                "yt topic encoded url");

            p = AssistantIntents.Parse("Що таке YouTube?", cfg, talk);
            Assert(p.source == "ai" && p.steps.Count == 0, "what is youtube goes to model");
            Assert(!HasLaunchAction(p), "what is youtube no launch");

            p = AssistantIntents.Parse(
                "Знайди на YouTube уроки C#, але поки не відкривай, просто скажи, чи ти це можеш",
                cfg, talk);
            Assert(p.source == "ai" && p.steps.Count == 0, "capability no local launch");

            var fakeYt = new AssistantPlan { source = "ai", kind = "plan" };
            fakeYt.steps.Add(new AssistantStep {
                action = "SearchYouTube", query = "уроки C#",
                url = AssistantUrl.YoutubeSearch("уроки C#")
            });
            fakeYt = AssistantUnderstand.GuardPlan(
                "Знайди на YouTube уроки C#, але поки не відкривай, просто скажи, чи ти це можеш",
                fakeYt);
            Assert(fakeYt.kind == "reply" && fakeYt.steps.Count == 0, "guard strips capability launch");

            var fakeHome = new AssistantPlan { source = "ai", kind = "plan" };
            fakeHome.steps.Add(new AssistantStep {
                action = "OpenUrl", url = "https://www.youtube.com/"
            });
            fakeHome = AssistantUnderstand.GuardPlan("Що таке YouTube?", fakeHome);
            Assert(fakeHome.steps.Count == 0 && fakeHome.kind == "reply", "guard strips definition launch");

            p = AssistantIntents.Parse("Не відкривай YouTube, відкрий GitHub", cfg, talk);
            Assert(p.steps.Count == 1 && p.steps[0].action == "OpenUrl", "neg yt count");
            Assert(p.steps[0].url.IndexOf("github.com", StringComparison.OrdinalIgnoreCase) >= 0,
                "neg yt opens github");
            Assert(p.steps[0].url.IndexOf("youtube", StringComparison.OrdinalIgnoreCase) < 0,
                "neg yt does not open youtube");

            p = AssistantIntents.Parse("Відкрий YouTube і потім Cursor", cfg, talk);
            Assert(p.steps.Count == 2, "yt then cursor count");
            Assert(p.steps[0].action == "OpenUrl" && p.steps[0].url.Contains("youtube.com"),
                "yt then cursor first");
            Assert(p.steps[1].action == "OpenApplication", "yt then cursor second");

            p = AssistantIntents.Parse("Відкрий YouTube, хоча ні, краще Google", cfg, talk);
            Assert(p.steps.Count == 1 && p.steps[0].url == AssistantUrl.GoogleHome,
                "correction yt to google");

            p = AssistantIntents.Parse("Пошукай у Google, чому Chrome не працює", cfg, talk);
            Assert(p.steps[0].action == "SearchWeb", "google chrome mention");
            Assert(p.steps[0].query.IndexOf("Chrome", StringComparison.OrdinalIgnoreCase) >= 0,
                "google chrome query");

            p = AssistantIntents.Parse("Що таке GitHub?", cfg, talk);
            Assert(p.source == "ai" && p.steps.Count == 0, "what is github to model");

            p = AssistantIntents.Parse("Не відкривай GitHub, відкрий YouTube", cfg, talk);
            Assert(p.steps.Count == 1 && p.steps[0].url.Contains("youtube.com"),
                "neg github opens youtube");
            Assert(p.steps[0].url.IndexOf("github", StringComparison.OrdinalIgnoreCase) < 0,
                "neg github skips github");

            p = AssistantIntents.Parse("Відкрий Chrome, хоча ні, краще Firefox", cfg, talk);
            Assert(p.steps.Count == 1 && p.steps[0].action == "OpenApplication",
                "correction chrome to firefox");
            Assert(AssistantGuard.Normalize(p.steps[0].name).IndexOf("firefox") >= 0 ||
                AssistantGuard.Normalize(p.steps[0].name).IndexOf("фаєр") >= 0,
                "correction picked firefox");

            p = AssistantIntents.Parse("Пошукай на YouTube уроки C#", cfg, talk);
            Assert(p.steps[0].action == "SearchYouTube", "yt search paraphrase");
            Assert(p.steps[0].query.IndexOf("C#", StringComparison.OrdinalIgnoreCase) >= 0 ||
                p.steps[0].query.IndexOf("c#", StringComparison.OrdinalIgnoreCase) >= 0,
                "yt search paraphrase query");

            AssistantPlan mapped = AssistantIntents.FromModelJson(
                "{\"kind\":\"plan\",\"steps\":[{\"action\":\"SearchWebsite\",\"service\":\"youtube\",\"query\":\"MikroTik\"}]}");
            Assert(mapped.steps.Count == 1 && mapped.steps[0].action == "SearchYouTube",
                "alias search website youtube");
            Assert(mapped.steps[0].url.IndexOf("search_query=", StringComparison.Ordinal) >= 0,
                "alias fills youtube url");

            AssistantPlan answered = AssistantIntents.FromModelJson(
                "{\"kind\":\"reply\",\"say\":\"YouTube — відеохостинг.\",\"steps\":[{\"action\":\"Answer\",\"text\":\"YouTube — відеохостинг.\"}]}");
            Assert(answered.kind == "reply" && answered.steps.Count == 0, "answer is reply");

            AssistantPlan leaked = AssistantIntents.FromModelJson(
                "{\"kind\":\"plan|clarify|reply|unsupported\",\"say\":\"YouTube — відеохостинг.\"}");
            Assert(leaked.kind == "reply" && leaked.steps.Count == 0, "kind enum leak");

            AssistantActions.BeginDry();
            try {
                AssistantPlan googleYt = AssistantIntents.Parse(
                    "Пошукай у Google, чому YouTube не працює", cfg, talk);
                Assert(string.IsNullOrEmpty(AssistantActions.Execute(googleYt.steps[0], cfg, null)),
                    "dry google about youtube");
                Assert(AssistantActions.DryLog.Count == 1, "dry one action");
                Assert(AssistantActions.DryLog[0].IndexOf("google.com/search", StringComparison.OrdinalIgnoreCase) >= 0,
                    "dry opened google search");
                Assert(AssistantActions.DryLog[0].IndexOf("youtube.com/", StringComparison.OrdinalIgnoreCase) < 0 ||
                    AssistantActions.DryLog[0].IndexOf("google.com", StringComparison.OrdinalIgnoreCase) >= 0,
                    "dry did not open youtube home");
            } finally {
                AssistantActions.EndDry();
            }

            AssistantPlan bad = AssistantIntents.FromModelJson("not-json");
            Assert(!string.IsNullOrEmpty(bad.error), "bad json");
            AssistantPlan unk = AssistantIntents.FromModelJson(
                "{\"steps\":[{\"action\":\"rm -rf\",\"path\":\"/\"}]}");
            Assert(unk.steps.Count == 0, "unknown action dropped");

            var step = new AssistantStep { action = "OpenUrl", url = "javascript:alert(1)" };
            Assert(AssistantActions.Validate(step, cfg).Length > 0, "js url blocked");

            AssistantActions.BeginDry();
            try {
                var google = new AssistantStep { action = "OpenUrl", url = AssistantUrl.GoogleHome };
                Assert(string.IsNullOrEmpty(AssistantActions.Execute(google, cfg, null)), "dry google");
                var missing = new AssistantStep { action = "OpenApplication", name = "NoSuchFoxAppZZZ" };
                Assert(!string.IsNullOrEmpty(AssistantActions.Execute(missing, cfg, null)), "missing app");
            } finally {
                AssistantActions.EndDry();
            }

            Assert(AssistantGuard.TryBegin("Відкрий Google"), "first lock");
            Assert(!AssistantGuard.TryBegin("Відкрий Google"), "dedup");
            AssistantGuard.End();
            Thread.Sleep(10);
            Assert(!AssistantGuard.TryBegin("Відкрий Google"), "recent dup");
            AssistantGuard.Reset();
            Assert(AssistantGuard.TryBegin("інше"), "after reset");
            AssistantGuard.End();
            AssistantGuard.Reset();
        }

        static bool HasLaunchAction(AssistantPlan p) {
            if (p == null || p.steps == null) return false;
            for (int i = 0; i < p.steps.Count; i++) {
                string a = p.steps[i].action ?? "";
                if (a == "OpenUrl" || a == "SearchWeb" || a == "SearchYouTube" ||
                    a == "OpenApplication" || a == "FindLauncherItem")
                    return true;
            }
            return false;
        }

        static void Assert(bool cond, string msg) {
            if (!cond) throw new InvalidOperationException("assistant: " + msg);
        }
    }
}
