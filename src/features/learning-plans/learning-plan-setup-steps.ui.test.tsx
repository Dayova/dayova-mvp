import { describe, expect, jest, test } from "@jest/globals";
import { render } from "@testing-library/react-native";
import type { Id } from "#convex/_generated/dataModel";
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
				canUpload
				canContinue={false}
				documents={[]}
				errorMessage={null}
				isBusy={false}
				onContinue={jest.fn()}
				onOpenUpload={jest.fn()}
				onRemoveDocument={jest.fn()}
				onSkip={jest.fn()}
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
		).toBeDisabled();
		expect(screen.getByText("Ohne Material kein Lernplan")).toBeOnTheScreen();
		expect(
			screen.getByRole("button", {
				name: "Ohne Lernplan abschließen",
			}),
		).toBeOnTheScreen();
	});

	test("unlocks plan creation and external aids after school material is uploaded", async () => {
		const screen = await render(
			<MaterialUploadStep
				canUpload
				canContinue
				documents={[
					{
						id: "document" as Id<"learningPlanDocuments">,
						fileName: "Arbeitsblatt.pdf",
						fileType: "application/pdf",
						fileSizeBytes: 1_024,
						sourceKind: "school",
					},
				]}
				errorMessage={null}
				isBusy={false}
				onContinue={jest.fn()}
				onOpenUpload={jest.fn()}
				onRemoveDocument={jest.fn()}
				onSkip={jest.fn()}
				openingUploadAction={null}
			/>,
		);

		expect(
			screen.getByRole("button", {
				name: "Zusätzliche Lernhilfe hinzufügen",
			}),
		).toBeEnabled();
		expect(
			screen.getByRole("button", { name: "Mit Material weiter" }),
		).toBeEnabled();
		expect(
			screen.queryByRole("button", {
				name: "Ohne Lernplan abschließen",
			}),
		).toBeNull();
	});

	test("still offers the no-plan path when only an external aid remains", async () => {
		const screen = await render(
			<MaterialUploadStep
				canUpload
				canContinue={false}
				documents={[
					{
						id: "external-document" as Id<"learningPlanDocuments">,
						fileName: "Lernhilfe.pdf",
						fileType: "application/pdf",
						fileSizeBytes: 1_024,
						sourceKind: "external",
					},
				]}
				errorMessage={null}
				isBusy={false}
				onContinue={jest.fn()}
				onOpenUpload={jest.fn()}
				onRemoveDocument={jest.fn()}
				onSkip={jest.fn()}
				openingUploadAction={null}
			/>,
		);

		expect(
			screen.getByRole("button", { name: "Mit Material weiter" }),
		).toBeDisabled();
		expect(
			screen.getByRole("button", { name: "Ohne Lernplan abschließen" }),
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
