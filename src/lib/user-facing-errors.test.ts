import { describe, expect, test, vi } from "vitest";
import {
	getUserFacingErrorMessage,
	USER_FACING_ERROR_KIND,
} from "./user-facing-errors";
import { setDiagnosticSink } from "./diagnostics";

describe("getUserFacingErrorMessage", () => {
	test("uses explicit user-facing Convex error data", () => {
		const error = new Error(
			"[CONVEX M(dayEntries:create)] Server Error\n  Called by client",
		);
		(error as Error & { data: unknown }).data = {
			kind: USER_FACING_ERROR_KIND,
			message:
				'Dieser Zeitraum überschneidet sich mit "Mathe Hausaufgabe" am 23. Mai 2026 von 16:00 bis 16:30.',
		};

		expect(
			getUserFacingErrorMessage(
				error,
				"Der Eintrag konnte nicht gespeichert werden.",
			),
		).toBe(
			'Dieser Zeitraum überschneidet sich mit "Mathe Hausaufgabe" am 23. Mai 2026 von 16:00 bis 16:30.',
		);
	});

	test("does not show production Convex diagnostic wrappers to learners", () => {
		const error = new Error(
			"[CONVEX A(learningPlanAi:generatePlan)] Server Error\n  Called by client",
		);

		expect(
			getUserFacingErrorMessage(
				error,
				"Der Lernplan konnte nicht erstellt werden.",
			),
		).toBe("Der Lernplan konnte nicht erstellt werden.");
	});

	test("keeps development Convex messages useful while production uses error data", () => {
		const error = new Error(
			' [CONVEX M(dayEntries:create)] [Request ID: abc] Server Error\nUncaught Error: Dieser Zeitraum überschneidet sich mit "Englisch Kurzkontrolle" am Samstag, 30. Mai von 16:00 bis 16:30.\n    at async handler (../convex/dayEntries.ts:255:3)\n\nCalled by client',
		);

		expect(getUserFacingErrorMessage(error, "Fallback")).toBe(
			'Dieser Zeitraum überschneidet sich mit "Englisch Kurzkontrolle" am Samstag, 30. Mai von 16:00 bis 16:30.',
		);
	});

	test("logs diagnostic detail without changing the learner message", () => {
		const sink = vi.fn();
		const restoreSink = setDiagnosticSink(sink);
		const error = new Error(
			"[CONVEX M(learningPlans:start)] Server Error\n  Called by client",
		);

		try {
			expect(
				getUserFacingErrorMessage(error, "Bitte versuche es erneut.", {
					source: "learning-plan-start",
					metadata: { learningPlanId: "abc" },
				}),
			).toBe("Bitte versuche es erneut.");
		} finally {
			restoreSink();
		}

		expect(sink).toHaveBeenCalledWith(
			expect.objectContaining({
				level: "error",
				message: "Handled user-visible error",
				source: "learning-plan-start",
				metadata: { learningPlanId: "abc" },
			}),
		);
	});
});
