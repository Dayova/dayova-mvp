import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { SubscriptionScreen } from "./subscription-screen";

const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockGetPlans = jest.fn(async () => []);
let mockCanGoBack = true;
let mockStoreInitializationError: Error | null = null;

beforeEach(() => {
	jest.clearAllMocks();
	mockGetPlans.mockResolvedValue([]);
	mockCanGoBack = true;
	mockStoreInitializationError = null;
});

jest.mock("expo-router", () => ({
	useRouter: () => ({
		back: mockBack,
		canGoBack: () => mockCanGoBack,
		replace: mockReplace,
	}),
}));

jest.mock("expo-linear-gradient", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	return {
		LinearGradient: ({
			children,
			...props
		}: Record<string, unknown> & { children?: ReactNode }) =>
			React.createElement("LinearGradient", props, children),
	};
});

jest.mock("expo-status-bar", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	return {
		StatusBar: (props: Record<string, unknown>) =>
			React.createElement("StatusBar", props),
	};
});

jest.mock("react-native-qrcode-svg", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	return {
		__esModule: true,
		default: (props: Record<string, unknown>) =>
			React.createElement("QRCode", props),
	};
});

jest.mock("react-native-safe-area-context", () => ({
	useSafeAreaInsets: () => ({ bottom: 34, left: 0, right: 0, top: 59 }),
}));

jest.mock("~/context/AccessContext", () => ({
	useAccess: () => ({
		access: null,
		refreshPaidAccess: jest.fn(),
	}),
}));

jest.mock("~/context/AuthContext", () => ({
	useAuthSession: () => ({
		user: { clerkId: "user_123" },
	}),
}));

jest.mock("~/lib/revenuecat-client", () => ({
	createNativeRevenueCatClient: () => {
		if (mockStoreInitializationError) throw mockStoreInitializationError;
		return {
			getPlans: mockGetPlans,
			purchase: jest.fn(),
			restore: jest.fn(),
		};
	},
}));

jest.mock("~/lib/diagnostics", () => ({
	logDiagnosticError: jest.fn(),
}));

jest.mock("~/lib/runtime-config", () => ({
	env: {
		EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY: "android_test_key",
		EXPO_PUBLIC_REVENUECAT_IOS_API_KEY: "ios_test_key",
	},
}));

describe("SubscriptionScreen", () => {
	test("shows store plans only on the dedicated self-payment page", async () => {
		const screen = await render(<SubscriptionScreen payer="self" />);

		expect(screen.getByText("Dein Dayova-Abo auswählen")).toBeOnTheScreen();
		await waitFor(() => {
			expect(mockGetPlans).toHaveBeenCalledTimes(1);
			expect(screen.getByText("Tarif wählen")).toBeOnTheScreen();
		});
		expect(
			screen.getByRole("radio", { name: /Jährlich/ }).props.accessibilityState,
		).toEqual({ checked: false });
		expect(
			screen.getByRole("radio", { name: /Monatlich/ }).props.accessibilityState,
		).toEqual({ checked: true });
		expect(
			screen.getByTestId("subscription-payment-surface").props.style,
		).toEqual(
			expect.objectContaining({
				backgroundColor: "#FFFFFF",
				borderColor: "#4FD8FF",
			}),
		);
	});

	test("shows the parent payment model on its own page", async () => {
		const screen = await render(<SubscriptionScreen payer="parent" />);

		expect(
			screen.getByText("Mit deinen Eltern freischalten"),
		).toBeOnTheScreen();
		expect(
			screen.getByText("Elternzahlung kommt mit der Dayova-Webzahlung"),
		).toBeOnTheScreen();
		expect(screen.queryByText("Tarif wählen")).not.toBeOnTheScreen();
		expect(mockGetPlans).not.toHaveBeenCalled();
	});

	test("returns to payer selection from the subscription page", async () => {
		const screen = await render(<SubscriptionScreen payer="parent" />);

		fireEvent.press(screen.getByLabelText("Zurück"));
		expect(mockBack).toHaveBeenCalledTimes(1);
	});

	test("returns directly opened subscription links to payer selection", async () => {
		mockCanGoBack = false;
		const screen = await render(<SubscriptionScreen payer="parent" />);

		fireEvent.press(screen.getByLabelText("Zurück"));
		expect(mockBack).not.toHaveBeenCalled();
		expect(mockReplace).toHaveBeenCalledWith("/paywall");
	});

	test("keeps self payment usable when the native store client cannot start", async () => {
		mockStoreInitializationError = new Error("native module unavailable");
		const screen = await render(<SubscriptionScreen payer="self" />);

		expect(
			await screen.findAllByText(
				"Store-Käufe konnten auf diesem Gerät nicht gestartet werden. Bitte öffne die App erneut oder kontaktiere den Support.",
			),
		).not.toHaveLength(0);
	});
});
