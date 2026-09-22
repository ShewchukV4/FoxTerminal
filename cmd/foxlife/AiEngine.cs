// Built-in assistant: always-on local analyser, optional Ollama polish.

using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using FoxOs.Sdk;

namespace FoxOs.Life {

    public class AiBrief {
        public string source;
        public List<string> lines;
        public List<ReminderDoc> suggestions;

        public AiBrief() {
            source = "local";
            lines = new List<string>();
            suggestions = new List<ReminderDoc>();
        }
    }

    public class MonthSum {
        public double income;
        public double expense;
        public string topCat;
        public double topAmt;
        public int txCount;
        public string month;
    }

    public class AiEngine {
        readonly LifeStore store;
        readonly FoxAiClient client = new FoxAiClient();

        public AiEngine(LifeStore store) {
            this.store = store;
        }

        public MonthSum Month(string yyyyMm) {
            MonthSum s = new MonthSum();
            s.month = yyyyMm;
            s.topCat = "";
            Dictionary<string, double> cat = new Dictionary<string, double>();
            List<TxDoc> txs = store.Data.txs;
            for (int i = 0; i < txs.Count; i++) {
                TxDoc t = txs[i];
                if (t == null || string.IsNullOrEmpty(t.date)) continue;
                if (t.date.Length < 7 || t.date.Substring(0, 7) != yyyyMm) continue;
                s.txCount++;
                if (t.type == "income") s.income += t.amount;
                else {
                    s.expense += t.amount;
                    string k = string.IsNullOrEmpty(t.category) ? "other" : t.category;
                    if (!cat.ContainsKey(k)) cat[k] = 0;
                    cat[k] += t.amount;
                }
            }
            foreach (KeyValuePair<string, double> kv in cat) {
                if (kv.Value > s.topAmt) {
                    s.topAmt = kv.Value;
                    s.topCat = kv.Key;
                }
            }
            return s;
        }

        public string CatLabel(string id) {
            if (string.IsNullOrEmpty(id)) return I18n.T("cat.other");
            string key = "cat." + id;
            string t = I18n.T(key);
            return t == key ? id : t;
        }

        public string Money(double n) {
            string cur = store.Data.meta.currency;
            if (string.IsNullOrEmpty(cur)) cur = "UAH";
            return n.ToString("N0", CultureInfo.CurrentCulture) + " " + cur;
        }

        public AiBrief LocalBrief() {
            return Local();
        }

        public AiBrief Analyse() {
            AiBrief brief = Local();
            LifeMeta meta = store.Data.meta;
            string mode = meta.aiMode;
            if (mode == "local") return brief;
            client.Model = string.IsNullOrEmpty(meta.model) ? "gemma3:1b" : meta.model;
            if (!string.IsNullOrEmpty(meta.ollamaUrl)) client.Url = meta.ollamaUrl;
            string polished;
            if (client.TryChat(SystemPrompt(), Snapshot(), out polished)) {
                brief.source = "ollama";
                List<string> lines = SplitLines(polished);
                if (lines.Count > 0) brief.lines = lines;
            } else if (mode == "ollama") {
                brief.lines.Insert(0, I18n.Lang == "en"
                    ? "Ollama is offline — showing local analysis."
                    : "Ollama не відповідає — локальний аналіз.");
            }
            return brief;
        }

        public string SummarizeNote(NoteDoc n) {
            if (n == null) return "";
            List<string> bits = new List<string>();
            if (n.kind == "check") {
                int done = 0;
                int all = n.items != null ? n.items.Count : 0;
                if (n.items != null) {
                    for (int i = 0; i < n.items.Count; i++) {
                        if (n.items[i] != null && n.items[i].done) done++;
                    }
                }
                bits.Add(I18n.Lang == "en"
                    ? ("Checklist " + done + "/" + all)
                    : ("Чекліст " + done + "/" + all));
            }
            string body = n.body ?? "";
            string[] lines = body.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
            int take = Math.Min(3, lines.Length);
            for (int i = 0; i < take; i++) bits.Add("• " + lines[i].Trim());
            if (HasDeadline(body) || HasDeadline(n.title)) {
                bits.Add(I18n.Lang == "en" ? "• Has a deadline cue" : "• Є дедлайн");
            }
            if (bits.Count == 0) return n.title;
            return string.Join("\n", bits.ToArray());
        }

        public List<ReminderDoc> SuggestReminders() {
            List<ReminderDoc> outp = new List<ReminderDoc>();
            DateTime now = DateTime.Now;
            string monthDue = now.ToString("yyyy-MM", CultureInfo.InvariantCulture) + "-15";
            if (now.Day >= 10 && now.Day <= 20 && !HasReminderText("бюджет") && !HasReminderText("budget")) {
                outp.Add(MakeRem(I18n.Lang == "en"
                    ? "Update the budget on the 15th"
                    : "15 числа потрібно оновити бюджет", monthDue));
            }
            List<NoteDoc> notes = store.Data.notes;
            for (int i = 0; i < notes.Count; i++) {
                NoteDoc n = notes[i];
                if (n == null) continue;
                string blob = (n.title ?? "") + "\n" + (n.body ?? "");
                if (LooksUnfinished(n) && !HasReminderText(n.title)) {
                    string title = n.title ?? "";
                    string text = I18n.Lang == "en"
                        ? ("Finish the project from the note '" + title + "'")
                        : ("Завершити проєкт із нотатки «" + title + "»");
                    outp.Add(MakeRem(text, LifeStore.Today()));
                }
                Match m = Regex.Match(blob, @"(\d{1,2})[./](\d{1,2})");
                if (m.Success) {
                    int day = 0, mon = 0;
                    int.TryParse(m.Groups[1].Value, out day);
                    int.TryParse(m.Groups[2].Value, out mon);
                    if (day >= 1 && day <= 31 && mon >= 1 && mon <= 12) {
                        string due = now.Year.ToString("0000", CultureInfo.InvariantCulture) + "-"
                            + mon.ToString("00", CultureInfo.InvariantCulture) + "-"
                            + day.ToString("00", CultureInfo.InvariantCulture);
                        string text = I18n.Lang == "en"
                            ? ("Follow up on '" + n.title + "'")
                            : ("Повернутись до «" + n.title + "»");
                        if (!HasReminderText(n.title)) outp.Add(MakeRem(text, due));
                    }
                }
            }
            return outp;
        }

        public void MergeSuggestions(List<ReminderDoc> extra) {
            if (extra == null) return;
            bool changed = false;
            for (int i = 0; i < extra.Count; i++) {
                ReminderDoc r = extra[i];
                if (r == null || string.IsNullOrEmpty(r.text)) continue;
                if (HasReminderText(r.text)) continue;
                store.Data.reminders.Add(r);
                changed = true;
            }
            if (changed) store.SaveReminders();
        }

        public void ToastDue() {
            string today = LifeStore.Today();
            List<ReminderDoc> list = store.Data.reminders;
            for (int i = 0; i < list.Count; i++) {
                ReminderDoc r = list[i];
                if (r == null || r.done) continue;
                if (r.due == today) FoxToast.Show(r.text);
            }
        }

        AiBrief Local() {
            AiBrief b = new AiBrief();
            b.source = "local";
            string ym = DateTime.Now.ToString("yyyy-MM", CultureInfo.InvariantCulture);
            MonthSum s = Month(ym);
            bool en = I18n.Lang == "en";
            if (s.txCount == 0 && store.Data.notes.Count == 0) {
                b.lines.Add(I18n.T("ai.empty"));
                return b;
            }
            b.lines.Add(en
                ? ("This month: +" + Money(s.income) + " / −" + Money(s.expense))
                : ("Цього місяця: +" + Money(s.income) + " / −" + Money(s.expense)));
            b.lines.Add(en
                ? ("Balance " + Money(s.income - s.expense))
                : ("Баланс " + Money(s.income - s.expense)));
            if (!string.IsNullOrEmpty(s.topCat) && s.topAmt > 0) {
                string cat = CatLabel(s.topCat);
                b.lines.Add(en
                    ? ("Most spent on " + cat + " — " + Money(s.topAmt) + ". Try cutting 10%.")
                    : ("Найбільше витрачено на «" + cat + "» — " + Money(s.topAmt) + ". Спробуй зменшити на 10%."));
            }
            if (s.expense > 0 && s.income > 0) {
                double ratio = s.expense / s.income;
                if (ratio > 0.8) {
                    b.lines.Add(en
                        ? "Spending is high versus income this month."
                        : "Витрати цього місяця близькі до доходів.");
                } else {
                    b.lines.Add(en
                        ? "Spending looks contained versus income."
                        : "Витрати поки що в межах доходів.");
                }
            }
            string noteLine = NoteDigest();
            if (!string.IsNullOrEmpty(noteLine)) b.lines.Add(noteLine);
            b.suggestions = SuggestReminders();
            return b;
        }

        string NoteDigest() {
            List<NoteDoc> notes = store.Data.notes;
            if (notes.Count == 0) return "";
            int open = 0;
            List<string> titles = new List<string>();
            for (int i = 0; i < notes.Count; i++) {
                NoteDoc n = notes[i];
                if (n == null) continue;
                if (LooksUnfinished(n)) {
                    open++;
                    if (titles.Count < 2) titles.Add(n.title);
                }
            }
            if (open == 0) {
                return I18n.Lang == "en"
                    ? ("Notes: " + notes.Count + " saved.")
                    : ("Замітки: " + notes.Count + " збережено.");
            }
            return I18n.Lang == "en"
                ? ("Open tasks in " + string.Join(", ", titles.ToArray()) + ".")
                : ("Відкриті завдання в «" + string.Join("», «", titles.ToArray()) + "».");
        }

        bool LooksUnfinished(NoteDoc n) {
            if (n.kind == "check" && n.items != null) {
                for (int i = 0; i < n.items.Count; i++) {
                    if (n.items[i] != null && !n.items[i].done) return true;
                }
            }
            string blob = ((n.title ?? "") + "\n" + (n.body ?? "")).ToLowerInvariant();
            return blob.IndexOf("заверш") >= 0 || blob.IndexOf("finish") >= 0
                || blob.IndexOf("todo") >= 0 || blob.IndexOf("дедлайн") >= 0
                || blob.IndexOf("deadline") >= 0;
        }

        bool HasDeadline(string text) {
            if (string.IsNullOrEmpty(text)) return false;
            string t = text.ToLowerInvariant();
            return Regex.IsMatch(t, @"\d{1,2}[./]\d{1,2}")
                || t.IndexOf("дедлайн") >= 0 || t.IndexOf("deadline") >= 0
                || t.IndexOf("до ") >= 0;
        }

        bool HasReminderText(string needle) {
            if (string.IsNullOrEmpty(needle)) return false;
            string n = needle.ToLowerInvariant();
            List<ReminderDoc> list = store.Data.reminders;
            for (int i = 0; i < list.Count; i++) {
                if (list[i] == null || string.IsNullOrEmpty(list[i].text)) continue;
                string t = list[i].text.ToLowerInvariant();
                if (t.IndexOf(n) >= 0 || n.IndexOf(t) >= 0) return true;
            }
            return false;
        }

        ReminderDoc MakeRem(string text, string due) {
            ReminderDoc r = new ReminderDoc();
            r.id = LifeStore.NewId();
            r.text = text;
            r.due = due;
            r.source = "ai";
            r.done = false;
            r.created = LifeStore.Now();
            return r;
        }

        string SystemPrompt() {
            return I18n.Lang == "en"
                ? "You are the FOXOS Life assistant. Reply in 4 short bullets: month money, top spend + 10% tip, note tasks, one reminder sentence. No markdown."
                : "Ти ШІ-помічник FOXOS Life. Відповідай 4 короткими рядками: гроші за місяць, найбільша витрата + порада −10%, завдання з нотаток, одне нагадування. Без markdown.";
        }

        string Snapshot() {
            StringBuilder sb = new StringBuilder();
            string ym = DateTime.Now.ToString("yyyy-MM", CultureInfo.InvariantCulture);
            MonthSum s = Month(ym);
            sb.Append("month=").Append(ym)
                .Append(" income=").Append(s.income)
                .Append(" expense=").Append(s.expense)
                .Append(" top=").Append(s.topCat)
                .Append("/").Append(s.topAmt).Append("\n");
            for (int i = 0; i < store.Data.notes.Count && i < 6; i++) {
                NoteDoc n = store.Data.notes[i];
                sb.Append("NOTE ").Append(n.title).Append(": ").Append(SummarizeNote(n)).Append("\n");
            }
            return sb.ToString();
        }

        static List<string> SplitLines(string text) {
            List<string> list = new List<string>();
            if (string.IsNullOrEmpty(text)) return list;
            string[] raw = text.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
            for (int i = 0; i < raw.Length; i++) {
                string line = raw[i].Trim();
                line = line.TrimStart('-', '*', '•', ' ');
                if (line.Length == 0) continue;
                list.Add(line);
                if (list.Count >= 6) break;
            }
            return list;
        }
    }
}
