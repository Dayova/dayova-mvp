import type { ExpoConfig } from "expo/config";

const {
	validatePublicEnvForRelease,
}: typeof import("./src/lib/runtime-config") =
	require("./src/lib/runtime-config.ts");

const APP_VARIANT = process.env.APP_VARIANT ?? "development";
const isProduction = APP_VARIANT === "production";
const isReleaseConfig =
	process.env.EAS_BUILD === "true" || process.env.NODE_ENV === "production";

if (isReleaseConfig) {
	validatePublicEnvForRelease();
}

const APP_VERSION = "1.0.3";
const BACKGROUND_COLOR = "#ffffff";
const DAYOVA_LOGO = isProduction
	? "./assets/dayova-logo.png"
	: "./assets/dayova-logo-dev.png";
const DAYOVA_ANDROID_FOREGROUND = isProduction
	? "./assets/dayova-logo-android-foreground.png"
	: "./assets/dayova-logo-dev-android-foreground.png";
const PROJECT_ID = "d3d06b26-c8da-4192-a50d-e1bb0ca4902c";

const config: ExpoConfig = {
	name: "Dayova",
	slug: "dayova",
	scheme: "dayova",
	version: APP_VERSION,
	owner: "dayova",
	orientation: "portrait",
	platforms: ["ios", "android"],
	icon: DAYOVA_LOGO,
	userInterfaceStyle: "light",
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
		usesAppleSignIn: true,
		infoPlist: {
			ITSAppUsesNonExemptEncryption: false,
			NSCameraUsageDescription:
				"Dayova braucht Zugriff auf deine Kamera, damit du Mitschriften fotografieren kannst.",
			NSMicrophoneUsageDescription:
				"Dayova braucht Zugriff auf dein Mikrofon, damit du Sprachantworten einsprechen kannst.",
			NSPhotoLibraryUsageDescription:
				"Dayova braucht Zugriff auf deine Fotos, damit du Schulmaterial hochladen kannst.",
			NSSpeechRecognitionUsageDescription:
				"Dayova nutzt Spracherkennung, um deine eingesprochenen Antworten als Text auszuwerten.",
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
		"@clerk/expo",
		[
			"expo-notifications",
			{
				icon: "./assets/dayova-notification-icon.png",
				color: "#3A7BFF",
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
		"./plugins/withNinjaLongPaths",
		"./plugins/withAndroidPackagingOptions",
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
			},
		],
	],
	updates: {
		url: `https://u.expo.dev/${PROJECT_ID}`,
	},
};

export default config;
