import type { CrmError, CrmProjection } from "./crmContract";
import { CRM_PROFILE_PROPERTIES, profileProperties } from "./crmProfile";

export const CRM_MAX_STUDENTS = 200;
export const CRM_APP_ORIGIN_TAG = "Added through Integration with App";
export const CRM_PROPERTIES = {
	...CRM_PROFILE_PROPERTIES,
	Email: "email",
	"Clerk User ID": "rich_text",
	"Convex User ID": "rich_text",
	"Identity Status": "select",
	"Entitlement State": "select",
	"Subscription Product": "rich_text",
	"Payment Status": "select",
	"Subscription Plan": "select",
	"Subscription Store": "rich_text",
	"Subscription Expires At": "date",
	"Billing Grace Expires At": "date",
	"Trial Started At": "date",
	"Trial Expires At": "date",
	"Will Renew": "checkbox",
	"Last Synced At": "date",
	"Sync Source": "rich_text",
	"Sync Error": "select",
} as const;

export class CrmFailure extends Error {
	constructor(readonly category: CrmError) {
		super(`CRM sync: ${category}`);
	}
}
const object = (value: unknown): Record<string, unknown> => {
	if (!value || typeof value !== "object" || Array.isArray(value))
		throw new CrmFailure("schema");
	return value as Record<string, unknown>;
};
const uuid = (value: string) =>
	/^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(
		value,
	);
const canonicalId = (value: string) => value.replaceAll("-", "").toLowerCase();
export type StudentRow = {
	pageId: string;
	clerkId: string;
	email?: string;
	markedPaid: boolean;
};

export function parseStudent(value: unknown, dataSourceId: string): StudentRow {
	const page = object(value);
	const parent = object(page.parent);
	if (
		typeof page.id !== "string" ||
		!uuid(page.id) ||
		page.archived === true ||
		page.in_trash === true ||
		typeof parent.data_source_id !== "string" ||
		canonicalId(parent.data_source_id) !== canonicalId(dataSourceId)
	)
		throw new CrmFailure("identity_changed");
	const properties = object(page.properties);
	const identity = object(properties["Clerk User ID"]);
	if (identity.type !== "rich_text" || !Array.isArray(identity.rich_text))
		throw new CrmFailure("schema");
	const clerkId = identity.rich_text
		.map((part) => {
			const item = object(part);
			if (typeof item.plain_text === "string") return item.plain_text;
			const text = object(item.text);
			if (typeof text.content !== "string") throw new CrmFailure("schema");
			return text.content;
		})
		.join("")
		.trim();
	const email = properties.Email ? object(properties.Email).email : undefined;
	const payment = properties["Payment Status"]
		? object(properties["Payment Status"]).select
		: undefined;
	return {
		pageId: page.id,
		clerkId,
		...(typeof email === "string" && email.trim()
			? { email: email.trim() }
			: {}),
		markedPaid: payment != null && object(payment).name === "Paid",
	};
}

const richText = (value: string | null) => ({
	rich_text: value ? [{ text: { content: value } }] : [],
});
const date = (value: number | null) => ({
	date: value === null ? null : { start: new Date(value).toISOString() },
});
export function projectionProperties(projection: CrmProjection, now: number) {
	return {
		...profileProperties(projection.profile),
		Email: { email: projection.email },
		"Convex User ID": richText(projection.userId),
		"Identity Status": { select: { name: "matched" } },
		"Entitlement State": { select: { name: projection.state } },
		"Subscription Product": richText(projection.product),
		"Payment Status": { select: { name: projection.paymentStatus } },
		"Subscription Plan": { select: { name: projection.subscriptionPlan } },
		"Subscription Store": richText(projection.store),
		"Subscription Expires At": date(projection.expiresAt),
		"Billing Grace Expires At": date(projection.graceExpiresAt),
		"Trial Started At": date(projection.trialStartedAt),
		"Trial Expires At": date(projection.trialExpiresAt),
		"Will Renew": { checkbox: projection.willRenew },
		"Last Synced At": date(now),
		"Sync Source": richText("Convex effective access / DAY-366"),
		"Sync Error": { select: null },
	};
}

export function createNotionClient(token: string, dataSourceId: string) {
	if (!token || !uuid(dataSourceId)) throw new CrmFailure("configuration");
	let nextRequestAt = 0;
	const deadline = Date.now() + 8 * 60_000;
	const pause = async (ms: number) => {
		if (Date.now() + ms >= deadline) throw new CrmFailure("timeout");
		if (ms > 0) await new Promise((resolve) => setTimeout(resolve, ms));
	};
	const request = async (
		path: string,
		method = "GET",
		body?: unknown,
		retrySafe = true,
	): Promise<unknown> => {
		for (let attempt = 0; attempt < 4; attempt++) {
			await pause(Math.max(0, nextRequestAt - Date.now()));
			nextRequestAt = Date.now() + 400; // Below Notion's average 3 requests/second.
			let response: Response;
			try {
				response = await fetch(`https://api.notion.com/v1/${path}`, {
					method,
					headers: {
						Authorization: `Bearer ${token}`,
						"Notion-Version": "2025-09-03",
						"Content-Type": "application/json",
					},
					...(body !== undefined ? { body: JSON.stringify(body) } : {}),
					signal: AbortSignal.timeout(15_000),
				});
			} catch {
				// PATCH success can be ambiguous. Retry the same deterministic projection.
				if (!retrySafe || attempt === 3) throw new CrmFailure("unavailable");
				await pause(1000 * 2 ** attempt);
				continue;
			}
			if (response.ok) {
				try {
					return await response.json();
				} catch {
					throw new CrmFailure("schema");
				}
			}
			if (response.status === 429 || response.status >= 500) {
				if (!retrySafe || attempt === 3)
					throw new CrmFailure(
						response.status === 429 ? "rate_limited" : "unavailable",
					);
				const retryAfter = Number(response.headers.get("Retry-After"));
				await pause(
					Math.max(
						1000 * 2 ** attempt,
						Number.isFinite(retryAfter) ? retryAfter * 1000 : 0,
					),
				);
				continue;
			}
			throw new CrmFailure(
				response.status === 401 || response.status === 403
					? "unauthorized"
					: response.status === 404
						? "identity_changed"
						: "schema",
			);
		}
		throw new CrmFailure("unavailable");
	};
	return {
		async checkCreationSchema() {
			const properties = object(
				object(await request(`data_sources/${dataSourceId}`)).properties,
			);
			for (const [name, type] of Object.entries({
				Student: "title",
				Email: "email",
				Tags: "multi_select",
				Status: "status",
				"Registration Date": "date",
			})) {
				if (!properties[name] || object(properties[name]).type !== type)
					throw new CrmFailure("schema");
			}
			const statuses = object(object(properties.Status).status).options;
			if (
				!Array.isArray(statuses) ||
				!statuses.some((option) => object(option).name === "Registered")
			) {
				throw new CrmFailure("schema");
			}
		},
		async createStudent(
			clerkId: string,
			email: string,
			name: string,
			projection: CrmProjection,
			now: number,
		) {
			// POST /pages has no assumed idempotency guarantee. Persist the attempt first
			// and recover by Clerk ID; never blindly repeat an uncertain create request.
			return parseStudent(
				await request(
					"pages",
					"POST",
					{
						parent: { type: "data_source_id", data_source_id: dataSourceId },
						properties: {
							Student: {
								title: [
									{
										text: {
											content: (name.trim() || "Dayova student").slice(0, 2000),
										},
									},
								],
							},
							Tags: { multi_select: [{ name: CRM_APP_ORIGIN_TAG }] },
							Status: { status: { name: "Registered" } },
							"Registration Date": date(projection.registeredAt),
							"Clerk User ID": richText(clerkId),
							...projectionProperties(projection, now),
							Email: { email },
						},
					},
					false,
				),
				dataSourceId,
			);
		},
		async checkSchema(live: boolean) {
			const schema = object(
				object(await request(`data_sources/${dataSourceId}`)).properties,
			);
			const required = live ? CRM_PROPERTIES : { "Clerk User ID": "rich_text" };
			for (const [name, type] of Object.entries(required))
				if (!schema[name] || object(schema[name]).type !== type)
					throw new CrmFailure("schema");
		},
		async students(filter?: unknown): Promise<StudentRow[]> {
			const rows: StudentRow[] = [];
			let cursor: string | undefined;
			const cursors = new Set<string>();
			do {
				const result = object(
					await request(`data_sources/${dataSourceId}/query`, "POST", {
						page_size: 100,
						...(cursor ? { start_cursor: cursor } : {}),
						...(filter ? { filter } : {}),
					}),
				);
				if (
					!Array.isArray(result.results) ||
					typeof result.has_more !== "boolean"
				)
					throw new CrmFailure("schema");
				rows.push(
					...result.results.map((row) => parseStudent(row, dataSourceId)),
				);
				if (rows.length > CRM_MAX_STUDENTS) throw new CrmFailure("capacity");
				if (!result.has_more) return rows;
				if (
					typeof result.next_cursor !== "string" ||
					cursors.has(result.next_cursor)
				)
					throw new CrmFailure("schema");
				cursor = result.next_cursor;
				cursors.add(cursor);
				if (cursors.size > 10) throw new CrmFailure("capacity");
			} while (cursor);
			return rows;
		},
		async readStudent(pageId: string) {
			if (!uuid(pageId)) throw new CrmFailure("schema");
			return parseStudent(await request(`pages/${pageId}`), dataSourceId);
		},
		async writeStudent(pageId: string, projection: CrmProjection, now: number) {
			if (!uuid(pageId)) throw new CrmFailure("schema");
			await request(`pages/${pageId}`, "PATCH", {
				properties: projectionProperties(projection, now),
			});
		},
	};
}
