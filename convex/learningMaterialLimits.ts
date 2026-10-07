/** Shared by native validation and server processing; limits are per file. */
export const LEARNING_MATERIAL_LIMITS = {
	pdf: 40 * 1024 * 1024,
	document: 25 * 1024 * 1024,
	image: 7 * 1024 * 1024,
} as const;

export function getLearningMaterialLimit(name: string, type?: string | null) {
	const mime = type?.toLowerCase().split(";")[0]?.trim();
	const extension = name.trim().toLowerCase().split(".").at(-1);
	// A conflicting image MIME/extension must never get the larger PDF limit.
	if (
		mime?.startsWith("image/") ||
		["jpg", "jpeg", "png", "webp"].includes(extension ?? "")
	) {
		return LEARNING_MATERIAL_LIMITS.image;
	}
	if (mime === "application/pdf" || extension === "pdf")
		return LEARNING_MATERIAL_LIMITS.pdf;
	return LEARNING_MATERIAL_LIMITS.document;
}

// Leave headroom for PDF parsing and inline base64/JSON request serialization.
export const MAX_LEARNING_MATERIAL_TOTAL_BYTES = 40 * 1024 * 1024;
export const MATERIAL_TOTAL_LIMIT_MESSAGE =
	"Deine Unterlagen dürfen zusammen maximal 40 MiB groß sein. Entferne nicht benötigte Dateien oder verkleinere die PDFs.";
