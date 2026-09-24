// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { parse } from "yaml";

const workflow = parse(
	readFileSync(
		new URL("../.github/workflows/ota-comment-freshness.yml", import.meta.url),
		"utf8",
	),
);
const script = workflow.jobs.mark_pending.steps[0].with.script;
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
const reconcile = new AsyncFunction("github", "context", script);
const marker = "<!-- dayova-ota-report -->";
const easMarker = "<!-- eas-comment-id: preserved-native-identifier -->";
const oldSha = "a".repeat(40);
const headSha = "b".repeat(40);
const newerSha = "c".repeat(40);
const report = (sha = oldSha, verdict = "✅ OTA-compatible") =>
	`${marker}\n## 📱 OTA compatibility\n### ${verdict}\n**Checked commit:** \`${sha}\`\n${easMarker}`;

function fixture(body = report()) {
	const comment = { id: 12, user: { login: "expo[bot]" }, body };
	const pr = {
		state: "open",
		base: { ref: "main" },
		head: { sha: headSha },
		html_url: "https://github.com/Dayova/dayova-mvp/pull/645",
	};
	const context = {
		repo: { owner: "Dayova", repo: "dayova-mvp" },
		eventName: "pull_request_target",
		payload: {
			pull_request: { number: 645 },
			comment: { ...comment },
			sender: { login: "expo[bot]" },
		},
	};
	const updateComment = vi.fn(async ({ body }: { body: string }) => {
		comment.body = body;
	});
	const github = {
		paginate: vi.fn(async () => [{ ...comment }]),
		rest: {
			pulls: { get: vi.fn(async () => ({ data: structuredClone(pr) })) },
			issues: {
				listComments: vi.fn(),
				getComment: vi.fn(async () => ({ data: { ...comment } })),
				updateComment,
			},
		},
	};
	return { comment, pr, context, github, updateComment };
}

describe("OTA comment freshness", () => {
	it("replaces the old green verdict in the same comment on a new commit", async () => {
		const f = fixture();
		await reconcile(f.github, f.context);
		expect(f.updateComment).toHaveBeenCalledWith({
			owner: "Dayova",
			repo: "dayova-mvp",
			comment_id: 12,
			body: expect.any(String),
		});
		expect(f.comment.body).toContain("⏳ Latest commit not yet evaluated");
		expect(f.comment.body).toContain(`**Latest commit:** \`${headSha}\``);
		expect(f.comment.body).toContain(
			`**Previous assessed commit:** \`${oldSha}\``,
		);
		expect(f.comment.body).toContain("**OTA compatibility is not confirmed.**");
		expect(f.comment.body).not.toContain("✅ OTA-compatible");
		expect(f.comment.body).toContain(easMarker);
		expect(f.comment.body).toContain(`${f.pr.html_url}/checks`);
	});

	it.each([
		"✅ OTA-compatible",
		"! Not OTA-compatible",
		"❓ Compatibility not confirmed",
	])("preserves a completed current-head result: %s", async (verdict) => {
		const f = fixture(report(headSha, verdict));
		await reconcile(f.github, f.context);
		expect(f.updateComment).not.toHaveBeenCalled();
	});

	it("is idempotent and advances pending text to the latest live head", async () => {
		const f = fixture();
		await reconcile(f.github, f.context);
		await reconcile(f.github, f.context);
		expect(f.updateComment).toHaveBeenCalledTimes(1);
		f.pr.head.sha = newerSha;
		await reconcile(f.github, f.context);
		expect(f.comment.body).toContain(`**Latest commit:** \`${newerSha}\``);
		expect(f.comment.body).toContain(
			`**Previous assessed commit:** \`${oldSha}\``,
		);
	});

	it("marks a late EAS result for an older commit as unconfirmed", async () => {
		const f = fixture();
		f.context.eventName = "issue_comment";
		await reconcile(f.github, f.context);
		expect(f.comment.body).not.toContain("✅ OTA-compatible");
		expect(f.comment.body).toContain(headSha);
	});

	it("re-reads the comment so a queued push event preserves a fresh result", async () => {
		const f = fixture();
		f.github.rest.issues.getComment.mockImplementation(async () => ({
			data: { ...f.comment, body: report(headSha) },
		}));
		await reconcile(f.github, f.context);
		expect(f.updateComment).not.toHaveBeenCalled();
	});

	it("uses a head pushed while comment discovery was running", async () => {
		const f = fixture();
		f.github.paginate.mockImplementation(async () => {
			f.pr.head.sha = newerSha;
			return [{ ...f.comment }];
		});
		await reconcile(f.github, f.context);
		expect(f.comment.body).toContain(`**Latest commit:** \`${newerSha}\``);
	});

	it("recovers a current result overwritten by an in-flight pending edit", async () => {
		const f = fixture();
		await reconcile(f.github, f.context);
		f.context.eventName = "issue_comment";
		f.context.payload.comment.body = report(headSha);
		await reconcile(f.github, f.context);
		expect(f.comment.body).toBe(report(headSha));
	});

	it("does not restore a result supplied by a non-Expo sender", async () => {
		const f = fixture();
		f.context.eventName = "issue_comment";
		f.context.payload.sender.login = "someone-else";
		f.context.payload.comment.body = report(headSha);
		await reconcile(f.github, f.context);
		expect(f.comment.body).toContain("⏳ Latest commit not yet evaluated");
	});

	it("does not touch unrelated comments or user-authored lookalikes", async () => {
		const f = fixture();
		f.github.paginate.mockResolvedValue([
			{ ...f.comment, body: "An unrelated Expo comment" },
			{ ...f.comment, user: { login: "someone-else" } },
		]);
		await reconcile(f.github, f.context);
		expect(f.updateComment).not.toHaveBeenCalled();
	});

	it("does not create duplicate comments when no report exists yet", async () => {
		const f = fixture();
		f.github.paginate.mockResolvedValue([]);
		await reconcile(f.github, f.context);
		expect(f.updateComment).not.toHaveBeenCalled();
	});

	it("also marks legacy OTA comments pending", async () => {
		const f = fixture(report().replace(`${marker}\n`, ""));
		await reconcile(f.github, f.context);
		expect(f.comment.body).toContain("⏳ Latest commit not yet evaluated");
		expect(f.comment.body).toContain(marker);
		expect(f.comment.body).toContain(easMarker);
	});

	it("does not edit comments without the native EAS identity", async () => {
		const f = fixture(report().replace(easMarker, ""));
		await reconcile(f.github, f.context);
		expect(f.updateComment).not.toHaveBeenCalled();
	});

	it("leaves closed PRs alone", async () => {
		const f = fixture();
		f.pr.state = "closed";
		await reconcile(f.github, f.context);
		expect(f.github.paginate).not.toHaveBeenCalled();
		expect(f.updateComment).not.toHaveBeenCalled();
	});
});
