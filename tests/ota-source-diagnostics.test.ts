// @vitest-environment node
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { parse } from "yaml";

const workflow = parse(
	readFileSync(
		new URL("../.eas/workflows/ota-source-diagnostics.yml", import.meta.url),
		"utf8",
	),
);
const bash =
	process.platform === "win32"
		? join(process.env.ProgramFiles ?? "C:/Program Files", "Git/bin/bash.exe")
		: "bash";

it("accepts main history and rejects unrelated, missing, or malformed source commits", () => {
	const directory = mkdtempSync(join(tmpdir(), "dayova-source-guard-"));
	const git = (...args: string[]) =>
		execFileSync("git", args, {
			cwd: directory,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
		}).trim();
	try {
		git("init", "-b", "main");
		const commit = () =>
			git(
				"-c",
				"user.name=Dayova Test",
				"-c",
				"user.email=synthetic@example.invalid",
				"-c",
				"core.hooksPath=/dev/null",
				"commit",
				"--allow-empty",
				"-m",
				"test fixture",
			);
		commit();
		const mainSha = git("rev-parse", "HEAD");
		git("checkout", "-b", "unmerged");
		commit();
		const unmergedSha = git("rev-parse", "HEAD");
		git("checkout", "main");
		const guard = workflow.jobs.verify_source.steps.find(
			(step: { id?: string }) => step.id === "verify_source",
		).run;
		for (const [sha, accepted] of [
			[mainSha, true],
			[unmergedSha, false],
			["f".repeat(40), false],
			["invalid", false],
		] as const) {
			const result = spawnSync(
				bash,
				[
					"-c",
					`set-output() { printf '__OUTPUT__%s=%s\\n' "$1" "$2"; }\n${guard.replace("${{ inputs.source_sha }}", sha)}`,
				],
				{ cwd: directory, encoding: "utf8", timeout: 5000 },
			);
			expect(result.error).toBeUndefined();
			if (accepted) {
				expect(result.status, result.stderr).toBe(0);
				expect(result.stdout).toContain(`__OUTPUT__source_sha=${mainSha}`);
			} else {
				expect(result.status, sha).not.toBe(0);
				expect(result.stdout).not.toContain("__OUTPUT__");
			}
		}
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

it("verifies trusted main before giving production diagnostics the approved source", () => {
	const verifier = workflow.jobs.verify_source,
		diagnose = workflow.jobs.diagnose;
	expect(
		verifier.steps.filter(
			(step: { uses?: string }) => step.uses === "eas/checkout",
		),
	).toEqual(
		expect.arrayContaining([
			expect.objectContaining({
				with: expect.objectContaining({ ref: "refs/heads/main" }),
			}),
		]),
	);
	expect(verifier.environment).toBeUndefined();
	expect(diagnose.needs).toContain("verify_source");
	expect(verifier.outputs.source_sha).toBe(
		"${{ steps.verify_source.outputs.source_sha }}",
	);
	expect(
		diagnose.steps.filter(
			(step: { uses?: string }) => step.uses === "eas/checkout",
		),
	).toEqual(
		expect.arrayContaining([
			expect.objectContaining({
				with: expect.objectContaining({
					ref: "${{ needs.verify_source.outputs.source_sha }}",
				}),
			}),
		]),
	);
	expect(diagnose.env.OTA_SOURCE_SHA).toBe(
		"${{ needs.verify_source.outputs.source_sha }}",
	);
});
