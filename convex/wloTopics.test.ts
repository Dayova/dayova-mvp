/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { searchWloTopics } from "./wloTopics";

const modules = import.meta.glob("./**/*.ts");
const node = (title: string, subject = "Deutsch", type = "EDITORIAL") => ({
	ref: { id: title },
	title,
	properties: { "ccm:taxonid_DISPLAYNAME": [subject] },
	collection: { type },
});
const reply = (collections: ReturnType<typeof node>[]) =>
	new Response(JSON.stringify({ collections }), { status: 200 });
afterEach(() => vi.unstubAllGlobals());
describe("WLO topic search", () => {
	test("requires authentication before contacting WLO", async () => {
		const fetcher = vi.fn();
		vi.stubGlobal("fetch", fetcher);
		await expect(
			convexTest(schema, modules).action(api.wloTopics.search, {
				query: "Gedicht",
				subject: "Deutsch",
			}),
		).rejects.toThrow();
		expect(fetcher).not.toHaveBeenCalled();
	});
	test("normalizes the spelling variant and excludes other subjects and description-only matches", async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValue(
				reply([
					node("Gedichtanalyse"),
					node("Gedichtanalyse", "Englisch"),
					node("Kreatives Schreiben"),
					node("Gedichtanalyse privat", "Deutsch", "CUSTOM"),
				]),
			);
		vi.stubGlobal("fetch", fetcher);
		expect(await searchWloTopics("Gedichtsanalyse", "Deutsch")).toEqual({
			topics: [{ id: "Gedichtanalyse", title: "Gedichtanalyse" }],
			truncated: false,
		});
		expect(String(fetcher.mock.calls[0][0])).toContain("query=gedichtanalyse");
	});
	test("filters after paging so a matching subject on a later page is retained", async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(
				reply(
					Array.from({ length: 100 }, (_, i) => node(`Klima ${i}`, "Englisch")),
				),
			)
			.mockResolvedValueOnce(reply([node("Klimazonen", "Geografie")]));
		vi.stubGlobal("fetch", fetcher);
		expect(
			(await searchWloTopics("Klima", "Erdkunde")).topics.map((x) => x.title),
		).toEqual(["Klimazonen"]);
		expect(String(fetcher.mock.calls[1][0])).toContain("skipCount=100");
	});
	test("caps broad searches and signals incomplete results", async () => {
		const fetcher = vi
			.fn()
			.mockImplementation(() =>
				Promise.resolve(
					reply(Array.from({ length: 100 }, (_, i) => node(`Gedicht ${i}`))),
				),
			);
		vi.stubGlobal("fetch", fetcher);
		const result = await searchWloTopics("Gedicht", "Deutsch");
		expect(fetcher).toHaveBeenCalledTimes(5);
		expect(result.truncated).toBe(true);
		expect(result.topics).toHaveLength(20);
	});
	test("rejects malformed responses and upstream failures", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}")));
		await expect(searchWloTopics("Gedicht", "Deutsch")).rejects.toThrow();
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(new Response("", { status: 429 })),
		);
		await expect(searchWloTopics("Gedicht", "Deutsch")).rejects.toThrow();
	});
	test("does not query short inputs and never searches other subjects for custom subjects", async () => {
		const fetcher = vi.fn().mockResolvedValue(reply([node("Gedichtanalyse")]));
		vi.stubGlobal("fetch", fetcher);
		expect((await searchWloTopics("Ge", "Deutsch")).topics).toEqual([]);
		expect(fetcher).not.toHaveBeenCalled();
		expect((await searchWloTopics("Gedicht", "Mein Fach")).topics).toEqual([]);
	});
	test("keeps real topics whose names contain demo", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(reply([node("Demokratie", "Politik")])),
		);
		expect(
			(await searchWloTopics("Demokr", "Sozialkunde")).topics.map(
				(x) => x.title,
			),
		).toEqual(["Demokratie"]);
	});

	test("does not suggest chemistry for Butter or demo pages", async () => {
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValue(
					reply([
						node("Carbonsäuren", "Chemie"),
						node("Butter Demo", "Chemie"),
					]),
				),
		);
		expect((await searchWloTopics("Butter", "Chemie")).topics).toEqual([]);
	});
});
