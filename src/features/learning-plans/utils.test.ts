import { describe, expect, test } from "vitest";
import { getErrorMessage } from "./utils";

describe("getErrorMessage", () => {
	test("extracts user-facing messages from Convex server errors", () => {
		const error = new Error(
			' [CONVEX M(dayEntries:create)] [Request ID: abc] Server Error\nUncaught Error: Dieser Zeitraum überschneidet sich mit "Englisch Kurzkontrolle" am Samstag, 30. Mai von 16:00 bis 16:30.\n    at async handler (../convex/dayEntries.ts:255:3)\n\nCalled by client',
		);

		expect(getErrorMessage(error, "Fallback")).toBe(
			'Dieser Zeitraum überschneidet sich mit "Englisch Kurzkontrolle" am Samstag, 30. Mai von 16:00 bis 16:30.',
		);
	});
});
