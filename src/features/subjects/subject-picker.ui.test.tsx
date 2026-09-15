import { describe, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { SubjectAddFlow } from "./subject-picker";
import type { SubjectSelection } from "./use-subject-options";

jest.mock("~/components/ui/dayova-sheet-frame", () => ({
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
	return { Check: Icon, Plus: Icon };
});

jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		colors: {
			primary: "#00BAFF",
			secondaryText: "#697586",
		},
	}),
}));

const personalOption = {
	key: "personal:french",
	name: "Französisch",
	personalSubjectId: "personal-french" as never,
	kind: "personal" as const,
	Icon: () => React.createElement("Icon"),
};

describe("SubjectAddFlow", () => {
	test("reuses an existing subject despite casing and whitespace", async () => {
		const onSelect = jest.fn();
		const onSavePermanent =
			jest.fn<(name: string) => Promise<SubjectSelection>>();
		const screen = await render(
			<SubjectAddFlow
				options={[personalOption]}
				onCancel={jest.fn()}
				onSelect={onSelect}
				onSavePermanent={onSavePermanent}
			/>,
		);

		await act(() =>
			fireEvent.changeText(
				screen.getByLabelText("Name des Fachs"),
				"  französisch  ",
			),
		);
		await act(() =>
			fireEvent.press(screen.getByRole("button", { name: "Weiter" })),
		);

		expect(onSelect).toHaveBeenCalledWith({
			name: "Französisch",
			personalSubjectId: "personal-french",
		});
		expect(onSavePermanent).not.toHaveBeenCalled();
	});

	test("offers permanent and one-time use for a new subject", async () => {
		const onSelect = jest.fn();
		const savedSelection = {
			name: "Latein",
			personalSubjectId: "personal-latin" as never,
		};
		const onSavePermanent = jest.fn<
			(name: string) => Promise<SubjectSelection>
		>(async () => savedSelection);
		const screen = await render(
			<SubjectAddFlow
				options={[]}
				onCancel={jest.fn()}
				onSelect={onSelect}
				onSavePermanent={onSavePermanent}
			/>,
		);

		await act(() =>
			fireEvent.changeText(screen.getByLabelText("Name des Fachs"), "Latein"),
		);
		await act(() =>
			fireEvent.press(screen.getByRole("button", { name: "Weiter" })),
		);
		expect(screen.getByText("Fach dauerhaft hinzufügen?")).toBeOnTheScreen();
		expect(
			screen.getByRole("button", { name: "Nur diesmal verwenden" }),
		).toBeOnTheScreen();

		await act(async () => {
			fireEvent.press(
				screen.getByRole("button", { name: "Dauerhaft hinzufügen" }),
			);
		});
		await waitFor(() => expect(onSavePermanent).toHaveBeenCalledWith("Latein"));
		expect(onSelect).toHaveBeenCalledWith(savedSelection);
	});

	test("uses a new subject once without persisting it", async () => {
		const onSelect = jest.fn();
		const onSavePermanent =
			jest.fn<(name: string) => Promise<SubjectSelection>>();
		const screen = await render(
			<SubjectAddFlow
				options={[]}
				onCancel={jest.fn()}
				onSelect={onSelect}
				onSavePermanent={onSavePermanent}
			/>,
		);

		await act(() =>
			fireEvent.changeText(screen.getByLabelText("Name des Fachs"), "Spanisch"),
		);
		await act(() =>
			fireEvent.press(screen.getByRole("button", { name: "Weiter" })),
		);
		await act(() =>
			fireEvent.press(
				screen.getByRole("button", { name: "Nur diesmal verwenden" }),
			),
		);

		expect(onSelect).toHaveBeenCalledWith({
			name: "Spanisch",
			isOneTime: true,
		});
		expect(onSavePermanent).not.toHaveBeenCalled();
	});
});
