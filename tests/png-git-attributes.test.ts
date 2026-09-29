// @vitest-environment node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = fileURLToPath(new URL("..", import.meta.url));
const png = readFileSync(new URL("../assets/dayova-logo.png", import.meta.url));
const gitHash = (...args: string[]) =>
	execFileSync("git", ["-c", "core.ignorecase=false", "hash-object", ...args, "--stdin"], {
		cwd: root,
		input: png,
		encoding: "utf8",
	}).trim();

it.each(["png", "pnG", "pNg", "pNG", "Png", "PnG", "PNg", "PNG"])(
	"preserves PNG bytes with .%s extensions on case-sensitive workers",
	(extension) => {
		expect(gitHash(`--path=screenshot.${extension}`)).toBe(gitHash("--no-filters"));
	},
);
