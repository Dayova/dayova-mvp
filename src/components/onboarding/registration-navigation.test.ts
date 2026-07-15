import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const authFlowSource = readFileSync(
	resolve(testDirectory, "../../features/auth/dayova-auth-flow.tsx"),
	"utf8",
);
const authLayoutSource = readFileSync(
	resolve(testDirectory, "../../app/(auth)/_layout.tsx"),
	"utf8",
);
const onboardingRouteSource =
	authLayoutSource.match(
		/<Stack\.Screen[\s\S]*?name="onboarding"[\s\S]*?\/>/,
	)?.[0] ?? "";
const onboardingSource = authFlowSource.slice(
	authFlowSource.indexOf("export function OnboardingScreen"),
	authFlowSource.indexOf("export function LoginScreen"),
);
const authChoiceSource = authFlowSource.slice(
	authFlowSource.indexOf("export function AuthChoiceScreen"),
	authFlowSource.indexOf("export function OnboardingScreen"),
);

describe("registration navigation", () => {
	test("pushes registration from the landing page", () => {
		expect(authChoiceSource).toContain(
			'onPress={() => router.push("/onboarding")}',
		);
		expect(authChoiceSource).not.toContain(
			'onPress={() => router.replace("/onboarding")}',
		);
	});

	test("preserves the entry route for the native iOS back gesture", () => {
		expect(onboardingRouteSource).toContain('name="onboarding"');
		expect(onboardingRouteSource).toContain("gestureEnabled: true");
		expect(onboardingRouteSource).toContain("fullScreenGestureEnabled: false");
		expect(onboardingSource).toContain(
			'const shouldHandleInternalBack = activeIndex > 0 || stage !== "flow"',
		);
		expect(onboardingSource).toContain(
			"useBackIntent(shouldHandleInternalBack, handleBack)",
		);
		expect(onboardingSource).not.toContain("useBackIntent(true, handleBack)");
	});
});
