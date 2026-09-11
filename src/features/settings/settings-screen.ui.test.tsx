import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import {
	fireEvent,
	render,
	waitFor,
	within,
} from "@testing-library/react-native";
import type { ReactNode } from "react";
import SettingsScreen from "../../app/(app)/settings";

jest.mock("~/components/ui/dayova-sheet-frame", () => ({
	DayovaSheetFrame: ({
		visible,
		children,
	}: {
		visible: boolean;
		children: ReactNode;
	}) => (visible ? children : null),
}));

const mockReplace = jest.fn();

const mockPush = jest.fn();

const mockSetPreference = jest.fn(async () => undefined);

const mockOpenAiConsentSettings = jest.fn();

const mockOpenExternalUrl = jest.fn<(url?: string) => Promise<boolean>>(
	async () => true,
);
let mockProfileName: string | undefined = "Test Person";

let mockAccess: { state: "trial" } | { state: "paid"; store: string } = {
	state: "trial",
};

jest.mock("expo-router", () => ({
	useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

jest.mock("~/context/AuthContext", () => ({
	useAuthSession: () => ({ user: { name: mockProfileName } }),
}));

jest.mock("~/context/AiConsentContext", () => ({
	useAiConsent: () => ({
		openAiConsentSettings: mockOpenAiConsentSettings,
		statusLabel: "Nicht aktiv",
	}),
}));

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
		mockReplace.mockReset();
		mockPush.mockReset();
		mockSetPreference.mockReset();
		mockSetPreference.mockResolvedValue(undefined);
		mockOpenExternalUrl.mockReset();
		mockOpenExternalUrl.mockResolvedValue(true);
		mockAccess = { state: "trial" };
		mockProfileName = "Test Person";
		mockOpenAiConsentSettings.mockReset();
	});

	test("prioritizes profile and support and keeps legal destinations last", async () => {
		const screen = await render(<SettingsScreen />);
		expect(screen.getByRole("header", { name: "Lernen" })).toBeOnTheScreen();
		expect(screen.getByRole("header", { name: "App" })).toBeOnTheScreen();
		expect(
			screen.getByRole("header", { name: "Datenschutz & Rechtliches" }),
		).toBeOnTheScreen();
		expect(
			screen.getAllByRole("header").map((heading) => heading.props.children),
		).toEqual(["Lernen", "App", "Datenschutz & Rechtliches"]);
		expect(screen.getByText("Nicht aktiv")).toBeOnTheScreen();
		expect(screen.getByText("Test Person")).toBeOnTheScreen();
		expect(screen.getByText("Profil & Konto")).toBeOnTheScreen();
		expect(screen.getAllByRole("button").slice(0, 2)).toEqual([
			screen.getByRole("button", { name: "Test Person, Profil & Konto" }),
			screen.getByRole("button", { name: "Support kontaktieren" }),
		]);
		expect(
			screen.queryByRole("button", { name: "Passwort ändern" }),
		).toBeNull();
		expect(screen.queryByRole("button", { name: "Abmelden" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Konto löschen" })).toBeNull();
		await fireEvent.press(
			screen.getByRole("button", { name: "Test Person, Profil & Konto" }),
		);
		expect(mockPush).toHaveBeenCalledWith("/profile");
		await fireEvent.press(
			screen.getByRole("button", { name: "Support kontaktieren" }),
		);
		expect(mockOpenExternalUrl).toHaveBeenCalledWith(
			expect.stringContaining("mailto:kontakt@dayova.de?"),
		);
		await fireEvent.press(screen.getByRole("button", { name: "Stundenplan" }));
		expect(mockPush).toHaveBeenCalledWith("/timetable");
	});

	test.each([
		["Datenschutz", "settings-legal"],
		["Dayova, Hilfe zum Abo", "settings-subscription"],
	])("shows a failed %s link beside its section and clears it after retry", async (label, section) => {
		mockAccess = { state: "paid", store: "unknown" };
		mockOpenExternalUrl.mockResolvedValueOnce(false);
		const screen = await render(<SettingsScreen />);
		await fireEvent.press(screen.getByRole("button", { name: label }));
		const sectionContainer = screen.getByTestId(section);
		expect(
			await within(sectionContainer).findByRole("alert"),
		).toHaveTextContent(
			"Der Link konnte nicht geöffnet werden. Bitte versuche es erneut.",
		);
		await fireEvent.press(screen.getByRole("button", { name: label }));
		await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
	});

	test("lets trial users subscribe and keeps privacy available in settings", async () => {
		const screen = await render(<SettingsScreen />);
		await fireEvent.press(
			screen.getByRole("button", { name: "Dayova abonnieren" }),
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
});
