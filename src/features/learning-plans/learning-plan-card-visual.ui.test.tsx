import { describe, expect, jest, test } from "@jest/globals";
import { render } from "@testing-library/react-native";
import { LearningPlanCardVisual } from "./learning-plan-card-visual";

let mockShouldStackInlineContent = false;

jest.mock("~/components/ui/portrait-content", () => ({
	useContentSizeLayout: () => ({
		shouldStackInlineContent: mockShouldStackInlineContent,
	}),
}));

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

	test("reflows meaningful screen copy instead of truncating it at large text sizes", async () => {
		mockShouldStackInlineContent = true;
		const currentTitle =
			"Lineare Funktionen mit besonders ausführlicher Aufgabenbeschreibung verstehen";
		const screen = await render(
			<LearningPlanCardVisual
				accessibilityHint="Öffnet den Lernplan"
				accessibilityLabel="Mathematik Lernplan"
				model={{
					subject: "Mathematik Leistungskurs mit langem Namen",
					status: {
						label: "Bereit zum Lernen",
						background: "#E8F7FF",
						foreground: "#008ACB",
					},
					examDateLabel: "Klassenarbeit · 24. August",
					currentTitle,
					state: {
						kind: "ready",
						durationMinutes: 30,
						progress: 20,
						remainingDays: 4,
						rollingWindowLabel: "Diese Woche",
					},
				}}
				onPress={() => undefined}
			/>,
		);

		expect(screen.getByTestId("learning-plan-card-heading-row")).toHaveProp(
			"className",
			expect.stringContaining("flex-col"),
		);
		expect(screen.getByText(currentTitle).props.numberOfLines).toBeUndefined();
	});

	test("keeps the bounded decorative artwork composition", async () => {
		mockShouldStackInlineContent = true;
		const currentTitle = "Lineare Funktionen verstehen";
		const screen = await render(
			<LearningPlanCardVisual
				mode="artwork"
				model={{
					subject: "Mathematik",
					status: {
						label: "In Erstellung",
						background: "#E8F7FF",
						foreground: "#008ACB",
					},
					examDateLabel: "Klassenarbeit · 24. August",
					currentTitle,
					state: { kind: "creation", progressLabel: "Inhalt wird erstellt" },
				}}
			/>,
		);

		expect(
			screen.getByTestId("learning-plan-card-heading-row", {
				includeHiddenElements: true,
			}),
		).toHaveProp("className", expect.stringContaining("flex-row"));
		expect(
			screen.getByText(currentTitle, { includeHiddenElements: true }),
		).toHaveProp("numberOfLines", 2);
	});
});
