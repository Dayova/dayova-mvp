#!/usr/bin/env python3
"""Create full-timeline, timestamped evidence artifacts for a local video."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from fractions import Fraction
from pathlib import Path
from typing import Any, Iterable

from preflight import PreflightError, check_dependencies


SCHEMA_VERSION = 1
FRAMES_PER_SHEET = 16
SHEET_COLUMNS = 4
THUMB_WIDTH = 320
THUMB_HEIGHT = 420
LABEL_HEIGHT = 32
CELL_PADDING = 8
SHEET_MARGIN = 8

GLYPHS = {
	"0": ("01110", "10001", "10011", "10101", "11001", "10001", "01110"),
	"1": ("00100", "01100", "00100", "00100", "00100", "00100", "01110"),
	"2": ("01110", "10001", "00001", "00010", "00100", "01000", "11111"),
	"3": ("11110", "00001", "00001", "01110", "00001", "00001", "11110"),
	"4": ("00010", "00110", "01010", "10010", "11111", "00010", "00010"),
	"5": ("11111", "10000", "10000", "11110", "00001", "00001", "11110"),
	"6": ("01110", "10000", "10000", "11110", "10001", "10001", "01110"),
	"7": ("11111", "00001", "00010", "00100", "01000", "01000", "01000"),
	"8": ("01110", "10001", "10001", "01110", "10001", "10001", "01110"),
	"9": ("01110", "10001", "10001", "01111", "00001", "00001", "01110"),
	":": ("00000", "00100", "00100", "00000", "00100", "00100", "00000"),
	".": ("00000", "00000", "00000", "00000", "00000", "00110", "00110"),
}


class InspectionError(RuntimeError):
	pass


def parse_args() -> argparse.Namespace:
	parser = argparse.ArgumentParser(
		description="Generate full-timeline video evidence and timestamped contact sheets."
	)
	parser.add_argument("video", type=Path, help="Local video file")
	parser.add_argument("--question", required=True, help="Question the evidence must answer")
	parser.add_argument("--output-dir", type=Path, help="Evidence directory; defaults to the OS temp directory")
	parser.add_argument("--start", type=float, help="Focused interval start in seconds")
	parser.add_argument("--end", type=float, help="Focused interval end in seconds")
	parser.add_argument("--fps", type=float, help="Focused sampling rate in frames per second")
	return parser.parse_args()


def run_checked(command: list[str]) -> subprocess.CompletedProcess[str]:
	try:
		return subprocess.run(command, check=True, capture_output=True, text=True)
	except subprocess.CalledProcessError as error:
		detail = error.stderr.strip() or error.stdout.strip() or str(error)
		raise InspectionError(detail) from error


def sha256_file(path: Path) -> str:
	digest = hashlib.sha256()
	with path.open("rb") as handle:
		for chunk in iter(lambda: handle.read(1024 * 1024), b""):
			digest.update(chunk)
	return digest.hexdigest()


def parse_frame_rate(value: str | None) -> float | None:
	if not value or value == "0/0":
		return None
	try:
		return float(Fraction(value))
	except (ValueError, ZeroDivisionError):
		return None


def probe_video(path: Path) -> dict[str, Any]:
	result = run_checked(
		[
			"ffprobe",
			"-v",
			"error",
			"-show_streams",
			"-show_format",
			"-of",
			"json",
			str(path),
		]
	)
	payload = json.loads(result.stdout)
	streams = payload.get("streams", [])
	video_stream = next(
		(stream for stream in streams if stream.get("codec_type") == "video"), None
	)
	if video_stream is None:
		raise InspectionError("No video stream was detected.")

	format_data = payload.get("format", {})
	duration_value = format_data.get("duration") or video_stream.get("duration")
	try:
		duration = float(duration_value)
	except (TypeError, ValueError) as error:
		raise InspectionError("Video duration is unavailable.") from error
	if not math.isfinite(duration) or duration <= 0:
		raise InspectionError("Video duration must be greater than zero.")

	audio_stream = next(
		(stream for stream in streams if stream.get("codec_type") == "audio"), None
	)
	return {
		"duration_seconds": round(duration, 6),
		"width": int(video_stream.get("width", 0)),
		"height": int(video_stream.get("height", 0)),
		"video_codec": video_stream.get("codec_name"),
		"frame_rate": parse_frame_rate(
			video_stream.get("avg_frame_rate") or video_stream.get("r_frame_rate")
		),
		"audio_present": audio_stream is not None,
		"audio_codec": audio_stream.get("codec_name") if audio_stream else None,
	}


def choose_sampling_fps(duration_seconds: float) -> float:
	if duration_seconds <= 30:
		return 2.0
	if duration_seconds <= 120:
		return 1.0
	return 80.0 / duration_seconds


def format_decimal(value: float) -> str:
	return f"{value:.6f}".rstrip("0").rstrip(".")


def format_timestamp(seconds: float) -> str:
	milliseconds = max(0, round(seconds * 1000))
	hours, remainder = divmod(milliseconds, 3_600_000)
	minutes, remainder = divmod(remainder, 60_000)
	whole_seconds, milliseconds = divmod(remainder, 1000)
	return f"{hours:02d}:{minutes:02d}:{whole_seconds:02d}.{milliseconds:03d}"


def slugify(value: str) -> str:
	value = re.sub(r"[^a-zA-Z0-9]+", "-", value).strip("-").lower()
	return value[:48] or "video"


def extract_images(
	video: Path,
	output_pattern: Path,
	start: float,
	end: float,
	fps: float,
	thumbnail: bool,
) -> None:
	base_filter = (
		f"trim=start={format_decimal(start)}:end={format_decimal(end)},"
		f"setpts=PTS-STARTPTS,fps=fps={format_decimal(fps)}"
	)
	if thumbnail:
		visual_filter = (
			base_filter
			+ f",scale=w={THUMB_WIDTH}:h={THUMB_HEIGHT}:force_original_aspect_ratio=decrease"
			+ f",pad={THUMB_WIDTH}:{THUMB_HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=black,format=rgb24"
		)
	else:
		visual_filter = (
			base_filter
			+ ",scale=w=960:h=960:force_original_aspect_ratio=decrease"
		)

	run_checked(
		[
			"ffmpeg",
			"-hide_banner",
			"-loglevel",
			"error",
			"-y",
			"-i",
			str(video),
			"-an",
			"-vf",
			visual_filter,
			"-fps_mode",
			"vfr",
			"-start_number",
			"1",
			str(output_pattern),
		]
	)


def read_ppm(path: Path) -> tuple[int, int, bytes]:
	data = path.read_bytes()
	index = 0

	def token() -> bytes:
		nonlocal index
		while index < len(data):
			if data[index] == ord("#"):
				while index < len(data) and data[index] not in (10, 13):
					index += 1
			elif chr(data[index]).isspace():
				index += 1
			else:
				break
		start = index
		while index < len(data) and not chr(data[index]).isspace():
			index += 1
		return data[start:index]

	if token() != b"P6":
		raise InspectionError(f"Unsupported PPM format: {path}")
	width = int(token())
	height = int(token())
	max_value = int(token())
	if max_value != 255:
		raise InspectionError(f"Unsupported PPM color depth: {max_value}")
	if index >= len(data) or not chr(data[index]).isspace():
		raise InspectionError(f"Malformed PPM header in {path}")
	if data[index] == 13 and index + 1 < len(data) and data[index + 1] == 10:
		index += 2
	else:
		index += 1
	pixels = data[index:]
	expected = width * height * 3
	if len(pixels) != expected:
		raise InspectionError(
			f"Malformed PPM pixel data in {path}: expected {expected}, got {len(pixels)}"
		)
	return width, height, pixels


def fill_rect(
	canvas: bytearray,
	canvas_width: int,
	x: int,
	y: int,
	width: int,
	height: int,
	color: tuple[int, int, int],
) -> None:
	row = bytes(color) * width
	for offset_y in range(height):
		start = ((y + offset_y) * canvas_width + x) * 3
		canvas[start : start + len(row)] = row


def blit_rgb(
	canvas: bytearray,
	canvas_width: int,
	x: int,
	y: int,
	image_width: int,
	image_height: int,
	pixels: bytes,
) -> None:
	row_bytes = image_width * 3
	for offset_y in range(image_height):
		source_start = offset_y * row_bytes
		destination_start = ((y + offset_y) * canvas_width + x) * 3
		canvas[destination_start : destination_start + row_bytes] = pixels[
			source_start : source_start + row_bytes
		]


def draw_text(
	canvas: bytearray,
	canvas_width: int,
	x: int,
	y: int,
	text: str,
	scale: int = 3,
	color: tuple[int, int, int] = (255, 255, 255),
) -> None:
	cursor_x = x
	for character in text:
		glyph = GLYPHS[character]
		for glyph_y, row in enumerate(glyph):
			for glyph_x, bit in enumerate(row):
				if bit == "1":
					fill_rect(
						canvas,
						canvas_width,
						cursor_x + glyph_x * scale,
						y + glyph_y * scale,
						scale,
						scale,
						color,
					)
		cursor_x += 6 * scale


def write_ppm(path: Path, width: int, height: int, pixels: bytearray) -> None:
	with path.open("wb") as handle:
		handle.write(f"P6\n{width} {height}\n255\n".encode("ascii"))
		handle.write(pixels)


def chunks(values: list[Path], size: int) -> Iterable[list[Path]]:
	for index in range(0, len(values), size):
		yield values[index : index + size]


def build_contact_sheets(
	thumbnail_paths: list[Path],
	timestamps: list[str],
	contact_dir: Path,
) -> list[Path]:
	rows = math.ceil(FRAMES_PER_SHEET / SHEET_COLUMNS)
	cell_height = THUMB_HEIGHT + LABEL_HEIGHT
	canvas_width = (
		SHEET_MARGIN * 2
		+ SHEET_COLUMNS * THUMB_WIDTH
		+ (SHEET_COLUMNS - 1) * CELL_PADDING
	)
	canvas_height = (
		SHEET_MARGIN * 2 + rows * cell_height + (rows - 1) * CELL_PADDING
	)
	outputs: list[Path] = []

	for sheet_index, sheet_paths in enumerate(
		chunks(thumbnail_paths, FRAMES_PER_SHEET), start=1
	):
		canvas = bytearray(bytes((236, 238, 241)) * canvas_width * canvas_height)
		first_frame_index = (sheet_index - 1) * FRAMES_PER_SHEET
		for position, thumbnail_path in enumerate(sheet_paths):
			width, height, pixels = read_ppm(thumbnail_path)
			if (width, height) != (THUMB_WIDTH, THUMB_HEIGHT):
				raise InspectionError(
					f"Unexpected thumbnail dimensions: {width}x{height}"
				)
			row, column = divmod(position, SHEET_COLUMNS)
			x = SHEET_MARGIN + column * (THUMB_WIDTH + CELL_PADDING)
			y = SHEET_MARGIN + row * (cell_height + CELL_PADDING)
			blit_rgb(canvas, canvas_width, x, y, width, height, pixels)
			fill_rect(
				canvas,
				canvas_width,
				x,
				y + THUMB_HEIGHT,
				THUMB_WIDTH,
				LABEL_HEIGHT,
				(26, 29, 34),
			)
			label = timestamps[first_frame_index + position]
			text_width = (len(label) * 6 - 1) * 3
			draw_text(
				canvas,
				canvas_width,
				x + (THUMB_WIDTH - text_width) // 2,
				y + THUMB_HEIGHT + (LABEL_HEIGHT - 21) // 2,
				label,
			)

		ppm_path = contact_dir / f"contact-sheet-{sheet_index:03d}.ppm"
		png_path = contact_dir / f"contact-sheet-{sheet_index:03d}.png"
		write_ppm(ppm_path, canvas_width, canvas_height, canvas)
		run_checked(
			[
				"ffmpeg",
				"-hide_banner",
				"-loglevel",
				"error",
				"-y",
				"-i",
				str(ppm_path),
				"-frames:v",
				"1",
				str(png_path),
			]
		)
		ppm_path.unlink()
		outputs.append(png_path)

	return outputs


def relative(path: Path, root: Path) -> str:
	return path.relative_to(root).as_posix()


def create_run(
	video: Path,
	root: Path,
	run_dir: Path,
	start: float,
	end: float,
	fps: float,
) -> dict[str, Any]:
	if run_dir.exists():
		raise InspectionError(f"Evidence interval already exists: {run_dir}")
	frames_dir = run_dir / "frames"
	contact_dir = run_dir / "contact-sheets"
	thumbnail_dir = run_dir / ".thumbnails"
	frames_dir.mkdir(parents=True)
	contact_dir.mkdir()
	thumbnail_dir.mkdir()

	extract_images(
		video, frames_dir / "frame-%04d.png", start, end, fps, thumbnail=False
	)
	extract_images(
		video,
		thumbnail_dir / "frame-%04d.ppm",
		start,
		end,
		fps,
		thumbnail=True,
	)
	frame_paths = sorted(frames_dir.glob("frame-*.png"))
	thumbnail_paths = sorted(thumbnail_dir.glob("frame-*.ppm"))
	if not frame_paths:
		raise InspectionError("Sampling produced no frames.")
	if len(frame_paths) != len(thumbnail_paths):
		raise InspectionError("Detailed-frame and contact-sheet sample counts differ.")

	timestamp_values = [
		min(end, start + index / fps) for index in range(len(frame_paths))
	]
	timestamps = [format_timestamp(value) for value in timestamp_values]
	contact_sheets = build_contact_sheets(
		thumbnail_paths, timestamps, contact_dir
	)
	shutil.rmtree(thumbnail_dir)

	frames: list[dict[str, Any]] = []
	for index, (frame_path, timestamp_value, timestamp) in enumerate(
		zip(frame_paths, timestamp_values, timestamps), start=1
	):
		contact_sheet = contact_sheets[(index - 1) // FRAMES_PER_SHEET]
		frames.append(
			{
				"index": index,
				"timestamp_seconds": round(timestamp_value, 6),
				"timestamp": timestamp,
				"path": relative(frame_path, root),
				"contact_sheet": relative(contact_sheet, root),
			}
		)

	return {
		"start_seconds": round(start, 6),
		"end_seconds": round(end, 6),
		"fps": round(fps, 9),
		"interval_seconds": round(1 / fps, 9),
		"frame_count": len(frames),
		"contact_sheet_count": len(contact_sheets),
		"frames": frames,
		"contact_sheets": [relative(path, root) for path in contact_sheets],
	}


def coverage_statement(manifest: dict[str, Any]) -> str:
	probe = manifest["probe"]
	full = manifest["full_timeline_sampling"]
	fps = format_decimal(full["fps"])
	parts = [
		f"Coverage: {probe['duration_seconds']:.2f}-second video",
		f"{full['frame_count']} full-timeline frames sampled at {fps} fps ({format_decimal(full['interval_seconds'])}-second interval)",
		f"{full['contact_sheet_count']} contact sheet(s)",
	]
	for focus in manifest.get("focused_intervals", []):
		parts.append(
			f"{focus['frame_count']} additional frames from {format_timestamp(focus['start_seconds'])} to {format_timestamp(focus['end_seconds'])} at {format_decimal(focus['fps'])} fps"
		)
	parts.append(
		"audio stream detected; transcription not performed"
		if probe["audio_present"]
		else "no audio stream"
	)
	return "; ".join(parts) + "."


def append_run_index(
	lines: list[str], title: str, run: dict[str, Any]
) -> None:
	lines.extend([f"## {title}", "", "Contact sheets:", ""])
	for path in run["contact_sheets"]:
		lines.append(f"- [{Path(path).name}]({path})")
	lines.extend(
		[
			"",
			"| Frame | Timestamp | Image | Contact sheet |",
			"| ---: | --- | --- | --- |",
		]
	)
	for frame in run["frames"]:
		lines.append(
			f"| {frame['index']} | `{frame['timestamp']}` | [{Path(frame['path']).name}]({frame['path']}) | [{Path(frame['contact_sheet']).name}]({frame['contact_sheet']}) |"
		)
	lines.append("")


def write_artifacts(root: Path, manifest: dict[str, Any]) -> str:
	coverage = coverage_statement(manifest)
	manifest["coverage_statement"] = coverage
	manifest["updated_at"] = datetime.now(timezone.utc).isoformat()
	(root / "manifest.json").write_text(
		json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8"
	)
	(root / "coverage.txt").write_text(coverage + "\n", encoding="utf-8")

	probe = manifest["probe"]
	lines = [
		"# Video Evidence Frame Index",
		"",
		f"**Question:** {manifest['question']}",
		"",
		f"**{coverage}**",
		"",
		f"Source: `{manifest['source']['filename']}` ({probe['width']}x{probe['height']}, {probe['video_codec']}, audio: {'yes' if probe['audio_present'] else 'no'})",
		"",
	]
	append_run_index(lines, "Full timeline", manifest["full_timeline_sampling"])
	for index, focus in enumerate(manifest.get("focused_intervals", []), start=1):
		append_run_index(
			lines,
			f"Focused interval {index}: {format_timestamp(focus['start_seconds'])}–{format_timestamp(focus['end_seconds'])}",
			focus,
		)
	(root / "frame-index.md").write_text("\n".join(lines), encoding="utf-8")
	return coverage


def validate_focus_args(args: argparse.Namespace, duration: float) -> bool:
	values = (args.start, args.end, args.fps)
	if all(value is None for value in values):
		return False
	if any(value is None for value in values):
		raise InspectionError(
			"Focused inspection requires --start, --end, and --fps together."
		)
	if args.start < 0 or args.end <= args.start or args.end > duration:
		raise InspectionError(
			f"Focused interval must satisfy 0 <= start < end <= {duration:.3f}."
		)
	if args.fps <= 0 or not math.isfinite(args.fps):
		raise InspectionError("--fps must be greater than zero.")
	return True


def main() -> int:
	args = parse_args()
	video = args.video.expanduser().resolve()
	try:
		check_dependencies()
		if not video.is_file():
			raise InspectionError(
				f"Local video file not found: {video}. Download remote evidence first."
			)
		probe = probe_video(video)
		is_focus = validate_focus_args(args, probe["duration_seconds"])
		if args.output_dir:
			root = args.output_dir.expanduser().resolve()
			root.mkdir(parents=True, exist_ok=True)
		else:
			root = Path(
				tempfile.mkdtemp(prefix=f"video-evidence-{slugify(video.stem)}-")
			).resolve()

		manifest_path = root / "manifest.json"
		video_hash = sha256_file(video)
		if is_focus:
			if not manifest_path.is_file():
				raise InspectionError(
					"Focused inspection requires an existing full-timeline evidence directory."
				)
			manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
			if manifest.get("source", {}).get("sha256") != video_hash:
				raise InspectionError(
					"The focused interval video does not match the existing evidence set."
				)
			focus_id = (
				f"focus-{round(args.start * 1000):09d}-{round(args.end * 1000):09d}-"
				f"{format_decimal(args.fps).replace('.', 'p')}fps"
			)
			focus = create_run(
				video,
				root,
				root / "focused" / focus_id,
				args.start,
				args.end,
				args.fps,
			)
			manifest.setdefault("focused_intervals", []).append(focus)
		else:
			if any(root.iterdir()):
				raise InspectionError(
					f"Full-timeline output directory must be empty: {root}"
				)
			fps = choose_sampling_fps(probe["duration_seconds"])
			full = create_run(
				video,
				root,
				root / "full",
				0,
				probe["duration_seconds"],
				fps,
			)
			manifest = {
				"schema_version": SCHEMA_VERSION,
				"created_at": datetime.now(timezone.utc).isoformat(),
				"question": args.question,
				"source": {"filename": video.name, "sha256": video_hash},
				"probe": probe,
				"full_timeline_sampling": full,
				"focused_intervals": [],
				"transcription": {
					"status": "not_performed" if probe["audio_present"] else "not_applicable",
					"reason": (
						"Audio stream detected; use a local or company-approved transcription workflow only if speech is relevant."
						if probe["audio_present"]
						else "No audio stream detected."
					),
				},
			}

		coverage = write_artifacts(root, manifest)
		print(f"Evidence directory: {root}")
		print(coverage)
		return 0
	except (InspectionError, PreflightError, json.JSONDecodeError) as error:
		print(f"Video inspection failed: {error}", file=sys.stderr)
		return 2


if __name__ == "__main__":
	raise SystemExit(main())
