// @vitest-environment node
import { spawnSync } from "node:child_process";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const biome = require.resolve("@biomejs/biome/bin/biome");
const workspace = mkdtempSync(join(tmpdir(), "dayova-biome-coverage-"));

beforeAll(() => {
	const git = spawnSync("git", ["init", "--quiet", workspace]);
	expect(git.status).toBe(0);
	writeFileSync(join(workspace, "biome.jsonc"), readFileSync("biome.jsonc"));
	writeFileSync(join(workspace, ".gitignore"), readFileSync(".gitignore"));
});

afterAll(() => rmSync(workspace, { recursive: true, force: true }));

function lint(filePath: string, input: string) {
	const path = join(workspace, filePath);
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, input);
	const result = spawnSync(
		process.execPath,
		// Unlike Biome's experimental JSON reporter, RDJSON escapes Windows paths.
		[biome, "lint", filePath, "--reporter=rdjson"],
		{ cwd: workspace, encoding: "utf8", timeout: 10_000 },
	);
	expect(result.error).toBeUndefined();
	expect(result.status, result.stderr).toBe(1);
	expect(result.stdout, result.stderr).not.toBe("");
	const report = JSON.parse(result.stdout) as {
		diagnostics: { code: { value: string } }[];
	};
	return report.diagnostics.map(({ code }) => code.value);
}

describe("Biome file coverage", () => {
	it.each([
		"src/example.tsx",
		"convex/example.ts",
		"scripts/example.mjs",
		"plugins/example.js",
		"tests/example.test.ts",
		"eslint/example.mjs",
		"modules/example/src/index.ts",
		"eslint.config.mjs",
		"jest.config.cjs",
		"vitest.config.ts",
	])("checks JavaScript/TypeScript in %s", (filePath) => {
		expect(lint(filePath, "debugger;")).toContain("lint/suspicious/noDebugger");
	});

	it.each([
		"knip.jsonc",
		"eas.json",
		".vscode/extensions.json",
	])("checks JSON configuration in %s", (filePath) => {
		expect(lint(filePath, '{ "example": 1, "example": 2 }')).toContain(
			"lint/suspicious/noDuplicateObjectKeys",
		);
	});
});
