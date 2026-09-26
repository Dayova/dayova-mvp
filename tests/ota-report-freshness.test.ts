// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { parse } from "yaml";

const workflow = parse(
	readFileSync(
		new URL("../.github/workflows/ota-report-freshness.yml", import.meta.url),
		"utf8",
	),
);
const script = workflow.jobs.reconcile.steps[0].with.script;
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
const reconcile = new AsyncFunction("github", "context", script);
const oldSha = "a".repeat(40);
const headSha = "b".repeat(40);
const newerSha = "c".repeat(40);
const report = (sha = oldSha) =>
	`<!-- dayova-ota-report -->\n## 📱 OTA compatibility\n**Checked commit:** \`${sha}\``;

function fixture(body = report()) {
	const comment = { id: 12, user: { login: "expo[bot]" }, body };
	const pr = {
		state: "open",
		base: { ref: "main", repo: { id: 1 } },
		head: { sha: headSha, repo: { id: 1 } },
		html_url: "https://github.com/Dayova/dayova-mvp/pull/740",
	};
	const context = {
		repo: { owner: "Dayova", repo: "dayova-mvp" },
		eventName: "pull_request_target",
		payload: {
			pull_request: { number: 740 },
			comment: structuredClone(comment),
			sender: { login: "expo[bot]" },
		},
	};
	const createCommitStatus = vi.fn();
	const github = {
		paginate: vi.fn(async () => [structuredClone(comment)]),
		rest: {
			pulls: { get: vi.fn(async () => ({ data: structuredClone(pr) })) },
			issues: {
				listComments: vi.fn(),
				getComment: vi.fn(async () => ({ data: structuredClone(comment) })),
			},
			repos: { createCommitStatus },
		},
	};
	return { comment, pr, context, github, createCommitStatus };
}

describe("OTA report freshness status", () => {
	it("marks a stale Expo report pending on the latest commit without writing comments", async () => {
		const f = fixture();
		await reconcile(f.github, f.context);
		expect(f.createCommitStatus).toHaveBeenCalledWith({
			owner: "Dayova",
			repo: "dayova-mvp",
			sha: headSha,
			context: "OTA report freshness",
			state: "pending",
			description: expect.stringContaining("compatibility unconfirmed"),
			target_url: `${f.pr.html_url}/checks`,
		});
		expect(f.comment.body).toBe(report());
	});

	it("marks a report current when Expo assesses the PR head", async () => {
		const f = fixture(report(headSha));
		await reconcile(f.github, f.context);
		expect(f.createCommitStatus).toHaveBeenCalledWith(
			expect.objectContaining({ sha: headSha, state: "success" }),
		);
	});

	it("tracks a same-repository stacked PR without running its code", async () => {
		expect(workflow.on.pull_request_target.branches).toBeUndefined();
		expect(workflow.on.pull_request_target.types).toContain("edited");
		const f = fixture();
		f.pr.base.ref = "codex/stack-parent";
		await reconcile(f.github, f.context);
		expect(f.createCommitStatus).toHaveBeenCalledWith(
			expect.objectContaining({ sha: headSha, state: "pending" }),
		);
		f.comment.body = report(headSha);
		await reconcile(f.github, f.context);
		expect(f.createCommitStatus).toHaveBeenCalledWith(
			expect.objectContaining({ sha: headSha, state: "success" }),
		);
	});

	it("uses an authenticated Expo event when the comment listing lags", async () => {
		const f = fixture();
		f.context.eventName = "issue_comment";
		f.context.payload.comment.body = report(headSha);
		await reconcile(f.github, f.context);
		expect(f.createCommitStatus).toHaveBeenCalledWith(
			expect.objectContaining({ sha: headSha, state: "success" }),
		);
	});

	it("marks a deleted Expo report pending even when a maintainer deletes it and the listing lags", async () => {
		expect(workflow.on.issue_comment.types).toContain("deleted");
		const f = fixture(report(headSha));
		f.context.eventName = "issue_comment";
		Object.assign(f.context.payload, { action: "deleted" });
		f.context.payload.sender.login = "maintainer";
		await reconcile(f.github, f.context);
		expect(f.github.rest.issues.getComment).not.toHaveBeenCalled();
		expect(f.createCommitStatus).toHaveBeenCalledWith(
			expect.objectContaining({ sha: headSha, state: "pending" }),
		);
	});

	it("ignores a report removed between listing and fetching comments", async () => {
		const f = fixture(report(headSha));
		f.github.rest.issues.getComment.mockRejectedValue({ status: 404 });
		await reconcile(f.github, f.context);
		expect(f.createCommitStatus).toHaveBeenCalledWith(
			expect.objectContaining({ sha: headSha, state: "pending" }),
		);
	});

	it("does not trust a report payload from another sender", async () => {
		const f = fixture();
		f.context.eventName = "issue_comment";
		f.context.payload.sender.login = "someone-else";
		f.context.payload.comment.body = report(headSha);
		await reconcile(f.github, f.context);
		expect(f.createCommitStatus).toHaveBeenCalledWith(
			expect.objectContaining({ sha: headSha, state: "pending" }),
		);
	});

	it("reads a head pushed during comment discovery", async () => {
		const f = fixture();
		f.github.paginate.mockImplementation(async () => {
			f.pr.head.sha = newerSha;
			return [structuredClone(f.comment)];
		});
		await reconcile(f.github, f.context);
		expect(f.createCommitStatus).toHaveBeenCalledWith(
			expect.objectContaining({ sha: newerSha, state: "pending" }),
		);
	});

	it("does not publish a status for closed or fork PRs", async () => {
		for (const invalid of [
			(pr: ReturnType<typeof fixture>["pr"]) => { pr.state = "closed"; },
			(pr: ReturnType<typeof fixture>["pr"]) => { pr.head.repo.id = 2; },
		]) {
			const f = fixture();
			invalid(f.pr);
			await reconcile(f.github, f.context);
			expect(f.github.paginate).not.toHaveBeenCalled();
			expect(f.createCommitStatus).not.toHaveBeenCalled();
		}
	});
});
