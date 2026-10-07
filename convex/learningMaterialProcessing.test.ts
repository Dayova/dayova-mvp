// @vitest-environment node
import { Buffer } from "node:buffer";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("./fileStorage", () => ({
	createManagedReadUrl: vi.fn(async () => "https://example.invalid/material"),
}));
vi.mock("./pdfText", () => ({
	extractPdfText: vi.fn(async () => "Lineare Funktionen"),
}));

import { createManagedReadUrl } from "./fileStorage";
import { __testOnlyLearningPlanAi } from "./learningPlanAi";

const build = __testOnlyLearningPlanAi.buildModelInputFromDocuments;
const ctx = { runMutation: vi.fn() } as unknown as Parameters<typeof build>[0];
const document = (
	size: number,
	name = "lesson.pdf",
	type = "application/pdf",
) => ({
	storageId: "test-file",
	storageProvider: "r2" as const,
	fileName: name,
	fileType: type,
	fileSizeBytes: size,
});
afterEach(() => {
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});
describe("actual downloaded material bytes", () => {
	test("passes a 25 MiB PDF to the native model input without truncation", async () => {
		const bytes = Buffer.alloc(25 * 1024 * 1024, 32);
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response(bytes)),
		);
		const result = await build(ctx, [document(bytes.length)], "test-access");
		expect(Buffer.byteLength(result.fileParts[0].data, "base64")).toBe(
			bytes.length,
		);
		expect(result.fileParts[0].mediaType).toBe("application/pdf");
		expect(result.sourceContext).toBe("");
	});
	test("rejects oversized declared files before downloading", async () => {
		const fetcher = vi.fn();
		vi.stubGlobal("fetch", fetcher);
		await expect(
			build(ctx, [document(25 * 1024 * 1024 + 1)], "test-access"),
		).rejects.toThrow("maximal 25 MiB");
		expect(fetcher).not.toHaveBeenCalled();
		expect(createManagedReadUrl).not.toHaveBeenCalled();
	});
	test("rejects actual bytes over the limit even when metadata claims a small file", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response(Buffer.alloc(25 * 1024 * 1024 + 1))),
		);
		await expect(build(ctx, [document(100)], "test-access")).rejects.toThrow(
			"maximal 25 MiB",
		);
	});
	test("keeps image processing at 7 MiB", async () => {
		await expect(
			build(
				ctx,
				[document(7 * 1024 * 1024 + 1, "photo.jpg", "image/jpeg")],
				"test-access",
			),
		).rejects.toThrow("maximal 7 MiB");
	});
	test("keeps other document processing at 25 MiB", async () => {
		await expect(
			build(
				ctx,
				[
					document(
						25 * 1024 * 1024 + 1,
						"lesson.docx",
						"application/octet-stream",
					),
				],
				"test-access",
			),
		).rejects.toThrow("maximal 25 MiB");
	});
});

test("rejects two 25 MiB PDFs before downloading either", async () => {
	const fetcher = vi.fn();
	vi.stubGlobal("fetch", fetcher);
	await expect(
		build(
			ctx,
			[document(25 * 1024 * 1024), document(25 * 1024 * 1024)],
			"test-access",
		),
	).rejects.toThrow("zusammen maximal 25 MiB");
	expect(fetcher).not.toHaveBeenCalled();
});
test("enforces aggregate size on actual bytes despite understated metadata", async () => {
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => new Response(Buffer.alloc(13 * 1024 * 1024))),
	);
	await expect(
		build(ctx, [document(100), document(100)], "test-access"),
	).rejects.toThrow("zusammen maximal 25 MiB");
});
test("accepts two PDFs totaling exactly 25 MiB", async () => {
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => new Response(Buffer.alloc(12.5 * 1024 * 1024))),
	);
	const result = await build(
		ctx,
		[document(12.5 * 1024 * 1024), document(12.5 * 1024 * 1024)],
		"test-access",
	);
	expect(
		result.fileParts.reduce(
			(sum, part) => sum + Buffer.byteLength(part.data, "base64"),
			0,
		),
	).toBe(25 * 1024 * 1024);
});
