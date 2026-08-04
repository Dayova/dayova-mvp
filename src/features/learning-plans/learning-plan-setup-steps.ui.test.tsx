import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import type { Id } from "#convex/_generated/dataModel";
import {
	MaterialUploadStep,
	TeacherGuidanceStep,
} from "./learning-plan-setup-steps";

jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		colors: {
			primary: "#00A0E6",
			primaryStrong: "#00A0E6",
			secondaryText: "#697586",
			text: "#111111",
		},
	}),
}));

describe("learning-plan setup steps", () => {
	test("keeps the empty school-material page focused on one upload action", async () => {
		const onOpenUpload = jest.fn();
		const screen = await render(
			<MaterialUploadStep
				canUpload
				canContinue={false}
				documents={[]}
				errorMessage={null}
				isBusy={false}
				isUploading={false}
				onContinue={jest.fn()}
				onOpenUpload={onOpenUpload}
				onRemoveDocument={jest.fn()}
				onSkip={jest.fn()}
				openingUploadAction={null}
			/>,
		);

		expect(
			screen.getByRole("button", {
				name: "Schulmaterial hinzufügen",
			}),
		).toBeEnabled();
		expect(
			screen.getByText("Ohne Material wird nur deine Prüfung gespeichert."),
		).toBeOnTheScreen();
		expect(
			screen.queryByRole("button", {
				name: "Zusätzliche Lernhilfe hinzufügen",
			}),
		).toBeNull();
		expect(screen.queryByRole("button", { name: "Weiter" })).toBeNull();
		expect(
			screen.getByRole("button", {
				name: "Ohne Lernplan abschließen",
			}),
		).toBeOnTheScreen();

		fireEvent.press(
			screen.getByRole("button", { name: "Schulmaterial hinzufügen" }),
		);
		expect(onOpenUpload).toHaveBeenCalledWith("school");
	});

	test("reveals continue after school material is uploaded", async () => {
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
				isUploading={false}
				onContinue={jest.fn()}
				onOpenUpload={jest.fn()}
				onRemoveDocument={jest.fn()}
				onSkip={jest.fn()}
				openingUploadAction={null}
			/>,
		);

		expect(
			screen.getByRole("button", {
				name: "Weiteres Schulmaterial hinzufügen",
			}),
		).toBeEnabled();
		expect(screen.getByRole("button", { name: "Weiter" })).toBeEnabled();
		expect(
			screen.queryByRole("button", {
				name: "Zusätzliche Lernhilfe hinzufügen",
			}),
		).toBeNull();
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
				isUploading={false}
				onContinue={jest.fn()}
				onOpenUpload={jest.fn()}
				onRemoveDocument={jest.fn()}
				onSkip={jest.fn()}
				openingUploadAction={null}
			/>,
		);

		expect(screen.queryByRole("button", { name: "Weiter" })).toBeNull();
		expect(screen.queryByText("Lernhilfe.pdf")).toBeNull();
		expect(
			screen.getByRole("button", { name: "Ohne Lernplan abschließen" }),
		).toBeOnTheScreen();
	});

	test("requires material when a materialless draft is resumed", async () => {
		const screen = await render(
			<MaterialUploadStep
				canUpload
				canContinue={false}
				documents={[]}
				errorMessage={null}
				isBusy={false}
				isUploading={false}
				onContinue={jest.fn()}
				onOpenUpload={jest.fn()}
				onRemoveDocument={jest.fn()}
				onSkip={jest.fn()}
				openingUploadAction={null}
				showSkip={false}
			/>,
		);

		expect(
			screen.getByText(
				"Deine Unterlagen bilden die Grundlage für deinen Lernplan.",
			),
		).toBeOnTheScreen();
		expect(
			screen.queryByRole("button", { name: "Ohne Lernplan abschließen" }),
		).toBeNull();
	});

	test("keeps optional context on the second page without forcing the keyboard open", async () => {
		const onOpenUpload = jest.fn();
		const screen = await render(
			<TeacherGuidanceStep
				canUpload
				canContinue={false}
				documents={[]}
				errorMessage={null}
				isBusy={false}
				isUploading={false}
				onChangeTeacherGuidance={jest.fn()}
				onContinue={jest.fn()}
				onOpenUpload={onOpenUpload}
				onRemoveDocument={jest.fn()}
				openingUploadAction={null}
				teacherGuidance=""
			/>,
		);

		expect(screen.getByText("Prüfung ergänzen")).toBeOnTheScreen();
		expect(
			screen.getByLabelText("Hinweis der Lehrkraft").props.autoFocus,
		).not.toBe(true);
		expect(
			screen.getByRole("button", {
				name: "Zusätzliche Lernhilfe hinzufügen",
			}),
		).toBeEnabled();
		expect(
			screen.getByRole("button", { name: "Prüfungsstoff analysieren" }),
		).toBeDisabled();

		fireEvent.press(
			screen.getByRole("button", {
				name: "Zusätzliche Lernhilfe hinzufügen",
			}),
		);
		expect(onOpenUpload).toHaveBeenCalledTimes(1);
	});

	test("shows uploaded external aids only on the optional-context page", async () => {
		const screen = await render(
			<TeacherGuidanceStep
				canUpload
				canContinue
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
				isUploading={false}
				onChangeTeacherGuidance={jest.fn()}
				onContinue={jest.fn()}
				onOpenUpload={jest.fn()}
				onRemoveDocument={jest.fn()}
				openingUploadAction={null}
				teacherGuidance=""
			/>,
		);

		expect(screen.getByText("Lernhilfe.pdf")).toBeOnTheScreen();
		expect(
			screen.getByRole("button", { name: "Prüfungsstoff analysieren" }),
		).toBeEnabled();
	});
});
