// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDocument: vi.fn() }));
vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => mocks);

import { extractPdfText } from "./pdfText";

describe("PDF text extraction", () => {
	it("reads pages sequentially without loading metadata or attachments", async () => {
		const cleanup = vi.fn();
		const getMetadata = vi.fn(() => {
			throw new Error("metadata must not be read");
		});
		const getAttachments = vi.fn();
		const destroy = vi.fn();
		const getPage = vi.fn(async () => ({
			cleanup,
			getTextContent: async () => ({
				items: [
					{ str: "Italian lesson", hasEOL: true },
					{ str: "Second line", hasEOL: false },
				],
			}),
		}));
		mocks.getDocument.mockReturnValue({
			promise: Promise.resolve({
				numPages: 2,
				getPage,
				getMetadata,
				getAttachments,
			}),
			destroy,
		});
		expect(await extractPdfText(Buffer.from("pdf"), 100)).toBe(
			"Italian lesson\nSecond line\nItalian lesson\nSecond line\n",
		);
		expect(getMetadata).not.toHaveBeenCalled();
		expect(getAttachments).not.toHaveBeenCalled();
		expect(cleanup).toHaveBeenCalledTimes(2);
		expect(destroy).toHaveBeenCalledOnce();
	});

	it("stops at the text budget and does not load later pages", async () => {
		const cleanup = vi.fn();
		const destroy = vi.fn();
		const getPage = vi.fn(async () => ({
			cleanup,
			getTextContent: async () => ({
				items: [{ str: "abcdefghij", hasEOL: false }],
			}),
		}));
		mocks.getDocument.mockReturnValue({
			promise: Promise.resolve({ numPages: 100, getPage }),
			destroy,
		});
		expect(await extractPdfText(Buffer.from("pdf"), 5)).toBe("abcde");
		expect(getPage).toHaveBeenCalledTimes(1);
		expect(cleanup).toHaveBeenCalledOnce();
		expect(destroy).toHaveBeenCalledOnce();
	});

	it("cleans up a failed page and propagates the error to the existing fallback", async () => {
		const cleanup = vi.fn();
		const destroy = vi.fn();
		mocks.getDocument.mockReturnValue({
			promise: Promise.resolve({
				numPages: 1,
				getPage: async () => ({
					cleanup,
					getTextContent: async () => {
						throw new Error("bad page");
					},
				}),
			}),
			destroy,
		});
		await expect(extractPdfText(Buffer.from("pdf"), 100)).rejects.toThrow(
			"bad page",
		);
		expect(cleanup).toHaveBeenCalledOnce();
		expect(destroy).toHaveBeenCalledOnce();
	});

	it("destroys failed loading tasks", async () => {
		const destroy = vi.fn();
		mocks.getDocument.mockReturnValue({
			promise: Promise.reject(new Error("invalid PDF")),
			destroy,
		});
		await expect(extractPdfText(Buffer.from("pdf"), 100)).rejects.toThrow(
			"invalid PDF",
		);
		expect(destroy).toHaveBeenCalledOnce();
	});

	it("returns empty text for scanned pages so vision fallback can run", async () => {
		const destroy = vi.fn();
		mocks.getDocument.mockReturnValue({
			promise: Promise.resolve({
				numPages: 1,
				getPage: async () => ({
					cleanup: vi.fn(),
					getTextContent: async () => ({ items: [] }),
				}),
			}),
			destroy,
		});
		expect((await extractPdfText(Buffer.from("pdf"), 100)).trim()).toBe("");
		expect(destroy).toHaveBeenCalledOnce();
	});
});
