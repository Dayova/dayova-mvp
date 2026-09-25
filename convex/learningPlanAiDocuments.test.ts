import { afterEach, describe, expect, it, vi } from "vitest";
import { __testOnlyLearningPlanAi } from "./learningPlanAi";

vi.mock("./fileStorage", () => ({
	createManagedReadUrl: vi.fn(
		async (_ctx, reference: { storageId: string }) =>
			`https://files.example.test/${reference.storageId}`,
	),
}));

vi.mock("officeparser", () => ({
	parseOffice: vi.fn(async (bytes: Buffer) => {
		if (bytes.toString("utf8") === "broken") {
			throw new Error("Office extraction failed");
		}
		return { toText: () => "" };
	}),
}));

const ctx = { runMutation: vi.fn() } as unknown as Parameters<
	typeof __testOnlyLearningPlanAi.buildModelInputFromDocuments
>[0];

const document = (
	storageId: string,
	fileName: string,
	fileType: string,
) => ({
	storageId,
	storageProvider: "convex" as const,
	fileName,
	fileType,
	fileSizeBytes: 100,
	sourceKind: "school" as const,
});

const stubDownloads = () => {
	vi.stubGlobal(
		"fetch",
		vi.fn(async (url: string) => ({
			ok: true,
			arrayBuffer: async () =>
				new TextEncoder()
					.encode(url.endsWith("broken") ? "broken" : "Lesbarer Stoff")
					.buffer,
		})),
	);
};

describe("learning-plan document input", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("classifies one failed Office document even when another document is readable", async () => {
		stubDownloads();
		vi.spyOn(console, "error").mockImplementation(() => {});
		await expect(
			__testOnlyLearningPlanAi.buildModelInputFromDocuments(
				ctx,
				[
					document("readable", "themen.txt", "text/plain"),
					document(
						"broken",
						"arbeitsblatt.docx",
						"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
					),
				],
				"test-access-key",
			),
		).rejects.toMatchObject({
			data: { code: "material_processing" },
		});
	});

	it("keeps a PDF as native model input when text extraction fails", async () => {
		stubDownloads();
		await expect(
			__testOnlyLearningPlanAi.buildModelInputFromDocuments(
				ctx,
				[document("broken", "arbeitsblatt.pdf", "application/pdf")],
				"test-access-key",
			),
		).resolves.toMatchObject({
			fileParts: [{ mediaType: "application/pdf" }],
		});
	});
});
