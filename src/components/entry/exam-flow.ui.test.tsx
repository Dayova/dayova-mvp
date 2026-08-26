import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { ExamDateSelector } from "./exam-flow";

jest.mock("react-native-reanimated", () => {
	const ReactNative =
		jest.requireActual<typeof import("react-native")>("react-native");
	const animationBuilder = {
		duration: () => animationBuilder,
	};

	return {
		__esModule: true,
		default: { View: ReactNative.View },
		FadeInDown: animationBuilder,
		LinearTransition: animationBuilder,
	};
});

jest.mock("~/components/ui/icon", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const Icon = (props: Record<string, unknown>) =>
		React.createElement("Icon", props);

	return {
		CalendarDays: Icon,
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
