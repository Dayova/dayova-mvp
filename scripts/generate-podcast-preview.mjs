// Rebuild the clearly labelled local simulator fixture on macOS. No cloud API.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const script = JSON.parse(
	readFileSync(
		new URL(
			"../src/features/learning-plans/podcast-preview-script.json",
			import.meta.url,
		),
		"utf8",
	),
);
const directory = mkdtempSync(join(tmpdir(), "dayova-podcast-audio-"));
const inputs = [];
for (const [index, turn] of script.turns.entries()) {
	const output = join(directory, `${index}.aiff`);
	execFileSync("say", [
		"-v",
		turn.speaker === "Mira" ? "Anna" : "Eddy (Deutsch (Deutschland))",
		"-r",
		"165",
		"-o",
		output,
		turn.text,
	]);
	inputs.push("-i", output);
}
execFileSync(
	"ffmpeg",
	[
		"-y",
		...inputs,
		"-filter_complex",
		`${script.turns.map((_, index) => `[${index}:a]`).join("")}concat=n=${script.turns.length}:v=0:a=1[out]`,
		"-map",
		"[out]",
		"-c:a",
		"aac",
		"-b:a",
		"96k",
		new URL("../assets/podcast-preview.m4a", import.meta.url).pathname,
	],
	{ stdio: "inherit" },
);
