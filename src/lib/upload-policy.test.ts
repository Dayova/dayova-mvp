import { describe, expect, it } from "vitest";
import {
	LEARNING_PLAN_UPLOAD_LIMITS,
	validateUploadFile,
} from "./upload-policy";

const mebibytes = (value: number) => value * 1024 * 1024;

describe("upload policy", () => {
	it("keeps the default upload limit at 7 MiB", () => {
		expect(
			validateUploadFile({ name: "stundenplan.pdf", size: mebibytes(7) }),
		).toEqual({ valid: true, message: null });
		expect(
			validateUploadFile({ name: "stundenplan.pdf", size: mebibytes(7) + 1 }),
		).toMatchObject({
			valid: false,
			message: expect.stringContaining("maximal 7 MiB"),
		});
	});

	it("accepts learning-plan documents up to 25 MiB", () => {
		expect(
			validateUploadFile(
				{
					name: "lernskript.pdf",
					size: mebibytes(25),
					type: "application/pdf",
				},
				LEARNING_PLAN_UPLOAD_LIMITS,
			),
		).toEqual({ valid: true, message: null });
		expect(
			validateUploadFile(
				{
					name: "lernskript.pdf",
					size: mebibytes(25) + 1,
					type: "application/pdf",
				},
				LEARNING_PLAN_UPLOAD_LIMITS,
			),
		).toMatchObject({
			valid: false,
			message: expect.stringContaining("maximal 25 MiB"),
		});
	});

	it("keeps Vertex image uploads at 7 MiB", () => {
		expect(
			validateUploadFile(
				{
					name: "tafelbild.jpg",
					size: mebibytes(7) + 1,
					type: "image/jpeg",
				},
				LEARNING_PLAN_UPLOAD_LIMITS,
			),
		).toMatchObject({
			valid: false,
			message: expect.stringContaining("maximal 7 MiB"),
		});
	});
});
