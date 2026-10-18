import { expect, it } from "vitest";
import { readExpoConfigSnapshot } from "./helpers/expo-config-contract";

it.each([
	["development", "de.dayova.app-dev"],
	["production", "de.dayova.app"],
] as const)("resolves the %s iOS identity and password-only privacy contract", (variant, bundleIdentifier) => {
	const config = readExpoConfigSnapshot(variant, "introspect");
	expect(config.ios?.bundleIdentifier).toBe(bundleIdentifier);
	expect(config.ios?.usesAppleSignIn).toBeUndefined();
	expect(config.ios?.entitlements ?? {}).not.toHaveProperty(
		"com.apple.developer.applesignin",
	);
	for (const key of [
		"NSCameraUsageDescription",
		"NSPhotoLibraryUsageDescription",
	]) {
		expect(config.ios?.infoPlist?.[key]).toMatch(/\S/);
	}
	expect(config.ios?.infoPlist).not.toHaveProperty(
		"NSMicrophoneUsageDescription",
	);
	expect(config.ios?.infoPlist).not.toHaveProperty(
		"NSSpeechRecognitionUsageDescription",
	);
	expect(config.userInterfaceStyle).toBe("automatic");
});
