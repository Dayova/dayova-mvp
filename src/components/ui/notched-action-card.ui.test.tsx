import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { View } from "react-native";
import { NotchedActionCard } from "./notched-action-card";

jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		colors: {
			border: "#DCE6EE",
			surface: "#FFFFFF",
		},
	}),
}));

describe("NotchedActionCard", () => {
	test("renders shared artwork without creating a dead press target", async () => {
		const screen = await render(
			<NotchedActionCard
				actionIcon={<View />}
				pressType="none"
				testID="artwork-card"
			>
				<View />
			</NotchedActionCard>,
		);

		const artwork = screen.getByTestId("artwork-card", {
			includeHiddenElements: true,
		});
		expect(artwork.props).toMatchObject({
			accessible: false,
			accessibilityElementsHidden: true,
			importantForAccessibility: "no-hide-descendants",
			pointerEvents: "none",
		});
		expect(screen.queryByRole("button")).toBeNull();
	});
});
test("dispatches its accessible action without waiting for animation", async () => {
	const onPress = jest.fn();
	const screen = await render(
		<NotchedActionCard
			actionAccessibilityLabel="Öffnen"
			actionIcon={<View />}
			onPress={onPress}
			pressType="action"
		>
			<View />
		</NotchedActionCard>,
	);
	await fireEvent.press(screen.getByRole("button", { name: "Öffnen" }));
	expect(onPress).toHaveBeenCalledTimes(1);
});
