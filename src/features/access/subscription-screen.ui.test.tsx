import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { SubscriptionScreen } from "./subscription-screen";

const mockBack = jest.fn();
const mockReplace = jest.fn();
const storePlans = [
	{
		billingPeriod: "annual" as const,
		packageIdentifier: "$rc_annual",
		price: "155,88 €",
		pricePerMonth: "12,99 €",
		productIdentifier: "test_store_annual",
	},
	{
		billingPeriod: "monthly" as const,
		packageIdentifier: "$rc_monthly",
		price: "14,99 €",
		pricePerMonth: "14,99 €",
		productIdentifier: "test_store_monthly",
	},
];
const mockGetPlans = jest.fn(async () => storePlans);
const mockPurchase = jest.fn(async () => ({ status: "purchased" as const }));
const mockRestore = jest.fn(async () => ({ status: "purchased" as const }));
const mockRefreshPaidAccess = jest.fn(async () => true);
let mockCanGoBack = true;
let mockStoreInitializationError: Error | null = null;

beforeEach(() => {
	jest.clearAllMocks();
	mockGetPlans.mockResolvedValue(storePlans);
	mockPurchase.mockResolvedValue({ status: "purchased" });
	mockRestore.mockResolvedValue({ status: "purchased" });
	mockRefreshPaidAccess.mockResolvedValue(true);
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

jest.mock("react-native-safe-area-context", () => ({
	useSafeAreaInsets: () => ({ bottom: 34, left: 0, right: 0, top: 59 }),
}));

jest.mock("~/context/AccessContext", () => ({
	useAccess: () => ({ refreshPaidAccess: mockRefreshPaidAccess }),
}));

jest.mock("~/context/AuthContext", () => ({
	useAuthSession: () => ({ user: { clerkId: "user_123" } }),
}));

jest.mock("~/lib/revenuecat-client", () => ({
	createNativeRevenueCatClient: () => {
		if (mockStoreInitializationError) throw mockStoreInitializationError;
		return {
			getPlans: mockGetPlans,
			purchase: mockPurchase,
			restore: mockRestore,
		};
	},
}));

jest.mock("~/lib/diagnostics", () => ({ logDiagnosticError: jest.fn() }));

jest.mock("~/lib/runtime-config", () => ({
	env: {
		EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY: "android_test_key",
		EXPO_PUBLIC_REVENUECAT_IOS_API_KEY: "ios_test_key",
	},
}));

describe("SubscriptionScreen", () => {
	test("shows only localized Store plans and complete billing amounts", async () => {
		const screen = await render(<SubscriptionScreen />);

		expect(screen.getByText("Dayova Pro abonnieren")).toBeOnTheScreen();
		await waitFor(() => expect(mockGetPlans).toHaveBeenCalledTimes(1));
		expect(
			screen.getByRole("radio", {
				name: "Jährlich, 155,88 €. 12,99 € pro Monat bei jährlicher Abrechnung",
			}),
		).toBeOnTheScreen();
		expect(
			screen.getByRole("radio", {
				name: "Monatlich, 14,99 €. 14,99 € pro Monat",
			}),
		).toBeOnTheScreen();
		expect(
			screen.queryByText(/Elternzahlung|QR-Code|Zahlungsseite/),
		).toBeNull();
		expect(screen.queryByTestId("subscription-payment-surface")).toBeNull();
		expect(screen.getByText(/automatisch/)).toBeOnTheScreen();
	});

	test("purchases the selected Store plan and opens the Pro welcome screen", async () => {
		const screen = await render(<SubscriptionScreen />);
		const annualPlan = await screen.findByRole("radio", {
			name: /Jährlich, 155,88 €/,
		});
		await act(async () => {
			fireEvent.press(annualPlan);
		});

		await act(async () => {
			fireEvent.press(screen.getByTestId("subscription-checkout-button"));
		});

		await waitFor(() => {
			expect(mockPurchase).toHaveBeenCalledWith("annual");
			expect(mockRefreshPaidAccess).toHaveBeenCalledTimes(1);
			expect(mockReplace).toHaveBeenCalledWith("/pro-welcome");
		});
	});

	test("restores existing purchases without replaying the welcome screen", async () => {
		const screen = await render(<SubscriptionScreen />);
		await screen.findByText("Käufe wiederherstellen");

		await act(async () => {
			fireEvent.press(screen.getByText("Käufe wiederherstellen"));
		});

		await waitFor(() => {
			expect(mockRestore).toHaveBeenCalledTimes(1);
			expect(mockReplace).toHaveBeenCalledWith("/home");
		});
	});

	test("returns direct links to the expired-access page", async () => {
		mockCanGoBack = false;
		const screen = await render(<SubscriptionScreen />);

		fireEvent.press(screen.getByLabelText("Zurück"));
		expect(mockBack).not.toHaveBeenCalled();
		expect(mockReplace).toHaveBeenCalledWith("/paywall");
	});

	test("explains when the native Store client cannot start", async () => {
		mockStoreInitializationError = new Error("native module unavailable");
		const screen = await render(<SubscriptionScreen />);

		expect(
			await screen.findByText(
				"Store-Käufe konnten auf diesem Gerät nicht gestartet werden. Bitte öffne die App erneut oder kontaktiere den Support.",
			),
		).toBeOnTheScreen();
	});
});
