export const MAX_TIMETABLE_FILE_BYTES = 7 * 1024 * 1024;
export const MAX_TIMETABLE_LESSONS = 150;
export const TIMETABLE_DOWNLOAD_TIMEOUT_MS = 10_000;

export const TIMETABLE_FILE_TYPES = [
	"application/pdf",
	"image/jpeg",
	"image/png",
	"image/webp",
] as const;

export const normalizeTimetableFileType = (fileType: string) =>
	fileType.toLowerCase().split(";")[0]?.trim() ?? "";

export const isSupportedTimetableFileType = (fileType: string) =>
	TIMETABLE_FILE_TYPES.some(
		(supportedType) => supportedType === normalizeTimetableFileType(fileType),
	);

export const isValidTimetableFileSize = (fileSizeBytes: number) =>
	Number.isFinite(fileSizeBytes) &&
	fileSizeBytes > 0 &&
	fileSizeBytes <= MAX_TIMETABLE_FILE_BYTES;
