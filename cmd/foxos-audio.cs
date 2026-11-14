// FoxOS Core Audio — master volume, per-app sessions, device list, headphone pause.
// C# 5 / .NET Framework 4.x. Compiled into foxos-live.exe.

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Windows.Forms;
using FoxOs.Sdk;

namespace FoxOsLive {

    sealed class FoxAudioApp {
        public int Pid;
        public string Name;
        public string Display;
        public Image Icon;
        public int Pct;
        public bool Mute;
    }

    sealed class FoxAudioDevice {
        public string Id;
        public string Name;
        public bool IsDefault;
        public bool Active;
    }

    static class FoxAudio {
        public static void VolUp() { Key(0xAF); }
        public static void VolDown() { Key(0xAE); }
        public static void VolMute() { Key(0xAD); }

        static void Key(byte vk) {
            Native.keybd_event(vk, 0, 0, UIntPtr.Zero);
            Native.keybd_event(vk, 0, 2, UIntPtr.Zero);
        }

        public static int GetPct() {
            IAudioEndpointVolume vol = null;
            try {
                vol = OpenEndpoint();
                if (vol == null) return -1;
                float v;
                vol.GetMasterVolumeLevelScalar(out v);
                bool mute;
                vol.GetMute(out mute);
                if (mute) return 0;
                int n = (int)Math.Round(v * 100.0);
                if (n < 0) n = 0;
                if (n > 100) n = 100;
                return n;
            } catch { return -1; }
            finally { SafeRelease(vol); }
        }

        public static bool GetMute() {
            IAudioEndpointVolume vol = null;
            try {
                vol = OpenEndpoint();
                if (vol == null) return false;
                bool mute;
                vol.GetMute(out mute);
                return mute;
            } catch { return false; }
            finally { SafeRelease(vol); }
        }

        public static void SetPct(int pct) {
            if (pct < 0) pct = 0; if (pct > 100) pct = 100;
            IAudioEndpointVolume vol = null;
            try {
                vol = OpenEndpoint();
                if (vol == null) return;
                Guid ctx = Guid.Empty;
                vol.SetMute(false, ref ctx);
                vol.SetMasterVolumeLevelScalar(pct / 100f, ref ctx);
            } catch { }
            finally { SafeRelease(vol); }
        }

        public static void SetMute(bool mute) {
            IAudioEndpointVolume vol = null;
            try {
                vol = OpenEndpoint();
                if (vol == null) return;
                Guid ctx = Guid.Empty;
                vol.SetMute(mute, ref ctx);
            } catch { }
            finally { SafeRelease(vol); }
        }

        public static List<FoxAudioDevice> ListRenderDevices() {
            List<FoxAudioDevice> list = new List<FoxAudioDevice>();
            IMMDeviceEnumerator en = null;
            IMMDeviceCollection col = null;
            IMMDevice def = null;
            string defId = "";
            try {
                en = CreateEnumerator();
                if (en == null) return list;
                try {
                    en.GetDefaultAudioEndpoint(0, 1, out def);
                    if (def != null) {
                        IntPtr p;
                        def.GetId(out p);
                        defId = CoStr(p);
                    }
                } catch { }
                // ACTIVE | DISABLED | NOTPRESENT | UNPLUGGED
                en.EnumAudioEndpoints(0, 1 | 2 | 4 | 8, out col);
                if (col == null) return list;
                uint n;
                col.GetCount(out n);
                for (uint i = 0; i < n; i++) {
                    IMMDevice dev = null;
                    IPropertyStore store = null;
                    try {
                        col.Item(i, out dev);
                        if (dev == null) continue;
                        IntPtr idPtr;
                        dev.GetId(out idPtr);
                        string id = CoStr(idPtr);
                        uint state;
                        dev.GetState(out state);
                        string name = id;
                        try {
                            dev.OpenPropertyStore(0, out store);
                            if (store != null) {
                                PROPERTYKEY key = PkeyFriendlyName;
                                PropVariant pv;
                                if (store.GetValue(ref key, out pv) == 0 && pv.vt == 31) {
                                    name = Marshal.PtrToStringUni(pv.ptr) ?? id;
                                }
                                PropVariantClear(ref pv);
                            }
                        } catch { }
                        FoxAudioDevice d = new FoxAudioDevice();
                        d.Id = id;
                        d.Name = name;
                        d.IsDefault = defId.Length > 0 &&
                            string.Equals(defId, id, StringComparison.OrdinalIgnoreCase);
                        d.Active = (state & 1) != 0;
                        list.Add(d);
                    } catch { }
                    finally {
                        SafeRelease(store);
                        SafeRelease(dev);
                    }
                }
            } catch { }
            finally {
                SafeRelease(def);
                SafeRelease(col);
                SafeRelease(en);
            }
            return list;
        }

        // Sessions on the default render endpoint, grouped by process id.
        // One slider per app — all of that process's sessions move together.
        public static List<FoxAudioApp> ListApps(bool includeInactive) {
            Dictionary<int, FoxAudioApp> map = new Dictionary<int, FoxAudioApp>();
            IMMDeviceEnumerator en = null;
            IMMDevice dev = null;
            IAudioSessionManager2 mgr = null;
            IAudioSessionEnumerator sessEn = null;
            try {
                en = CreateEnumerator();
                if (en == null) return new List<FoxAudioApp>();
                en.GetDefaultAudioEndpoint(0, 1, out dev);
                if (dev == null) return new List<FoxAudioApp>();
                Guid iid = typeof(IAudioSessionManager2).GUID;
                object raw;
                dev.Activate(ref iid, 1, IntPtr.Zero, out raw);
                mgr = raw as IAudioSessionManager2;
                if (mgr == null) return new List<FoxAudioApp>();
                mgr.GetSessionEnumerator(out sessEn);
                if (sessEn == null) return new List<FoxAudioApp>();
                int count;
                sessEn.GetCount(out count);
                for (int i = 0; i < count; i++) {
                    IAudioSessionControl ctl = null;
                    IAudioSessionControl2 ctl2 = null;
                    ISimpleAudioVolume vol = null;
                    try {
                        sessEn.GetSession(i, out ctl);
                        if (ctl == null) continue;
                        ctl2 = Qi<IAudioSessionControl2>(ctl);
                        if (ctl2 == null) continue;
                        AudioSessionState state;
                        ctl.GetState(out state);
                        if (!includeInactive && state == AudioSessionState.Expired) continue;
                        uint pidU;
                        if (ctl2.GetProcessId(out pidU) != 0) continue;
                        int pid = (int)pidU;
                        if (pid <= 0) continue;
                        vol = Qi<ISimpleAudioVolume>(ctl);
                        if (vol == null) continue;
                        float level;
                        vol.GetMasterVolume(out level);
                        bool mute;
                        vol.GetMute(out mute);
                        int pct = (int)Math.Round(level * 100f);
                        if (pct < 0) pct = 0; if (pct > 100) pct = 100;

                        FoxAudioApp app;
                        if (!map.TryGetValue(pid, out app)) {
                            app = new FoxAudioApp();
                            app.Pid = pid;
                            app.Name = ProcessName(pid);
                            app.Display = app.Name;
                            app.Pct = pct;
                            app.Mute = mute;
                            try { app.Icon = IconForPid(pid); } catch { }
                            map[pid] = app;
                        } else {
                            if (!mute && app.Mute) { app.Mute = false; app.Pct = pct; }
                            else if (pct > app.Pct) app.Pct = pct;
                        }
                    } catch { }
                    finally {
                        SafeRelease(vol);
                        SafeRelease(ctl2);
                        SafeRelease(ctl);
                    }
                }
            } catch { }
            finally {
                SafeRelease(sessEn);
                SafeRelease(mgr);
                SafeRelease(dev);
                SafeRelease(en);
            }
            List<FoxAudioApp> result = new List<FoxAudioApp>();
            foreach (KeyValuePair<int, FoxAudioApp> kv in map) result.Add(kv.Value);
            result.Sort(delegate(FoxAudioApp a, FoxAudioApp b) {
                return string.Compare(a.Display, b.Display, StringComparison.OrdinalIgnoreCase);
            });
            return result;
        }

        public static bool SetAppPct(int pid, int pct) {
            if (pct < 0) pct = 0; if (pct > 100) pct = 100;
            return TouchApp(pid, delegate(ISimpleAudioVolume vol) {
                Guid ctx = Guid.Empty;
                vol.SetMute(false, ref ctx);
                vol.SetMasterVolume(pct / 100f, ref ctx);
            });
        }

        public static bool SetAppMute(int pid, bool mute) {
            return TouchApp(pid, delegate(ISimpleAudioVolume vol) {
                Guid ctx = Guid.Empty;
                vol.SetMute(mute, ref ctx);
            });
        }

        static bool TouchApp(int pid, Action<ISimpleAudioVolume> act) {
            if (pid <= 0 || act == null) return false;
            bool any = false;
            IMMDeviceEnumerator en = null;
            IMMDevice dev = null;
            IAudioSessionManager2 mgr = null;
            IAudioSessionEnumerator sessEn = null;
            try {
                en = CreateEnumerator();
                if (en == null) return false;
                en.GetDefaultAudioEndpoint(0, 1, out dev);
                if (dev == null) return false;
                Guid iid = typeof(IAudioSessionManager2).GUID;
                object raw;
                dev.Activate(ref iid, 1, IntPtr.Zero, out raw);
                mgr = raw as IAudioSessionManager2;
                if (mgr == null) return false;
                mgr.GetSessionEnumerator(out sessEn);
                if (sessEn == null) return false;
                int count;
                sessEn.GetCount(out count);
                for (int i = 0; i < count; i++) {
                    IAudioSessionControl ctl = null;
                    IAudioSessionControl2 ctl2 = null;
                    ISimpleAudioVolume vol = null;
                    try {
                        sessEn.GetSession(i, out ctl);
                        ctl2 = Qi<IAudioSessionControl2>(ctl);
                        if (ctl2 == null) continue;
                        uint spid;
                        ctl2.GetProcessId(out spid);
                        if ((int)spid != pid) continue;
                        vol = Qi<ISimpleAudioVolume>(ctl);
                        if (vol == null) continue;
                        act(vol);
                        any = true;
                    } catch { }
                    finally {
                        SafeRelease(vol);
                        SafeRelease(ctl2);
                        SafeRelease(ctl);
                    }
                }
            } catch { }
            finally {
                SafeRelease(sessEn);
                SafeRelease(mgr);
                SafeRelease(dev);
                SafeRelease(en);
            }
            return any;
        }

        // No stable documented per-app device route on this stack — open Windows UI.
        public static void OpenSystemAppVolume() {
            try {
                Process.Start(new ProcessStartInfo {
                    FileName = "ms-settings:apps-volume",
                    UseShellExecute = true
                });
                return;
            } catch { }
            try {
                string snd = Path.Combine(Environment.SystemDirectory, "SndVol.exe");
                if (File.Exists(snd)) {
                    Process.Start(new ProcessStartInfo { FileName = snd, UseShellExecute = true });
                    return;
                }
            } catch { }
            OpenSoundSettings();
        }

        public static void OpenSoundSettings() {
            try {
                Process.Start(new ProcessStartInfo {
                    FileName = "ms-settings:sound",
                    UseShellExecute = true
                });
            } catch {
                try {
                    Process.Start(new ProcessStartInfo {
                        FileName = "control.exe",
                        Arguments = "mmsys.cpl",
                        UseShellExecute = true
                    });
                } catch { }
            }
        }

        public static bool DeviceIsActive(string id) {
            if (string.IsNullOrEmpty(id)) return false;
            IMMDeviceEnumerator en = null;
            IMMDevice dev = null;
            try {
                en = CreateEnumerator();
                if (en == null) return false;
                if (en.GetDevice(id, out dev) != 0 || dev == null) return false;
                uint state;
                dev.GetState(out state);
                return (state & 1) != 0;
            } catch { return false; }
            finally {
                SafeRelease(dev);
                SafeRelease(en);
            }
        }

        public static IMMDeviceEnumerator CreateEnumerator() {
            try { return (IMMDeviceEnumerator)new MMDeviceEnumeratorCom(); }
            catch {
                try {
                    Type t = Type.GetTypeFromCLSID(new Guid("BCDE0395-E52F-467C-8E3D-C4579291692E"));
                    return (IMMDeviceEnumerator)Activator.CreateInstance(t);
                } catch { return null; }
            }
        }

        static IAudioEndpointVolume OpenEndpoint() {
            IMMDeviceEnumerator en = null;
            IMMDevice dev = null;
            try {
                en = CreateEnumerator();
                if (en == null) return null;
                en.GetDefaultAudioEndpoint(0, 1, out dev);
                if (dev == null) return null;
                Guid iid = typeof(IAudioEndpointVolume).GUID;
                object o;
                dev.Activate(ref iid, 1, IntPtr.Zero, out o);
                return o as IAudioEndpointVolume;
            } catch { return null; }
            finally {
                SafeRelease(dev);
                SafeRelease(en);
            }
        }

        static string ProcessName(int pid) {
            try {
                using (Process p = Process.GetProcessById(pid)) {
                    if (p != null && !string.IsNullOrEmpty(p.ProcessName)) return p.ProcessName;
                }
            } catch { }
            return "pid " + pid;
        }

        static Image IconForPid(int pid) {
            try {
                using (Process p = Process.GetProcessById(pid)) {
                    string path = null;
                    try { path = p.MainModule.FileName; } catch { }
                    if (string.IsNullOrEmpty(path) || !File.Exists(path)) return null;
                    using (Icon ico = Icon.ExtractAssociatedIcon(path)) {
                        if (ico == null) return null;
                        return new Bitmap(ico.ToBitmap(), new Size(20, 20));
                    }
                }
            } catch { return null; }
        }

        static string CoStr(IntPtr p) {
            if (p == IntPtr.Zero) return "";
            try {
                string s = Marshal.PtrToStringUni(p) ?? "";
                Marshal.FreeCoTaskMem(p);
                return s;
            } catch { return ""; }
        }

        public static void SafeRelease(object o) {
            if (o == null) return;
            try { Marshal.ReleaseComObject(o); } catch { }
        }

        static T Qi<T>(object com) where T : class {
            if (com == null) return null;
            IntPtr unk = IntPtr.Zero;
            IntPtr ptr = IntPtr.Zero;
            try {
                unk = Marshal.GetIUnknownForObject(com);
                Guid iid = typeof(T).GUID;
                if (Marshal.QueryInterface(unk, ref iid, out ptr) != 0 || ptr == IntPtr.Zero)
                    return null;
                return (T)Marshal.GetObjectForIUnknown(ptr);
            } catch { return null; }
            finally {
                if (ptr != IntPtr.Zero) try { Marshal.Release(ptr); } catch { }
                if (unk != IntPtr.Zero) try { Marshal.Release(unk); } catch { }
            }
        }

        static readonly PROPERTYKEY PkeyFriendlyName = new PROPERTYKEY {
            fmtid = new Guid("A45C254E-DF1C-4EFD-8020-67D146A850E0"),
            pid = 14
        };

        [DllImport("ole32.dll")]
        static extern int PropVariantClear(ref PropVariant pvar);

        [StructLayout(LayoutKind.Sequential)]
        public struct PROPERTYKEY {
            public Guid fmtid;
            public uint pid;
        }

        [StructLayout(LayoutKind.Explicit)]
        public struct PropVariant {
            [FieldOffset(0)] public short vt;
            [FieldOffset(8)] public IntPtr ptr;
        }

        enum AudioSessionState { Inactive = 0, Active = 1, Expired = 2 }

        [ComImport]
        [Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
        public class MMDeviceEnumeratorCom { }

        [Guid("A95664D2-9614-4F35-A746-DE8DB63617E6")]
        [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        public interface IMMDeviceEnumerator {
            [PreserveSig] int EnumAudioEndpoints(int dataFlow, int dwStateMask, out IMMDeviceCollection devices);
            [PreserveSig] int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice ppDevice);
            [PreserveSig] int GetDevice([MarshalAs(UnmanagedType.LPWStr)] string id, out IMMDevice device);
            [PreserveSig] int RegisterEndpointNotificationCallback([MarshalAs(UnmanagedType.Interface)] IMMNotificationClient client);
            [PreserveSig] int UnregisterEndpointNotificationCallback([MarshalAs(UnmanagedType.Interface)] IMMNotificationClient client);
        }

        [Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E")]
        [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        public interface IMMDeviceCollection {
            [PreserveSig] int GetCount(out uint count);
            [PreserveSig] int Item(uint index, out IMMDevice device);
        }

        [Guid("D666063F-1587-4E43-81F1-B948E807363F")]
        [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        public interface IMMDevice {
            [PreserveSig] int Activate(ref Guid iid, int dwClsCtx, IntPtr pActivationParams,
                [MarshalAs(UnmanagedType.IUnknown)] out object ppInterface);
            [PreserveSig] int OpenPropertyStore(int stgmAccess, out IPropertyStore props);
            [PreserveSig] int GetId(out IntPtr ppstrId);
            [PreserveSig] int GetState(out uint pdwState);
        }

        [Guid("886d8eeb-8cf2-4446-8d02-cdba1dbdcf99")]
        [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        public interface IPropertyStore {
            [PreserveSig] int GetCount(out uint cProps);
            [PreserveSig] int GetAt(uint iProp, out PROPERTYKEY pkey);
            [PreserveSig] int GetValue(ref PROPERTYKEY key, out PropVariant pv);
            [PreserveSig] int SetValue(ref PROPERTYKEY key, ref PropVariant pv);
            [PreserveSig] int Commit();
        }

        [Guid("5CDF2C82-841E-4546-9722-0CF74078229A")]
        [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        interface IAudioEndpointVolume {
            int RegisterControlChangeNotify(IntPtr p);
            int UnregisterControlChangeNotify(IntPtr p);
            int GetChannelCount(out int n);
            int SetMasterVolumeLevel(float db, ref Guid ctx);
            int SetMasterVolumeLevelScalar(float v, ref Guid ctx);
            int GetMasterVolumeLevel(out float db);
            int GetMasterVolumeLevelScalar(out float v);
            int SetChannelVolumeLevel(uint ch, float db, ref Guid ctx);
            int SetChannelVolumeLevelScalar(uint ch, float v, ref Guid ctx);
            int GetChannelVolumeLevel(uint ch, out float db);
            int GetChannelVolumeLevelScalar(uint ch, out float v);
            int SetMute([MarshalAs(UnmanagedType.Bool)] bool mute, ref Guid ctx);
            int GetMute(out bool mute);
        }

        [Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F")]
        [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        interface IAudioSessionManager2 {
            [PreserveSig] int GetAudioSessionControl(IntPtr AudioSessionGuid, uint StreamFlags, out IAudioSessionControl SessionControl);
            [PreserveSig] int GetSimpleAudioVolume(IntPtr AudioSessionGuid, uint StreamFlags, out ISimpleAudioVolume AudioVolume);
            [PreserveSig] int GetSessionEnumerator(out IAudioSessionEnumerator SessionEnum);
            [PreserveSig] int RegisterSessionNotification(IntPtr SessionNotification);
            [PreserveSig] int UnregisterSessionNotification(IntPtr SessionNotification);
            [PreserveSig] int RegisterDuckNotification([MarshalAs(UnmanagedType.LPWStr)] string sessionID, IntPtr duckNotification);
            [PreserveSig] int UnregisterDuckNotification(IntPtr duckNotification);
        }

        [Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8")]
        [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        interface IAudioSessionEnumerator {
            [PreserveSig] int GetCount(out int SessionCount);
            [PreserveSig] int GetSession(int SessionCount, out IAudioSessionControl Session);
        }

        [Guid("F4B1A599-7266-4319-A8CA-E70ACB11E8CD")]
        [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        interface IAudioSessionControl {
            [PreserveSig] int GetState(out AudioSessionState pRetVal);
            [PreserveSig] int GetDisplayName(out IntPtr pRetVal);
            [PreserveSig] int SetDisplayName([MarshalAs(UnmanagedType.LPWStr)] string Value, ref Guid EventContext);
            [PreserveSig] int GetIconPath(out IntPtr pRetVal);
            [PreserveSig] int SetIconPath([MarshalAs(UnmanagedType.LPWStr)] string Value, ref Guid EventContext);
            [PreserveSig] int GetGroupingParam(out Guid pRetVal);
            [PreserveSig] int SetGroupingParam(ref Guid Override, ref Guid EventContext);
            [PreserveSig] int RegisterAudioSessionNotification(IntPtr NewNotifications);
            [PreserveSig] int UnregisterAudioSessionNotification(IntPtr NewNotifications);
        }

        // Full vtable: IAudioSessionControl + IAudioSessionControl2 extras.
        [Guid("bfb7ff88-7239-4fc9-8fa2-07c950be9c6d")]
        [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        interface IAudioSessionControl2 {
            [PreserveSig] int GetState(out AudioSessionState pRetVal);
            [PreserveSig] int GetDisplayName(out IntPtr pRetVal);
            [PreserveSig] int SetDisplayName([MarshalAs(UnmanagedType.LPWStr)] string Value, ref Guid EventContext);
            [PreserveSig] int GetIconPath(out IntPtr pRetVal);
            [PreserveSig] int SetIconPath([MarshalAs(UnmanagedType.LPWStr)] string Value, ref Guid EventContext);
            [PreserveSig] int GetGroupingParam(out Guid pRetVal);
            [PreserveSig] int SetGroupingParam(ref Guid Override, ref Guid EventContext);
            [PreserveSig] int RegisterAudioSessionNotification(IntPtr NewNotifications);
            [PreserveSig] int UnregisterAudioSessionNotification(IntPtr NewNotifications);
            [PreserveSig] int GetSessionIdentifier(out IntPtr pRetVal);
            [PreserveSig] int GetSessionInstanceIdentifier(out IntPtr pRetVal);
            [PreserveSig] int GetProcessId(out uint pRetVal);
            [PreserveSig] int IsSystemSoundsSession();
            [PreserveSig] int SetDuckingPreference(bool optOut);
        }

        [Guid("87CE5498-68D6-44E5-9215-6DA47EF883D8")]
        [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        interface ISimpleAudioVolume {
            [PreserveSig] int SetMasterVolume(float fLevel, ref Guid EventContext);
            [PreserveSig] int GetMasterVolume(out float pfLevel);
            [PreserveSig] int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, ref Guid EventContext);
            [PreserveSig] int GetMute(out bool pbMute);
        }

        [Guid("7991EEC9-7E89-4D85-8390-6C703CEC60C0")]
        [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        public interface IMMNotificationClient {
            void OnDeviceStateChanged([MarshalAs(UnmanagedType.LPWStr)] string deviceId, uint newState);
            void OnDeviceAdded([MarshalAs(UnmanagedType.LPWStr)] string deviceId);
            void OnDeviceRemoved([MarshalAs(UnmanagedType.LPWStr)] string deviceId);
            void OnDefaultDeviceChanged(int flow, int role, [MarshalAs(UnmanagedType.LPWStr)] string defaultDeviceId);
            void OnPropertyValueChanged([MarshalAs(UnmanagedType.LPWStr)] string deviceId, PROPERTYKEY key);
        }
    }

    // Pause only the playing media session when the user-selected output goes away.
    sealed class HeadphonesGuard : FoxAudio.IMMNotificationClient, IDisposable {
        readonly string foxosDir;
        readonly SynchronizationContext ui;
        HeadphonesFeature cfg = new HeadphonesFeature();
        FoxAudio.IMMDeviceEnumerator en;
        bool registered;
        System.Windows.Forms.Timer poll;
        DateTime pendingGoneUtc = DateTime.MinValue;
        bool pauseFired;
        string pausedApp = "";
        DateTime pausedAtUtc = DateTime.MinValue;
        DateTime deviceBackUtc = DateTime.MinValue;
        bool resumeOffered;
        bool userTookOver;
        int lastFeaturesRev;

        public bool HasResumeOffer {
            get {
                if (string.IsNullOrEmpty(pausedApp)) return false;
                if ((DateTime.UtcNow - pausedAtUtc).TotalSeconds > Math.Max(10, cfg.resumeOfferSec))
                    return false;
                return true;
            }
        }

        public HeadphonesGuard(string dir, SynchronizationContext ctx) {
            foxosDir = dir ?? FoxPaths.RuntimeDir();
            ui = ctx;
            Reload();
            en = FoxAudio.CreateEnumerator();
            poll = new System.Windows.Forms.Timer();
            poll.Interval = 400;
            poll.Tick += OnPoll;
            poll.Start();
            ApplyRegistration();
        }

        public void Reload() {
            try {
                FoxFeaturesDoc doc = FoxFeatures.Load();
                cfg = doc.headphones ?? new HeadphonesFeature();
                lastFeaturesRev = doc.revision;
            } catch {
                cfg = new HeadphonesFeature();
            }
            ApplyRegistration();
        }

        void ApplyRegistration() {
            if (en == null) return;
            bool want = cfg != null && cfg.enabled && !string.IsNullOrEmpty(cfg.deviceId);
            try {
                if (want && !registered) {
                    en.RegisterEndpointNotificationCallback(this);
                    registered = true;
                } else if (!want && registered) {
                    en.UnregisterEndpointNotificationCallback(this);
                    registered = false;
                }
            } catch { }
        }

        void OnPoll(object sender, EventArgs e) {
            try {
                FoxFeaturesDoc doc = FoxFeatures.Load();
                if (doc.revision != lastFeaturesRev) Reload();
            } catch { }

            if (cfg == null || !cfg.enabled || string.IsNullOrEmpty(cfg.deviceId)) return;

            if (pendingGoneUtc != DateTime.MinValue && !pauseFired) {
                if ((DateTime.UtcNow - pendingGoneUtc).TotalMilliseconds >= cfg.debounceMs) {
                    if (!FoxAudio.DeviceIsActive(cfg.deviceId)) TryPausePlaying();
                    pendingGoneUtc = DateTime.MinValue;
                }
            }

            if (cfg.autoResume && pauseFired && !userTookOver && HasResumeOffer) {
                if (deviceBackUtc != DateTime.MinValue &&
                    (DateTime.UtcNow - deviceBackUtc).TotalMilliseconds >= cfg.resumeStabilizeMs &&
                    FoxAudio.DeviceIsActive(cfg.deviceId)) {
                    TryResume();
                    deviceBackUtc = DateTime.MinValue;
                }
            }

            // Offer file for desk / wheel resume action
            try {
                string req = Path.Combine(foxosDir, "headphones-resume.req");
                if (HasResumeOffer && resumeOffered && !cfg.autoResume) {
                    if (!File.Exists(req)) {
                        File.WriteAllText(req, pausedApp + "\n" + DateTime.UtcNow.ToString("o"),
                            new UTF8Encoding(false));
                    }
                } else if (File.Exists(req) && !HasResumeOffer) {
                    try { File.Delete(req); } catch { }
                }
            } catch { }
        }

        void TryPausePlaying() {
            try {
                string jsonPath = Path.Combine(foxosDir, "media.json");
                if (!File.Exists(jsonPath)) return;
                string json = File.ReadAllText(jsonPath, Encoding.UTF8);
                if (!GrabBool(json, "active")) return;
                string status = Grab(json, "status");
                if (!status.Equals("Playing", StringComparison.OrdinalIgnoreCase)) return;
                WriteMediaCmd("pause");
                pauseFired = true;
                pausedApp = Grab(json, "app");
                pausedAtUtc = DateTime.UtcNow;
                resumeOffered = false;
                userTookOver = false;
                try { FoxToast.Show("FOX · пауза (навушники відʼєднано)"); } catch { }
            } catch { }
        }

        public void TryResume() {
            if (!HasResumeOffer) return;
            WriteMediaCmd("play");
            ClearPauseState();
            try { FoxToast.Show("FOX · продовжено"); } catch { }
        }

        public void DismissResume() { ClearPauseState(); }

        void ClearPauseState() {
            pausedApp = "";
            pausedAtUtc = DateTime.MinValue;
            pauseFired = false;
            resumeOffered = false;
            deviceBackUtc = DateTime.MinValue;
            try {
                string req = Path.Combine(foxosDir, "headphones-resume.req");
                if (File.Exists(req)) File.Delete(req);
            } catch { }
        }

        public void MarkUserMediaControl() {
            if (pauseFired) userTookOver = true;
        }

        void WriteMediaCmd(string cmd) {
            try {
                File.AppendAllText(Path.Combine(foxosDir, "media-cmd.txt"),
                    cmd + Environment.NewLine, Encoding.UTF8);
            } catch { }
        }

        static string Grab(string json, string key) {
            Match m = Regex.Match(json, "\"" + key + "\"\\s*:\\s*\"([^\"]*)\"");
            return m.Success ? m.Groups[1].Value : "";
        }
        static bool GrabBool(string json, string key) {
            Match m = Regex.Match(json, "\"" + key + "\"\\s*:\\s*(true|false)", RegexOptions.IgnoreCase);
            return m.Success && m.Groups[1].Value.Equals("true", StringComparison.OrdinalIgnoreCase);
        }

        public void OnDeviceStateChanged(string deviceId, uint newState) {
            if (cfg == null || !cfg.enabled) return;
            if (string.IsNullOrEmpty(cfg.deviceId)) return;
            if (!string.Equals(deviceId, cfg.deviceId, StringComparison.OrdinalIgnoreCase)) return;
            Queue(delegate {
                bool active = (newState & 1) != 0;
                if (!active) {
                    pendingGoneUtc = DateTime.UtcNow;
                    deviceBackUtc = DateTime.MinValue;
                } else {
                    pendingGoneUtc = DateTime.MinValue;
                    if (pauseFired && HasResumeOffer) {
                        deviceBackUtc = DateTime.UtcNow;
                        if (!cfg.autoResume && !resumeOffered) {
                            resumeOffered = true;
                            try { FoxToast.Show("FOX · навушники назад — можна продовжити"); } catch { }
                        }
                    }
                }
            });
        }

        public void OnDeviceAdded(string deviceId) { }
        public void OnDeviceRemoved(string deviceId) {
            OnDeviceStateChanged(deviceId, 4);
        }
        public void OnDefaultDeviceChanged(int flow, int role, string defaultDeviceId) {
            if (cfg == null || !cfg.enabled || string.IsNullOrEmpty(cfg.deviceId)) return;
            Queue(delegate {
                if (!FoxAudio.DeviceIsActive(cfg.deviceId) && !pauseFired)
                    pendingGoneUtc = DateTime.UtcNow;
            });
        }
        public void OnPropertyValueChanged(string deviceId, FoxAudio.PROPERTYKEY key) { }

        void Queue(Action a) {
            try {
                if (ui != null) ui.Post(delegate { try { a(); } catch { } }, null);
                else a();
            } catch { try { a(); } catch { } }
        }

        public void Dispose() {
            try { if (poll != null) { poll.Stop(); poll.Dispose(); } } catch { }
            try {
                if (registered && en != null)
                    en.UnregisterEndpointNotificationCallback(this);
            } catch { }
            registered = false;
            FoxAudio.SafeRelease(en);
            en = null;
        }
    }
}
