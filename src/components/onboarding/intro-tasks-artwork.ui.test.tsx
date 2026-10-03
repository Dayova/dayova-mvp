import { describe, expect, jest, test } from "@jest/globals";
import { render } from "@testing-library/react-native";
import { IntroTasksArtwork } from "./intro-tasks-artwork";

jest.mock("~/features/dashboard/dashboard-product-cards", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const { Text, View } =
		jest.requireActual<typeof import("react-native")>("react-native");
	const productCard = (label: string) =>
		function MockProductCard({ testID }: { testID?: string }) {
			return React.createElement(
				View,
				{ testID },
				React.createElement(Text, null, label),
			);
		};

	return {
		DashboardAgendaEntryCard: productCard("Geteilte Agenda"),
		DashboardNextStepCard: productCard("Geteilter nächster Lernschritt"),
		DashboardWeeklyProgressCard: productCard("Geteilter Wochenfortschritt"),
	};
});

describe("IntroTasksArtwork", () => {
	test("uses shared dashboard modules as decorative artwork", async () => {
		const screen = await render(<IntroTasksArtwork />);
		const hidden = { includeHiddenElements: true };
		const artwork = screen.getByTestId("intro-tasks-artwork", hidden);

		expect(artwork.props.accessibilityElementsHidden).toBe(true);
		expect(artwork.props.importantForAccessibility).toBe("no-hide-descendants");

		expect(
			screen.getByTestId("intro-task-progress-card", hidden),
		).toBeOnTheScreen();
		expect(
			screen.getByTestId("intro-task-next-step-card", hidden),
		).toBeOnTheScreen();

		expect(
			screen.getByText("Geteilter Wochenfortschritt", hidden),
		).toBeOnTheScreen();
		expect(
			screen.getByText("Geteilter nächster Lernschritt", hidden),
		).toBeOnTheScreen();
		expect(screen.queryByRole("button", hidden)).toBeNull();
	});

	test("uses the numeric artwork dimensions supplied by the onboarding layout", async () => {
		const screen = await render(<IntroTasksArtwork width={294} height={200} />);
		const artwork = screen.getByTestId("intro-tasks-artwork", {
			includeHiddenElements: true,
		});

		expect(artwork.props.style).toEqual({ width: 294, height: 200 });
	});
});
