// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { parse } from "yaml";

const workflow = parse(
	readFileSync(".github/workflows/review-coverage.yml", "utf8"),
);

const run = new Function(
	"context",
	"github",
	`return (async () => { ${workflow.jobs.coverage.steps[0].with.script} })()`,
);

function fixture(statuses: object[] = [], providerEvent = false) {
	const pr = {
		number: 42,
		state: "open",
		draft: false,
		head: { sha: "current-commit" },
	};
	const context = {
		repo: { owner: "Dayova", repo: "dayova-mvp" },
		payload: providerEvent ? { sha: "current-commit" } : { pull_request: pr },
	};
	const write = vi.fn();
	const listAssociated = vi.fn();
	const github = {
		paginate: vi.fn(async (endpoint: unknown) =>
			endpoint === listAssociated ? [pr] : statuses,
		),
		rest: {
			pulls: { get: vi.fn(async () => ({ data: structuredClone(pr) })) },
			repos: {
				listPullRequestsAssociatedWithCommit: listAssociated,
				listCommitStatusesForRef: vi.fn(),
				createCommitStatus: write,
			},
		},
	};
	return { pr, context, github, write };
}

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
		const f = fixture(
			state ? [{ context: "CodeRabbit", state, description }] : [],
		);
		await run(f.context, f.github);
		expect(f.write).toHaveBeenCalledWith(
			expect.objectContaining({ sha: "current-commit", state: expected }),
		);
	});

	it.each([
		false,
		true,
	])("ignores draft PRs (provider event: %s)", async (providerEvent) => {
		const f = fixture([], providerEvent);
		f.pr.draft = true;
		await run(f.context, f.github);
		expect(f.write).not.toHaveBeenCalled();
	});

	it.each([
		"closed",
		"stale",
		"unassociated",
	])("ignores %s provider events", async (kind) => {
		const f = fixture([], true);
		if (kind === "closed") f.pr.state = "closed";
		if (kind === "stale") f.pr.head.sha = "newer-commit";
		if (kind === "unassociated") f.github.paginate.mockResolvedValue([]);
		await run(f.context, f.github);
		expect(f.write).not.toHaveBeenCalled();
	});

	it("reconciles provider completion for a ready PR", async () => {
		const f = fixture(
			[
				{
					context: "CodeRabbit",
					state: "success",
					description: "Review completed",
				},
			],
			true,
		);
		await run(f.context, f.github);
		expect(f.write).toHaveBeenCalledWith(
			expect.objectContaining({ state: "success" }),
		);
	});

	it.each([
		"draft",
		"closed",
		"stale",
	])("does not publish if the PR becomes %s while provider statuses are read", async (kind) => {
		const f = fixture([], true);
		const paginate = f.github.paginate.getMockImplementation();
		if (!paginate) throw new Error("Missing pagination fixture");
		f.github.paginate.mockImplementation(async (endpoint) => {
			if (endpoint === f.github.rest.repos.listCommitStatusesForRef) {
				if (kind === "draft") f.pr.draft = true;
				if (kind === "closed") f.pr.state = "closed";
				if (kind === "stale") f.pr.head.sha = "newer-commit";
			}
			return paginate(endpoint);
		});
		await run(f.context, f.github);
		expect(f.write).not.toHaveBeenCalled();
	});

	it("fails closed when live PR refresh fails after provider status retrieval", async () => {
		const f = fixture([], true);
		const paginate = f.github.paginate.getMockImplementation();
		if (!paginate) throw new Error("Missing pagination fixture");
		f.github.paginate.mockImplementation(async (endpoint) => {
			if (endpoint === f.github.rest.repos.listCommitStatusesForRef) {
				f.github.rest.pulls.get.mockRejectedValue(
					new Error("GitHub unavailable"),
				);
			}
			return paginate(endpoint);
		});
		await expect(run(f.context, f.github)).rejects.toThrow(
			"GitHub unavailable",
		);
		expect(f.write).not.toHaveBeenCalled();
	});

	it("fails without a status if the current PR cannot be read", async () => {
		const f = fixture([], true);
		f.github.rest.pulls.get.mockRejectedValue(new Error("GitHub unavailable"));
		await expect(run(f.context, f.github)).rejects.toThrow(
			"GitHub unavailable",
		);
		expect(f.write).not.toHaveBeenCalled();
	});
});
