// @vitest-environment node
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test } from "vitest";
import { schoolMaterialPdf } from "../tests/fixtures/schoolMaterialPdf";

test.each([
	[1, 25, 8],
	[2, 12.5, 4],
])(
	"prepares and serializes %s PDF(s) of %s MiB below the action memory budget",
	(count, mib, pages) => {
		// Keep external package resolution next to the project's node_modules.
		mkdirSync("node_modules/.cache", { recursive: true });
		const directory = mkdtempSync(
			resolve("node_modules/.cache/material-memory-"),
		);
		try {
			const bundle = join(directory, "processing.cjs");
			const fixture = join(directory, "worksheet.pdf");
			writeFileSync(fixture, schoolMaterialPdf(mib * 1024 * 1024, pages));
			execFileSync(
				resolve("node_modules/.bin/esbuild"),
				[
					"convex/learningPlanAi.ts",
					"--bundle",
					"--platform=node",
					"--packages=external",
					"--format=cjs",
					`--outfile=${bundle}`,
				],
				{ stdio: "pipe" },
			);
			const output = execFileSync(
				process.execPath,
				[
					"--max-old-space-size=384",
					"tests/fixtures/materialMemoryRunner.cjs",
					bundle,
					fixture,
					String(count),
					String(mib * 1024 * 1024),
				],
				{ encoding: "utf8", timeout: 30000, stdio: ["ignore", "pipe", "pipe"] },
			);
			const result = JSON.parse(output.trim());
			expect(result.documents).toBe(count);
			expect(result.completedRequests).toBe(3);
			expect(result.peakActiveRequests).toBe(1);
			expect(result.rawBytes).toBe(25 * 1024 * 1024);
			expect(result.requestBytes).toBeGreaterThan(result.rawBytes);
			expect(result.requestBytes).toBeLessThan(35 * 1024 * 1024);
			expect(result.peakRssKiB).toBeLessThan(512 * 1024);
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	},
	40000,
);
