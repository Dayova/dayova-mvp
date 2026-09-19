import { File } from "expo-file-system";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { Image } from "react-native";

// Keep an A4 page near 300 dpi while avoiding full-resolution phone originals.
export const LEARNING_PHOTO_MAX_EDGE = 3508;
export const LEARNING_PHOTO_JPEG_QUALITY = 0.9;

export async function prepareLearningPhoto(uri: string, name: string) {
	const dimensions = await new Promise<{ width: number; height: number }>(
		(resolve, reject) => {
			Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
		},
	);
	const longestEdge = Math.max(dimensions.width, dimensions.height);
	const actions =
		longestEdge > LEARNING_PHOTO_MAX_EDGE
			? [
					{
						resize:
							dimensions.width >= dimensions.height
								? { width: LEARNING_PHOTO_MAX_EDGE }
								: { height: LEARNING_PHOTO_MAX_EDGE },
					},
				]
			: [];
	const result = await manipulateAsync(uri, actions, {
		compress: LEARNING_PHOTO_JPEG_QUALITY,
		format: SaveFormat.JPEG,
	});
	return {
		uri: result.uri,
		name: `${name.replace(/\.[^.]+$/, "")}.jpg`,
		mimeType: "image/jpeg",
		size: new File(result.uri).size,
	};
}
