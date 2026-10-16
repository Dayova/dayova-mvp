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
		expect(String(fetcher.mock.calls[0][0])).toContain("query=gedichtanalyse");
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
