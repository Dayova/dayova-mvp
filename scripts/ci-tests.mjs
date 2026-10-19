import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";

const directory = resolve(".maestro/artifacts/ci");
mkdirSync(directory, { recursive: true });
const coverage =
	process.argv.includes("--coverage") || process.env.CI_COVERAGE === "true";
const stages = [
	[
		"vitest",
		[
			"exec",
			"vitest",
			"run",
			"--reporter=default",
			"--reporter=junit",
			`--outputFile.junit=${directory}/vitest.xml`,
			...(coverage ? ["--coverage"] : []),
		],
	],
	["metro", ["run", "test:unit:metro-cache"]],
	["autolinking", ["run", "test:unit:android-autolinking"]],
	["skills", ["run", "test:unit:skills"]],
	[
		"jest",
		[
			"exec",
			"jest",
			"--json",
			`--outputFile=${directory}/jest.json`,
			...(coverage ? ["--coverage"] : []),
		],
	],
];
const results = [];
for (const [stage, args] of stages) {
	const start = performance.now();
	const exitCode = await new Promise((resolve, reject) => {
		const child = spawn(
			process.platform === "win32" ? "pnpm.cmd" : "pnpm",
			args,
			{
				shell: process.platform === "win32",
				stdio: "inherit",
				env: { ...process.env, EAS_BUILD: "false" },
			},
		);
		child.once("error", reject);
		child.once("exit", (code) => resolve(code ?? 1));
	});
	const result = {
		stage,
		seconds: (performance.now() - start) / 1000,
		exitCode,
	};
	results.push(result);
	writeFileSync(
		`${directory}/timings.json`,
		JSON.stringify(
			{
				sourceSha:
					process.env.EAS_BUILD_GIT_COMMIT_HASH ??
					process.env.GITHUB_SHA ??
					null,
				node: process.version,
				coverage,
				results,
			},
			null,
			2,
		),
	);
	console.log(`DAYOVA_CI_STAGE ${JSON.stringify(result)}`);
	if (exitCode !== 0) process.exit(exitCode);
}
