import { describe, expect, jest, test } from "@jest/globals";
import { render } from "@testing-library/react-native";
import {
	MaterialUploadStep,
	TeacherGuidanceStep,
} from "./learning-plan-setup-steps";

jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		colors: {
			primary: "#00A0E6",
			text: "#111111",
		},
	}),
}));

describe("learning-plan setup steps", () => {
	test("separates school evidence from optional external support", async () => {
		const screen = await render(
			<MaterialUploadStep
				canContinue
				documents={[]}
				errorMessage={null}
				isBusy={false}
				onContinue={jest.fn()}
				onOpenUpload={jest.fn()}
				onRemoveDocument={jest.fn()}
				openingUploadAction={null}
			/>,
		);

		expect(
			screen.getByRole("button", {
				name: "Material von deiner Schule hinzufügen",
			}),
		).toBeOnTheScreen();
		expect(
			screen.getByRole("button", {
				name: "Zusätzliche Lernhilfe hinzufügen",
			}),
		).toBeOnTheScreen();
	});

	test("renders the teacher evidence prompt without forcing the keyboard open", async () => {
		const screen = await render(
			<TeacherGuidanceStep
				canContinue={false}
				errorMessage={null}
				hasSchoolMaterial={false}
				isBusy={false}
				onChangeTeacherGuidance={jest.fn()}
				onContinue={jest.fn()}
				onOpenLearningTimes={jest.fn()}
				showLearningTimesWarning={false}
				teacherGuidance=""
			/>,
		);

		expect(
			screen.getByText("Was hat deine Lehrkraft zur Arbeit gesagt?"),
		).toBeOnTheScreen();
		expect(
			screen.getByLabelText("Hinweis der Lehrkraft").props.autoFocus,
		).not.toBe(true);
	});
});
