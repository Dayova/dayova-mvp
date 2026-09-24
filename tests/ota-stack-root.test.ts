// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { reachesMainThroughOpenPrs } from "../scripts/ota-stack-root.mjs";

const repository = "Dayova/dayova-mvp";
const parent = (head: string, base: string) => ({
	number: 1,
	state: "open",
	head: { ref: head, repo: { full_name: repository } },
	base: { ref: base, repo: { full_name: repository } },
});

const requestFrom = (parents: Record<string, ReturnType<typeof parent>[]>) =>
	vi.fn<typeof fetch>(async (input) => {
		const head = new URL(String(input)).searchParams.get("head")?.split(":")[1];
		return new Response(JSON.stringify(parents[head ?? ""] ?? []), { status: 200 });
	});

describe("OTA stack root", () => {
	it("accepts a direct PR to main without calling GitHub", async () => {
		const request = requestFrom({});
		expect(await reachesMainThroughOpenPrs("main", repository, request)).toBe(true);
		expect(request).not.toHaveBeenCalled();
	});

	it("follows open parent PRs until their base is main", async () => {
		const request = requestFrom({
			"codex/child": [parent("codex/child", "codex/parent")],
			"codex/parent": [parent("codex/parent", "main")],
		});
		expect(
			await reachesMainThroughOpenPrs("codex/child", repository, request),
		).toBe(true);
		expect(request).toHaveBeenCalledTimes(2);
	});

	it("rejects a branch without an open parent PR", async () => {
		expect(
			await reachesMainThroughOpenPrs("codex/orphan", repository, requestFrom({})),
		).toBe(false);
	});

	it("rejects ambiguous parent PRs", async () => {
		const request = requestFrom({
			"codex/parent": [
				parent("codex/parent", "main"),
				parent("codex/parent", "other"),
			],
		});
		expect(
			await reachesMainThroughOpenPrs("codex/parent", repository, request),
		).toBe(false);
	});

	it("rejects a cyclic stack", async () => {
		const request = requestFrom({
			"codex/a": [parent("codex/a", "codex/b")],
			"codex/b": [parent("codex/b", "codex/a")],
		});
		expect(await reachesMainThroughOpenPrs("codex/a", repository, request)).toBe(
			false,
		);
		expect(request).toHaveBeenCalledTimes(2);
	});

	it("fails closed when GitHub lookup fails", async () => {
		const request = vi.fn<typeof fetch>(async () => new Response(null, { status: 503 }));
		await expect(
			reachesMainThroughOpenPrs("codex/parent", repository, request),
		).rejects.toThrow("HTTP 503");
	});
});
