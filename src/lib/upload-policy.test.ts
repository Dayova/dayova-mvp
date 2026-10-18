import { describe, expect, test } from "vitest";
import {
	getLearningMaterialFileLimit,
	isValidLearningMaterialSize,
	MAX_LEARNING_MATERIAL_FILE_BYTES,
} from "../../convex/learningMaterialPolicy";
import { validateUploadFile } from "./upload-policy";

describe("learning-material upload limits", () => {
	test.each([
		["photo.jpg", "image/jpeg"],
		["photo.PNG", "application/octet-stream"],
		["photo.webp", ""],
		["photo.pdf", "image/jpeg"],
	])("applies the decimal inline image limit to %s (%s)", (name, type) => {
		const limit = getLearningMaterialFileLimit(name, type);
		expect(limit).toEqual({ bytes: 7_000_000, label: "7 MB" });
		expect(isValidLearningMaterialSize(7_000_000, name, type)).toBe(true);
		for (const size of [7_000_001, 7 * 1024 * 1024, 10 * 1024 * 1024]) {
			expect(isValidLearningMaterialSize(size, name, type)).toBe(false);
			expect(
				validateUploadFile({ name, size }, limit.bytes, limit.label).message,
			).toContain("maximal 7 MB");
		}
	});

	test.each([
		1.2 * 1024 * 1024,
		8 * 1024 * 1024,
		10 * 1024 * 1024,
	])("accepts supported PDFs at %i bytes", (size) => {
		expect(
			validateUploadFile(
				{ name: "material.pdf", size },
				MAX_LEARNING_MATERIAL_FILE_BYTES,
			).valid,
		).toBe(true);
	});
	test.each([
		0,
		-1,
		NaN,
		Infinity,
		MAX_LEARNING_MATERIAL_FILE_BYTES + 1,
	])("rejects invalid backend sizes: %i", (size) => {
		expect(isValidLearningMaterialSize(size)).toBe(false);
		expect(
			validateUploadFile(
				{ name: "material.pdf", size },
				MAX_LEARNING_MATERIAL_FILE_BYTES,
			).valid,
		).toBe(false);
	});
	test("preserves the timetable limit", () => {
		expect(
			validateUploadFile({ name: "timetable.pdf", size: 8 * 1024 * 1024 })
				.valid,
		).toBe(false);
	});
	test("explains the learning-material limit", () => {
		expect(
			validateUploadFile(
				{ name: "material.pdf", size: 11 * 1024 * 1024 },
				MAX_LEARNING_MATERIAL_FILE_BYTES,
			).message,
		).toContain("10.0 MiB");
	});
});
