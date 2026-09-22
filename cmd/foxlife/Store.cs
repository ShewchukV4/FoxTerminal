// LifeStore: load / save / seed the four collections as FOXOS JSON documents.

using System;
using System.Collections.Generic;
using System.Globalization;
using FoxOs.Sdk;

namespace FoxOs.Life {

    public class LifeStore {
        readonly FoxStore raw;
        public LifeData Data;

        public LifeStore() {
            raw = new FoxStore("foxlife");
            Data = new LifeData();
            Load();
            if (!Data.meta.seeded) {
                Seed.Apply(Data);
                Data.meta.seeded = true;
                Save();
            }
        }

        public string Root { get { return raw.Root; } }

        public void Load() {
            LifeMeta meta = raw.Get<LifeMeta>("meta", null);
            if (meta != null) Data.meta = meta;
            else Data.meta = LifeMeta.Default();

            List<NoteDoc> notes = raw.Get<List<NoteDoc>>("notes", null);
            Data.notes = notes != null ? notes : new List<NoteDoc>();
            List<TxDoc> txs = raw.Get<List<TxDoc>>("txs", null);
            Data.txs = txs != null ? txs : new List<TxDoc>();
            List<TableDoc> tables = raw.Get<List<TableDoc>>("tables", null);
            Data.tables = tables != null ? tables : new List<TableDoc>();
            List<ReminderDoc> rem = raw.Get<List<ReminderDoc>>("reminders", null);
            Data.reminders = rem != null ? rem : new List<ReminderDoc>();
        }

        public void Save() {
            raw.Set("meta", Data.meta);
            raw.Set("notes", Data.notes);
            raw.Set("txs", Data.txs);
            raw.Set("tables", Data.tables);
            raw.Set("reminders", Data.reminders);
        }

        public void SaveMeta() { raw.Set("meta", Data.meta); }
        public void SaveNotes() { raw.Set("notes", Data.notes); }
        public void SaveTxs() { raw.Set("txs", Data.txs); }
        public void SaveTables() { raw.Set("tables", Data.tables); }
        public void SaveReminders() { raw.Set("reminders", Data.reminders); }

        public static string NewId() {
            return Guid.NewGuid().ToString("N").Substring(0, 10);
        }

        public static string Today() {
            return DateTime.Now.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        }

        public static string Now() {
            return DateTime.Now.ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture);
        }

        // Copy the five JSON documents into backups\yyyyMMdd-HHmmss next to the store.
        public string Backup() {
            Save();
            string dir = System.IO.Path.Combine(raw.Root, "backups",
                DateTime.Now.ToString("yyyyMMdd-HHmmss", CultureInfo.InvariantCulture));
            System.IO.Directory.CreateDirectory(dir);
            string[] names = { "meta", "notes", "txs", "tables", "reminders" };
            for (int i = 0; i < names.Length; i++) {
                string src = System.IO.Path.Combine(raw.Root, names[i] + ".json");
                if (System.IO.File.Exists(src)) {
                    System.IO.File.Copy(src, System.IO.Path.Combine(dir, names[i] + ".json"), true);
                }
            }
            return dir;
        }

        public void Reseed() {
            Data.notes.Clear();
            Data.txs.Clear();
            Data.tables.Clear();
            Data.reminders.Clear();
            Seed.Apply(Data);
            Data.meta.seeded = true;
            Save();
        }
    }

    public static class Seed {
        public static void Apply(LifeData d) {
            bool ua = d.meta == null || d.meta.lang != "en";
            DateTime now = DateTime.Now;
            string m = now.ToString("yyyy-MM", CultureInfo.InvariantCulture);

            NoteDoc ideas = Note(ua ? "Ідеї" : "Ideas", ua
                ? "Зібрати FOXOS Life у нативний додаток.\nПідсумувати витрати за місяць.\nДо 15 числа оновити бюджет."
                : "Ship FOXOS Life as a native app.\nSummarise monthly spend.\nUpdate the budget by the 15th.",
                "ideas", "idea", "ai,product");
            NoteDoc shop = Note(ua ? "Покупки" : "Shopping", "", "personal", "check", "home");
            shop.items.Add(Item(ua ? "Молоко" : "Milk", true));
            shop.items.Add(Item(ua ? "Хліб" : "Bread", false));
            shop.items.Add(Item(ua ? "Кава" : "Coffee", false));
            NoteDoc proj = Note(ua ? "Проєкт" : "Project", ua
                ? "Завершити проєкт із нотатки «Ідеї».\nНаписати інструкцію запуску.\nПеревірити баланс."
                : "Finish the project from the Ideas note.\nWrite the launch notes.\nCheck the balance.",
                "work", "note", "deadline");
            d.notes.Add(ideas);
            d.notes.Add(shop);
            d.notes.Add(proj);

            d.txs.Add(Tx(m + "-01", "income", "salary", 42000, ua ? "Зарплата" : "Salary"));
            d.txs.Add(Tx(m + "-03", "expense", "food", 1840, ua ? "Продукти" : "Groceries"));
            d.txs.Add(Tx(m + "-05", "expense", "food", 620, ua ? "Обід" : "Lunch"));
            d.txs.Add(Tx(m + "-06", "expense", "transport", 450, ua ? "Метро" : "Transit"));
            d.txs.Add(Tx(m + "-08", "expense", "fun", 390, ua ? "Кіно" : "Cinema"));
            d.txs.Add(Tx(m + "-10", "expense", "home", 1200, ua ? "Комуналка" : "Utilities"));
            d.txs.Add(Tx(m + "-11", "expense", "food", 980, ua ? "Кав'ярня" : "Cafe"));

            TableDoc week = new TableDoc();
            week.id = LifeStore.NewId();
            week.name = ua ? "Тиждень" : "This week";
            week.created = LifeStore.Today();
            week.columns.Add(Col("day", ua ? "День" : "Day", "text"));
            week.columns.Add(Col("task", ua ? "Завдання" : "Task", "text"));
            week.columns.Add(Col("done", ua ? "Стан" : "Status", "text"));
            week.rows.Add(Row(week.columns, ua ? "Пн" : "Mon", ua ? "Бюджет" : "Budget", ua ? "в процесі" : "open"));
            week.rows.Add(Row(week.columns, ua ? "Ср" : "Wed", ua ? "Замітки" : "Notes", ua ? "готово" : "done"));
            week.rows.Add(Row(week.columns, ua ? "Пт" : "Fri", ua ? "Огляд витрат" : "Spend review", ua ? "план" : "planned"));
            d.tables.Add(week);

            ReminderDoc r = new ReminderDoc();
            r.id = LifeStore.NewId();
            r.text = ua ? "15 числа потрібно оновити бюджет" : "Update the budget on the 15th";
            r.due = now.Year.ToString("0000", CultureInfo.InvariantCulture) + "-"
                + now.Month.ToString("00", CultureInfo.InvariantCulture) + "-15";
            r.source = "ai";
            r.done = false;
            r.created = LifeStore.Now();
            d.reminders.Add(r);
        }

        static NoteDoc Note(string title, string body, string cat, string kind, string tags) {
            NoteDoc n = new NoteDoc();
            n.id = LifeStore.NewId();
            n.title = title;
            n.body = body;
            n.category = cat;
            n.kind = kind;
            n.created = LifeStore.Now();
            n.updated = n.created;
            if (!string.IsNullOrEmpty(tags)) {
                string[] parts = tags.Split(new[] { ',' }, StringSplitOptions.RemoveEmptyEntries);
                for (int i = 0; i < parts.Length; i++) n.tags.Add(parts[i].Trim());
            }
            return n;
        }

        static NoteItem Item(string text, bool done) {
            NoteItem i = new NoteItem();
            i.text = text;
            i.done = done;
            return i;
        }

        static TxDoc Tx(string date, string type, string cat, double amount, string note) {
            TxDoc t = new TxDoc();
            t.id = LifeStore.NewId();
            t.date = date;
            t.type = type;
            t.category = cat;
            t.amount = amount;
            t.note = note;
            return t;
        }

        static TableCol Col(string id, string name, string type) {
            TableCol c = new TableCol();
            c.id = id;
            c.name = name;
            c.type = type;
            return c;
        }

        static TableRow Row(List<TableCol> cols, params string[] values) {
            TableRow r = new TableRow();
            r.id = LifeStore.NewId();
            for (int i = 0; i < cols.Count && i < values.Length; i++) {
                r.cells[cols[i].id] = values[i];
            }
            return r;
        }
    }
}
