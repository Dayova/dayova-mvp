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
		const originalClerkKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
		const originalConvexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;
		const originalPostHogApiKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
		const originalPostHogHost = process.env.EXPO_PUBLIC_POSTHOG_HOST;

		process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_process";
		process.env.EXPO_PUBLIC_CONVEX_URL = "https://process.convex.cloud";
		delete process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
		delete process.env.EXPO_PUBLIC_POSTHOG_HOST;

		try {
			expect(readPublicRuntimeConfig()).toEqual({
				EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_process",
				EXPO_PUBLIC_CONVEX_URL: "https://process.convex.cloud",
				EXPO_PUBLIC_POSTHOG_API_KEY: undefined,
				EXPO_PUBLIC_POSTHOG_HOST: undefined,
			});
		} finally {
			if (originalClerkKey === undefined) {
				delete process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
			} else {
				process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = originalClerkKey;
			}
			if (originalConvexUrl === undefined) {
				delete process.env.EXPO_PUBLIC_CONVEX_URL;
			} else {
				process.env.EXPO_PUBLIC_CONVEX_URL = originalConvexUrl;
			}
			if (originalPostHogApiKey === undefined) {
				delete process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
			} else {
				process.env.EXPO_PUBLIC_POSTHOG_API_KEY = originalPostHogApiKey;
			}
			if (originalPostHogHost === undefined) {
				delete process.env.EXPO_PUBLIC_POSTHOG_HOST;
			} else {
				process.env.EXPO_PUBLIC_POSTHOG_HOST = originalPostHogHost;
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
});
