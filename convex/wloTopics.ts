import { v } from "convex/values";
import { z } from "zod";
import { action } from "./_generated/server";
import { throwUserFacingError } from "./errors";
import {
	normalizeWloText as normalize,
	resolveWloSubjectContext,
} from "./wloSubjectContext";

// WLO's public collection search is deprecated, but currently the verified
// endpoint for topic search. Keep the provider boundary isolated for replacement.
const ENDPOINT =
	"https://suche.wirlernenonline.de/edu-sharing/rest/collection/v1/collections/-home-/search";
const PAGE_SIZE = 100;
const MAX_PAGES = 5;
const responseSchema = z.object({
	collections: z.array(
		z.object({
			ref: z.object({ id: z.string() }),
			title: z.string().nullish(),
			properties: z.record(z.string(), z.array(z.string())).optional(),
			collection: z.object({ type: z.string().nullish() }).nullish(),
		}),
	),
});
export type TopicSuggestion = {
	id: string;
	title: string;
	subjects: string[];
	isAdditional: boolean;
};

/** Ranks title matches using subject context without excluding other subjects. */
export async function searchWloTopics(query: string, subject: string) {
	const term = normalize(query).replace(/gedichtsanalyse/g, "gedichtanalyse");
	if (term.length < 3) return { topics: [], truncated: false };
	if (term.length > 100 || subject.length > 100)
		throw new Error("Search too long");
	const subjects = resolveWloSubjectContext(subject).map(normalize);
	const matches = new Map<string, TopicSuggestion>();
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 8000);
	let truncated = false;
	try {
		for (let page = 0; page < MAX_PAGES; page++) {
			const url = new URL(ENDPOINT);
			url.searchParams.set("query", term);
			url.searchParams.set("maxItems", String(PAGE_SIZE));
			url.searchParams.set("skipCount", String(page * PAGE_SIZE));
			url.searchParams.set("sortProperties", "cm:name");
			url.searchParams.set("sortAscending", "true");
			const response = await fetch(url, {
				signal: controller.signal,
				headers: { Accept: "application/json" },
			});
			if (!response.ok) throw new Error(`WLO ${response.status}`);
			const data = responseSchema.parse(await response.json());
			for (const node of data.collections) {
				const title = node.title?.trim();
				const properties = node.properties ?? {};
				if (
					!title ||
					title.length > 160 ||
					node.collection?.type !== "EDITORIAL"
				)
					continue;
				// Search also matches descriptions; only title matches make useful topic suggestions.
				if (!normalize(title).includes(term)) continue;
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
			if (data.collections.length < PAGE_SIZE) break;
			if (page === MAX_PAGES - 1) truncated = true;
		}
	} finally {
		clearTimeout(timeout);
	}
	const topics = [...matches.values()].sort((a, b) => {
		/** Exact titles first, then context matches, then other title matches. */
		const rank = (title: string) =>
			normalize(title) === term ? 0 : normalize(title).startsWith(term) ? 1 : 2;
		return (
			Number(a.isAdditional) - Number(b.isAdditional) ||
			rank(a.title) - rank(b.title) ||
			a.title.localeCompare(b.title, "de")
		);
	});
	return {
		topics: topics.slice(0, 20),
		truncated: truncated || topics.length > 20,
	};
}

/** Exposes WLO suggestions to signed-in learners with a recoverable provider error. */
export const search = action({
	args: { query: v.string(), subject: v.string() },
	returns: v.object({
		topics: v.array(
			v.object({
				id: v.string(),
				title: v.string(),
				subjects: v.array(v.string()),
				isAdditional: v.boolean(),
			}),
		),
		truncated: v.boolean(),
	}),
	handler: async (ctx, args) => {
		if (!(await ctx.auth.getUserIdentity()))
			throwUserFacingError("Bitte melde dich an.");
		try {
			return await searchWloTopics(args.query, args.subject);
		} catch {
			throwUserFacingError(
				"Die Themensuche ist gerade nicht erreichbar. Du kannst dein Thema selbst hinzufügen.",
			);
		}
	},
});
