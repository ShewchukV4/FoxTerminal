#!/usr/bin/env python3
"""Patch Zen workspace gradient theme inside zen-sessions.jsonlz4."""

from __future__ import annotations

import argparse
import json
import os
import struct
import sys


def _hex_to_rgb(hex_color: str) -> list[int]:
    h = hex_color.strip().lstrip("#")
    if len(h) != 6:
        return [108, 141, 255]
    return [int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)]


def _mix(a: list[int], b: list[int], t: float) -> list[int]:
    t = max(0.0, min(1.0, t))
    return [int(round(a[i] * (1 - t) + b[i] * t)) for i in range(3)]


def decompress_mozlz4(raw: bytes) -> bytes:
    import lz4.block

    if raw[:8] != b"mozLz40\0":
        raise ValueError("Not a mozlz4 file")
    usize = struct.unpack("<I", raw[8:12])[0]
    return lz4.block.decompress(raw[12:], uncompressed_size=usize)


def compress_mozlz4(data: bytes) -> bytes:
    import lz4.block

    compressed = lz4.block.compress(data, store_size=False)
    return b"mozLz40\0" + struct.pack("<I", len(data)) + compressed


def build_theme(accent: str, accent2: str | None = None, bg: str | None = None) -> dict:
    a = _hex_to_rgb(accent)
    b = _hex_to_rgb(accent2 or accent)
    base = _hex_to_rgb(bg or "#050505")
    dark = _mix(base, a, 0.15)
    mid = _mix(a, b, 0.35)
    return {
        "type": "gradient",
        "gradientColors": [
            {
                "c": a,
                "isCustom": False,
                "algorithm": "floating",
                "isPrimary": True,
                "lightness": "45",
                "position": {"x": 20, "y": 18},
                "type": "explicit-lightness",
            },
            {
                "c": mid,
                "isCustom": False,
                "algorithm": "floating",
                "isPrimary": False,
                "lightness": "40",
                "position": {"x": 82, "y": 22},
                "type": "explicit-lightness",
            },
            {
                "c": dark,
                "isCustom": False,
                "algorithm": "floating",
                "isPrimary": False,
                "lightness": "20",
                "position": {"x": 50, "y": 88},
                "type": "explicit-lightness",
            },
        ],
        "opacity": 0.82,
        "texture": 0,
        "rotation": 0,
    }


def patch_sessions_file(path: str, theme: dict) -> int:
    raw = open(path, "rb").read()
    obj = json.loads(decompress_mozlz4(raw))
    spaces = obj.get("spaces") or []
    count = 0
    for space in spaces:
        if isinstance(space, dict):
            space["theme"] = theme
            count += 1
    if count == 0:
        return 0
    out = json.dumps(obj, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    open(path, "wb").write(compress_mozlz4(out))
    return count


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--profile", required=True)
    parser.add_argument("--accent", required=True)
    parser.add_argument("--accent2", default="")
    parser.add_argument("--bg", default="")
    args = parser.parse_args()

    sessions = os.path.join(args.profile, "zen-sessions.jsonlz4")
    if not os.path.isfile(sessions):
        print(json.dumps({"ok": False, "error": "zen-sessions.jsonlz4 missing"}))
        return 1

    theme = build_theme(args.accent, args.accent2 or None, args.bg or None)
    count = patch_sessions_file(sessions, theme)
    print(json.dumps({"ok": True, "spacesUpdated": count, "sessions": sessions, "theme": theme}))
    return 0 if count else 2


if __name__ == "__main__":
    sys.exit(main())
