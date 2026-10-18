export const MAX_LEARNING_MATERIAL_FILE_BYTES = 10 * 1024 * 1024;

export const getLearningMaterialFileLimit = (
	fileName: string,
	fileType = "",
) => {
	// Vertex accepts at most 7 MB (decimal) per inline image, unlike PDFs.
	// https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/3-flash
	const isImage =
		fileType.trim().toLowerCase().startsWith("image/") ||
		/\.(jpe?g|png|webp|heic|heif)$/i.test(fileName);
	return isImage
		? { bytes: 7_000_000, label: "7 MB" }
		: { bytes: MAX_LEARNING_MATERIAL_FILE_BYTES, label: "10 MiB" };
};

export const isValidLearningMaterialSize = (
	size: number,
	fileName = "",
	fileType = "",
) =>
	Number.isSafeInteger(size) &&
	size > 0 &&
	size <= getLearningMaterialFileLimit(fileName, fileType).bytes;
