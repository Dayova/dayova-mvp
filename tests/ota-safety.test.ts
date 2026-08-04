import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import {
	createReport,
	evaluateProductionOta,
	validateProductionManifest,
} from "../scripts/ota-safety.mjs";

const require = createRequire(import.meta.url);
const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const iosFingerprint = "1111111111111111111111111111111111111111";
const androidFingerprint = "2222222222222222222222222222222222222222";

const productionConfig = {
	version: "1.0.4",
	sdkVersion: "57.0.0",
	icon: "./assets/dayova-logo.png",
	ios: {
		bundleIdentifier: "de.dayova.app",
		runtimeVersion: "1.0.4",
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
	schemaVersion: 2,
	channel: "production",
	appVersion: "1.0.4",
	runtimeVersion: "1.0.4",
	sdkVersion: "57.0.0",
	platforms: {
		ios: {
			buildId: "11111111-1111-4111-8111-111111111111",
			buildVersion: "55",
			sourceSha: "908ed3d11fd1145e89a616d8bb1c7e62a33e87ab",
			fingerprint: iosFingerprint,
			appIdentifier: "de.dayova.app",
			appVersion: "1.0.4",
			runtimeVersion: "1.0.4",
			sdkVersion: "57.0.0",
			channel: "production",
			distribution: {
				status: "verified",
				audience: "TestFlight internal Team (Expo)",
				evidence: "App Store Connect build and tester installation audit",
			},
			embeddedUpdate: {
				status: "verified",
				runtimeVersion: "1.0.4",
				updateId: "33333333-3333-4333-8333-333333333333",
				evidence: "Downloaded IPA manifest inspection",
			},
		},
		android: {
			buildId: "22222222-2222-4222-8222-222222222222",
			buildVersion: "15",
			sourceSha: "f26df3faf277a8aab924961539ea8204f531d4fa",
			fingerprint: androidFingerprint,
			appIdentifier: "com.dayova",
			appVersion: "1.0.4",
			runtimeVersion: "1.0.4",
			sdkVersion: "57.0.0",
			channel: "production",
			distribution: {
				status: "verified",
				audience: "Google Play internal testing",
				evidence: "Play Console release and tester installation audit",
			},
			embeddedUpdate: {
				status: "verified",
				runtimeVersion: "1.0.4",
				updateId: "44444444-4444-4444-8444-444444444444",
				evidence: "Downloaded AAB manifest inspection",
			},
		},
	},
};

const evaluate = (overrides: Record<string, unknown> = {}) =>
	evaluateProductionOta({
		appVariant: "production",
		baseline,
		config: productionConfig,
		fingerprints: {
			ios: iosFingerprint,
			android: androidFingerprint,
		},
		sourceSha: "current-source-sha",
		...overrides,
	});

describe("production OTA safety", () => {
	it("allows a production manifest whose fingerprints match verified distributed binaries", () => {
		expect(evaluate()).toMatchObject({
			safe: true,
			failureKind: null,
			errors: [],
		});
	});

	it("keeps every 1.0.3 baseline ineligible for the SDK 57 runtime", () => {
		const legacyBaseline = {
			...baseline,
			appVersion: "1.0.3",
			runtimeVersion: "1.0.3",
			platforms: Object.fromEntries(
				Object.entries(baseline.platforms).map(([platform, entry]) => [
					platform,
					{
						...entry,
						appVersion: "1.0.3",
						runtimeVersion: "1.0.3",
						embeddedUpdate: {
							...entry.embeddedUpdate,
							runtimeVersion: "1.0.3",
						},
					},
				]),
			),
		};

		const result = evaluate({ baseline: legacyBaseline });

		expect(result).toMatchObject({
			safe: false,
			failureKind: "compatibility",
		});
		expect(result.errors).toEqual(
			expect.arrayContaining([
				"app version 1.0.4 does not match baseline app version 1.0.3",
				"ios runtime 1.0.4 does not match baseline runtime 1.0.3",
				"android runtime 1.0.4 does not match baseline runtime 1.0.3",
			]),
		);
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
			ios: "3333333333333333333333333333333333333333",
			android: "4444444444444444444444444444444444444444",
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

	it("blocks publication until the embedded update in each exact binary is verified", () => {
		const result = evaluate({
			baseline: {
				...baseline,
				platforms: {
					...baseline.platforms,
					android: {
						...baseline.platforms.android,
						embeddedUpdate: {
							...baseline.platforms.android.embeddedUpdate,
							status: "unverified",
							runtimeVersion: "1.0.4",
						},
					},
				},
			},
		});

		expect(result.safe).toBe(false);
		expect(result.reason).toContain("embedded update is not verified");
	});

	it("rejects undocumented distribution and embedded-update evidence", () => {
		const result = evaluate({
			baseline: {
				...baseline,
				platforms: {
					...baseline.platforms,
					ios: {
						...baseline.platforms.ios,
						distribution: {
							...baseline.platforms.ios.distribution,
							evidence: "",
						},
						embeddedUpdate: {
							...baseline.platforms.ios.embeddedUpdate,
							updateId: "not-an-update-id",
							evidence: "",
						},
					},
				},
			},
		});

		expect(result.errors).toEqual(
			expect.arrayContaining([
				"ios distribution evidence must be recorded",
				"ios embedded updateId must be a UUID",
				"ios embedded update evidence must be recorded",
			]),
		);
	});

	it.each([undefined, 123, "   ", "abc"])(
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
			expect(result.reason).toContain("ios baseline sourceSha must be a full Git SHA");
			expect(result.baseline).toContain("ios build 55 @ invalid");
		},
	);

	it("rejects whitespace-only distributed and generated fingerprints", () => {
		const result = evaluate({
			baseline: {
				...baseline,
				platforms: {
					...baseline.platforms,
					ios: {
						...baseline.platforms.ios,
						fingerprint: " \t ",
					},
				},
			},
			fingerprints: {
				ios: "\n",
				android: androidFingerprint,
			},
		});

		expect(result.safe).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				"ios baseline fingerprint must be a 40-character hash",
				"ios current fingerprint must be a 40-character hash",
			]),
		);
	});

	it("rejects missing distributed and generated fingerprints explicitly", () => {
		const result = evaluate({
			baseline: {
				...baseline,
				platforms: {
					...baseline.platforms,
					ios: {
						...baseline.platforms.ios,
						fingerprint: undefined,
					},
				},
			},
			fingerprints: {
				ios: undefined,
				android: androidFingerprint,
			},
		});

		expect(result.safe).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				"ios baseline fingerprint must be a 40-character hash",
				"ios current fingerprint must be a 40-character hash",
			]),
		);
	});
});

describe("production release configuration", () => {
	it("classifies missing EAS fingerprint outputs as a preflight failure", () => {
		const previousAppVariant = process.env.APP_VARIANT;
		const previousIosFingerprint = process.env.OTA_IOS_FINGERPRINT;
		const previousAndroidFingerprint = process.env.OTA_ANDROID_FINGERPRINT;

		try {
			process.env.APP_VARIANT = "production";
			delete process.env.OTA_IOS_FINGERPRINT;
			delete process.env.OTA_ANDROID_FINGERPRINT;

			expect(createReport()).toMatchObject({
				safe: false,
				failureKind: "preflight",
				reason: expect.stringContaining("OTA_IOS_FINGERPRINT is missing"),
			});
		} finally {
			if (previousAppVariant === undefined) delete process.env.APP_VARIANT;
			else process.env.APP_VARIANT = previousAppVariant;
			if (previousIosFingerprint === undefined)
				delete process.env.OTA_IOS_FINGERPRINT;
			else process.env.OTA_IOS_FINGERPRINT = previousIosFingerprint;
			if (previousAndroidFingerprint === undefined)
				delete process.env.OTA_ANDROID_FINGERPRINT;
			else process.env.OTA_ANDROID_FINGERPRINT = previousAndroidFingerprint;
		}
	});

	it("resolves the SDK 57 production binary behind runtime 1.0.4", () => {
		const expoCliPath = require.resolve("expo/bin/cli");
		const resolvedConfig = JSON.parse(
			execFileSync(
				process.execPath,
				[expoCliPath, "config", "--type", "public", "--json"],
				{
					cwd: projectRoot,
					encoding: "utf8",
					env: { ...process.env, APP_VARIANT: "production" },
				},
			),
		);
		const packageJson = JSON.parse(
			readFileSync(new URL("../package.json", import.meta.url), "utf8"),
		);

		expect(resolvedConfig).toMatchObject({
			version: "1.0.4",
			sdkVersion: "57.0.0",
			ios: {
				bundleIdentifier: "de.dayova.app",
				runtimeVersion: "1.0.4",
			},
			android: {
				package: "com.dayova",
				runtimeVersion: { policy: "appVersion" },
			},
		});
		expect(packageJson.version).toBe(resolvedConfig.version);
	});

	it("uses the EAS production fingerprint job as the gate input", () => {
		const workflow = parse(
			readFileSync(new URL("../.eas/workflows/ci.yml", import.meta.url), "utf8"),
		);
		const fingerprint = workflow.jobs.production_fingerprint;
		const mainChecks = workflow.jobs.main_checks;
		const otaGuard = mainChecks.steps.find(
			(step: { id?: string }) => step.id === "ota_guard",
		);

		expect(fingerprint).toMatchObject({
			type: "fingerprint",
			environment: "production",
		});
		expect(fingerprint.params?.unstable_skip_cng_check).not.toBe(true);
		expect(mainChecks.needs).toContain("production_fingerprint");
		expect(otaGuard.env).toEqual({
			APP_VARIANT: "production",
			OTA_ANDROID_FINGERPRINT:
				"${{ needs.production_fingerprint.outputs.android_fingerprint_hash }}",
			OTA_IOS_FINGERPRINT:
				"${{ needs.production_fingerprint.outputs.ios_fingerprint_hash }}",
		});
		const sendUpdates = workflow.jobs.send_updates;
		const finalGuard = sendUpdates.steps.find(
			(step: { name?: string }) =>
				step.name ===
				"Verify production manifest and distributed-binary compatibility",
		);

		expect(sendUpdates.needs).toContain("production_fingerprint");
		expect(finalGuard.env).toEqual(otaGuard.env);
	});

	it("requires a clean commit before EAS builds upload source", () => {
		const easConfig = JSON.parse(
			readFileSync(new URL("../eas.json", import.meta.url), "utf8"),
		);

		expect(easConfig.cli.requireCommit).toBe(true);
		expect(easConfig.build.production.env.APP_VARIANT).toBe("production");
	});
});
