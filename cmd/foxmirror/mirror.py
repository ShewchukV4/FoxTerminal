"""
foxmirror - live view of an iPhone/iPad screen on Windows, over USB or Wi-Fi.

Two modes, picked automatically:

  video  (iOS 27+)  the CoreDevice display service streams HEVC video (the same
                    path Xcode's iPhone mirror uses); pymobiledevice3 serves it
                    on localhost and a Chromium app window decodes it. ~30-40 fps.
                    Audio decode (AAC-ELD) needs AudioToolbox, so sound is macOS-only.
  photo  (any iOS)  screenshots through the developer "instruments" service,
                    a few frames per second, shown in a Tk window.

Two transports, picked automatically: USB when the cable is in, otherwise Wi-Fi
(RemotePairing over Bonjour, iOS 17+; the pairing record is created silently
through the cable on first run, or via Settings > Developer > Paired Macs).

No kernel drivers, no admin: on iOS 17.4+ the tunnel is a pure userspace one,
on iOS < 17 the plain lockdown DVT service is used. Python 3.13+ (TLS-PSK).

Everything that can be done from the host is done automatically:
    * pairing (the phone only needs one "Trust" tap on first run)
    * Developer Mode enable (fully automatic when the phone has no passcode;
      otherwise the toggle is revealed and the script waits for it)
    * Developer Disk Image / personalized image mount
    * Wi-Fi: "Wi-Fi connections" flag + RemotePairing record, both over USB

Keys inside the window:
    Esc / q   quit
    f         toggle fullscreen
    s         save current frame to ~/Pictures/FoxMirror
    space     pause / resume
"""

from __future__ import annotations

import argparse
import asyncio
import contextlib
import io
import os
import queue
import sys
import threading
import time
import traceback
from datetime import datetime
from pathlib import Path
from typing import Optional

# --------------------------------------------------------------------------
# Console helpers
# --------------------------------------------------------------------------

def _supports_color() -> bool:
    return sys.stdout.isatty() and os.environ.get("TERM") != "dumb"


_COLOR = _supports_color()


def _c(code: str, text: str) -> str:
    return f"\x1b[{code}m{text}\x1b[0m" if _COLOR else text


def info(msg: str) -> None:
    print(_c("36", "  ->") + " " + msg, flush=True)


def ok(msg: str) -> None:
    print(_c("32", "  ok") + " " + msg, flush=True)


def warn(msg: str) -> None:
    print(_c("33", "  !!") + " " + msg, flush=True)


def fail(msg: str) -> None:
    print(_c("31", "  xx") + " " + msg, flush=True)


# --------------------------------------------------------------------------
# Device bring-up (pairing / developer mode / DDI)
# --------------------------------------------------------------------------

class SetupError(Exception):
    """Raised when the device cannot be brought to a usable state (transient: worth retrying on Wi-Fi)."""


class FatalSetupError(SetupError):
    """Needs the user to do something (pair, plug in, update iOS) - retrying will not help."""


async def _wait_for_device(udid: Optional[str], timeout: float = 600.0):
    """Block until usbmuxd reports a USB device (optionally a specific one)."""
    from pymobiledevice3.exceptions import ConnectionFailedToUsbmuxdError, MuxException
    from pymobiledevice3.usbmux import list_devices

    deadline = time.monotonic() + timeout
    announced = False
    while time.monotonic() < deadline:
        try:
            devices = await list_devices()
        except (ConnectionFailedToUsbmuxdError, MuxException, ConnectionRefusedError, OSError) as e:
            raise SetupError(
                "Cannot reach usbmuxd (Apple Mobile Device Service). "
                "Install Apple Mobile Device Support (iTunes / Apple Devices) and make sure the "
                "'Apple Mobile Device Service' Windows service is running."
            ) from e
        usb = [d for d in devices if getattr(d, "connection_type", "USB") == "USB"]
        if udid:
            usb = [d for d in usb if d.serial == udid]
        if usb:
            return usb[0]
        if not announced:
            info("waiting for an iPhone/iPad on USB (unlock it and plug it in)...")
            announced = True
        await asyncio.sleep(1.5)
    raise SetupError("no USB device appeared")


async def _connect_lockdown(udid: Optional[str]):
    """Create a lockdown client, driving the pairing dialog if needed."""
    from pymobiledevice3.exceptions import (
        PairingDialogResponsePendingError,
        PasswordRequiredError,
        UserDeniedPairingError,
        NotTrustedError,
        DeviceNotFoundError,
        NoDeviceConnectedError,
    )
    from pymobiledevice3.lockdown import create_using_usbmux

    told_trust = False
    told_unlock = False
    while True:
        try:
            return await create_using_usbmux(serial=udid, autopair=True, pair_timeout=20)
        except PairingDialogResponsePendingError:
            if not told_trust:
                warn("tap 'Trust' on the phone (and enter its passcode)...")
                told_trust = True
            await asyncio.sleep(1)
        except PasswordRequiredError:
            if not told_unlock:
                warn("unlock the phone screen, then it will pair automatically...")
                told_unlock = True
            await asyncio.sleep(2)
        except UserDeniedPairingError:
            raise SetupError("pairing was denied on the phone ('Don't Trust'). Unplug, replug and tap 'Trust'.")
        except NotTrustedError:
            warn("phone not trusted yet, retrying...")
            await asyncio.sleep(2)
        except (DeviceNotFoundError, NoDeviceConnectedError):
            await _wait_for_device(udid)


async def _ensure_developer_mode(lockdown) -> None:
    """iOS 16+: make sure Developer Mode is on. Fully automatic without passcode."""
    from packaging.version import Version
    from pymobiledevice3.exceptions import DeviceHasPasscodeSetError, PyMobileDevice3Exception
    from pymobiledevice3.services.amfi import AmfiService

    if Version(lockdown.product_version) < Version("16.0"):
        return
    try:
        if await lockdown.get_developer_mode_status():
            ok("Developer Mode is enabled")
            return
    except PyMobileDevice3Exception:
        # very old 16.x may not expose the key; try to enable anyway
        pass

    info("Developer Mode is off - enabling it (the phone will reboot once)...")
    amfi = AmfiService(lockdown)
    try:
        await amfi.enable_developer_mode(enable_post_restart=True)
        ok("Developer Mode enabled")
        return
    except DeviceHasPasscodeSetError:
        try:
            await amfi.reveal_developer_mode_option_in_ui()
        except PyMobileDevice3Exception:
            pass
        warn("the phone has a passcode, so Apple only allows enabling Developer Mode on the phone itself:")
        warn("   Settings -> Privacy & Security -> Developer Mode -> ON  (phone reboots, confirm 'Turn On')")
        warn("waiting for that to happen...")
    except PyMobileDevice3Exception as e:
        warn(f"automatic enable failed ({e}); enable it in Settings -> Privacy & Security -> Developer Mode")

    # Poll until it is enabled (device will disappear/reappear during reboot)
    from pymobiledevice3.lockdown import create_using_usbmux

    while True:
        await asyncio.sleep(3)
        try:
            ld = await create_using_usbmux(serial=lockdown.udid, autopair=True, pair_timeout=5)
        except Exception:
            continue
        try:
            if await ld.get_developer_mode_status():
                ok("Developer Mode enabled")
                return
        except Exception:
            continue


async def _ensure_image_mounted(lockdown) -> None:
    """Mount the developer / personalized image if none is mounted yet."""
    from packaging.version import Version
    from pymobiledevice3.exceptions import AlreadyMountedError, PyMobileDevice3Exception
    from pymobiledevice3.services.mobile_image_mounter import MobileImageMounterService, auto_mount

    image_type = "Personalized" if Version(lockdown.product_version) >= Version("17.0") else "Developer"
    mounter = MobileImageMounterService(lockdown=lockdown)
    try:
        if await mounter.is_image_mounted(image_type):
            ok(f"{image_type} developer image already mounted")
            return
    except PyMobileDevice3Exception:
        pass

    info(f"mounting {image_type} developer image (first time downloads it from Apple/GitHub)...")

    # The download inside auto_mount is a blocking urllib call with no timeout, so run the
    # CLI in a child process where we can enforce one and retry on a stalled network.
    for attempt in range(1, 4):
        proc = await asyncio.create_subprocess_exec(
            sys.executable, "-m", "pymobiledevice3", "mounter", "auto-mount", "--udid", lockdown.udid,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT,
        )
        try:
            out, _ = await asyncio.wait_for(proc.communicate(), timeout=240)
        except asyncio.TimeoutError:
            proc.kill()
            await proc.wait()
            warn(f"mount attempt {attempt} stalled, retrying...")
            continue
        text = out.decode("utf-8", "replace")
        if proc.returncode == 0 and ("mounted successfully" in text or "already mounted" in text):
            ok("developer image mounted")
            return
        if await mounter.is_image_mounted(image_type):
            ok("developer image mounted")
            return
        tail = text.strip().splitlines()[-1] if text.strip() else f"exit code {proc.returncode}"
        warn(f"mount attempt {attempt} failed: {tail}")
        await asyncio.sleep(3)

    # last resort: in-process
    try:
        await auto_mount(lockdown)
        ok("developer image mounted")
    except AlreadyMountedError:
        ok("developer image already mounted")


# --------------------------------------------------------------------------
# Transport: USB (usbmuxd) or Wi-Fi (RemotePairing over bonjour, iOS 27+ pairing)
# --------------------------------------------------------------------------

class Link:
    """Where the phone is and how to reach it."""

    def __init__(self, transport: str, udid: str, ip: Optional[str] = None):
        self.transport = transport  # "usb" | "wifi"
        self.udid = udid
        self.ip = ip

    def __str__(self) -> str:
        return f"{self.transport}{' ' + self.ip if self.ip else ''}"


def _remote_paired_udids() -> list[str]:
    from pymobiledevice3.pair_records import iter_remote_paired_identifiers

    return list(iter_remote_paired_identifiers())


async def _wifi_phone_ips(udid: Optional[str], timeout: float = 4.0) -> list[str]:
    """IPs where lockdownd answers over Wi-Fi (needs `wifi-connections on`, done by --setup)."""
    from pymobiledevice3.bonjour import browse_mobdev2

    ips: list[str] = []
    for ans in await browse_mobdev2(timeout=timeout):
        for addr in ans.addresses:
            ip = addr.full_ip if hasattr(addr, "full_ip") else str(addr)
            if ":" in ip or ip in ips:
                continue  # IPv4 only: link-local v6 needs scope ids on Windows
            ips.append(ip)
    return ips


async def _wifi_remotepairing_present(udid: str, timeout: float = 4.0) -> bool:
    from pymobiledevice3.bonjour import browse_remotepairing

    answers = await browse_remotepairing(timeout=timeout)
    return len(answers) > 0


async def discover_link(prefer: str, udid: Optional[str], wait_timeout: float = 600.0) -> Link:
    """prefer = "auto" | "usb" | "wifi"."""
    from pymobiledevice3.exceptions import ConnectionFailedToUsbmuxdError, MuxException
    from pymobiledevice3.usbmux import list_devices

    usb: list = []
    if prefer in ("auto", "usb"):
        try:
            usb = [d for d in await list_devices() if getattr(d, "connection_type", "USB") == "USB"]
        except (ConnectionFailedToUsbmuxdError, MuxException, ConnectionRefusedError, OSError):
            if prefer == "usb":
                raise SetupError(
                    "Cannot reach usbmuxd (Apple Mobile Device Service). Install Apple Mobile Device Support "
                    "and make sure the 'Apple Mobile Device Service' Windows service is running."
                )
        if udid:
            usb = [d for d in usb if d.serial == udid]
        if usb:
            return Link("usb", usb[0].serial)
        if prefer == "usb":
            dev = await _wait_for_device(udid, timeout=wait_timeout)
            return Link("usb", dev.serial)

    # Wi-Fi: needs a RemotePairing record made once over `foxmirror --pair-wifi` (iOS 27+)
    paired = _remote_paired_udids()
    if udid:
        paired = [u for u in paired if u == udid]
    if not paired:
        if prefer == "wifi":
            raise FatalSetupError(
                "no Wi-Fi pairing yet. Plug the cable in once and run `foxmirror -PairWifi` "
                "(needs iOS 27+; you type a 6-digit code on the phone)."
            )
        info("no USB phone and no Wi-Fi pairing - waiting for a cable...")
        dev = await _wait_for_device(udid, timeout=wait_timeout)
        return Link("usb", dev.serial)

    target = paired[0]
    info(f"no USB phone; looking for {target} over Wi-Fi...")
    ips = await _wifi_phone_ips(target)
    if not await _wifi_remotepairing_present(target):
        raise SetupError(
            "phone not found over Wi-Fi. Same Wi-Fi network as this PC? Screen unlocked at least once "
            "since boot? Developer Mode still on?"
        )
    return Link("wifi", target, ips[0] if ips else None)


def install_wifi_tunnel_provider(udid: str) -> None:
    """Make UserspaceRsdTunnel dial the phone over Wi-Fi (RemotePairing/bonjour) instead of usbmuxd.

    The stock provider only knows usbmuxd + CoreDeviceProxy; iOS refuses CoreDeviceProxy over a
    Wi-Fi lockdown connection, so the RemotePairing tunnel is the only cable-free path.
    """
    from pymobiledevice3.remote import tunnel_service
    from pymobiledevice3.remote import userspace_tunnel as ut

    async def _wifi_provider(serial, autopair, remotepairing_fallback=True):
        services = []
        for attempt in range(4):  # mDNS discovery on Windows is a little flaky; ask a few times
            services = await tunnel_service.get_remote_pairing_tunnel_services(udid=udid)
            if services:
                break
            await asyncio.sleep(1.0)
        if not services:
            raise SetupError("Wi-Fi tunnel: the phone did not answer the RemotePairing handshake")
        return services[0], None

    ut._create_no_root_tunnel_provider = _wifi_provider


async def connect_lockdown_for(link: Link):
    """Lockdown client over the link; None when the phone is Wi-Fi-only and lockdown is unreachable."""
    if link.transport == "usb":
        return await _connect_lockdown(link.udid)
    from pymobiledevice3.lockdown import create_using_tcp
    from pymobiledevice3.pair_records import create_pairing_records_cache_folder, get_preferred_pair_record

    record = await get_preferred_pair_record(link.udid, create_pairing_records_cache_folder())
    ips = [link.ip] if link.ip else await _wifi_phone_ips(link.udid)
    for ip in ips:
        try:
            ld = await create_using_tcp(ip, identifier=link.udid, autopair=False, pair_record=record)
        except Exception:
            continue
        if ld.udid == link.udid and ld.paired:
            link.ip = ip
            return ld
        await ld.close()
    return None


async def open_rsd_tunnel(link: Link):
    """Async context manager yielding an RSD for developer services over the link (iOS 17+)."""
    from pymobiledevice3.remote.userspace_tunnel import UserspaceRsdTunnel

    if link.transport == "wifi":
        install_wifi_tunnel_provider(link.udid)
    return UserspaceRsdTunnel(serial=link.udid)


# --------------------------------------------------------------------------
# Frame source
# --------------------------------------------------------------------------

class FrameSource:
    """Runs the asyncio side in a worker thread and pushes PNG frames into a queue."""

    def __init__(self, udid: Optional[str], fps: float, frames: "queue.Queue[bytes]", status_cb,
                 transport: str = "auto"):
        self.udid = udid
        self.transport = transport
        self.link: Optional[Link] = None
        self.min_interval = 1.0 / max(0.5, fps)
        self.frames = frames
        self.status = status_cb
        self.stop_event = threading.Event()
        self.pause_event = threading.Event()
        self.device_name = "iPhone"
        self.ios_version = ""
        self.thread = threading.Thread(target=self._thread_main, name="foxmirror-grabber", daemon=True)

    def start(self) -> None:
        self.thread.start()

    def stop(self) -> None:
        self.stop_event.set()

    def _thread_main(self) -> None:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(self._run())
        except Exception as e:  # pragma: no cover - surfaced in UI
            self.status(f"error: {e}")
            traceback.print_exc()
        finally:
            loop.close()

    async def _run(self) -> None:
        from pymobiledevice3.exceptions import PyMobileDevice3Exception

        while not self.stop_event.is_set():
            try:
                await self._session()
            except SetupError as e:
                wifi = self.transport == "wifi" or (self.link is not None and self.link.transport == "wifi")
                if wifi and not isinstance(e, FatalSetupError) and not self.stop_event.is_set():
                    warn(f"{e} - retrying in 5 s")
                    self.status(f"{e} - retrying...")
                    await asyncio.sleep(5)
                    continue
                fail(str(e))
                self.status(str(e))
                return
            except (PyMobileDevice3Exception, ConnectionError, OSError, asyncio.IncompleteReadError) as e:
                if self.stop_event.is_set():
                    return
                warn(f"connection lost ({type(e).__name__}: {e}); reconnecting...")
                self.status("device disconnected - reconnecting...")
                await asyncio.sleep(2)

    async def _session(self) -> None:
        from packaging.version import Version
        from pymobiledevice3.services.dvt.instruments.dvt_provider import DvtProvider
        from pymobiledevice3.services.dvt.instruments.screenshot import Screenshot

        self.status("looking for device...")
        link = await discover_link(self.transport, self.udid)
        self.link = link
        self.udid = link.udid
        self.status(f"connecting over {link}...")
        lockdown = await connect_lockdown_for(link)
        if lockdown is not None:
            self.device_name = lockdown.display_name or "iPhone"
            self.ios_version = lockdown.product_version
            ok(f"connected to {self.device_name} over {link} (iOS {self.ios_version}, {self.udid})")

            self.status("checking Developer Mode...")
            await _ensure_developer_mode(lockdown)
            if link.transport == "usb":
                lockdown = await _connect_lockdown(self.udid)  # the device may have rebooted
            self.status("mounting developer image...")
            await _ensure_image_mounted(lockdown)
            if link.transport == "usb" and self.udid not in _remote_paired_udids():
                try:
                    if await _pair_wifi_over_usb(lockdown):
                        ok("Wi-Fi pairing created through the cable - next time the cable is optional")
                except Exception as e:
                    warn(f"Wi-Fi pairing over USB skipped: {e}")
        else:
            warn("Wi-Fi: lockdown not reachable, skipping Developer Mode / image checks (done earlier over USB)")
            self.device_name = "iPhone"
            self.ios_version = self.ios_version or "27.0"

        if lockdown is None or Version(self.ios_version) >= Version("17.0"):
            self.status(f"opening userspace tunnel over {link.transport}...")
            info(f"opening userspace tunnel over {link.transport}...")
            tunnel = await open_rsd_tunnel(link)
            async with tunnel as rsd:
                if not self.ios_version or self.ios_version == "27.0":
                    self.ios_version = getattr(rsd, "product_version", None) or self.ios_version
                await self._stream(rsd)
        else:
            await self._stream(lockdown)

    async def _stream(self, provider) -> None:
        from pymobiledevice3.services.dvt.instruments.dvt_provider import DvtProvider
        from pymobiledevice3.services.dvt.instruments.screenshot import Screenshot

        async with DvtProvider(provider) as dvt, Screenshot(dvt) as shot:
            ok("streaming - close the window or press Esc to stop")
            self.status("")
            while not self.stop_event.is_set():
                if self.pause_event.is_set():
                    await asyncio.sleep(0.1)
                    continue
                t0 = time.monotonic()
                png = await shot.get_screenshot()
                # keep only the freshest frame
                try:
                    while True:
                        self.frames.get_nowait()
                except queue.Empty:
                    pass
                self.frames.put(png)
                elapsed = time.monotonic() - t0
                if elapsed < self.min_interval:
                    await asyncio.sleep(self.min_interval - elapsed)


# --------------------------------------------------------------------------
# Tk viewer
# --------------------------------------------------------------------------

def run_viewer(args: argparse.Namespace) -> int:
    import tkinter as tk

    from PIL import Image, ImageTk

    frames: "queue.Queue[bytes]" = queue.Queue(maxsize=3)
    status_text = {"msg": "starting..."}

    def set_status(msg: str) -> None:
        status_text["msg"] = msg

    root = tk.Tk()
    root.title("FoxMirror")
    root.configure(bg="#07080c")
    root.geometry(f"{args.width}x{int(args.width * 2.16)}")
    root.minsize(180, 320)
    try:
        root.tk.call("tk", "scaling", 1.15)
    except tk.TclError:
        pass

    canvas = tk.Canvas(root, bg="#07080c", highlightthickness=0, bd=0)
    canvas.pack(fill="both", expand=True)
    status_id = canvas.create_text(
        16, 16, anchor="nw", fill="#8b93a7", font=("Segoe UI", 9), text="",
    )
    image_id = canvas.create_image(0, 0, anchor="nw")

    source = FrameSource(args.udid, args.fps, frames, set_status, transport=args.transport)
    source.start()

    state = {
        "last_png": None,
        "photo": None,
        "fullscreen": False,
        "frame_times": [],
        "size": (0, 0),
    }

    # Decoding a ~2 MB PNG and resizing it takes longer than a frame interval, so it runs in
    # its own thread (PIL releases the GIL in its C code). The Tk thread only wraps the result.
    ready: "queue.Queue[tuple]" = queue.Queue(maxsize=1)
    rerender = threading.Event()

    def decode_worker() -> None:
        last_png: Optional[bytes] = None
        while not source.stop_event.is_set():
            png: Optional[bytes] = None
            try:
                png = frames.get(timeout=0.1)
                # keep only the freshest frame
                try:
                    while True:
                        png = frames.get_nowait()
                except queue.Empty:
                    pass
            except queue.Empty:
                if not rerender.is_set() or last_png is None:
                    continue
            rerender.clear()
            if png is not None:
                last_png = png
                state["last_png"] = png
            if last_png is None:
                continue
            w, h = state["size"]
            if w < 2 or h < 2:
                continue
            try:
                img = Image.open(io.BytesIO(last_png))
                img.load()
                scale = min(w / img.width, h / img.height)
                tw, th = max(1, int(img.width * scale)), max(1, int(img.height * scale))
                img = img.resize((tw, th), Image.BILINEAR, reducing_gap=2.0)
            except Exception as e:  # corrupt frame: skip it
                warn(f"frame decode failed: {e}")
                continue
            try:
                ready.get_nowait()
            except queue.Empty:
                pass
            ready.put((img, tw, th, png is not None))

    threading.Thread(target=decode_worker, name="foxmirror-decoder", daemon=True).start()

    def present(img, tw: int, th: int) -> None:
        w = max(1, canvas.winfo_width())
        h = max(1, canvas.winfo_height())
        photo = ImageTk.PhotoImage(img)
        state["photo"] = photo  # keep a reference
        canvas.itemconfigure(image_id, image=photo)
        canvas.coords(image_id, (w - tw) // 2, (h - th) // 2)

    def update_title() -> None:
        times = state["frame_times"]
        now = time.monotonic()
        state["frame_times"] = [t for t in times if now - t < 3.0]
        fps = len(state["frame_times"]) / 3.0
        paused = " [paused]" if source.pause_event.is_set() else ""
        ver = f" iOS {source.ios_version}" if source.ios_version else ""
        root.title(f"foxmirror - {source.device_name}{ver} - {fps:.1f} fps{paused}")

    def tick() -> None:
        try:
            img, tw, th, is_new = ready.get_nowait()
        except queue.Empty:
            pass
        else:
            if is_new:
                state["frame_times"].append(time.monotonic())
            present(img, tw, th)
        msg = status_text["msg"]
        canvas.itemconfigure(status_id, text=msg)
        canvas.tag_raise(status_id)
        update_title()
        if not source.thread.is_alive() and state["last_png"] is None and not msg:
            set_status("grabber stopped")
        root.after(30, tick)

    def on_resize(_event=None) -> None:
        size = (canvas.winfo_width(), canvas.winfo_height())
        if size != state["size"]:
            state["size"] = size
            rerender.set()

    def toggle_fullscreen(_event=None) -> None:
        state["fullscreen"] = not state["fullscreen"]
        root.attributes("-fullscreen", state["fullscreen"])

    def save_frame(_event=None) -> None:
        png = state["last_png"]
        if png is None:
            return
        out_dir = Path(args.out) if args.out else Path.home() / "Pictures" / "FoxMirror"
        out_dir.mkdir(parents=True, exist_ok=True)
        path = out_dir / f"iphone-{datetime.now():%Y%m%d-%H%M%S}.png"
        path.write_bytes(png)
        set_status(f"saved {path}")
        root.after(2500, lambda: set_status("") if status_text["msg"].startswith("saved") else None)
        ok(f"saved {path}")

    def toggle_pause(_event=None) -> None:
        if source.pause_event.is_set():
            source.pause_event.clear()
        else:
            source.pause_event.set()

    def quit_app(_event=None) -> None:
        source.stop()
        root.destroy()

    root.bind("<Escape>", quit_app)
    root.bind("q", quit_app)
    root.bind("f", toggle_fullscreen)
    root.bind("<F11>", toggle_fullscreen)
    root.bind("s", save_frame)
    root.bind("<space>", toggle_pause)
    root.protocol("WM_DELETE_WINDOW", quit_app)
    canvas.bind("<Configure>", on_resize)

    root.after(30, tick)
    root.mainloop()
    source.stop()
    return 0


# --------------------------------------------------------------------------
# Video mode (iOS 27+): HEVC stream via CoreDevice display service -> browser
# --------------------------------------------------------------------------

VIDEO_MIN_IOS = "27.0"  # the device answers "Remote control requires iOS 27.0 or later" below this


def _find_chromium() -> Optional[str]:
    """WebCodecs + HEVC works in Chromium browsers on Windows; Firefox/Zen do not decode HEVC there."""
    pf = os.environ.get("ProgramFiles", r"C:\Program Files")
    pf86 = os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)")
    local = os.environ.get("LOCALAPPDATA", "")
    for c in (
        os.path.join(pf, "Google", "Chrome", "Application", "chrome.exe"),
        os.path.join(local, "Google", "Chrome", "Application", "chrome.exe"),
        os.path.join(pf86, "Microsoft", "Edge", "Application", "msedge.exe"),
        os.path.join(pf, "Microsoft", "Edge", "Application", "msedge.exe"),
        os.path.join(pf, "BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
    ):
        if os.path.isfile(c):
            return c
    return None



def _install_fox_skin(ss) -> None:
    """Replace pymobiledevice3's control-panel viewer with the scrcpy-style FoxMirror skin.

    Also rewrite fitCanvasToViewport so the picture fills the window instead of
    reserving ~280 px for the old side trays.
    """
    skin = Path(__file__).resolve().parent
    html = skin / "viewer.html"
    css = skin / "viewer.css"
    if not html.is_file() or not css.is_file():
        return
    ss.VIEWER_HTML = html.read_bytes()
    ss.VIEWER_CSS = css.read_bytes()
    js = ss.VIEWER_JS_TEMPLATE
    js = js.replace(
        b"    const reservedW = trayW('left-tray') + trayW('right-tray') + sideButtonsW + frameSlack + 40;\n"
        b"    const availW = Math.max(100, window.innerWidth - reservedW);\n"
        b"    const availH = Math.max(100, window.innerHeight - 120 - frameSlack);",
        b"    const reservedW = 0;\n"
        b"    const availW = Math.max(100, window.innerWidth);\n"
        b"    const availH = Math.max(100, window.innerHeight);",
    )
    ss.VIEWER_JS_TEMPLATE = js

    orig_send = ss.ScreenStreamServer._send_static

    @staticmethod
    def _send_static(writer, body: bytes, content_type: bytes) -> None:
        writer.write(
            b"HTTP/1.1 200 OK\r\n"
            b"Content-Type: " + content_type + b"\r\n"
            b"Content-Length: " + str(len(body)).encode() + b"\r\n"
            b"Cache-Control: no-store\r\n"
            b"Connection: close\r\n\r\n" + body
        )

    ss.ScreenStreamServer._send_static = _send_static
    _ = orig_send


def _open_viewer_window(url: str):
    """Chromium app-mode window for the stream (own profile so we get a process we can wait on)."""
    import subprocess

    browser = _find_chromium()
    if not browser:
        import webbrowser

        warn("no Chrome/Edge found; opening the default browser (needs HEVC WebCodecs support)")
        webbrowser.open(url)
        return None
    profile = Path(os.environ.get("LOCALAPPDATA", str(Path.home()))) / "FoxMirror" / "viewer-profile"
    profile.mkdir(parents=True, exist_ok=True)
    # drop Chromium's cache so a new skin is not stuck behind the previous page
    with contextlib.suppress(Exception):
        for junk in ("Cache", "Code Cache", "GPUCache"):
            p = profile / junk
            if p.is_dir():
                import shutil
                shutil.rmtree(p, ignore_errors=True)
    proc = subprocess.Popen([
        browser, f"--app={url}", f"--user-data-dir={profile}", "--no-first-run", "--no-default-browser-check",
        "--window-size=390,844", "--autoplay-policy=no-user-gesture-required",
        "--force-dark-mode",
    ])
    info("viewer window opened (Chromium app mode) - close it to stop")
    return proc


async def _video_session(args: argparse.Namespace, link: Link) -> int:
    """Open the tunnel over the link, run ScreenStreamServer in-process, show it in a browser window."""
    from pymobiledevice3.remote.core_device import screen_stream as _ss
    from pymobiledevice3.remote.core_device.screen_stream import ScreenStreamServer

    _install_fox_skin(_ss)

    url = f"http://127.0.0.1:{args.port}/?v=4"
    info(f"opening tunnel over {link.transport} for the HEVC stream...")
    tunnel = await open_rsd_tunnel(link)
    async with tunnel as rsd:
        # pymobiledevice3 decodes the phone's AAC-ELD audio with AudioToolbox, i.e. macOS only;
        # on Windows the audio thread just dies with a traceback, so keep it off here.
        audio = (not args.no_audio) and sys.platform == "darwin"
        server = ScreenStreamServer(rsd, bind="127.0.0.1", http_port=args.port, audio_default_on=audio)
        serve_task = asyncio.create_task(server.serve(), name="foxmirror-stream-server")

        # wait for the HTTP side to accept connections
        for _ in range(100):
            if serve_task.done():
                break
            try:
                r, w = await asyncio.open_connection("127.0.0.1", args.port)
                w.close()
                break
            except OSError:
                await asyncio.sleep(0.2)
        if serve_task.done():
            exc = serve_task.exception()
            raise SetupError(f"stream server failed to start: {exc}")

        ok(f"stream is live at {url}")
        viewer = _open_viewer_window(url)
        try:
            while not serve_task.done():
                if viewer is not None and viewer.poll() is not None:
                    break
                await asyncio.sleep(0.5)
            if serve_task.done() and serve_task.exception():
                warn(f"stream server stopped: {serve_task.exception()}")
        finally:
            serve_task.cancel()
            with contextlib.suppress(BaseException):
                await serve_task
            if viewer is not None and viewer.poll() is None:
                viewer.terminate()
    return 0


def run_video(args: argparse.Namespace, link: Link) -> int:
    try:
        return asyncio.run(_video_session(args, link))
    except KeyboardInterrupt:
        return 0
    except SetupError as e:
        fail(str(e))
        return 3


# --------------------------------------------------------------------------
# Headless modes
# --------------------------------------------------------------------------

async def _probe(prefer: str, udid: Optional[str]) -> tuple[Link, Optional[str], Optional[str]]:
    """(link, display_name, ios_version). Version may be None when the phone is Wi-Fi-only and lockdown is closed."""
    link = await discover_link(prefer, udid)
    lockdown = await connect_lockdown_for(link)
    if lockdown is None:
        return link, None, None
    try:
        return link, lockdown.display_name, lockdown.product_version
    finally:
        with contextlib.suppress(Exception):
            await lockdown.close()


def run_check(args: argparse.Namespace) -> int:
    """Print device state without opening a window. Exit 0 = ready to stream."""

    async def _check() -> int:
        from packaging.version import Version

        link = await discover_link(args.transport, args.udid, wait_timeout=5.0)
        lockdown = await connect_lockdown_for(link)
        if lockdown is None:
            warn(f"phone {link.udid} reachable over {link} but lockdown is closed; tunnel-only")
            return 1
        ok(f"device: {lockdown.display_name} over {link} (iOS {lockdown.product_version}, {lockdown.udid})")
        ready = True
        if Version(lockdown.product_version) >= Version("16.0"):
            try:
                dm = await lockdown.get_developer_mode_status()
            except Exception:
                dm = False
            (ok if dm else warn)(f"developer mode: {'on' if dm else 'off'}")
            ready &= dm
        from pymobiledevice3.services.mobile_image_mounter import MobileImageMounterService

        image_type = "Personalized" if Version(lockdown.product_version) >= Version("17.0") else "Developer"
        try:
            mounted = await MobileImageMounterService(lockdown=lockdown).is_image_mounted(image_type)
        except Exception:
            mounted = False
        (ok if mounted else warn)(f"developer image: {'mounted' if mounted else 'not mounted'}")
        ready &= mounted
        try:
            wifi_on = bool(await lockdown.get_enable_wifi_connections())
        except Exception:
            wifi_on = False
        (ok if wifi_on else warn)(f"wi-fi connections on phone: {'on' if wifi_on else 'off'}")
        paired = link.udid in _remote_paired_udids()
        (ok if paired else info)(
            f"wi-fi pairing record: {'present' if paired else 'none (foxmirror -PairWifi, needs iOS 27+)'}"
        )
        return 0 if ready else 1

    try:
        return asyncio.run(_check())
    except SetupError as e:
        fail(str(e))
        return 2


async def _enable_wifi_connections(lockdown) -> None:
    """Phone-side switch so lockdownd answers over Wi-Fi (the 'Sync over Wi-Fi' flag)."""
    try:
        if bool(await lockdown.get_enable_wifi_connections()):
            ok("Wi-Fi connections already enabled on the phone")
            return
    except Exception:
        pass
    try:
        await lockdown.set_enable_wifi_connections(True)
        ok("Wi-Fi connections enabled on the phone")
    except Exception as e:
        warn(f"could not enable Wi-Fi connections: {e}")


def run_setup_only(args: argparse.Namespace) -> int:
    """Pair + developer mode + mount + Wi-Fi flag, then exit. Needs the cable."""

    async def _setup() -> int:
        dev = await _wait_for_device(args.udid)
        lockdown = await _connect_lockdown(dev.serial)
        ok(f"device: {lockdown.display_name} (iOS {lockdown.product_version})")
        await _ensure_developer_mode(lockdown)
        lockdown = await _connect_lockdown(dev.serial)
        await _ensure_image_mounted(lockdown)
        await _enable_wifi_connections(lockdown)
        if lockdown.udid not in _remote_paired_udids():
            try:
                if await _pair_wifi_over_usb(lockdown):
                    ok("Wi-Fi pairing created (works without the cable from now on)")
            except Exception as e:
                warn(f"Wi-Fi pairing over USB failed ({e}); run `foxmirror -PairWifi` later")
        ok("device is ready for foxmirror")
        return 0

    try:
        return asyncio.run(_setup())
    except SetupError as e:
        fail(str(e))
        return 2


def _lan_addresses() -> list[tuple[int, str]]:
    """Only the addresses of the adapter that actually reaches the LAN.

    pymobiledevice3 would otherwise advertise every interface (VPN, VirtualBox host-only, APIPA...);
    the phone then tries a dead address first and the pairing never starts.
    """
    import socket

    import ifaddr

    lan_ip = None
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("224.0.0.251", 5353))  # mDNS group: routes via the default (LAN) interface
        lan_ip = s.getsockname()[0]
        s.close()
    except OSError:
        pass
    result: list[tuple[int, str]] = []
    for adapter in ifaddr.get_adapters():
        v4 = [ip.ip for ip in adapter.ips if isinstance(ip.ip, str)]
        if lan_ip and lan_ip not in v4:
            continue
        if not lan_ip and not any(a.startswith(("192.168.", "10.")) or a.startswith("172.") for a in v4):
            continue
        for ip in adapter.ips:
            if isinstance(ip.ip, str):
                if not ip.ip.startswith(("127.", "169.254.")):
                    result.append((socket.AF_INET, ip.ip))
            else:
                a = ip.ip[0].lower()
                if a not in ("::1", "::") and not a.startswith("fe80:"):
                    result.append((socket.AF_INET6, a))
        if result:
            break
    return result


async def _pair_wifi_over_usb(lockdown) -> bool:
    """Create the RemotePairing record through lockdownd (USB, already trusted): no prompt, no code.

    This is the record the Wi-Fi tunnel needs; the phone starts advertising `_remotepairing._tcp`
    on the LAN once it exists.
    """
    from pymobiledevice3.exceptions import RemotePairingCompletedError
    from pymobiledevice3.remote.tunnel_service import RemotePairingLockdownService

    service = await RemotePairingLockdownService.create(lockdown)
    try:
        try:
            await service.connect(autopair=True)
        except RemotePairingCompletedError:
            pass  # the phone drops the link right after pair-setup succeeds
    finally:
        with contextlib.suppress(Exception):
            await service.close()
    return lockdown.udid in _remote_paired_udids()


def run_pair_wifi(args: argparse.Namespace) -> int:
    """One-time Wi-Fi pairing.

    Cable in: promptless over USB (iOS 17+). No cable: advertise as a pairable host and let the phone
    pair from Settings -> Developer -> Paired Macs (iOS 27+), typing a 6-digit code.
    """
    import platform

    from pymobiledevice3 import bonjour
    from pymobiledevice3.remote.tunnel_service import PairableHostInfo, serve_pairable_host

    async def _usb_first() -> Optional[bool]:
        try:
            dev = await _wait_for_device(args.udid, timeout=4.0)
        except SetupError:
            return None
        lockdown = await _connect_lockdown(dev.serial)
        if dev.serial in _remote_paired_udids():
            ok(f"{lockdown.display_name}: Wi-Fi pairing already exists")
            return True
        info(f"{lockdown.display_name} is on USB - pairing for Wi-Fi silently through the cable...")
        return await _pair_wifi_over_usb(lockdown)

    try:
        done = asyncio.run(_usb_first())
    except SetupError as e:
        fail(str(e))
        return 2
    if done:
        ok("Wi-Fi pairing done. Unplug when you like: `foxmirror` now finds the phone over Wi-Fi.")
        return 0
    if done is False:
        warn("USB pairing did not produce a record; falling back to the on-phone pairing screen")
    else:
        info("no cable - using the on-phone pairing screen instead")

    name = args.pair_name or f"FoxMirror-{os.environ.get('COMPUTERNAME', platform.node())}"
    addrs = _lan_addresses()
    if addrs:
        bonjour._local_addresses = lambda: addrs  # advertise the LAN adapter only
        info("advertising on: " + ", ".join(ip for _f, ip in addrs))
    else:
        warn("could not tell which adapter is the LAN; advertising on all of them")

    # Windows' own mDNS service (Dnscache) sits on UDP 5353 and our socket never sees the phone's
    # browse queries, so answering them is not enough: keep pushing unsolicited announcements,
    # which any Bonjour browser (the phone's Paired Macs screen included) accepts as-is.
    _orig_aenter = bonjour.MDNSResponder.__aenter__
    _orig_aexit = bonjour.MDNSResponder.__aexit__

    async def _aenter(self):
        await _orig_aenter(self)

        async def _beacon():
            while True:
                await asyncio.sleep(2.0)
                self._announce()

        self._foxmirror_beacon = asyncio.create_task(_beacon())
        return self

    async def _aexit(self, *exc):
        task = getattr(self, "_foxmirror_beacon", None)
        if task is not None:
            task.cancel()
            with contextlib.suppress(BaseException):
                await task
        return await _orig_aexit(self, *exc)

    bonjour.MDNSResponder.__aenter__ = _aenter
    bonjour.MDNSResponder.__aexit__ = _aexit
    print()
    info("Wi-Fi pairing. On the iPhone (same Wi-Fi as this PC):")
    info("  Settings -> Developer -> Paired Macs -> under 'Other Devices' tap "
         f"'{name}' -> Pair -> type the 6-digit code shown below")
    info("  ('Paired Macs' is just the screen name - any PC can pair here)")
    print()

    def on_pin(pin: str) -> None:
        print(f"\n    >>>  CODE: {pin}  <<<\n", flush=True)

    def on_wait(elapsed: float) -> None:
        info(f"waiting for the phone... {int(elapsed)}s")

    async def _pair():
        host = PairableHostInfo(name=name)
        return await serve_pairable_host(
            host, pin_callback=on_pin, waiting_callback=on_wait, timeout=args.pair_timeout,
        )

    try:
        result = asyncio.run(_pair())
    except KeyboardInterrupt:
        return 130
    except asyncio.TimeoutError:
        fail("nobody paired in time. Open Settings -> Developer -> Paired Macs on the phone and try again.")
        return 1
    ok(f"paired with {result.peer_device.name} ({result.peer_device.udid})")
    ok(f"record: {result.record_path}")
    ok("from now on `foxmirror` works without the cable when the phone is on this Wi-Fi.")
    return 0


def acquire_single_instance() -> bool:
    """Windows named mutex so a second `foxmirror` does not halve the frame rate of the first."""
    if os.name != "nt":
        return True
    import ctypes

    kernel32 = ctypes.windll.kernel32
    handle = kernel32.CreateMutexW(None, True, "Local\\FoxMirror.SingleInstance")
    if not handle:
        return True
    already = kernel32.GetLastError() == 183  # ERROR_ALREADY_EXISTS
    if already:
        kernel32.CloseHandle(handle)
        return False
    acquire_single_instance._handle = handle  # type: ignore[attr-defined]  # keep alive for process lifetime
    return True


def main(argv: Optional[list[str]] = None) -> int:
    parser = argparse.ArgumentParser(prog="foxmirror", description="live iPhone screen over USB or Wi-Fi")
    parser.add_argument("--udid", help="target a specific device")
    parser.add_argument("--fps", type=float, default=8.0, help="max frames per second to request (default 8)")
    parser.add_argument("--width", type=int, default=420, help="initial window width in px")
    parser.add_argument("--out", help="folder for saved frames (default ~/Pictures/FoxMirror)")
    parser.add_argument("--check", action="store_true", help="only report device readiness")
    parser.add_argument("--setup", action="store_true",
                        help="pair + enable dev mode + mount image + enable Wi-Fi connections, no window")
    parser.add_argument("--pair-wifi", action="store_true",
                        help="one-time Wi-Fi pairing so foxmirror works without the cable (iOS 27+)")
    parser.add_argument("--pair-name", help="name this PC shows on the phone during --pair-wifi")
    parser.add_argument("--pair-timeout", type=float, help="give up --pair-wifi after N seconds")
    parser.add_argument(
        "--mode", choices=("auto", "video", "photo"), default="auto",
        help="video = HEVC stream (iOS 27+), photo = screenshot polling, auto = video if possible",
    )
    parser.add_argument(
        "--transport", choices=("auto", "usb", "wifi"), default="auto",
        help="auto = USB when plugged in, otherwise Wi-Fi if paired",
    )
    parser.add_argument("--port", type=int, default=8765, help="local HTTP port for the video viewer")
    parser.add_argument("--no-audio", action="store_true", help="video mode: start with sound off (macOS only anyway)")
    args = parser.parse_args(argv)

    if args.check:
        return run_check(args)
    if args.setup:
        return run_setup_only(args)
    if args.pair_wifi:
        return run_pair_wifi(args)

    if not acquire_single_instance():
        warn("foxmirror is already running - a second window would split the frame rate; use that one")
        return 5

    if args.transport == "wifi" and not [u for u in _remote_paired_udids() if not args.udid or u == args.udid]:
        fail("no Wi-Fi pairing yet. Plug the cable in once and run `foxmirror -PairWifi` "
             "(needs iOS 27+; you type a 6-digit code on the phone).")
        return 6

    if args.mode in ("auto", "video"):
        from packaging.version import Version

        try:
            link, _name, version = asyncio.run(_probe(args.transport, args.udid))
        except SetupError as e:
            fail(str(e))
            return 2
        if version is None and link.transport == "wifi":
            version = VIDEO_MIN_IOS  # Wi-Fi pairing itself only exists on iOS 27+
        args.ios_version = version or "?"
        if version and Version(version) >= Version(VIDEO_MIN_IOS):
            if link.transport == "usb":
                rc = run_setup_only(args)
                if rc != 0:
                    return rc
            rc = run_video(args, link)
            if rc != 3:
                return rc
            warn("falling back to screenshot mode")
        elif args.mode == "video":
            fail(f"video mode needs iOS {VIDEO_MIN_IOS}+ on the phone (found {args.ios_version}); "
                 "update the iPhone or run without --mode video")
            return 4
        else:
            info(f"iOS {args.ios_version} over {link}: real video needs iOS {VIDEO_MIN_IOS}+, using screenshot mode")
    return run_viewer(args)


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(130)
