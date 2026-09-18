const DEFAULT_MAX_UPLOAD_FILE_BYTES = 7 * 1024 * 1024;

export const LEARNING_PLAN_UPLOAD_LIMITS = {
	maxFileBytes: 25 * 1024 * 1024,
	maxImageBytes: 7 * 1024 * 1024,
} as const;

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

const isImageUpload = (file: { name: string; type?: string | null }) => {
	const normalizedType = file.type?.toLowerCase().split(";")[0]?.trim();
	return (
		normalizedType?.startsWith("image/") === true ||
		["jpg", "jpeg", "png", "webp"].includes(getFileExtension(file.name))
	);
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

const formatFileSizeLimit = (sizeBytes: number) =>
	sizeBytes % (1024 * 1024) === 0
		? `${sizeBytes / 1024 / 1024} MiB`
		: formatFileSize(sizeBytes);

export const validateUploadFile = (
	file: {
		name: string;
		size?: number | null;
		type?: string | null;
	},
	limits?: {
		maxFileBytes: number;
		maxImageBytes?: number;
	},
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

	const maxFileBytes =
		isImageUpload(file) && limits?.maxImageBytes
			? limits.maxImageBytes
			: (limits?.maxFileBytes ?? DEFAULT_MAX_UPLOAD_FILE_BYTES);
	if ((file.size ?? 0) > maxFileBytes) {
		return {
			valid: false,
			message: `Die Datei ist mit ${formatFileSize(file.size ?? 0)} zu groß (maximal ${formatFileSizeLimit(maxFileBytes)}).`,
		};
	}

	return { valid: true, message: null } as const;
};
