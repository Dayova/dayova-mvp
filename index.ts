import "./src/lib/patchClerkNativeEventEmitter";

// A standalone, local-only component harness; never changes app authentication.
if (__DEV__ && process.env.EXPO_PUBLIC_PODCAST_PREVIEW === "1") {
	const { registerRootComponent } = require("expo");
	const {
		PodcastPreview,
	} = require("./src/features/learning-plans/podcast-preview");
	registerRootComponent(PodcastPreview);
} else {
	require("expo-router/entry");
}
