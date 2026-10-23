import type { TestConvex } from "convex-test";
import { internal } from "../_generated/api";
import type schema from "../schema";
/** Eligible learner fixture for tests about learning behavior, not entitlement policy.
 * Uses the real provider-snapshot mutation; no access guard is mocked/bypassed.
 * Indefinite provider access keeps calendar/time-travel tests independent of trial expiry.
 */
export async function grantTestLearningAccess<
	T extends Pick<TestConvex<typeof schema>, "run" | "mutation">,
>(t: T) {
	const identity = await t.run((ctx) => ctx.auth.getUserIdentity());
	if (!identity)
		throw new Error("Eligible fixture requires an authenticated identity");
	await t.run(async (ctx) => {
		const user = await ctx.db
			.query("users")
			.withIndex("by_tokenIdentifier", (q) =>
				q.eq("tokenIdentifier", identity.tokenIdentifier),
			)
			.unique();
		if (!user)
			await ctx.db.insert("users", {
				clerkId: identity.subject,
				tokenIdentifier: identity.tokenIdentifier,
				email: identity.email ?? "learner@example.invalid",
			});
	});
	await t.mutation(internal.entitlements.applyRevenueCatSnapshot, {
		ownerTokenIdentifier: identity.tokenIdentifier,
		active: true,
		verifiedAt: Date.now(),
	});
	return t;
}
