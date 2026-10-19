import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import {
	normalizeWloQuery,
	normalizeWloText,
	resolveWloSubjectContext,
} from "./wloSubjectContext";
import { wloTopicResult } from "./wloTopicContract";

/** Only a digest and public catalog suggestions are stored, never learner text/IDs.
 * 256 direct-mapped slots bound storage without a cleanup scan or cron. A hash
 * collision is just a cache miss, never a result from a different context. */
export async function topicCacheKey(query: string, subject: string) {
	const term = normalizeWloQuery(query);
	if (term.length < 3 || term.length > 100 || subject.length > 100) return null;
	const context = resolveWloSubjectContext(subject)
		.map(normalizeWloText)
		.sort();
	const bytes = new TextEncoder().encode(
		JSON.stringify(["wlo-v3", term, context]),
	);
	const hash = await crypto.subtle.digest("SHA-256", bytes);
	return Array.from(new Uint8Array(hash), (byte) =>
		byte.toString(16).padStart(2, "0"),
	).join("");
}

function slot(key: string) {
	if (!/^[a-f0-9]{64}$/.test(key)) throw new Error("Invalid catalog cache key");
	return key.slice(0, 2);
}

export const read = internalQuery({
	args: { key: v.string() },
	returns: v.union(
		v.null(),
		v.object({ expiresAt: v.number(), result: wloTopicResult }),
	),
	handler: async (ctx, { key }) => {
		const entry = await ctx.db
			.query("wloTopicCache")
			.withIndex("by_slot", (q) => q.eq("slot", slot(key)))
			.unique();
		return entry?.key === key
			? { expiresAt: entry.expiresAt, result: entry.result }
			: null;
	},
});

export const store = internalMutation({
	args: { key: v.string(), result: wloTopicResult },
	returns: v.null(),
	handler: async (ctx, { key, result }) => {
		const cacheSlot = slot(key);
		const entry = await ctx.db
			.query("wloTopicCache")
			.withIndex("by_slot", (q) => q.eq("slot", cacheSlot))
			.unique();
		const value = {
			slot: cacheSlot,
			key,
			result,
			expiresAt: Date.now() + 300_000,
		};
		if (entry) await ctx.db.replace("wloTopicCache", entry._id, value);
		else await ctx.db.insert("wloTopicCache", value);
		return null;
	},
});
