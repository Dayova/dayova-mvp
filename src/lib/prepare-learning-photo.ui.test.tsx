import { expect, jest, test } from "@jest/globals";

const mockManipulate = jest.fn<
	(...args: unknown[]) => Promise<{ uri: string }>
>(async () => ({ uri: "file:///compressed.jpg" }));
let mockWidth = 6000;
let mockHeight = 4000;
jest.mock("expo-image-manipulator", () => ({
	manipulateAsync: (...args: unknown[]) => mockManipulate(...args),
	SaveFormat: { JPEG: "jpeg" },
}));
jest.mock("expo-file-system", () => ({
	File: class {
		size = 1234;
	},
}));

import { Image } from "react-native";

jest.spyOn(Image, "getSize").mockImplementation((_uri, resolve) => {
	resolve?.(mockWidth, mockHeight);
	return Promise.resolve({ width: mockWidth, height: mockHeight });
});

import { prepareLearningPhoto } from "./prepare-learning-photo";

test("resizes a large photo proportionally and records the resulting JPEG bytes", async () => {
	mockWidth = 6000;
	mockHeight = 4000;
	expect(
		await prepareLearningPhoto("file:///original.heic", "Blatt.heic"),
	).toEqual({
		uri: "file:///compressed.jpg",
		name: "Blatt.jpg",
		mimeType: "image/jpeg",
		size: 1234,
	});
	expect(mockManipulate).toHaveBeenLastCalledWith(
		"file:///original.heic",
		[{ resize: { width: 3508 } }],
		{ compress: 0.9, format: "jpeg" },
	);
});
test("preserves the dimensions of small photos rather than upscaling", async () => {
	mockWidth = 1200;
	mockHeight = 1600;
	await prepareLearningPhoto("file:///small.png", "small.png");
	expect(mockManipulate).toHaveBeenLastCalledWith("file:///small.png", [], {
		compress: 0.9,
		format: "jpeg",
	});
});
test("limits portrait photos by their height", async () => {
	mockWidth = 4000;
	mockHeight = 6000;
	await prepareLearningPhoto("file:///portrait.jpg", "portrait.jpg");
	expect(mockManipulate).toHaveBeenLastCalledWith(
		"file:///portrait.jpg",
		[{ resize: { height: 3508 } }],
		{ compress: 0.9, format: "jpeg" },
	);
});
