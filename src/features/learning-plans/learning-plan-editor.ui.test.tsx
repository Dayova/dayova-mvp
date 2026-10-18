import { afterEach, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { Text } from "react-native";
import { LearningPlanEditor } from "./learning-plan-editor";

jest.mock("react-native-safe-area-context", () => ({
	useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("~/components/ui/screen", () => ({
	ScreenScroll:
		jest.requireActual<typeof import("react-native")>("react-native")
			.ScrollView,
}));
afterEach(() => {
	jest.restoreAllMocks();
});

test("keeps both editor actions operable at large system text size", async () => {
	jest
		.spyOn(
			jest.requireActual<typeof import("react-native")>("react-native"),
			"useWindowDimensions",
		)
		.mockReturnValue({
			width: 390,
			height: 844,
			scale: 3,
			fontScale: 3,
		});
	const save = jest.fn();
	const cancel = jest.fn();
	const screen = await render(
		<LearningPlanEditor
			topics="Brüche"
			onChangeTopics={jest.fn()}
			canEditTopics={false}
			isLoading={false}
			isMissing={false}
			isBusy={false}
			canSave
			errorMessage={null}
			onCancel={cancel}
			onSave={save}
		>
			<Text>Schulmaterial</Text>
		</LearningPlanEditor>,
	);
	const actions = screen.getByTestId("learning-plan-editor-actions");
	expect(actions.props.className).not.toContain("flex-row");
	for (const label of ["Speichern", "Abbrechen"]) {
		const text = screen.getByText(label);
		expect(text.props.adjustsFontSizeToFit).not.toBe(true);
		expect(text.props.numberOfLines).toBeUndefined();
		await fireEvent.press(screen.getByRole("button", { name: label }));
	}
	expect(save).toHaveBeenCalledTimes(1);
	expect(cancel).toHaveBeenCalledTimes(1);
});
