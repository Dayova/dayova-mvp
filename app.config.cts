import type { ExpoConfig } from "expo/config";

const {
	validatePublicEnvForRelease,
}: typeof import("./src/lib/runtime-config") =
	require("./src/lib/runtime-config.ts");

const APP_VARIANT = process.env.APP_VARIANT;

if (!APP_VARIANT) {
	throw new Error(
		"APP_VARIANT is required when resolving the Expo app config. Set it to development, preview, or production.",
	);
}

if (!["development", "preview", "production"].includes(APP_VARIANT)) {
	throw new Error(
		`Unsupported APP_VARIANT "${APP_VARIANT}". Expected development, preview, or production.`,
	);
}

const isProduction = APP_VARIANT === "production";
const isInternalValidation = process.env.DAYOVA_INTERNAL_VALIDATION === "true";
const isValidationTestFlight =
	isInternalValidation &&
	process.env.DAYOVA_VALIDATION_DISTRIBUTION === "testflight";
if (isInternalValidation && isProduction) {
	throw new Error("Internal validation cannot use the production app variant.");
}
if (
	isInternalValidation &&
	(!process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_") ||
		Boolean(process.env.EXPO_PUBLIC_POSTHOG_API_KEY?.trim()) ||
		(isValidationTestFlight
			? !process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.startsWith("appl_")
			: !process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY?.startsWith(
					"test_",
				)) ||
		process.env.EXPO_PUBLIC_CONVEX_URL !==
			"https://kindred-canary-599.eu-west-1.convex.cloud")
) {
	throw new Error(
		"Internal validation requires the reviewed development backend, Clerk test instance and distribution-appropriate RevenueCat public SDK key.",
	);
}
const isReleaseConfig =
	process.env.EAS_BUILD === "true" || process.env.NODE_ENV === "production";
const releasePlatform =
	process.env.EAS_BUILD_PLATFORM === "android" ||
	process.env.EAS_BUILD_PLATFORM === "ios"
		? process.env.EAS_BUILD_PLATFORM
		: undefined;

if (isReleaseConfig) {
	validatePublicEnvForRelease(undefined, { platform: releasePlatform });
}

const APP_VERSION = "1.0.6";
const BACKGROUND_COLOR = "#ffffff";
// Keep this native launch color aligned with DARK_THEME_VARIABLES["--background"].
// theme-css.test.ts prevents the values from drifting.
const DARK_BACKGROUND_COLOR = "#131216";
// Keep this native-build token aligned with DAYOVA_DESIGN_SYSTEM.colors.primary.
// android-material-controls.test.ts prevents the two values from drifting.
const DAYOVA_PRIMARY = "#00BAFF";
const DAYOVA_LOGO = isProduction
	? "./assets/dayova-logo.png"
	: "./assets/dayova-logo-dev.png";
const DAYOVA_ANDROID_FOREGROUND = isProduction
	? "./assets/dayova-logo-android-foreground.png"
	: "./assets/dayova-logo-dev-android-foreground.png";
const PROJECT_ID = "d3d06b26-c8da-4192-a50d-e1bb0ca4902c";
const IOS_PRIVACY_PURPOSE_STRINGS = {
	NSCameraUsageDescription:
		"Dayova braucht Zugriff auf deine Kamera, damit du Mitschriften fotografieren kannst.",
	NSPhotoLibraryUsageDescription:
		"Dayova braucht Zugriff auf deine Fotos, damit du Schulmaterial hochladen kannst.",
} as const;

const config: ExpoConfig = {
	name: "Dayova",
	slug: "dayova",
	scheme: "dayova",
	version: APP_VERSION,
	primaryColor: DAYOVA_PRIMARY,
	owner: "dayova",
	orientation: "portrait",
	platforms: ["ios", "android"],
	icon: DAYOVA_LOGO,
	userInterfaceStyle: "automatic",
	experiments: {
		reactCompiler: true,
	},
	extra: {
		eas: {
			projectId: PROJECT_ID,
		},
	},
	ios: {
		supportsTablet: true,
		bundleIdentifier: isProduction ? "de.dayova.app" : "de.dayova.app-dev",
		runtimeVersion: APP_VERSION,
		infoPlist: {
			ITSAppUsesNonExemptEncryption: false,
			...IOS_PRIVACY_PURPOSE_STRINGS,
		},
	},
	android: {
		adaptiveIcon: {
			foregroundImage: DAYOVA_ANDROID_FOREGROUND,
			backgroundColor: BACKGROUND_COLOR,
		},
		predictiveBackGestureEnabled: true,
		package: isProduction ? "com.dayova" : "com.dayova.dev",
		runtimeVersion: {
			policy: "appVersion",
		},
	},
	plugins: [
		"expo-router",
		"expo-status-bar",
		[
			"@clerk/expo",
			{
				// Dayova uses its own email/password authentication flow. Clerk's
				// default would otherwise add an unused Sign in with Apple entitlement.
				appleSignIn: false,
			},
		],
		[
			"expo-notifications",
			{
				icon: "./assets/dayova-notification-icon.png",
				color: DAYOVA_PRIMARY,
			},
		],
		[
			"expo-image-picker",
			{
				cameraPermission:
					"Dayova braucht Zugriff auf deine Kamera, damit du Mitschriften fotografieren kannst.",
				microphonePermission: false,
				photosPermission:
					"Dayova braucht Zugriff auf deine Fotos, damit du Schulmaterial hochladen kannst.",
			},
		],
		"./plugins/withRemovedVoicePermissions",
		"expo-localization",
		"./plugins/withIosInAppPurchase",
		"./plugins/withNinjaLongPaths",
		"./plugins/withAndroidGradleDaemonJvm",
		"./plugins/withAndroidGradleJvmMemory",
		"./plugins/withAndroidPackagingOptions",
		"./plugins/withDayovaAndroidTheme",
		[
			"expo-font",
			{
				fonts: [
					"./assets/fonts/Poppins-Regular.ttf",
					"./assets/fonts/Poppins-Medium.ttf",
					"./assets/fonts/Poppins-SemiBold.ttf",
					"./assets/fonts/Poppins-Bold.ttf",
				],
				android: {
					fonts: [
						{
							fontFamily: "Poppins",
							fontDefinitions: [
								{
									path: "./assets/fonts/Poppins-Regular.ttf",
									weight: 400,
								},
								{
									path: "./assets/fonts/Poppins-Medium.ttf",
									weight: 500,
								},
								{
									path: "./assets/fonts/Poppins-SemiBold.ttf",
									weight: 600,
								},
								{
									path: "./assets/fonts/Poppins-Bold.ttf",
									weight: 700,
								},
							],
						},
					],
				},
			},
		],
		"expo-secure-store",
		[
			"expo-splash-screen",
			{
				image: DAYOVA_LOGO,
				resizeMode: "contain",
				backgroundColor: BACKGROUND_COLOR,
				dark: {
					image: DAYOVA_LOGO,
					backgroundColor: DARK_BACKGROUND_COLOR,
				},
			},
		],
	],
	updates: {
		url: `https://u.expo.dev/${PROJECT_ID}`,
	},
};

if (isInternalValidation) {
	config.name = "Dayova Test";
	config.scheme = "dayova-validation";
	config.android = { ...config.android, package: "com.dayova.validation" };
	if (isValidationTestFlight) {
		// TestFlight signs the existing App Store app; only this explicit profile
		// uses its identifier with the isolated validation backend and pinned JS.
		config.ios = { ...config.ios, bundleIdentifier: "de.dayova.app" };
		// Match the current TestFlight train without changing regular releases.
		config.version = "1.0.7";
		config.ios.runtimeVersion = config.version;
	}
	config.extra = { ...config.extra, internalHintValidation: true };
	// Pin the embedded revision. No unrelated channel may change a study session.
	config.updates = { ...config.updates, enabled: false };
	config.plugins = [
		...(config.plugins ?? []),
		"./plugins/withInternalValidation",
	];
}

module.exports = config;
