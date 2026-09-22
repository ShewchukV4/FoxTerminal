// FoxLife documents persisted through FOXOS storage.

using System;
using System.Collections.Generic;

namespace FoxOs.Life {

    public class LifeMeta {
        public string lang;
        public string currency;
        public bool seeded;
        public string aiMode;
        public string model;
        public string ollamaUrl;
        public string theme;     // FoxTheme id; null/empty = "default"

        public static LifeMeta Default() {
            LifeMeta m = new LifeMeta();
            m.theme = "default";
            m.lang = "ua";
            m.currency = "UAH";
            m.seeded = false;
            m.aiMode = "auto";
            m.model = "gemma3:1b";
            m.ollamaUrl = "http://127.0.0.1:11434/api/chat";
            return m;
        }
    }

    public class NoteItem {
        public string text;
        public bool done;
    }

    public class NoteDoc {
        public string id;
        public string title;
        public string body;
        public string category;
        public string kind;
        public List<string> tags;
        public List<NoteItem> items;
        public string created;
        public string updated;

        public NoteDoc() {
            tags = new List<string>();
            items = new List<NoteItem>();
        }
    }

    public class TxDoc {
        public string id;
        public string date;
        public string type;
        public string category;
        public double amount;
        public string note;
    }

    public class TableCol {
        public string id;
        public string name;
        public string type;
    }

    public class TableRow {
        public string id;
        public Dictionary<string, string> cells;

        public TableRow() {
            cells = new Dictionary<string, string>();
        }
    }

    public class TableDoc {
        public string id;
        public string name;
        public List<TableCol> columns;
        public List<TableRow> rows;
        public string created;

        public TableDoc() {
            columns = new List<TableCol>();
            rows = new List<TableRow>();
        }
    }

    public class ReminderDoc {
        public string id;
        public string text;
        public string due;
        public string source;
        public bool done;
        public string created;
    }

    public class LifeData {
        public LifeMeta meta;
        public List<NoteDoc> notes;
        public List<TxDoc> txs;
        public List<TableDoc> tables;
        public List<ReminderDoc> reminders;

        public LifeData() {
            meta = LifeMeta.Default();
            notes = new List<NoteDoc>();
            txs = new List<TxDoc>();
            tables = new List<TableDoc>();
            reminders = new List<ReminderDoc>();
        }
    }
}
