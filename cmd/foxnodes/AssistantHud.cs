using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;
using FoxOs.Assistant;
using FoxOs.Sdk;

namespace FoxOs.Nodes {

    sealed class AssistantHud : Form {
        readonly AssistantHost host;
        readonly TextBox input = new TextBox();
        readonly Button mic = new Button();
        readonly Button go = new Button();
        readonly Button stop = new Button();
        readonly Label state = new Label();
        readonly Label heard = new Label();
        readonly Label result = new Label();
        readonly Panel level = new Panel();
        readonly System.Windows.Forms.Timer follow = new System.Windows.Forms.Timer();
        Form launcher;
        bool pushDown;
        string filledHeard = "";

        protected override bool ShowWithoutActivation { get { return true; } }

        public AssistantHud(AssistantHost assistant) {
            host = assistant;
            FormBorderStyle = FormBorderStyle.None;
            ShowInTaskbar = false;
            StartPosition = FormStartPosition.Manual;
            Size = new Size(300, 198);
            BackColor = Color.FromArgb(28, 30, 36);
            DoubleBuffered = true;
            TopMost = false;

            state.Font = new Font("Segoe UI Semibold", 9f);
            state.ForeColor = Color.White;
            state.AutoSize = false;
            state.Location = new Point(12, 8);
            state.Size = new Size(276, 18);

            heard.Font = new Font("Segoe UI", 8f);
            heard.ForeColor = Color.FromArgb(190, 196, 204);
            heard.AutoSize = false;
            heard.Location = new Point(12, 26);
            heard.Size = new Size(276, 16);

            input.BorderStyle = BorderStyle.FixedSingle;
            input.Location = new Point(12, 46);
            input.Size = new Size(168, 24);
            input.KeyDown += delegate(object s, KeyEventArgs e) {
                if (e.KeyCode == Keys.Enter) {
                    e.Handled = true; e.SuppressKeyPress = true;
                    host.SubmitText(input.Text);
                }
                if (e.KeyCode == Keys.Escape) host.CancelAll();
            };

            mic.FlatStyle = FlatStyle.Flat;
            mic.Size = new Size(28, 24);
            mic.Location = new Point(184, 46);
            mic.Text = "\uE720";
            mic.Font = new Font("Segoe MDL2 Assets", 9f);
            mic.FlatAppearance.BorderSize = 0;
            mic.MouseDown += delegate {
                pushDown = true;
                host.BeginPush();
            };
            mic.MouseUp += delegate {
                if (!pushDown) return;
                pushDown = false;
                host.EndPush();
            };
            mic.MouseLeave += delegate {
                if (!pushDown) return;
                pushDown = false;
                host.CancelPush();
            };

            go.FlatStyle = FlatStyle.Flat;
            go.Size = new Size(28, 24);
            go.Location = new Point(214, 46);
            go.Text = "›";
            go.FlatAppearance.BorderSize = 0;
            go.Click += delegate {
                if (host.State == AssistantState.Reviewing && input.Text == host.HeardText)
                    host.SubmitNow();
                else host.SubmitText(input.Text);
            };

            stop.FlatStyle = FlatStyle.Flat;
            stop.Size = new Size(24, 24);
            stop.Location = new Point(244, 46);
            stop.Text = "\uE71A";
            stop.Font = new Font("Segoe MDL2 Assets", 8f);
            stop.FlatAppearance.BorderSize = 0;
            stop.Click += delegate { host.CancelAll(); };

            level.Location = new Point(12, 74);
            level.Size = new Size(276, 4);
            level.Paint += PaintLevel;

            var sendNow = new Button();
            sendNow.FlatStyle = FlatStyle.Flat;
            sendNow.Text = "Надіслати зараз";
            sendNow.Font = new Font("Segoe UI", 7.5f);
            sendNow.Size = new Size(118, 20);
            sendNow.Location = new Point(12, 82);
            sendNow.FlatAppearance.BorderSize = 0;
            sendNow.Click += delegate { host.SubmitNow(); };

            var fresh = new Button();
            fresh.FlatStyle = FlatStyle.Flat;
            fresh.Text = "Нова розмова";
            fresh.Font = new Font("Segoe UI", 7.5f);
            fresh.Size = new Size(100, 20);
            fresh.Location = new Point(136, 82);
            fresh.FlatAppearance.BorderSize = 0;
            fresh.Click += delegate { host.NewConversation(); };

            result.Font = new Font("Segoe UI", 8.5f);
            result.ForeColor = Color.FromArgb(220, 224, 230);
            result.AutoSize = false;
            result.Location = new Point(12, 106);
            result.Size = new Size(276, 80);

            Controls.Add(state);
            Controls.Add(heard);
            Controls.Add(input);
            Controls.Add(mic);
            Controls.Add(go);
            Controls.Add(stop);
            Controls.Add(level);
            Controls.Add(sendNow);
            Controls.Add(fresh);
            Controls.Add(result);

            host.Changed += delegate {
                if (IsDisposed) return;
                BeginInvoke(new Action(RefreshUi));
            };
            follow.Interval = 80;
            follow.Tick += delegate {
                PlaceNearLauncher();
                if (host.Listening) level.Invalidate();
            };
            follow.Start();
            RefreshUi();
        }

        public void Attach(Form view) {
            launcher = view;
            if (view != null) {
                Owner = view;
                Show(view);
            }
        }

        public void RefreshUi() {
            if (IsDisposed) return;
            state.Text = StateLabel(host.State) + "  ·  " + host.StatusText;
            heard.Text = host.HeardText.Length > 0
                ? (host.HeardText + (host.LastSttMs > 0 ? "  ·  " + host.LastSttMs + " мс" : ""))
                : host.ModelLine;
            if (host.HeardText.Length > 0 && host.HeardText != filledHeard) {
                input.Text = host.HeardText;
                filledHeard = host.HeardText;
            }
            result.Text = host.ResultText;
            Color accent = Color.FromArgb(123, 92, 255);
            foreach (Control c in Controls) {
                if (c is Button && (c.Text == "Надіслати зараз" || c.Text == "Нова розмова")) {
                    c.BackColor = Color.FromArgb(48, 50, 58);
                    c.ForeColor = Color.White;
                }
            }
            mic.BackColor = host.Listening ? accent : Color.FromArgb(48, 50, 58);
            mic.ForeColor = Color.White;
            go.BackColor = Color.FromArgb(48, 50, 58);
            go.ForeColor = Color.White;
            stop.BackColor = Color.FromArgb(48, 50, 58);
            stop.ForeColor = Color.White;
            input.BackColor = Color.FromArgb(20, 22, 26);
            input.ForeColor = Color.White;
            level.Invalidate();
            Invalidate();
        }

        static string StateLabel(AssistantState s) {
            switch (s) {
                case AssistantState.Listening: return "Слухаю";
                case AssistantState.Recognizing: return "Розпізнаю";
                case AssistantState.Reviewing: return "Перевір";
                case AssistantState.Thinking: return "Обробляю";
                case AssistantState.Running: return "Виконую";
                case AssistantState.Speaking: return "Відповідаю";
                case AssistantState.Error: return "Помилка";
                default: return "Готовий";
            }
        }

        void PaintLevel(object sender, PaintEventArgs e) {
            e.Graphics.Clear(Color.FromArgb(18, 18, 22));
            float v = Math.Max(0f, Math.Min(1f, host.MicLevel));
            int w = (int)(level.Width * v);
            using (var br = new SolidBrush(Color.FromArgb(123, 92, 255)))
                e.Graphics.FillRectangle(br, 0, 0, w, level.Height);
        }

        protected override void OnPaint(PaintEventArgs e) {
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            using (var path = FoxUi.Round(new Rectangle(0, 0, Width - 1, Height - 1), 14))
            using (var fill = new SolidBrush(Color.FromArgb(210, 22, 24, 30)))
            using (var pen = new Pen(Color.FromArgb(70, 255, 255, 255), 1f)) {
                e.Graphics.FillPath(fill, path);
                e.Graphics.DrawPath(pen, path);
            }
            base.OnPaint(e);
        }

        void PlaceNearLauncher() {
            if (launcher == null || launcher.IsDisposed || !launcher.Visible) {
                if (Visible) Hide();
                return;
            }
            if (!Visible) Show(launcher);
            Point loc = launcher.PointToScreen(new Point(launcher.Width / 2 + 36, launcher.Height / 2 + 8));
            Location = loc;
        }

        protected override void OnFormClosed(FormClosedEventArgs e) {
            follow.Stop();
            follow.Dispose();
            base.OnFormClosed(e);
        }
    }
}
