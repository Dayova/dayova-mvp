import { describe, expect, jest, test } from "@jest/globals";
import { render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { LearningPlanCardFooter } from "./learning-plan-card-footer";

jest.mock("~/components/ui/icon", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const Native =
		jest.requireActual<typeof import("react-native")>("react-native");
	return {
		ClipboardEdit: (props: Record<string, unknown>) =>
			React.createElement(Native.View, props),
	};
});

jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		colors: { secondaryText: "#697586" },
	}),
}));

describe("LearningPlanCardFooter", () => {
	test("keeps countdown text outside the notched action area", async () => {
		const screen = await render(
			<LearningPlanCardFooter
				progress={40}
				remainingDays={4}
				rollingWindowLabel="2 abgeschlossen · 2 weitere Termine geplant"
			/>,
		);

		const footerStyle = StyleSheet.flatten(
			screen.getByTestId("plan-card-footer").props.style,
		);
		const rollingLabelStyle = StyleSheet.flatten(
			screen.getByText("2 abgeschlossen · 2 weitere Termine geplant").props
				.style,
		);

		expect(footerStyle?.paddingRight ?? 0).toBeGreaterThanOrEqual(32);
		expect(rollingLabelStyle ?? {}).toMatchObject({
			flexGrow: 1,
			flexShrink: 1,
			minWidth: 0,
		});
		expect(screen.getByText("noch 4 Tage").props.numberOfLines).toBe(1);
	});
});
