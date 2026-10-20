// @vitest-environment node
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sanitizeMaestroArtifacts } from "../scripts/ci-sanitize-maestro.mjs";

const credentials = {
	NODE_ENV: "test" as const,
	MAESTRO_CI_EMAIL: "synthetic+clerk_test@example.com",
	MAESTRO_CI_PASSWORD: 'fixture/secret+"password',
};

describe("Maestro artifact upload boundary", () => {
	it("redacts expanded credentials while retaining valid reports and screenshots", () => {
		const root = mkdtempSync(join(tmpdir(), "dayova-maestro-redaction-"));
		const directory = join(root, ".maestro", "tests");
		mkdirSync(directory, { recursive: true });
		try {
			writeFileSync(
				join(directory, "commands.json"),
				JSON.stringify({ env: credentials }),
			);
			writeFileSync(
				join(directory, "maestro.log"),
				[
					credentials.MAESTRO_CI_PASSWORD,
					encodeURIComponent(credentials.MAESTRO_CI_PASSWORD),
					Buffer.from(credentials.MAESTRO_CI_PASSWORD).toString("base64"),
				].join("\n"),
			);
			writeFileSync(join(directory, "report.xml"), '<testsuite failures="1"/>');
			const screenshot = Buffer.from([137, 80, 78, 71, 0, 255]);
			writeFileSync(join(directory, "screenshot.png"), screenshot);
			expect(sanitizeMaestroArtifacts(directory, credentials)).toMatchObject({
				redacted: 2,
				removed: 0,
			});
			const commands = JSON.parse(
				readFileSync(join(directory, "commands.json"), "utf8"),
			);
			expect(commands.env.MAESTRO_CI_EMAIL).toBe("[redacted]");
			expect(commands.env.MAESTRO_CI_PASSWORD).toBe("[redacted]");
			expect(readFileSync(join(directory, "maestro.log"), "utf8")).toBe(
				"[redacted]\n[redacted]\n[redacted]",
			);
			expect(readFileSync(join(directory, "report.xml"), "utf8")).toBe(
				'<testsuite failures="1"/>',
			);
			expect(readFileSync(join(directory, "screenshot.png"))).toEqual(
				screenshot,
			);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});
	it("removes an artifact tree if credentials needed for redaction are unavailable", () => {
		const root = mkdtempSync(join(tmpdir(), "dayova-maestro-fail-closed-"));
		const directory = join(root, ".maestro", "tests");
		mkdirSync(directory, { recursive: true });
		try {
			writeFileSync(join(directory, "commands.json"), "unsanitized debug data");
			expect(() =>
				sanitizeMaestroArtifacts(directory, { NODE_ENV: "test" }),
			).toThrow("credentials");
			expect(existsSync(directory)).toBe(false);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});
});
