import { File, FileMode } from "expo-file-system";
import type { ImagePickerAsset } from "expo-image-picker";
import { validateUploadFile } from "~/lib/upload-policy";
import type { UploadAsset } from "./types";

const UNSUPPORTED_IMAGE_MESSAGE =
	"Dieser Bildtyp wird nicht unterstützt. Bitte nutze JPEG, PNG oder WebP.";

const imageExtensions = {
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/webp": "webp",
} as const;

function getImageMimeType(header: Uint8Array) {
	if (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
		return "image/jpeg";
	}
	if (
		[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
			(byte, index) => header[index] === byte,
		)
	) {
		return "image/png";
	}
	if (
		[0x52, 0x49, 0x46, 0x46].every((byte, index) => header[index] === byte) &&
		[0x57, 0x45, 0x42, 0x50].every((byte, index) => header[index + 8] === byte)
	) {
		return "image/webp";
	}
	throw new Error(UNSUPPORTED_IMAGE_MESSAGE);
}

export function prepareGalleryUploadAsset(
	asset: Pick<ImagePickerAsset, "uri" | "fileName">,
	fallbackName: string,
): UploadAsset {
	// The picker may transcode images while retaining their original metadata.
	const file = new File(asset.uri);
	const size = file.info().size ?? 0;
	const validation = validateUploadFile({ name: "galerie.jpg", size });
	if (!validation.valid) throw new Error(validation.message);

	const handle = file.open(FileMode.ReadOnly);
	let mimeType: keyof typeof imageExtensions;
	try {
		mimeType = getImageMimeType(handle.readBytes(12));
	} finally {
		handle.close();
	}
	const stem = asset.fileName?.trim().replace(/\.[^.]*$/, "") || fallbackName;

	return {
		uri: asset.uri,
		name: `${stem}.${imageExtensions[mimeType]}`,
		mimeType,
		size,
	};
}
