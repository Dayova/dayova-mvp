import { getLearningMaterialLimit } from "#convex/learningMaterialLimits";

const MAX_UPLOAD_FILE_BYTES = 7 * 1024 * 1024;

export const ACCEPTED_FILE_TYPES = [
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

const ACCEPTED_UPLOAD_EXTENSIONS = [
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
];

const getFileExtension = (fileName: string) => {
	const match = /\.([a-z0-9]+)$/i.exec(fileName);
	return match?.[1]?.toLowerCase() ?? "";
};

export const formatFileSize = (sizeBytes: number) => {
	if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
		return "0 B";
	}

	if (sizeBytes < 1000) {
		return `${Math.round(sizeBytes)} B`;
	}

	if (sizeBytes < 1024 * 1024) {
		const value = sizeBytes / 1000;
		return `${value >= 10 ? value.toFixed(1) : value.toFixed(2)} kB`;
	}

	const value = sizeBytes / (1024 * 1024);
	return `${value >= 10 ? value.toFixed(1) : value.toFixed(2)} MiB`;
};

export const validateUploadFile = (
	file: {
		name: string;
		size?: number | null;
		type?: string | null;
	},
	scope?: "learningMaterial",
) => {
	const extension = getFileExtension(file.name);
	if (!ACCEPTED_UPLOAD_EXTENSIONS.includes(extension)) {
		return {
			valid: false,
			message:
				"Dieser Dateityp wird nicht unterstützt. Bitte nutze PDF, DOCX, PPTX, Text oder Bilder.",
		};
	}

	if (!Number.isFinite(file.size) || (file.size ?? 0) <= 0) {
		return {
			valid: false,
			message: "Die Datei ist leer oder konnte nicht gelesen werden.",
		};
	}

	const maxBytes =
		scope === "learningMaterial"
			? getLearningMaterialLimit(file.name, file.type)
			: MAX_UPLOAD_FILE_BYTES;
	if ((file.size ?? 0) > maxBytes) {
		return {
			valid: false,
			message: `Die Datei ist mit ${formatFileSize(file.size ?? 0)} zu groß (maximal ${maxBytes / 1024 / 1024} MiB).`,
		};
	}

	return { valid: true, message: null } as const;
};
