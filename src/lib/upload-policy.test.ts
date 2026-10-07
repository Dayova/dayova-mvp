import { describe, expect, test } from "vitest";
import { validateUploadFile } from "./upload-policy";

describe("learning material size boundaries", () => {
	test.each([
		["lesson.pdf", "application/pdf", 40],
		["LESSON.PDF", "application/octet-stream", 40],
		[
			"lesson.docx",
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			25,
		],
		["lesson.txt", "text/plain", 25],
		["photo.jpg", "image/jpeg", 7],
		["photo.png", "application/pdf", 7],
		["photo.pdf", "image/png", 7],
	])("%s accepts the exact limit and rejects one byte above it", (name, type, mib) => {
		expect(
			validateUploadFile(
				{ name, type, size: mib * 1024 * 1024 },
				"learningMaterial",
			).valid,
		).toBe(true);
		expect(
			validateUploadFile(
				{ name, type, size: mib * 1024 * 1024 + 1 },
				"learningMaterial",
			),
		).toMatchObject({
			valid: false,
			message: expect.stringContaining(`maximal ${mib} MiB`),
		});
	});
	test("timetable/default validation remains 7 MiB", () => {
		expect(
			validateUploadFile({ name: "schedule.pdf", size: 7 * 1024 * 1024 }).valid,
		).toBe(true);
		expect(
			validateUploadFile({ name: "schedule.pdf", size: 7 * 1024 * 1024 + 1 })
				.valid,
		).toBe(false);
	});
	test.each([
		0,
		-1,
		Number.NaN,
		Number.POSITIVE_INFINITY,
		undefined,
	])("rejects unreadable size %s", (size) => {
		expect(
			validateUploadFile({ name: "lesson.pdf", size }, "learningMaterial")
				.valid,
		).toBe(false);
	});
	test("rejects unsupported files even below the limit", () => {
		expect(
			validateUploadFile({ name: "lesson.exe", size: 100 }, "learningMaterial")
				.valid,
		).toBe(false);
	});
});
