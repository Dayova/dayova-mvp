import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { ExamDateSelector, ExamTypePicker } from "./exam-flow";

jest.mock("~/components/ui/dayova-sheet-frame", () => ({
	DayovaSheetFrame: ({
		visible,
		children,
		onClose,
	}: {
		visible: boolean;
		children: ReactNode;
		onClose: () => void;
	}) => {
		const RN =
			jest.requireActual<typeof import("react-native")>("react-native");
		return visible ? (
			<RN.View>
				<RN.Pressable
					accessibilityRole="button"
					accessibilityLabel="Dialog schließen"
					onPress={onClose}
				/>
				{children}
			</RN.View>
		) : null;
	},
}));

jest.mock("~/components/ui/button", () => ({
	Button: ({
		children,
		disabled,
		onPress,
	}: {
		children: ReactNode;
		disabled?: boolean;
		onPress: () => void;
	}) => {
		const RN =
			jest.requireActual<typeof import("react-native")>("react-native");
		return (
			<RN.Pressable
				accessibilityRole="button"
				disabled={disabled}
				onPress={onPress}
			>
				{children}
			</RN.Pressable>
		);
	},
}));

describe("ExamTypePicker custom entry", () => {
	test("opens an add dialog without clearing the previous selection and cancels safely", async () => {
		const onSelect = jest.fn();
		const screen = await render(
			<ExamTypePicker selectedValue="Test" onSelect={onSelect} />,
		);
		await fireEvent.press(
			screen.getByRole("button", { name: "Prüfungsart hinzufügen" }),
		);
		expect(screen.getByLabelText("Name der Prüfungsart")).toBeOnTheScreen();
		await fireEvent.changeText(
			screen.getByLabelText("Name der Prüfungsart"),
			"Vokabeltest",
		);
		await fireEvent.press(screen.getByRole("button", { name: "Abbrechen" }));
		expect(onSelect).not.toHaveBeenCalled();
		expect(screen.queryByLabelText("Name der Prüfungsart")).toBeNull();
	});

	test("rejects whitespace and commits a normalized value only on confirmation", async () => {
		const onSelect = jest.fn();
		const screen = await render(
			<ExamTypePicker selectedValue="Test" onSelect={onSelect} />,
		);
		await fireEvent.press(
			screen.getByRole("button", { name: "Prüfungsart hinzufügen" }),
		);
		const input = screen.getByLabelText("Name der Prüfungsart");
		await fireEvent.changeText(input, "   ");
		await fireEvent(input, "submitEditing");
		expect(onSelect).not.toHaveBeenCalled();
		await fireEvent.changeText(input, "  Vokabel  test  ");
		await fireEvent(input, "submitEditing");
		expect(onSelect).toHaveBeenCalledWith("Vokabel test");
		expect(screen.queryByLabelText("Name der Prüfungsart")).toBeNull();
	});

	test("prefills a resumed custom value and preserves it when dismissed", async () => {
		const onSelect = jest.fn();
		const screen = await render(
			<ExamTypePicker selectedValue="Vokabeltest" onSelect={onSelect} />,
		);
		await fireEvent.press(
			screen.getByRole("button", { name: "Prüfungsart hinzufügen" }),
		);
		expect(screen.getByLabelText("Name der Prüfungsart").props.value).toBe(
			"Vokabeltest",
		);
		await fireEvent.press(
			screen.getByRole("button", { name: "Dialog schließen" }),
		);
		expect(onSelect).not.toHaveBeenCalled();
	});
});

jest.mock("react-native-reanimated", () =>
	jest.requireActual("../../../tests/mocks/selection-reanimated.cjs"),
);

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

jest.mock("~/features/subjects/subject-picker", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const InlineSubjectPicker = (props: Record<string, unknown>) =>
		React.createElement("InlineSubjectPicker", props);

	return { InlineSubjectPicker };
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
