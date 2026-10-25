using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using System.Speech.Synthesis;
using System.Text;
using System.Threading;
using FoxOs.Assistant;
using FoxOs.Stt;

namespace FoxOs.Nodes {

    sealed class AssistantSpeech : IDisposable {
        public string LastError = "";
        public string LastHeard = "";
        public float Level;
        public bool Speaking;
        public bool Recording;
        public int LastMs;
        string lastSpoken = "";

        readonly object gate = new object();
        WaveRecorder recorder;
        SpeechSynthesizer synth;
        bool disposed;

        public static List<MicInfo> ListMics() {
            var list = new List<MicInfo>();
            int n = WaveRecorder.DeviceCount();
            for (int i = 0; i < n; i++) {
                string name = WaveRecorder.DeviceName(i);
                var info = new MicInfo { index = i, name = name };
                string low = (name ?? "").ToLowerInvariant();
                info.preferred = low.Contains("trust") || low.Contains("gxt") ||
                    (low.Contains("usb") && !low.Contains("array"));
                list.Add(info);
            }
            return list;
        }

        public static int ResolveDevice(AssistantConfig cfg) {
            List<MicInfo> mics = ListMics();
            if (mics.Count == 0) return -1;
            if (cfg != null && !string.IsNullOrEmpty(cfg.micName)) {
                for (int i = 0; i < mics.Count; i++)
                    if (string.Equals(mics[i].name, cfg.micName, StringComparison.OrdinalIgnoreCase))
                        return mics[i].index;
            }
            for (int i = 0; i < mics.Count; i++)
                if (mics[i].preferred) return mics[i].index;
            return 0;
        }

        public static string DefaultMicName() {
            List<MicInfo> mics = ListMics();
            for (int i = 0; i < mics.Count; i++)
                if (mics[i].preferred) return mics[i].name;
            return mics.Count > 0 ? mics[0].name : "";
        }

        public bool StartListen(AssistantConfig cfg) {
            lock (gate) {
                LastError = "";
                LastHeard = "";
                if (Speaking) {
                    LastError = "Спочатку зупиніть озвучення.";
                    return false;
                }
                CancelListen();
                int dev = ResolveDevice(cfg);
                if (dev < 0) {
                    LastError = "Мікрофон не знайдено.";
                    return false;
                }
                recorder = new WaveRecorder();
                recorder.LevelChanged += delegate(float v) { Level = v; };
                if (!recorder.Start(dev)) {
                    LastError = recorder.LastError;
                    recorder.Dispose();
                    recorder = null;
                    return false;
                }
                Recording = true;
                return true;
            }
        }

        public string StopListen(AssistantConfig cfg) {
            byte[] wav = null;
            lock (gate) {
                Recording = false;
                if (recorder == null) return "";
                wav = recorder.StopToWav();
                float peak = recorder.Peak;
                recorder.Dispose();
                recorder = null;
                Level = 0;
                if (SttAudio.LooksSilent(wav, peak)) {
                    LastError = "Тиша — команду не виконую.";
                    LastHeard = "";
                    return "";
                }
            }
            return Recognize(wav, cfg);
        }

        public void CancelListen() {
            lock (gate) {
                Recording = false;
                if (recorder != null) {
                    recorder.Dispose();
                    recorder = null;
                }
                Level = 0;
            }
            SttRuntime.Cancel();
        }

        string Recognize(byte[] wav, AssistantConfig cfg) {
            LastHeard = "";
            LastMs = 0;
            if (cfg != null && !cfg.sttEnabled) {
                LastError = "Розпізнавання вимкнено в налаштуваннях.";
                return "";
            }
            if (!SttInstaller.IsInstalled()) {
                LastError = "Локальний STT не встановлено. FOXSTYLE → Помічник → Встановити.";
                return "";
            }
            string lang = cfg != null && !string.IsNullOrEmpty(cfg.sttLanguage)
                ? cfg.sttLanguage : "uk";
            string text = SttRuntime.Transcribe(wav, lang, 45000, cfg != null ? cfg.sttModel : "");
            if (string.IsNullOrEmpty(text)) {
                if (!SttRuntime.IsServerUp())
                    text = SttRuntime.TranscribeCli(wav, lang, 60000);
            }
            LastMs = SttRuntime.LastMs;
            if (string.IsNullOrEmpty(text)) {
                LastError = string.IsNullOrEmpty(SttRuntime.LastError)
                    ? "Не розпізнав мовлення. Виправ текст і надішли ще раз."
                    : SttRuntime.LastError;
                return "";
            }
            if (EchoOfOwnVoice(text)) {
                LastError = "Ігнорую власне озвучення.";
                LastHeard = "";
                return "";
            }
            LastHeard = text;
            LastError = "";
            return LastHeard;
        }

        bool EchoOfOwnVoice(string text) {
            if (string.IsNullOrEmpty(lastSpoken) || string.IsNullOrEmpty(text)) return false;
            string a = AssistantGuard.Normalize(lastSpoken);
            string b = AssistantGuard.Normalize(text);
            if (a.Length == 0 || b.Length == 0) return false;
            return a == b || (a.Length > 8 && b.IndexOf(a, StringComparison.Ordinal) >= 0);
        }

        public static string SpeechStatus() {
            if (SttInstaller.IsInstalled())
                return "STT: " + SttInstaller.ReadyDetail() +
                    (SttRuntime.IsServerUp() ? " · сервер готовий" : " · сервер ще не запущено");
            return "STT не встановлено. FOXSTYLE → Помічник → Встановити локальний Whisper.";
        }

        public static List<string> Voices() {
            var names = new List<string>();
            try {
                using (var s = new SpeechSynthesizer()) {
                    foreach (InstalledVoice v in s.GetInstalledVoices()) {
                        if (v.Enabled) names.Add(v.VoiceInfo.Name);
                    }
                }
            } catch { }
            return names;
        }

        public static bool HasUkrainianVoice() {
            try {
                using (var s = new SpeechSynthesizer()) {
                    foreach (InstalledVoice v in s.GetInstalledVoices()) {
                        if (v.VoiceInfo != null && v.VoiceInfo.Culture != null &&
                            v.VoiceInfo.Culture.Name.StartsWith("uk")) return true;
                    }
                }
            } catch { }
            return false;
        }

        public void Speak(AssistantConfig cfg, string text) {
            if (cfg == null || !cfg.ttsEnabled || string.IsNullOrWhiteSpace(text)) return;
            StopSpeak();
            try {
                synth = new SpeechSynthesizer();
                if (!string.IsNullOrEmpty(cfg.ttsVoice)) {
                    try { synth.SelectVoice(cfg.ttsVoice); } catch { }
                }
                synth.Volume = Math.Max(0, Math.Min(100, cfg.ttsVolume));
                synth.Rate = Math.Max(-10, Math.Min(10, cfg.ttsRate));
                lastSpoken = text;
                Speaking = true;
                synth.SpeakCompleted += delegate {
                    Speaking = false;
                };
                synth.SpeakAsync(text);
            } catch (Exception ex) {
                Speaking = false;
                LastError = "TTS: " + ex.Message;
            }
        }

        public void StopSpeak() {
            try {
                if (synth != null) {
                    synth.SpeakAsyncCancelAll();
                    synth.Dispose();
                }
            } catch { }
            synth = null;
            Speaking = false;
        }

        public bool ProbeMic(AssistantConfig cfg, out string detail) {
            detail = "";
            int dev = ResolveDevice(cfg);
            if (dev < 0) { detail = "Немає пристрою запису."; return false; }
            var rec = new WaveRecorder();
            if (!rec.Start(dev)) { detail = rec.LastError; rec.Dispose(); return false; }
            Thread.Sleep(180);
            float peak = rec.Peak;
            rec.Dispose();
            detail = WaveRecorder.DeviceName(dev) + " · потік відкрито, пік " +
                ((int)(peak * 100)).ToString(CultureInfo.InvariantCulture) + "%";
            return true;
        }

        public void Dispose() {
            if (disposed) return;
            disposed = true;
            CancelListen();
            StopSpeak();
        }
    }

    sealed class WaveRecorder : IDisposable {
        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
        struct WaveInCaps {
            public short mid, pid;
            public int ver;
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)]
            public string name;
            public int formats;
            public short channels, reserved;
        }
        [StructLayout(LayoutKind.Sequential)]
        struct WaveFormat {
            public short tag, channels;
            public int samples, avg;
            public short block, bits, extra;
        }
        [StructLayout(LayoutKind.Sequential)]
        struct WaveHdr {
            public IntPtr data;
            public int length, written, flags, loops;
            public IntPtr user, next;
            public int reserved;
        }

        delegate void WaveInProc(IntPtr hwo, int msg, IntPtr inst, IntPtr p1, IntPtr p2);

        [DllImport("winmm.dll", CharSet = CharSet.Auto)]
        static extern int waveInGetNumDevs();
        [DllImport("winmm.dll", CharSet = CharSet.Auto)]
        static extern int waveInGetDevCaps(IntPtr uDeviceID, out WaveInCaps caps, int size);
        [DllImport("winmm.dll")]
        static extern int waveInOpen(out IntPtr h, int device, ref WaveFormat fmt,
            WaveInProc proc, IntPtr inst, int flags);
        [DllImport("winmm.dll")]
        static extern int waveInPrepareHeader(IntPtr h, IntPtr hdr, int size);
        [DllImport("winmm.dll")]
        static extern int waveInAddBuffer(IntPtr h, IntPtr hdr, int size);
        [DllImport("winmm.dll")]
        static extern int waveInStart(IntPtr h);
        [DllImport("winmm.dll")]
        static extern int waveInStop(IntPtr h);
        [DllImport("winmm.dll")]
        static extern int waveInReset(IntPtr h);
        [DllImport("winmm.dll")]
        static extern int waveInUnprepareHeader(IntPtr h, IntPtr hdr, int size);
        [DllImport("winmm.dll")]
        static extern int waveInClose(IntPtr h);

        const int CALLBACK_FUNCTION = 0x00030000;
        const int WIM_DATA = 0x3C0;
        const int Rate = 16000;
        const int Bits = 16;
        const int Channels = 1;
        const int BufMs = 80;

        IntPtr handle;
        WaveInProc proc;
        readonly List<byte> pcm = new List<byte>();
        readonly List<IntPtr> headers = new List<IntPtr>();
        readonly List<IntPtr> buffers = new List<IntPtr>();
        bool running;
        public string LastError = "";
        public float Peak;
        public event Action<float> LevelChanged;

        public static int DeviceCount() { return waveInGetNumDevs(); }

        public static string DeviceName(int index) {
            WaveInCaps caps;
            if (waveInGetDevCaps(new IntPtr(index), out caps, Marshal.SizeOf(typeof(WaveInCaps))) != 0)
                return "Mic " + index;
            return (caps.name ?? "").Trim();
        }

        public bool Start(int device) {
            LastError = "";
            pcm.Clear();
            Peak = 0;
            var fmt = new WaveFormat();
            fmt.tag = 1;
            fmt.channels = Channels;
            fmt.samples = Rate;
            fmt.bits = Bits;
            fmt.block = (short)(Channels * Bits / 8);
            fmt.avg = Rate * fmt.block;
            proc = OnWave;
            int r = waveInOpen(out handle, device, ref fmt, proc, IntPtr.Zero, CALLBACK_FUNCTION);
            if (r != 0) {
                LastError = "Не вдалося відкрити мікрофон (код " + r + "). Перевірте дозвіл Windows.";
                return false;
            }
            int bytes = Rate * fmt.block * BufMs / 1000;
            for (int i = 0; i < 4; i++) {
                IntPtr data = Marshal.AllocHGlobal(bytes);
                var hdr = new WaveHdr { data = data, length = bytes };
                IntPtr hp = Marshal.AllocHGlobal(Marshal.SizeOf(typeof(WaveHdr)));
                Marshal.StructureToPtr(hdr, hp, false);
                waveInPrepareHeader(handle, hp, Marshal.SizeOf(typeof(WaveHdr)));
                waveInAddBuffer(handle, hp, Marshal.SizeOf(typeof(WaveHdr)));
                headers.Add(hp);
                buffers.Add(data);
            }
            running = true;
            waveInStart(handle);
            return true;
        }

        void OnWave(IntPtr hwo, int msg, IntPtr inst, IntPtr p1, IntPtr p2) {
            if (msg != WIM_DATA || !running || p1 == IntPtr.Zero) return;
            try {
                WaveHdr hdr = (WaveHdr)Marshal.PtrToStructure(p1, typeof(WaveHdr));
                if (hdr.written > 0 && hdr.data != IntPtr.Zero) {
                    byte[] chunk = new byte[hdr.written];
                    Marshal.Copy(hdr.data, chunk, 0, hdr.written);
                    lock (pcm) pcm.AddRange(chunk);
                    float peak = 0;
                    for (int i = 0; i + 1 < chunk.Length; i += 2) {
                        short s = (short)(chunk[i] | (chunk[i + 1] << 8));
                        float a = Math.Abs(s / 32768f);
                        if (a > peak) peak = a;
                    }
                    if (peak > Peak) Peak = peak;
                    if (LevelChanged != null) LevelChanged(peak);
                }
                if (running && handle != IntPtr.Zero) {
                    waveInAddBuffer(handle, p1, Marshal.SizeOf(typeof(WaveHdr)));
                }
            } catch { }
        }

        public byte[] StopToWav() {
            running = false;
            if (handle != IntPtr.Zero) {
                try { waveInStop(handle); } catch { }
                try { waveInReset(handle); } catch { }
            }
            byte[] data;
            lock (pcm) data = pcm.ToArray();
            return BuildWav(data);
        }

        static byte[] BuildWav(byte[] data) {
            if (data == null) data = new byte[0];
            var ms = new MemoryStream();
            var bw = new BinaryWriter(ms);
            int byteRate = Rate * Channels * Bits / 8;
            bw.Write(Encoding.ASCII.GetBytes("RIFF"));
            bw.Write(36 + data.Length);
            bw.Write(Encoding.ASCII.GetBytes("WAVE"));
            bw.Write(Encoding.ASCII.GetBytes("fmt "));
            bw.Write(16);
            bw.Write((short)1);
            bw.Write((short)Channels);
            bw.Write(Rate);
            bw.Write(byteRate);
            bw.Write((short)(Channels * Bits / 8));
            bw.Write((short)Bits);
            bw.Write(Encoding.ASCII.GetBytes("data"));
            bw.Write(data.Length);
            bw.Write(data);
            bw.Flush();
            return ms.ToArray();
        }

        public void Dispose() {
            running = false;
            if (handle != IntPtr.Zero) {
                try { waveInReset(handle); } catch { }
                for (int i = 0; i < headers.Count; i++) {
                    try { waveInUnprepareHeader(handle, headers[i], Marshal.SizeOf(typeof(WaveHdr))); }
                    catch { }
                    try { Marshal.FreeHGlobal(headers[i]); } catch { }
                    try { Marshal.FreeHGlobal(buffers[i]); } catch { }
                }
                headers.Clear();
                buffers.Clear();
                try { waveInClose(handle); } catch { }
                handle = IntPtr.Zero;
            }
        }
    }
}
