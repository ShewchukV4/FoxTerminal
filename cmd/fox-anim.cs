// Fox System — shared motion helpers (C# 5 / .NET Framework 4.x).
// One scheduler per UI process; no background service. Real-time dt, interruptible tweens.

using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using Microsoft.Win32;

namespace FoxOs.Sdk {

    public static class FoxEase {
        public static float Clamp01(float t) {
            if (t <= 0f) return 0f;
            if (t >= 1f) return 1f;
            return t;
        }

        public static float Linear(float t) { return Clamp01(t); }

        public static float EaseOutCubic(float t) {
            t = Clamp01(t);
            float u = 1f - t;
            return 1f - u * u * u;
        }

        public static float EaseInOutCubic(float t) {
            t = Clamp01(t);
            if (t < 0.5f) return 4f * t * t * t;
            float u = -2f * t + 2f;
            return 1f - (u * u * u) / 2f;
        }

        public static float EaseOutQuad(float t) {
            t = Clamp01(t);
            return 1f - (1f - t) * (1f - t);
        }

        // Small overshoot only — safe for UI chrome.
        public static float EaseOutBack(float t) {
            t = Clamp01(t);
            const float c1 = 1.70158f;
            const float c3 = c1 + 1f;
            float u = t - 1f;
            return 1f + c3 * u * u * u + c1 * u * u;
        }

        public static float Apply(string easing, float t) {
            string e = (easing ?? "easeOut").Trim().ToLowerInvariant();
            if (e == "linear") return Linear(t);
            if (e == "easeinout" || e == "ease-in-out") return EaseInOutCubic(t);
            if (e == "easeoutquad" || e == "ease-out-quad") return EaseOutQuad(t);
            if (e == "spring" || e == "easeoutback" || e == "ease-out-back") return EaseOutBack(t);
            return EaseOutCubic(t);
        }

        public static float Lerp(float a, float b, float t) {
            return a + (b - a) * Clamp01(t);
        }

        public static int LerpInt(int a, int b, float t) {
            return (int)Math.Round(Lerp(a, b, t));
        }
    }

    // Interruptible 0..1 (or any float) tween. Reverse from current value — no jump to 0.
    public sealed class FoxTween {
        public float Value;
        public float From;
        public float To;
        public int DurationMs = 160;
        public string Easing = "easeOut";
        public DateTime StartedUtc = DateTime.MinValue;
        public bool Active;
        public bool Finished;
        Action onDone;

        public void Go(float target, int durationMs, string easing, Action done) {
            target = FoxEase.Clamp01(target);
            if (durationMs < 1 || Math.Abs(target - Value) < 0.0005f) {
                Value = target;
                From = To = target;
                Active = false;
                Finished = true;
                if (done != null) done();
                return;
            }
            From = Value;
            To = target;
            DurationMs = Math.Max(1, durationMs);
            Easing = string.IsNullOrEmpty(easing) ? "easeOut" : easing;
            StartedUtc = DateTime.UtcNow;
            Active = true;
            Finished = false;
            onDone = done;
        }

        public void Snap(float value) {
            Value = value;
            From = To = value;
            Active = false;
            Finished = true;
            onDone = null;
        }

        public void Cancel() {
            Active = false;
            Finished = true;
            onDone = null;
        }

        // Returns true while still animating.
        public bool Tick(DateTime now) {
            if (!Active) return false;
            double elapsed = (now - StartedUtc).TotalMilliseconds;
            float t = (float)(elapsed / Math.Max(1, DurationMs));
            if (t >= 1f) {
                Value = To;
                Active = false;
                Finished = true;
                Action done = onDone;
                onDone = null;
                if (done != null) done();
                return false;
            }
            float e = FoxEase.Apply(Easing, t);
            Value = FoxEase.Lerp(From, To, e);
            return true;
        }
    }

    // Shared WinForms timer for one UI process. Stops when idle.
    public sealed class FoxAnimClock : IDisposable {
        readonly Timer timer;
        readonly List<Action<DateTime, float>> ticks = new List<Action<DateTime, float>>();
        DateTime last = DateTime.UtcNow;
        int fpsCap = 0; // 0 = auto (~60)
        bool disposed;

        public FoxAnimClock() {
            timer = new Timer();
            timer.Interval = 16;
            timer.Tick += OnTick;
        }

        public int ActiveCount { get { return ticks.Count; } }
        public bool IsRunning { get { return timer.Enabled; } }

        public void SetFpsCap(string fps) {
            string f = (fps ?? "auto").Trim().ToLowerInvariant();
            if (f == "30") fpsCap = 30;
            else if (f == "60") fpsCap = 60;
            else fpsCap = 0;
            ApplyInterval();
        }

        void ApplyInterval() {
            int ms = 16;
            if (fpsCap == 30) ms = 33;
            else if (fpsCap == 60) ms = 16;
            if (timer.Interval != ms) timer.Interval = ms;
        }

        public void Add(Action<DateTime, float> tick) {
            if (tick == null || disposed) return;
            if (!ticks.Contains(tick)) ticks.Add(tick);
            if (!timer.Enabled) {
                last = DateTime.UtcNow;
                ApplyInterval();
                timer.Start();
            }
        }

        public void Remove(Action<DateTime, float> tick) {
            if (tick == null) return;
            ticks.Remove(tick);
            if (ticks.Count == 0 && timer.Enabled) timer.Stop();
        }

        public void Clear() {
            ticks.Clear();
            if (timer.Enabled) timer.Stop();
        }

        void OnTick(object sender, EventArgs e) {
            if (disposed) return;
            DateTime now = DateTime.UtcNow;
            float dt = (float)Math.Max(0.001, Math.Min(0.05, (now - last).TotalSeconds));
            last = now;
            // Copy to allow Remove during tick.
            Action<DateTime, float>[] copy = ticks.ToArray();
            for (int i = 0; i < copy.Length; i++) {
                try { copy[i](now, dt); } catch { }
            }
            if (ticks.Count == 0 && timer.Enabled) timer.Stop();
        }

        public void Dispose() {
            if (disposed) return;
            disposed = true;
            try { timer.Stop(); } catch { }
            ticks.Clear();
            try { timer.Dispose(); } catch { }
        }
    }

    // Per-category motion knobs (style.json → motion.*).
    public sealed class FoxAnimCategory {
        public bool enabled = true;
        public string transition = "fade-slide"; // fade | fade-slide | zoom | none
        public string easing = "easeOut";
        public int openMs = 180;
        public int closeMs = 130;
        public int offsetDip = 8;
        public int scaleFromPct = 97; // 90..100 → 0.90..1.00
        public int opacityFrom = 0;   // 0..100
        public int staggerMs = 0;

        public static FoxAnimCategory Defaults(string kind) {
            FoxAnimCategory c = new FoxAnimCategory();
            kind = (kind ?? "").ToLowerInvariant();
            if (kind == "hover") {
                c.transition = "fade";
                c.openMs = 90; c.closeMs = 80; c.offsetDip = 0;
                c.scaleFromPct = 100; c.staggerMs = 0;
            } else if (kind == "press") {
                c.transition = "zoom";
                c.openMs = 70; c.closeMs = 90; c.offsetDip = 0;
                c.scaleFromPct = 97; c.staggerMs = 0;
            } else if (kind == "launcher") {
                c.transition = "fade-slide";
                c.openMs = 180; c.closeMs = 120; c.offsetDip = 8;
                c.scaleFromPct = 97; c.staggerMs = 18;
            } else if (kind == "studio") {
                c.transition = "fade";
                c.openMs = 150; c.closeMs = 110; c.offsetDip = 6;
                c.scaleFromPct = 100; c.staggerMs = 0;
            } else if (kind == "dock") {
                c.transition = "fade-slide";
                c.openMs = 160; c.closeMs = 120; c.offsetDip = 6;
                c.scaleFromPct = 100; c.staggerMs = 0;
            } else if (kind == "alttab") {
                c.transition = "fade-slide";
                c.openMs = 160; c.closeMs = 110; c.offsetDip = 10;
                c.scaleFromPct = 100; c.staggerMs = 0;
            } else if (kind == "foxos") {
                c.transition = "fade";
                c.openMs = 200; c.closeMs = 140; c.offsetDip = 4;
                c.scaleFromPct = 100; c.staggerMs = 0;
            }
            return c;
        }

        public void Clamp() {
            openMs = ClampInt(openMs, 0, 800);
            closeMs = ClampInt(closeMs, 0, 800);
            offsetDip = ClampInt(offsetDip, 0, 48);
            scaleFromPct = ClampInt(scaleFromPct, 90, 100);
            opacityFrom = ClampInt(opacityFrom, 0, 100);
            staggerMs = ClampInt(staggerMs, 0, 80);
            transition = NormalizeTransition(transition);
            easing = NormalizeEasing(easing);
        }

        public static string NormalizeTransition(string v) {
            v = (v ?? "fade-slide").Trim().ToLowerInvariant();
            if (v == "fade" || v == "fade-slide" || v == "zoom" || v == "none") return v;
            return "fade-slide";
        }

        public static string NormalizeEasing(string v) {
            v = (v ?? "easeOut").Trim().ToLowerInvariant();
            if (v == "linear" || v == "easeout" || v == "easeinout" ||
                v == "ease-in-out" || v == "spring" || v == "easeoutback") return v;
            return "easeOut";
        }

        static int ClampInt(int v, int lo, int hi) {
            if (v < lo) return lo;
            if (v > hi) return hi;
            return v;
        }
    }

    // Global motion document fragment (maps onto StyleDoc.motion).
    public sealed class FoxMotionConfig {
        // Legacy fields (kept for old style.json)
        public string scale = "full"; // full | reduced | off
        public int med = 280;

        public bool enabled = true;
        public string preset = "balanced"; // off | economy | balanced | smooth | custom
        public int speedPercent = 100;
        public int intensityPercent = 100;
        public string fps = "auto"; // 30 | 60 | auto
        public bool reducedMotion = false;
        public string battery = "auto"; // auto | economy | full
        public int requestId = 1;

        public FoxAnimCategory launcher;
        public FoxAnimCategory studio;
        public FoxAnimCategory dock;
        public FoxAnimCategory altTab;
        public FoxAnimCategory foxos;
        public FoxAnimCategory hover;
        public FoxAnimCategory press;

        public static FoxMotionConfig CreateDefault() {
            FoxMotionConfig m = new FoxMotionConfig();
            m.EnsureCategories();
            return m;
        }

        public void EnsureCategories() {
            if (launcher == null) launcher = FoxAnimCategory.Defaults("launcher");
            if (studio == null) studio = FoxAnimCategory.Defaults("studio");
            if (dock == null) dock = FoxAnimCategory.Defaults("dock");
            if (altTab == null) altTab = FoxAnimCategory.Defaults("alttab");
            if (foxos == null) foxos = FoxAnimCategory.Defaults("foxos");
            if (hover == null) hover = FoxAnimCategory.Defaults("hover");
            if (press == null) press = FoxAnimCategory.Defaults("press");
        }

        public void ClampAll() {
            EnsureCategories();
            speedPercent = Math.Max(40, Math.Min(180, speedPercent));
            intensityPercent = Math.Max(0, Math.Min(150, intensityPercent));
            med = Math.Max(80, Math.Min(600, med));
            if (requestId < 1) requestId = 1;
            preset = NormalizePreset(preset);
            fps = NormalizeFps(fps);
            battery = NormalizeBattery(battery);
            scale = NormalizeScale(scale);
            launcher.Clamp(); studio.Clamp(); dock.Clamp();
            altTab.Clamp(); foxos.Clamp(); hover.Clamp(); press.Clamp();
        }

        public static string NormalizePreset(string v) {
            v = (v ?? "balanced").Trim().ToLowerInvariant();
            if (v == "off" || v == "none" || v == "без" || v == "disabled") return "off";
            if (v == "economy" || v == "економний" || v == "eco") return "economy";
            if (v == "smooth" || v == "плавний") return "smooth";
            if (v == "custom" || v == "власний") return "custom";
            return "balanced";
        }

        public static string NormalizeFps(string v) {
            v = (v ?? "auto").Trim().ToLowerInvariant();
            if (v == "30" || v == "60") return v;
            return "auto";
        }

        public static string NormalizeBattery(string v) {
            v = (v ?? "auto").Trim().ToLowerInvariant();
            if (v == "economy" || v == "full") return v;
            return "auto";
        }

        public static string NormalizeScale(string v) {
            v = (v ?? "full").Trim().ToLowerInvariant();
            if (v == "reduced" || v == "off") return v;
            return "full";
        }

        public void ApplyPreset(string id) {
            id = NormalizePreset(id);
            preset = id;
            EnsureCategories();
            if (id == "off") {
                enabled = false;
                scale = "off";
                speedPercent = 100;
                intensityPercent = 0;
                reducedMotion = true;
                return;
            }
            enabled = true;
            reducedMotion = false;
            if (id == "economy") {
                scale = "reduced";
                speedPercent = 130;
                intensityPercent = 55;
                fps = "30";
                battery = "economy";
                ApplyEconomyCats();
            } else if (id == "smooth") {
                scale = "full";
                speedPercent = 92;
                intensityPercent = 110;
                fps = "auto";
                battery = "auto";
                ApplySmoothCats();
            } else if (id == "balanced") {
                scale = "full";
                speedPercent = 100;
                intensityPercent = 100;
                fps = "auto";
                battery = "auto";
                launcher = FoxAnimCategory.Defaults("launcher");
                studio = FoxAnimCategory.Defaults("studio");
                dock = FoxAnimCategory.Defaults("dock");
                altTab = FoxAnimCategory.Defaults("alttab");
                foxos = FoxAnimCategory.Defaults("foxos");
                hover = FoxAnimCategory.Defaults("hover");
                press = FoxAnimCategory.Defaults("press");
            }
            // custom: keep current knobs
            ClampAll();
        }

        void ApplyEconomyCats() {
            launcher = FoxAnimCategory.Defaults("launcher");
            launcher.openMs = 120; launcher.closeMs = 90; launcher.offsetDip = 4;
            launcher.scaleFromPct = 99; launcher.staggerMs = 0; launcher.transition = "fade";
            studio = FoxAnimCategory.Defaults("studio");
            studio.openMs = 100; studio.closeMs = 80; studio.offsetDip = 0;
            dock = FoxAnimCategory.Defaults("dock");
            dock.openMs = 110; dock.closeMs = 90; dock.offsetDip = 3;
            altTab = FoxAnimCategory.Defaults("alttab");
            altTab.openMs = 110; altTab.closeMs = 80; altTab.offsetDip = 6;
            foxos = FoxAnimCategory.Defaults("foxos");
            foxos.openMs = 120; foxos.closeMs = 90;
            hover = FoxAnimCategory.Defaults("hover");
            hover.openMs = 70; hover.closeMs = 60;
            press = FoxAnimCategory.Defaults("press");
            press.openMs = 50; press.closeMs = 70;
        }

        void ApplySmoothCats() {
            launcher = FoxAnimCategory.Defaults("launcher");
            launcher.openMs = 210; launcher.closeMs = 140; launcher.offsetDip = 10;
            launcher.scaleFromPct = 97; launcher.staggerMs = 22; launcher.easing = "easeOut";
            studio = FoxAnimCategory.Defaults("studio");
            studio.openMs = 170; studio.closeMs = 120; studio.offsetDip = 8;
            dock = FoxAnimCategory.Defaults("dock");
            dock.openMs = 180; dock.closeMs = 130; dock.offsetDip = 8;
            altTab = FoxAnimCategory.Defaults("alttab");
            altTab.openMs = 180; altTab.closeMs = 120; altTab.offsetDip = 12;
            foxos = FoxAnimCategory.Defaults("foxos");
            foxos.openMs = 220; foxos.closeMs = 150;
            hover = FoxAnimCategory.Defaults("hover");
            hover.openMs = 110; hover.closeMs = 100;
            press = FoxAnimCategory.Defaults("press");
            press.openMs = 80; press.closeMs = 100;
        }

        public bool EffectiveEnabled() {
            if (!enabled) return false;
            if (string.Equals(scale, "off", StringComparison.OrdinalIgnoreCase)) return false;
            if (string.Equals(preset, "off", StringComparison.OrdinalIgnoreCase)) return false;
            return true;
        }

        public int ScaleDuration(int ms) {
            if (!EffectiveEnabled()) return 1;
            int pct = speedPercent;
            if (pct < 40) pct = 40;
            if (pct > 180) pct = 180;
            // Higher speedPercent = faster = shorter duration.
            int scaled = ms * 100 / pct;
            if (string.Equals(scale, "reduced", StringComparison.OrdinalIgnoreCase) || reducedMotion)
                scaled = scaled * 70 / 100;
            if (UseBatteryEconomy()) scaled = scaled * 75 / 100;
            return Math.Max(1, scaled);
        }

        public float ScaleIntensity(float dipOrAmt) {
            if (!EffectiveEnabled()) return 0f;
            float i = intensityPercent / 100f;
            if (string.Equals(scale, "reduced", StringComparison.OrdinalIgnoreCase) || reducedMotion)
                i *= 0.45f;
            if (UseBatteryEconomy()) i *= 0.6f;
            return dipOrAmt * i;
        }

        public bool UseBatteryEconomy() {
            string b = NormalizeBattery(battery);
            if (b == "full") return false;
            if (b == "economy") return true;
            return FoxMotionHost.OnBattery();
        }
    }

    public static class FoxMotionHost {
        [DllImport("kernel32.dll")]
        static extern bool GetSystemPowerStatus(out SYSTEM_POWER_STATUS sps);

        [StructLayout(LayoutKind.Sequential)]
        struct SYSTEM_POWER_STATUS {
            public byte ACLineStatus;
            public byte BatteryFlag;
            public byte BatteryLifePercent;
            public byte Reserved1;
            public int BatteryLifeTime;
            public int BatteryFullLifeTime;
        }

        public static bool OnBattery() {
            try {
                SYSTEM_POWER_STATUS s;
                if (!GetSystemPowerStatus(out s)) return false;
                return s.ACLineStatus == 0;
            } catch { return false; }
        }

        public static bool SystemPrefersReducedMotion() {
            try {
                object anim = Registry.GetValue(
                    @"HKEY_CURRENT_USER\Control Panel\Desktop\WindowMetrics",
                    "MinAnimate", "1");
                if (anim != null && Convert.ToString(anim) == "0") return true;
            } catch { }
            try {
                // SPI_GETCLIENTAREAANIMATION via SystemParametersInfo
                int enabled = 1;
                if (SystemParametersInfo(0x1042 /*SPI_GETCLIENTAREAANIMATION*/, 0,
                    ref enabled, 0) && enabled == 0) return true;
            } catch { }
            return false;
        }

        [DllImport("user32.dll", SetLastError = true)]
        static extern bool SystemParametersInfo(uint uiAction, uint uiParam,
            ref int pvParam, uint fWinIni);

        // Load motion block from style.json without pulling StyleDoc (foxos-live has no Models.cs).
        public static FoxMotionConfig LoadFromStyleJson() {
            try {
                string path = Path.Combine(FoxPaths.RuntimeDir(), "style.json");
                if (!File.Exists(path)) return FoxMotionConfig.CreateDefault();
                StyleMotionEnvelope env = FoxJson.FileLoad<StyleMotionEnvelope>(path, null);
                if (env == null || env.motion == null) return FoxMotionConfig.CreateDefault();
                FoxMotionConfig m = env.motion;
                m.EnsureCategories();
                m.ClampAll();
                if (m.reducedMotion || SystemPrefersReducedMotion()) {
                    if (string.Equals(m.scale, "full", StringComparison.OrdinalIgnoreCase))
                        m.scale = "reduced";
                }
                return m;
            } catch {
                return FoxMotionConfig.CreateDefault();
            }
        }

        sealed class StyleMotionEnvelope {
            public FoxMotionConfig motion = null;
        }
    }
}
