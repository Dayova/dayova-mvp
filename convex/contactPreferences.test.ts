/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import {
	CONTACT_CONSENT_VERSION,
	emptyContactChoice,
} from "../src/lib/contact-preferences";
import { api, internal } from "./_generated/api";
import { deletedAccountProperties, projectionProperties } from "./crmNotion";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const identity = {
	subject: "contact-student",
	tokenIdentifier: "test:contact-student",
	email: "contact@example.com",
};
const choice = {
	phone: "01512 3456789",
	feedback: true,
	news: false,
	version: CONTACT_CONSENT_VERSION,
};
const answers = {
	grade: "10",
	state: "Berlin",
	schoolType: "gymnasium",
	contact: choice,
};

test("authenticates decisions and never treats a legacy phone as consent", async () => {
	const t = convexTest(schema, modules);
	await expect(t.query(api.contactPreferences.getMine, {})).rejects.toThrow(
		"Nicht authentifiziert",
	);
	const user = t.withIdentity(identity);
	await user.mutation(api.users.syncCurrentUser, { phone: "+4915123456789" });
	expect(await user.query(api.contactPreferences.getMine, {})).toBeNull();
	const other = t.withIdentity({
		...identity,
		subject: "other",
		tokenIdentifier: "test:other",
		email: "other@example.com",
	});
	await other.mutation(api.users.syncCurrentUser, {});
	await user.mutation(api.contactPreferences.save, {
		choice,
		expectedRevision: 0,
	});
	expect(await other.query(api.contactPreferences.getMine, {})).toBeNull();
});

test("stores normalized purpose-specific evidence with a server timestamp and idempotent retries", async () => {
	const t = convexTest(schema, modules).withIdentity(identity);
	const userId = await t.mutation(api.users.syncCurrentUser, {});
	const saved = await t.mutation(api.contactPreferences.save, {
		choice,
		expectedRevision: 0,
	});
	expect(saved).toMatchObject({
		phone: "+4915123456789",
		feedback: true,
		news: false,
		version: CONTACT_CONSENT_VERSION,
		revision: 1,
		updatedAt: expect.any(Number),
	});
	await t.mutation(api.contactPreferences.save, {
		choice,
		expectedRevision: 1,
	});
	const events = await t.run((ctx) =>
		ctx.db
			.query("contactConsentEvents")
			.withIndex("by_userId", (q) => q.eq("userId", userId))
			.take(10),
	);
	expect(events).toHaveLength(1);
	expect(events[0]).toMatchObject({
		source: "settings",
		updatedAt: saved.updatedAt,
	});
});

test("withdrawal clears the number and rejects a delayed grant with an old revision", async () => {
	const t = convexTest(schema, modules).withIdentity(identity);
	await t.mutation(api.users.syncCurrentUser, {});
	await t.mutation(api.contactPreferences.save, {
		choice,
		expectedRevision: 0,
	});
	expect(await t.mutation(api.contactPreferences.withdraw, {})).toMatchObject({
		phone: "",
		feedback: false,
		news: false,
		revision: 2,
	});
	await expect(
		t.mutation(api.contactPreferences.save, { choice, expectedRevision: 1 }),
	).rejects.toThrow("inzwischen geändert");
	await t.mutation(api.users.saveOnboardingAnswers, { answers });
	expect(await t.query(api.contactPreferences.getMine, {})).toMatchObject({
		feedback: false,
		news: false,
		revision: 2,
	});
});

test("an explicit withdrawal invalidates pending grants even when contact is already off", async () => {
	const t = convexTest(schema, modules).withIdentity(identity);
	await t.mutation(api.users.syncCurrentUser, {});
	await t.mutation(api.contactPreferences.save, {
		choice: emptyContactChoice(),
		expectedRevision: 0,
	});
	expect(await t.mutation(api.contactPreferences.withdraw, {})).toMatchObject({
		phone: "",
		feedback: false,
		news: false,
		revision: 2,
	});
	await expect(
		t.mutation(api.contactPreferences.save, { choice, expectedRevision: 1 }),
	).rejects.toThrow("inzwischen geändert");
	expect(
		await t.mutation(api.contactPreferences.save, {
			choice: emptyContactChoice(),
			expectedRevision: 2,
		}),
	).toMatchObject({ revision: 3 });
	await expect(
		t.mutation(api.contactPreferences.save, { choice, expectedRevision: 2 }),
	).rejects.toThrow("inzwischen geändert");
});

test("imports onboarding once, survives retries and leaves old installed clients compatible", async () => {
	const t = convexTest(schema, modules).withIdentity(identity);
	await t.mutation(api.users.syncCurrentUser, {});
	await t.mutation(api.users.saveOnboardingAnswers, { answers });
	await t.mutation(api.users.saveOnboardingAnswers, { answers });
	expect(await t.query(api.contactPreferences.getMine, {})).toMatchObject({
		revision: 1,
		feedback: true,
	});
	await t.mutation(api.contactPreferences.withdraw, {});
	await t.mutation(api.users.saveOnboardingAnswers, { answers });
	const { contact: _contact, ...legacy } = answers;
	await t.mutation(api.users.saveOnboardingAnswers, { answers: legacy });
	expect(await t.query(api.contactPreferences.getMine, {})).toMatchObject({
		revision: 2,
		feedback: false,
	});
});

test.each([
	["stale version", { ...choice, version: "retired-contact-wording" }],
	["invalid phone", { ...choice, phone: "123" }],
])("onboarding stays usable with a %s contact grant", async (_reason, contact) => {
	const t = convexTest(schema, modules).withIdentity(identity);
	const userId = await t.mutation(api.users.syncCurrentUser, {});
	await expect(
		t.mutation(api.users.saveOnboardingAnswers, {
			answers: {
				...answers,
				contact,
				studyDays: "Montag",
				learningTime: "16:30",
				dailySchoolTime: "45 min",
			},
		}),
	).resolves.toEqual({ success: true, learningTimesCreated: 1 });
	await expect(t.query(api.learningTimes.listMine, {})).resolves.toMatchObject([
		{ dayOfWeek: 1, startTime: "16:30", endTime: "17:15" },
	]);
	const savedAnswers = await t.run(async (ctx) => {
		const rows = await ctx.db
			.query("userOnboardingAnswers")
			.withIndex("by_userId", (q) => q.eq("userId", userId))
			.take(20);
		return Object.fromEntries(
			await Promise.all(
				rows.map(async (row) => {
					const question = await ctx.db.get(
						"onboardingQuestions",
						row.questionId,
					);
					if (!question) throw new Error("Saved answer has no question");
					return [question.key, row.answer];
				}),
			),
		);
	});
	expect(savedAnswers).toEqual({
		grade: "10",
		state: "Berlin",
		schoolType: "gymnasium",
		studyDays: "Montag",
		learningTime: "16:30",
		dailySchoolTime: "45 min",
	});
	await expect(t.query(api.contactPreferences.getMine, {})).resolves.toBeNull();
	expect(
		await t.run((ctx) =>
			ctx.db
				.query("contactConsentEvents")
				.withIndex("by_userId", (q) => q.eq("userId", userId))
				.take(1),
		),
	).toEqual([]);
});

test("validates grants without blocking withdrawal or persisting unused numbers", async () => {
	const t = convexTest(schema, modules).withIdentity(identity);
	await t.mutation(api.users.syncCurrentUser, {});
	for (const invalid of [
		{ ...choice, phone: "123" },
		{ ...choice, version: "old" },
	]) {
		await expect(
			t.mutation(api.contactPreferences.save, {
				choice: invalid,
				expectedRevision: 0,
			}),
		).rejects.toThrow();
	}
	expect(
		await t.mutation(api.contactPreferences.save, {
			choice: { ...emptyContactChoice(), phone: "not a number" },
			expectedRevision: 0,
		}),
	).toMatchObject({ phone: "", feedback: false, news: false });
});

test("projects independent permissions, withdrawal and deletion without touching manual phone or circles", async () => {
	const t = convexTest(schema, modules).withIdentity(identity);
	await t.mutation(api.users.syncCurrentUser, {});
	await t.mutation(api.contactPreferences.save, {
		choice: { ...choice, feedback: false, news: true },
		expectedRevision: 0,
	});
	const match = await t.query(internal.crmSyncState.inspectStudent, {
		pageId: "test-page",
		clerkId: identity.subject,
		now: Date.now(),
	});
	if (match.status !== "matched") throw new Error("projection missing");
	const projected = projectionProperties(match.projection, Date.now());
	expect(projected).toMatchObject({
		"App Contact Phone": { phone_number: "+4915123456789" },
		"App Feedback Contact": { checkbox: false },
		"App WhatsApp News": { checkbox: true },
	});
	for (const key of ["Phone Number", "Inner circle", "Beta Tester"])
		expect(projected).not.toHaveProperty(key);
	await t.mutation(api.contactPreferences.withdraw, {});
	const revoked = await t.query(internal.crmSyncState.inspectStudent, {
		pageId: "test-page",
		clerkId: identity.subject,
		now: Date.now(),
	});
	if (revoked.status !== "matched") throw new Error("projection missing");
	expect(projectionProperties(revoked.projection, Date.now())).toMatchObject({
		"App Contact Phone": { phone_number: null },
		"App WhatsApp News": { checkbox: false },
	});
	expect(deletedAccountProperties(Date.now(), Date.now())).toMatchObject({
		"App Contact Phone": { phone_number: null },
		"App Feedback Contact": { checkbox: false },
		"App WhatsApp News": { checkbox: false },
	});
});
