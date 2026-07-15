import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const authFlowSource = readFileSync(
	resolve(testDirectory, "../../features/auth/dayova-auth-flow.tsx"),
	"utf8",
);
const loginScreenSource = authFlowSource.slice(
	authFlowSource.indexOf("export function LoginScreen"),
	authFlowSource.indexOf("function VerificationScreen"),
);
const formPillSource = authFlowSource.slice(
	authFlowSource.indexOf("function FormPill"),
	authFlowSource.indexOf("function SmallArrowButton"),
);

describe("login screen layout", () => {
	test("keeps the focused login field above the keyboard on every platform", () => {
		expect(loginScreenSource).toContain("<KeyboardSafeScrollView");
		expect(loginScreenSource).not.toContain("<KeyboardAvoidingView");
		expect(loginScreenSource).not.toContain("<ScrollView");
		expect(loginScreenSource).toContain(
			'contentInsetAdjustmentBehavior="never"',
		);
		expect(loginScreenSource).toContain("alwaysBounceVertical={false}");
		expect(loginScreenSource).toContain("isCompactHeight");
		expect(loginScreenSource).not.toContain(
			'contentInsetAdjustmentBehavior="automatic"',
		);
	});

	test("keeps the Figma remember-me row and registration prompt in the form flow", () => {
		expect(loginScreenSource).toContain("Angemeldet bleiben");
		expect(loginScreenSource).toContain(
			"const [rememberSession, setRememberSession] = useState(true)",
		);
		expect(loginScreenSource).toContain('accessibilityRole="checkbox"');
		expect(loginScreenSource).toContain("checked: rememberSession");
		expect(loginScreenSource).toContain("disabled={isSubmittingLogin}");
		expect(loginScreenSource).toContain("onPress={toggleRememberSession}");
		expect(loginScreenSource).toContain("Du hast keinen Account?");
		expect(loginScreenSource).toContain("Jetzt Registrieren");
		expect(loginScreenSource).toContain(
			'onPress={() => router.push("/onboarding")}',
		);
		expect(loginScreenSource).not.toContain(
			'onPress={() => router.replace("/onboarding")}',
		);
		expect(loginScreenSource).not.toContain("<View style={{ flex: 1 }} />");
		expect(loginScreenSource).toContain('isCompactHeight ? "mt-10" : "mt-12"');
		expect(formPillSource).toContain("h-14");
	});
});
