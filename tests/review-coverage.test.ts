// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { parse } from "yaml";

const workflow = parse(
	readFileSync(".github/workflows/review-coverage.yml", "utf8"),
);

describe("automated review coverage status reconciliation", () => {
	it.each([
		[undefined, undefined, "pending"],
		["success", "Review skipped: draft pull request", "pending"],
		["success", "Review rate limited", "pending"],
		["pending", "Review in progress", "pending"],
		["success", "Unknown provider result", "pending"],
		["failure", "Review failed", "failure"],
		["success", "Review completed", "success"],
	])("reports %s / %s truthfully", async (state, description, expected) => {
		const write = vi.fn();
		const run = new Function(
			"context",
			"github",
			`return (async () => { ${workflow.jobs.coverage.steps[0].with.script} })()`,
		);
		await run(
			{
				repo: { owner: "Dayova", repo: "dayova-mvp" },
				payload: { pull_request: { head: { sha: "current-commit" } } },
			},
			{
				paginate: async () =>
					state ? [{ context: "CodeRabbit", state, description }] : [],
				rest: {
					repos: {
						listCommitStatusesForRef: vi.fn(),
						createCommitStatus: write,
					},
				},
			},
		);
		expect(write).toHaveBeenCalledWith(
			expect.objectContaining({ sha: "current-commit", state: expected }),
		);
	});
});
