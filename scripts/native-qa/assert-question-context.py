#!/usr/bin/env python3
"""Check the live Android question and answer with the keyboard open.

Run after focusing the answer in a real learning session. This checks native
geometry, not React props or a mocked keyboard. First save a raw snapshot with
the whole question visible and the keyboard closed. Use the same question,
device orientation and font scale for both snapshots. Android clips native
bounds, so comparing against this reference detects partially hidden text.
Use a question that fits with the answer above the keyboard.
"""

import argparse
import json
from pathlib import Path
import re
import shutil
import subprocess


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("question", help="Unique prefix of the complete question")
parser.add_argument("--agent-device", required=True)
parser.add_argument("--config", required=True)
parser.add_argument("--session", required=True)
parser.add_argument("--serial", required=True)
parser.add_argument(
    "--reference-snapshot", required=True,
    help="Raw native snapshot with the entire question visible before focus",
)
parser.add_argument("--package", default="com.dayova.dev")
parser.add_argument(
    "--action", action="append", default=[],
    help="Action that must stay above the IME",
)
parser.add_argument("--adb", default=shutil.which("adb"))
args = parser.parse_args()


def device(*command):
    result = subprocess.run(
        [args.agent_device, *command, "--platform", "android", "--serial",
         args.serial, "--config", args.config, "--session", args.session],
        capture_output=True, text=True, encoding="utf-8", errors="replace",
        timeout=45, check=True,
    )
    return result.stdout


def inside(rect, viewport):
    return (
        rect["width"] > 0 and rect["height"] > 0
        and rect["x"] >= viewport["x"]
        and rect["x"] + rect["width"] <= viewport["x"] + viewport["width"]
        and rect["y"] >= viewport["y"]
        and rect["y"] + rect["height"] <= viewport["y"] + viewport["height"]
    )


if "Keyboard visible: yes" not in device("keyboard", "status"):
    raise SystemExit("FAIL: no visible keyboard; focus the answer first")

snapshot = device("snapshot", "--raw")
nodes = [json.loads(line) for line in snapshot.splitlines() if line.startswith("{")]
nodes = [node for node in nodes if node.get("bundleId") == args.package]
reference = [json.loads(line) for line in Path(args.reference_snapshot).read_text(
    encoding="utf-8").splitlines() if line.startswith("{")]
reference_questions = [node for node in reference if node.get("bundleId") == args.package
                       and node.get("kind") == "text"
                       and (node.get("label") or "").startswith(args.question)]
reference_answers = [node for node in reference
                     if node.get("bundleId") == args.package
                     and node.get("kind") == "text-field"]
reference_viewports = [node for node in reference
                      if node.get("bundleId") == args.package
                      and node.get("identifier") == "session-scroll"]
questions = [node for node in nodes if node.get("kind") == "text"
             and (node.get("label") or "").startswith(args.question)]
viewports = [node for node in nodes if node.get("identifier") == "session-scroll"]
answers = [node for node in nodes if node.get("kind") == "text-field"
           and node.get("focused")]
if len(questions) != 1 or len(viewports) != 1 or len(answers) != 1:
    raise SystemExit(
        f"FAIL: expected one question, session viewport and focused answer; "
        f"found {len(questions)}, {len(viewports)}, {len(answers)}"
    )

question, viewport, answer = questions[0]["rect"], viewports[0]["rect"], answers[0]["rect"]
if (len(reference_questions) != 1
        or reference_questions[0].get("label") != questions[0].get("label")):
    raise SystemExit("FAIL: reference must contain the same complete question")
reference_rect = reference_questions[0]["rect"]
if (len(reference_answers) != 1 or len(reference_viewports) != 1
        or not inside(reference_rect, reference_viewports[0]["rect"])
        or not inside(reference_answers[0]["rect"], reference_viewports[0]["rect"])):
    raise SystemExit("FAIL: reference must show the complete question and answer")
if (abs(question["height"] - reference_rect["height"]) > 1
        or abs(question["width"] - reference_rect["width"]) > 1):
    raise SystemExit(
        f"FAIL: question clipped or resized: {question}, reference={reference_rect}"
    )
if not inside(question, viewport):
    raise SystemExit(f"FAIL: question clipped: question={question}, viewport={viewport}")
if question["y"] + question["height"] > answer["y"]:
    raise SystemExit("FAIL: answer overlaps the question")
if not inside(answer, viewport):
    raise SystemExit(
        f"FAIL: answer outside readable viewport: answer={answer}, viewport={viewport}"
    )
reference_answer = reference_answers[0]["rect"]
if (abs(answer["height"] - reference_answer["height"]) > 1
        or abs(answer["width"] - reference_answer["width"]) > 1):
    raise SystemExit("FAIL: answer clipped or resized from reference")

if not args.adb:
    raise SystemExit("FAIL: --adb is required to check the live IME")
windows = subprocess.check_output(
    [args.adb, "-s", args.serial, "shell", "dumpsys", "window"],
    text=True, encoding="utf-8", errors="replace", timeout=15,
)
frames = re.findall(
    r"type=ime[^\n]*frame=\[(\d+),(\d+)\]\[(\d+),(\d+)\][^\n]*visible=true",
    windows,
)
if not frames:
    raise SystemExit("FAIL: no visible IME frame")
keyboard_top = min(int(frame[1]) for frame in frames)
if (question["y"] + question["height"] > keyboard_top
        or answer["y"] + answer["height"] > keyboard_top):
    raise SystemExit("FAIL: keyboard covers the question or answer")
if args.action:
    for label in args.action:
        actions = [node for node in nodes if node.get("kind") == "button"
                   and node.get("label") == label]
        if len(actions) != 1:
            raise SystemExit(f"FAIL: expected one visible action {label!r}; found {len(actions)}")
        rect = actions[0]["rect"]
        if rect["width"] <= 0 or rect["height"] <= 0 or rect["y"] + rect["height"] > keyboard_top:
            raise SystemExit(
                f"FAIL: {label!r} clipped or covered: {rect}, keyboard_top={keyboard_top}"
            )
    print(f"PASS: {len(args.action)} actions fully above keyboard_top={keyboard_top}")

print(
    f"PASS: full question and focused answer visible: question={question}, "
    f"answer={answer}, viewport={viewport}"
)
