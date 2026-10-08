import { afterEach, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import * as ReactNative from "react-native";
import { LearningPlanEditor } from "./learning-plan-editor";

afterEach(() => jest.restoreAllMocks());

test("keeps both editor actions operable at large system text size", async () => {
	jest.spyOn(ReactNative, "useWindowDimensions").mockReturnValue({
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
			canEditTopics
			isLoading={false}
			isMissing={false}
			isBusy={false}
			canSave
			errorMessage={null}
			onCancel={cancel}
			onSave={save}
		>
			<ReactNative.Text>Schulmaterial</ReactNative.Text>
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
