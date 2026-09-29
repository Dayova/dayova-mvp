import type { CrmProjection } from "./crmContract";

// Bump the version whenever the Notion projection changes so old links refresh.
const VERSION = "crm-projection-v1:";

export async function crmProjectionHash(projection: CrmProjection) {
	const input = new TextEncoder().encode(VERSION + JSON.stringify(projection));
	const digest = await crypto.subtle.digest("SHA-256", input);
	return Array.from(new Uint8Array(digest), (byte) =>
		byte.toString(16).padStart(2, "0"),
	).join("");
}
