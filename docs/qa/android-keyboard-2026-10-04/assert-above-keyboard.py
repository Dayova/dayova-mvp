#!/usr/bin/env python3
"""Assert an accessible Android control is fully above a visible IME.

Run after opening a form and focusing its field. The dump is taken live, so
an offscreen/clipped input fails rather than accepting an old screenshot.
"""
import argparse
import re
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("label", help="Exact accessibility label, resource ID or text")
parser.add_argument("--input", action="store_true", help="Require the input itself, excluding its static label")
parser.add_argument("--adb", default=str(Path.home() / "Library/Android/sdk/platform-tools/adb"))
parser.add_argument("--serial", default="emulator-5554")
args = parser.parse_args()


def adb(*command):
    return subprocess.check_output([args.adb, "-s", args.serial, *command], text=True)


windows = adb("shell", "dumpsys", "window")
ime_frames = re.findall(r"type=ime[^\n]*frame=\[(\d+),(\d+)\]\[(\d+),(\d+)\][^\n]*visible=true", windows)
if not ime_frames:
    raise SystemExit("FAIL: no visible IME frame; focus an input first")
keyboard_top = min(int(frame[1]) for frame in ime_frames)
adb("shell", "uiautomator", "dump", "/sdcard/dayova-keyboard-check.xml")
root = ET.fromstring(adb("shell", "cat", "/sdcard/dayova-keyboard-check.xml"))
nodes = [node for node in root.iter("node") if args.label in
         (node.get("content-desc"), node.get("text"), node.get("resource-id"))
         and (not args.input or node.get("class") == "android.widget.EditText")]
for node in nodes:
    bounds = [int(value) for value in re.findall(r"\d+", node.get("bounds", ""))]
    if len(bounds) == 4:
        left, top, right, bottom = bounds
        if right > left and bottom > top and bottom <= keyboard_top:
            print(f"PASS: {args.label!r} bounds={bounds}, keyboard_top={keyboard_top}")
            break
else:
    raise SystemExit(f"FAIL: {args.label!r} missing, clipped or covered; keyboard_top={keyboard_top}")
