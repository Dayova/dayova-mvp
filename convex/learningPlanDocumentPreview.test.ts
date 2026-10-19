/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { beforeEach, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import { createManagedReadUrl } from "./fileStorage";
import schema from "./schema";

// The storage service is external. Exercise the real public authorization boundary.
vi.mock("./fileStorage", async (importOriginal) => ({
	...(await importOriginal<typeof import("./fileStorage")>()),
	createManagedReadUrl: vi.fn(),
}));
const modules = import.meta.glob("./**/*.ts");
beforeEach(() => {
	vi.mocked(createManagedReadUrl).mockReset();
});

async function setup(fileType = "image/jpeg") {
	const t = convexTest(schema, modules);
	const owner = t.withIdentity({ tokenIdentifier: "test:owner" });
	const id = await t.run(async (ctx) => {
		const learningPlanId = await ctx.db.insert("learningPlans", {
			ownerTokenIdentifier: "test:owner",
			subject: "Mathe",
			examTypeLabel: "Test",
			examDateKey: "2026-10-20",
			examDateLabel: "20. Oktober",
			durationMinutes: 60,
			topicDescription: "Lineare Funktionen",
			status: "draft",
			createdAt: 1,
			updatedAt: 1,
		});
		return await ctx.db.insert("learningPlanDocuments", {
			learningPlanId,
			ownerTokenIdentifier: "test:owner",
			storageId: "private-file",
			storageProvider: "convex",
			fileName: "Mitschrift.jpg",
			fileType,
			fileSizeBytes: 2048,
			createdAt: 1,
		});
	});
	return { t, owner, id };
}

test("only the material owner can request a protected preview", async () => {
	const { t, owner, id } = await setup();
	vi.mocked(createManagedReadUrl).mockResolvedValue(
		"https://example.test/preview",
	);
	await expect(
		t.mutation(api.learningPlans.getDocumentPreviewUrl, { id }),
	).rejects.toThrow();
	await expect(
		t
			.withIdentity({ tokenIdentifier: "test:other" })
			.mutation(api.learningPlans.getDocumentPreviewUrl, { id }),
	).resolves.toBeNull();
	expect(createManagedReadUrl).not.toHaveBeenCalled();
	await expect(
		owner.mutation(api.learningPlans.getDocumentPreviewUrl, { id }),
	).resolves.toBe("https://example.test/preview");
});

test("deleted material and non-image files do not mint preview URLs", async () => {
	const { t, owner, id } = await setup("application/pdf");
	await expect(
		owner.mutation(api.learningPlans.getDocumentPreviewUrl, { id }),
	).resolves.toBeNull();
	await t.run(async (ctx) => {
		await ctx.db.delete("learningPlanDocuments", id);
	});
	await expect(
		owner.mutation(api.learningPlans.getDocumentPreviewUrl, { id }),
	).resolves.toBeNull();
	expect(createManagedReadUrl).not.toHaveBeenCalled();
});

test("storage failures reach the preview consumer for recovery", async () => {
	const { owner, id } = await setup();
	vi.mocked(createManagedReadUrl).mockRejectedValue(
		new Error("Storage unavailable"),
	);
	await expect(
		owner.mutation(api.learningPlans.getDocumentPreviewUrl, { id }),
	).rejects.toThrow("Storage unavailable");
});
