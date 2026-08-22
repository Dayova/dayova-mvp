import { describe, expect, jest, test } from "@jest/globals";
import { render } from "@testing-library/react-native";
import { LearningPlanCardVisual } from "./learning-plan-card-visual";

jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		colors: {
			border: "#DCE6EE",
			secondaryText: "#697586",
			surface: "#FFFFFF",
		},
	}),
}));

describe("LearningPlanCardVisual", () => {
	test("lets screen-mode status badges grow with scaled text", async () => {
		const screen = await render(
			<LearningPlanCardVisual
				accessibilityHint="Öffnet den Lernplan"
				accessibilityLabel="Mathematik Lernplan"
				model={{
					subject: "Mathematik",
					status: {
						label: "In Erstellung",
						background: "#E8F7FF",
						foreground: "#008ACB",
					},
					examDateLabel: "Klassenarbeit · 24. August",
					currentTitle: "Lineare Funktionen verstehen",
					state: { kind: "creation", progressLabel: "Inhalt wird erstellt" },
				}}
				onPress={() => undefined}
			/>,
		);

		const badge = screen.getByText("In Erstellung").parent;
		const badgeClasses = badge?.props.className.split(" ");
		expect(badgeClasses).toContain("min-h-7");
		expect(badgeClasses).toContain("py-1");
		expect(badgeClasses).not.toContain("h-7");
	});
});
