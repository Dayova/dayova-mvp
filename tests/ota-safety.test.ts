import { describe, expect, it } from "vitest";
import {
	evaluateProductionOta,
	validateProductionManifest,
} from "../scripts/ota-safety.mjs";

const productionConfig = {
	version: "1.0.3",
	icon: "./assets/dayova-logo.png",
	ios: {
		bundleIdentifier: "de.dayova.app",
		runtimeVersion: "1.0.3",
	},
	android: {
		package: "com.dayova",
		runtimeVersion: { policy: "appVersion" },
		adaptiveIcon: {
			foregroundImage: "./assets/dayova-logo-android-foreground.png",
		},
	},
	plugins: [["expo-splash-screen", { image: "./assets/dayova-logo.png" }]],
};

const baseline = {
	schemaVersion: 1,
	channel: "production",
	runtimeVersion: "1.0.3",
	platforms: {
		ios: {
			buildId: "ios-build-id",
			buildVersion: "49",
			sourceSha: "908ed3d11fd1145e89a616d8bb1c7e62a33e87ab",
			fingerprint: "ios-distributed",
			distribution: { status: "verified" },
		},
		android: {
			buildId: "android-build-id",
			buildVersion: "11",
			sourceSha: "f26df3faf277a8aab924961539ea8204f531d4fa",
			fingerprint: "android-distributed",
			distribution: { status: "verified" },
		},
	},
};

const evaluate = (overrides: Record<string, unknown> = {}) =>
	evaluateProductionOta({
		appVariant: "production",
		baseline,
		config: productionConfig,
		fingerprints: {
			ios: "ios-distributed",
			android: "android-distributed",
		},
		sourceSha: "current-source-sha",
		...overrides,
	});

describe("production OTA safety", () => {
	it("allows a production manifest whose fingerprints match verified distributed binaries", () => {
		expect(evaluate()).toMatchObject({ safe: true, errors: [] });
	});

	it("fails before publication when APP_VARIANT is missing", () => {
		const result = evaluate({ appVariant: undefined });

		expect(result.safe).toBe(false);
		expect(result.reason).toContain("APP_VARIANT must be production");
	});

	it("rejects development identifiers and assets in a production manifest", () => {
		const config = {
			...productionConfig,
			icon: "./assets/dayova-logo-dev.png",
			ios: {
				...productionConfig.ios,
				bundleIdentifier: "de.dayova.app-dev",
			},
			android: {
				...productionConfig.android,
				package: "com.dayova.dev",
			},
		};

		expect(validateProductionManifest(config)).toEqual(
			expect.arrayContaining([
				expect.stringContaining("iOS bundle identifier"),
				expect.stringContaining("Android package"),
				expect.stringContaining("development-only value"),
			]),
		);
	});

	it("blocks an unsafe release merge and remains blocked after a formatting-only commit", () => {
		const unsafeReleaseFingerprints = {
			ios: "ios-after-native-release-change",
			android: "android-after-native-release-change",
		};

		const unsafeRelease = evaluate({
			fingerprints: unsafeReleaseFingerprints,
			sourceSha: "unsafe-release-merge",
		});
		const formattingOnlyFollowUp = evaluate({
			fingerprints: unsafeReleaseFingerprints,
			sourceSha: "formatting-only-follow-up",
		});

		expect(unsafeRelease.safe).toBe(false);
		expect(formattingOnlyFollowUp.safe).toBe(false);
		expect(formattingOnlyFollowUp.reason).toContain(
			"does not match distributed build",
		);
	});

	it("blocks an all-platform update when a platform's distribution is unverified", () => {
		const result = evaluate({
			baseline: {
				...baseline,
				platforms: {
					...baseline.platforms,
					android: {
						...baseline.platforms.android,
						distribution: { status: "unverified" },
					},
				},
			},
		});

		expect(result.safe).toBe(false);
		expect(result.reason).toContain("distribution is not verified");
	});

	it.each([undefined, 123])(
		"rejects an invalid baseline sourceSha (%s) with a clear platform error",
		(sourceSha) => {
			const result = evaluate({
				baseline: {
					...baseline,
					platforms: {
						...baseline.platforms,
						ios: {
							...baseline.platforms.ios,
							sourceSha,
						},
					},
				},
			});

			expect(result.safe).toBe(false);
			expect(result.reason).toContain(
				"ios baseline sourceSha must be a non-empty string",
			);
			expect(result.baseline).toContain("ios build 49 @ invalid");
		},
	);
});
