import { describe, expect, jest, test } from "@jest/globals";
import { render } from "@testing-library/react-native";
import { Text } from "react-native";
import { DashboardHighlightCarousel } from "./dashboard-highlight-carousel";

let mockWindowWidth = 393;

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
	__esModule: true,
	default: () => ({
		width: mockWindowWidth,
		height: 852,
		scale: 3,
		fontScale: 1,
	}),
}));

describe("DashboardHighlightCarousel", () => {
	test("shows large cards and snaps one card at a time", async () => {
		const screen = await render(
			<DashboardHighlightCarousel>
				<Text>Erste Karte</Text>
				<Text>Zweite Karte</Text>
			</DashboardHighlightCarousel>,
		);
		const carousel = screen.getByTestId("dashboard-highlight-carousel");

		expect(carousel.props.horizontal).toBe(true);
		expect(carousel.props.decelerationRate).toBe("fast");
		expect(carousel.props.disableIntervalMomentum).toBe(true);
		expect(carousel.props.snapToAlignment).toBe("start");
		expect(carousel.props.snapToInterval).toBe(333);
		expect(screen.getByTestId("dashboard-highlight-card-0")).toHaveStyle({
			width: 321,
		});
		expect(screen.getByTestId("dashboard-highlight-card-1")).toHaveStyle({
			width: 321,
		});
	});

	test("centers both bounded cards in an iPad viewport", async () => {
		mockWindowWidth = 1024;
		const screen = await render(
			<DashboardHighlightCarousel>
				<Text>Erste Karte</Text>
				<Text>Zweite Karte</Text>
			</DashboardHighlightCarousel>,
		);
		const carousel = screen.getByTestId("dashboard-highlight-carousel");

		expect(carousel.props.snapToInterval).toBe(432);
		expect(carousel.props.contentContainerStyle.paddingHorizontal).toBe(86);
		expect(screen.getByTestId("dashboard-highlight-card-0")).toHaveStyle({
			width: 420,
		});
		expect(screen.getByTestId("dashboard-highlight-card-1")).toHaveStyle({
			width: 420,
		});

		mockWindowWidth = 393;
	});
});
