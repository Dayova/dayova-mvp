#!/usr/bin/env python3
"""Verify deterministic local video-inspection dependencies."""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from dataclasses import dataclass


@dataclass(frozen=True)
class PreflightError(Exception):
	missing: tuple[str, ...]

	def __str__(self) -> str:
		return "Missing required command(s): " + ", ".join(self.missing)


def _version_line(command: str) -> str:
	result = subprocess.run(
		[command, "-version"],
		check=True,
		capture_output=True,
		text=True,
	)
	return result.stdout.splitlines()[0]


def check_dependencies() -> dict[str, str]:
	missing = tuple(
		command for command in ("ffmpeg", "ffprobe") if shutil.which(command) is None
	)
	if missing:
		raise PreflightError(missing)

	return {
		"ffmpeg": _version_line("ffmpeg"),
		"ffprobe": _version_line("ffprobe"),
	}


def main() -> int:
	try:
		versions = check_dependencies()
	except (PreflightError, subprocess.CalledProcessError) as error:
		print("Video inspection requires ffmpeg and ffprobe.", file=sys.stderr)
		print(str(error), file=sys.stderr)
		print("macOS: brew install ffmpeg", file=sys.stderr)
		print(
			"Debian/Ubuntu: sudo apt-get update && sudo apt-get install -y ffmpeg",
			file=sys.stderr,
		)
		print(
			"Install the dependency, then rerun the evidence pass; a poster frame is only still-image evidence.",
			file=sys.stderr,
		)
		return 2

	print(json.dumps({"status": "ok", "versions": versions}, indent=2))
	return 0


if __name__ == "__main__":
	raise SystemExit(main())
