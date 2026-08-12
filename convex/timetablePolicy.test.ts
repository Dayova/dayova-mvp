import { describe, expect, it } from "vitest";
import {
	isSupportedTimetableFileType,
	isValidTimetableFileSize,
	MAX_TIMETABLE_FILE_BYTES,
	normalizeTimetableFileType,
} from "./timetablePolicy";

describe("timetable upload policy", () => {
	it("accepts only the timetable MIME allow-list", () => {
		expect(isSupportedTimetableFileType("application/pdf")).toBe(true);
		expect(isSupportedTimetableFileType("IMAGE/JPEG; charset=binary")).toBe(
			true,
		);
		expect(isSupportedTimetableFileType("text/html")).toBe(false);
		expect(normalizeTimetableFileType(" Image/PNG ; charset=binary")).toBe(
			"image/png",
		);
	});

	it("rejects empty, non-finite, and oversized files", () => {
		expect(isValidTimetableFileSize(1)).toBe(true);
		expect(isValidTimetableFileSize(MAX_TIMETABLE_FILE_BYTES)).toBe(true);
		expect(isValidTimetableFileSize(0)).toBe(false);
		expect(isValidTimetableFileSize(Number.NaN)).toBe(false);
		expect(isValidTimetableFileSize(MAX_TIMETABLE_FILE_BYTES + 1)).toBe(false);
	});
});
