import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { ExamDateSelector, SingleSelectOption } from "./exam-flow";

jest.mock("react-native-reanimated", () =>
	jest.requireActual("../../../tests/mocks/selection-reanimated.cjs"),
);

jest.mock("~/components/ui/icon", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const { View } =
		jest.requireActual<typeof import("react-native")>("react-native");
	const Icon = (props: Record<string, unknown>) =>
		React.createElement("Icon", props);

	return {
		CalendarDays: Icon,
		Check: (props: Record<string, unknown>) => (
			<View testID="exam-selection-check" {...props} />
		),
		ChevronDown: Icon,
		Computer: Icon,
		GraduationCap: Icon,
		Mic: Icon,
		NotebookPen: Icon,
		Pencil: Icon,
		Plus: Icon,
	};
});

jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		colors: { primary: "#00BAFF", secondaryText: "#697586" },
	}),
}));

test("uses a white check for a selected exam type", async () => {
	const screen = await render(
		<SingleSelectOption
			Icon={() => <></>}
			label="Test"
			selected
			onPress={jest.fn()}
		/>,
	);
	expect(
		screen.getByTestId("exam-selection-check", {
			includeHiddenElements: true,
		}).props.color,
	).toBe("#FFFFFF");
});

describe("ExamDateSelector", () => {
	test("presents the selected date as an accessible calendar trigger", async () => {
		const onOpen = jest.fn();
		const screen = await render(
			<ExamDateSelector selectedDate={new Date(2026, 7, 14)} onOpen={onOpen} />,
		);

		const trigger = screen.getByRole("button", {
			name: "Prüfungsdatum ändern",
		});
		expect(trigger.props.accessibilityRole).toBe("button");
		expect(trigger.props.accessibilityValue).toEqual({
			text: "14. August 2026",
		});
		expect(screen.getByText("Im Kalender auswählen")).toBeOnTheScreen();

		fireEvent.press(trigger);

		expect(onOpen).toHaveBeenCalledTimes(1);
	});
});
