// @vitest-environment node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const workflow = parse(
	readFileSync(new URL("../.eas/workflows/ci.yml", import.meta.url), "utf8"),
);

// These workflow conditions use the shared JS/EAS boolean and comparison syntax.
const evaluate = (expression: string, context: Record<string, unknown>) =>
	runInNewContext(expression.slice(3, -2), {
		...context,
		contains: (value: string, part: string) => value.includes(part),
	});

const event = (eventName: string, association = "MEMBER", fork = false) => ({
	event_name: eventName,
	ref_name: eventName === "push" ? "main" : "feature",
	repository: "Dayova/dayova-mvp",
	event: {
		pull_request: {
			author_association: association,
			head: {
				repo: { full_name: fork ? "external/fork" : "Dayova/dayova-mvp" },
			},
		},
	},
});

describe("PR OTA workflow routing", () => {
	it.each([
		["owner PR", event("pull_request", "OWNER"), true],
		["member PR", event("pull_request"), true],
		["collaborator PR", event("pull_request", "COLLABORATOR"), true],
		["untrusted PR", event("pull_request", "CONTRIBUTOR"), false],
		["trusted fork PR", event("pull_request", "MEMBER", true), false],
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
		expect(canRun("production_fingerprint")).toBe(expected);
		expect(canRun("ota_checks")).toBe(expected);
		const publicationContext = {
			...context,
			needs: { ota_checks: { outputs: { ota_safe: "true" } } },
		};
		const isMainPush = github.event_name === "push" && github.ref_name === "main";
		expect(
			Boolean(evaluate(workflow.jobs.send_updates.if, publicationContext)),
		).toBe(isMainPush);
		expect(Boolean(evaluate(workflow.jobs.deploy_convex.if, context))).toBe(
			isMainPush,
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
		const command = step.run.replace(
			/\$\{\{.*?\}\}/g,
			(expression: string) => String(evaluate(expression, context)),
		);
		const bash = process.platform === "win32"
			? join(process.env.ProgramFiles ?? "C:/Program Files", "Git/bin/bash.exe")
			: "bash";
		const result = spawnSync(bash, ["-c", command], { encoding: "utf8" });
		expect(result.error).toBeUndefined();
		expect(result.status).toBe(expected);
	});

	it.each([
		["success", "true", "true"],
		["success", "false", "false"],
		["failure", "true", "Not confirmed"],
		["skipped", undefined, "Not confirmed"],
	])("reports %s / %s without claiming unassessed safety", (status, safe, expected) => {
		const report = workflow.jobs.pr_ota_report;
		expect(report.needs).toBeUndefined();
		expect(report.after).toEqual(
			expect.arrayContaining(["production_fingerprint", "ota_checks"]),
		);
		const context = {
			after: {
				production_fingerprint: { status },
				ota_checks: { status, outputs: { ota_safe: safe } },
			},
		};
		const rendered = report.params.md.replace(
			/\$\{\{.*?\}\}/g,
			(expression: string) => String(evaluate(expression, context)),
		);
		expect(rendered).toContain(`**OTA-compatible:** ${expected}`);
	});
});
