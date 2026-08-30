export const LEARNING_PLAN_MAX_FILE_COUNT = 10;
export const LEARNING_PLAN_MAX_FILE_BYTES = 7 * 1024 * 1024;
export const LEARNING_PLAN_MAX_TOTAL_BYTES = 35 * 1024 * 1024;

export const LEARNING_PLAN_ACCEPTED_FILE_TYPES = [
	"application/pdf",
	"application/msword",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	"application/vnd.ms-powerpoint",
	"application/vnd.openxmlformats-officedocument.presentationml.presentation",
	"text/plain",
	"text/markdown",
	"text/csv",
	"application/json",
	"image/jpeg",
	"image/png",
	"image/webp",
] as const;

const ACCEPTED_EXTENSIONS = new Set([
	"pdf",
	"ppt",
	"pptx",
	"doc",
	"docx",
	"txt",
	"md",
	"markdown",
	"csv",
	"json",
	"jpg",
	"jpeg",
	"png",
	"webp",
]);
const ACCEPTED_FILE_TYPES = new Set<string>(LEARNING_PLAN_ACCEPTED_FILE_TYPES);

const fileExtension = (fileName: string) =>
	/\.([a-z0-9]+)$/i.exec(fileName)?.[1]?.toLowerCase() ?? "";

export const isAcceptedLearningPlanFileName = (fileName: string) =>
	ACCEPTED_EXTENSIONS.has(fileExtension(fileName));

export const isAcceptedLearningPlanFileType = (
	fileName: string,
	fileType?: string,
) => {
	const normalizedType = fileType?.toLowerCase().split(";")[0]?.trim();
	return (
		isAcceptedLearningPlanFileName(fileName) &&
		(!normalizedType ||
			normalizedType === "application/octet-stream" ||
			ACCEPTED_FILE_TYPES.has(normalizedType))
	);
};

export const getLearningPlanUploadCapacity = (
	documents: Array<{ fileSizeBytes: number }>,
) => {
	const usedBytes = documents.reduce(
		(total, document) => total + Math.max(0, document.fileSizeBytes),
		0,
	);
	return {
		usedCount: documents.length,
		usedBytes,
		remainingCount: Math.max(
			0,
			LEARNING_PLAN_MAX_FILE_COUNT - documents.length,
		),
		remainingBytes: Math.max(0, LEARNING_PLAN_MAX_TOTAL_BYTES - usedBytes),
	};
};

export const validateLearningPlanUploadBatch = (
	existingDocuments: Array<{ fileSizeBytes: number }>,
	newFiles: Array<{ name: string; size: number; type?: string }>,
) => {
	for (const file of newFiles) {
		if (!isAcceptedLearningPlanFileType(file.name, file.type)) {
			return {
				valid: false,
				code: "unsupported_type" as const,
			};
		}
		if (!Number.isFinite(file.size) || file.size <= 0) {
			return { valid: false, code: "empty_file" as const };
		}
		if (file.size > LEARNING_PLAN_MAX_FILE_BYTES) {
			return { valid: false, code: "file_too_large" as const };
		}
	}

	const capacity = getLearningPlanUploadCapacity(existingDocuments);
	if (newFiles.length > capacity.remainingCount) {
		return { valid: false, code: "too_many_files" as const };
	}
	const newBytes = newFiles.reduce((total, file) => total + file.size, 0);
	if (newBytes > capacity.remainingBytes) {
		return { valid: false, code: "total_too_large" as const };
	}
	return { valid: true, code: null } as const;
};

export type LearningPlanUploadRejectionCode = Exclude<
	ReturnType<typeof validateLearningPlanUploadBatch>["code"],
	null
>;

export const getLearningPlanUploadRejectionMessage = (
	code: LearningPlanUploadRejectionCode,
) => {
	switch (code) {
		case "unsupported_type":
			return "Dieser Dateityp wird nicht unterstützt. Bitte nutze PDF, DOCX, PPTX, Text oder Bilder.";
		case "empty_file":
			return "Die Datei ist leer oder konnte nicht gelesen werden.";
		case "file_too_large":
			return "Die Datei ist zu groß (maximal 7 MiB).";
		case "too_many_files":
			return `Pro Lernplan sind höchstens ${LEARNING_PLAN_MAX_FILE_COUNT} Dateien möglich.`;
		case "total_too_large":
			return `Pro Lernplan sind insgesamt höchstens ${Math.round(LEARNING_PLAN_MAX_TOTAL_BYTES / 1024 / 1024)} MiB möglich.`;
	}
};
