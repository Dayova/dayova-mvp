// @vitest-environment node
import type { spawnSync } from "node:child_process";
import {
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
	writeSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runDeviceSmoke } from "../scripts/ci-run-maestro.mjs";

const env = {
	NODE_ENV: "test" as const,
	MAESTRO_APP_ID: "de.dayova.app-dev",
	MAESTRO_CI_EMAIL: "ci+clerk_test@example.com",
	MAESTRO_CI_PASSWORD: "synthetic-secret-password",
};

describe("device smoke diagnostics before upload", () => {
	it.each([
		[0, 0, 0],
		[1, 0, 1],
		[0, 1, 1],
	])("handles test exit %i and diagnostics exit %i with final exit %i", (status, diagnosticStatus, expected) => {
		const root = mkdtempSync(join(tmpdir(), "dayova-device-artifacts-"));
		const directory = join(root, ".maestro/tests");
		// Only native command execution is simulated. The real consumer writes,
		// collects and sanitizes its complete artifact tree before returning.
		const execute = ((command, args, options) => {
			if (command === "maestro") {
				writeFileSync(
					join(directory, "report.xml"),
					`<testsuite tests="1" failures="${status}"/>`,
				);
				writeFileSync(
					join(directory, "commands.json"),
					JSON.stringify({ text: env.MAESTRO_CI_PASSWORD }),
				);
				return { status };
			}
			if (command === "xcrun" && args?.includes("log")) {
				writeSync(
					(options?.stdio as number[])[1],
					`Native log: ${env.MAESTRO_CI_EMAIL} ${env.MAESTRO_CI_PASSWORD}`,
				);
				return { status: diagnosticStatus };
			}
			return { status: 0 };
		}) as typeof spawnSync;
		try {
			expect(
				runDeviceSmoke("test.app", "full", { env, execute, directory }),
			).toBe(expected);
			expect(readFileSync(join(directory, "report.xml"), "utf8")).toContain(
				`failures="${status}"`,
			);
			const deviceLog = readFileSync(join(directory, "device.log"), "utf8");
			expect(deviceLog).toBe("Native log: [redacted] [redacted]");
			expect(
				readFileSync(join(directory, "commands.json"), "utf8"),
			).not.toContain(env.MAESTRO_CI_PASSWORD);
			expect(
				JSON.parse(readFileSync(join(directory, "result.json"), "utf8")),
			).toMatchObject({ exitCode: expected, redaction: { redacted: 2 } });
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});
});
