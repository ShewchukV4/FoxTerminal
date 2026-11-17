using System;
using System.Windows.Forms;

namespace FoxOs.Nodes {

    // Hidden message pump surface for global hotkeys.
    sealed class HotkeyHost : Form {
        public event Action HotkeyPressed;
        public event Action<int> AnyHotkey;
        public string LastHotkeyError = "";

        HotkeySpec bound;

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



        public void Unregister() {
            try { NativeWin.UnregisterHotKey(Handle, NativeWin.HOTKEY_ID); } catch { }
        }

        protected override void WndProc(ref Message m) {
            if (m.Msg == NativeWin.WM_HOTKEY) {
                int id = m.WParam.ToInt32();
                if (AnyHotkey != null) AnyHotkey(id);
                if (id == NativeWin.HOTKEY_ID) {
                    if (HotkeyPressed != null) HotkeyPressed();
                    return;
                }

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
