/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { AI_CONSENT_VERSION } from "../src/lib/ai-consent";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const userIdentity = {
	subject: "student",
	tokenIdentifier: "test:student",
	email: "student@example.com",
};

test("requires a current explicit consent before AI processing", async () => {
	const backend = convexTest(schema, modules).withIdentity(userIdentity);
	await backend.mutation(api.users.syncCurrentUser, { name: "Student" });

	expect(await backend.query(api.aiConsent.getMine, {})).toEqual({
		status: "notSet",
		version: null,
		updatedAt: null,
		grantedAt: null,
		hasCurrentConsent: false,
	});
	await expect(
		backend.query(internal.aiConsent.requireCurrentConsent, {}),
	).rejects.toThrow("Bestätige zuerst die KI-Datenverarbeitung");

	const granted = await backend.mutation(api.aiConsent.setDecision, {
		decision: "granted",
		version: AI_CONSENT_VERSION,
	});
	expect(granted).toMatchObject({
		status: "granted",
		version: AI_CONSENT_VERSION,
		hasCurrentConsent: true,
	});
	expect(granted.grantedAt).toEqual(expect.any(Number));
	await expect(
		backend.query(internal.aiConsent.requireCurrentConsent, {}),
	).resolves.toBeNull();

	const withdrawn = await backend.mutation(api.aiConsent.withdraw, {});
	expect(withdrawn).toMatchObject({
		status: "withdrawn",
		version: AI_CONSENT_VERSION,
		hasCurrentConsent: false,
		grantedAt: granted.grantedAt,
	});
	await expect(
		backend.query(internal.aiConsent.requireCurrentConsent, {}),
	).rejects.toThrow("Bestätige zuerst die KI-Datenverarbeitung");
});

test("rejects stale or invented consent text versions", async () => {
	const backend = convexTest(schema, modules).withIdentity(userIdentity);
	await backend.mutation(api.users.syncCurrentUser, { name: "Student" });

	await expect(
		backend.mutation(api.aiConsent.setDecision, {
			decision: "granted",
			version: "outdated-consent-copy",
		}),
	).rejects.toThrow("Datenschutzhinweise wurden aktualisiert");
	expect(await backend.query(api.aiConsent.getMine, {})).toMatchObject({
		status: "notSet",
		hasCurrentConsent: false,
	});
});
