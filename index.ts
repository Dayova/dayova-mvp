import "./src/lib/patchClerkNativeEventEmitter";
// Opt-in, in-memory decision demo. Normal app startup stays unchanged.
if (__DEV__ && process.env.EXPO_PUBLIC_TODAY_DEMO === "1") {
	require("./src/features/dashboard/today-prototype-entry");
} else {
	require("expo-router/entry");
}
