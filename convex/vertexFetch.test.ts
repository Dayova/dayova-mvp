// @vitest-environment node
import { afterEach, expect, test, vi } from "vitest";
import { vertexFetch } from "./vertexFetch";

afterEach(() => vi.unstubAllGlobals());

test("streams large Unicode JSON unchanged and preserves abort/auth options", async () => {
	// The emoji crosses the first 64-KiB character boundary.
	const body = `${"a".repeat(65535)}😀${"ü".repeat(1024 * 1024)}`;
	const controller = new AbortController();
	const transport = vi.fn(async (_input, init) => {
		expect(init.body).toBeInstanceOf(ReadableStream);
		expect(init.duplex).toBe("half");
		expect(init.signal).toBe(controller.signal);
		expect(init.headers).toEqual({
			Authorization: "fixture",
			"Content-Type": "application/json",
		});
		expect(await new Response(init.body).text()).toBe(body);
		return new Response("ok");
	});
	vi.stubGlobal("fetch", transport);
	await vertexFetch("https://example.invalid", {
		method: "POST",
		body,
		signal: controller.signal,
		headers: { Authorization: "fixture", "Content-Type": "application/json" },
	});
	expect(transport).toHaveBeenCalledTimes(1);
});

test("preserves ordinary requests unchanged", async () => {
	const transport = vi.fn(async () => new Response("ok"));
	vi.stubGlobal("fetch", transport);
	const init = { method: "POST", body: "small payload" };
	await vertexFetch("https://example.invalid", init);
	expect(transport).toHaveBeenCalledWith("https://example.invalid", init);
});
