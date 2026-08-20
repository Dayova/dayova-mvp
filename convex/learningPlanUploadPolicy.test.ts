import { describe, expect, test } from "vitest";
import {
	LEARNING_PLAN_MAX_FILE_BYTES,
	LEARNING_PLAN_MAX_FILE_COUNT,
	LEARNING_PLAN_MAX_TOTAL_BYTES,
	validateLearningPlanUploadBatch,
} from "./learningPlanUploadPolicy";

describe("learning-plan upload policy", () => {
	test("accepts a batch within file, count, and aggregate limits", () => {
		expect(
			validateLearningPlanUploadBatch(
				[{ fileSizeBytes: LEARNING_PLAN_MAX_FILE_BYTES }],
				[
					{ name: "arbeitsblatt.pdf", size: 1_024 },
					{ name: "tafelbild.jpg", size: 2_048 },
				],
			),
		).toEqual({ valid: true, code: null });
	});

	test("rejects count and aggregate bypasses", () => {
		expect(
			validateLearningPlanUploadBatch(
				Array.from({ length: LEARNING_PLAN_MAX_FILE_COUNT }, () => ({
					fileSizeBytes: 1,
				})),
				[{ name: "extra.pdf", size: 1 }],
			),
		).toEqual({ valid: false, code: "too_many_files" });

		expect(
			validateLearningPlanUploadBatch(
				[{ fileSizeBytes: LEARNING_PLAN_MAX_TOTAL_BYTES - 100 }],
				[{ name: "extra.pdf", size: 101 }],
			),
		).toEqual({ valid: false, code: "total_too_large" });
	});

	test("rejects unsupported and oversized files", () => {
		expect(
			validateLearningPlanUploadBatch(
				[],
				[{ name: "archive.zip", size: 1_024 }],
			),
		).toEqual({ valid: false, code: "unsupported_type" });
		expect(
			validateLearningPlanUploadBatch(
				[],
				[{ name: "scan.pdf", size: LEARNING_PLAN_MAX_FILE_BYTES + 1 }],
			),
		).toEqual({ valid: false, code: "file_too_large" });
	});
});
