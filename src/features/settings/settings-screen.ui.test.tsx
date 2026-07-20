import type { ReactNode } from "react";
import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import SettingsScreen from "../../app/(app)/settings";

const mockReplace = jest.fn();
const mockLogout = jest.fn<() => Promise<void>>(async () => undefined);

jest.mock("expo-router", () => ({
	useRouter: () => ({ push: jest.fn(), replace: mockReplace }),
}));

jest.mock("~/context/AuthContext", () => ({
	useAccountActions: () => ({ logout: mockLogout }),
}));

jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		colors: { secondaryText: "#667085", text: "#101828" },
		preference: "system",
		setPreference: jest.fn(async () => undefined),
	}),
}));

jest.mock("~/components/ui/icon", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const Icon = (props: Record<string, unknown>) =>
		React.createElement("Icon", props);
	return new Proxy(
		{ __esModule: true },
		{
			get: (target, property) =>
				property in target ? target[property as keyof typeof target] : Icon,
		},
	);
});

jest.mock("~/components/ui/screen", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const Native =
		jest.requireActual<typeof import("react-native")>("react-native");
	return {
		Screen: ({ children }: { children: ReactNode }) =>
			React.createElement(Native.View, null, children),
		ScreenScroll: ({ children }: { children: ReactNode }) =>
			React.createElement(Native.View, null, children),
	};
});

jest.mock("~/components/ui/themed-status-bar", () => ({
	ThemedStatusBar: () => null,
}));

jest.mock("~/components/ui/list-row", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const Native =
		jest.requireActual<typeof import("react-native")>("react-native");
	return {
		ListRow: ({
			accessibilityState,
			disabled,
			label,
			onPress,
		}: {
			accessibilityState?: { busy?: boolean; disabled?: boolean };
			disabled?: boolean;
			label: string;
			onPress?: () => void;
		}) =>
			React.createElement(
				Native.Pressable,
				{
					accessibilityLabel: label,
					accessibilityRole: onPress ? "button" : "text",
					accessibilityState,
					disabled,
					onPress,
				},
				React.createElement(Native.Text, null, label),
			),
	};
});

describe("SettingsScreen logout", () => {
	beforeEach(() => {
		mockLogout.mockReset();
		mockLogout.mockResolvedValue(undefined);
		mockReplace.mockReset();
	});

	test("owns one logout transaction and leaves session routing to the root guard", async () => {
		let resolveLogout: () => void = () => undefined;
		mockLogout.mockImplementationOnce(
			() =>
				new Promise<void>((resolve) => {
					resolveLogout = resolve;
				}),
		);
		const screen = await render(<SettingsScreen />);
		const logoutButton = screen.getByRole("button", { name: "Abmelden" });

		await fireEvent.press(logoutButton);
		await fireEvent.press(logoutButton);

		expect(mockLogout).toHaveBeenCalledTimes(1);
		expect(logoutButton.props.accessibilityState).toEqual({
			busy: true,
			disabled: true,
		});
		expect(mockReplace).not.toHaveBeenCalled();

		await act(async () => resolveLogout());
	});

	test("announces a failed logout and keeps the current route", async () => {
		mockLogout.mockRejectedValueOnce(new Error("Abmeldung fehlgeschlagen"));
		const screen = await render(<SettingsScreen />);

		await fireEvent.press(screen.getByRole("button", { name: "Abmelden" }));

		const error = await screen.findByRole("alert");
		expect(error).toHaveTextContent("Abmeldung fehlgeschlagen");
		expect(error.props.accessibilityLiveRegion).toBe("polite");
		await waitFor(() => expect(mockReplace).not.toHaveBeenCalled());
	});
});
