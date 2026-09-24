import { describe, expect, it } from "vitest";
import {
	createPublicEnv,
	getMissingPublicRuntimeConfig,
	readPublicRuntimeConfig,
	validatePublicEnvForRelease,
} from "./runtime-config";

describe("getMissingPublicRuntimeConfig", () => {
	it("reports required public app envs that are absent", () => {
		expect(getMissingPublicRuntimeConfig({})).toEqual([
			"EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY",
			"EXPO_PUBLIC_CONVEX_URL",
		]);
	});

	it("treats blank values as missing", () => {
		expect(
			getMissingPublicRuntimeConfig({
				EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: "   ",
				EXPO_PUBLIC_CONVEX_URL: "\t",
			}),
		).toEqual(["EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY", "EXPO_PUBLIC_CONVEX_URL"]);
	});

	it("accepts configured public app envs", () => {
		expect(
			getMissingPublicRuntimeConfig({
				EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_example",
				EXPO_PUBLIC_CONVEX_URL: "https://example.convex.cloud",
			}),
		).toEqual([]);
	});

	it("reads configured public app envs from the process environment", () => {
		const publicEnvKeys = [
			"EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY",
			"EXPO_PUBLIC_CONVEX_URL",
			"EXPO_PUBLIC_POSTHOG_API_KEY",
			"EXPO_PUBLIC_POSTHOG_HOST",
			"EXPO_PUBLIC_REVENUECAT_IOS_API_KEY",
			"EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY",
			"EXPO_PUBLIC_PRIVACY_URL",
			"EXPO_PUBLIC_TERMS_URL",
			"EXPO_PUBLIC_SUBSCRIPTION_TERMS_URL",
			"EXPO_PUBLIC_SUPPORT_URL",
		] as const;
		const originalValues = new Map(
			publicEnvKeys.map((key) => [key, process.env[key]]),
		);

		for (const key of publicEnvKeys) delete process.env[key];
		process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_process";
		process.env.EXPO_PUBLIC_CONVEX_URL = "https://process.convex.cloud";

		try {
			expect(readPublicRuntimeConfig()).toEqual({
				EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_process",
				EXPO_PUBLIC_CONVEX_URL: "https://process.convex.cloud",
				EXPO_PUBLIC_POSTHOG_API_KEY: undefined,
				EXPO_PUBLIC_POSTHOG_HOST: undefined,
				EXPO_PUBLIC_REVENUECAT_IOS_API_KEY: undefined,
				EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY: undefined,
				EXPO_PUBLIC_PRIVACY_URL: undefined,
				EXPO_PUBLIC_TERMS_URL: undefined,
				EXPO_PUBLIC_SUBSCRIPTION_TERMS_URL: undefined,
				EXPO_PUBLIC_SUPPORT_URL: undefined,
			});
		} finally {
			for (const key of publicEnvKeys) {
				const originalValue = originalValues.get(key);
				if (originalValue === undefined) {
					delete process.env[key];
				} else {
					process.env[key] = originalValue;
				}
			}
		}
	});

	it("creates typed public env values from valid config", () => {
		const env = createPublicEnv(
			{
				EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_example",
				EXPO_PUBLIC_CONVEX_URL: "https://example.convex.cloud",
			},
			{ context: "app-runtime" },
		);

		expect(env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY).toBe("pk_test_example");
		expect(env.EXPO_PUBLIC_CONVEX_URL).toBe("https://example.convex.cloud");
		expect(env.EXPO_PUBLIC_POSTHOG_API_KEY).toBeUndefined();
		expect(env.EXPO_PUBLIC_POSTHOG_HOST).toBeUndefined();
	});

	it("does not require optional PostHog analytics envs", () => {
		expect(
			getMissingPublicRuntimeConfig({
				EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_example",
				EXPO_PUBLIC_CONVEX_URL: "https://example.convex.cloud",
				EXPO_PUBLIC_POSTHOG_API_KEY: "",
				EXPO_PUBLIC_POSTHOG_HOST: "",
			}),
		).toEqual([]);
	});

	it("allows app runtime creation with missing config for the fallback screen", () => {
		const env = createPublicEnv({}, { context: "app-runtime" });

		expect(env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY).toBeUndefined();
		expect(env.EXPO_PUBLIC_CONVEX_URL).toBeUndefined();
	});

	it("rejects malformed public env values", () => {
		expect(() =>
			createPublicEnv(
				{
					EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_example",
					EXPO_PUBLIC_CONVEX_URL: "not-a-url",
				},
				{ context: "app-runtime" },
			),
		).toThrow(/EXPO_PUBLIC_CONVEX_URL/);
	});

	it("fails release validation when required config is missing", () => {
		expect(() => validatePublicEnvForRelease({})).toThrowError(
			/Missing values: EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY, EXPO_PUBLIC_CONVEX_URL/,
		);
	});

	it("requires store keys and app-specific legal URLs for releases", () => {
		expect(() =>
			validatePublicEnvForRelease({
				EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_example",
				EXPO_PUBLIC_CONVEX_URL: "https://example.convex.cloud",
			}),
		).toThrowError(
			/Missing values: EXPO_PUBLIC_REVENUECAT_IOS_API_KEY, EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY, EXPO_PUBLIC_PRIVACY_URL, EXPO_PUBLIC_TERMS_URL, EXPO_PUBLIC_SUBSCRIPTION_TERMS_URL, EXPO_PUBLIC_SUPPORT_URL/,
		);
	});

	it("requires only the current platform store key during an EAS build", () => {
		const sharedReleaseConfig = {
			EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_example",
			EXPO_PUBLIC_CONVEX_URL: "https://example.convex.cloud",
			EXPO_PUBLIC_PRIVACY_URL: "https://example.com/privacy",
			EXPO_PUBLIC_TERMS_URL: "https://example.com/terms",
			EXPO_PUBLIC_SUBSCRIPTION_TERMS_URL:
				"https://example.com/subscription-terms",
			EXPO_PUBLIC_SUPPORT_URL: "https://example.com/support",
		};

		expect(() =>
			validatePublicEnvForRelease(
				{
					...sharedReleaseConfig,
					EXPO_PUBLIC_REVENUECAT_IOS_API_KEY: "appl_test",
				},
				{ platform: "ios" },
			),
		).not.toThrow();
		expect(() =>
			validatePublicEnvForRelease(
				{
					...sharedReleaseConfig,
					EXPO_PUBLIC_REVENUECAT_IOS_API_KEY: "appl_test",
				},
				{ platform: "android" },
			),
		).toThrowError(/EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY/);
	});
});
