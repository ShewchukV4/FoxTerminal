using System;
using System.Windows.Forms;

namespace FoxOs.Nodes {

    // Hidden message pump surface for global hotkeys.
    sealed class HotkeyHost : Form {
        public event Action HotkeyPressed;
        public event Action PttPressed;
        public string LastHotkeyError = "";

        HotkeySpec bound;
        HotkeySpec pttBound;

        public HotkeyHost() {
            Text = "FoxNodes Hotkey Host";
            ShowInTaskbar = false;
            FormBorderStyle = FormBorderStyle.None;
            Size = new System.Drawing.Size(0, 0);
            StartPosition = FormStartPosition.Manual;
            Location = new System.Drawing.Point(-32000, -32000);
            Opacity = 0;
        }

        public bool ApplyHotkey(HotkeySpec hk) {
            Unregister();
            bound = hk;
            uint mod = NativeWin.ModifiersFromHotkey(hk);
            uint vk = NativeWin.VkFromHotkey(hk);
            if (vk == 0) {
                LastHotkeyError = "Невідома клавіша";
                return false;
            }
            if (!NativeWin.RegisterHotKey(Handle, NativeWin.HOTKEY_ID, mod, vk)) {
                LastHotkeyError = "Комбінація зайнята: " + NativeWin.HotkeyLabel(hk);
                return false;
            }
            LastHotkeyError = "";
            return true;
        }

        public bool ApplyPttHotkey(HotkeySpec hk) {
            try { NativeWin.UnregisterHotKey(Handle, NativeWin.HOTKEY_PTT); } catch { }
            pttBound = hk;
            if (hk == null) return true;
            uint mod = NativeWin.ModifiersFromHotkey(hk);
            uint vk = NativeWin.VkFromHotkey(hk);
            if (vk == 0) return false;
            return NativeWin.RegisterHotKey(Handle, NativeWin.HOTKEY_PTT, mod, vk);
        }

        public void Unregister() {
            try { NativeWin.UnregisterHotKey(Handle, NativeWin.HOTKEY_ID); } catch { }
            try { NativeWin.UnregisterHotKey(Handle, NativeWin.HOTKEY_PTT); } catch { }
        }

        protected override void WndProc(ref Message m) {
            if (m.Msg == NativeWin.WM_HOTKEY && m.WParam.ToInt32() == NativeWin.HOTKEY_ID) {
                if (HotkeyPressed != null) HotkeyPressed();
                return;
            }
            if (m.Msg == NativeWin.WM_HOTKEY && m.WParam.ToInt32() == NativeWin.HOTKEY_PTT) {
                if (PttPressed != null) PttPressed();
                return;
            }
            base.WndProc(ref m);
        }

        protected override void OnFormClosed(FormClosedEventArgs e) {
            Unregister();
            base.OnFormClosed(e);
        }
    }
}
