using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows.Forms;
using FoxOs.Sdk;

namespace FoxOs.Style {

    sealed class PreviewHit {
        public RectangleF Rect;
        public EditorNode Node;
        public string Kind;
        public int Depth;
    }

    public sealed class NodePreviewCanvas : Control {
        readonly FoxTheme ui;
        readonly List<PreviewHit> hits = new List<PreviewHit>();
        readonly Timer animation = new Timer();
        NodeEditorDocument doc;
        StyleDoc style;
        string selectedId = "";
        string activeCategory = "";
        readonly List<string> activePath = new List<string>();
        string hoverId = "";
        float reveal = 1f;
        DateTime revealStarted;
        float zoom = 1f;
        int revealMs = 280;
        int glassAlpha = 220;
        float typeScale = 1f;
        float lineWidth = 1f;
        PointF pan = PointF.Empty;
        bool panning;
        Point panStart;
        PointF panOrigin;
        Image wallpaper;
        string background = "dark";
        float applyFlash;
        DateTime applyFlashAt;

        public bool TestMode { get; set; }
        public event Action<EditorNode> SelectionChanged;
        public event Action<EditorNode> RenameRequested;
        public event Action<EditorNode> ActionPreview;

        public NodePreviewCanvas(FoxTheme theme) {
            ui = theme;
            BackColor = theme.Paper;
            Cursor = Cursors.Hand;
            TabStop = true;
            FoxUi.Buffer(this);
            animation.Interval = 16;
            animation.Tick += delegate {
                DateTime now = DateTime.UtcNow;
                float t = (float)Math.Min(1.0,
                    (now - revealStarted).TotalMilliseconds / Math.Max(80, revealMs));
                reveal = RevealEase(t);
                if (applyFlash > 0.01f) {
                    float p = (float)Math.Min(1.0,
                        (now - applyFlashAt).TotalMilliseconds / 280.0);
                    applyFlash = 1f - p;
                    if (p >= 1f) applyFlash = 0f;
                }
                Invalidate();
                if (t >= 1f && applyFlash <= 0.01f) animation.Stop();
            };
            MouseWheel += ZoomWheel;
            MouseDown += BeginPan;
            MouseMove += MovePointer;
            MouseUp += EndPan;
            MouseLeave += delegate { hoverId = ""; Invalidate(); };
            DoubleClick += delegate {
                EditorNode node = HitNode(PointToWorld(PointToClient(Cursor.Position)));
                if (!TestMode && node != null && RenameRequested != null)
                    RenameRequested(node);
            };
            KeyDown += delegate(object s, KeyEventArgs e) {
                if (e.KeyCode == Keys.D0 && e.Control) { ResetZoom(); e.Handled = true; }
                if (e.KeyCode == Keys.Home) { CenterNode(); e.Handled = true; }
            };
        }

        public void SetDocument(NodeEditorDocument value, StyleDoc styleDoc) {
            doc = value;
            style = styleDoc;
            if (doc != null && FindNode(selectedId) == null) selectedId = "";
            Invalidate();
        }

        public string SelectedId {
            get { return selectedId; }
            set { selectedId = value ?? ""; Invalidate(); }
        }

        public void SetBackgroundMode(string mode) {
            background = mode ?? "dark";
            if (background == "wallpaper" && wallpaper == null) wallpaper = LoadWallpaper();
            Invalidate();
        }

        public void FitAll() {
            zoom = Math.Max(0.55f, Math.Min(1.15f,
                Math.Min(ClientSize.Width / 880f, ClientSize.Height / 620f)));
            pan = PointF.Empty;
            Invalidate();
        }

        public void CenterNode() { pan = PointF.Empty; Invalidate(); }
        public void ResetZoom() { zoom = 1f; pan = PointF.Empty; Invalidate(); }

        protected override void OnPaint(PaintEventArgs e) {
            base.OnPaint(e);
            Graphics g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            DrawBackdrop(g);
            hits.Clear();
            if (doc == null || doc.categories == null || doc.categories.Count == 0) {
                DrawEmpty(g);
                return;
            }

            g.TranslateTransform(ClientSize.Width / 2f + pan.X,
                ClientSize.Height / 2f + pan.Y);
            g.ScaleTransform(zoom, zoom);
            DrawGraph(g);
            g.ResetTransform();
            DrawCanvasHud(g);
        }

        void DrawBackdrop(Graphics g) {
            Rectangle r = ClientRectangle;
            if (background == "wallpaper" && wallpaper != null) {
                g.DrawImage(wallpaper, r);
                using (var veil = new SolidBrush(Color.FromArgb(90, 8, 9, 13)))
                    g.FillRectangle(veil, r);
                return;
            }
            Color a = background == "light"
                ? Color.FromArgb(239, 241, 245) : Color.FromArgb(16, 18, 23);
            Color b = background == "light"
                ? Color.FromArgb(218, 222, 230) : Color.FromArgb(25, 28, 36);
            using (var brush = new LinearGradientBrush(r, a, b, 125f))
                g.FillRectangle(brush, r);
            using (var pen = new Pen(Color.FromArgb(background == "light" ? 18 : 13,
                background == "light" ? Color.Black : Color.White))) {
                for (int x = 0; x < Width; x += 32) g.DrawLine(pen, x, 0, x, Height);
                for (int y = 0; y < Height; y += 32) g.DrawLine(pen, 0, y, Width, y);
            }
        }

        void DrawEmpty(Graphics g) {
            string text = "Додайте першу категорію";
            using (var font = new Font("Segoe UI", 13f, FontStyle.Regular))
            using (var brush = new SolidBrush(ui.Muted))
            using (var sf = new StringFormat {
                Alignment = StringAlignment.Center,
                LineAlignment = StringAlignment.Center
            }) g.DrawString(text, font, brush, ClientRectangle, sf);
        }

        void DrawGraph(Graphics g) {
            NodeLauncherMod n = style != null && style.nodeLauncher != null
                ? style.nodeLauncher : new NodeLauncherMod();
            float scale = Math.Max(0.62f, Math.Min(1.55f, n.nodeScale / 100f));
            typeScale = Math.Max(0.75f, Math.Min(1.45f, n.textScale / 100f));
            glassAlpha = Math.Max(70, Math.Min(245, n.opacity * 255 / 100));
            lineWidth = Math.Max(0.7f, Math.Min(2.4f, n.lineContrast / 90f));
            float centerR = 28f * scale;
            float catR = 22f * scale;
            float open = TestMode ? Math.Max(0.15f, reveal) : 1f;
            float radius = (95f + 95f * n.spacing / 100f) * open;
            Color surface = Parse(SurfaceHex(n), Color.FromArgb(32, 34, 38));
            Color ink = Parse(InkHex(n), Color.FromArgb(230, 231, 233));
            Color accent = Parse(AccentHex(n), ui.Accent);
            int lineA = Math.Max(20, Math.Min(170, n.lineContrast * 170 / 180));
            Color line = Color.FromArgb(lineA, ink);

            PointF center = new PointF(-90f, 0f);
            var catPoints = new List<PointF>();
            int count = doc.categories.Count;
            for (int i = 0; i < count; i++) {
                double angle = -Math.PI / 2 + Math.PI * 2 * i / count;
                catPoints.Add(new PointF(center.X + (float)Math.Cos(angle) * radius,
                    center.Y + (float)Math.Sin(angle) * radius));
            }
            for (int i = 0; i < count; i++)
                using (var pen = new Pen(line, lineWidth))
                    g.DrawLine(pen, CircleEdge(center, centerR, catPoints[i]),
                        CircleEdge(catPoints[i], catR, center));

            string branchCategory = TestMode ? activeCategory : CategoryForSelection();
            int catIndex = IndexOfCategory(branchCategory);
            if (catIndex >= 0) DrawBranch(g, doc.categories[catIndex], catPoints[catIndex],
                catR, surface, ink, accent, line);

            for (int i = 0; i < count; i++) {
                EditorNode node = doc.categories[i];
                bool selected = node.id == selectedId;
                bool active = node.id == branchCategory;
                DrawCircleNode(g, catPoints[i], catR, node, surface, ink, accent,
                    selected || active);
                RectangleF nodeHit = CircleRect(catPoints[i], catR + 5);
                hits.Add(new PreviewHit {
                    Rect = nodeHit, Node = node, Kind = "category"
                });
                hits.Add(new PreviewHit {
                    Rect = new RectangleF(catPoints[i].X - 48, catPoints[i].Y + catR + 2, 96, 26),
                    Node = node, Kind = "category"
                });
            }
            DrawCenter(g, center, centerR, surface, ink, accent);
            hits.Add(new PreviewHit { Rect = CircleRect(center, centerR + 5), Kind = "center" });
            if (TestMode) DrawPocketHint(g, n, ink, accent);
        }

        void DrawPocketHint(Graphics g, NodeLauncherMod n, Color ink, Color accent) {
            if (n == null || !n.pocketEnabled) return;
            float t = (Math.Max(5, Math.Min(95, n.pocketPosition)) - 50) / 45f;
            RectangleF capsule;
            if (n.pocketEdge == "left")
                capsule = new RectangleF(-390, t * 170 - 46, 28, 92);
            else if (n.pocketEdge == "top")
                capsule = new RectangleF(t * 220 - 46, -250, 92, 28);
            else
                capsule = new RectangleF(330, t * 170 - 46, 28, 92);
            using (var path = Round(capsule, 12))
            using (var fill = new SolidBrush(Color.FromArgb(70, accent)))
            using (var pen = new Pen(Color.FromArgb(120, accent), 1f)) {
                g.FillPath(fill, path);
                g.DrawPath(pen, path);
            }
            hits.Add(new PreviewHit { Rect = capsule, Kind = "pocket" });
        }

        void DrawBranch(Graphics g, EditorNode category, PointF source, float sourceR,
            Color surface, Color ink, Color accent, Color line) {
            EditorNode parent = category;
            var path = TestMode ? activePath : PathForSelection(category);
            int start = Math.Max(0, path.Count - 1);
            for (int i = 0; i < start; i++) parent = Child(parent, path[i]);
            float x = 160f;
            RectangleF sourceRect = RectangleF.Empty;
            for (int depth = start; depth <= path.Count && parent != null; depth++) {
                float y = -Math.Min(150f, Math.Max(0, parent.children.Count - 1) * 24f);
                for (int i = 0; i < parent.children.Count; i++) {
                    EditorNode node = parent.children[i];
                    RectangleF card = new RectangleF(x, y + i * 48f, 204f, 40f);
                    float localReveal = TestMode ? reveal : 1f;
                    RectangleF shown = card;
                    shown.X -= (1f - localReveal) * 12f;
                    PointF startPoint = depth == start
                        ? CircleEdge(source, sourceR, Center(shown))
                        : Edge(sourceRect, Center(shown));
                    PointF endPoint = Edge(shown, startPoint);
                    using (var pen = new Pen(Color.FromArgb(
                        (int)(line.A * localReveal), line), 1f))
                        DrawBezier(g, pen, startPoint, endPoint);
                    bool selected = node.id == selectedId ||
                        (depth < path.Count && node.id == path[depth]);
                    DrawCard(g, shown, node, surface, ink, accent, selected, localReveal);
                    hits.Add(new PreviewHit {
                        Rect = shown, Node = node, Kind = "card", Depth = depth
                    });
                    if (depth < path.Count && node.id == path[depth])
                        sourceRect = shown;
                }
                if (depth < path.Count) parent = Child(parent, path[depth]);
                x += 236f;
            }
        }

        void DrawCenter(Graphics g, PointF p, float r, Color surface, Color ink, Color accent) {
            DrawGlassCircle(g, p, r, surface, accent, false);
            using (var pen = new Pen(Color.FromArgb(180, ink), 1.2f)) {
                g.DrawLine(pen, p.X - 8, p.Y, p.X, p.Y + 7);
                g.DrawLine(pen, p.X, p.Y + 7, p.X + 8, p.Y);
                g.DrawLine(pen, p.X + 8, p.Y, p.X, p.Y - 5);
                g.DrawLine(pen, p.X, p.Y - 5, p.X - 8, p.Y);
            }
        }

        void DrawCircleNode(Graphics g, PointF p, float r, EditorNode node,
            Color surface, Color ink, Color accent, bool selected) {
            ApplyLocalStyle(node, ref surface, ref ink, ref accent);
            DrawGlassCircle(g, p, r, surface, accent, selected);
            string glyph = string.IsNullOrEmpty(node.icon) ? "\uE10C" : node.icon;
            using (var font = IconFont(11f * typeScale))
            using (var brush = new SolidBrush(node.id == hoverId ? accent : ink))
            using (var sf = CenterFormat())
                g.DrawString(glyph, font, brush, CircleRect(p, r), sf);
            float labelSize = 8.5f * typeScale;
            SizeF size;
            using (var font = new Font("Segoe UI", labelSize))
                size = g.MeasureString(node.title, font);
            RectangleF label = new RectangleF(p.X - size.Width / 2 - 8,
                p.Y + r + 6, size.Width + 16, 18 + 8 * typeScale);
            DrawGlassRect(g, label, surface, selected ? accent : ink, selected);
            using (var font = new Font("Segoe UI", labelSize))
            using (var brush = new SolidBrush(ink))
            using (var sf = CenterFormat()) g.DrawString(node.title, font, brush, label, sf);
        }

        void DrawCard(Graphics g, RectangleF r, EditorNode node, Color surface,
            Color ink, Color accent, bool selected, float alpha) {
            ApplyLocalStyle(node, ref surface, ref ink, ref accent);
            DrawGlassRect(g, r, surface, selected ? accent : ink, selected, alpha);
            string glyph = string.IsNullOrEmpty(node.icon) ? "\uE10C" : node.icon;
            using (var font = IconFont(10f * typeScale))
            using (var brush = new SolidBrush(Color.FromArgb((int)(230 * alpha), ink)))
                g.DrawString(glyph, font, brush, r.X + 11, r.Y + 11);
            using (var font = new Font("Segoe UI", 9f * typeScale))
            using (var brush = new SolidBrush(Color.FromArgb((int)(240 * alpha), ink)))
                g.DrawString(node.title, font, brush, r.X + 37, r.Y + 11);
            if (node.children != null && node.children.Count > 0)
                using (var font = new Font("Segoe UI", 10f))
                using (var brush = new SolidBrush(Color.FromArgb((int)(170 * alpha), ink)))
                    g.DrawString("›", font, brush, r.Right - 20, r.Y + 10);
        }

        void DrawGlassCircle(Graphics g, PointF p, float r, Color surface,
            Color edge, bool selected) {
            RectangleF rect = CircleRect(p, r);
            RectangleF shadow = rect;
            shadow.Offset(1.2f, 2.4f);
            using (var sb = new SolidBrush(Color.FromArgb(selected ? 42 : 24, Color.Black)))
                g.FillEllipse(sb, shadow);
            using (var brush = new LinearGradientBrush(rect,
                Color.FromArgb(glassAlpha, Blend(surface, Color.White, 8)),
                Color.FromArgb(Math.Max(40, glassAlpha - 22), surface), 90f))
                g.FillEllipse(brush, rect);
            using (var pen = new Pen(Color.FromArgb(selected ? 200 : 58, edge),
                selected ? lineWidth + 0.7f : Math.Max(0.8f, lineWidth)))
                g.DrawEllipse(pen, rect);
            if (selected || applyFlash > 0.04f) {
                RectangleF ring = rect; ring.Inflate(4, 4);
                using (var pen = new Pen(Color.FromArgb(
                    (int)((selected ? 110 : 0) + applyFlash * 90), edge), 1.1f))
                    g.DrawEllipse(pen, ring);
            }
        }

        void DrawGlassRect(Graphics g, RectangleF r, Color surface, Color edge,
            bool selected, float alpha) {
            RectangleF shadow = r;
            shadow.Offset(1f, 2f);
            using (var sp = Round(shadow, 10))
            using (var sb = new SolidBrush(Color.FromArgb((int)((selected ? 36 : 18) * alpha), Color.Black)))
                g.FillPath(sb, sp);
            using (var path = Round(r, 10))
            using (var brush = new LinearGradientBrush(r,
                Color.FromArgb((int)(glassAlpha * alpha), Blend(surface, Color.White, 6)),
                Color.FromArgb((int)(Math.Max(40, glassAlpha - 18) * alpha), surface), 90f))
            using (var pen = new Pen(Color.FromArgb((int)((selected ? 188 : 52) * alpha), edge),
                selected ? lineWidth + 0.45f : Math.Max(0.8f, lineWidth))) {
                g.FillPath(brush, path);
                g.DrawPath(pen, path);
            }
        }

        static Color Blend(Color a, Color b, int pct) {
            pct = Math.Max(0, Math.Min(100, pct));
            int inv = 100 - pct;
            return Color.FromArgb(
                (a.R * inv + b.R * pct) / 100,
                (a.G * inv + b.G * pct) / 100,
                (a.B * inv + b.B * pct) / 100);
        }

        void DrawGlassRect(Graphics g, RectangleF r, Color surface, Color edge, bool selected) {
            DrawGlassRect(g, r, surface, edge, selected, 1f);
        }

        void DrawCanvasHud(Graphics g) {
            NodeLauncherMod n = style != null ? style.nodeLauncher : null;
            string look = n == null ? "" :
                ("  кнопки " + n.nodeScale + "%  скло " + n.opacity + "%  текст " + n.textScale + "%");
            string mode = TestMode ? "TEST · команди не запускаються" : "EDIT · виберіть елемент";
            using (var font = new Font("Segoe UI", 8.5f))
            using (var brush = new SolidBrush(Color.FromArgb(190,
                background == "light" ? Color.Black : Color.White)))
                g.DrawString(mode + look + "   " + (int)(zoom * 100) + "%", font, brush, 12, 12);
        }

        void BeginPan(object sender, MouseEventArgs e) {
            Focus();
            PreviewHit hit = HitAt(PointToWorld(e.Location));
            if (e.Button == MouseButtons.Middle || e.Button == MouseButtons.Right ||
                (e.Button == MouseButtons.Left && hit == null)) {
                panning = true; panStart = e.Location; panOrigin = pan;
                Capture = true; Cursor = Cursors.SizeAll;
                return;
            }
            if (e.Button != MouseButtons.Left || hit == null) return;
            if (!TestMode) {
                selectedId = hit.Node != null ? hit.Node.id : "";
                if (SelectionChanged != null) SelectionChanged(hit.Node);
                Invalidate();
                return;
            }
            if (hit.Kind == "center") {
                activeCategory = ""; activePath.Clear(); StartReveal(); return;
            }
            if (hit.Kind == "pocket") {
                activeCategory = ""; activePath.Clear(); StartReveal(); return;
            }
            if (hit.Node == null) return;
            if (hit.Kind == "category") {
                activeCategory = activeCategory == hit.Node.id ? "" : hit.Node.id;
                activePath.Clear(); StartReveal(); return;
            }
            bool group = hit.Node.children != null && hit.Node.children.Count > 0;
            if (group) {
                while (activePath.Count > hit.Depth) activePath.RemoveAt(activePath.Count - 1);
                if (activePath.Count == hit.Depth) activePath.Add(hit.Node.id);
                else activePath[hit.Depth] = hit.Node.id;
                StartReveal();
            } else if (ActionPreview != null) ActionPreview(hit.Node);
        }

        void MovePointer(object sender, MouseEventArgs e) {
            if (panning) {
                pan = new PointF(panOrigin.X + e.X - panStart.X,
                    panOrigin.Y + e.Y - panStart.Y);
                Invalidate(); return;
            }
            PreviewHit hit = HitAt(PointToWorld(e.Location));
            string next = hit != null && hit.Node != null ? hit.Node.id : "";
            if (next != hoverId) { hoverId = next; Invalidate(); }
        }

        void EndPan(object sender, MouseEventArgs e) {
            if (!panning) return;
            panning = false; Capture = false; Cursor = Cursors.Hand;
        }

        void ZoomWheel(object sender, MouseEventArgs e) {
            float old = zoom;
            zoom = Math.Max(0.45f, Math.Min(2.2f,
                zoom * (e.Delta > 0 ? 1.1f : 0.9f)));
            if (Math.Abs(old - zoom) > 0.001f) Invalidate();
        }

        public void ReplayOpening() {
            TestMode = true;
            activeCategory = "";
            activePath.Clear();
            if (doc != null && doc.categories != null && doc.categories.Count > 0)
                activeCategory = doc.categories[0].id;
            StartReveal();
        }

        public void FlashApplied() {
            applyFlash = 1f;
            applyFlashAt = DateTime.UtcNow;
            animation.Start();
            Invalidate();
        }

        public void StartReveal() {
            reveal = 0f; revealStarted = DateTime.UtcNow;
            animation.Stop();
            bool enabled = style == null || style.nodeLauncher == null ||
                style.nodeLauncher.animations;
            if (enabled && style != null && style.nodeLauncher != null &&
                style.nodeLauncher.respectSystemMotion && SystemReducedMotion())
                enabled = false;
            int speed = style != null && style.nodeLauncher != null
                ? Math.Max(40, style.nodeLauncher.animationSpeed) : 100;
            string motion = style != null && style.nodeLauncher != null
                ? FoxNodesSync.NormalizeMotionStyle(style.nodeLauncher.animationStyle)
                : "smooth";
            int baseMs = motion == "restrained" ? 280 : motion == "spring" ? 480
                : motion == "minimal" ? 140 : 420;
            revealMs = Math.Max(70, baseMs * 100 / speed);
            if (enabled) animation.Start(); else reveal = 1f;
            Invalidate();
        }

        float RevealEase(float t) {
            t = Math.Max(0f, Math.Min(1f, t));
            string motion = style != null && style.nodeLauncher != null
                ? FoxNodesSync.NormalizeMotionStyle(style.nodeLauncher.animationStyle)
                : "smooth";
            if (motion == "minimal") return t;
            if (motion == "restrained") return t * t * (3f - 2f * t);
            if (motion == "spring") {
                float u = t - 1f;
                return Math.Max(0f, Math.Min(1.06f, 1f + 2.12f * u * u * u + 1.12f * u * u));
            }
            float k = 1f - t;
            return 1f - k * k * k;
        }

        PreviewHit HitAt(PointF world) {
            for (int i = hits.Count - 1; i >= 0; i--)
                if (hits[i].Rect.Contains(world)) return hits[i];
            return null;
        }

        EditorNode HitNode(PointF world) {
            PreviewHit hit = HitAt(world);
            return hit != null ? hit.Node : null;
        }

        PointF PointToWorld(Point p) {
            return new PointF((p.X - ClientSize.Width / 2f - pan.X) / zoom,
                (p.Y - ClientSize.Height / 2f - pan.Y) / zoom);
        }

        string CategoryForSelection() {
            for (int i = 0; i < doc.categories.Count; i++)
                if (Contains(doc.categories[i], selectedId)) return doc.categories[i].id;
            return "";
        }

        List<string> PathForSelection(EditorNode category) {
            var result = new List<string>();
            FindPath(category, selectedId, result);
            if (result.Count > 0 && result[result.Count - 1] == selectedId)
                result.RemoveAt(result.Count - 1);
            return result;
        }

        bool FindPath(EditorNode node, string id, List<string> path) {
            if (node == null) return false;
            if (node.id == id) return true;
            for (int i = 0; i < node.children.Count; i++) {
                path.Add(node.children[i].id);
                if (FindPath(node.children[i], id, path)) return true;
                path.RemoveAt(path.Count - 1);
            }
            return false;
        }

        EditorNode FindNode(string id) {
            for (int i = 0; doc != null && i < doc.categories.Count; i++) {
                EditorNode found = FindNode(doc.categories[i], id);
                if (found != null) return found;
            }
            return null;
        }

        EditorNode FindNode(EditorNode n, string id) {
            if (n == null) return null;
            if (n.id == id) return n;
            for (int i = 0; i < n.children.Count; i++) {
                EditorNode found = FindNode(n.children[i], id);
                if (found != null) return found;
            }
            return null;
        }

        static bool Contains(EditorNode n, string id) {
            if (n == null) return false;
            if (n.id == id) return true;
            for (int i = 0; i < n.children.Count; i++)
                if (Contains(n.children[i], id)) return true;
            return false;
        }

        int IndexOfCategory(string id) {
            for (int i = 0; i < doc.categories.Count; i++)
                if (doc.categories[i].id == id) return i;
            return -1;
        }

        static EditorNode Child(EditorNode parent, string id) {
            if (parent == null) return null;
            for (int i = 0; i < parent.children.Count; i++)
                if (parent.children[i].id == id) return parent.children[i];
            return null;
        }

        static RectangleF CircleRect(PointF p, float r) {
            return new RectangleF(p.X - r, p.Y - r, r * 2, r * 2);
        }
        static PointF Center(RectangleF r) { return new PointF(r.X + r.Width / 2, r.Y + r.Height / 2); }
        static PointF CircleEdge(PointF from, float radius, PointF to) {
            float dx = to.X - from.X, dy = to.Y - from.Y;
            float len = (float)Math.Sqrt(dx * dx + dy * dy);
            return len < 0.1f ? from : new PointF(from.X + dx / len * radius, from.Y + dy / len * radius);
        }
        static PointF Edge(RectangleF r, PointF toward) {
            float cx = r.X + r.Width / 2, cy = r.Y + r.Height / 2;
            float dx = toward.X - cx, dy = toward.Y - cy;
            if (Math.Abs(dx) * r.Height >= Math.Abs(dy) * r.Width)
                return new PointF(dx < 0 ? r.Left : r.Right, Math.Max(r.Top + 4, Math.Min(r.Bottom - 4, toward.Y)));
            return new PointF(Math.Max(r.Left + 4, Math.Min(r.Right - 4, toward.X)), dy < 0 ? r.Top : r.Bottom);
        }
        static void DrawBezier(Graphics g, Pen pen, PointF a, PointF b) {
            float bend = Math.Max(25, Math.Abs(b.X - a.X) * 0.42f);
            float dir = b.X >= a.X ? 1 : -1;
            g.DrawBezier(pen, a, new PointF(a.X + bend * dir, a.Y),
                new PointF(b.X - bend * dir, b.Y), b);
        }
        static GraphicsPath Round(RectangleF r, float radius) {
            float d = radius * 2;
            var p = new GraphicsPath();
            p.AddArc(r.X, r.Y, d, d, 180, 90); p.AddArc(r.Right - d, r.Y, d, d, 270, 90);
            p.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90); p.AddArc(r.X, r.Bottom - d, d, d, 90, 90);
            p.CloseFigure(); return p;
        }
        static StringFormat CenterFormat() {
            return new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
        }
        static Font IconFont(float size) {
            try { return new Font("Segoe Fluent Icons", size); }
            catch { return new Font("Segoe MDL2 Assets", size); }
        }
        static Color Parse(string value, Color fallback) {
            try {
                string h = (value ?? "").Trim().TrimStart('#');
                return h.Length == 6 ? Color.FromArgb(Convert.ToInt32(h.Substring(0, 2), 16),
                    Convert.ToInt32(h.Substring(2, 2), 16), Convert.ToInt32(h.Substring(4, 2), 16)) : fallback;
            } catch { return fallback; }
        }
        static void ApplyLocalStyle(EditorNode node, ref Color surface,
            ref Color ink, ref Color accent) {
            if (node == null || node.style == null || !node.style.enabled) return;
            surface = Parse(node.style.surfaceHex, surface);
            ink = Parse(node.style.textHex, ink);
            accent = Parse(node.style.accentHex, accent);
        }
        string SurfaceHex(NodeLauncherMod n) {
            if (n.themeSource == "custom") return n.customSurface;
            return style != null && style.colors != null ? style.colors.surface : "#202226";
        }
        string InkHex(NodeLauncherMod n) {
            if (n.themeSource == "custom") return n.customInk;
            return style != null && style.colors != null ? style.colors.ink : "#E6E7E9";
        }
        string AccentHex(NodeLauncherMod n) {
            if (n.themeSource == "custom") return n.customAccent;
            return style != null && style.colors != null ? style.colors.accent : "#9B9FA7";
        }

        [DllImport("user32.dll")]
        static extern bool SystemParametersInfo(uint action, uint param,
            ref int value, uint flags);
        static bool SystemReducedMotion() {
            try {
                int enabled = 1;
                if (SystemParametersInfo(0x1042, 0, ref enabled, 0))
                    return enabled == 0;
            } catch { }
            return false;
        }

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        static extern bool SystemParametersInfo(uint action, uint param,
            StringBuilder value, uint flags);
        static Image LoadWallpaper() {
            try {
                var path = new StringBuilder(1024);
                if (!SystemParametersInfo(0x0073, (uint)path.Capacity, path, 0)) return null;
                using (Image source = Image.FromFile(path.ToString()))
                    return new Bitmap(source);
            } catch { return null; }
        }
    }
}
