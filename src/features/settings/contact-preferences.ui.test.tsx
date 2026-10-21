import { beforeEach, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import ContactPreferencesScreen from "~/app/contact-preferences";
import {
	CONTACT_FEEDBACK_LABEL,
	CONTACT_NEWS_LABEL,
	type ContactPreferences,
	emptyContactChoice,
} from "~/lib/contact-preferences";

let mockSnapshot: ContactPreferences | null | undefined;
const mockSave = jest.fn<(args: unknown) => Promise<ContactPreferences>>();
const mockWithdraw =
	jest.fn<(_args: Record<string, never>) => Promise<ContactPreferences>>();
const mockTrack = jest.fn();
jest.mock("convex/react", () => ({
	useConvexAuth: () => ({ isAuthenticated: true }),
	useQuery: () => mockSnapshot,
	useMutation: (ref: unknown) =>
		String(ref).endsWith("withdraw") ? mockWithdraw : mockSave,
}));
jest.mock("#convex/_generated/api", () => ({
	api: {
		contactPreferences: {
			getMine: "getMine",
			save: "save",
			withdraw: "withdraw",
		},
	},
}));
jest.mock("expo-router", () => ({ useRouter: () => ({ back: jest.fn() }) }));
jest.mock("~/context/AuthContext", () => ({
	useAuthSession: () => ({ user: { clerkId: "contact-test" } }),
}));
jest.mock("~/components/screen-header", () => ({ ScreenHeader: () => null }));
jest.mock("~/components/ui/themed-status-bar", () => ({
	ThemedStatusBar: () => null,
}));
jest.mock("~/components/ui/screen", () => ({
	Screen: ({ children }: { children: React.ReactNode }) => children,
	ScreenScroll: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("~/lib/use-feature-analytics", () => ({
	useFeatureAnalytics: () => mockTrack,
}));
jest.mock("~/lib/runtime-config", () => ({
	env: { EXPO_PUBLIC_PRIVACY_URL: "https://example.com/privacy" },
}));
jest.mock("~/lib/safe-haptics", () => ({ triggerSelectionHaptic: jest.fn() }));
jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		isDark: false,
		colors: {
			text: "#1A1A1A",
			primary: "#00BAFF",
			secondaryText: "#697586",
			surface: "#FFFFFF",
			border: "#DCE6EE",
			onPrimary: "#1A1A1A",
		},
	}),
}));
jest.mock("react-native-reanimated", () =>
	jest.requireActual("../../../tests/mocks/selection-reanimated.cjs"),
);

beforeEach(() => {
	mockSnapshot = {
		...emptyContactChoice(),
		phone: "+4915123456789",
		feedback: true,
		revision: 1,
		updatedAt: 1,
	};
	mockSave.mockReset();
	mockWithdraw.mockReset();
	mockTrack.mockReset();
});

test("withdraws even with an invalid edited number and only confirms after backend success", async () => {
	const confirmed = { ...emptyContactChoice(), revision: 2, updatedAt: 2 };
	let confirmWithdrawal!: (value: ContactPreferences) => void;
	mockWithdraw.mockImplementation(
		() =>
			new Promise((resolve) => {
				confirmWithdrawal = resolve;
			}),
	);
	const screen = await render(<ContactPreferencesScreen />);
	await fireEvent.changeText(
		screen.getByLabelText("Deine Telefonnummer (freiwillig)"),
		"123",
	);
	expect(
		screen.getByRole("checkbox", { name: CONTACT_FEEDBACK_LABEL }),
	).not.toBeChecked();
	await fireEvent.press(
		screen.getByRole("button", { name: "Alle Kontaktfreigaben widerrufen" }),
	);
	await waitFor(() => expect(mockWithdraw).toHaveBeenCalledWith({}));
	expect(mockSave).not.toHaveBeenCalled();
	expect(
		screen.queryByText("Deine Kontaktauswahl wurde gespeichert."),
	).toBeNull();
	expect(mockTrack).not.toHaveBeenCalled();
	expect(
		screen.getByRole("button", { name: "Alle Kontaktfreigaben widerrufen" }),
	).toBeDisabled();
	await act(async () => confirmWithdrawal(confirmed));
	expect(
		screen.getByText("Deine Kontaktauswahl wurde gespeichert."),
	).toBeOnTheScreen();
	expect(mockTrack).toHaveBeenCalledWith(
		"settings.contact_withdrawn",
		"succeeded",
	);
});

test("rejects a stale draft after an external withdrawal until the current choice is loaded", async () => {
	const screen = await render(<ContactPreferencesScreen />);
	mockSnapshot = { ...emptyContactChoice(), revision: 2, updatedAt: 2 };
	await screen.rerender(<ContactPreferencesScreen />);
	expect(
		screen.getByRole("button", { name: "Auswahl speichern" }),
	).toBeDisabled();
	await fireEvent.press(
		screen.getByRole("button", { name: "Aktuelle Auswahl laden" }),
	);
	expect(
		screen.getByRole("checkbox", { name: CONTACT_FEEDBACK_LABEL }),
	).not.toBeChecked();
	expect(
		screen.getByRole("button", { name: "Auswahl speichern" }),
	).toBeEnabled();
});

test("retains a failed draft, shows a safe error, and retries with its revision", async () => {
	mockSave.mockRejectedValueOnce(new Error("internal private details"));
	mockSave.mockResolvedValueOnce({
		...emptyContactChoice(),
		phone: "+4915123456789",
		feedback: true,
		news: true,
		revision: 2,
		updatedAt: 2,
	});
	const screen = await render(<ContactPreferencesScreen />);
	await fireEvent.press(
		screen.getByRole("checkbox", { name: CONTACT_NEWS_LABEL }),
	);
	await fireEvent.press(
		screen.getByRole("button", { name: "Auswahl speichern" }),
	);
	await waitFor(() => expect(screen.getByRole("alert")).toBeOnTheScreen());
	expect(screen.queryByText("internal private details")).toBeNull();
	expect(
		screen.getByRole("checkbox", { name: CONTACT_NEWS_LABEL }),
	).toBeChecked();
	expect(mockTrack).not.toHaveBeenCalled();
	await fireEvent.press(
		screen.getByRole("button", { name: "Auswahl speichern" }),
	);
	await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(2));
	expect(mockSave).toHaveBeenLastCalledWith({
		choice: {
			phone: "+4915123456789",
			news: true,
			feedback: true,
			version: "2026-10-21.contact.v1",
		},
		expectedRevision: 1,
	});
});
