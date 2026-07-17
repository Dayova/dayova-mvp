import type { ReactNode } from "react";
import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import ForcedPasswordResetScreen from "~/app/session-tasks/reset-password";

const mockReplace = jest.fn();
const mockCompleteForcedPasswordReset = jest.fn(async () => undefined);

jest.mock("expo-router", () => ({
	useRouter: () => ({ replace: mockReplace }),
}));

jest.mock("~/context/AuthContext", () => ({
	useAccountActions: () => ({
		completeForcedPasswordReset: mockCompleteForcedPasswordReset,
		isLoading: false,
	}),
}));

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

jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		colors: { secondaryText: "#697586" },
	}),
}));

describe("forced password reset session task", () => {
	beforeEach(() => {
		mockCompleteForcedPasswordReset.mockClear();
		mockReplace.mockClear();
	});

	test("shows both visibility controls and completes one reset transaction", async () => {
		const screen = await render(<ForcedPasswordResetScreen />);

		expect(screen.getByLabelText("Neues Passwort anzeigen")).toBeOnTheScreen();
		expect(
			screen.getByLabelText("Passwortbestätigung anzeigen"),
		).toBeOnTheScreen();

		await fireEvent.changeText(
			screen.getByLabelText("Neues Passwort"),
			"sicher123",
		);
		await fireEvent.changeText(
			screen.getByLabelText("Neues Passwort wiederholen"),
			"sicher123",
		);
		await fireEvent.press(
			screen.getByRole("button", { name: "Passwort speichern" }),
		);

		await waitFor(() => {
			expect(mockCompleteForcedPasswordReset).toHaveBeenCalledTimes(1);
			expect(mockCompleteForcedPasswordReset).toHaveBeenCalledWith("sicher123");
			expect(mockReplace).toHaveBeenCalledWith("/password-reset-success");
		});
	});
});
