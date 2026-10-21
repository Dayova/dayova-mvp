import { v } from "convex/values";
import {
	CONTACT_CONSENT_VERSION,
	type ContactChoice,
	contactChoiceError,
	emptyContactChoice,
	normalizeContactPhone,
} from "../src/lib/contact-preferences";
import type { Doc } from "./_generated/dataModel";
import {
	type MutationCtx,
	mutation,
	type QueryCtx,
	query,
} from "./_generated/server";
import { assertAccountActive } from "./accountDeletion";
import {
	contactChoiceValidator,
	contactPreferencesValidator,
} from "./contactConsentContract";
import { enqueueCrmUpdate } from "./crmUpdates";
import { throwUserFacingError } from "./errors";

async function currentUser(ctx: QueryCtx | MutationCtx) {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) throwUserFacingError("Nicht authentifiziert.");
	await assertAccountActive(ctx, identity.tokenIdentifier);
	const user = await ctx.db
		.query("users")
		.withIndex("by_tokenIdentifier", (q) =>
			q.eq("tokenIdentifier", identity.tokenIdentifier),
		)
		.unique();
	if (!user) throwUserFacingError("Der Nutzer konnte nicht gefunden werden.");
	return user;
}

export async function saveContactChoice(
	ctx: MutationCtx,
	user: Doc<"users">,
	choice: ContactChoice,
	source: "onboarding" | "settings",
) {
	const error = contactChoiceError(choice);
	if (error) throwUserFacingError(error);
	const granted = choice.feedback || choice.news;
	const next = {
		...choice,
		phone: granted ? (normalizeContactPhone(choice.phone) ?? "") : "",
		version: CONTACT_CONSENT_VERSION,
	};
	const previous = user.contactPreferences;
	if (
		previous &&
		previous.phone === next.phone &&
		previous.feedback === next.feedback &&
		previous.news === next.news &&
		previous.version === next.version
	)
		return previous;
	const snapshot = {
		...next,
		updatedAt: Date.now(),
		revision: (previous?.revision ?? 0) + 1,
	};
	await ctx.db.patch("users", user._id, { contactPreferences: snapshot });
	await ctx.db.insert("contactConsentEvents", {
		userId: user._id,
		...snapshot,
		source,
	});
	await enqueueCrmUpdate(ctx, user._id);
	return snapshot;
}

export const getMine = query({
	args: {},
	returns: v.union(contactPreferencesValidator, v.null()),
	handler: async (ctx) => (await currentUser(ctx)).contactPreferences ?? null,
});

export const save = mutation({
	args: { choice: contactChoiceValidator, expectedRevision: v.number() },
	returns: contactPreferencesValidator,
	handler: async (ctx, { choice, expectedRevision }) => {
		const user = await currentUser(ctx);
		if ((user.contactPreferences?.revision ?? 0) !== expectedRevision)
			throwUserFacingError(
				"Deine Kontaktauswahl wurde inzwischen geändert. Bitte lade sie neu und prüfe sie erneut.",
			);
		return saveContactChoice(ctx, user, choice, "settings");
	},
});

// A delayed settings request cannot re-enable consent after this unconditional withdrawal.
export const withdraw = mutation({
	args: {},
	returns: contactPreferencesValidator,
	handler: async (ctx) =>
		saveContactChoice(
			ctx,
			await currentUser(ctx),
			emptyContactChoice(),
			"settings",
		),
});
