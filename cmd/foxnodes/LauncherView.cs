using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;
using FoxOs.Assistant;
using FoxOs.Sdk;

namespace FoxOs.Nodes {

    enum LauncherMode {
        Expanded,
        Collapsed,
        DraggingCenter,
        PocketHidden,
        PocketVisible
    }

    static class HitPolicy {
        public static bool CategoryOpen(float reveal) { return reveal > 0.02f; }
        public static bool CardOpen(float reveal) { return true; }
    }

    sealed class HitZone {
        public Rectangle Bounds;
        public string Kind;
        public MenuNodeSpec Node;
        public int CategoryIndex;
        public int CardIndex;
        public int ColumnIndex;
    }

    sealed class CardVisual {
        public Rectangle Rect;
        public MenuNodeSpec Node;
        public float Reveal;
        public float Hover;
        public float Press;
        public bool HasChildren;
        public bool Selected;
        public PointF LinkStart;
        public PointF LinkEnd;
    }

    sealed class LauncherView : Form {
        static readonly Color Choke = Color.FromArgb(255, 1, 2, 3);

        readonly NodeStore nodeStore;
        readonly ActionRunner runner;
        readonly Action openSettings;
        Font iconFont;
        Font labelFont;
        Font cardFont;
        Font smallFont;
        readonly System.Windows.Forms.Timer animTimer;

        readonly List<HitZone> hits = new List<HitZone>();
        readonly List<string> branchIds = new List<string>();

        NodeLauncherConfig cfg;
        float dpiScale = 1f;
        Point anchor = Point.Empty;
        Rectangle workArea;
        string activeCategoryId = "";
        string pendingCategoryId = "";
        bool pendingPopSubmenu;
        int hoverCat = -1;
        int hoverCardCol = -1;
        int hoverCardIdx = -1;
        int kbMode; // 0 categories, 1 cards
        int kbCatIdx;
        int kbCardIdx;
        float showT = 1f;
        float showFrom = 1f;
        float showTo = 1f;
        float centerT = 1f;
        float branchT = 1f;
        float branchFrom = 1f;
        float branchTo = 1f;
        bool categoriesExpanded = true;
        bool clearBranchAfterAnimation;
        bool visibleAnim;
        bool animEnabled = true;
        float ambientPhase;
        float hoverEase;
        DateTime showStarted = DateTime.MinValue;
        DateTime centerStarted = DateTime.MinValue;
        DateTime branchStarted = DateTime.MinValue;
        DateTime lastFrame = DateTime.UtcNow;
        string hoverNodeId = "";
        readonly Dictionary<string, float> hoverLevels = new Dictionary<string, float>();
        string pressedNodeId = "";
        readonly Dictionary<string, float> pressLevels = new Dictionary<string, float>();
        readonly ToolTip toolTip = new ToolTip();
        string lastToolTip = "";
        DateTime motionUntil = DateTime.MinValue;
        int cardScroll;
        IntPtr focusBefore = IntPtr.Zero;
        Rectangle contentBounds = Rectangle.Empty;
        Screen desktopScreen;
        IntPtr desktopHost = IntPtr.Zero;
        IntPtr wallpaperHost = IntPtr.Zero;
        bool dragging;
        bool dragActive;
        HitZone dragZone;
        int dragStartOffsetX;
        int dragStartOffsetY;
        Point dragMouseScreen;
        Point dragWindowStart;
        bool dragStartedPocketed;
        bool dragOriginPocketed;
        bool pocketDropHot;
        bool pocketHover;
        float pocketT;
        float pocketTarget;
        DateTime pocketShowAt = DateTime.MaxValue;
        DateTime pocketHideAt = DateTime.MaxValue;
        Color night = Color.FromArgb(19, 19, 20);
        Color surface = Color.FromArgb(38, 38, 40);
        Color accent = Color.FromArgb(154, 154, 158);
        Color accent2 = Color.FromArgb(220, 220, 224);
        Color ink = Color.FromArgb(235, 235, 238);
        NodeStyleProfile styleProfile = new NodeStyleProfile();
        Color themeFromSurface, themeFromInk, themeFromMuted;
        Color themeFromAccent, themeFromAccent2;
        Color themeToSurface, themeToInk, themeToMuted;
        Color themeToAccent, themeToAccent2;
        DateTime themeStarted = DateTime.MinValue;
        bool themeAnimating;
        DateTime lastThemeCheck = DateTime.MinValue;
        LauncherMode launcherMode = LauncherMode.Expanded;
        AssistantHost assistant;
        AssistantHud assistantHud;
        float applyPulse;
        DateTime applyPulseAt = DateTime.MinValue;

        protected override bool ShowWithoutActivation { get { return true; } }

        public LauncherView(NodeStore store, ActionRunner actions, Action onSettings) {
            nodeStore = store;
            runner = actions;
            openSettings = onSettings;
            cfg = nodeStore.Config;

            FormBorderStyle = FormBorderStyle.None;
            ShowInTaskbar = false;
            TopMost = false;
            StartPosition = FormStartPosition.Manual;
            BackColor = Choke;
            TransparencyKey = Choke;
            KeyPreview = true;
            DoubleBuffered = true;
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint | ControlStyles.OptimizedDoubleBuffer, true);

            RecreateFonts(100);
            toolTip.InitialDelay = 450;
            toolTip.ReshowDelay = 120;
            toolTip.AutoPopDelay = 5000;

            animTimer = new System.Windows.Forms.Timer();
            // The window is deliberately compact, so native 60 fps is inexpensive
            // and visibly smoother than repainting a transparent full-screen form.
            animTimer.Interval = 16;
            animTimer.Tick += AnimTick;

            MouseDown += OnMouseDown;
            MouseUp += OnMouseUp;
            MouseMove += OnMouseMove;
            MouseWheel += OnMouseWheel;
            MouseLeave += delegate {
                hoverCat = -1;
                hoverCardIdx = -1;
                hoverNodeId = "";
                if (cfg != null && cfg.pocket != null && cfg.pocket.pocketed) {
                    pocketHover = false;
                    pocketHideAt = DateTime.UtcNow.AddMilliseconds(
                        cfg.pocket.hideDelayMs);
                    KickMotion(cfg.pocket.hideDelayMs + 400);
                } else {
                    KickMotion(900);
                }
                Invalidate();
            };
            MouseCaptureChanged += delegate {
                if (dragging && !Capture) CancelDrag();
            };
            KeyDown += OnKeyDown;
            ReloadVisualTheme();
        }

        ThemeMetrics Tm { get { return cfg != null && cfg.theme != null ? cfg.theme : new ThemeMetrics(); } }
        int MotionMs {
            get {
                int pct = cfg != null ? Math.Max(0, Math.Min(160, cfg.motionPercent)) : 100;
                return Math.Max(80, Tm.animMs * pct / 100);
            }
        }
        int ScaledMs(int value) {
            int pct = cfg != null ? Math.Max(0, Math.Min(160, cfg.motionPercent)) : 100;
            int stylePct = styleProfile != null ? styleProfile.AnimationSpeed : 100;
            return Math.Max(1, StyleDuration(value) * pct * stylePct / 10000);
        }
        string MotionStyle {
            get {
                return FoxNodesSync.NormalizeMotionStyle(
                    styleProfile != null ? styleProfile.AnimationStyle : "smooth");
            }
        }
        int StyleDuration(int value) {
            string style = MotionStyle;
            if (style == "restrained") return value * 72 / 100;
            if (style == "spring") return value * 118 / 100;
            if (style == "minimal") return value * 38 / 100;
            return value;
        }
        int StaggerMs(int value) {
            string style = MotionStyle;
            if (style == "minimal") return 0;
            if (style == "restrained") return value / 2;
            return value;
        }
        public int CurrentRevision {
            get {
                int a = cfg != null ? cfg.revision : 1;
                int b = styleProfile != null ? styleProfile.Revision : 1;
                return Math.Max(1, Math.Max(a, b));
            }
        }
        int CategoryTotalMs {
            get {
                int count = cfg != null && cfg.categories != null ? cfg.categories.Count : 1;
                return ScaledMs(Tm.categoryEnterMs +
                    Math.Max(0, count - 1) * StaggerMs(Tm.categoryStaggerMs));
            }
        }
        int BranchTotalMs(bool opening) {
            if (!opening) return ScaledMs(Tm.branchCloseMs);
            MenuNodeSpec parent = CurrentCardParent();
            int count = parent != null && parent.children != null ? parent.children.Count : 1;
            int stagger = StaggerMs(Math.Min(120, Math.Max(0, count - 1) * Tm.cardStaggerMs));
            return ScaledMs(Tm.branchOpenMs + stagger);
        }

        int D(int dip) { return (int)Math.Round(dip * dpiScale); }
        int S(int dip) {
            int scale = styleProfile != null ? styleProfile.NodeScale : 100;
            return (int)Math.Round(dip * dpiScale * scale / 100f);
        }
        float Sf(float dip) { return (float)(dip * dpiScale); }

        static Font CreateIconFont(float size) {
            try {
                var fluent = new Font("Segoe Fluent Icons", size, FontStyle.Regular, GraphicsUnit.Point);
                if (fluent.Name.IndexOf("Segoe Fluent", StringComparison.OrdinalIgnoreCase) >= 0)
                    return fluent;
                fluent.Dispose();
            } catch { }
            return new Font("Segoe MDL2 Assets", size, FontStyle.Regular, GraphicsUnit.Point);
        }

        void RecreateFonts(int scale) {
            scale = Math.Max(80, Math.Min(140, scale));
            Font oldIcon = iconFont, oldLabel = labelFont, oldCard = cardFont, oldSmall = smallFont;
            iconFont = CreateIconFont(12.75f * scale / 100f);
            labelFont = new Font("Segoe UI", 9f * scale / 100f, FontStyle.Regular, GraphicsUnit.Point);
            cardFont = new Font("Segoe UI", 9.5f * scale / 100f, FontStyle.Regular, GraphicsUnit.Point);
            smallFont = new Font("Segoe UI", 8f * scale / 100f, FontStyle.Regular, GraphicsUnit.Point);
            if (oldIcon != null) oldIcon.Dispose();
            if (oldLabel != null) oldLabel.Dispose();
            if (oldCard != null) oldCard.Dispose();
            if (oldSmall != null) oldSmall.Dispose();
        }

        public void ReloadConfig() {
            string cat = activeCategoryId;
            var path = new System.Collections.Generic.List<string>(branchIds);
            bool pocketed = cfg != null && cfg.pocket != null && cfg.pocket.pocketed;
            float savedPocketT = pocketT;
            float savedPocketTarget = pocketTarget;
            LauncherMode mode = launcherMode;
            bool expanded = categoriesExpanded;
            nodeStore.Reload();
            cfg = nodeStore.Config;
            ReloadVisualTheme();
            NodeStore.PruneOpenPath(cfg, ref cat, path);
            activeCategoryId = cat;
            branchIds.Clear();
            for (int i = 0; i < path.Count; i++) branchIds.Add(path[i]);
            if (pocketed && cfg.pocket != null && cfg.pocket.enabled) {
                cfg.pocket.pocketed = true;
                pocketT = savedPocketT;
                pocketTarget = savedPocketTarget;
                launcherMode = mode;
                categoriesExpanded = expanded;
                if (mode == LauncherMode.PocketHidden || mode == LauncherMode.PocketVisible)
                    PositionWindowAtPocket();
            }
            LayoutAndClamp();
            Invalidate();
        }

        public void NotifyApplied() {
            applyPulse = 1f;
            applyPulseAt = DateTime.UtcNow;
            KickMotion(ScaledMs(320) + 80);
            Invalidate();
        }

        public void ToggleAtCursor() {
            ShowDesktop();
            ActivateGraph();
        }

        public void ReflowDisplays() {
            if (IsDisposed) return;
            Point centerScreen;
            try { centerScreen = PointToScreen(PocketRenderCenter()); }
            catch { centerScreen = Cursor.Position; }
            desktopScreen = Screen.FromPoint(centerScreen);
            if (cfg.pocket != null && cfg.pocket.pocketed) {
                PositionWindowAtPocket();
            } else {
                Rectangle wa = desktopScreen.WorkingArea;
                int radius = S(Tm.centerNodeDip) / 2;
                centerScreen.X = Math.Max(wa.Left + radius,
                    Math.Min(centerScreen.X, wa.Right - radius));
                centerScreen.Y = Math.Max(wa.Top + radius,
                    Math.Min(centerScreen.Y, wa.Bottom - radius));
                PlaceAtScreen(centerScreen.X - anchor.X,
                    centerScreen.Y - anchor.Y, true);
                SaveDesktopPosition();
            }
            LayoutAndClamp();
            Invalidate();
        }

        public void ShowDesktop() {
            ReloadConfig();
            RefreshExternalTheme(true);
            animEnabled = styleProfile.Animations &&
                (!styleProfile.RespectSystemMotion || NativeWin.AnimationsEnabled());
            desktopScreen = Screen.FromPoint(Cursor.Position);
            dpiScale = 1f;
            try {
                using (Graphics g = CreateGraphics()) {
                    dpiScale = g.DpiX / 96f;
                }
            } catch { dpiScale = 1f; }

            // Keep only the graph island, not a transparent monitor-sized window.
            // This is the key to reliable clicks in Explorer and other applications.
            int islandW = Math.Min(desktopScreen.WorkingArea.Width, D(1180));
            int islandH = Math.Min(desktopScreen.WorkingArea.Height, D(760));
            if (islandW < D(760)) islandW = desktopScreen.WorkingArea.Width;
            if (islandH < D(560)) islandH = desktopScreen.WorkingArea.Height;
            Size = new Size(islandW, islandH);
            workArea = ClientRectangle;
            anchor = new Point((int)(islandW * 0.37), islandH / 2);

            Point target = new Point(
                desktopScreen.WorkingArea.X + (int)(desktopScreen.WorkingArea.Width * cfg.desktopX),
                desktopScreen.WorkingArea.Y + (int)(desktopScreen.WorkingArea.Height * cfg.desktopY));
            int left = target.X - anchor.X;
            int top = target.Y - anchor.Y;
            left = Math.Max(desktopScreen.WorkingArea.Left,
                Math.Min(left, desktopScreen.WorkingArea.Right - islandW));
            top = Math.Max(desktopScreen.WorkingArea.Top,
                Math.Min(top, desktopScreen.WorkingArea.Bottom - islandH));
            PlaceAtScreen(left, top, false);

            activeCategoryId = "";
            branchIds.Clear();
            kbMode = 0;
            kbCatIdx = 0;
            kbCardIdx = 0;
            cardScroll = 0;
            hoverCat = -1;
            centerT = animEnabled ? 0f : 1f;
            centerStarted = DateTime.UtcNow;
            if (cfg.pocket != null && cfg.pocket.pocketed && cfg.pocket.enabled) {
                showT = showFrom = showTo = 0f;
                categoriesExpanded = false;
                pocketT = pocketTarget = 0f;
                launcherMode = LauncherMode.PocketHidden;
                PositionWindowAtPocket();
            } else if (cfg.startCollapsed) {
                showT = showFrom = showTo = 0f;
                categoriesExpanded = false;
                launcherMode = LauncherMode.Collapsed;
            } else {
                RestartShow(0f);
            }
            RestartBranch(0f);
            LayoutAndClamp();
            if (!Visible) Show();
            PinToDesktopLevel();
            visibleAnim = showT < 1f || branchT < 1f;
            KickMotion(6500);
            Invalidate();
        }

        public void ActivateGraph() {
            if (!Visible) ShowDesktop();
            if (cfg.pocket != null && cfg.pocket.pocketed)
                RestoreFromPocket(false);
            focusBefore = NativeWin.GetForegroundWindow();
            // Never raise over normal applications. This is a desktop island: apps
            // cover it naturally, while transparent pixels do not consume input.
            PinToDesktopLevel();
            RestartShow(0.35f);
            KickMotion(4500);
            Invalidate();
        }

        void PinToDesktopLevel() {
            if (!IsHandleCreated) return;
            TopMost = false;
            wallpaperHost = NativeWin.FindFoxOsWallpaperHost();
            if (wallpaperHost != IntPtr.Zero) {
                // Slot the launcher immediately above FoxOS Live. New/normal app
                // windows remain above both, while wallpaper can no longer cover it.
                IntPtr aboveWallpaper = NativeWin.GetWindow(
                    wallpaperHost, NativeWin.GW_HWNDPREV);
                NativeWin.SetWindowPos(Handle,
                    aboveWallpaper != IntPtr.Zero ? aboveWallpaper : NativeWin.HWND_TOP,
                    0, 0, 0, 0,
                    NativeWin.SWP_NOMOVE | NativeWin.SWP_NOSIZE |
                    NativeWin.SWP_NOACTIVATE | NativeWin.SWP_SHOWWINDOW);
                return;
            }
            if (desktopHost == IntPtr.Zero) {
                Point screenLocation = PointToScreen(Point.Empty);
                desktopHost = NativeWin.FindInteractiveDesktopHost();
                if (desktopHost != IntPtr.Zero) {
                    NativeWin.SetParent(Handle, desktopHost);
                    PlaceAtScreen(screenLocation.X, screenLocation.Y, true);
                    return;
                }
            }
            if (desktopHost != IntPtr.Zero) {
                NativeWin.SetWindowPos(Handle, NativeWin.HWND_TOP, 0, 0, 0, 0,
                    NativeWin.SWP_NOMOVE | NativeWin.SWP_NOSIZE |
                    NativeWin.SWP_NOACTIVATE | NativeWin.SWP_SHOWWINDOW);
            } else {
                NativeWin.SetWindowPos(Handle, NativeWin.HWND_BOTTOM, 0, 0, 0, 0,
                    NativeWin.SWP_NOMOVE | NativeWin.SWP_NOSIZE |
                    NativeWin.SWP_NOACTIVATE | NativeWin.SWP_SHOWWINDOW);
            }
        }

        void PlaceAtScreen(int screenX, int screenY, bool keepSize) {
            if (!IsHandleCreated) {
                Bounds = new Rectangle(screenX, screenY, Width, Height);
                return;
            }
            uint flags = NativeWin.SWP_NOACTIVATE | NativeWin.SWP_SHOWWINDOW;
            if (keepSize) flags |= NativeWin.SWP_NOSIZE;
            int x = screenX;
            int y = screenY;
            IntPtr after = NativeWin.HWND_BOTTOM;
            if (wallpaperHost != IntPtr.Zero) {
                IntPtr aboveWallpaper = NativeWin.GetWindow(
                    wallpaperHost, NativeWin.GW_HWNDPREV);
                after = aboveWallpaper != IntPtr.Zero ? aboveWallpaper : NativeWin.HWND_TOP;
            } else if (desktopHost != IntPtr.Zero) {
                var p = new NativeWin.PointNative(screenX, screenY);
                NativeWin.ScreenToClient(desktopHost, ref p);
                x = p.X;
                y = p.Y;
                after = NativeWin.HWND_TOP;
            }
            NativeWin.SetWindowPos(Handle, after, x, y, Width, Height, flags);
        }

        Rectangle PocketReceiverScreen() {
            Screen sc = desktopScreen ?? Screen.FromPoint(Cursor.Position);
            Rectangle wa = sc.WorkingArea;
            int pos = cfg != null && cfg.pocket != null
                ? cfg.pocket.positionPercent : 48;
            string edge = cfg != null && cfg.pocket != null
                ? cfg.pocket.edge : "right";
            if (edge == "top") {
                int x = wa.Left + wa.Width * pos / 100;
                return new Rectangle(x - D(55), wa.Top, D(110), D(72));
            }
            int y = wa.Top + wa.Height * pos / 100;
            if (edge == "left")
                return new Rectangle(wa.Left, y - D(55), D(72), D(110));
            return new Rectangle(wa.Right - D(72), y - D(55), D(72), D(110));
        }

        Point PocketHiddenCenterScreen() {
            Rectangle receiver = PocketReceiverScreen();
            Rectangle wa = (desktopScreen ?? Screen.FromPoint(Cursor.Position)).WorkingArea;
            int radius = S(Tm.centerNodeDip) / 2;
            int activation = D(cfg.pocket.activationDip);
            if (cfg.pocket.edge == "left")
                return new Point(wa.Left - radius + activation, receiver.Top + receiver.Height / 2);
            if (cfg.pocket.edge == "top")
                return new Point(receiver.Left + receiver.Width / 2, wa.Top - radius + activation);
            return new Point(wa.Right + radius - activation, receiver.Top + receiver.Height / 2);
        }

        Point PocketRenderCenter() {
            if (cfg == null || cfg.pocket == null || !cfg.pocket.pocketed) return anchor;
            Point p = anchor;
            int shift = S(Tm.centerNodeDip) + D(10) - D(cfg.pocket.activationDip);
            if (cfg.pocket.edge == "left") p.X += (int)(shift * pocketT);
            else if (cfg.pocket.edge == "top") p.Y += (int)(shift * pocketT);
            else p.X -= (int)(shift * pocketT);
            return p;
        }

        void PositionWindowAtPocket() {
            if (cfg == null || cfg.pocket == null) return;
            Point hidden = PocketHiddenCenterScreen();
            PlaceAtScreen(hidden.X - anchor.X, hidden.Y - anchor.Y, true);
        }

        void DockToPocket() {
            if (cfg == null || cfg.pocket == null || !cfg.pocket.enabled) return;
            cfg.pocket.pocketed = true;
            launcherMode = LauncherMode.PocketVisible;
            categoriesExpanded = false;
            showT = showFrom = showTo = 0f;
            activeCategoryId = "";
            branchIds.Clear();
            branchT = branchFrom = branchTo = 0f;
            PositionWindowAtPocket();
            pocketT = 1f;
            pocketTarget = 0f;
            pocketHover = false;
            pocketHideAt = DateTime.UtcNow;
            nodeStore.Save();
            KickMotion(ScaledMs(260) + 100);
            LayoutAndClamp();
            Invalidate();
        }

        void RestoreFromPocket(bool openMenu) {
            if (cfg == null || cfg.pocket == null) return;
            cfg.pocket.pocketed = false;
            launcherMode = openMenu ? LauncherMode.Expanded : LauncherMode.Collapsed;
            pocketT = pocketTarget = 0f;
            Screen sc = desktopScreen ?? Screen.FromPoint(Cursor.Position);
            Rectangle wa = sc.WorkingArea;
            Point target = new Point(
                wa.Left + (int)(wa.Width * cfg.lastNormalX),
                wa.Top + (int)(wa.Height * cfg.lastNormalY));
            int left = Math.Max(wa.Left - anchor.X + S(Tm.centerNodeDip) / 2,
                Math.Min(target.X - anchor.X,
                    wa.Right - anchor.X - S(Tm.centerNodeDip) / 2));
            int top = Math.Max(wa.Top - anchor.Y + S(Tm.centerNodeDip) / 2,
                Math.Min(target.Y - anchor.Y,
                    wa.Bottom - anchor.Y - S(Tm.centerNodeDip) / 2));
            PlaceAtScreen(left, top, true);
            nodeStore.Save();
            if (openMenu) AnimateShowTo(1f);
            LayoutAndClamp();
            Invalidate();
        }

        Rectangle PocketActivationLocal() {
            Rectangle receiver = PocketReceiverScreen();
            int strip = D(cfg.pocket.activationDip);
            Rectangle screen;
            Rectangle wa = (desktopScreen ?? Screen.FromPoint(Cursor.Position)).WorkingArea;
            if (cfg.pocket.edge == "left")
                screen = new Rectangle(wa.Left, receiver.Top, strip, receiver.Height);
            else if (cfg.pocket.edge == "top")
                screen = new Rectangle(receiver.Left, wa.Top, receiver.Width, strip);
            else
                screen = new Rectangle(wa.Right - strip, receiver.Top, strip, receiver.Height);
            Point a = PointToClient(screen.Location);
            return new Rectangle(a, screen.Size);
        }

        void UpdatePocketDrop() {
            pocketDropHot = cfg != null && cfg.pocket != null &&
                cfg.pocket.enabled && PocketReceiverScreen().Contains(Cursor.Position);
            KickMotion(400);
            Invalidate();
        }

        void KickMotion(int milliseconds) {
            if (!animEnabled) return;
            DateTime until = DateTime.UtcNow.AddMilliseconds(milliseconds);
            if (until > motionUntil) motionUntil = until;
            if (!animTimer.Enabled) animTimer.Start();
        }

        void RestartShow(float initial) {
            if (!animEnabled) {
                showT = 1f;
                showFrom = showTo = 1f;
                return;
            }
            showT = Math.Max(0f, Math.Min(1f, initial));
            showFrom = showT;
            showTo = 1f;
            categoriesExpanded = true;
            launcherMode = LauncherMode.Expanded;
            showStarted = DateTime.UtcNow;
            lastFrame = DateTime.UtcNow;
        }

        void RestartBranch(float initial) {
            if (!animEnabled) {
                branchT = 1f;
                branchFrom = branchTo = 1f;
                return;
            }
            branchT = Math.Max(0f, Math.Min(1f, initial));
            branchFrom = branchT;
            branchTo = 1f;
            clearBranchAfterAnimation = false;
            branchStarted = DateTime.UtcNow;
            lastFrame = DateTime.UtcNow;
        }

        void AnimateShowTo(float target) {
            target = Math.Max(0f, Math.Min(1f, target));
            showFrom = showT;
            showTo = target;
            categoriesExpanded = target > 0.5f;
            launcherMode = target > 0.5f
                ? LauncherMode.Expanded : LauncherMode.Collapsed;
            showStarted = DateTime.UtcNow;
            lastFrame = showStarted;
            KickMotion(MotionMs + 500);
        }

        void AnimateBranchTo(float target, bool clearAfter) {
            target = Math.Max(0f, Math.Min(1f, target));
            branchFrom = branchT;
            branchTo = target;
            clearBranchAfterAnimation = clearAfter;
            branchStarted = DateTime.UtcNow;
            lastFrame = branchStarted;
            KickMotion(MotionMs + 500);
        }

        public void CloseMenu() {
            if (!string.IsNullOrEmpty(activeCategoryId))
                AnimateBranchTo(0f, true);
            else
                AnimateShowTo(0f);
            NativeWin.RestoreFocus(focusBefore);
            focusBefore = IntPtr.Zero;
        }

        public void HideGraph() {
            animTimer.Stop();
            visibleAnim = false;
            Hide();
            NativeWin.RestoreFocus(focusBefore);
            focusBefore = IntPtr.Zero;
        }

        void AnimTick(object sender, EventArgs e) {
            DateTime now = DateTime.UtcNow;
            float dt = (float)Math.Max(0.001, Math.Min(0.05, (now - lastFrame).TotalSeconds));
            lastFrame = now;
            bool need = false;
            if (themeAnimating) {
                float p = (float)Math.Min(1.0,
                    (now - themeStarted).TotalMilliseconds / Math.Max(1, ScaledMs(220)));
                ApplyThemeProgress(p);
                if (p >= 1f) themeAnimating = false;
                else need = true;
            }
            if (applyPulse > 0.01f) {
                float p = (float)Math.Min(1.0,
                    (now - applyPulseAt).TotalMilliseconds / Math.Max(1, ScaledMs(280)));
                applyPulse = 1f - EaseOutCubic(p);
                if (p >= 1f) applyPulse = 0f;
                else need = true;
            }
            if (cfg != null && cfg.pocket != null && cfg.pocket.pocketed) {
                if (pocketHover && now >= pocketShowAt) pocketTarget = 1f;
                if (!pocketHover && now >= pocketHideAt) pocketTarget = 0f;
                float speed = dt * 1000f / Math.Max(1, ScaledMs(220));
                pocketT += (pocketTarget - pocketT) * Math.Min(1f, speed);
                if (Math.Abs(pocketTarget - pocketT) < 0.01f) pocketT = pocketTarget;
                else need = true;
                launcherMode = pocketT > 0.02f
                    ? LauncherMode.PocketVisible : LauncherMode.PocketHidden;
                if ((pocketHover && now < pocketShowAt) ||
                    (!pocketHover && now < pocketHideAt)) need = true;
                LayoutAndClamp();
            }
            if (centerT < 1f) {
                centerT = (float)Math.Min(1.0,
                    (now - centerStarted).TotalMilliseconds /
                    Math.Max(1, ScaledMs(Tm.centerEnterMs)));
                if (centerT < 1f) need = true;
            }
            if (Math.Abs(showT - showTo) > 0.001f) {
                double duration = Math.Max(1, CategoryTotalMs *
                    Math.Max(0.35, Math.Abs(showTo - showFrom)));
                float p = (float)Math.Min(1.0,
                    (now - showStarted).TotalMilliseconds / duration);
                showT = showFrom + (showTo - showFrom) * p;
                if (p >= 1f) showT = showTo;
                else need = true;
            }
            if (Math.Abs(branchT - branchTo) > 0.001f) {
                bool opening = branchTo > branchFrom;
                double duration = Math.Max(1, BranchTotalMs(opening) *
                    Math.Max(0.35, Math.Abs(branchTo - branchFrom)));
                float p = (float)Math.Min(1.0,
                    (now - branchStarted).TotalMilliseconds / duration);
                branchT = branchFrom + (branchTo - branchFrom) *
                    (opening ? p : EaseInOutCubic(p));
                if (p >= 1f) {
                    branchT = branchTo;
                    if (branchTo <= 0.001f) {
                        if (pendingPopSubmenu && branchIds.Count > 0) {
                            branchIds.RemoveAt(branchIds.Count - 1);
                            pendingPopSubmenu = false;
                            clearBranchAfterAnimation = false;
                            RestartBranch(0f);
                            need = true;
                        } else if (clearBranchAfterAnimation ||
                            !string.IsNullOrEmpty(pendingCategoryId)) {
                            string next = pendingCategoryId;
                            pendingCategoryId = "";
                            activeCategoryId = "";
                            branchIds.Clear();
                            kbMode = 0;
                            clearBranchAfterAnimation = false;
                            if (!string.IsNullOrEmpty(next)) {
                                activeCategoryId = next;
                                kbMode = 1;
                                RestartBranch(0f);
                                need = true;
                            }
                        }
                    }
                } else need = true;
            }
            float hoverTarget = hoverNodeId == "__center" ? 1f : 0f;
            hoverEase += (hoverTarget - hoverEase) * Math.Min(1f,
                dt * 1000f / Math.Max(1, ScaledMs(Tm.hoverMs)));
            if (Math.Abs(hoverTarget - hoverEase) > 0.01f) need = true;
            var ids = new List<string>(hoverLevels.Keys);
            for (int i = 0; i < ids.Count; i++) {
                string id = ids[i];
                float target = id == hoverNodeId ? 1f : 0f;
                float value = hoverLevels[id];
                value += (target - value) * Math.Min(1f,
                    dt * 1000f / Math.Max(1, ScaledMs(Tm.hoverMs)));
                if (Math.Abs(target - value) < 0.01f) value = target;
                else need = true;
                hoverLevels[id] = value;
            }
            var pressIds = new List<string>(pressLevels.Keys);
            for (int i = 0; i < pressIds.Count; i++) {
                string id = pressIds[i];
                float target = id == pressedNodeId ? 1f : 0f;
                float value = pressLevels[id];
                value += (target - value) * Math.Min(1f,
                    dt * 1000f / Math.Max(1, ScaledMs(Tm.pressMs)));
                if (Math.Abs(target - value) < 0.01f) value = target;
                else need = true;
                pressLevels[id] = value;
            }
            if (!need) {
                animTimer.Stop();
                visibleAnim = false;
            }
            Invalidate();
        }

        float HoverOf(MenuNodeSpec node) {
            if (node == null || string.IsNullOrEmpty(node.id)) return 0f;
            float value;
            if (!hoverLevels.TryGetValue(node.id, out value)) {
                value = node.id == hoverNodeId ? 1f : 0f;
                hoverLevels[node.id] = value;
            }
            return value;
        }

        float PressOf(MenuNodeSpec node) {
            if (node == null || string.IsNullOrEmpty(node.id)) return 0f;
            float value;
            if (!pressLevels.TryGetValue(node.id, out value)) {
                value = node.id == pressedNodeId ? 1f : 0f;
                pressLevels[node.id] = value;
            }
            return value;
        }

        void ReloadVisualTheme() {
            RefreshExternalTheme(true);
        }

        public void RefreshExternalTheme() {
            RefreshExternalTheme(false);
        }

        public void RefreshExternalTheme(bool immediate) {
            DateTime now = DateTime.UtcNow;
            if (!immediate && (now - lastThemeCheck).TotalMilliseconds < 450) return;
            lastThemeCheck = now;
            NodeStyleProfile next = ThemeBridge.Load();
            if (!immediate && SameStyle(styleProfile, next)) return;

            int oldTextScale = styleProfile != null ? styleProfile.TextScale : 100;
            styleProfile = next;
            animEnabled = next.Animations &&
                (!next.RespectSystemMotion || NativeWin.AnimationsEnabled());
            if (oldTextScale != next.TextScale) RecreateFonts(next.TextScale);
            themeFromSurface = surface;
            themeFromInk = ink;
            themeFromMuted = accent;
            themeFromAccent = accent2;
            themeFromAccent2 = accent2;
            themeToSurface = next.Surface;
            themeToInk = next.Ink;
            themeToMuted = next.Muted;
            themeToAccent = next.Accent;
            themeToAccent2 = next.Accent2;
            if (immediate || !animEnabled) {
                ApplyThemeProgress(1f);
                themeAnimating = false;
            } else {
                themeStarted = now;
                themeAnimating = true;
                KickMotion(600);
            }
            if (cfg != null && cfg.pocket != null) {
                cfg.pocket.enabled = next.PocketEnabled;
                cfg.pocket.edge = next.PocketEdge;
                cfg.pocket.positionPercent = next.PocketPosition;
                cfg.pocket.activationDip = next.PocketActivationDip;
                cfg.pocket.showDelayMs = next.PocketShowDelayMs;
                cfg.pocket.hideDelayMs = next.PocketHideDelayMs;
                cfg.pocket.marker = next.PocketMarker;
            }
            LayoutAndClamp();
            Invalidate();
        }

        static bool SameStyle(NodeStyleProfile a, NodeStyleProfile b) {
            if (a == null || b == null) return false;
            return a.Surface.ToArgb() == b.Surface.ToArgb() &&
                a.Ink.ToArgb() == b.Ink.ToArgb() &&
                a.Accent.ToArgb() == b.Accent.ToArgb() &&
                a.Accent2.ToArgb() == b.Accent2.ToArgb() &&
                a.Opacity == b.Opacity && a.NodeScale == b.NodeScale &&
                a.TextScale == b.TextScale && a.Spacing == b.Spacing &&
                a.LineContrast == b.LineContrast &&
                a.Animations == b.Animations &&
                a.AnimationSpeed == b.AnimationSpeed &&
                a.MotionIntensity == b.MotionIntensity &&
                a.RespectSystemMotion == b.RespectSystemMotion &&
                a.PocketEnabled == b.PocketEnabled &&
                a.PocketEdge == b.PocketEdge &&
                a.PocketPosition == b.PocketPosition &&
                a.PocketActivationDip == b.PocketActivationDip &&
                a.PocketShowDelayMs == b.PocketShowDelayMs &&
                a.PocketHideDelayMs == b.PocketHideDelayMs &&
                a.PocketMarker == b.PocketMarker &&
                a.AnimationStyle == b.AnimationStyle &&
                a.Revision == b.Revision;
        }

        void ApplyThemeProgress(float t) {
            t = EaseOutCubic(Math.Max(0f, Math.Min(1f, t)));
            surface = LerpColor(themeFromSurface, themeToSurface, t);
            ink = LerpColor(themeFromInk, themeToInk, t);
            accent = LerpColor(themeFromMuted, themeToMuted, t);
            accent2 = LerpColor(themeFromAccent, themeToAccent, t);
            night = Blend(surface, Color.Black,
                Brightness(surface) > 150 ? 8 : 30);
        }

        static Color LerpColor(Color a, Color b, float t) {
            return Color.FromArgb(
                (int)(a.R + (b.R - a.R) * t),
                (int)(a.G + (b.G - a.G) * t),
                (int)(a.B + (b.B - a.B) * t));
        }

        static int Brightness(Color c) {
            return (c.R * 299 + c.G * 587 + c.B * 114) / 1000;
        }

        static Color ParseThemeColor(string value, Color fallback) {
            if (string.IsNullOrEmpty(value)) return fallback;
            string h = value.Trim().TrimStart('#');
            if (h.Length != 6) return fallback;
            try {
                return Color.FromArgb(
                    Convert.ToInt32(h.Substring(0, 2), 16),
                    Convert.ToInt32(h.Substring(2, 2), 16),
                    Convert.ToInt32(h.Substring(4, 2), 16));
            } catch { return fallback; }
        }

        void LayoutAndClamp() {
            hits.Clear();
            contentBounds = Rectangle.Empty;
            if (cfg == null || cfg.categories == null || cfg.categories.Count == 0) return;

            int centerR = S(Tm.centerNodeDip) / 2;
            int catR = S(Tm.categoryNodeDip) / 2;
            int dist = S(Tm.categoryRadiusDip) *
                Math.Max(75, Math.Min(150, styleProfile.Spacing)) / 100;
            int n = cfg.categories.Count;
            double step = Math.PI * 2.0 / n;
            double start = -Math.PI / 2.0;

            Point center = PocketRenderCenter();
            var pts = new List<Point>();
            for (int i = 0; i < n; i++) {
                pts.Add(CategoryPoint(center, i, n, dist));
            }

            Rectangle box = new Rectangle(center.X - centerR, center.Y - centerR, centerR * 2, centerR * 2);
            for (int i = 0; i < n; i++) {
                Point p = pts[i];
                Rectangle r = new Rectangle(p.X - catR, p.Y - catR, catR * 2, catR * 2);
                box = Union(box, r);
                Rectangle lbl = LabelRect(cfg.categories[i].title, p, catR);
                box = Union(box, lbl);
            }

            List<Rectangle> cardCols = LayoutCardColumns(pts, n, catR, center);
            for (int c = 0; c < cardCols.Count; c++) box = Union(box, cardCols[c]);

            contentBounds = box;
            BuildHits(center, centerR, pts, catR, cardCols);
        }

        Point CategoryPoint(Point center, int index, int count, int distance) {
            double a = -Math.PI / 2.0 + Math.PI * 2.0 * index / count;
            MenuNodeSpec node = cfg.categories[index];
            return new Point(
                center.X + (int)Math.Round(Math.Cos(a) * distance) + S(node.offsetXDip),
                center.Y + (int)Math.Round(Math.Sin(a) * distance) + S(node.offsetYDip));
        }

        Point CategoryRenderPoint(Point center, Point finalPoint, float reveal) {
            float dx = finalPoint.X - center.X;
            float dy = finalPoint.Y - center.Y;
            float len = (float)Math.Sqrt(dx * dx + dy * dy);
            if (len < 1f) return finalPoint;
            float travel = S(Tm.categoryTravelDip) * (1f - reveal) *
                Math.Max(0, Math.Min(150, styleProfile.MotionIntensity)) / 100f;
            return new Point(
                finalPoint.X - (int)Math.Round(dx / len * travel),
                finalPoint.Y - (int)Math.Round(dy / len * travel));
        }

        List<Rectangle> LayoutCardColumns(List<Point> catPts, int n, int catR, Point center) {
            var cols = new List<Rectangle>();
            if (string.IsNullOrEmpty(activeCategoryId)) return cols;

            int catIdx = IndexOfCategory(activeCategoryId);
            if (catIdx < 0) return cols;

            Point from = catPts[catIdx];
            int startDepth = VisibleBranchStart();
            int visibleColumns = branchIds.Count - startDepth + 1;
            Rectangle graphBounds = RadialGraphBounds(catPts, catR, center);
            bool flip = ShouldFlipCards(from, visibleColumns, graphBounds);
            int colX = FirstCardColumnX(flip, graphBounds);
            int y = from.Y - S(40);

            MenuNodeSpec parent = ParentAtDepth(cfg.categories[catIdx], startDepth);
            Rectangle selectedParent = Rectangle.Empty;
            for (int depth = startDepth; depth <= branchIds.Count; depth++) {
                if (parent == null) break;
                List<MenuNodeSpec> items = parent.children;
                if (items == null || items.Count == 0) break;

                int cardW = S(Tm.cardWidthDip);
                int cardH = S(Tm.cardHeightDip);
                int gap = S(Tm.cardGapDip);
                int maxH = S(320);
                int totalH = items.Count * (cardH + gap) - gap;
                int scroll = 0;
                if (depth == branchIds.Count) scroll = cardScroll;
                int colH = Math.Min(totalH, maxH);
                int colTop = depth == startDepth || selectedParent.IsEmpty ? y : selectedParent.Top;
                if (colTop + colH > workArea.Bottom - S(8)) colTop = workArea.Bottom - S(8) - colH;
                if (colTop < workArea.Top + S(8)) colTop = workArea.Top + S(8);

                Rectangle colBox = new Rectangle(colX, colTop, cardW, colH);
                cols.Add(colBox);

                if (depth < branchIds.Count) {
                    string id = branchIds[depth];
                    MenuNodeSpec next = FindChild(parent, id);
                    if (next == null) break;
                    int selectedIndex = 0;
                    for (int i = 0; i < items.Count; i++) {
                        if (items[i].id == id) { selectedIndex = i; break; }
                    }
                    selectedParent = CardFinalRect(colBox, next, selectedIndex, scroll);
                    parent = next;
                    colX = flip ? colX - cardW - S(32) : colX + cardW + S(32);
                } else break;
            }
            return cols;
        }

        int VisibleBranchStart() {
            // Two readable command columns fit the compact desktop island at
            // 100–200% DPI. Older ancestors become a clickable breadcrumb.
            return Math.Max(0, branchIds.Count - 1);
        }

        MenuNodeSpec ParentAtDepth(MenuNodeSpec category, int depth) {
            MenuNodeSpec parent = category;
            for (int i = 0; i < depth && parent != null; i++)
                parent = FindChild(parent, branchIds[i]);
            return parent;
        }

        Rectangle RadialGraphBounds(List<Point> catPts, int catR, Point center) {
            int centerR = S(Tm.centerNodeDip) / 2;
            Rectangle bounds = new Rectangle(
                center.X - centerR, center.Y - centerR,
                centerR * 2, centerR * 2);
            for (int i = 0; i < catPts.Count; i++) {
                Point point = catPts[i];
                bounds = Union(bounds, new Rectangle(
                    point.X - catR, point.Y - catR,
                    catR * 2, catR * 2));
                if (i < cfg.categories.Count)
                    bounds = Union(bounds,
                        LabelRect(cfg.categories[i].title, point, catR));
            }
            return bounds;
        }

        int FirstCardColumnX(bool flip, Rectangle graphBounds) {
            int gap = S(24);
            return flip
                ? graphBounds.Left - gap - S(Tm.cardWidthDip)
                : graphBounds.Right + gap;
        }

        bool ShouldFlipCards(Point from, int columns, Rectangle graphBounds) {
            int cardW = S(Tm.cardWidthDip);
            int span = columns * cardW + Math.Max(0, columns - 1) * S(32);
            int gap = S(24);
            bool fitsRight = graphBounds.Right + gap + span <= workArea.Right - S(10);
            bool fitsLeft = graphBounds.Left - gap - span >= workArea.Left + S(10);
            bool preferLeft = from.X < graphBounds.Left + graphBounds.Width / 2 - S(12);
            if (preferLeft && fitsLeft) return true;
            if (fitsRight) return false;
            if (fitsLeft) return true;
            return graphBounds.Left - workArea.Left >
                workArea.Right - graphBounds.Right;
        }

        Rectangle CardFinalRect(Rectangle column, MenuNodeSpec node, int index, int scroll) {
            int cardH = S(Tm.cardHeightDip);
            int gap = S(Tm.cardGapDip);
            return new Rectangle(
                column.X + S(node.offsetXDip),
                column.Y + index * (cardH + gap) - scroll + S(node.offsetYDip),
                column.Width,
                cardH);
        }

        Rectangle CardRenderRect(Rectangle column, MenuNodeSpec node, int index,
            int scroll, bool flip, float reveal) {
            Rectangle card = CardFinalRect(column, node, index, scroll);
            int slide = (int)((1f - reveal) * S(Tm.cardTravelDip) *
                Math.Max(0, Math.Min(150, styleProfile.MotionIntensity)) / 100f);
            card.X += flip ? slide : -slide;
            return card;
        }

        void BuildHits(Point center, int centerR, List<Point> catPts, int catR, List<Rectangle> cardCols) {
            hits.Add(new HitZone {
                Bounds = new Rectangle(center.X - centerR, center.Y - centerR, centerR * 2, centerR * 2),
                Kind = "center"
            });
            if (cfg.pocket != null && cfg.pocket.pocketed) {
                hits.Add(new HitZone {
                    Bounds = PocketActivationLocal(),
                    Kind = "pocket"
                });
            }

            for (int i = 0; i < cfg.categories.Count; i++) {
                // Hit the resting slot, not the sliding draw position — otherwise a
                // click during enter/leave animation misses the node the user sees.
                if (!HitPolicy.CategoryOpen(CategoryReveal(i))) continue;
                Point p = catPts[i];
                hits.Add(new HitZone {
                    Bounds = new Rectangle(p.X - catR, p.Y - catR, catR * 2, catR * 2),
                    Kind = "category",
                    Node = cfg.categories[i],
                    CategoryIndex = i
                });
                hits.Add(new HitZone {
                    Bounds = LabelRect(cfg.categories[i].title, p, catR),
                    Kind = "category",
                    Node = cfg.categories[i],
                    CategoryIndex = i
                });
            }

            if (string.IsNullOrEmpty(activeCategoryId) ||
                (branchTo < branchFrom && branchT < 0.2f)) return;
            int catIdx = IndexOfCategory(activeCategoryId);
            if (catIdx < 0) return;
            int startDepth = VisibleBranchStart();
            Rectangle graphBounds = RadialGraphBounds(catPts, catR, center);
            bool flip = ShouldFlipCards(catPts[catIdx],
                branchIds.Count - startDepth + 1, graphBounds);
            MenuNodeSpec parent = ParentAtDepth(cfg.categories[catIdx], startDepth);
            if (startDepth > 0 && cardCols.Count > 0) {
                Rectangle crumb = new Rectangle(cardCols[0].Left,
                    cardCols[0].Top - S(30), cardCols[0].Width, S(24));
                hits.Add(new HitZone {
                    Bounds = crumb,
                    Kind = "breadcrumb",
                    ColumnIndex = startDepth - 1
                });
            }
            for (int localDepth = 0; localDepth < cardCols.Count; localDepth++) {
                int depth = startDepth + localDepth;
                Rectangle col = cardCols[localDepth];
                if (parent == null) break;
                List<MenuNodeSpec> items = parent.children;
                if (items == null) break;
                int cardH = S(Tm.cardHeightDip);
                int gap = S(Tm.cardGapDip);
                int scroll = (depth == branchIds.Count) ? cardScroll : 0;
                for (int i = 0; i < items.Count; i++) {
                    if (!HitPolicy.CardOpen(CardReveal(i, items.Count))) continue;
                    Rectangle card = CardFinalRect(col, items[i], i, scroll);
                    if (card.Bottom < workArea.Top || card.Top > workArea.Bottom) continue;
                    hits.Add(new HitZone {
                        Bounds = card,
                        Kind = "card",
                        Node = items[i],
                        CardIndex = i,
                        ColumnIndex = depth
                    });
                }
                if (depth < branchIds.Count) {
                    parent = FindChild(parent, branchIds[depth]);
                    if (parent == null) break;
                }
            }
        }

        Rectangle LabelRect(string title, Point nodeCenter, int nodeR) {
            Size sz = TextRenderer.MeasureText(title, labelFont);
            int w = sz.Width + S(Tm.labelPadXDip * 2);
            int h = S(Tm.labelHeightDip);
            int x = nodeCenter.X - w / 2;
            int y = nodeCenter.Y + nodeR + S(Tm.labelGapDip);
            return new Rectangle(x, y, w, h);
        }

        static Rectangle Union(Rectangle a, Rectangle b) {
            if (a.Width == 0) return b;
            int x1 = Math.Min(a.Left, b.Left);
            int y1 = Math.Min(a.Top, b.Top);
            int x2 = Math.Max(a.Right, b.Right);
            int y2 = Math.Max(a.Bottom, b.Bottom);
            return Rectangle.FromLTRB(x1, y1, x2, y2);
        }

        int IndexOfCategory(string id) {
            for (int i = 0; i < cfg.categories.Count; i++) {
                if (cfg.categories[i].id == id) return i;
            }
            return -1;
        }

        MenuNodeSpec FindChild(MenuNodeSpec parent, string id) {
            if (parent == null || parent.children == null) return null;
            for (int i = 0; i < parent.children.Count; i++) {
                if (parent.children[i].id == id) return parent.children[i];
            }
            return null;
        }

        protected override void WndProc(ref Message m) {
            if (m.Msg == NativeWin.WM_DPICHANGED) {
                int dpi = (int)(m.WParam.ToInt64() & 0xFFFF);
                if (dpi > 0) dpiScale = dpi / 96f;
                LayoutAndClamp();
                Invalidate();
            }
            if (m.Msg == NativeWin.WM_MOUSEACTIVATE) {
                // Clicking a desktop node must not promote the launcher over apps.
                m.Result = new IntPtr(NativeWin.MA_NOACTIVATE);
                return;
            }
            if (Visible && m.Msg == NativeWin.WM_NCHITTEST) {
                if (hits.Count == 0) LayoutAndClamp();
                long lp = m.LParam.ToInt64();
                int sx = (short)(lp & 0xFFFF);
                int sy = (short)((lp >> 16) & 0xFFFF);
                Point pt = PointToClient(new Point(sx, sy));
                m.Result = new IntPtr(HitAt(pt) != null
                    ? NativeWin.HTCLIENT
                    : NativeWin.HTTRANSPARENT);
                return;
            }
            base.WndProc(ref m);
        }

        HitZone HitAt(Point pt) {
            for (int i = hits.Count - 1; i >= 0; i--) {
                if (hits[i].Bounds.Contains(pt)) return hits[i];
            }
            return null;
        }

        protected override void OnPaint(PaintEventArgs e) {
            LayoutAndClamp();
            Graphics g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.ClearTypeGridFit;

            int centerR = S(Tm.centerNodeDip) / 2;
            Point center = PocketRenderCenter();

            int n = cfg.categories.Count;
            int catR = S(Tm.categoryNodeDip) / 2;
            int dist = S(Tm.categoryRadiusDip) *
                Math.Max(75, Math.Min(150, styleProfile.Spacing)) / 100;
            var renderPoints = new List<Point>();
            var reveals = new List<float>();

            DrawPocketLayer(g, center, centerR);

            for (int i = 0; i < n; i++) {
                Point finalPoint = CategoryPoint(center, i, n, dist);
                float reveal = CategoryReveal(i);
                renderPoints.Add(CategoryRenderPoint(center, finalPoint, reveal));
                reveals.Add(reveal);
            }

            // Connections are a dedicated back layer.
            for (int i = 0; i < n; i++) {
                bool active = cfg.categories[i].id == activeCategoryId;
                DrawNodeLink(g, center, centerR, renderPoints[i], catR,
                    LabelRect(cfg.categories[i].title, renderPoints[i], catR),
                    reveals[i], active);
            }

            if (!string.IsNullOrEmpty(activeCategoryId)) {
                int catIdx = IndexOfCategory(activeCategoryId);
                if (catIdx >= 0) {
                    DrawCardColumns(g, renderPoints, catIdx, catR, 1f);
                }
            }

            // Nodes and text are always above every connector.
            for (int i = 0; i < n; i++) {
                bool active = cfg.categories[i].id == activeCategoryId;
                DrawCategoryNode(g, renderPoints[i], catR, cfg.categories[i],
                    active, HoverOf(cfg.categories[i]), PressOf(cfg.categories[i]),
                    reveals[i]);
            }
            DrawCenter(g, center, centerR, EaseOutCubic(centerT));
            DrawAssistantCards(g, center, centerR);
        }

        public void AttachAssistant(AssistantHost host, AssistantHud hud) {
            assistant = host;
            assistantHud = hud;
            if (hud != null) hud.Attach(this);
            if (host != null) host.Changed += delegate {
                if (!IsDisposed && IsHandleCreated) BeginInvoke(new Action(Invalidate));
            };
        }

        void DrawAssistantCards(Graphics g, Point center, int centerR) {
            if (assistant == null || assistant.Cards.Count == 0) return;
            int x = center.X + centerR + S(28);
            int y = center.Y - S(70);
            for (int i = 0; i < assistant.Cards.Count; i++) {
                AssistantCard card = assistant.Cards[i];
                Rectangle r = new Rectangle(x, y + i * S(46), S(210), S(40));
                card.bounds = r;
                GlassRound(g, r, S(10), card.status == StepStatus.Running ? 0.6f : 0.2f, 0.94f);
                Color mark = accent2;
                if (card.status == StepStatus.Done) mark = Color.FromArgb(96, 180, 120);
                if (card.status == StepStatus.Error) mark = Color.FromArgb(210, 90, 90);
                if (card.status == StepStatus.Cancelled) mark = accent;
                using (var br = new SolidBrush(Color.FromArgb(220, ink)))
                    g.DrawString(card.title, smallFont, br, r.X + S(10), r.Y + S(4));
                using (var br = new SolidBrush(Color.FromArgb(180, mark)))
                    g.DrawString(card.detail, smallFont, br, r.X + S(10), r.Y + S(20));
            }
        }

        void DrawPocketLayer(Graphics g, Point center, int centerR) {
            if (cfg == null || cfg.pocket == null || !cfg.pocket.enabled) return;
            Rectangle receiverScreen = PocketReceiverScreen();
            Rectangle near = receiverScreen;
            near.Inflate(D(54), D(54));
            bool showDrop = dragging && dragZone != null &&
                (dragZone.Kind == "center" || dragZone.Kind == "pocket") &&
                near.Contains(Cursor.Position);
            if (showDrop) {
                Point loc = PointToClient(receiverScreen.Location);
                Rectangle receiver = new Rectangle(loc, receiverScreen.Size);
                float hot = pocketDropHot ? 1f : 0.15f;
                GlassRound(g, receiver, S(18), hot, 0.82f);
                using (var pen = new Pen(Color.FromArgb(
                    pocketDropHot ? 125 : 55, accent2), Sf(1f))) {
                    Rectangle inner = receiver;
                    inner.Inflate(-S(7), -S(7));
                    using (var path = FoxUi.Round(inner, S(14)))
                        g.DrawPath(pen, path);
                }
            }
            if (!cfg.pocket.pocketed) return;

            if (pocketT > 0.01f) {
                Rectangle capsule;
                if (cfg.pocket.edge == "top")
                    capsule = new Rectangle(center.X - S(39), center.Y - centerR - S(10),
                        S(78), centerR * 2 + S(20));
                else
                    capsule = new Rectangle(center.X - centerR - S(10), center.Y - S(39),
                        centerR * 2 + S(20), S(78));
                GlassRound(g, capsule, S(20), hoverEase, pocketT * 0.92f);
            } else if (cfg.pocket.marker) {
                Rectangle marker = PocketActivationLocal();
                using (var br = new SolidBrush(Color.FromArgb(54, accent2)))
                    g.FillRectangle(br, marker);
            }
        }

        float Ease(float t) {
            if (t <= 0f) return 0f;
            if (t >= 1f) return 1f;
            return t * t * (3f - 2f * t);
        }

        float EaseOutCubic(float t) {
            t = Math.Max(0f, Math.Min(1f, t));
            float u = 1f - t;
            return 1f - u * u * u;
        }

        float EaseInOutCubic(float t) {
            t = Math.Max(0f, Math.Min(1f, t));
            if (t < 0.5f) return 4f * t * t * t;
            float u = -2f * t + 2f;
            return 1f - u * u * u / 2f;
        }

        float EaseOutBack(float t) {
            t = Math.Max(0f, Math.Min(1f, t));
            const float c1 = 1.12f;
            const float c3 = c1 + 1f;
            float u = t - 1f;
            float v = 1f + c3 * u * u * u + c1 * u * u;
            return Math.Max(0f, Math.Min(1.06f, v));
        }

        float MotionEase(float t) {
            t = Math.Max(0f, Math.Min(1f, t));
            if (!animEnabled) return t >= 1f ? 1f : 0f;
            string style = MotionStyle;
            if (style == "minimal") return t;
            if (style == "restrained") return Ease(t);
            if (style == "spring") return EaseOutBack(t);
            return EaseOutCubic(t);
        }

        float CategoryReveal(int index) {
            int enter = Math.Max(1, ScaledMs(Tm.categoryEnterMs));
            int delay = Math.Max(0, ScaledMs(StaggerMs(index * Tm.categoryStaggerMs)));
            float local = (showT * CategoryTotalMs - delay) / enter;
            return MotionEase(Math.Max(0f, Math.Min(1f, local)));
        }

        float CardReveal(int index, int count) {
            int open = Math.Max(1, ScaledMs(Tm.branchOpenMs));
            int maxStagger = StaggerMs(Math.Min(120, Math.Max(0, count - 1) * Tm.cardStaggerMs));
            int total = ScaledMs(Tm.branchOpenMs + maxStagger);
            int delay = ScaledMs(Math.Min(120, StaggerMs(index * Tm.cardStaggerMs)));
            float local = (branchT * total - delay) / open;
            return MotionEase(Math.Max(0f, Math.Min(1f, local)));
        }

        void DrawCenter(Graphics g, Point c, int r, float ease) {
            float press = 0f;
            pressLevels.TryGetValue("__center", out press);
            float scale = (0.92f + 0.08f * ease) *
                (1f + hoverEase * 0.025f - press * 0.03f);
            int rs = (int)(r * scale);
            Rectangle rc = new Rectangle(c.X - rs, c.Y - rs, rs * 2, rs * 2);
            GlassCircle(g, rc, hoverEase, false, ease);
            DrawProjectMark(g, c, Math.Max(S(12), rs * 2 / 5), ease);
        }

        void DrawProjectMark(Graphics g, Point c, int size, float reveal) {
            float s = size / 2f;
            PointF[] mark = new[] {
                new PointF(c.X - s, c.Y - s * 0.55f),
                new PointF(c.X - s * 0.35f, c.Y - s * 0.85f),
                new PointF(c.X, c.Y - s * 0.35f),
                new PointF(c.X + s * 0.35f, c.Y - s * 0.85f),
                new PointF(c.X + s, c.Y - s * 0.55f),
                new PointF(c.X + s * 0.55f, c.Y + s * 0.25f),
                new PointF(c.X, c.Y + s * 0.9f),
                new PointF(c.X - s * 0.55f, c.Y + s * 0.25f),
                new PointF(c.X - s, c.Y - s * 0.55f)
            };
            using (var pen = new Pen(Color.FromArgb((int)(185 * reveal), ink), Sf(1.1f))) {
                pen.LineJoin = LineJoin.Round;
                g.DrawLines(pen, mark);
            }
            int dot = Math.Max(1, S(2));
            using (var br = new SolidBrush(Color.FromArgb((int)(205 * reveal), ink)))
                g.FillEllipse(br, c.X - dot / 2, c.Y + S(2), dot, dot);
        }

        void DrawCategoryNode(Graphics g, Point p, int r, MenuNodeSpec node,
            bool active, float hover, float press, float ease) {
            if (ease <= 0.005f) return;
            float scale = (0.98f + 0.02f * ease) *
                (1f + hover * 0.03f - press * 0.03f);
            int rs = (int)(r * scale);
            Rectangle rc = new Rectangle(p.X - rs, p.Y - rs, rs * 2, rs * 2);
            GlassCircle(g, rc, hover, active, ease);
            Color nodeInk = ink;
            if (node.style != null && node.style.enabled) {
                Color localSurface = ParseThemeColor(node.style.surfaceHex, surface);
                Color localAccent = ParseThemeColor(node.style.accentHex, accent2);
                nodeInk = ParseThemeColor(node.style.textHex, ink);
                using (var fill = new SolidBrush(Color.FromArgb((int)(205 * ease), localSurface)))
                    g.FillEllipse(fill, rc);
                using (var edge = new Pen(Color.FromArgb((int)(175 * ease), localAccent), Sf(1f)))
                    g.DrawEllipse(edge, rc);
            }
            string glyph = string.IsNullOrEmpty(node.icon) ? "\uE10C" : node.icon;
            Rectangle iconRect = new Rectangle(
                p.X - S(Tm.iconDip) / 2,
                p.Y - S(Tm.iconDip) / 2,
                S(Tm.iconDip),
                S(Tm.iconDip));
            using (var br = new SolidBrush(Color.FromArgb(
                (int)((active ? 235 : 185 + hover * 45) * ease), nodeInk)))
            using (var sf = new StringFormat {
                Alignment = StringAlignment.Center,
                LineAlignment = StringAlignment.Center
            })
                g.DrawString(glyph, iconFont, br, iconRect, sf);

            Rectangle lbl = LabelRect(node.title, p, rs);
            GlassPill(g, lbl, Math.Max(hover, active ? 1f : 0f), ease);
            using (var br = new SolidBrush(Color.FromArgb((int)(238 * ease), nodeInk)))
            using (var sf = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center })
                g.DrawString(node.title, labelFont, br, lbl, sf);
        }

        void DrawNodeLink(Graphics g, Point a, int radiusA, Point b, int radiusB,
            Rectangle labelObstacle, float progress, bool active) {
            progress = Math.Max(0f, Math.Min(1f, progress));
            if (progress <= 0.01f) return;
            bool blockedByLabel = SegmentHitsRect(a, b, labelObstacle);
            int pct = (active ? Tm.activeLineAlpha : Tm.lineAlpha) *
                Math.Max(50, Math.Min(180, styleProfile.LineContrast)) / 100;
            int alpha = (int)(PctAlpha(pct) * progress);
            using (var pen = new Pen(Color.FromArgb(alpha, accent2), Sf(Tm.lineWidthDip))) {
                pen.StartCap = LineCap.Round;
                pen.EndCap = LineCap.Round;
                if (!blockedByLabel) {
                    PointF start = CircleBoundary(a, radiusA, b);
                    PointF end = CircleBoundary(b, radiusB, a);
                    PointF drawEnd = Lerp(start, end, progress);
                    g.DrawLine(pen, start, drawEnd);
                } else {
                    bool left = b.X <= a.X;
                    Point waypoint = new Point(
                        left ? labelObstacle.Left - S(5) : labelObstacle.Right + S(5),
                        labelObstacle.Bottom + S(2));
                    PointF start = CircleBoundary(a, radiusA, waypoint);
                    PointF end = CircleBoundary(b, radiusB, waypoint);
                    PointF c1 = Lerp(start, new PointF(waypoint.X, waypoint.Y), 0.7f);
                    PointF c2 = Lerp(end, new PointF(waypoint.X, waypoint.Y), 0.7f);
                    DrawBezierProgress(g, pen, start, c1, c2, end, progress);
                }
            }
        }

        void DrawBranchLink(Graphics g, PointF start, PointF end,
            float progress, bool active) {
            progress = Math.Max(0f, Math.Min(1f, progress));
            if (progress <= 0.01f) return;
            float bend = Math.Max(S(24), Math.Abs(end.X - start.X) * 0.42f);
            float dir = end.X >= start.X ? 1f : -1f;
            PointF c1 = new PointF(start.X + bend * dir, start.Y);
            PointF c2 = new PointF(end.X - bend * dir, end.Y);
            int pct = (active ? Tm.activeLineAlpha : Tm.lineAlpha) *
                Math.Max(50, Math.Min(180, styleProfile.LineContrast)) / 100;
            using (var pen = new Pen(Color.FromArgb(
                (int)(PctAlpha(pct) * progress), accent2), Sf(Tm.lineWidthDip))) {
                pen.StartCap = LineCap.Round;
                pen.EndCap = LineCap.Round;
                DrawBezierProgress(g, pen, start, c1, c2, end, progress);
            }
        }

        void DrawBezierProgress(Graphics g, Pen pen, PointF a, PointF c1,
            PointF c2, PointF b, float progress) {
            int steps = Math.Max(3, (int)(28 * progress));
            PointF[] points = new PointF[steps + 1];
            for (int i = 0; i <= steps; i++)
                points[i] = BezierPoint(a, c1, c2, b, progress * i / steps);
            g.DrawLines(pen, points);
        }

        static PointF CircleBoundary(Point center, int radius, Point target) {
            float dx = target.X - center.X;
            float dy = target.Y - center.Y;
            float len = (float)Math.Sqrt(dx * dx + dy * dy);
            if (len < 0.1f) return center;
            return new PointF(center.X + dx / len * radius, center.Y + dy / len * radius);
        }

        static PointF Lerp(PointF a, PointF b, float t) {
            return new PointF(a.X + (b.X - a.X) * t, a.Y + (b.Y - a.Y) * t);
        }

        static bool SegmentHitsRect(Point a, Point b, Rectangle r) {
            for (int i = 1; i < 12; i++) {
                float t = i / 12f;
                int x = (int)(a.X + (b.X - a.X) * t);
                int y = (int)(a.Y + (b.Y - a.Y) * t);
                if (r.Contains(x, y)) return true;
            }
            return false;
        }

        static PointF BezierPoint(PointF a, PointF c1, PointF c2, PointF b, float t) {
            float u = 1f - t;
            float uu = u * u;
            float tt = t * t;
            return new PointF(
                uu * u * a.X + 3f * uu * t * c1.X + 3f * u * tt * c2.X + tt * t * b.X,
                uu * u * a.Y + 3f * uu * t * c1.Y + 3f * u * tt * c2.Y + tt * t * b.Y);
        }

        static int PctAlpha(int percent) {
            return Math.Max(0, Math.Min(255, percent * 255 / 100));
        }

        int GlassAlpha() {
            int raw = PctAlpha(styleProfile != null ? styleProfile.Opacity : 84) +
                ((cfg != null ? cfg.glassStrength : 78) - 78);
            return Math.Max(48, Math.Min(245, raw));
        }

        void DrawCardColumns(Graphics g, List<Point> catPts, int catIdx,
            int catR, float ease) {
            Point from = catPts[catIdx];
            int startDepth = VisibleBranchStart();
            int visibleColumns = branchIds.Count - startDepth + 1;
            MenuNodeSpec parent = ParentAtDepth(cfg.categories[catIdx], startDepth);
            Rectangle graphBounds = RadialGraphBounds(catPts, catR, anchor);
            bool flip = ShouldFlipCards(from, visibleColumns, graphBounds);
            int colX = FirstCardColumnX(flip, graphBounds);
            int y = from.Y - S(40);
            var visuals = new List<CardVisual>();
            bool sourceIsCircle = startDepth == 0;
            Point sourceCenter = from;
            Rectangle sourceCard = Rectangle.Empty;
            if (startDepth > 0) {
                Rectangle crumb = new Rectangle(colX, y - S(30),
                    S(Tm.cardWidthDip), S(24));
                DrawBreadcrumb(g, crumb, startDepth);
                sourceCard = crumb;
            }
            for (int depth = startDepth; depth <= branchIds.Count; depth++) {
                if (parent == null) break;
                List<MenuNodeSpec> items = parent.children;
                if (items == null || items.Count == 0) break;

                int cardW = S(Tm.cardWidthDip);
                int cardH = S(Tm.cardHeightDip);
                int gap = S(Tm.cardGapDip);
                int maxH = S(320);
                int totalH = items.Count * (cardH + gap) - gap;
                int colH = Math.Min(totalH, maxH);
                int colTop = depth == startDepth ? y : sourceCard.Top;
                if (colTop + colH > workArea.Bottom - S(8)) colTop = workArea.Bottom - S(8) - colH;
                if (colTop < workArea.Top + S(8)) colTop = workArea.Top + S(8);

                int scroll = (depth == branchIds.Count) ? cardScroll : 0;
                Rectangle selectedRect = Rectangle.Empty;
                for (int i = 0; i < items.Count; i++) {
                    Rectangle column = new Rectangle(colX, colTop, cardW, colH);
                    Rectangle finalRect = CardFinalRect(column, items[i], i, scroll);
                    if (finalRect.Bottom < workArea.Top || finalRect.Top > workArea.Bottom) continue;
                    float itemT = CardReveal(i, items.Count);
                    Rectangle rc = CardRenderRect(column, items[i], i, scroll,
                        flip, itemT);
                    float hot = HoverOf(items[i]);
                    if (depth == branchIds.Count && kbMode == 1 && i == kbCardIdx)
                        hot = Math.Max(hot, 1f);
                    bool hasKids = items[i].children != null && items[i].children.Count > 0;
                    bool selected = depth < branchIds.Count && items[i].id == branchIds[depth];
                    PointF targetCenter = new PointF(rc.X + rc.Width / 2f, rc.Y + rc.Height / 2f);
                    PointF start = sourceIsCircle
                        ? CircleBoundary(sourceCenter, catR,
                            new Point((int)targetCenter.X, (int)targetCenter.Y))
                        : CardEdge(sourceCard, targetCenter);
                    PointF end = CardEdge(rc, start);
                    visuals.Add(new CardVisual {
                        Rect = rc,
                        Node = items[i],
                        Reveal = itemT,
                        Hover = hot,
                        Press = PressOf(items[i]),
                        HasChildren = hasKids,
                        Selected = selected,
                        LinkStart = start,
                        LinkEnd = end
                    });
                    if (selected) selectedRect = rc;
                }

                if (depth < branchIds.Count) {
                    parent = FindChild(parent, branchIds[depth]);
                    if (parent == null) break;
                    if (!selectedRect.IsEmpty) {
                        sourceIsCircle = false;
                        sourceCard = selectedRect;
                    }
                    colX = flip ? colX - cardW - S(32) : colX + cardW + S(32);
                } else break;
            }

            for (int i = 0; i < visuals.Count; i++) {
                CardVisual v = visuals[i];
                DrawBranchLink(g, v.LinkStart, v.LinkEnd,
                    ease * v.Reveal, v.Selected);
            }
            for (int i = 0; i < visuals.Count; i++) {
                CardVisual v = visuals[i];
                DrawCard(g, v.Rect, v.Node, v.Hover, v.Press,
                    v.HasChildren, v.Reveal, v.Selected);
            }
        }

        void DrawBreadcrumb(Graphics g, Rectangle r, int depth) {
            GlassPill(g, r, 0f, 0.9f);
            string title = "‹ ";
            int catIdx = IndexOfCategory(activeCategoryId);
            MenuNodeSpec parent = catIdx >= 0 ? cfg.categories[catIdx] : null;
            for (int i = 0; i < depth && parent != null; i++) {
                parent = FindChild(parent, branchIds[i]);
                if (parent != null) title += (i > 0 ? " / " : "") + parent.title;
            }
            using (var br = new SolidBrush(Color.FromArgb(205, ink)))
            using (var sf = new StringFormat {
                Alignment = StringAlignment.Near,
                LineAlignment = StringAlignment.Center,
                Trimming = StringTrimming.EllipsisCharacter
            })
                g.DrawString(title, smallFont, br,
                    new Rectangle(r.X + S(9), r.Y, r.Width - S(18), r.Height), sf);
        }

        static PointF CardEdge(Rectangle card, PointF toward) {
            float cx = card.X + card.Width / 2f;
            float cy = card.Y + card.Height / 2f;
            float dx = toward.X - cx;
            float dy = toward.Y - cy;
            if (Math.Abs(dx) * card.Height >= Math.Abs(dy) * card.Width)
                return new PointF(dx < 0 ? card.Left : card.Right,
                    Math.Max(card.Top + 4, Math.Min(card.Bottom - 4, toward.Y)));
            return new PointF(
                Math.Max(card.Left + 4, Math.Min(card.Right - 4, toward.X)),
                dy < 0 ? card.Top : card.Bottom);
        }

        void DrawCard(Graphics g, Rectangle r, MenuNodeSpec node, float hot,
            float press, bool hasKids, float reveal, bool selected) {
            float scale = 1f + hot * 0.03f - press * 0.03f;
            Rectangle visual = ScaleRect(r, scale);
            GlassRound(g, visual, Tm.cardRadiusDip, Math.Max(hot, selected ? 0.55f : 0f), reveal);
            Color nodeInk = ink;
            Color nodeMuted = accent;
            Color nodeAccent = accent2;
            if (node.style != null && node.style.enabled) {
                Color localSurface = ParseThemeColor(node.style.surfaceHex, surface);
                nodeAccent = ParseThemeColor(node.style.accentHex, accent2);
                nodeInk = ParseThemeColor(node.style.textHex, ink);
                nodeMuted = Blend(nodeInk, localSurface, 44);
                using (var path = FoxUi.Round(visual, S(Tm.cardRadiusDip)))
                using (var fill = new SolidBrush(Color.FromArgb((int)(205 * reveal), localSurface)))
                using (var edge = new Pen(Color.FromArgb((int)(175 * reveal), nodeAccent), Sf(1f))) {
                    g.FillPath(fill, path);
                    g.DrawPath(edge, path);
                }
            }
            if (selected) {
                using (var path = FoxUi.Round(visual, S(Tm.cardRadiusDip)))
                using (var pen = new Pen(Color.FromArgb((int)(92 * reveal), accent2), Sf(1.15f)))
                    g.DrawPath(pen, path);
            }
            Rectangle iconRect = new Rectangle(
                visual.X + S(11),
                visual.Y + (visual.Height - S(Tm.iconDip)) / 2,
                S(Tm.iconDip),
                S(Tm.iconDip));
            string glyph = string.IsNullOrEmpty(node.icon) ? "\uE10C" : node.icon;
            using (var br = new SolidBrush(Color.FromArgb(
                (int)((180 + hot * 50) * reveal), nodeInk)))
            using (var sf = new StringFormat {
                Alignment = StringAlignment.Center,
                LineAlignment = StringAlignment.Center
            })
                g.DrawString(glyph, iconFont, br, iconRect, sf);

            int textX = visual.X + S(38);
            int textRight = visual.Right - S(hasKids ? 25 : 12);
            if (string.IsNullOrEmpty(node.description)) {
                Rectangle textR = Rectangle.FromLTRB(textX, visual.Top,
                    textRight, visual.Bottom);
                using (var br = new SolidBrush(Color.FromArgb((int)(235 * reveal), nodeInk)))
                using (var sf = new StringFormat {
                    Alignment = StringAlignment.Near,
                    LineAlignment = StringAlignment.Center,
                    Trimming = StringTrimming.EllipsisCharacter
                })
                    g.DrawString(node.title, cardFont, br, textR, sf);
            } else {
                Rectangle titleR = Rectangle.FromLTRB(textX, visual.Top + S(4),
                    textRight, visual.Top + visual.Height / 2 + S(3));
                Rectangle descR = Rectangle.FromLTRB(textX, visual.Top + visual.Height / 2 - S(2),
                    textRight, visual.Bottom - S(3));
                using (var br = new SolidBrush(Color.FromArgb((int)(235 * reveal), nodeInk)))
                    g.DrawString(node.title, cardFont, br, titleR);
                using (var br = new SolidBrush(Color.FromArgb((int)(185 * reveal), nodeMuted)))
                    g.DrawString(node.description, smallFont, br, descR);
            }

            if (hasKids) {
                using (var br = new SolidBrush(Color.FromArgb((int)(170 * reveal), nodeAccent)))
                using (var sf = new StringFormat {
                    Alignment = StringAlignment.Center,
                    LineAlignment = StringAlignment.Center
                })
                    g.DrawString("›", cardFont, br,
                        new Rectangle(visual.Right - S(22), visual.Top, S(16), visual.Height), sf);
            }
        }

        static Rectangle ScaleRect(Rectangle r, float scale) {
            int w = Math.Max(1, (int)Math.Round(r.Width * scale));
            int h = Math.Max(1, (int)Math.Round(r.Height * scale));
            return new Rectangle(r.X + (r.Width - w) / 2, r.Y + (r.Height - h) / 2, w, h);
        }

        void GlassCircle(Graphics g, Rectangle r, float hot, bool active, float reveal) {
            hot = Math.Max(0f, Math.Min(1f, hot));
            reveal = Math.Max(0f, Math.Min(1f, reveal));
            int glassAlpha = GlassAlpha();
            Rectangle shadow = new Rectangle(r.X + S(1),
                r.Y + S(Tm.shadowOffsetDip), r.Width, r.Height);
            using (var sb = new SolidBrush(Color.FromArgb((int)((22 + applyPulse * 18) * reveal), Color.Black)))
                g.FillEllipse(sb, shadow);
            using (var path = CirclePath(r))
            using (var fill = new LinearGradientBrush(r,
                Color.FromArgb((int)(glassAlpha * reveal),
                    Blend(surface, Color.White, (int)(2 + hot * 4))),
                Color.FromArgb((int)((glassAlpha - 18) * reveal),
                    Blend(night, Color.White, (int)(1 + hot * 3))),
                90f))
                g.FillPath(fill, path);
            Rectangle shine = new Rectangle(r.X + r.Width / 6, r.Y + r.Height / 8,
                r.Width * 2 / 3, r.Height / 2);
            using (var sheen = new Pen(Color.FromArgb(
                (int)((PctAlpha(Tm.highlightAlpha) + hot * 16) * reveal),
                Color.White), Sf(1f)))
                g.DrawArc(sheen, shine, 195f, 150f);
            using (var path = CirclePath(r))
            using (var pen = new Pen(
                Color.FromArgb((int)((PctAlpha(Tm.outlineAlpha) + hot * 28 + applyPulse * 40) * reveal),
                    active ? accent2 : Color.FromArgb(210, ink)), Sf(active ? 1.35f : 1f)))
                g.DrawPath(pen, path);
            if (active || applyPulse > 0.04f) {
                Rectangle selectedRing = Rectangle.Inflate(r, S(4), S(4));
                using (var path = CirclePath(selectedRing))
                using (var pen = new Pen(Color.FromArgb(
                    (int)((active ? 70 : 0) * reveal + applyPulse * 90 * reveal), accent2), Sf(1.1f)))
                    g.DrawPath(pen, path);
            }
        }

        void GlassPill(Graphics g, Rectangle r, float hot, float reveal) {
            GlassRound(g, r, r.Height / 2, hot, reveal);
        }

        void GlassRound(Graphics g, Rectangle r, int rad, float hot, float reveal) {
            hot = Math.Max(0f, Math.Min(1f, hot));
            reveal = Math.Max(0f, Math.Min(1f, reveal));
            int glassAlpha = GlassAlpha();
            Rectangle shadow = new Rectangle(r.X + S(1),
                r.Y + S(Tm.shadowOffsetDip), r.Width, r.Height);
            using (var path = FoxUi.Round(shadow, rad))
            using (var sh = new SolidBrush(Color.FromArgb((int)((20 + applyPulse * 16) * reveal), 0, 0, 0)))
                g.FillPath(sh, path);
            using (var path = FoxUi.Round(r, rad))
            using (var fill = new LinearGradientBrush(r,
                Color.FromArgb((int)(glassAlpha * reveal),
                    Blend(surface, Color.White, (int)(2 + hot * 4))),
                Color.FromArgb((int)((glassAlpha - 16) * reveal),
                    Blend(night, Color.White, (int)(1 + hot * 2))),
                90f))
                g.FillPath(fill, path);
            using (var top = new Pen(Color.FromArgb(
                (int)((PctAlpha(Tm.highlightAlpha) + hot * 15) * reveal),
                Color.White), Sf(1f)))
                g.DrawLine(top, r.X + rad, r.Y + 1, r.Right - rad, r.Y + 1);
            using (var path = FoxUi.Round(r, rad))
            using (var pen = new Pen(
                Color.FromArgb((int)((PctAlpha(Tm.outlineAlpha) + hot * 26 + applyPulse * 30) * reveal),
                    Color.FromArgb(200, ink)), Sf(1f)))
                g.DrawPath(pen, path);
        }

        static Color Blend(Color a, Color b, int pct) {
            pct = Math.Max(0, Math.Min(100, pct));
            int inv = 100 - pct;
            return Color.FromArgb(
                (a.R * inv + b.R * pct) / 100,
                (a.G * inv + b.G * pct) / 100,
                (a.B * inv + b.B * pct) / 100);
        }

        static GraphicsPath CirclePath(Rectangle r) {
            var p = new GraphicsPath();
            p.AddEllipse(r);
            return p;
        }

        void OnMouseDown(object sender, MouseEventArgs e) {
            if (e.Button != MouseButtons.Left) return;
            LayoutAndClamp();
            HitZone z = HitAt(e.Location);
            if (z == null) return;
            dragging = true;
            dragActive = false;
            dragZone = z;
            dragStartedPocketed = cfg != null && cfg.pocket != null &&
                cfg.pocket.pocketed;
            dragOriginPocketed = dragStartedPocketed;
            pressedNodeId = z.Node != null ? z.Node.id :
                (z.Kind == "center" ? "__center" : "");
            if (!string.IsNullOrEmpty(pressedNodeId) &&
                !pressLevels.ContainsKey(pressedNodeId))
                pressLevels[pressedNodeId] = 0f;
            dragStartOffsetX = z.Node != null ? z.Node.offsetXDip : 0;
            dragStartOffsetY = z.Node != null ? z.Node.offsetYDip : 0;
            dragMouseScreen = Cursor.Position;
            dragWindowStart = Location;
            Capture = true;
            KickMotion(1800);
        }

        void OnMouseUp(object sender, MouseEventArgs e) {
            if (!dragging) return;
            HitZone pressed = dragZone;
            bool wasDrag = dragActive;
            dragging = false;
            dragActive = false;
            Capture = false;
            pressedNodeId = "";
            PinToDesktopLevel();
            if (wasDrag) {
                if (pressed != null && (pressed.Kind == "center" || pressed.Kind == "pocket")) {
                    if (pocketDropHot) DockToPocket();
                    else SaveDesktopPosition();
                }
                else if (pressed != null && pressed.Node != null) nodeStore.Save();
            }
            if (launcherMode == LauncherMode.DraggingCenter &&
                (cfg.pocket == null || !cfg.pocket.pocketed))
                launcherMode = LauncherMode.Collapsed;
            pocketDropHot = false;
            dragOriginPocketed = false;
            dragZone = null;
            Cursor = Cursors.Default;
            KickMotion(ScaledMs(Tm.pressMs) + 250);
            if (!wasDrag && pressed != null)
                ActivateZone(pressed);
        }

        void SaveDesktopPosition() {
            try {
                Screen sc = desktopScreen ?? Screen.FromControl(this);
                Point anchorScreen = PointToScreen(anchor);
                Rectangle wa = sc.WorkingArea;
                cfg.desktopX = Math.Max(0.0, Math.Min(1.0,
                    (anchorScreen.X - wa.X) / (double)Math.Max(1, wa.Width)));
                cfg.desktopY = Math.Max(0.0, Math.Min(1.0,
                    (anchorScreen.Y - wa.Y) / (double)Math.Max(1, wa.Height)));
                if (cfg.pocket == null || !cfg.pocket.pocketed) {
                    cfg.lastNormalX = cfg.desktopX;
                    cfg.lastNormalY = cfg.desktopY;
                }
                nodeStore.Save();
            } catch { }
        }

        void MoveDesktopIsland() {
            Point now = Cursor.Position;
            int dx = now.X - dragMouseScreen.X;
            int dy = now.Y - dragMouseScreen.Y;
            dragActive = true;
            Screen currentScreen = Screen.FromPoint(now);
            if (desktopScreen == null ||
                desktopScreen.DeviceName != currentScreen.DeviceName)
                desktopScreen = currentScreen;
            Rectangle wa = desktopScreen.WorkingArea;
            int centerR = S(Tm.centerNodeDip) / 2;
            int desiredCenterX = dragWindowStart.X + anchor.X + dx;
            int desiredCenterY = dragWindowStart.Y + anchor.Y + dy;
            desiredCenterX = Math.Max(wa.Left + centerR,
                Math.Min(desiredCenterX, wa.Right - centerR));
            desiredCenterY = Math.Max(wa.Top + centerR,
                Math.Min(desiredCenterY, wa.Bottom - centerR));
            int x = desiredCenterX - anchor.X;
            int y = desiredCenterY - anchor.Y;
            PlaceAtScreen(x, y, true);
            UpdatePocketDrop();
        }

        void MoveGraphElement() {
            if (dragZone == null || dragZone.Node == null) return;
            Point now = Cursor.Position;
            int dx = now.X - dragMouseScreen.X;
            int dy = now.Y - dragMouseScreen.Y;
            Rectangle moved = dragZone.Bounds;
            moved.Offset(dx, dy);
            int pad = S(10);
            if (moved.Left < workArea.Left + pad) dx += workArea.Left + pad - moved.Left;
            if (moved.Right > workArea.Right - pad) dx -= moved.Right - (workArea.Right - pad);
            if (moved.Top < workArea.Top + pad) dy += workArea.Top + pad - moved.Top;
            if (moved.Bottom > workArea.Bottom - pad) dy -= moved.Bottom - (workArea.Bottom - pad);
            dragActive = true;
            dragZone.Node.offsetXDip = dragStartOffsetX + (int)Math.Round(dx / Math.Max(0.1f, dpiScale));
            dragZone.Node.offsetYDip = dragStartOffsetY + (int)Math.Round(dy / Math.Max(0.1f, dpiScale));
            LayoutAndClamp();
            KickMotion(900);
            Invalidate();
        }

        void OnMouseMove(object sender, MouseEventArgs e) {
            if (dragging) {
                Point now = Cursor.Position;
                int dx = now.X - dragMouseScreen.X;
                int dy = now.Y - dragMouseScreen.Y;
                if (!dragActive && dx * dx + dy * dy < D(5) * D(5)) return;
                dragActive = true;
                Cursor = Cursors.SizeAll;
                if (dragZone != null &&
                    (dragZone.Kind == "center" || dragZone.Kind == "pocket"))
                    launcherMode = LauncherMode.DraggingCenter;
                if (dragStartedPocketed) {
                    Point cursor = Cursor.Position;
                    cfg.pocket.pocketed = false;
                    pocketT = pocketTarget = 0f;
                    PlaceAtScreen(cursor.X - anchor.X, cursor.Y - anchor.Y, true);
                    dragWindowStart = Location;
                    dragMouseScreen = cursor;
                    dragStartedPocketed = false;
                }
                if (dragZone != null &&
                    (dragZone.Kind == "center" || dragZone.Kind == "pocket") &&
                    !categoriesExpanded)
                    MoveDesktopIsland();
                else if (dragZone != null && dragZone.Kind != "center")
                    MoveGraphElement();
                return;
            }
            LayoutAndClamp();
            HitZone z = HitAt(e.Location);
            if (cfg != null && cfg.pocket != null && cfg.pocket.pocketed) {
                bool overPocket = z != null &&
                    (z.Kind == "pocket" || z.Kind == "center");
                if (overPocket && !pocketHover) {
                    pocketHover = true;
                    pocketShowAt = DateTime.UtcNow.AddMilliseconds(
                        cfg.pocket.showDelayMs);
                    pocketHideAt = DateTime.MaxValue;
                    KickMotion(cfg.pocket.showDelayMs + 500);
                } else if (!overPocket && pocketHover) {
                    pocketHover = false;
                    pocketHideAt = DateTime.UtcNow.AddMilliseconds(
                        cfg.pocket.hideDelayMs);
                    KickMotion(cfg.pocket.hideDelayMs + 400);
                }
            }
            int oldCat = hoverCat;
            int oldCard = hoverCardIdx;
            hoverCat = -1;
            hoverCardIdx = -1;
            if (z != null) {
                if (z.Kind == "category") hoverCat = z.CategoryIndex;
                if (z.Kind == "card") {
                    hoverCardIdx = z.CardIndex;
                    hoverCardCol = z.ColumnIndex;
                }
            }
            hoverNodeId = z == null ? "" :
                (z.Node != null ? z.Node.id : (z.Kind == "center" ? "__center" : ""));
            string tip = z != null && z.Node != null ? (z.Node.description ?? "") : "";
            if (tip != lastToolTip) {
                lastToolTip = tip;
                toolTip.SetToolTip(this, tip);
            }
            Cursor = z == null ? Cursors.Default : Cursors.Hand;
            if (hoverCat != oldCat || hoverCardIdx != oldCard) KickMotion(1400);
            Invalidate();
        }

        void OnMouseWheel(object sender, MouseEventArgs e) {
            MenuNodeSpec parent = CurrentCardParent();
            if (parent == null || parent.children == null) return;
            int cardH = S(Tm.cardHeightDip);
            int gap = S(Tm.cardGapDip);
            int total = parent.children.Count * (cardH + gap) - gap;
            int max = Math.Max(0, total - S(320));
            if (max == 0) return;
            int step = cardH + gap;
            cardScroll = Math.Max(0, Math.Min(max,
                cardScroll - Math.Sign(e.Delta) * step));
            LayoutAndClamp();
            Invalidate();
        }

        void ActivateZone(HitZone z) {
            if (z == null) return;
            if (z.Kind == "pocket" ||
                (z.Kind == "center" && cfg.pocket != null && cfg.pocket.pocketed)) {
                RestoreFromPocket(true);
                return;
            }
            if (z.Kind == "center") {
                if (categoriesExpanded) {
                    pendingCategoryId = "";
                    pendingPopSubmenu = false;
                    if (!string.IsNullOrEmpty(activeCategoryId))
                        AnimateBranchTo(0f, true);
                    AnimateShowTo(0f);
                } else {
                    AnimateShowTo(1f);
                }
                return;
            }
            if (z.Kind == "category") {
                ToggleCategory(z.Node);
                return;
            }
            if (z.Kind == "breadcrumb") {
                while (branchIds.Count > Math.Max(0, z.ColumnIndex))
                    branchIds.RemoveAt(branchIds.Count - 1);
                cardScroll = 0;
                RestartBranch(0f);
                return;
            }
            if (z.Kind == "card") ActivateCard(z.Node, z.ColumnIndex);
        }

        void CancelDrag() {
            if (!dragging && !dragActive) return;
            bool moved = dragActive;
            HitZone zone = dragZone;
            dragging = false;
            dragActive = false;
            pressedNodeId = "";
            if (Capture) Capture = false;
            if (moved && zone != null &&
                (zone.Kind == "center" || zone.Kind == "pocket")) {
                if (dragOriginPocketed) DockToPocket();
                else PlaceAtScreen(dragWindowStart.X, dragWindowStart.Y, true);
            } else if (moved && zone != null && zone.Node != null) {
                zone.Node.offsetXDip = dragStartOffsetX;
                zone.Node.offsetYDip = dragStartOffsetY;
            }
            dragZone = null;
            launcherMode = dragOriginPocketed
                ? LauncherMode.PocketHidden
                : (categoriesExpanded ? LauncherMode.Expanded : LauncherMode.Collapsed);
            dragOriginPocketed = false;
            Cursor = Cursors.Default;
            LayoutAndClamp();
            Invalidate();
        }

        void ToggleCategory(MenuNodeSpec cat) {
            if (cat == null) return;
            if (activeCategoryId == cat.id) {
                pendingCategoryId = "";
                pendingPopSubmenu = false;
                if (branchTo < 0.5f)
                    AnimateBranchTo(1f, false);
                else
                    AnimateBranchTo(0f, true);
            } else if (!string.IsNullOrEmpty(activeCategoryId)) {
                pendingCategoryId = cat.id;
                pendingPopSubmenu = false;
                AnimateBranchTo(0f, true);
            } else {
                activeCategoryId = cat.id;
                pendingCategoryId = "";
                branchIds.Clear();
                cardScroll = 0;
                RestartBranch(0f);
                if (branchT < 1f) { visibleAnim = true; KickMotion(3200); }
            }
            kbMode = string.IsNullOrEmpty(activeCategoryId) ? 0 : 1;
            kbCardIdx = 0;
            Invalidate();
        }

        void ActivateCard(MenuNodeSpec node, int columnIndex) {
            if (node == null) return;
            while (branchIds.Count > columnIndex) branchIds.RemoveAt(branchIds.Count - 1);
            bool hasKids = node.children != null && node.children.Count > 0;
            if (hasKids && columnIndex >= branchIds.Count) {
                while (branchIds.Count > columnIndex) branchIds.RemoveAt(branchIds.Count - 1);
                branchIds.Add(node.id);
                cardScroll = 0;
                RestartBranch(0f);
                if (branchT < 1f) { visibleAnim = true; KickMotion(3200); }
                kbCardIdx = 0;
                Invalidate();
                return;
            }
            if (node.action != null) {
                string err = runner.Run(node.action, InternalCommand);
                if (!string.IsNullOrEmpty(err)) FoxToast.Show("foxnodes · " + err);
                AnimateBranchTo(0f, true);
            } else if (hasKids) {
                while (branchIds.Count > columnIndex) branchIds.RemoveAt(branchIds.Count - 1);
                branchIds.Add(node.id);
                cardScroll = 0;
                RestartBranch(0f);
                if (branchT < 1f) { visibleAnim = true; KickMotion(3200); }
                Invalidate();
            }
        }

        void InternalCommand(string cmd) {
            string c = (cmd ?? "").Trim().ToLowerInvariant();
            if (c == "settings") {
                activeCategoryId = "";
                branchIds.Clear();
                Invalidate();
                if (openSettings != null) openSettings();
                return;
            }
            if (c == "reload") ReloadConfig();
        }

        void PopBranchAnimated() {
            if (branchIds.Count > 0) {
                pendingPopSubmenu = true;
                pendingCategoryId = "";
                cardScroll = 0;
                kbCardIdx = 0;
                AnimateBranchTo(0f, false);
            } else if (!string.IsNullOrEmpty(activeCategoryId)) {
                AnimateBranchTo(0f, true);
            }
        }

        void OnKeyDown(object sender, KeyEventArgs e) {
            if (dragging && e.KeyCode == Keys.Escape) {
                CancelDrag();
                e.Handled = true;
                return;
            }
            if (e.KeyCode == Keys.Escape) {
                if (!string.IsNullOrEmpty(activeCategoryId))
                    PopBranchAnimated();
                else
                    AnimateShowTo(categoriesExpanded ? 0f : 1f);
                e.Handled = true;
                return;
            }

            if (cfg.categories == null || cfg.categories.Count == 0) return;

            if (kbMode == 0) {
                if (e.KeyCode == Keys.Left || e.KeyCode == Keys.Right || e.KeyCode == Keys.Up || e.KeyCode == Keys.Down) {
                    kbCatIdx = NextCatIndex(kbCatIdx, e.KeyCode);
                    hoverCat = kbCatIdx;
                    Invalidate();
                    e.Handled = true;
                } else if (e.KeyCode == Keys.Enter) {
                    ToggleCategory(cfg.categories[kbCatIdx]);
                    e.Handled = true;
                }
            } else {
                MenuNodeSpec parent = CurrentCardParent();
                if (parent == null || parent.children == null) return;
                int count = parent.children.Count;
                if (e.KeyCode == Keys.Up) {
                    if (kbCardIdx > 0) kbCardIdx--;
                    Invalidate();
                    e.Handled = true;
                } else if (e.KeyCode == Keys.Down) {
                    if (kbCardIdx < count - 1) kbCardIdx++;
                    Invalidate();
                    e.Handled = true;
                } else if (e.KeyCode == Keys.Right || e.KeyCode == Keys.Enter) {
                    if (kbCardIdx >= 0 && kbCardIdx < count)
                        ActivateCard(parent.children[kbCardIdx], branchIds.Count);
                    e.Handled = true;
                } else if (e.KeyCode == Keys.Left) {
                    PopBranchAnimated();
                    e.Handled = true;
                }
            }
        }

        int NextCatIndex(int cur, Keys key) {
            int n = cfg.categories.Count;
            if (n <= 1) return 0;
            double step = Math.PI * 2.0 / n;
            double ang = -Math.PI / 2.0 + step * cur;
            if (key == Keys.Right) ang += step;
            else if (key == Keys.Left) ang -= step;
            else if (key == Keys.Down) ang += step;
            else if (key == Keys.Up) ang -= step;
            while (ang < -Math.PI) ang += Math.PI * 2;
            while (ang >= Math.PI) ang -= Math.PI * 2;
            int best = 0;
            double bestD = double.MaxValue;
            for (int i = 0; i < n; i++) {
                double a = -Math.PI / 2.0 + step * i;
                double d = Math.Abs(Math.Sin(a - ang)) + Math.Abs(Math.Cos(a - ang) - 1);
                if (d < bestD) { bestD = d; best = i; }
            }
            return best;
        }

        MenuNodeSpec CurrentCardParent() {
            int catIdx = IndexOfCategory(activeCategoryId);
            if (catIdx < 0) return null;
            MenuNodeSpec parent = cfg.categories[catIdx];
            for (int i = 0; i < branchIds.Count; i++) {
                parent = FindChild(parent, branchIds[i]);
                if (parent == null) return null;
            }
            return parent;
        }

        protected override void Dispose(bool disposing) {
            if (disposing) {
                if (animTimer != null) animTimer.Dispose();
                if (iconFont != null) iconFont.Dispose();
                if (labelFont != null) labelFont.Dispose();
                if (cardFont != null) cardFont.Dispose();
                if (smallFont != null) smallFont.Dispose();
            }
            base.Dispose(disposing);
        }
    }
}
