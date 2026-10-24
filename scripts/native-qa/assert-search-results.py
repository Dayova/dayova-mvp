#!/usr/bin/env python3
"""Check complete search suggestions and Continue above a real Android keyboard.

Capture an agent-device `snapshot --raw` reference with settled results and the
keyboard closed, then focus the same search field. Keep query, orientation and
font scale unchanged. Android clips accessibility bounds; compare each live
card with its complete reference instead of counting partly visible nodes.
"""

import argparse
import json
from pathlib import Path
import re
import shutil
import subprocess


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--reference-snapshot", required=True)
parser.add_argument("--agent-device", required=True)
parser.add_argument("--config", required=True)
parser.add_argument("--session", required=True)
parser.add_argument("--serial", required=True)
parser.add_argument("--package", default="com.dayova.dev")
parser.add_argument("--action", default="Weiter")
parser.add_argument("--minimum-results", type=int, default=3)
parser.add_argument("--adb", default=shutil.which("adb"))
args = parser.parse_args()
if not args.adb or args.minimum_results < 1:
    parser.error("ADB and a positive minimum result count are required")


def device(*command):
    return subprocess.check_output(
        [args.agent_device, *command, "--platform", "android", "--serial",
         args.serial, "--config", args.config, "--session", args.session],
        text=True, encoding="utf-8", errors="replace", timeout=45,
    )


def shell(*command):
    return subprocess.check_output(
        [args.adb, "-s", args.serial, "shell", *command],
        text=True, encoding="utf-8", errors="replace", timeout=15,
    )


def nodes(text):
    parsed = [json.loads(line) for line in text.splitlines() if line.startswith("{")]
    return [node for node in parsed if node.get("bundleId") == args.package]


def only(items, description):
    if len(items) != 1:
        raise SystemExit(f"FAIL: expected one {description}; found {len(items)}")
    return items[0]


def bottom(rect):
    return rect["y"] + rect["height"]


def full_size(rect, reference):
    return (
        rect["height"] > 0 and rect["width"] > 0
        and abs(rect["height"] - reference["height"]) <= 2
        and abs(rect["width"] - reference["width"]) <= 2
    )


if "Keyboard visible: yes" not in device("keyboard", "status"):
    raise SystemExit("FAIL: focus the search field; no keyboard is visible")
windows = shell("dumpsys", "window")
frames = re.findall(
    r"type=ime[^\n]*frame=\[(\d+),(\d+)\]\[(\d+),(\d+)\][^\n]*visible=true",
    windows,
)
if not frames:
    raise SystemExit("FAIL: no live IME frame")
keyboard_top = min(int(frame[1]) for frame in frames)
densities = re.findall(r"density:\s*(\d+)", shell("wm", "density"))
if not densities:
    raise SystemExit("FAIL: no native display density")
gap = 8 * int(densities[-1]) / 160

reference = nodes(Path(args.reference_snapshot).read_text(encoding="utf-8"))
live = nodes(device("snapshot", "--raw"))
reference_input = only(
    [node for node in reference if node.get("kind") == "text-field"],
    "reference search input",
)["rect"]
live_input = only(
    [node for node in live if node.get("kind") == "text-field" and node.get("focused")],
    "focused search input",
)["rect"]
reference_action = only(
    [node for node in reference if node.get("kind") == "button"
     and node.get("label") == args.action], "reference Continue action",
)["rect"]
action = only(
    [node for node in live if node.get("kind") == "button"
     and node.get("label") == args.action], "live Continue action",
)["rect"]
if (not full_size(live_input, reference_input) or live_input["y"] < 0
        or bottom(live_input) > keyboard_top):
    raise SystemExit("FAIL: focused search input is clipped or covered")
if (not full_size(action, reference_action) or action["y"] < 0
        or bottom(action) > keyboard_top - gap):
    raise SystemExit(f"FAIL: Continue is clipped or covered: {action}")

complete_reference = [node for node in reference if node.get("kind") == "checkbox"
                      and node["rect"]["width"] > 0 and node["rect"]["height"] > 0
                      and node["rect"]["y"] >= bottom(reference_input)
                      and bottom(node["rect"]) <= reference_action["y"] - gap]
if len(complete_reference) < args.minimum_results:
    raise SystemExit("FAIL: reference has too few complete search results")
reference_by_label = {node.get("label"): node["rect"] for node in complete_reference}
if len(reference_by_label) != len(complete_reference):
    raise SystemExit("FAIL: reference result labels must be unique")
visible = [node for node in live if node.get("kind") == "checkbox"
           and node.get("label") in reference_by_label
           and full_size(node["rect"], reference_by_label[node["label"]])
           and node["rect"]["y"] >= bottom(live_input)
           and bottom(node["rect"]) <= action["y"] - gap]
if len(visible) < args.minimum_results:
    raise SystemExit(
        f"FAIL: {len(visible)} complete results above Continue; "
        f"need {args.minimum_results} with an 8pt gap"
    )
print(
    f"PASS {args.serial}: {len(visible)} complete results above Continue, "
    f"action={action}, keyboard_top={keyboard_top}"
)
