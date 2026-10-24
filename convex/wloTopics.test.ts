/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { grantTestLearningAccess } from "./testing/access";
import { searchWloTopics } from "./wloTopics";

const modules = import.meta.glob("./**/*.ts");
const node = (title: string, subject = "Deutsch", type = "EDITORIAL") => ({
	ref: { id: title },
	title,
	properties: { "ccm:taxonid_DISPLAYNAME": [subject] },
	collection: { type },
});
const reply = (collections: ReturnType<typeof node>[]) =>
	new Response(JSON.stringify({ nodes: collections }), { status: 200 });
afterEach(() => vi.unstubAllGlobals());
describe("WLO topic search", () => {
	test("keeps usable fuzzy suggestions when the bounded expansion fails", async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(reply([node("Gedichte", "Englisch")]))
			.mockRejectedValueOnce(new Error("offline"));
		vi.stubGlobal("fetch", fetcher);
		const result = await searchWloTopics("Gedichts", "Deutsch");
		expect(result.topics.map((topic) => topic.title)).toEqual(["Gedichte"]);
		expect(result.truncated).toBe(true);
		expect(fetcher).toHaveBeenCalledTimes(2);
	});
	test("does not turn a failed expansion into a successful empty search", async () => {
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValueOnce(reply([]))
				.mockRejectedValueOnce(new Error("offline")),
		);
		await expect(searchWloTopics("Gedichts", "Deutsch")).rejects.toThrow(
			"offline",
		);
	});

	test("recovers Gedichts suggestions from live-provider-shaped responses while preserving subject ranking", async () => {
		const fetcher = vi
			.fn()
			.mockImplementation(async (_url: URL, init: RequestInit) => {
				const term = JSON.parse(String(init.body)).criteria[0].values[0];
				return reply(
					term === "gedichts"
						? [node("Gedichte", "Englisch")]
						: [
								node("Gedichtanalyse"),
								node("Gedichte", "Englisch"),
								node("Kreatives Schreiben"),
							],
				);
			});
		vi.stubGlobal("fetch", fetcher);
		const result = await searchWloTopics("Gedichts", "Deutsch");
		expect(result.topics.map((topic) => topic.title)).toEqual([
			"Gedichtanalyse",
			"Gedichte",
		]);
		expect(result.topics[0].isAdditional).toBe(false);
		expect(result.topics[1].isAdditional).toBe(true);
		expect(fetcher).toHaveBeenCalledTimes(2);
	});

	test("reuses authenticated catalog results across equivalent subject contexts without another provider call", async () => {
		const fetcher = vi
			.fn()
			.mockImplementation(async () => reply([node("Vektoren", "Mathematik")]));
		vi.stubGlobal("fetch", fetcher);
		const t = convexTest(schema, modules).withIdentity({
			subject: "search-cache-test",
		});
		await grantTestLearningAccess(t);
		const first = await t.action(api.wloTopics.search, {
			query: "Vektor",
			subject: "Mathe LK",
		});
		const second = await t.action(api.wloTopics.search, {
			query: " VEKTOR ",
			subject: "Mathematik",
		});
		expect(second).toEqual(first);
		expect(fetcher).toHaveBeenCalledTimes(1);
	});

	test("does not reuse another subject ranking or a failed provider response", async () => {
		const fetcher = vi
			.fn()
			.mockRejectedValueOnce(new Error("offline"))
			.mockImplementation(async () => reply([node("Zellen", "Biologie")]));
		vi.stubGlobal("fetch", fetcher);
		const t = convexTest(schema, modules).withIdentity({
			subject: "search-cache-test",
		});
		await grantTestLearningAccess(t);
		await expect(
			t.action(api.wloTopics.search, { query: "Zelle", subject: "Biologie" }),
		).rejects.toThrow();
		const biology = await t.action(api.wloTopics.search, {
			query: "Zelle",
			subject: "Biologie",
		});
		const computing = await t.action(api.wloTopics.search, {
			query: "Zelle",
			subject: "Informatik",
		});
		expect(biology.topics[0].isAdditional).toBe(false);
		expect(computing.topics[0].isAdditional).toBe(true);
		expect(fetcher).toHaveBeenCalledTimes(3);
	});
	test("expires cached results and still requires authentication for a warm cache", async () => {
		const fetcher = vi
			.fn()
			.mockImplementation(async () =>
				reply([node("Bilanz", "Wirtschaftskunde")]),
			);
		vi.stubGlobal("fetch", fetcher);
		const base = convexTest(schema, modules);
		const t = base.withIdentity({ subject: "search-cache-test" });
		await grantTestLearningAccess(t);
		const args = { query: "Bilanz", subject: "Rechnungswesen" };
		await t.action(api.wloTopics.search, args);
		await expect(base.action(api.wloTopics.search, args)).rejects.toThrow();
		expect(fetcher).toHaveBeenCalledTimes(1);
		await t.run(async (ctx) => {
			const entry = (await ctx.db.query("wloTopicCache").take(1))[0];
			expect(entry.key).toMatch(/^[a-f0-9]{64}$/);
			expect(Object.keys(entry).sort()).toEqual([
				"_creationTime",
				"_id",
				"expiresAt",
				"key",
				"result",
				"slot",
			]);
			await ctx.db.patch("wloTopicCache", entry._id, { expiresAt: 0 });
		});
		await t.action(api.wloTopics.search, args);
		expect(fetcher).toHaveBeenCalledTimes(2);
	});

	test("cache slot collisions evict rather than return another query, with no duplicate slot rows", async () => {
		const t = convexTest(schema, modules);
		const key = "a".repeat(64);
		const other = `${"a".repeat(63)}b`;
		const result = { topics: [], truncated: false };
		await t.mutation(internal.wloTopicCache.store, { key, result });
		await t.mutation(internal.wloTopicCache.store, { key: other, result });
		expect(await t.query(internal.wloTopicCache.read, { key })).toBeNull();
		expect(
			await t.query(internal.wloTopicCache.read, { key: other }),
		).toMatchObject({ result });
		expect(
			await t.run((ctx) => ctx.db.query("wloTopicCache").take(257)),
		).toHaveLength(1);
		await expect(
			t.mutation(internal.wloTopicCache.store, { key: "invalid", result }),
		).rejects.toThrow();
	});
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
	test.each([
		{ query: "g".repeat(101), subject: "Deutsch" },
		{ query: "Gedicht", subject: "D".repeat(101) },
		{ query: "İ".repeat(100), subject: "Deutsch" },
	])("rejects oversized input as an empty result without contacting WLO: %j", async (args) => {
		const fetcher = vi.fn();
		vi.stubGlobal("fetch", fetcher);
		const t = convexTest(schema, modules).withIdentity({
			subject: "topic-search-validation-test",
		});
		await grantTestLearningAccess(t);
		await expect(t.action(api.wloTopics.search, args)).resolves.toEqual({
			topics: [],
			truncated: false,
		});
		expect(fetcher).not.toHaveBeenCalled();
	});
	test("allows inputs at the inclusive search length limit", async () => {
		const fetcher = vi.fn().mockResolvedValue(reply([]));
		vi.stubGlobal("fetch", fetcher);
		await searchWloTopics("g".repeat(100), "D".repeat(100));
		expect(fetcher).toHaveBeenCalledTimes(1);
	});
	test("normalizes spelling, merges duplicate labels and excludes description-only and private matches", async () => {
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
			topics: [
				{
					id: "Gedichtanalyse",
					title: "Gedichtanalyse",
					subjects: ["Deutsch", "Englisch"],
					isAdditional: false,
				},
			],
			truncated: false,
		});
		expect(String(fetcher.mock.calls[0][0])).toContain(
			"/search/v1/queries/-home-/-default-/collections",
		);
		expect(fetcher.mock.calls[0][1]).toMatchObject({ method: "POST" });
		expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({
			criteria: [{ property: "ngsearchword", values: ["gedichtanalyse"] }],
			resolveCollections: false,
			resolveUsernames: false,
			returnSuggestions: false,
		});
		expect(
			new URL(fetcher.mock.calls[0][0]).searchParams.getAll("propertyFilter"),
		).toEqual(["ccm:taxonid", "ccm:taxonid_DISPLAYNAME"]);
	});

	test("uses the total to fetch later pages concurrently, with at most two in flight and stable page order", async () => {
		let active = 0;
		let peak = 0;
		const release: (() => void)[] = [];
		const fetcher = vi.fn().mockImplementation(async (url: URL) => {
			const offset = Number(url.searchParams.get("skipCount"));
			if (offset > 0) {
				active++;
				peak = Math.max(peak, active);
				await new Promise<void>((resolve) => release.push(resolve));
				active--;
			}
			return new Response(
				JSON.stringify({
					nodes: Array.from({ length: 100 }, (_, i) =>
						node(`Klima ${offset + i}`),
					),
					pagination: { total: 400 },
				}),
			);
		});
		vi.stubGlobal("fetch", fetcher);
		const search = searchWloTopics("Klima", "Deutsch");
		await vi.waitFor(() => expect(release).toHaveLength(2));
		release[1]();
		release[0]();
		await vi.waitFor(() => expect(release).toHaveLength(3));
		release[2]();
		const result = await search;
		expect(peak).toBe(2);
		expect(fetcher).toHaveBeenCalledTimes(4);
		expect(result.topics).toHaveLength(20);
		expect(result.truncated).toBe(true);
	});

	test("does not issue an empty extra page when the total is exactly one full page", async () => {
		const fetcher = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({
					nodes: Array.from({ length: 100 }, (_, i) => node(`Klima ${i}`)),
					pagination: { total: 100 },
				}),
			),
		);
		vi.stubGlobal("fetch", fetcher);
		await searchWloTopics("Klima", "Deutsch");
		expect(fetcher).toHaveBeenCalledTimes(1);
	});
	test("ranks context matches from later pages ahead of additional title matches", async () => {
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
			(await searchWloTopics("Klima", "Erdkunde")).topics[0].title,
		).toEqual("Klimazonen");
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
	test("does not query short inputs and keeps title matches for unknown personal subjects", async () => {
		const fetcher = vi.fn().mockResolvedValue(reply([node("Gedichtanalyse")]));
		vi.stubGlobal("fetch", fetcher);
		expect((await searchWloTopics("Ge", "Deutsch")).topics).toEqual([]);
		expect(fetcher).not.toHaveBeenCalled();
		expect((await searchWloTopics("Gedicht", "Mein Fach")).topics).toEqual([
			{
				id: "Gedichtanalyse",
				title: "Gedichtanalyse",
				subjects: ["Deutsch"],
				isAdditional: false,
			},
		]);
	});
	test("finds accounting under both the personal name and the historical mathematics selection", async () => {
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockImplementation(async () =>
					reply([
						node("Bilanz", "Wirtschaftskunde"),
						node("Handelsbilanz", "Wirtschaftskunde"),
					]),
				),
		);
		const own = await searchWloTopics("Bilanz", "Rechnungswesen");
		expect(own.topics.map((topic) => topic.title)).toEqual([
			"Bilanz",
			"Handelsbilanz",
		]);
		expect(own.topics.every((topic) => !topic.isAdditional)).toBe(true);
		const legacy = await searchWloTopics("Bilanz", "Mathematik");
		expect(legacy.topics[0]).toMatchObject({
			title: "Bilanz",
			isAdditional: false,
			subjects: ["Wirtschaftskunde"],
		});
		expect(legacy.topics[1].isAdditional).toBe(true);
	});
	test("uses course aliases for ambiguous terms and keeps clearly labelled alternatives", async () => {
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockImplementation(async () =>
					reply([
						node("Zellen in Tabellen", "Informatik"),
						node("Vorgänge in der Zelle", "Biologie"),
					]),
				),
		);
		const biology = await searchWloTopics("Zelle", "Bio LK");
		expect(biology.topics.map((topic) => topic.title)).toEqual([
			"Vorgänge in der Zelle",
			"Zellen in Tabellen",
		]);
		expect(biology.topics[1].isAdditional).toBe(true);
		const computing = await searchWloTopics("Zelle", "Informatik");
		expect(computing.topics[0].title).toBe("Zellen in Tabellen");
	});
	test("keeps relevant candidates without taxonomy metadata and exact matches ahead of contextual prefixes", async () => {
		const missingLabels = node("Bilanzgleichung");
		missingLabels.properties = { "ccm:taxonid_DISPLAYNAME": [] };
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValue(
					reply([
						node("Bilanz", "Wirtschaftskunde"),
						node("Bilanz berechnen", "Mathematik"),
						missingLabels,
					]),
				),
		);
		const result = await searchWloTopics("Bilanz", "Mathe LK");
		expect(result.topics.map((topic) => topic.title)).toEqual([
			"Bilanz",
			"Bilanz berechnen",
			"Bilanzgleichung",
		]);
		expect(result.topics[2]).toMatchObject({
			subjects: [],
			isAdditional: true,
		});
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
				.mockImplementation(async () =>
					reply([
						node("Carbonsäuren", "Chemie"),
						node("Butter Demo", "Chemie"),
					]),
				),
		);
		expect((await searchWloTopics("Butter", "Chemie")).topics).toEqual([]);
	});
});
