using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Text;
using System.IO;
using System.Threading;
using System.Windows.Forms;

namespace FoxOsLive {
    static class GhosttyTalk {
        static string PendingPath() {
            string root = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            if (string.IsNullOrEmpty(root)) root = Path.GetTempPath();
            string dir = Path.Combine(root, "FoxTerminal", "foxos");
            try { Directory.CreateDirectory(dir); } catch { }
            return Path.Combine(dir, "pending-term.txt");
        }

        static void WritePending(string cmd) {
            if (string.IsNullOrEmpty(cmd)) return;
            try { File.WriteAllText(PendingPath(), cmd); } catch { }
        }

        static bool IsLoggedIn(IntPtr hwnd) {
            if (hwnd == IntPtr.Zero) return false;
            var sb = new System.Text.StringBuilder(256);
            Native.GetWindowText(hwnd, sb, 256);
            string title = (sb.ToString() ?? "").Trim();
            if (title.Length == 0) return false;
            if (title.IndexOf("Not Logged In", StringComparison.OrdinalIgnoreCase) >= 0) return false;
            if (title.Equals("powershell.exe", StringComparison.OrdinalIgnoreCase)) return false;
            if (title.Equals("pwsh", StringComparison.OrdinalIgnoreCase)) return false;
            if (title.Equals("Windows PowerShell", StringComparison.OrdinalIgnoreCase)) return false;
            return true;
        }

        public static bool Run(string command, string cmdDir) {
            string cmd = (command ?? "").Trim();
            IntPtr hwnd = Find();
            if (hwnd == IntPtr.Zero) {
                if (cmd.Length > 0) WritePending(cmd);
                if (GhosttyPids().Count > 0) return true;
                return StartFresh(cmdDir);
            }
            Focus(hwnd);
            if (cmd.Length == 0) return true;
            if (!IsLoggedIn(hwnd)) {
                WritePending(cmd);
                return true;
            }
            try { File.Delete(PendingPath()); } catch { }
            try {
                SendKeys.SendWait("{ESC}");
                Thread.Sleep(160);
                SendKeys.SendWait(EscapeKeys(cmd) + "{ENTER}");
                return true;
            } catch {
                WritePending(cmd);
                return true;
            }
        }

        static string EscapeKeys(string s) {
            return s.Replace("{", "{{").Replace("}", "}}")
                .Replace("+", "{+}").Replace("^", "{^}")
                .Replace("%", "{%}").Replace("~", "{~}")
                .Replace("(", "{(}").Replace(")", "{)}");
        }

        static bool IsGhosttyName(string n) {
            if (n == null) return false;
            n = n.ToLowerInvariant();
            return n == "winghostty" || n == "ghostty";
        }

        static List<int> GhosttyPids() {
            var pids = new List<int>();
            Process[] all = Process.GetProcesses();
            for (int i = 0; i < all.Length; i++) {
                try {
                    if (IsGhosttyName(all[i].ProcessName)) pids.Add(all[i].Id);
                } catch { }
                finally { all[i].Dispose(); }
            }
            return pids;
        }

        static IntPtr Find() {
            List<int> pids = GhosttyPids();
            if (pids.Count == 0) return IntPtr.Zero;
            IntPtr best = IntPtr.Zero;
            int bestArea = -1;
            Native.EnumWindows(delegate(IntPtr h, IntPtr l) {
                if (!Native.IsWindowVisible(h)) return true;
                uint pid;
                Native.GetWindowThreadProcessId(h, out pid);
                bool mine = false;
                for (int i = 0; i < pids.Count; i++) {
                    if (pids[i] == (int)pid) { mine = true; break; }
                }
                if (!mine) return true;
                Native.RECT r;
                if (!Native.GetWindowRect(h, out r)) return true;
                int area = (r.R - r.L) * (r.B - r.T);
                if (area > bestArea) {
                    bestArea = area;
                    best = h;
                }
                return true;
            }, IntPtr.Zero);
            return best;
        }

        static void Focus(IntPtr hwnd) {
            try { Native.AllowSetForegroundWindow(-1); } catch { }
            if (Native.IsIconic(hwnd)) Native.ShowWindow(hwnd, 9);
            Native.SetWindowPos(hwnd, IntPtr.Zero, 0, 0, 0, 0, 0x0003);
            uint destPid;
            uint destTid = Native.GetWindowThreadProcessId(hwnd, out destPid);
            IntPtr fg = Native.GetForegroundWindow();
            uint fgPid;
            uint fgTid = fg != IntPtr.Zero ? Native.GetWindowThreadProcessId(fg, out fgPid) : 0;
            uint me = Native.GetCurrentThreadId();
            if (fgTid != 0 && fgTid != me) Native.AttachThreadInput(me, fgTid, true);
            if (destTid != 0 && destTid != me) Native.AttachThreadInput(me, destTid, true);
            Native.SetForegroundWindow(hwnd);
            if (destTid != 0 && destTid != me) Native.AttachThreadInput(me, destTid, false);
            if (fgTid != 0 && fgTid != me) Native.AttachThreadInput(me, fgTid, false);
            Thread.Sleep(40);
        }

        static bool StartFresh(string cmdDir) {
            string exe = FindExe();
            if (string.IsNullOrEmpty(exe)) return false;
            string root = "";
            if (!string.IsNullOrEmpty(cmdDir)) {
                try { root = Path.GetFullPath(Path.Combine(cmdDir, "..")); } catch { }
            }
            var psi = new ProcessStartInfo();
            psi.FileName = exe;
            psi.UseShellExecute = true;
            if (!string.IsNullOrEmpty(root) && Directory.Exists(root)) psi.WorkingDirectory = root;
            try {
                Process.Start(psi);
                return true;
            } catch {
                return false;
            }
        }

        static string FindExe() {
            string[] paths = {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Programs\winghostty\winghostty.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"winghostty\bin\winghostty.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"winghostty\winghostty.exe")
            };
            for (int i = 0; i < paths.Length; i++) {
                if (File.Exists(paths[i])) return paths[i];
            }
            return "winghostty.exe";
        }
    }

    sealed class HelpItem {
        public readonly string Name;
        public readonly string Usage;
        public readonly string Desc;
        public readonly string Group;
        public readonly bool Wall;
        public readonly bool NeedsArg;

        public HelpItem(string name, string usage, string desc, string group, bool wall, bool needsArg) {
            Name = name;
            Usage = usage;
            Desc = desc;
            Group = group;
            Wall = wall;
            NeedsArg = needsArg;
        }
    }

    sealed class HelpBoard : Form {
        readonly Action<string> runDesk;
        readonly Action<string> fillPrompt;
        readonly Font titleFont;
        readonly Font tabFont;
        readonly Font rowFont;
        readonly Font smallFont;
        Color night;
        Color accent;
        bool wallTab = true;
        int sel;
        int scroll;
        string filter = "";
        readonly List<Line> lines = new List<Line>();
        bool dragging;
        Point dragDelta;
        System.Windows.Forms.Timer blink;
        int wheelAcc;
        bool caretOn = true;
        int hover = -1;

        struct Line {
            public bool Head;
            public string Text;
            public HelpItem Item;
        }

        static readonly HelpItem[] Catalog = BuildCatalog();

        static HelpItem[] BuildCatalog() {
            return new HelpItem[] {
                new HelpItem("foxhelp", "foxhelp", "this picker", "prompt", true, false),
                new HelpItem("ser", "ser <terms>", "google search in the browser", "search", true, true),
                new HelpItem("yt", "yt [query]", "youtube, or search", "search", true, false),
                new HelpItem("ytm", "ytm [query]", "youtube music, or search", "search", true, false),
                new HelpItem("ff", "ff [url|query]", "open a url or youtube search", "search", true, false),
                new HelpItem("note", "note <text>", "append a line on the desk column", "desk", true, true),
                new HelpItem("rig", "rig [1-5]", "cycle or set the top-right card", "desk", true, false),
                new HelpItem("sp", "sp", "open spotify", "media", true, false),
                new HelpItem("dj", "dj", "youtube music tui", "media", true, false),
                new HelpItem("youtube", "youtube", "open youtube", "media", true, false),
                new HelpItem("sw", "sw <color>", "recolor foxos + ghostty", "theme", true, true),
                new HelpItem("shader", "shader [on|off|toggle]", "ghostty glass shader", "theme", true, false),
                new HelpItem("noir", "noir", "black and white mode", "theme", true, false),
                new HelpItem("dnote", "dnote", "death note mode", "theme", true, false),
                new HelpItem("arthas", "arthas", "arthas mode", "theme", true, false),
                new HelpItem("pride", "pride", "pride mode", "theme", true, false),
                new HelpItem("term", "term", "new ghostty window", "launch", true, false),
                new HelpItem("sites", "sites", "open the local hub", "launch", true, false),
                new HelpItem("foxos", "foxos [on|off|toggle]", "wallpaper overlay", "launch", true, false),

                new HelpItem("l", "l <name> <pass>", "login (or register if new)", "login", false, false),
                new HelpItem("nuser", "nuser <name> <pass>", "register a new user", "login", false, false),
                new HelpItem("who", "who", "show the current user", "login", false, false),
                new HelpItem("uexit", "uexit", "logout", "login", false, false),
                new HelpItem("users", "users", "list registered users", "login", false, false),
                new HelpItem("passwd", "passwd", "change password", "login", false, false),
                new HelpItem("ask", "ask \"...\"", "one-shot ai via ollama", "ai", false, false),
                new HelpItem("friend", "friend", "friend chat", "ai", false, false),
                new HelpItem("sum", "sum <file>", "summarize a file", "ai", false, false),
                new HelpItem("gask", "gask <question>", "chatgpt with a prefilled query", "ai", false, false),
                new HelpItem("yt", "yt <query>", "youtube search", "media", false, false),
                new HelpItem("ytm", "ytm [query]", "youtube music", "media", false, false),
                new HelpItem("ytm-ui", "ytm-ui", "youtube music tui + dj", "media", false, false),
                new HelpItem("sp", "sp [query]", "open spotify", "media", false, false),
                new HelpItem("sp-ui", "sp-ui", "spotify dj ui", "media", false, false),
                new HelpItem("dj", "dj", "audio-level visualizer", "media", false, false),
                new HelpItem("ytsplit", "ytsplit", "place youtube / ytm windows", "media", false, false),
                new HelpItem("ff", "ff open [alias-or-url]", "open a url or alias", "web", false, false),
                new HelpItem("ser", "ser <terms>", "google search", "web", false, false),
                new HelpItem("sites", "sites", "browse local sites", "web", false, false),
                new HelpItem("blist", "blist", "list site aliases", "web", false, false),
                new HelpItem("bbind", "bbind", "bind a site alias", "web", false, false),
                new HelpItem("bdel", "bdel <alias>", "delete a site alias", "web", false, false),
                new HelpItem("tg", "tg [alias|@user]", "telegram web", "web", false, false),
                new HelpItem("apps", "apps <a> / <b>", "arrange app windows", "apps", false, false),
                new HelpItem("appbind", "appbind", "bind an app alias", "apps", false, false),
                new HelpItem("wai", "wai [-pin]", "where you are in notes", "notes", false, false),
                new HelpItem("go", "go <path>", "change notes folder", "notes", false, false),
                new HelpItem("up", "up", "go up one notes folder", "notes", false, false),
                new HelpItem("nfile", "nfile <name>", "create a notes file", "notes", false, false),
                new HelpItem("nfould", "nfould <name>", "create a notes folder", "notes", false, false),
                new HelpItem("edit", "edit <file>", "terminal editor", "notes", false, false),
                new HelpItem("nano", "nano <file>", "linux-style editor", "notes", false, false),
                new HelpItem("view", "view <file>", "read-only pager", "notes", false, false),
                new HelpItem("sw", "sw [theme]", "theme switcher + system info", "theme", false, false),
                new HelpItem("themes", "themes", "main theme picker", "theme", false, false),
                new HelpItem("shader", "shader [on|off]", "ghostty glass shaders", "theme", false, false),
                new HelpItem("foxos", "foxos [on|off]", "ascii rain wallpaper", "theme", false, false),
                new HelpItem("noir", "noir", "black and white mode", "theme", false, false),
                new HelpItem("dnote", "dnote", "death note mode", "theme", false, false),
                new HelpItem("arthas", "arthas", "arthas mode", "theme", false, false),
                new HelpItem("pride", "pride", "pride mode", "theme", false, false),
                new HelpItem("wifi", "wifi", "wifi status", "net", false, false),
                new HelpItem("ip", "ip", "public + local ips", "net", false, false),
                new HelpItem("weather", "weather [place]", "weather via wttr.in", "net", false, false),
                new HelpItem("disk", "disk", "disk usage", "net", false, false),
                new HelpItem("fday", "fday", "daily summary", "net", false, false),
                new HelpItem("term", "term", "ghostty config / new window", "system", false, false),
                new HelpItem("interface", "interface", "ghostty split layout", "system", false, false),
                new HelpItem("foxhelp", "foxhelp", "this menu", "system", false, false),
                new HelpItem("foxhotkeys", "foxhotkeys", "global hotkey daemon", "system", false, false),
                new HelpItem("foxreset", "foxreset", "reset caches + prompt", "system", false, false),
                new HelpItem("clear", "clear", "clear the terminal screen", "system", false, false)
            };
        }

        public HelpBoard(Color nightColor, Color accentColor, Action<string> run, Action<string> fill) {
            night = nightColor;
            accent = accentColor;
            runDesk = run;
            fillPrompt = fill;
            Text = "FoxHelp";
            FormBorderStyle = FormBorderStyle.None;
            StartPosition = FormStartPosition.CenterScreen;
            ShowInTaskbar = false;
            KeyPreview = true;
            DoubleBuffered = true;
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint | ControlStyles.OptimizedDoubleBuffer, true);
            Size = new Size(1040, 700);
            BackColor = night;
            titleFont = new Font("Consolas", 22f, FontStyle.Bold, GraphicsUnit.Pixel);
            tabFont = new Font("Consolas", 15f, FontStyle.Bold, GraphicsUnit.Pixel);
            rowFont = new Font("Consolas", 15f, FontStyle.Regular, GraphicsUnit.Pixel);
            smallFont = new Font("Consolas", 12f, FontStyle.Regular, GraphicsUnit.Pixel);
            blink = new System.Windows.Forms.Timer();
            blink.Interval = 480;
            blink.Tick += delegate { caretOn = !caretOn; Invalidate(FilterRect()); };
            blink.Start();
            Rebuild();
        }

        public void Recolor(Color nightColor, Color accentColor) {
            night = nightColor;
            accent = accentColor;
            BackColor = night;
            PaintChrome();
            Invalidate();
        }

        protected override void OnHandleCreated(EventArgs e) {
            base.OnHandleCreated(e);
            PaintChrome();
        }

        void PaintChrome() {
            try {
                uint cap = (uint)(night.R | (night.G << 8) | (night.B << 16));
                uint border = (uint)(accent.R | (accent.G << 8) | (accent.B << 16));
                uint text = 0x00F0F2F6;
                uint dark = 1;
                Native.DwmSetWindowAttribute(Handle, Native.DWMWA_USE_IMMERSIVE_DARK_MODE, ref dark, 4);
                Native.DwmSetWindowAttribute(Handle, Native.DWMWA_CAPTION_COLOR, ref cap, 4);
                Native.DwmSetWindowAttribute(Handle, Native.DWMWA_BORDER_COLOR, ref border, 4);
                Native.DwmSetWindowAttribute(Handle, Native.DWMWA_TEXT_COLOR, ref text, 4);
            } catch { }
        }

        void Rebuild() {
            lines.Clear();
            string q = (filter ?? "").Trim().ToLowerInvariant();
            string last = "";
            for (int i = 0; i < Catalog.Length; i++) {
                HelpItem it = Catalog[i];
                if (it.Wall != wallTab) continue;
                if (q.Length > 0) {
                    string hay = (it.Name + " " + it.Usage + " " + it.Desc + " " + it.Group).ToLowerInvariant();
                    if (hay.IndexOf(q) < 0) continue;
                }
                if (it.Group != last) {
                    lines.Add(new Line { Head = true, Text = it.Group, Item = null });
                    last = it.Group;
                }
                lines.Add(new Line { Head = false, Text = it.Usage, Item = it });
            }
            if (sel >= lines.Count) sel = lines.Count - 1;
            if (sel < 0) sel = 0;
            EnsureItem();
            ClampScroll();
        }

        void EnsureItem() {
            if (lines.Count == 0) return;
            if (sel < 0) sel = 0;
            if (sel >= lines.Count) sel = lines.Count - 1;
            if (!lines[sel].Head) return;
            for (int i = sel + 1; i < lines.Count; i++) {
                if (!lines[i].Head) { sel = i; return; }
            }
            for (int i = sel - 1; i >= 0; i--) {
                if (!lines[i].Head) { sel = i; return; }
            }
        }

        void MoveSel(int dir) {
            if (lines.Count == 0) return;
            int i = sel + dir;
            while (i >= 0 && i < lines.Count) {
                if (!lines[i].Head) { sel = i; ClampScroll(); Invalidate(); return; }
                i += dir;
            }
        }

        const int RowH = 32;
        const int Pad = 24;
        const int DetailH = 108;

        int ListTop { get { return 168; } }
        int ListBottom { get { return Height - DetailH - 16; } }
        int VisibleRows { get { return Math.Max(1, (ListBottom - ListTop) / RowH); } }
        int CmdCount {
            get {
                int n = 0;
                for (int i = 0; i < lines.Count; i++) if (!lines[i].Head) n++;
                return n;
            }
        }

        void ClampScroll() {
            int vis = VisibleRows;
            if (sel < scroll) scroll = sel;
            if (sel >= scroll + vis) scroll = sel - vis + 1;
            if (scroll < 0) scroll = 0;
            int max = Math.Max(0, lines.Count - vis);
            if (scroll > max) scroll = max;
        }

        HelpItem Current() {
            if (sel < 0 || sel >= lines.Count) return null;
            return lines[sel].Item;
        }

        void ActivateSel() {
            HelpItem item = Current();
            if (item == null) return;
            if (item.Wall) {
                if (item.Name == "foxhelp") return;
                if (item.NeedsArg) {
                    if (fillPrompt != null) fillPrompt(item.Name + " ");
                    return;
                }
                if (runDesk != null) runDesk(item.Name);
                return;
            }
            if (runDesk != null) runDesk("term " + item.Name);
            Activate();
            BringToFront();
        }

        protected override bool ProcessCmdKey(ref Message msg, Keys keyData) {
            if (keyData == Keys.Escape) { Close(); return true; }
            if (keyData == Keys.Enter) { ActivateSel(); return true; }
            if (keyData == Keys.Tab || keyData == (Keys.Tab | Keys.Shift)) {
                wallTab = !wallTab;
                sel = 0;
                scroll = 0;
                Rebuild();
                Invalidate();
                return true;
            }
            if (keyData == Keys.Up) { MoveSel(-1); return true; }
            if (keyData == Keys.Down) { MoveSel(1); return true; }
            if (keyData == Keys.PageUp) { for (int i = 0; i < VisibleRows; i++) MoveSel(-1); return true; }
            if (keyData == Keys.PageDown) { for (int i = 0; i < VisibleRows; i++) MoveSel(1); return true; }
            if (keyData == Keys.Home) { sel = 0; EnsureItem(); ClampScroll(); Invalidate(); return true; }
            if (keyData == Keys.End) { sel = lines.Count - 1; EnsureItem(); ClampScroll(); Invalidate(); return true; }
            if (keyData == Keys.Back) {
                if (filter.Length > 0) {
                    filter = filter.Substring(0, filter.Length - 1);
                    sel = 0;
                    Rebuild();
                    Invalidate();
                }
                return true;
            }
            return base.ProcessCmdKey(ref msg, keyData);
        }

        protected override void OnKeyPress(KeyPressEventArgs e) {
            if (!char.IsControl(e.KeyChar) && filter.Length < 40) {
                filter += e.KeyChar;
                sel = 0;
                Rebuild();
                Invalidate();
                e.Handled = true;
            }
            base.OnKeyPress(e);
        }

        void ScrollBy(int steps) {
            if (steps == 0) return;
            int dir = steps > 0 ? 1 : -1;
            int n = steps > 0 ? steps : -steps;
            for (int i = 0; i < n; i++) MoveSel(dir);
        }

        protected override void OnMouseWheel(MouseEventArgs e) {
            wheelAcc += e.Delta;
            while (wheelAcc >= 120) { ScrollBy(-1); wheelAcc -= 120; }
            while (wheelAcc <= -120) { ScrollBy(1); wheelAcc += 120; }
            base.OnMouseWheel(e);
        }

        Rectangle CloseRect() {
            return new Rectangle(Width - Pad - 28, 16, 28, 28);
        }

        Rectangle FilterRect() {
            return new Rectangle(Pad, 76, Width - Pad * 2, 38);
        }

        Rectangle TabRect(bool wall) {
            int x = Pad + (wall ? 0 : 168);
            return new Rectangle(x, 126, 156, 30);
        }

        Rectangle DetailRect() {
            return new Rectangle(Pad, Height - DetailH, Width - Pad * 2, DetailH - 16);
        }

        protected override void OnMouseDown(MouseEventArgs e) {
            if (CloseRect().Contains(e.Location)) {
                Close();
                return;
            }
            if (e.Y < 72 && !FilterRect().Contains(e.Location)) {
                dragging = true;
                dragDelta = new Point(e.X, e.Y);
                Capture = true;
                return;
            }
            Rectangle wallR = TabRect(true);
            Rectangle termR = TabRect(false);
            if (wallR.Contains(e.Location) || termR.Contains(e.Location)) {
                bool next = wallR.Contains(e.Location);
                if (next != wallTab) {
                    wallTab = next;
                    sel = 0;
                    scroll = 0;
                    hover = -1;
                    Rebuild();
                    Invalidate();
                }
                return;
            }
            int idx = HitRow(e.Y);
            if (idx >= 0) {
                sel = idx;
                EnsureItem();
                Invalidate();
                if (e.Clicks > 1) ActivateSel();
            }
            base.OnMouseDown(e);
        }

        protected override void OnMouseMove(MouseEventArgs e) {
            if (dragging) {
                Left += e.X - dragDelta.X;
                Top += e.Y - dragDelta.Y;
                return;
            }
            int idx = HitRow(e.Y);
            if (idx != hover) {
                hover = idx;
                Invalidate();
            }
            base.OnMouseMove(e);
        }

        protected override void OnMouseUp(MouseEventArgs e) {
            dragging = false;
            Capture = false;
            base.OnMouseUp(e);
        }

        protected override void OnMouseLeave(EventArgs e) {
            if (hover != -1) {
                hover = -1;
                Invalidate();
            }
            base.OnMouseLeave(e);
        }

        int HitRow(int y) {
            if (y < ListTop || y >= ListBottom) return -1;
            int row = scroll + (y - ListTop) / RowH;
            if (row < 0 || row >= lines.Count) return -1;
            if (lines[row].Head) return -1;
            return row;
        }

        void DrawCard(Graphics g, Rectangle box, bool headerWash) {
            using (var fill = new SolidBrush(Color.FromArgb(230, 6, 8, 14))) {
                g.FillRectangle(fill, box);
            }
            if (headerWash) {
                using (var wash = new SolidBrush(Color.FromArgb(28, accent))) {
                    g.FillRectangle(wash, box.X, box.Y, box.Width, 64);
                }
            }
            using (var rail = new SolidBrush(Color.FromArgb(230, accent))) {
                g.FillRectangle(rail, box.X, box.Y, 2, box.Height);
            }
            using (var edge = new Pen(Color.FromArgb(28, 255, 255, 255), 1f)) {
                g.DrawRectangle(edge, box.X, box.Y, box.Width - 1, box.Height - 1);
            }
            using (var inner = new Pen(Color.FromArgb(120, accent), 1f)) {
                g.DrawRectangle(inner, box.X + 1, box.Y + 1, box.Width - 3, box.Height - 3);
            }
            using (var shine = new Pen(Color.FromArgb(36, 255, 255, 255), 1f)) {
                g.DrawLine(shine, box.X + 4, box.Y + 1, box.Right - 3, box.Y + 1);
            }
        }

        void DrawPromptBar(Graphics g, Rectangle bar, string text, bool live) {
            using (var fill = new SolidBrush(Color.FromArgb(live ? 230 : 190, 7, 9, 16))) {
                g.FillRectangle(fill, bar);
            }
            using (var rail = new SolidBrush(Color.FromArgb(live ? 255 : 170, accent))) {
                g.FillRectangle(rail, bar.X, bar.Y, 3, bar.Height);
            }
            using (var outer = new Pen(Color.FromArgb(live ? 40 : 22, 255, 255, 255), 1f)) {
                g.DrawRectangle(outer, bar.X, bar.Y, bar.Width - 1, bar.Height - 1);
            }
            using (var inner = new Pen(Color.FromArgb(live ? 210 : 95, accent), 1f)) {
                g.DrawRectangle(inner, bar.X + 1, bar.Y + 1, bar.Width - 3, bar.Height - 3);
            }
            using (var shine = new Pen(Color.FromArgb(live ? 36 : 18, 255, 255, 255), 1f)) {
                g.DrawLine(shine, bar.X + 4, bar.Y + 2, bar.Right - 3, bar.Y + 2);
            }
            using (var sf = (StringFormat)StringFormat.GenericTypographic.Clone()) {
                sf.Alignment = StringAlignment.Near;
                sf.LineAlignment = StringAlignment.Center;
                sf.FormatFlags = StringFormatFlags.NoWrap;
                sf.Trimming = StringTrimming.None;
                using (var ink = new SolidBrush(live ? Color.FromArgb(236, 238, 242) : Color.FromArgb(160, accent))) {
                    g.DrawString(text, rowFont, ink, new RectangleF(bar.X + 14, bar.Y, bar.Width - 28, bar.Height), sf);
                }
            }
        }

        protected override void OnPaint(PaintEventArgs e) {
            Graphics g = e.Graphics;
            g.Clear(night);
            g.TextRenderingHint = TextRenderingHint.AntiAliasGridFit;
            g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.None;
            DrawCard(g, new Rectangle(0, 0, Width, Height), true);

            using (var sf = (StringFormat)StringFormat.GenericTypographic.Clone()) {
                sf.Alignment = StringAlignment.Near;
                sf.LineAlignment = StringAlignment.Center;
                sf.FormatFlags = StringFormatFlags.NoWrap;
                sf.Trimming = StringTrimming.EllipsisCharacter;

                using (var kick = new SolidBrush(Color.FromArgb(230, accent)))
                using (var title = new SolidBrush(Color.FromArgb(236, 238, 242)))
                using (var mute = new SolidBrush(Color.FromArgb(124, 140, 156))) {
                    g.DrawString("FOXHELP", smallFont, kick, new RectangleF(Pad + 10, 14, 180, 16), sf);
                    g.DrawString("command picker", titleFont, title, new RectangleF(Pad + 10, 32, 420, 28), sf);
                    string meta = (wallTab ? "WALL  " : "TERM  ") + CmdCount.ToString();
                    SizeF ms = g.MeasureString(meta, smallFont, PointF.Empty, sf);
                    g.DrawString(meta, smallFont, kick, new RectangleF(Width - Pad - 44 - ms.Width, 20, ms.Width + 2, 16), sf);
                }

                Rectangle xr = CloseRect();
                using (var xFill = new SolidBrush(Color.FromArgb(36, accent))) {
                    g.FillRectangle(xFill, xr);
                }
                using (var xEdge = new Pen(Color.FromArgb(80, accent), 1f)) {
                    g.DrawRectangle(xEdge, xr.X, xr.Y, xr.Width - 1, xr.Height - 1);
                }
                using (var xInk = new SolidBrush(Color.FromArgb(220, accent)))
                using (var xsf = (StringFormat)sf.Clone()) {
                    xsf.Alignment = StringAlignment.Center;
                    g.DrawString("x", tabFont, xInk, xr, xsf);
                }

                Rectangle fr = FilterRect();
                bool typed = filter.Length > 0;
                string q = typed ? ("> " + filter) : "> filter";
                if (caretOn) q += "_";
                DrawPromptBar(g, fr, q, typed || caretOn);

                DrawTab(g, sf, TabRect(true), "WALLPAPER", wallTab);
                DrawTab(g, sf, TabRect(false), "TERMINAL", !wallTab);

                int vis = VisibleRows;
                int y = ListTop;
                int listW = Width - Pad * 2 - 10;
                for (int i = scroll; i < lines.Count && i < scroll + vis; i++) {
                    Rectangle row = new Rectangle(Pad + 10, y, listW, RowH);
                    Line line = lines[i];
                    if (line.Head) {
                        using (var hInk = new SolidBrush(Color.FromArgb(200, accent))) {
                            g.DrawString(line.Text.ToUpperInvariant(), smallFont, hInk, new RectangleF(row.X, row.Y, 140, row.Height), sf);
                        }
                        int ruleY = row.Y + row.Height / 2;
                        using (var rule = new Pen(Color.FromArgb(28, 255, 255, 255), 1f)) {
                            g.DrawLine(rule, row.X + 150, ruleY, row.Right, ruleY);
                        }
                    } else {
                        bool on = i == sel;
                        bool over = i == hover && !on;
                        if (on) {
                            using (var wash = new SolidBrush(Color.FromArgb(48, accent))) {
                                g.FillRectangle(wash, row);
                            }
                            using (var mark = new SolidBrush(accent)) {
                                g.FillRectangle(mark, row.X, row.Y + 4, 3, row.Height - 8);
                            }
                            using (var edge = new Pen(Color.FromArgb(40, 255, 255, 255), 1f)) {
                                g.DrawRectangle(edge, row.X, row.Y, row.Width - 1, row.Height - 1);
                            }
                        } else if (over) {
                            using (var wash = new SolidBrush(Color.FromArgb(22, accent))) {
                                g.FillRectangle(wash, row);
                            }
                        }
                        using (var nameInk = new SolidBrush(on ? Color.FromArgb(236, 238, 242) : Color.FromArgb(188, 196, 210))) {
                            g.DrawString((on ? "> " : "  ") + line.Item.Usage, rowFont, nameInk, new RectangleF(row.X + 12, row.Y, 360, row.Height), sf);
                        }
                        using (var descInk = new SolidBrush(on ? Color.FromArgb(220, accent) : Color.FromArgb(110, 128, 148))) {
                            g.DrawString(line.Item.Desc, smallFont, descInk, new RectangleF(row.X + 380, row.Y, row.Width - 392, row.Height), sf);
                        }
                    }
                    y += RowH;
                }

                if (lines.Count == 0) {
                    using (var dim = new SolidBrush(Color.FromArgb(124, 140, 156))) {
                        g.DrawString("no matches", rowFont, dim, new RectangleF(Pad + 12, ListTop + 16, 400, 28), sf);
                    }
                }

                int max = Math.Max(1, lines.Count);
                if (lines.Count > vis) {
                    int trackX = Width - Pad - 4;
                    int trackH = ListBottom - ListTop;
                    using (var bg = new SolidBrush(Color.FromArgb(26, 255, 255, 255))) {
                        g.FillRectangle(bg, trackX, ListTop, 3, trackH);
                    }
                    int thumbH = Math.Max(18, trackH * vis / max);
                    int thumbY = ListTop + (trackH - thumbH) * scroll / Math.Max(1, max - vis);
                    using (var th = new SolidBrush(Color.FromArgb(200, accent))) {
                        g.FillRectangle(th, trackX, thumbY, 3, thumbH);
                    }
                }

                Rectangle detail = DetailRect();
                using (var fill = new SolidBrush(Color.FromArgb(230, 6, 8, 14))) {
                    g.FillRectangle(fill, detail);
                }
                using (var wash = new SolidBrush(Color.FromArgb(26, accent))) {
                    g.FillRectangle(wash, detail.X, detail.Y, detail.Width, 38);
                }
                using (var rail = new SolidBrush(Color.FromArgb(230, accent))) {
                    g.FillRectangle(rail, detail.X, detail.Y, 2, detail.Height);
                }
                using (var edge = new Pen(Color.FromArgb(28, 255, 255, 255), 1f)) {
                    g.DrawRectangle(edge, detail.X, detail.Y, detail.Width - 1, detail.Height - 1);
                }
                HelpItem cur = Current();
                using (var val = new SolidBrush(Color.FromArgb(236, 238, 242)))
                using (var dim = new SolidBrush(Color.FromArgb(124, 140, 156)))
                using (var acc = new SolidBrush(Color.FromArgb(220, accent))) {
                    if (cur != null) {
                        string where = cur.Wall ? "WALLPAPER" : "TERMINAL";
                        string act = cur.Wall
                            ? (cur.NeedsArg ? "enter  type the rest on the desk" : "enter  run on the wallpaper")
                            : "enter  run in ghostty after login";
                        g.DrawString(cur.Usage, tabFont, val, new RectangleF(detail.X + 16, detail.Y + 8, detail.Width - 160, 24), sf);
                        SizeF chip = g.MeasureString(where, smallFont, PointF.Empty, sf);
                        Rectangle chipR = new Rectangle(detail.Right - 16 - (int)chip.Width - 16, detail.Y + 10, (int)chip.Width + 16, 20);
                        using (var chipFill = new SolidBrush(Color.FromArgb(40, accent))) {
                            g.FillRectangle(chipFill, chipR);
                        }
                        using (var chipSf = (StringFormat)sf.Clone()) {
                            chipSf.Alignment = StringAlignment.Center;
                            g.DrawString(where, smallFont, acc, chipR, chipSf);
                        }
                        g.DrawString(cur.Desc, smallFont, acc, new RectangleF(detail.X + 16, detail.Y + 42, detail.Width - 32, 18), sf);
                        g.DrawString(act + "    tab  section    esc  close", smallFont, dim, new RectangleF(detail.X + 16, detail.Y + 68, detail.Width - 32, 16), sf);
                    } else {
                        g.DrawString("no command selected", tabFont, dim, new RectangleF(detail.X + 16, detail.Y + 24, detail.Width - 32, 24), sf);
                    }
                }
            }
        }

        void DrawTab(Graphics g, StringFormat sf, Rectangle r, string label, bool on) {
            using (var fill = new SolidBrush(on ? Color.FromArgb(42, accent) : Color.FromArgb(18, 255, 255, 255))) {
                g.FillRectangle(fill, r);
            }
            if (on) {
                using (var rail = new SolidBrush(accent)) {
                    g.FillRectangle(rail, r.X, r.Bottom - 2, r.Width, 2);
                }
            }
            using (var edge = new Pen(Color.FromArgb(on ? 70 : 24, on ? accent : Color.White), 1f)) {
                g.DrawRectangle(edge, r.X, r.Y, r.Width - 1, r.Height - 1);
            }
            using (var ink = new SolidBrush(on ? Color.FromArgb(236, 238, 242) : Color.FromArgb(124, 140, 156)))
            using (var tsf = (StringFormat)sf.Clone()) {
                tsf.Alignment = StringAlignment.Center;
                g.DrawString(label, tabFont, ink, r, tsf);
            }
        }

        protected override void Dispose(bool disposing) {
            if (disposing) {
                if (blink != null) blink.Dispose();
                if (titleFont != null) titleFont.Dispose();
                if (tabFont != null) tabFont.Dispose();
                if (rowFont != null) rowFont.Dispose();
                if (smallFont != null) smallFont.Dispose();
            }
            base.Dispose(disposing);
        }
    }
}
