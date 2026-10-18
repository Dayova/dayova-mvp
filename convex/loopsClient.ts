import type { Infer } from "convex/values";
import { z } from "zod";
import type { loopsError } from "./loopsContract";

export class LoopsFailure extends Error {
	constructor(
		public readonly category: Infer<typeof loopsError>,
		public readonly retryAfterMs?: number,
	) {
		super(category);
	}
}

const contact = z.object({
	id: z.string().min(1),
	email: z.string(),
	userId: z.string().nullable(),
	subscribed: z.boolean(),
	mailingLists: z.record(z.string(), z.boolean()),
});
export type LoopsContact = z.infer<typeof contact>;

export function createLoopsClient(apiKey: string) {
	let lastRequestAt = 0;
	async function request(path: string, method = "GET", body?: object) {
		// One serialized worker, at most four requests/second; leave account headroom.
		const delay = lastRequestAt + 250 - Date.now();
		if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
		lastRequestAt = Date.now();
		let response: Response;
		try {
			response = await fetch(`https://app.loops.so/api/v1/${path}`, {
				method,
				headers: {
					Authorization: `Bearer ${apiKey}`,
					"Content-Type": "application/json",
				},
				...(body ? { body: JSON.stringify(body) } : {}),
				signal: AbortSignal.timeout(15_000),
			});
		} catch {
			throw new LoopsFailure("unavailable", 60_000);
		}
		if (response.status === 429) {
			const header = response.headers.get("Retry-After");
			const seconds = header === null ? Number.NaN : Number(header);
			const delay = Number.isFinite(seconds)
				? seconds * 1000
				: Date.parse(header ?? "") - Date.now();
			throw new LoopsFailure(
				"rate_limited",
				Math.max(60_000, Number.isFinite(delay) ? delay : 0),
			);
		}
		if (response.status >= 500) throw new LoopsFailure("unavailable", 60_000);
		if ([401, 403].includes(response.status))
			throw new LoopsFailure("unauthorized");
		if (path === "contacts/delete" && response.status === 404)
			return { success: true };
		if (!response.ok) throw new LoopsFailure("rejected");
		try {
			return (await response.json()) as unknown;
		} catch {
			throw new LoopsFailure("invalid_response", 60_000);
		}
	}
	return {
		async checkList(listId: string) {
			const result = z
				.array(z.object({ id: z.string() }))
				.safeParse(await request("lists"));
			if (!result.success) throw new LoopsFailure("invalid_response");
			if (!result.data.some((list) => list.id === listId))
				throw new LoopsFailure("configuration");
		},
		async find(
			key: "email" | "userId",
			value: string,
		): Promise<LoopsContact | null> {
			const result = z
				.array(contact)
				.safeParse(
					await request(`contacts/find?${key}=${encodeURIComponent(value)}`),
				);
			if (!result.success) throw new LoopsFailure("invalid_response");
			if (result.data.length > 1) throw new LoopsFailure("identity_conflict");
			return result.data[0] ?? null;
		},
		async write(create: boolean, body: object): Promise<string> {
			const result = z
				.object({ success: z.literal(true), id: z.string().min(1) })
				.safeParse(
					await request(
						`contacts/${create ? "create" : "update"}`,
						create ? "POST" : "PUT",
						body,
					),
				);
			if (!result.success) throw new LoopsFailure("invalid_response", 60_000);
			return result.data.id;
		},
		async remove(userId: string) {
			const result = z
				.object({ success: z.literal(true) })
				.safeParse(await request("contacts/delete", "POST", { userId }));
			if (!result.success) throw new LoopsFailure("invalid_response", 60_000);
		},
	};
}
