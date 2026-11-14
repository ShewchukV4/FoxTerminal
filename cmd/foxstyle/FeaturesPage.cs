// FOXSTYLE page — mixer / action wheel / headphone pause.
using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Text.RegularExpressions;
using System.Windows.Forms;
using FoxOs.Sdk;

namespace FoxOs.Style {

    static class FeaturesPage {
        public static FoxFeaturesDoc Draft;

        public static void Ensure() {
            if (Draft == null) Draft = FoxFeatures.Load();
        }

        public static void Build(Panel body, FoxTheme theme, Action dirty) {
            Ensure();
            FoxFeaturesDoc d = Draft;
            FoxFeatures.Normalize(d);

            AddHead(body, theme, "Звук і жести",
                "Мікшер · колесо · навушники · режим панелі. Apply → features.json.");

            AddSection(body, theme, "Панель / Огляд (Win)");
            AddHint(body, theme,
                "classic = звичайний taskbar/dock. overview = без постійної панелі; " +
                "окремий Win відкриває FOX Overview (мініатюри + панель програм). " +
                "Потрібні foxos-live і foxhotkeys. Вимкнути без GUI: foxoverview off.");
            AddToggle(body, theme, "Увімкнути режим «Огляд за Win»",
                d.overview != null && d.overview.enabled
                && string.Equals(d.overview.panelMode, "overview", StringComparison.OrdinalIgnoreCase),
                delegate(bool v) {
                    if (d.overview == null) d.overview = new OverviewFeature();
                    d.overview.enabled = v;
                    d.overview.panelMode = v ? "overview" : "classic";
                    dirty();
                });
            AddSlider(body, theme, "Швидкість відкриття Overview (ms)", 120, 400,
                d.overview != null ? d.overview.openMs : 220,
                delegate(int v) {
                    if (d.overview == null) d.overview = new OverviewFeature();
                    d.overview.openMs = v; dirty();
                });

            AddSection(body, theme, "Мікшер програм");
            AddHint(body, theme,
                "Панель гучності (dock / vol): загальна гучність + окремий повзунок на процес. " +
                "Кілька сесій однієї програми групуються. " +
                "Кнопка «пристрій (Windows)» відкриває системний мікшер — на цьому стеку немає стабільного публічного API маршрутизації.");
            AddToggle(body, theme, "Увімкнути мікшер у панелі гучності", d.mixer.enabled,
                delegate(bool v) { d.mixer.enabled = v; dirty(); });

            AddSection(body, theme, "Колесо дій біля курсора");
            AddHint(body, theme,
                "Утримуй комбінацію → колесо біля миші → відпустити = одна дія. " +
                "Центр / Esc = скасувати. Не замінює Node Launcher (Ctrl+Alt+Space). Потрібен foxnodes.");
            AddToggle(body, theme, "Увімкнути колесо", d.actionWheel.enabled,
                delegate(bool v) { d.actionWheel.enabled = v; dirty(); });
            AddToggle(body, theme, "Ctrl", d.actionWheel.ctrl,
                delegate(bool v) { d.actionWheel.ctrl = v; dirty(); });
            AddToggle(body, theme, "Alt", d.actionWheel.alt,
                delegate(bool v) { d.actionWheel.alt = v; dirty(); });
            AddToggle(body, theme, "Shift", d.actionWheel.shift,
                delegate(bool v) { d.actionWheel.shift = v; dirty(); });
            AddToggle(body, theme, "Win", d.actionWheel.win,
                delegate(bool v) { d.actionWheel.win = v; dirty(); });
            AddText(body, theme, "Клавіша (напр. W)", d.actionWheel.key, 80, delegate(string v) {
                d.actionWheel.key = string.IsNullOrWhiteSpace(v) ? "W" : v.Trim();
                dirty();
            });
            AddSlider(body, theme, "Розмір колеса (dip)", 120, 260, d.actionWheel.sizeDip,
                delegate(int v) { d.actionWheel.sizeDip = v; dirty(); });
            AddHint(body, theme, "Старт: Мікшер · Play/Pause · Далі · Скриншот. За замовчуванням Ctrl+Alt+W.");

            AddSection(body, theme, "Пауза при відʼєднанні навушників");
            AddHint(body, theme,
                "Якщо вибраний пристрій зникає, FOX шле Pause поточній медіасесії (не PlayPause). " +
                "Короткий звук на динаміках можливий. Привʼязка за стабільним ID пристрою. " +
                "Режим: поточна GSMTC-сесія + вибраний пристрій (точний per-app route недоступний).");
            AddToggle(body, theme, "Увімкнути паузу навушників", d.headphones.enabled,
                delegate(bool v) { d.headphones.enabled = v; dirty(); });
            AddToggle(body, theme, "Автопродовження після повернення (за замовч. вимк.)", d.headphones.autoResume,
                delegate(bool v) { d.headphones.autoResume = v; dirty(); });

            AddHint(body, theme, "Пристрій виведення (зі списку після відкриття мікшера Fox, або ID вручну):");
            ComboBox devices = new ComboBox();
            devices.DropDownStyle = ComboBoxStyle.DropDownList;
            devices.Width = Math.Max(420, body.Width - 40);
            devices.Font = theme.Body;
            devices.BackColor = theme.Card;
            devices.ForeColor = theme.Ink;
            List<DevItem> items = LoadDevices();
            devices.Items.Add(new DevItem { Id = "", Name = "(не вибрано)" });
            int sel = 0;
            for (int i = 0; i < items.Count; i++) {
                devices.Items.Add(items[i]);
                if (!string.IsNullOrEmpty(d.headphones.deviceId) &&
                    string.Equals(items[i].Id, d.headphones.deviceId, StringComparison.OrdinalIgnoreCase))
                    sel = i + 1;
            }
            if (devices.Items.Count > 0) devices.SelectedIndex = Math.Min(sel, devices.Items.Count - 1);
            devices.SelectedIndexChanged += delegate {
                DevItem it = devices.SelectedItem as DevItem;
                if (it == null) return;
                d.headphones.deviceId = it.Id ?? "";
                d.headphones.deviceName = it.Name ?? "";
                dirty();
            };
            Place(body, devices, 30);

            AddText(body, theme, "Або device ID вручну", d.headphones.deviceId ?? "", 420, delegate(string v) {
                d.headphones.deviceId = (v ?? "").Trim();
                dirty();
            });
            AddText(body, theme, "Назва (для себе)", d.headphones.deviceName ?? "", 420, delegate(string v) {
                d.headphones.deviceName = (v ?? "").Trim();
                dirty();
            });

            Button refresh = FoxUi.Button(theme, "Оновити список з audio-devices.json", false);
            refresh.Width = 280;
            refresh.Click += delegate {
                devices.Items.Clear();
                devices.Items.Add(new DevItem { Id = "", Name = "(не вибрано)" });
                List<DevItem> again = LoadDevices();
                for (int i = 0; i < again.Count; i++) devices.Items.Add(again[i]);
                devices.SelectedIndex = 0;
                dirty();
            };
            Place(body, refresh, 36);
        }

        public static void SaveDraft() {
            if (Draft == null) return;
            FoxFeatures.Save(Draft);
            Draft = FoxFeatures.Load();
        }

        class DevItem {
            public string Id;
            public string Name;
            public override string ToString() {
                if (string.IsNullOrEmpty(Name)) return Id ?? "";
                return Name;
            }
        }

        static List<DevItem> LoadDevices() {
            List<DevItem> list = new List<DevItem>();
            try {
                string cache = Path.Combine(FoxPaths.RuntimeDir(), "audio-devices.json");
                if (!File.Exists(cache)) return list;
                string raw = File.ReadAllText(cache);
                MatchCollection ids = Regex.Matches(raw, "\"id\"\\s*:\\s*\"([^\"]+)\"");
                MatchCollection names = Regex.Matches(raw, "\"name\"\\s*:\\s*\"([^\"]+)\"");
                int n = Math.Min(ids.Count, names.Count);
                for (int i = 0; i < n; i++) {
                    list.Add(new DevItem {
                        Id = ids[i].Groups[1].Value,
                        Name = names[i].Groups[1].Value
                    });
                }
            } catch { }
            return list;
        }

        static void AddHead(Panel body, FoxTheme theme, string title, string sub) {
            Label h = FoxUi.Label(theme, title, theme.Head, theme.Ink);
            Place(body, h, 28);
            Label s = FoxUi.Label(theme, sub, theme.Small, theme.Muted);
            s.MaximumSize = new Size(Math.Max(480, body.Width - 40), 0);
            s.AutoSize = true;
            Place(body, s, 22);
        }

        static void AddSection(Panel body, FoxTheme theme, string title) {
            Label h = FoxUi.Label(theme, title, theme.Body, theme.Accent);
            Place(body, h, 26);
        }

        static void AddHint(Panel body, FoxTheme theme, string text) {
            Label s = FoxUi.Label(theme, text, theme.Small, theme.Muted);
            s.MaximumSize = new Size(Math.Max(480, body.Width - 40), 0);
            s.AutoSize = true;
            Place(body, s, 18);
        }

        static void AddToggle(Panel body, FoxTheme theme, string title, bool value, Action<bool> set) {
            FlowLayoutPanel row = new FlowLayoutPanel();
            row.AutoSize = true;
            row.WrapContents = false;
            CheckBox cb = new CheckBox();
            cb.Text = title;
            cb.Checked = value;
            cb.AutoSize = true;
            cb.ForeColor = theme.Ink;
            cb.Font = theme.Body;
            cb.CheckedChanged += delegate { set(cb.Checked); };
            row.Controls.Add(cb);
            Place(body, row, 28);
        }

        static void AddText(Panel body, FoxTheme theme, string cap, string value, int width, Action<string> set) {
            Label l = FoxUi.Label(theme, cap, theme.Small, theme.Muted);
            Place(body, l, 16);
            TextBox tb = new TextBox();
            tb.Text = value ?? "";
            tb.Width = width;
            tb.Font = theme.Body;
            tb.BackColor = theme.Card;
            tb.ForeColor = theme.Ink;
            tb.TextChanged += delegate { set(tb.Text); };
            Place(body, tb, 26);
        }

        static void AddSlider(Panel body, FoxTheme theme, string cap, int min, int max, int val, Action<int> set) {
            Label l = FoxUi.Label(theme, cap + " · " + val, theme.Small, theme.Muted);
            Place(body, l, 16);
            TrackBar tb = new TrackBar();
            tb.Minimum = min; tb.Maximum = max; tb.Value = Math.Max(min, Math.Min(max, val));
            tb.Width = Math.Max(360, body.Width - 48);
            tb.TickStyle = TickStyle.None;
            tb.ValueChanged += delegate {
                set(tb.Value);
                l.Text = cap + " · " + tb.Value;
            };
            Place(body, tb, 34);
        }

        static void Place(Panel body, Control c, int gap) {
            c.Location = new Point(8, body.Height);
            body.Controls.Add(c);
            body.Height = c.Bottom + gap;
        }
    }
}
