import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import ProfileScreen from "../../app/profile";

const mockReplace = jest.fn();

const mockPush = jest.fn();

const mockLogout = jest.fn<() => Promise<void>>(async () => undefined);

const mockDeleteAccount = jest.fn<() => Promise<void>>(async () => undefined);

const mockSetPreference = jest.fn(async () => undefined);

jest.mock("expo-router", () => ({
	useRouter: () => ({
		push: mockPush,
		replace: mockReplace,
		canGoBack: () => false,
	}),
}));

jest.mock("~/context/AuthContext", () => ({
	useAuthSession: () => ({
		user: {
			clerkId: "user_test",
			name: "Test Person",
			email: "test@example.com",
		},
	}),
	useAccountActions: () => ({
		isLoading: false,
		updateProfile: jest.fn(),
		verifyProfileEmailCode: jest.fn(),
		deleteAccount: mockDeleteAccount,
		logout: mockLogout,
	}),
}));

jest.mock("~/components/ui/confirmation-sheet", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const {
		Pressable: NativePressable,
		Text: NativeText,
		View: NativeView,
	} = jest.requireActual<typeof import("react-native")>("react-native");
	return {
		ConfirmationSheet: ({
			confirmLabel,
			description,
			onConfirm,
			title,
			visible,
		}: {
			confirmLabel: string;
			description: ReactNode;
			onConfirm: () => void;
			title: ReactNode;
			visible: boolean;
		}) =>
			visible
				? React.createElement(
						NativeView,
						null,
						React.createElement(NativeText, null, title),
						React.createElement(NativeText, null, description),
						React.createElement(
							NativePressable,
							{ accessibilityRole: "button", onPress: onConfirm },
							React.createElement(NativeText, null, confirmLabel),
						),
					)
				: null,
	};
});

jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		colors: {
			destructive: "#D92D20",
			secondaryText: "#667085",
			text: "#101828",
		},
		preference: "system",
		setPreference: mockSetPreference,
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

describe("ProfileScreen account management", () => {
	beforeEach(() => {
		mockLogout.mockReset();
		mockLogout.mockResolvedValue(undefined);
		mockDeleteAccount.mockReset();
		mockDeleteAccount.mockResolvedValue(undefined);
		mockPush.mockReset();
		mockReplace.mockReset();
	});

	test("keeps personal details and account controls in one place", async () => {
		const screen = await render(<ProfileScreen />);
		expect(screen.getByDisplayValue("Test Person")).toBeOnTheScreen();
		expect(screen.getByDisplayValue("test@example.com")).toBeOnTheScreen();
		await fireEvent.press(
			screen.getByRole("button", { name: "Passwort ändern" }),
		);
		expect(mockPush).toHaveBeenCalledWith("/change-password");
		expect(screen.getByRole("button", { name: "Abmelden" })).toBeOnTheScreen();
		expect(
			screen.getByRole("button", { name: "Konto löschen" }),
		).toBeOnTheScreen();
	});

	test("owns one logout transaction and leaves session routing to the root guard", async () => {
		let resolveLogout: () => void = () => undefined;
		mockLogout.mockImplementationOnce(
			() =>
				new Promise<void>((resolve) => {
					resolveLogout = resolve;
				}),
		);
		const screen = await render(<ProfileScreen />);
		const logoutButton = screen.getByRole("button", { name: "Abmelden" });
		await fireEvent.changeText(
			screen.getByDisplayValue("Test Person"),
			"Updated Name",
		);
		await fireEvent.press(logoutButton);
		await fireEvent.press(logoutButton);
		expect(mockLogout).toHaveBeenCalledTimes(1);
		expect(logoutButton.props.accessibilityState).toEqual({
			busy: true,
			disabled: true,
		});
		expect(mockReplace).not.toHaveBeenCalled();
		expect(screen.getByRole("button", { name: "Speichern" })).toBeDisabled();
		expect(
			screen.getByRole("button", { name: "Konto löschen" }),
		).toBeDisabled();
		expect(
			screen.getByRole("button", { name: "Passwort ändern" }),
		).toBeDisabled();
		await act(async () => resolveLogout());
	});

	test("deletes the account from profile only after explicit confirmation", async () => {
		const screen = await render(<ProfileScreen />);
		await fireEvent.press(
			screen.getByRole("button", { name: "Konto löschen" }),
		);
		expect(screen.getByText("Konto wirklich löschen?")).toBeOnTheScreen();
		expect(mockDeleteAccount).not.toHaveBeenCalled();
		expect(
			screen.getByText(/aktives App-Store-Abo musst du zusätzlich/),
		).toBeOnTheScreen();
		const confirmationButton = screen
			.getAllByRole("button", { name: "Konto löschen" })
			.at(-1);
		if (!confirmationButton) throw new Error("Confirmation button is missing.");
		await fireEvent.press(confirmationButton);
		await waitFor(() => expect(mockDeleteAccount).toHaveBeenCalledTimes(1));
		expect(mockReplace).not.toHaveBeenCalled();
	});

	test("announces a failed logout and keeps the current route", async () => {
		mockLogout.mockRejectedValueOnce(
			new Error("ClerkJS: session token refresh failed with status 503"),
		);
		const screen = await render(<ProfileScreen />);
		await fireEvent.press(screen.getByRole("button", { name: "Abmelden" }));
		const error = await screen.findByRole("alert");
		expect(error).toHaveTextContent(
			"Die Abmeldung ist fehlgeschlagen. Bitte versuche es erneut.",
		);
		expect(error).not.toHaveTextContent("ClerkJS");
		expect(error.props.accessibilityLiveRegion).toBe("polite");
		await waitFor(() => expect(mockReplace).not.toHaveBeenCalled());
	});
});
