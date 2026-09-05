import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import SettingsScreen from "../../app/(app)/settings";

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockLogout = jest.fn<() => Promise<void>>(async () => undefined);
const mockDeleteAccount = jest.fn<() => Promise<void>>(async () => undefined);
const mockSetPreference = jest.fn(async () => undefined);
const mockOpenAiConsentSettings = jest.fn();
const mockOpenExternalUrl = jest.fn<(url?: string) => Promise<boolean>>(
	async () => true,
);
let mockAccess: { state: "trial" } | { state: "paid"; store: string } = {
	state: "trial",
};

jest.mock("expo-router", () => ({
	useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

jest.mock("~/context/AuthContext", () => ({
	useAccountActions: () => ({
		deleteAccount: mockDeleteAccount,
		logout: mockLogout,
	}),
}));

jest.mock("~/context/AiConsentContext", () => ({
	useAiConsent: () => ({
		openAiConsentSettings: mockOpenAiConsentSettings,
		statusLabel: "Nicht aktiv",
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

jest.mock("~/context/AccessContext", () => ({
	useAccess: () => ({ access: mockAccess }),
}));

jest.mock("~/lib/open-external-url", () => ({
	openExternalUrl: (url?: string) => mockOpenExternalUrl(url),
}));

jest.mock("~/lib/runtime-config", () => ({
	env: {
		EXPO_PUBLIC_PRIVACY_URL: "https://example.com/privacy",
		EXPO_PUBLIC_SUPPORT_URL: "https://example.com/support",
		EXPO_PUBLIC_TERMS_URL: "https://example.com/terms",
	},
}));

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

describe("SettingsScreen", () => {
	beforeEach(() => {
		mockLogout.mockReset();
		mockLogout.mockResolvedValue(undefined);
		mockDeleteAccount.mockReset();
		mockDeleteAccount.mockResolvedValue(undefined);
		mockReplace.mockReset();
		mockPush.mockReset();
		mockSetPreference.mockReset();
		mockSetPreference.mockResolvedValue(undefined);
		mockOpenExternalUrl.mockReset();
		mockOpenExternalUrl.mockResolvedValue(true);
		mockAccess = { state: "trial" };
		mockOpenAiConsentSettings.mockReset();
	});

	test("groups destinations by learning, app, and account responsibility", async () => {
		const screen = await render(<SettingsScreen />);

		expect(screen.getByRole("header", { name: "Lernen" })).toBeOnTheScreen();
		expect(screen.getByRole("header", { name: "App" })).toBeOnTheScreen();
		expect(screen.getByRole("header", { name: "Konto" })).toBeOnTheScreen();
		expect(
			screen.getByRole("header", { name: "Dayova Pro" }),
		).toBeOnTheScreen();
		expect(
			screen.getByRole("header", { name: "Rechtliches & Hilfe" }),
		).toBeOnTheScreen();
		expect(screen.getByText("Nicht aktiv")).toBeOnTheScreen();

		await fireEvent.press(screen.getByRole("button", { name: "Stundenplan" }));
		expect(mockPush).toHaveBeenCalledWith("/timetable");
	});

	test("lets trial users subscribe and keeps privacy available in settings", async () => {
		const screen = await render(<SettingsScreen />);

		await fireEvent.press(
			screen.getByRole("button", { name: "Dayova Pro abonnieren" }),
		);
		expect(mockPush).toHaveBeenCalledWith("/subscription");

		await fireEvent.press(screen.getByRole("button", { name: "Datenschutz" }));
		expect(mockOpenExternalUrl).toHaveBeenCalledWith(
			"https://example.com/privacy",
		);

		await fireEvent.press(
			screen.getByRole("button", {
				name: "KI & Datenschutz, Nicht aktiv",
			}),
		);
		expect(mockOpenAiConsentSettings).toHaveBeenCalledTimes(1);
	});

	test("exposes each theme preference as an individually selectable radio", async () => {
		const screen = await render(<SettingsScreen />);
		const light = screen.getByRole("radio", {
			name: "Helles Design verwenden",
		});
		const system = screen.getByRole("radio", {
			name: "Systemdesign verwenden",
		});
		const dark = screen.getByRole("radio", {
			name: "Dunkles Design verwenden",
		});

		expect(light.props.accessibilityState).toEqual({ checked: false });
		expect(system.props.accessibilityState).toEqual({ checked: true });
		expect(dark.props.accessibilityState).toEqual({ checked: false });

		await fireEvent.press(light);
		expect(mockSetPreference).toHaveBeenCalledWith("light");
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

	test("deletes the account from settings only after explicit confirmation", async () => {
		const screen = await render(<SettingsScreen />);

		await fireEvent.press(
			screen.getByRole("button", { name: "Konto löschen" }),
		);
		expect(screen.getByText("Konto wirklich löschen?")).toBeOnTheScreen();
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
		const screen = await render(<SettingsScreen />);

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
