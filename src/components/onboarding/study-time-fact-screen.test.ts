import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const authFlowSource = readFileSync(
	resolve(testDirectory, "../../features/auth/dayova-auth-flow.tsx"),
	"utf8",
);
const shortFactStepSource = authFlowSource.slice(
	authFlowSource.indexOf("function ShortStudyTimeFactStep"),
	authFlowSource.indexOf("export function LoginScreen"),
);
const hangingPanelSource = authFlowSource.slice(
	authFlowSource.indexOf("function HangingStudyTimeFactPanel"),
	authFlowSource.indexOf("function PlanFitStack"),
);

describe("study-time fact screen", () => {
	test("uses the selected study time instead of hard-coded 30-minute copy", () => {
		expect(shortFactStepSource).toContain("getStudyTimeFactBody(studyTime)");
		expect(authFlowSource).not.toContain('body: "Deine 30 Minuten reichen aus');
	});

	test("keeps the defining Figma callout and hanging-card treatment", () => {
		expect(shortFactStepSource).toContain("Schon gewusst?");
		expect(shortFactStepSource).toContain("<Bulb");
		expect(hangingPanelSource).toContain("<Sparkles");
		expect(hangingPanelSource).toContain("-rotate-[2deg]");
		expect(shortFactStepSource).toContain("AuthProgressHeader");
	});
});
