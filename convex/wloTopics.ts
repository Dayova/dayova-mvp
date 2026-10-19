import { v } from "convex/values";
import { z } from "zod";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import { throwUserFacingError } from "./errors";
import {
	matchesWloTitle,
	normalizeWloText as normalize,
	normalizeWloQuery,
	rankWloTopics,
	resolveWloSubjectContext,
} from "./wloSubjectContext";
import { topicCacheKey } from "./wloTopicCache";
import { wloTopicResult } from "./wloTopicContract";

// Use the provider's supported metadata query instead of the deprecated
// collection endpoint, which materializes every property of every match.
const ENDPOINT =
	"https://suche.wirlernenonline.de/edu-sharing/rest/search/v1/queries/-home-/-default-/collections";
const PAGE_SIZE = 100;
const MAX_PAGES = 5;
const responseSchema = z.object({
	nodes: z.array(
		z.object({
			ref: z.object({ id: z.string() }),
			title: z.string().nullish(),
			properties: z.record(z.string(), z.array(z.string())).optional(),
			collection: z.object({ type: z.string().nullish() }).nullish(),
		}),
	),
	pagination: z.object({ total: z.number().int().nonnegative() }).optional(),
});
export type TopicSuggestion = {
	id: string;
	title: string;
	subjects: string[];
	isAdditional: boolean;
};

/** Ranks title matches using subject context without excluding other subjects. */
export async function searchWloTopics(query: string, subject: string) {
	const term = normalizeWloQuery(query);
	if (term.length < 3 || term.length > 100 || subject.length > 100)
		return { topics: [], truncated: false };
	const subjects = resolveWloSubjectContext(subject).map(normalize);
	const matches = new Map<string, TopicSuggestion>();
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 8000);
	let truncated = false;
	try {
		const loadPage = async (page: number, searchTerm = term) => {
			const url = new URL(ENDPOINT);
			url.searchParams.set("contentType", "COLLECTIONS");
			url.searchParams.append("propertyFilter", "ccm:taxonid");
			url.searchParams.append("propertyFilter", "ccm:taxonid_DISPLAYNAME");
			url.searchParams.set("maxItems", String(PAGE_SIZE));
			url.searchParams.set("skipCount", String(page * PAGE_SIZE));
			url.searchParams.set("sortProperties", "cm:name");
			url.searchParams.set("sortAscending", "true");
			const response = await fetch(url, {
				method: "POST",
				signal: controller.signal,
				headers: {
					Accept: "application/json",
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					criteria: [{ property: "ngsearchword", values: [searchTerm] }],
					resolveCollections: false,
					resolveUsernames: false,
					returnSuggestions: false,
				}),
			});
			if (!response.ok) throw new Error(`WLO ${response.status}`);
			return responseSchema.parse(await response.json());
		};
		const first = await loadPage(0);
		const pages = [first];
		if (first.nodes.length === PAGE_SIZE) {
			const total = first.pagination?.total;
			if (total !== undefined && total >= PAGE_SIZE) {
				const count = Math.min(MAX_PAGES, Math.ceil(total / PAGE_SIZE));
				for (let page = 1; page < count; page += 2) {
					// Keep the existing five-page budget, with at most two parallel
					// requests. Promise.all retains page order for duplicate merging.
					pages.push(
						...(await Promise.all(
							Array.from({ length: Math.min(2, count - page) }, (_, index) =>
								loadPage(page + index),
							),
						)),
					);
				}
			} else {
				// Missing/implausible totals must not silently lose later matches.
				for (let page = 1; page < MAX_PAGES; page++) {
					const data = await loadPage(page);
					pages.push(data);
					if (data.nodes.length < PAGE_SIZE) break;
				}
			}
		}
		const addMatches = (data: z.infer<typeof responseSchema>) => {
			for (const node of data.nodes) {
				const title = node.title?.trim();
				const properties = node.properties ?? {};
				if (
					!title ||
					title.length > 160 ||
					node.collection?.type !== "EDITORIAL"
				)
					continue;
				// Keep title relevance, including small typing slips; descriptions alone are insufficient.
				if (!matchesWloTitle(title, term)) continue;
				if (/\bdemo\b|\bstartseite\b|^tools$|^materialien$/i.test(title))
					continue;
				if (subjects.includes(normalize(title))) continue;
				const labels = (properties["ccm:taxonid_DISPLAYNAME"] ?? [])
					.map((name) => name.trim())
					.filter((name) => name.length > 0 && name.length <= 100);
				const previous = matches.get(normalize(title));
				const combined = [
					...new Set([...(previous?.subjects ?? []), ...labels]),
				]
					.sort(
						(a, b) =>
							Number(subjects.includes(normalize(b))) -
								Number(subjects.includes(normalize(a))) ||
							a.localeCompare(b, "de"),
					)
					.slice(0, 3);
				matches.set(normalize(title), {
					id: previous?.id ?? node.ref.id,
					title: previous?.title ?? title,
					subjects: combined,
					// Exact titles survive even a historical wrong subject. Unknown
					// subjects have no inferred category and search all title matches.
					isAdditional:
						subjects.length > 0 &&
						normalize(title) !== term &&
						!combined.some((name) => subjects.includes(normalize(name))),
				});
			}
		};
		for (const [page, data] of pages.entries()) {
			addMatches(data);
			if (data.nodes.length < PAGE_SIZE) break;
			if (page === MAX_PAGES - 1) truncated = true;
		}
		// A trailing letter can hide a whole compound family (Gedichts → Gedichtanalyse).
		// One bounded prefix retry shares the original deadline and never replaces the input.
		if (
			/^[a-zäöüß]{5,40}$/u.test(term) &&
			![...matches.values()].some((topic) =>
				normalize(topic.title).includes(term),
			)
		) {
			try {
				const fallback = await loadPage(0, term.slice(0, -1));
				addMatches(fallback);
				truncated ||= fallback.nodes.length === PAGE_SIZE;
			} catch (error) {
				if (!matches.size) throw error;
				// Retain usable initial results when optional expansion is unavailable.
				truncated = true;
			}
		}
	} finally {
		clearTimeout(timeout);
		controller.abort();
	}
	const topics = rankWloTopics([...matches.values()], term, subject);
	return {
		topics: topics.slice(0, 20),
		truncated: truncated || topics.length > 20,
	};
}

/** Exposes WLO suggestions to signed-in learners with a recoverable provider error. */
export const search = action({
	args: { query: v.string(), subject: v.string() },
	returns: wloTopicResult,
	handler: async (
		ctx,
		args,
	): Promise<{ topics: TopicSuggestion[]; truncated: boolean }> => {
		if (!(await ctx.auth.getUserIdentity()))
			throwUserFacingError("Bitte melde dich an.");
		const key = await topicCacheKey(args.query, args.subject);
		if (!key) return { topics: [], truncated: false };
		try {
			const cached = await ctx.runQuery(internal.wloTopicCache.read, { key });
			if (cached && cached.expiresAt > Date.now()) return cached.result;
		} catch {
			// A cache failure must not turn a usable provider into a search outage.
		}
		try {
			const result = await searchWloTopics(args.query, args.subject);
			try {
				await ctx.runMutation(internal.wloTopicCache.store, { key, result });
			} catch {
				// Caching is optional; retain the successful search result.
			}
			return result;
		} catch {
			throwUserFacingError(
				"Die Themensuche ist gerade nicht erreichbar. Du kannst dein Thema selbst hinzufügen.",
			);
		}
	},
});
