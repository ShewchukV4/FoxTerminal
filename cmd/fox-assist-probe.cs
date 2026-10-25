using System;
using System.Text;
using FoxOs.Assistant;

namespace FoxOs.AssistantProbe {
    static class Program {
        static int Main(string[] args) {
            Console.OutputEncoding = Encoding.UTF8;
            if (args.Length > 0 &&
                string.Equals(args[0], "-test", StringComparison.OrdinalIgnoreCase)) {
                AssistantSelfTest.Run();
                Console.WriteLine("assistant self-test ok");
                return 0;
            }
            var cfg = new AssistantConfig();
            var talk = new AssistantTalk();
            string[] phrases = {
                "Відкрий YouTube",
                "Знайди на YouTube відео про налаштування MikroTik",
                "Пошукай у Google, чому YouTube не працює",
                "Не відкривай YouTube, відкрий GitHub",
                "Що таке YouTube?",
                "Відкрий YouTube і потім Cursor",
                "Відкрий YouTube, хоча ні, краще Google",
                "Знайди на YouTube уроки C#, але поки не відкривай, просто скажи, чи ти це можеш",
                "Погугли, як налаштувати MikroTik",
                "Відкрий Chrome",
                "Не відкривай Chrome, відкрий Firefox",
                "Відкрий github.com"
            };
            bool model = args.Length > 0 &&
                string.Equals(args[0], "-model", StringComparison.OrdinalIgnoreCase);
            bool real = args.Length > 0 &&
                string.Equals(args[0], "-real", StringComparison.OrdinalIgnoreCase);
            if (real) {
                RunReal(cfg);
                return 0;
            }
            for (int i = 0; i < phrases.Length; i++) {
                Console.WriteLine("====");
                Console.WriteLine("IN: " + phrases[i]);
                AssistantPlan p = AssistantUnderstand.Build(phrases[i], cfg, talk);
                Console.WriteLine("source=" + p.source + " kind=" + p.kind
                    + " handler=" + p.handler
                    + " steps=" + p.steps.Count
                    + " say=" + p.say
                    + " err=" + p.error);
                for (int s = 0; s < p.steps.Count; s++) {
                    AssistantStep st = p.steps[s];
                    Console.WriteLine("  [" + st.id + "] " + st.action
                        + " url=" + st.url
                        + " q=" + st.query
                        + " name=" + st.name
                        + " browser=" + st.browser);
                }
                if (!model) continue;
                string json;
                var client = new AssistantClient();
                string prompt = AssistantUnderstand.ModelUser(phrases[i], cfg, talk);
                if (!client.Chat(cfg, AssistantIntents.ModelSystem, prompt, 50000, out json)) {
                    Console.WriteLine("MODEL_ERR: " + client.LastError);
                } else {
                    Console.WriteLine("MODEL_RAW: " + Trim(json, 800));
                    AssistantPlan ai = AssistantIntents.FromModelJson(json);
                    Console.WriteLine("MODEL_PLAN source=" + ai.source + " kind=" + ai.kind
                        + " steps=" + ai.steps.Count + " say=" + ai.say + " err=" + ai.error);
                    for (int s = 0; s < ai.steps.Count; s++) {
                        AssistantStep st = ai.steps[s];
                        Console.WriteLine("  ai[" + st.id + "] " + st.action
                            + " url=" + st.url + " q=" + st.query + " name=" + st.name);
                    }
                }
            }
            return 0;
        }

        static void RunReal(AssistantConfig cfg) {
            var talk = new AssistantTalk();
            string[] texts = {
                "Відкрий YouTube",
                "Знайди на YouTube відео про налаштування MikroTik",
                "Пошукай у Google, чому YouTube не працює",
                "Не відкривай YouTube, відкрий GitHub"
            };
            for (int i = 0; i < texts.Length; i++) {
                AssistantPlan p = AssistantUnderstand.Build(texts[i], cfg, talk);
                p = AssistantUnderstand.GuardPlan(texts[i], p);
                Console.WriteLine("REAL IN: " + texts[i]);
                Console.WriteLine(" handler=" + p.handler + " source=" + p.source
                    + " steps=" + p.steps.Count);
                bool openedYoutubeHome = false;
                bool openedYoutubeSearch = false;
                bool openedGoogle = false;
                bool openedGithub = false;
                for (int s = 0; s < p.steps.Count; s++) {
                    AssistantStep st = p.steps[s];
                    string err = AssistantActions.Execute(st, cfg, null);
                    string u = st.url ?? "";
                    Console.WriteLine("  exec " + st.action + " " + u
                        + (err.Length > 0 ? " ERR=" + err : " OK " + st.result));
                    if (u.IndexOf("youtube.com/results", StringComparison.OrdinalIgnoreCase) >= 0)
                        openedYoutubeSearch = true;
                    else if (u.IndexOf("youtube.com", StringComparison.OrdinalIgnoreCase) >= 0)
                        openedYoutubeHome = true;
                    if (u.IndexOf("google.com/search", StringComparison.OrdinalIgnoreCase) >= 0)
                        openedGoogle = true;
                    if (u.IndexOf("github.com", StringComparison.OrdinalIgnoreCase) >= 0)
                        openedGithub = true;
                }
                Console.WriteLine("  flags homeYT=" + openedYoutubeHome
                    + " searchYT=" + openedYoutubeSearch
                    + " google=" + openedGoogle
                    + " github=" + openedGithub);
            }
        }

        static string Trim(string s, int n) {
            if (s == null) return "";
            return s.Length <= n ? s : s.Substring(0, n) + "...";
        }
    }
}
