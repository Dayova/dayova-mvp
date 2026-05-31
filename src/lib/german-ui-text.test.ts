import { describe, expect, test } from "vitest";
import { formatGermanUiText } from "./german-ui-text";

describe("formatGermanUiText", () => {
	test("preserves clean German umlauts before display", () => {
		expect(
			formatGermanUiText(
				"Für Schüler könnten Geräte bezüglich Prüfung und Lösungen nützlich sein.",
			),
		).toBe(
			"Für Schüler könnten Geräte bezüglich Prüfung und Lösungen nützlich sein.",
		);
	});
});
