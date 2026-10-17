import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { describe, expect, test } from "vitest";

const require = createRequire(import.meta.url);
const { addValidationBuildType, disableValidationDeveloperSupport } = require("../plugins/withInternalValidation.js");

describe("standalone Test Store validation build", () => {
	test("isolates the internal app and rejects production credentials/configuration", () => {
		const load = (variant: string, internal: boolean, clerkKey = "pk_test_fixture", distribution = "internal") => spawnSync(process.execPath, ["--experimental-strip-types", "--eval", "console.log(JSON.stringify(require('./app.config.cts')))"], {
			encoding: "utf8",
			env: { ...process.env, APP_VARIANT: variant, DAYOVA_INTERNAL_VALIDATION: String(internal), DAYOVA_VALIDATION_DISTRIBUTION: distribution, EAS_BUILD: "false", NODE_ENV: "development", EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkKey, EXPO_PUBLIC_CONVEX_URL: "https://kindred-canary-599.eu-west-1.convex.cloud", EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY: "test_fixture", EXPO_PUBLIC_REVENUECAT_IOS_API_KEY: "appl_fixture", EXPO_PUBLIC_POSTHOG_API_KEY: "" },
		});
		const standard = load("production", false);
		expect(standard.status, standard.stderr).toBe(0);
		expect(JSON.parse(standard.stdout).android.package).toBe("com.dayova");
		expect(JSON.parse(standard.stdout).extra.internalHintValidation).toBeUndefined();
		const internal = load("preview", true);
		expect(internal.status, internal.stderr).toBe(0);
		const config = JSON.parse(internal.stdout);
		expect(config.android.package).toBe("com.dayova.validation");
		expect(config.scheme).toBe("dayova-validation");
		expect(config.updates.enabled).toBe(false);
		expect(config.plugins).toContain("./plugins/withInternalValidation");
		const flight = load("preview", true, "pk_test_fixture", "testflight");
		expect(flight.status, flight.stderr).toBe(0);
		const flightConfig = JSON.parse(flight.stdout);
		expect(flightConfig.ios.bundleIdentifier).toBe("de.dayova.app");
		expect(flightConfig.version).toBe("1.0.7");
		expect(flightConfig.extra.internalHintValidation).toBe(true);
		expect(flightConfig.updates.enabled).toBe(false);
		expect(load("production", true).status).not.toBe(0);
		expect(load("preview", true, "pk_live_fixture").status).not.toBe(0);
	});
	test("keeps a separate debuggable build type which still bundles JS", () => {
		const input = "react { debuggableVariants = ['debug', 'debugOptimized'] }\nandroid { buildTypes { release {} } }";
		const result = addValidationBuildType(input);
		expect(result).toContain("initWith release");
		expect(result).toContain("debuggable true");
		expect(result).toContain("signingConfig signingConfigs.debug");
		expect(result).not.toContain("debuggableVariants = ['debug', 'debugOptimized', 'validation']");
		expect(addValidationBuildType(result)).toBe(result);
	});
	test("disables Metro developer support only for validation while preserving ordinary debug builds", () => {
		const input = "ExpoReactHostFactory.getDefaultReactHost(\n      context = applicationContext,\n      packageList = PackageList(this).packages\n    )";
		const result = disableValidationDeveloperSupport(input);
		expect(result).toContain('useDevSupport = BuildConfig.DEBUG && BuildConfig.BUILD_TYPE != "validation",');
		expect(result).toContain("packageList = PackageList(this).packages");
		expect(disableValidationDeveloperSupport(result)).toBe(result);
		expect(() => disableValidationDeveloperSupport("changed upstream template")).toThrow("reviewed Kotlin");
	});
});
