#!/usr/bin/env python3
"""Compare a closed-keyboard action with its settled native reference position.

Use immediately after a keyboard dismissal or a step transition. Capture the
reference with `agent-device snapshot --raw` and the keyboard already closed.
This checks absolute position as well as complete bounds: an action floating at
the old keyboard edge is visible, but has not returned to its resting position.
"""

import argparse
import json
from pathlib import Path
import subprocess


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--reference-snapshot", required=True)
parser.add_argument("--agent-device", required=True)
parser.add_argument("--config", required=True)
parser.add_argument("--session", required=True)
parser.add_argument("--serial", required=True)
parser.add_argument("--package", default="com.dayova.dev")
parser.add_argument("--action", default="Weiter")
parser.add_argument(
    "--during-press-feedback", action="store_true",
    help="Check the center while press compression finishes; check full bounds separately without this flag.",
)
args = parser.parse_args()


def device(*command):
    return subprocess.check_output(
        [args.agent_device, *command, "--platform", "android", "--serial",
         args.serial, "--config", args.config, "--session", args.session],
        text=True, encoding="utf-8", errors="replace", timeout=30,
    )


def action_rect(snapshot):
    # `snapshot --raw` in the installed Agent Device CLI emits one JSON node
    # per line. This is intentionally not the separate `--json` envelope.
    nodes = [json.loads(line) for line in snapshot.splitlines() if line.startswith("{")]
    visible = [node for node in nodes if node.get("bundleId") == args.package
               and node.get("visibleToUser")]
    roots = [node["rect"] for node in visible if node.get("depth") == 0]
    if len(roots) != 1:
        raise SystemExit(f"FAIL: expected one visible application window; found {len(roots)}")
    viewport = roots[0]
    actions = [node for node in visible
               if node.get("kind") == "button" and node.get("label") == args.action]
    if len(actions) != 1:
        raise SystemExit(f"FAIL: expected one {args.action!r} action; found {len(actions)}")
    rect = actions[0]["rect"]
    if (rect["width"] <= 0 or rect["height"] <= 0
            or rect["x"] < viewport["x"] or rect["y"] < viewport["y"]
            or rect["x"] + rect["width"] > viewport["x"] + viewport["width"]
            or rect["y"] + rect["height"] > viewport["y"] + viewport["height"]):
        raise SystemExit(f"FAIL: action has no complete bounds: {rect}")
    return rect


if "Keyboard visible: no" not in device("keyboard", "status"):
    raise SystemExit("FAIL: keyboard must be closed before checking resting position")
reference = action_rect(Path(args.reference_snapshot).read_text(encoding="utf-8"))
current = action_rect(device("snapshot", "--raw"))
center_changed = any(
    abs(current[axis] + current[size] / 2 - reference[axis] - reference[size] / 2) > 2
    for axis, size in (("x", "width"), ("y", "height"))
)
bounds_changed = any(
    abs(current[key] - reference[key]) > 2 for key in ("x", "y", "width", "height")
)
if center_changed or (not args.during_press_feedback and bounds_changed):
    raise SystemExit(f"FAIL: action has not returned: current={current}, reference={reference}")
checked = "center" if args.during_press_feedback else "bounds"
print(f"PASS {args.serial}: {args.action} {checked} restored to {current}")
