export const MAX_LEARNING_MATERIAL_FILE_BYTES = 25 * 1024 * 1024;

export const isValidLearningMaterialSize = (size: number) =>
	Number.isSafeInteger(size) &&
	size > 0 &&
	size <= MAX_LEARNING_MATERIAL_FILE_BYTES;
