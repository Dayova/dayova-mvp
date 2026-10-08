import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render } from "@testing-library/react-native";
import { ROUTES, withReturnTo } from "~/lib/routes";
import { CreateEntryButton } from "./create-entry-button";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
	useRouter: () => ({ push: mockPush }),
}));

jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({ colors: { text: "#101828" } }),
}));

jest.mock("~/components/ui/icon", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	return {
		Plus: (props: Record<string, unknown>) =>
			React.createElement("Icon", props),
	};
});

jest.mock("~/components/create-type-picker-modal", () => ({
	CreateTypePickerModal: ({
		visible,
		onSelect,
		onRequestClose,
	}: {
		visible: boolean;
		onSelect: (type: "homework" | "exam") => void;
		onRequestClose: () => void;
	}) => {
		const React = jest.requireActual<typeof import("react")>("react");
		const { Text, TouchableOpacity } =
			jest.requireActual<typeof import("react-native")>("react-native");
		return visible
			? React.createElement(
					React.Fragment,
					null,
					React.createElement(TouchableOpacity, {
						accessibilityRole: "button",
						accessibilityLabel: "Auswahl schließen",
						onPress: onRequestClose,
					}),
					React.createElement(
						TouchableOpacity,
						{
							accessibilityRole: "button",
							accessibilityLabel: "Prüfung auswählen",
							onPress: () => onSelect("exam"),
						},
						React.createElement(Text, null, "Prüfung"),
					),
					React.createElement(
						TouchableOpacity,
						{
							accessibilityRole: "button",
							accessibilityLabel: "Hausaufgabe auswählen",
							onPress: () => onSelect("homework"),
						},
						React.createElement(Text, null, "Hausaufgabe"),
					),
				)
			: null;
	},
}));

describe("CreateEntryButton", () => {
	beforeEach(() => {
		mockPush.mockClear();
	});

	test("closes the picker without creating an entry", async () => {
		const screen = await render(<CreateEntryButton returnTo={ROUTES.home} />);
		await act(() =>
			fireEvent.press(
				screen.getByRole("button", { name: "Eintrag hinzufügen" }),
			),
		);
		await act(() =>
			fireEvent.press(
				screen.getByRole("button", { name: "Auswahl schließen" }),
			),
		);
		expect(
			screen.queryByRole("button", { name: "Prüfung auswählen" }),
		).toBeNull();
		expect(mockPush).not.toHaveBeenCalled();
	});

	test("opens the picker before navigating to homework creation", async () => {
		const screen = await render(<CreateEntryButton returnTo={ROUTES.home} />);

		await act(() =>
			fireEvent.press(
				screen.getByRole("button", { name: "Eintrag hinzufügen" }),
			),
		);
		expect(
			screen.queryByRole("button", { name: "Prüfung auswählen" }),
		).not.toBeNull();
		expect(
			screen.queryByRole("button", { name: "Hausaufgabe auswählen" }),
		).not.toBeNull();
		expect(mockPush).not.toHaveBeenCalled();
		await act(() =>
			fireEvent.press(
				screen.getByRole("button", { name: "Hausaufgabe auswählen" }),
			),
		);
		expect(
			screen.queryByRole("button", { name: "Hausaufgabe auswählen" }),
		).toBeNull();
		expect(mockPush).toHaveBeenCalledTimes(1);

		expect(mockPush).toHaveBeenCalledWith(
			withReturnTo(ROUTES.createHomework, ROUTES.home),
		);
	});

	test("preserves the return destination for learning-plan creation", async () => {
		const screen = await render(
			<CreateEntryButton returnTo={ROUTES.learningPlans} />,
		);

		await act(() =>
			fireEvent.press(
				screen.getByRole("button", { name: "Eintrag hinzufügen" }),
			),
		);

		await act(() =>
			fireEvent.press(
				screen.getByRole("button", { name: "Prüfung auswählen" }),
			),
		);
		expect(mockPush).toHaveBeenCalledWith(
			withReturnTo(ROUTES.createExam, ROUTES.learningPlans),
		);
	});
});
