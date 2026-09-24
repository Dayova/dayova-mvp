// @vitest-environment node
import { spawnSync } from "node:child_process";
import {
	mkdtempSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const workflow = parse(
	readFileSync(new URL("../.eas/workflows/ci.yml", import.meta.url), "utf8"),
);

const bash =
	process.platform === "win32"
		? join(process.env.ProgramFiles ?? "C:/Program Files", "Git/bin/bash.exe")
		: "bash";

const validReport = {
	safe: false,
	failureKind: "compatibility",
	reason: "Native fingerprint changed",
	baseline: "Verified distributed builds",
	currentFingerprints: "ios hash, android hash",
};

// Run the actual workflow shell with only the report producer replaced.
const runReportGuard = (report: string, exitStatus = 1) => {
	const directory = mkdtempSync(join(tmpdir(), "dayova-ota-report-"));
	try {
		mkdirSync(join(directory, "scripts"));
		writeFileSync(
			join(directory, "scripts/ota-safety.mjs"),
			"process.stdout.write(process.env.OTA_TEST_REPORT); process.exitCode = Number(process.env.OTA_TEST_STATUS);",
		);
		const guard = workflow.jobs.ota_checks.steps.find(
			(step: { id?: string }) => step.id === "ota_guard",
		);
		return spawnSync(
			bash,
			[
				"-c",
				`set-output() { printf '__OUTPUT__%s=%s\\n' "$1" "$2"; }\n${guard.run}`,
			],
			{
				cwd: directory,
				encoding: "utf8",
				env: {
					...process.env,
					OTA_TEST_REPORT: report,
					OTA_TEST_STATUS: String(exitStatus),
				},
			},
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
};

describe("OTA workflow report validation", () => {
	it.each([
		["empty", "", 1],
		["malformed JSON", "{", 1],
		["null", "null", 1],
		[
			"missing failure kind",
			JSON.stringify({ ...validReport, failureKind: undefined }),
			1,
		],
		[
			"unknown failure kind",
			JSON.stringify({ ...validReport, failureKind: "unexpected" }),
			1,
		],
		[
			"missing reason",
			JSON.stringify({ ...validReport, reason: undefined }),
			1,
		],
		[
			"missing safe flag",
			JSON.stringify({ ...validReport, safe: undefined }),
			1,
		],
		[
			"inconsistent safe flag",
			JSON.stringify({ ...validReport, safe: true }),
			0,
		],
		["inconsistent exit status", JSON.stringify(validReport), 0],
		["unexpected process exit", JSON.stringify(validReport), 2],
	])("rejects %s before exporting any verdict", (_label, report, status) => {
		const result = runReportGuard(report, status);
		expect(result.error).toBeUndefined();
		expect(result.status).not.toBe(0);
		expect(result.stdout).not.toContain("__OUTPUT__");
	});

	it.each([
		[true, null, 0],
		[false, "compatibility", 1],
		[false, "preflight", 1],
	])("exports a valid %s / %s assessment", (safe, failureKind, status) => {
		const result = runReportGuard(
			JSON.stringify({ ...validReport, safe, failureKind }),
			status,
		);
		expect(result.error).toBeUndefined();
		expect(result.status).toBe(0);
		expect(result.stdout).toContain(`__OUTPUT__ota_safe=${safe}`);
		expect(result.stdout).toContain(
			`__OUTPUT__ota_failure_kind=${failureKind}`,
		);
	});
});

// These workflow conditions use the shared JS/EAS boolean and comparison syntax.
const evaluate = (expression: string, context: Record<string, unknown>) =>
	runInNewContext(expression.slice(3, -2), {
		...context,
		contains: (value: string, part: string) => value.includes(part),
	});

const event = (
	eventName: string,
	association = "MEMBER",
	fork = false,
	baseRef = "main",
) => ({
	event_name: eventName,
	sha: "0123456789abcdef0123456789abcdef01234567",
	ref_name: eventName === "push" ? "main" : "feature",
	// Do not assume EAS's convenience field uses GitHub's owner/name format.
	repository: "dayova-mvp",
	event: {
		pull_request: {
			author_association: association,
			head: {
				repo: {
					id: fork ? 456 : 123,
					full_name: fork ? "external/fork" : "Dayova/dayova-mvp",
				},
			},
			base: { ref: baseRef, repo: { id: 123, full_name: "Dayova/dayova-mvp" } },
		},
	},
});

describe("PR OTA workflow routing", () => {
	it("starts for PRs targeting stack branches as well as main", () => {
		expect(workflow.on.pull_request.branches).toBeUndefined();
		expect(workflow.on.pull_request.types).toContain("synchronize");
	});

	it.each([undefined, null])("rejects missing repository IDs (%s)", (id) => {
		const github = event("pull_request");
		const pullRequest = github.event.pull_request;
		expect(
			Boolean(
				evaluate(workflow.jobs.source_gate.if, {
					github: {
						...github,
						event: {
							pull_request: {
								...pullRequest,
								head: { repo: { ...pullRequest.head.repo, id } },
								base: { repo: { ...pullRequest.base.repo, id } },
							},
						},
					},
				}),
			),
		).toBe(false);
	});

	it.each([
		["owner PR", event("pull_request", "OWNER"), true],
		["member PR", event("pull_request"), true],
		["collaborator PR", event("pull_request", "COLLABORATOR"), true],
		[
			"trusted stacked PR",
			event("pull_request", "MEMBER", false, "codex/parent"),
			true,
		],
		["untrusted PR", event("pull_request", "CONTRIBUTOR"), false],
		["owner fork PR", event("pull_request", "OWNER", true), false],
		["member fork PR", event("pull_request", "MEMBER", true), false],
		[
			"collaborator fork PR",
			event("pull_request", "COLLABORATOR", true),
			false,
		],
		["main push", event("push"), true],
		["other push", { ...event("push"), ref_name: "feature" }, false],
		["manual CI", event("workflow_dispatch"), false],
	])("routes %s to production compatibility checks", (_label, github, expected) => {
		const context = { github };
		const canRun = (id: string): boolean => {
			const job = workflow.jobs[id];
			return (
				(!job.if || Boolean(evaluate(job.if, context))) &&
				(job.needs ?? []).every(canRun)
			);
		};
		expect(canRun("checks")).toBe(
			expected || github.event_name === "workflow_dispatch",
		);
		expect(canRun("production_fingerprint")).toBe(expected);
		expect(canRun("ota_checks")).toBe(expected);
		const publicationContext = {
			...context,
			needs: { ota_checks: { outputs: { ota_safe: "true" } } },
		};
		const isMainPush =
			github.event_name === "push" && github.ref_name === "main";
		expect(
			Boolean(evaluate(workflow.jobs.send_updates.if, publicationContext)),
		).toBe(isMainPush);
		expect(Boolean(evaluate(workflow.jobs.deploy_convex.if, context))).toBe(
			isMainPush,
		);
		expect(Boolean(evaluate(workflow.jobs.pr_ota_comment.if, context))).toBe(
			github.event_name === "pull_request",
		);
	});

	it.each([
		["null", 0],
		["compatibility", 0],
		["preflight", 1],
	])("handles a %s assessment result", (failureKind, expected) => {
		const step = workflow.jobs.ota_checks.steps.find(
			(value: { name?: string }) =>
				value.name === "Require a completed PR OTA assessment",
		);
		expect(evaluate(step.if, { github: event("pull_request") })).toBe(true);
		expect(evaluate(step.if, { github: event("push") })).toBe(false);
		const context = {
			steps: { ota_guard: { outputs: { ota_failure_kind: failureKind } } },
		};
		const command = step.run.replace(/\$\{\{.*?\}\}/g, (expression: string) =>
			String(evaluate(expression, context)),
		);
		const result = spawnSync(bash, ["-c", command], { encoding: "utf8" });
		expect(result.error).toBeUndefined();
		expect(result.status).toBe(expected);
	});

	it.each([
		["success", "true", "✅ OTA-compatible"],
		["success", "false", "⚠️ Not OTA-compatible"],
		["failure", "true", "❓ Compatibility not confirmed"],
		["skipped", undefined, "❓ Compatibility not confirmed"],
	])("reports %s / %s without claiming unassessed safety", (status, safe, expected) => {
		const report = workflow.jobs.pr_ota_report;
		expect(report.needs).toBeUndefined();
		expect(report.after).toEqual(
			expect.arrayContaining(["production_fingerprint", "ota_checks"]),
		);
		const context = {
			github: event("pull_request"),
			workflow: {
				url: "https://expo.dev/accounts/dayova/projects/dayova/workflows/test-run",
			},
			after: {
				production_fingerprint: { status, outputs: {} },
				ota_checks: { status, outputs: { ota_safe: safe } },
			},
		};
		const rendered = report.params.md.replace(
			/\$\{\{.*?\}\}/g,
			(expression: string) => String(evaluate(expression, context)),
		);
		expect(rendered).toContain(`### ${expected}`);
		expect(rendered).toContain(context.github.sha);
		expect(rendered).toContain(`[View EAS run](${context.workflow.url})`);

		// Both destinations render the same template, including failed assessments.
		const comment = workflow.jobs.pr_ota_comment;
		expect(comment.type).toBe("github-comment");
		expect(comment.needs).toBeUndefined();
		expect(comment.after).toEqual(report.after);
		const commentBody = comment.params.payload.replace(
			/\$\{\{.*?\}\}/g,
			(expression: string) => String(evaluate(expression, context)),
		);
		expect(commentBody).toBe(rendered);
	});
});
