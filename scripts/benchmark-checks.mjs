import { spawnSync } from "node:child_process";
import { performance } from "node:perf_hooks";

// Static commands only: run the same quality checks as CI, in the same order.
// Repeat tests to expose warm-cache variance instead of comparing one lucky run.
for (const [stage, repetitions] of [
	["lint", 1],
	["typecheck", 1],
	["test", 3],
]) {
	for (let trial = 1; trial <= repetitions; trial++) {
		const start = performance.now();
		const result = spawnSync(`pnpm ${stage}`, {
			shell: true,
			stdio: "inherit",
		});
		console.log(
			`DAYOVA_BENCHMARK ${JSON.stringify({
				stage,
				trial,
				seconds: (performance.now() - start) / 1000,
				exitCode: result.status,
				node: process.version,
				platform: process.platform,
				jestWorkers: process.env.CI_JEST_WORKERS ?? "1",
			})}`,
		);
		if (result.error) throw result.error;
		if (result.status !== 0) process.exit(result.status ?? 1);
	}
}
