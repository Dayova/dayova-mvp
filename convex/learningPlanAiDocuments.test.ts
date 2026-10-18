import { afterEach, describe, expect, test, vi } from "vitest";
import { createManagedReadUrl } from "./fileStorage";
import { __testOnlyLearningPlanAi } from "./learningPlanAi";

vi.mock("./fileStorage", () => ({ createManagedReadUrl: vi.fn() }));
vi.mock("officeparser", () => ({
	parseOffice: vi.fn().mockResolvedValue({ toText: () => "" }),
}));

const buildInput = __testOnlyLearningPlanAi.buildModelInputFromDocuments;
const document = {
	storageId: "test-document",
	storageProvider: "convex" as const,
	fileName: "photo.jpg",
	fileType: "image/jpeg",
	fileSizeBytes: 1_024,
};
const context = { runMutation: vi.fn() };

afterEach(() => {
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

function download(size: number) {
	vi.mocked(createManagedReadUrl).mockResolvedValue(
		"https://storage.test/file",
	);
	const fetch = vi.fn().mockResolvedValue(new Response(new Uint8Array(size)));
	vi.stubGlobal("fetch", fetch);
	return fetch;
}

describe("native model document size limits", () => {
	test("rejects oversized saved image metadata before downloading it", async () => {
		const fetch = download(1_024);
		await expect(
			buildInput(context, [{ ...document, fileSizeBytes: 7_000_001 }], "key"),
		).rejects.toMatchObject({
			data: {
				message: expect.stringContaining("maximal 7 MB"),
			},
		});
		expect(fetch).not.toHaveBeenCalled();
	});

	test("checks actual image bytes even when stored size understates them", async () => {
		download(7_000_001);
		await expect(buildInput(context, [document], "key")).rejects.toMatchObject({
			data: {
				message: expect.stringContaining("Lade bitte eine kleinere Datei hoch"),
			},
		});
	});

	test.each([
		["photo.jpg", "image/jpeg", 7_000_000],
		["material.pdf", "application/pdf", 10 * 1024 * 1024],
	])("passes supported %s bytes to the model", async (fileName, fileType, size) => {
		download(size);
		const result = await buildInput(
			context,
			[{ ...document, fileName, fileType, fileSizeBytes: size }],
			"key",
		);
		expect(result.fileParts).toHaveLength(1);
		expect(result.fileParts[0]?.data.byteLength).toBe(size);
		expect(result.fileParts[0]?.mediaType).toBe(fileType);
	});
});
