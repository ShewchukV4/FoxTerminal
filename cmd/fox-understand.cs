using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using FoxOs.Sdk;

namespace FoxOs.Assistant {

    public sealed class AssistantAlias {
        public string name = "";
        public string kind = "";
        public string value = "";
    }

    public sealed class AssistantAppHit {
        public string name = "";
        public string path = "";
        public string kind = "lnk";
    }

    public sealed class AssistantTurn {
        public string user = "";
        public string action = "";
        public string query = "";
        public string url = "";
        public string name = "";
        public string browser = "";
        public string say = "";
    }

    public sealed class AssistantTalk {
        readonly List<AssistantTurn> turns = new List<AssistantTurn>();
        public AssistantTurn Last {
            get { return turns.Count == 0 ? null : turns[turns.Count - 1]; }
        }
        public void Clear() { turns.Clear(); }
        public void Remember(string user, AssistantPlan plan) {
            if (plan == null) return;
            var t = new AssistantTurn { user = user ?? "", say = plan.say ?? "" };
            if (plan.steps != null && plan.steps.Count > 0) {
                AssistantStep s = plan.steps[plan.steps.Count - 1];
                t.action = s.action ?? "";
                t.query = s.query ?? "";
                t.url = s.url ?? "";
                t.name = s.name ?? "";
                t.browser = s.browser ?? "";
            }
            turns.Add(t);
            if (turns.Count > 6) turns.RemoveAt(0);
        }
        public string ContextBlock() {
            if (turns.Count == 0) return "(немає)";
            var sb = new StringBuilder();
            int from = Math.Max(0, turns.Count - 3);
            for (int i = from; i < turns.Count; i++) {
                AssistantTurn t = turns[i];
                sb.Append("юзер: ").Append(t.user).Append(" | дія: ").Append(t.action);
                if (t.query.Length > 0) sb.Append(" q=").Append(t.query);
                if (t.url.Length > 0) sb.Append(" url=").Append(t.url);
                if (t.browser.Length > 0) sb.Append(" браузер=").Append(t.browser);
                sb.Append('\n');
            }
            return sb.ToString().Trim();
        }
    }

    public static class AssistantRewrite {
        static readonly Regex Fillers = new Regex(
            @"(?i)\b(будь\s+ласка|please|можеш(\s+мені)?|чи\s+можеш|можна|я\s+хочу|хочу|зараз|просто|давай|зробиш|зроби|мені|тільки)\b",
            RegexOptions.CultureInvariant);
        static readonly Regex SoftOpen = new Regex(
            @"(?i)\b(зайти\s+в|зайти\s+на|зайди\s+в|зайди\s+на|відкрий\s+його|відкрий\s+її|відкрий\s+це)\b",
            RegexOptions.CultureInvariant);
        static readonly Regex Correction = new Regex(
            @"(?is)^(?<pre>.*?)(?:,\s*)?(?:хоча\s+ні|ні,?\s+краще|а\s+ні)[,.\s]+(?:краще\s+)?(?<fin>.+)$",
            RegexOptions.CultureInvariant);
        static readonly Regex NegOpen = new Regex(
            @"(?i)не\s+(відкривай|запускай|відкрий|open|start)\s+[^,.;]+[,.;]?\s*",
            RegexOptions.CultureInvariant);

        public static string Apply(string text) {
            string t = (text ?? "").Trim();
            if (t.Length == 0) return "";
            t = ApplyCorrection(t);
            t = NegOpen.Replace(t, " ");
            t = Regex.Replace(t, @"\s+", " ").Trim(' ', ',', ';', '.');
            return t;
        }

        public static string StripFillers(string text) {
            string t = Fillers.Replace(text ?? "", " ");
            t = SoftOpen.Replace(t, " ");
            t = Regex.Replace(t, @"\s+", " ").Trim(' ', ',', ';', '.', '—', '-');
            return t;
        }

        static string ApplyCorrection(string text) {
            Match m = Correction.Match(text);
            if (!m.Success) return text;
            string pre = (m.Groups["pre"].Value ?? "").Trim();
            string fin = (m.Groups["fin"].Value ?? "").Trim();
            if (fin.Length == 0) return text;
            string verb = FirstVerb(pre);
            if (verb.Length > 0 && !HasVerb(fin))
                return verb + " " + fin;
            return fin;
        }

        static readonly string[] Verbs = {
            "відкрий", "открой", "open", "запусти", "знайди", "пошукай", "погугли",
            "постав", "поставь", "set", "search", "find", "launch"
        };

        static string FirstVerb(string text) {
            string n = AssistantGuard.Normalize(text);
            for (int i = 0; i < Verbs.Length; i++)
                if (n.StartsWith(Verbs[i] + " ") || n == Verbs[i]) return Verbs[i];
            return "";
        }
        static bool HasVerb(string text) {
            return FirstVerb(text).Length > 0;
        }
    }

    public static class AssistantApps {
        static List<AssistantAppHit> cache;
        static DateTime cacheAt = DateTime.MinValue;

        public static List<AssistantAppHit> List() {
            if (cache != null && (DateTime.UtcNow - cacheAt).TotalSeconds < 90)
                return cache;
            var list = new List<AssistantAppHit>();
            AddKnown(list);
            ScanMenu(list, Environment.GetFolderPath(Environment.SpecialFolder.StartMenu));
            ScanMenu(list, Environment.GetFolderPath(Environment.SpecialFolder.CommonStartMenu));
            cache = list;
            cacheAt = DateTime.UtcNow;
            return list;
        }

        public static AssistantAppHit[] Resolve(string raw, AssistantConfig cfg) {
            string q = AssistantGuard.Normalize(Alias(raw, cfg));
            if (q.Length == 0) return new AssistantAppHit[0];
            var exact = new List<AssistantAppHit>();
            var soft = new List<AssistantAppHit>();
            List<AssistantAppHit> all = List();
            for (int i = 0; i < all.Count; i++) {
                string n = AssistantGuard.Normalize(all[i].name);
                if (n == q) exact.Add(all[i]);
                else if (n.IndexOf(q, StringComparison.Ordinal) >= 0 ||
                    (q.Length >= 4 && n.IndexOf(q, StringComparison.Ordinal) >= 0))
                    soft.Add(all[i]);
            }
            AssistantAppHit[] picked = Distinct(exact.Count > 0 ? exact : soft);
            if (picked.Length <= 1) return picked;
            for (int i = 0; i < picked.Length; i++) {
                if (string.Equals(picked[i].kind, "exe", StringComparison.OrdinalIgnoreCase))
                    return new AssistantAppHit[] { picked[i] };
            }
            return new AssistantAppHit[] { picked[0] };
        }

        public static string Alias(string raw, AssistantConfig cfg) {
            string n = AssistantGuard.Normalize(raw);
            if (cfg != null && cfg.aliases != null) {
                for (int i = 0; i < cfg.aliases.Count; i++) {
                    AssistantAlias a = cfg.aliases[i];
                    if (a == null || string.IsNullOrEmpty(a.name)) continue;
                    if (AssistantGuard.Normalize(a.name) == n) return a.value;
                }
            }
            if (n == "курсор" || n == "cursor") return "Cursor";
            if (n == "вінбокс" || n == "винбокс" || n == "winbox") return "Winbox";
            if (n == "хром" || n == "chrome") return "Chrome";
            if (n == "фаєрфокс" || n == "файрфокс" || n == "firefox") return "Firefox";
            if (n == "едж" || n == "edge") return "Edge";
            if (n == "блокнот" || n == "notepad") return "Notepad";
            return raw ?? "";
        }

        public static string NamesForPrompt() {
            List<AssistantAppHit> all = List();
            var sb = new StringBuilder();
            int n = Math.Min(24, all.Count);
            for (int i = 0; i < n; i++) {
                if (i > 0) sb.Append(", ");
                sb.Append(all[i].name);
            }
            return sb.ToString();
        }

        static void AddKnown(List<AssistantAppHit> list) {
            TryAdd(list, "Chrome", AssistantActions.FindChrome(), "exe");
            TryAdd(list, "Firefox", FindFirefox(), "exe");
            TryAdd(list, "Edge", FindEdge(), "exe");
            TryAdd(list, "Cursor", FindCursor(), "exe");
            TryAdd(list, "Notepad",
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), "notepad.exe"), "exe");
        }

        static void TryAdd(List<AssistantAppHit> list, string name, string path, string kind) {
            if (string.IsNullOrEmpty(path) || !File.Exists(path)) return;
            list.Add(new AssistantAppHit { name = name, path = path, kind = kind });
        }

        static void ScanMenu(List<AssistantAppHit> list, string root) {
            if (string.IsNullOrEmpty(root) || !Directory.Exists(root)) return;
            try {
                string[] files = Directory.GetFiles(root, "*.lnk", SearchOption.AllDirectories);
                for (int i = 0; i < files.Length; i++) {
                    string title = Path.GetFileNameWithoutExtension(files[i]);
                    if (string.IsNullOrEmpty(title)) continue;
                    string low = title.ToLowerInvariant();
                    if (low.Contains("uninstall") || low.Contains("видалити") || low.Contains("help"))
                        continue;
                    list.Add(new AssistantAppHit { name = title, path = files[i], kind = "lnk" });
                }
            } catch { }
        }

        static AssistantAppHit[] Distinct(List<AssistantAppHit> hits) {
            var seen = new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase);
            var outList = new List<AssistantAppHit>();
            for (int i = 0; i < hits.Count; i++) {
                string key = hits[i].name + "|" + hits[i].path;
                if (seen.ContainsKey(key)) continue;
                seen[key] = true;
                outList.Add(hits[i]);
            }
            return outList.ToArray();
        }

        public static string FindFirefox() {
            string[] cands = {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
                    @"Mozilla Firefox\firefox.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),
                    @"Mozilla Firefox\firefox.exe")
            };
            for (int i = 0; i < cands.Length; i++)
                if (File.Exists(cands[i])) return cands[i];
            return "";
        }

        public static string FindEdge() {
            string p = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),
                @"Microsoft\Edge\Application\msedge.exe");
            if (File.Exists(p)) return p;
            p = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
                @"Microsoft\Edge\Application\msedge.exe");
            return File.Exists(p) ? p : "";
        }

        public static string FindCursor() {
            string p = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                @"Programs\cursor\Cursor.exe");
            return File.Exists(p) ? p : "";
        }

        public static string BrowserExe(string browser) {
            string n = AssistantGuard.Normalize(browser);
            if (n == "chrome" || n == "хром") return AssistantActions.FindChrome();
            if (n == "firefox" || n == "фаєрфокс" || n == "файрфокс") return FindFirefox();
            if (n == "edge" || n == "едж") return FindEdge();
            return "";
        }
    }

    public static class AssistantUnderstand {
        static readonly Regex Splitter = new Regex(
            @"(?i)\s*(?:,\s*)?(?:а\s+потім|і\s+потім|потім|після\s+цього|ще|також|and\s+then|then|(?:і|та)\s+(?=знайди|відкрий|постав|запусти))\s+",
            RegexOptions.CultureInvariant);
        static readonly Regex BrowserAt = new Regex(
            @"(?i)\s+(?:у|в|через|in)\s+(chrome|хром|firefox|фаєрфокс|файрфокс|edge|едж)\s*$",
            RegexOptions.CultureInvariant);

        public static AssistantPlan Build(string text, AssistantConfig cfg, AssistantTalk talk) {
            AssistantTrace.Reset();
            var plan = new AssistantPlan { source = "local" };
            string raw = (text ?? "").Trim();
            if (raw.Length == 0) {
                plan.kind = "reply";
                plan.handler = "empty";
                plan.error = "Порожній запит.";
                return plan;
            }

            if (IsCapabilityOnly(raw)) {
                AssistantTrace.Note("capability-to-ai");
                plan.source = "ai";
                plan.kind = "plan";
                plan.handler = "capability-to-ai";
                return plan;
            }

            AssistantPlan follow = TryFollow(raw, talk);
            if (follow != null) {
                follow.handler = "follow";
                return follow;
            }

            string rewritten = AssistantRewrite.Apply(raw);
            if (rewritten.Length == 0) {
                plan.kind = "clarify";
                plan.handler = "rewrite-empty";
                plan.needsClarify = true;
                plan.say = "Не зрозумів, що саме зробити.";
                var ask = new AssistantStep { action = "AskClarify", say = plan.say };
                plan.steps.Add(ask);
                return plan;
            }

            if (LooksAmbiguous(rewritten, talk)) {
                AssistantTrace.Note("ambiguous-to-ai");
                plan.source = "ai";
                plan.kind = "plan";
                plan.handler = "ambiguous-to-ai";
                return plan;
            }

            string[] parts = Splitter.Split(rewritten);
            var steps = new List<AssistantStep>();
            for (int i = 0; i < parts.Length; i++) {
                string part = (parts[i] ?? "").Trim();
                if (part.Length == 0) continue;
                AssistantTrace.LastHandler = "";
                AssistantStep step = ParseClause(part, cfg);
                if (step == null) {
                    plan.source = "ai";
                    plan.steps.Clear();
                    plan.handler = AssistantTrace.LastHandler.Length > 0
                        ? AssistantTrace.LastHandler : "unmatched-to-ai";
                    return plan;
                }
                step.id = (steps.Count + 1).ToString();
                if (steps.Count > 0) step.dependsOn = steps[steps.Count - 1].id;
                steps.Add(step);
                if (plan.handler.Length > 0) plan.handler += ",";
                plan.handler += AssistantTrace.LastHandler;
            }
            if (steps.Count == 0) {
                plan.source = "ai";
                plan.handler = "empty-clauses-to-ai";
                return plan;
            }
            plan.steps = steps;
            plan.say = steps.Count == 1
                ? AssistantIntents.SayOne(steps[0])
                : ("Зроблю " + steps.Count + " кроків.");
            return GuardPlan(raw, plan);
        }

        public static AssistantPlan GuardPlan(string raw, AssistantPlan plan) {
            if (plan == null) return plan;
            if (!ForbidsLaunch(raw)) return plan;
            if (!HasLaunch(plan)) return plan;
            AssistantTrace.Note("guard-stripped-launch");
            plan.steps.Clear();
            plan.kind = "reply";
            if (plan.handler.Length > 0) plan.handler += "+guard";
            else plan.handler = "guard-stripped-launch";
            if (string.IsNullOrEmpty(plan.say) || LooksLikeOpenSay(plan.say)) {
                plan.say = IsCapabilityOnly(raw)
                    ? "Так, можу це зробити, але зараз нічого не відкриваю."
                    : "Це запитання, браузер не відкриваю.";
            }
            return plan;
        }

        public static string ModelUser(string text, AssistantConfig cfg, AssistantTalk talk) {
            var sb = new StringBuilder();
            sb.Append("ЗАПИТ КОРИСТУВАЧА (повний, не обрізай):\n").Append(text ?? "").Append('\n');
            sb.Append("КОНТЕКСТ:\n").Append(talk != null ? talk.ContextBlock() : "(немає)").Append('\n');
            sb.Append("ВІДОМІ ПРОГРАМИ: ").Append(AssistantApps.NamesForPrompt()).Append('\n');
            if (cfg != null && cfg.aliases != null && cfg.aliases.Count > 0) {
                sb.Append("ПСЕВДОНІМИ: ");
                for (int i = 0; i < cfg.aliases.Count; i++) {
                    if (cfg.aliases[i] == null) continue;
                    sb.Append(cfg.aliases[i].name).Append('=').Append(cfg.aliases[i].value).Append("; ");
                }
                sb.Append('\n');
            }
            sb.Append("Відповідь — лише JSON.");
            return sb.ToString();
        }

        static bool LooksAmbiguous(string text, AssistantTalk talk) {
            string n = AssistantGuard.Normalize(text);
            if (n == "це" || n == "його" || n == "там" || n == "те саме" ||
                n == "а це" || n == "і його")
                return talk == null || talk.Last == null;
            return false;
        }

        static AssistantPlan TryFollow(string raw, AssistantTalk talk) {
            if (talk == null || talk.Last == null) return null;
            string n = AssistantGuard.Normalize(raw);
            if (n.Length == 0) return null;
            AssistantTurn last = talk.Last;

            Match same = Regex.Match(raw,
                @"(?i)(?:а\s+тепер\s+)?те\s+саме\s+(?:про|для|з)\s+(.+)$");
            if (same.Success && last.action == "SearchWeb") {
                string topic = same.Groups[1].Value.Trim().Trim('.', ',', '!');
                string q = ReplaceTopic(last.query, topic);
                var p = new AssistantPlan { source = "local", say = "Шукаю «" + q + "»." };
                p.steps.Add(new AssistantStep {
                    id = "1", action = "SearchWeb", query = q, url = AssistantUrl.GoogleSearch(q)
                });
                return p;
            }

            Match onlyBrowser = Regex.Match(n, @"^(?:але\s+)?(?:у|в|через|in)\s+(chrome|хром|firefox|фаєрфокс|файрфокс|edge|едж)$");
            if (onlyBrowser.Success && last.url.Length > 0) {
                string br = NormBrowser(onlyBrowser.Groups[1].Value);
                var p = new AssistantPlan { source = "local", say = "Відкриваю в " + br + "." };
                p.steps.Add(new AssistantStep {
                    id = "1", action = "OpenUrl",
                    url = last.url.Length > 0 ? last.url : last.query,
                    browser = br
                });
                return p;
            }
            return null;
        }

        static string ReplaceTopic(string query, string topic) {
            if (string.IsNullOrEmpty(query)) return topic;
            string q = Regex.Replace(query, @"(?i)(документаці[яюі]|docs|documentation)\s+.+$",
                "$1 " + topic);
            if (q != query) return q.Trim();
            return topic;
        }

        static AssistantStep ParseClause(string clause, AssistantConfig cfg) {
            string browser;
            string raw = clause ?? "";
            string text = TakeBrowser(raw, out browser);
            string filled = AssistantRewrite.StripFillers(text);
            string n = NormClause(filled);
            if (n.Length == 0) {
                AssistantTrace.Note("empty-clause");
                return null;
            }

            if (IsCapabilityOnly(raw) || IsCapabilityOnly(n)) {
                AssistantTrace.Note("capability-to-ai");
                return null;
            }
            if (IsDefinitionQuestion(raw) || IsDefinitionQuestion(n)) {
                AssistantTrace.Note("question-to-ai");
                return null;
            }

            AssistantStep timer = TryTimer(n, filled);
            if (timer != null) { AssistantTrace.Note("timer"); return timer; }

            if (IsExactSiteHome(n, GoogleNames)) {
                AssistantTrace.Note("google-home");
                return Site("OpenUrl", AssistantUrl.GoogleHome, "", browser, "Відкриваю Google.");
            }
            if (IsExactSiteHome(n, YoutubeNames)) {
                AssistantTrace.Note("youtube-home");
                return Site("OpenUrl", "https://www.youtube.com/", "", browser, "Відкриваю YouTube.");
            }
            if (IsExactSiteHome(n, GithubNames)) {
                AssistantTrace.Note("github-home");
                return Site("OpenUrl", "https://github.com/", "", browser, "Відкриваю GitHub.");
            }

            AssistantStep yt = TryYoutubeSearch(n, filled, browser);
            if (yt != null) { AssistantTrace.Note("youtube-search"); return yt; }

            AssistantStep web = TryWebSearch(n, filled, browser);
            if (web != null) { AssistantTrace.Note("web-search"); return web; }

            string url;
            if (TryOpenHostOnly(n, filled, out url)) {
                AssistantTrace.Note("open-host");
                return Site("OpenUrl", url, "", browser, "Відкриваю " + url);
            }

            if (IsEditorCommand(n)) {
                AssistantTrace.Note("editor");
                return new AssistantStep { action = "OpenSettings", name = "editor", say = "Відкриваю редактор." };
            }

            AssistantStep app = TryApp(n, filled, cfg);
            if (app != null) { AssistantTrace.Note("app:" + app.action); return app; }

            AssistantStep folder = TryFolder(n, cfg);
            if (folder != null) { AssistantTrace.Note("folder"); return folder; }

            AssistantStep note = TryNote(n, filled);
            if (note != null) { AssistantTrace.Note("note"); return note; }

            AssistantTrace.Note("unmatched-to-ai");
            return null;
        }

        static readonly string[] GoogleNames = { "google", "гугл" };
        static readonly string[] YoutubeNames = { "youtube", "ютуб", "ютубі", "ютуба", "ютубе" };
        static readonly string[] GithubNames = { "github", "гітхаб", "гитхаб" };
        static readonly string[] OpenWords = {
            "відкрий", "відкрити", "відкрийте", "открой", "open",
            "запусти", "запустити", "start", "launch",
            "зайти", "зайди", "сайт", "його", "її", "це", "в", "на", "у"
        };

        static string NormClause(string text) {
            string n = AssistantGuard.Normalize(text);
            n = Regex.Replace(n, @"[?!.,;:]+", " ");
            return Regex.Replace(n, @"\s+", " ").Trim();
        }

        static bool ForbidsLaunch(string text) {
            return IsCapabilityOnly(text) || IsDefinitionQuestion(NormClause(text ?? ""));
        }

        static bool IsCapabilityOnly(string text) {
            string n = AssistantGuard.Normalize(text);
            if (n.Length == 0) return false;
            return Regex.IsMatch(n,
                @"(поки\s+не\s+відкривай|просто\s+скажи|скажи,?\s+чи|чи\s+ти\s+(це\s+)?(можеш|вмієш)|чи\s+можеш\s+(ти|це)|don't\s+open|just\s+say\s+if)",
                RegexOptions.CultureInvariant);
        }

        static bool IsDefinitionQuestion(string text) {
            string n = NormClause(text);
            if (n.Length == 0) return false;
            return Regex.IsMatch(n,
                @"^(що\s+таке|що\s+це(\s+таке)?|поясни|розкажи|what\s+is|what's)\b",
                RegexOptions.CultureInvariant);
        }

        static bool HasLaunch(AssistantPlan plan) {
            if (plan == null || plan.steps == null) return false;
            for (int i = 0; i < plan.steps.Count; i++) {
                string a = plan.steps[i].action ?? "";
                if (a == "OpenUrl" || a == "SearchWeb" || a == "SearchYouTube" ||
                    a == "OpenApplication" || a == "FindLauncherItem")
                    return true;
            }
            return false;
        }

        static bool LooksLikeOpenSay(string say) {
            string n = AssistantGuard.Normalize(say);
            return n.StartsWith("відкриваю") || n.StartsWith("запускаю") || n.StartsWith("шукаю");
        }

        static bool HasWord(string n, string word) {
            if (string.IsNullOrEmpty(n) || string.IsNullOrEmpty(word)) return false;
            return (" " + n + " ").IndexOf(" " + word + " ", StringComparison.Ordinal) >= 0;
        }

        static bool MentionsAny(string n, string[] names) {
            for (int i = 0; i < names.Length; i++)
                if (HasWord(n, names[i])) return true;
            return false;
        }

        static bool HasSearchVerb(string n) {
            return HasWord(n, "знайди") || HasWord(n, "пошукай") || HasWord(n, "погугли") ||
                HasWord(n, "search") || HasWord(n, "find") || HasWord(n, "пошук");
        }

        static bool HasOpenVerb(string n) {
            return HasWord(n, "відкрий") || HasWord(n, "відкрити") || HasWord(n, "відкрийте") ||
                HasWord(n, "открой") || HasWord(n, "open") || HasWord(n, "запусти") ||
                HasWord(n, "запустити") || HasWord(n, "start") || HasWord(n, "launch") ||
                HasWord(n, "зайти") || HasWord(n, "зайди");
        }

        static bool HasYoutubeVenue(string n) {
            return Regex.IsMatch(n,
                @"(?:^| )(?:на|в|у|on|at)\s+(?:youtube|ютуб\w*)\b|(?:youtube|ютуб\w*)\s+(?:search|пошук)|\bsearch\s+(?:on\s+)?youtube\b",
                RegexOptions.CultureInvariant);
        }

        static bool HasGoogleVenue(string n) {
            return Regex.IsMatch(n,
                @"(?:^| )(?:на|в|у|in)\s+(?:google|гугл)\b|^погугли\b|\bgoogle\s+search\b|\bпогугли\b",
                RegexOptions.CultureInvariant);
        }

        static bool HasYoutubeVideoPhrase(string n) {
            return (n.IndexOf("відео про", StringComparison.Ordinal) >= 0 ||
                n.IndexOf("видео про", StringComparison.Ordinal) >= 0) &&
                MentionsAny(n, YoutubeNames);
        }

        static bool IsExactSiteHome(string n, string[] names) {
            if (HasSearchVerb(n) || IsDefinitionQuestion(n) || IsCapabilityOnly(n))
                return false;
            if (!MentionsAny(n, names)) return false;
            if (names != GoogleNames && MentionsAny(n, GoogleNames)) return false;
            if (names != YoutubeNames && MentionsAny(n, YoutubeNames)) return false;
            if (names != GithubNames && MentionsAny(n, GithubNames)) return false;
            string rest = Cut(n, Concat(OpenWords, names));
            return rest.Length == 0;
        }

        static bool IsEditorCommand(string n) {
            if (!(HasWord(n, "редактор") || n.Contains("foxstyle") || n.Contains("node editor")))
                return false;
            return HasOpenVerb(n) || n == "редактор" || n == "foxstyle" || n == "node editor";
        }

        static bool TryOpenHostOnly(string n, string filled, out string url) {
            url = "";
            if (HasSearchVerb(n) || IsDefinitionQuestion(n) || IsCapabilityOnly(n))
                return false;
            string rest = StripLead(filled, new[] {
                "відкрий", "відкрити", "відкрийте", "открой", "open", "сайт"
            });
            rest = rest.Trim(' ', ',', ';', '?', '!');
            if (rest.Length == 0 || rest.IndexOf(' ') >= 0) return false;
            return AssistantUrl.TryHttpUrl(rest, out url);
        }

        static AssistantStep TryWebSearch(string n, string filled, string browser) {
            if (HasYoutubeVenue(n) && !HasGoogleVenue(n)) return null;
            if (!(HasGoogleVenue(n) || HasWord(n, "погугли") ||
                ((n.StartsWith("знайди ") || n.StartsWith("пошукай ") ||
                n.StartsWith("search ") || n.StartsWith("find ")) && !HasYoutubeVenue(n))))
                return null;
            string q = StripLead(filled, new[] {
                "знайди в google", "знайди у google", "знайди в гугл", "знайди у гугл",
                "пошукай в google", "пошукай у google", "пошукай в гугл", "пошукай у гугл",
                "погугли", "search google for", "search", "знайди", "пошукай", "пошук",
                "в google", "у google", "в гугл", "у гугл"
            });
            q = Regex.Replace(q, @"(?i)\s+(?:в|у|in)\s+(google|гугл)\s*$", "").Trim();
            q = q.Trim(' ', ',', '.', ':', '—', '?');
            if (q.Length == 0) return null;
            return new AssistantStep {
                action = "SearchWeb", query = q, url = AssistantUrl.GoogleSearch(q),
                browser = browser, say = "Відкриваю пошук."
            };
        }

        static AssistantStep TryYoutubeSearch(string n, string filled, string browser) {
            if (HasGoogleVenue(n)) return null;
            if (!HasYoutubeVenue(n) && !HasYoutubeVideoPhrase(n)) return null;
            if (!HasSearchVerb(n) && !HasYoutubeVideoPhrase(n)) return null;
            string q = ExtractYoutubeQuery(n, filled);
            if (q.Length == 0) return null;
            return new AssistantStep {
                action = "SearchYouTube", query = q, url = AssistantUrl.YoutubeSearch(q),
                browser = browser, say = "Шукаю на YouTube «" + q + "»."
            };
        }

        static string ExtractYoutubeQuery(string n, string filled) {
            Match m = Regex.Match(n,
                @"^(?:знайди|пошукай|search|find)\s+(?:на|в|у|on)\s+(?:youtube|ютуб\w*)\s+(?:відео\s+)?(?:про\s+)?(.+)$",
                RegexOptions.CultureInvariant);
            if (m.Success) return CleanQuery(m.Groups[1].Value);
            m = Regex.Match(n,
                @"^(?:знайди|пошукай|search|find)\s+відео\s+(?:про\s+)?(.+?)\s+(?:на|в|у|on)\s+(?:youtube|ютуб\w*)$",
                RegexOptions.CultureInvariant);
            if (m.Success) return CleanQuery(m.Groups[1].Value);
            m = Regex.Match(n,
                @"^відео\s+про\s+(.+?)\s+(?:на|в|у|on)\s+(?:youtube|ютуб\w*)$",
                RegexOptions.CultureInvariant);
            if (m.Success) return CleanQuery(m.Groups[1].Value);
            string q = StripLead(filled, new[] {
                "знайди відео про", "знайди відео", "пошукай відео", "знайди на youtube",
                "пошукай на youtube", "find video", "search youtube"
            });
            q = StripTail(q, new[] {
                "на youtube", "on youtube", "в youtube", "у youtube",
                "на ютуб", "на ютубі", "в ютуб", "у ютуб"
            });
            q = Regex.Replace(q, @"(?i)\b(youtube|ютуб\w*)\b", " ").Trim();
            return CleanQuery(q);
        }

        static string CleanQuery(string q) {
            q = Regex.Replace(q ?? "", @"\s+", " ").Trim(' ', ',', '.', ':', '—', '-', '?');
            return q;
        }

        static AssistantStep TryApp(string n, string filled, AssistantConfig cfg) {
            if (IsDefinitionQuestion(n) || IsCapabilityOnly(n) || HasSearchVerb(n))
                return null;
            if (!HasOpenVerb(n) && !IsKnownAppToken(n)) return null;
            string rest = StripLead(filled, new[] {
                "відкрий програму", "запусти програму", "відкрий", "відкрити", "відкрийте",
                "открой", "open", "запусти", "start", "launch"
            });
            rest = rest.Trim(' ', ',', '.');
            if (rest.Length == 0) return null;
            if (WordCount(rest) > 3) return null;
            string low = AssistantGuard.Normalize(rest);
            if (IsKnownAppToken(low)) {
                return new AssistantStep {
                    action = "OpenApplication", name = AssistantApps.Alias(rest, cfg),
                    say = "Запускаю " + rest + "."
                };
            }
            string alias = AssistantApps.Alias(rest, cfg);
            if (!string.Equals(alias, rest, StringComparison.OrdinalIgnoreCase)) {
                return new AssistantStep {
                    action = "OpenApplication", name = alias, say = "Запускаю " + alias + "."
                };
            }
            AssistantAppHit[] hits = AssistantApps.Resolve(rest, cfg);
            if (hits.Length == 1) {
                return new AssistantStep {
                    action = "OpenApplication", name = hits[0].name, path = hits[0].path,
                    say = "Запускаю " + hits[0].name + "."
                };
            }
            if (hits.Length > 1) {
                return new AssistantStep {
                    action = "AskClarify",
                    say = "Кілька програм: " + JoinNames(hits) + ". Яку відкрити?"
                };
            }
            if (HasOpenVerb(n) && WordCount(rest) <= 3) {
                return new AssistantStep {
                    action = "FindLauncherItem", name = rest,
                    say = "Шукаю «" + rest + "» у меню."
                };
            }
            return null;
        }

        static bool IsKnownAppToken(string n) {
            string low = AssistantGuard.Normalize(n);
            return low == "chrome" || low == "хром" || low == "firefox" || low == "фаєрфокс" ||
                low == "файрфокс" || low == "edge" || low == "едж" ||
                low == "cursor" || low == "курсор" || low == "winbox" ||
                low == "вінбокс" || low == "notepad" || low == "блокнот";
        }

        static int WordCount(string text) {
            string t = (text ?? "").Trim();
            if (t.Length == 0) return 0;
            return Regex.Split(t, @"\s+").Length;
        }

        static string[] Concat(string[] a, string[] b) {
            var r = new string[a.Length + b.Length];
            a.CopyTo(r, 0);
            b.CopyTo(r, a.Length);
            return r;
        }

        static AssistantStep TryFolder(string n, AssistantConfig cfg) {
            if (n.Contains("мій проєкт") || n.Contains("мій проект") || n.Contains("my project")) {
                return new AssistantStep {
                    action = "OpenFolder", path = "project",
                    say = "Відкриваю папку проєкту."
                };
            }
            if (cfg != null && cfg.aliases != null) {
                for (int i = 0; i < cfg.aliases.Count; i++) {
                    AssistantAlias a = cfg.aliases[i];
                    if (a == null || a.kind != "folder") continue;
                    if (n.IndexOf(AssistantGuard.Normalize(a.name), StringComparison.Ordinal) >= 0)
                        return new AssistantStep { action = "OpenFolder", path = a.value, name = a.name };
                }
            }
            return null;
        }

        static AssistantStep TryNote(string n, string filled) {
            if (!(n.Contains("нотатка") || n.Contains("запиши") || n.StartsWith("note ")))
                return null;
            string text = StripLead(filled, new[] { "нотатка", "запиши", "note", "запам'ятай", "запам’ятай" });
            if (text.Length == 0) return null;
            return new AssistantStep { action = "CreateNote", text = text, say = "Записую нотатку." };
        }

        static AssistantStep TryTimer(string n, string filled) {
            if (!n.Contains("таймер") && !n.Contains("timer")) return null;
            int seconds = ParseDuration(filled);
            if (seconds < 1) seconds = 60;
            return new AssistantStep {
                action = "SetTimer", seconds = seconds,
                say = "Ставлю таймер на " + seconds + " с."
            };
        }

        public static int ParseDuration(string text) {
            string n = AssistantGuard.Normalize(text);
            n = n.Replace("п'ять", "5").Replace("п’ять", "5").Replace("пять", "5");
            n = n.Replace("двадцять п'ять", "25").Replace("двадцять пять", "25")
                .Replace("двадцять п’ять", "25");
            var words = new Dictionary<string, int>();
            words["одну"] = 1; words["один"] = 1; words["два"] = 2; words["три"] = 3;
            words["чотири"] = 4; words["шість"] = 6; words["сім"] = 7; words["вісім"] = 8;
            words["дев'ять"] = 9; words["десять"] = 10; words["п'ятнадцять"] = 15;
            words["двадцять"] = 20; words["тридцять"] = 30; words["сорок п'ять"] = 45;
            words["шістдесят"] = 60;
            foreach (var kv in words)
                n = n.Replace(kv.Key, kv.Value.ToString());
            Match m = Regex.Match(n, @"(\d+)\s*(хв|хвилин|min|minutes|сек|секунд|sec|s)?");
            if (!m.Success) return 0;
            int v = int.Parse(m.Groups[1].Value);
            string u = m.Groups[2].Value;
            if (u.StartsWith("сек") || u == "s" || u.StartsWith("sec")) return ClampSec(v);
            return ClampSec(v * 60);
        }

        static int ClampSec(int v) {
            if (v < 1) return 60;
            if (v > 3600) return 3600;
            return v;
        }

        static string TakeBrowser(string text, out string browser) {
            browser = "";
            Match m = BrowserAt.Match(text ?? "");
            if (!m.Success) return text ?? "";
            browser = NormBrowser(m.Groups[1].Value);
            return (text ?? "").Substring(0, m.Index).Trim();
        }

        static string NormBrowser(string raw) {
            string n = AssistantGuard.Normalize(raw);
            if (n == "хром") return "chrome";
            if (n == "фаєрфокс" || n == "файрфокс") return "firefox";
            if (n == "едж") return "edge";
            return n;
        }

        static AssistantStep Site(string action, string url, string query, string browser, string say) {
            return new AssistantStep {
                action = action, url = url, query = query ?? "", browser = browser ?? "", say = say
            };
        }

        static string Cut(string n, string[] words) {
            string t = " " + n + " ";
            for (int i = 0; i < words.Length; i++)
                t = t.Replace(" " + words[i] + " ", " ");
            return Regex.Replace(t, @"\s+", " ").Trim();
        }

        static string StripLead(string text, string[] keys) {
            string t = text ?? "";
            string lower = t.ToLowerInvariant();
            int len = 0;
            for (int i = 0; i < keys.Length; i++) {
                if (lower.StartsWith(keys[i]) && keys[i].Length > len) len = keys[i].Length;
            }
            if (len > 0) t = t.Substring(len).Trim(' ', ',', '.', ':', '-', '—');
            return t.Trim();
        }

        static string StripTail(string text, string[] keys) {
            string t = text ?? "";
            string lower = t.ToLowerInvariant();
            for (int i = 0; i < keys.Length; i++)
                if (lower.EndsWith(keys[i]))
                    return t.Substring(0, t.Length - keys[i].Length).Trim();
            return t;
        }

        static string JoinNames(AssistantAppHit[] hits) {
            var sb = new StringBuilder();
            int n = Math.Min(4, hits.Length);
            for (int i = 0; i < n; i++) {
                if (i > 0) sb.Append(", ");
                sb.Append(hits[i].name);
            }
            return sb.ToString();
        }
    }

    public static class AssistantTrace {
        public static string LastHandler = "";

        public static bool Enabled(AssistantConfig cfg) {
            if (cfg != null && cfg.debugTrace) return true;
            try {
                string ev = Environment.GetEnvironmentVariable("FOXASSIST_TRACE");
                return ev == "1" || string.Equals(ev, "on", StringComparison.OrdinalIgnoreCase);
            } catch { return false; }
        }

        public static void Reset() { LastHandler = ""; }

        public static void Note(string handler) {
            if (string.IsNullOrEmpty(handler)) return;
            if (LastHandler.Length == 0) LastHandler = handler;
            else if (LastHandler.IndexOf(handler, StringComparison.Ordinal) < 0)
                LastHandler = LastHandler + "," + handler;
        }

        public static void Write(string userText, bool usedLlm, string modelReply,
            string validation, AssistantPlan plan, string executed) {
            try {
                string dir = FoxPaths.RuntimeDir();
                if (string.IsNullOrEmpty(dir)) {
                    dir = Path.Combine(Environment.GetFolderPath(
                        Environment.SpecialFolder.LocalApplicationData), "FoxTerminal", "foxos");
                }
                Directory.CreateDirectory(dir);
                string path = Path.Combine(dir, "assistant-trace.log");
                var sb = new StringBuilder();
                sb.AppendLine("---- " + DateTime.Now.ToString("s") + " ----");
                sb.AppendLine("user: " + OneLine(userText));
                sb.AppendLine("handler: " + (plan != null && plan.handler.Length > 0
                    ? plan.handler : LastHandler));
                sb.AppendLine("llm: " + (usedLlm ? "yes" : "no"));
                if (usedLlm) sb.AppendLine("model: " + OneLine(Clip(modelReply, 500)));
                sb.AppendLine("validation: " + OneLine(validation ?? ""));
                if (plan != null) {
                    sb.AppendLine("plan: source=" + plan.source + " kind=" + plan.kind
                        + " steps=" + plan.steps.Count + " say=" + OneLine(plan.say));
                    for (int i = 0; i < plan.steps.Count; i++) {
                        AssistantStep s = plan.steps[i];
                        sb.AppendLine("  action=" + s.action + " url=" + s.url
                            + " q=" + OneLine(s.query) + " name=" + s.name);
                    }
                }
                sb.AppendLine("executed: " + OneLine(executed ?? ""));
                File.AppendAllText(path, sb.ToString(), new UTF8Encoding(false));
            } catch { }
        }

        static string OneLine(string s) {
            return (s ?? "").Replace("\r", " ").Replace("\n", " ");
        }
        static string Clip(string s, int n) {
            if (s == null) return "";
            return s.Length <= n ? s : s.Substring(0, n) + "...";
        }
    }
}
