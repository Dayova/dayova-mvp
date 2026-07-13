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
		expect(shortFactStepSource).toContain(
			"<Bulb size={32} color={COLORS.wrong} strokeWidth={1.5} />",
		);
		expect(shortFactStepSource).toMatch(
			/<Text className="mt-2 [^"]*text-body-4 text-wrong">/,
		);
		expect(shortFactStepSource).not.toMatch(
			/<Text className="mt-2 [^"]*font-(?:bold|semibold)[^"]*">/,
		);
		expect(hangingPanelSource).toContain("<Sparkles");
		expect(hangingPanelSource).toContain('className="mt-56 w-full"');
		expect(hangingPanelSource).toContain(
			'className="w-full -rotate-2 rounded-card bg-surface px-6 py-5"',
		);
		expect(hangingPanelSource).not.toMatch(/shadow(?:-|\b)/);
		expect(shortFactStepSource).not.toContain("AuthProgressHeader");
		expect(shortFactStepSource).not.toContain("progress:");
		expect(shortFactStepSource).not.toContain("onBack:");
		expect(shortFactStepSource).not.toContain(
			"paddingBottom: Math.max(bottomInset + 112, 122)",
		);
		expect(shortFactStepSource).toContain("alwaysBounceVertical={false}");
	});
});
