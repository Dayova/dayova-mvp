from __future__ import annotations

import importlib.util
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


SKILL_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = SKILL_DIR / "scripts"
REPO_ROOT = SKILL_DIR.parents[2]
sys.path.insert(0, str(SCRIPTS_DIR))

SPEC = importlib.util.spec_from_file_location(
	"inspect_video", SCRIPTS_DIR / "inspect_video.py"
)
assert SPEC and SPEC.loader
INSPECT_VIDEO = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(INSPECT_VIDEO)


class SamplingPolicyTests(unittest.TestCase):
	def test_sampling_policy_covers_short_medium_and_long_videos(self) -> None:
		self.assertEqual(INSPECT_VIDEO.choose_sampling_fps(20), 2.0)
		self.assertEqual(INSPECT_VIDEO.choose_sampling_fps(60), 1.0)
		self.assertAlmostEqual(INSPECT_VIDEO.choose_sampling_fps(240), 1 / 3)

	def test_timestamp_formatter_is_stable(self) -> None:
		self.assertEqual(INSPECT_VIDEO.format_timestamp(0), "00:00:00.000")
		self.assertEqual(INSPECT_VIDEO.format_timestamp(3723.456), "01:02:03.456")

	def test_bitmap_label_changes_the_canvas(self) -> None:
		canvas = bytearray(bytes((0, 0, 0)) * 320 * 32)
		INSPECT_VIDEO.draw_text(canvas, 320, 4, 4, "00:01.500")
		self.assertIn(255, canvas)

	def test_ppm_reader_preserves_whitespace_colored_first_pixel(self) -> None:
		with tempfile.TemporaryDirectory() as temporary_directory:
			path = Path(temporary_directory) / "pixel.ppm"
			path.write_bytes(b"P6\n1 1\n255\n" + bytes((32, 10, 13)))
			width, height, pixels = INSPECT_VIDEO.read_ppm(path)
			self.assertEqual((width, height), (1, 1))
			self.assertEqual(pixels, bytes((32, 10, 13)))


class PreflightTests(unittest.TestCase):
	def test_missing_dependencies_fail_with_install_guidance(self) -> None:
		environment = os.environ.copy()
		environment["PATH"] = ""
		result = subprocess.run(
			[sys.executable, str(SCRIPTS_DIR / "preflight.py")],
			capture_output=True,
			text=True,
			env=environment,
		)
		self.assertEqual(result.returncode, 2)
		self.assertIn("requires ffmpeg and ffprobe", result.stderr)
		self.assertIn("brew install ffmpeg", result.stderr)


@unittest.skipUnless(
	shutil.which("ffmpeg") and shutil.which("ffprobe"),
	"ffmpeg and ffprobe are required",
)
class EndToEndTests(unittest.TestCase):
	def test_full_timeline_and_focused_interval(self) -> None:
		with tempfile.TemporaryDirectory() as temporary_directory:
			root = Path(temporary_directory)
			video = root / "sample.mp4"
			evidence = root / "evidence"
			subprocess.run(
				[
					"ffmpeg",
					"-hide_banner",
					"-loglevel",
					"error",
					"-f",
					"lavfi",
					"-i",
					"testsrc=size=160x120:rate=10:duration=2",
					"-f",
					"lavfi",
					"-i",
					"sine=frequency=1000:duration=2",
					"-shortest",
					"-c:v",
					"mpeg4",
					"-c:a",
					"aac",
					"-y",
					str(video),
				],
				check=True,
			)

			full = subprocess.run(
				[
					sys.executable,
					str(SCRIPTS_DIR / "inspect_video.py"),
					str(video),
					"--question",
					"What changes over time?",
					"--output-dir",
					str(evidence),
				],
				capture_output=True,
				text=True,
			)
			self.assertEqual(full.returncode, 0, full.stderr)
			manifest = json.loads((evidence / "manifest.json").read_text())
			self.assertTrue(manifest["probe"]["audio_present"])
			self.assertGreaterEqual(
				manifest["full_timeline_sampling"]["frame_count"], 3
			)
			self.assertTrue(
				(evidence / manifest["full_timeline_sampling"]["contact_sheets"][0]).is_file()
			)
			self.assertTrue((evidence / "frame-index.md").is_file())
			self.assertIn("frames sampled", manifest["coverage_statement"])

			focused = subprocess.run(
				[
					sys.executable,
					str(SCRIPTS_DIR / "inspect_video.py"),
					str(video),
					"--question",
					"What changes over time?",
					"--output-dir",
					str(evidence),
					"--start",
					"0.5",
					"--end",
					"1.5",
					"--fps",
					"4",
				],
				capture_output=True,
				text=True,
			)
			self.assertEqual(focused.returncode, 0, focused.stderr)
			manifest = json.loads((evidence / "manifest.json").read_text())
			self.assertEqual(len(manifest["focused_intervals"]), 1)
			focus = manifest["focused_intervals"][0]
			self.assertGreaterEqual(focus["frame_count"], 3)
			self.assertEqual(focus["frames"][0]["timestamp"], "00:00:00.500")
			self.assertIn("additional frames", manifest["coverage_statement"])


class SkillContractTests(unittest.TestCase):
	def test_frontmatter_and_repo_handoffs(self) -> None:
		skill = (SKILL_DIR / "SKILL.md").read_text()
		frontmatter = skill.split("---", 2)[1]
		keys = {
			line.split(":", 1)[0]
			for line in frontmatter.splitlines()
			if ":" in line
		}
		self.assertEqual(keys, {"name", "description"})
		self.assertIn("Linear issue", frontmatter)
		self.assertIn("screen recording", frontmatter)
		self.assertIn(
			"$inspect-video-evidence",
			(REPO_ROOT / ".agents/skills/triage/SKILL.md").read_text(),
		)
		self.assertIn(
			"$inspect-video-evidence", (REPO_ROOT / "AGENTS.md").read_text()
		)
		self.assertIn(
			"inspect-video-evidence",
			(REPO_ROOT / "docs/agents/matt-pocock-skills.md").read_text(),
		)


if __name__ == "__main__":
	unittest.main()
