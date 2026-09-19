import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { SubjectAddFlow, SubjectPickerContent } from "./subject-picker";
import type { SubjectSelection } from "./use-subject-options";

jest.mock("~/components/ui/dayova-sheet-frame", () => ({
	DayovaSheetInput: jest.requireActual<typeof import("~/components/ui/input")>(
		"~/components/ui/input",
	).Input,
	DayovaSheetFrame: ({
		visible,
		title,
		description,
		children,
	}: {
		visible: boolean;
		title: React.ReactNode;
		description?: React.ReactNode;
		children: React.ReactNode;
	}) => {
		const ReactNative =
			jest.requireActual<typeof import("react-native")>("react-native");
		return visible ? (
			<ReactNative.View>
				<ReactNative.Text>{title}</ReactNative.Text>
				{description ? (
					<ReactNative.Text>{description}</ReactNative.Text>
				) : null}
				{children}
			</ReactNative.View>
		) : null;
	},
}));

jest.mock("~/components/ui/button", () => ({
	Button: ({
		children,
		disabled,
		onPress,
	}: {
		children: React.ReactNode;
		disabled?: boolean;
		onPress?: () => void;
	}) => {
		const ReactNative =
			jest.requireActual<typeof import("react-native")>("react-native");
		return (
			<ReactNative.Pressable
				accessibilityRole="button"
				disabled={disabled}
				onPress={onPress}
			>
				{children}
			</ReactNative.Pressable>
		);
	},
}));

jest.mock("~/components/ui/icon", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const Icon = (props: Record<string, unknown>) =>
		React.createElement("Icon", props);
	return Object.fromEntries(
		[
			"Check",
			"Plus",
			"BookOpen",
			"Calculator",
			"Chemistry",
			"Code",
			"Dna",
			"Earth",
			"Football",
			"Language",
			"Maps",
			"Mic",
			"MusicNote",
			"PaintBrush",
			"Pencil",
			"TimeManagement",
		].map((name) => [name, Icon]),
	);
});

jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		colors: {
			primary: "#00BAFF",
			secondaryText: "#697586",
		},
	}),
}));

jest.mock("convex/react", () => ({
	useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
	useQueries: () => ({
		subjects: new Error("[CONVEX Q(personalSubjects:list)] Server Error"),
	}),
	useMutation: () => jest.fn(),
}));
jest.mock("~/lib/diagnostics", () => ({ logDiagnosticError: jest.fn() }));

const personalOption = {
	key: "personal:french",
	name: "Französisch",
	personalSubjectId: "personal-french" as never,
	kind: "personal" as const,
	Icon: () => React.createElement("Icon"),
};

describe("SubjectAddFlow", () => {
	const setup = async (
		save = jest.fn<(name: string) => Promise<SubjectSelection>>(
			async (name) => ({ name, personalSubjectId: "saved-id" as never }),
		),
	) => {
		const onSelect = jest.fn();
		const view = await render(
			<SubjectAddFlow
				options={[personalOption]}
				onCancel={jest.fn()}
				onSelect={onSelect}
				onSavePermanent={save}
			/>,
		);
		return { view, save, onSelect };
	};
	test("requires a name and directly saves a personal subject without a one-time choice", async () => {
		const { view, save, onSelect } = await setup();
		expect(
			view.getByRole("button", { name: "Fach hinzufügen" }),
		).toBeDisabled();
		await fireEvent.changeText(
			view.getByLabelText("Name des Fachs"),
			"Italienich",
		);
		await fireEvent.press(
			view.getByRole("button", { name: "Fach hinzufügen" }),
		);
		await waitFor(() =>
			expect(onSelect).toHaveBeenCalledWith({
				name: "Italienisch",
				personalSubjectId: "saved-id",
			}),
		);
		expect(save).toHaveBeenCalledWith("Italienisch");
		expect(view.queryByText("Nur diesmal verwenden")).toBeNull();
		expect(view.queryByText("Fach dauerhaft hinzufügen?")).toBeNull();
	});
	test("reuses an existing subject without creating a duplicate", async () => {
		const { view, save, onSelect } = await setup();
		await fireEvent.changeText(
			view.getByLabelText("Name des Fachs"),
			"  französisch  ",
		);
		await fireEvent.press(
			view.getByRole("button", { name: "Fach hinzufügen" }),
		);
		expect(onSelect).toHaveBeenCalledWith({
			name: "Französisch",
			personalSubjectId: "personal-french",
		});
		expect(save).not.toHaveBeenCalled();
	});
	test("keeps the entered name and allows retry after a failed save", async () => {
		const save = jest
			.fn<(name: string) => Promise<SubjectSelection>>()
			.mockRejectedValueOnce(new Error("Server Error"))
			.mockResolvedValueOnce({
				name: "Latein",
				personalSubjectId: "saved-id" as never,
			});
		const { view, onSelect } = await setup(save);
		await fireEvent.changeText(view.getByLabelText("Name des Fachs"), "Latein");
		await fireEvent.press(
			view.getByRole("button", { name: "Fach hinzufügen" }),
		);
		await waitFor(() =>
			expect(
				view.getByText(
					"Das Fach konnte nicht gespeichert werden. Bitte versuche es erneut.",
				),
			).toBeOnTheScreen(),
		);
		expect(onSelect).not.toHaveBeenCalled();
		expect(view.getByLabelText("Name des Fachs").props.value).toBe("Latein");
		await fireEvent.press(
			view.getByRole("button", { name: "Fach hinzufügen" }),
		);
		await waitFor(() =>
			expect(onSelect).toHaveBeenCalledWith({
				name: "Latein",
				personalSubjectId: "saved-id",
			}),
		);
	});
});

test("permanent subjects appear in the regular list without a separate section", async () => {
	const view = await render(
		<SubjectPickerContent
			options={[personalOption]}
			selected={{ name: "" }}
			isLoading={false}
			onSelect={jest.fn()}
			onAdd={jest.fn()}
		/>,
	);
	expect(view.getByRole("radio", { name: "Französisch" })).toBeOnTheScreen();
	expect(view.queryByText("Persönliche Fächer")).toBeNull();
});

test("a newly saved subject is selected before the catalog refresh", async () => {
	const view = await render(
		<SubjectPickerContent
			options={[]}
			selected={{
				name: "Italienisch",
				personalSubjectId: "italian-id" as never,
			}}
			isLoading={false}
			onSelect={jest.fn()}
			onAdd={jest.fn()}
		/>,
	);
	expect(view.getByRole("radio", { name: "Italienisch" })).toBeChecked();
});
