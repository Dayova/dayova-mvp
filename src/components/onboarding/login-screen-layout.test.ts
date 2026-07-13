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
	test("keeps the Figma remember-me row and registration prompt in the form flow", () => {
		expect(loginScreenSource).toContain("Angemeldet bleiben");
		expect(loginScreenSource).toContain("Du hast keinen Account?");
		expect(loginScreenSource).toContain("Jetzt Registrieren");
		expect(loginScreenSource).not.toContain('<View style={{ flex: 1 }} />');
		expect(loginScreenSource).toContain('className="mt-12 items-center"');
		expect(formPillSource).toContain("h-14");
	});
});
