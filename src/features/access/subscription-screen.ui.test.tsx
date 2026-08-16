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
		price: "$155.88",
		productIdentifier: "test_store_annual",
	},
	{
		billingPeriod: "monthly" as const,
		packageIdentifier: "$rc_monthly",
		price: "$14.99",
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
		refreshPaidAccess: mockRefreshPaidAccess,
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
			purchase: mockPurchase,
			restore: mockRestore,
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
			expect(screen.getByText("Abonnieren")).toBeOnTheScreen();
		});
		expect(screen.queryByText("Tarif wählen")).not.toBeOnTheScreen();
		expect(screen.queryByText("Ich zahle selbst")).not.toBeOnTheScreen();
		expect(screen.getByLabelText("Zurück").parent).toBe(
			screen.getByTestId("subscription-header-row"),
		);
		expect(
			screen.getByRole("progressbar", { name: "Schritt 2 von 2" }),
		).toBeOnTheScreen();
		expect(
			screen.queryByTestId("subscription-payment-surface"),
		).not.toBeOnTheScreen();
		expect(
			screen.queryByText(
				"Die Zahlung läuft über den App Store oder Google Play. Das Abo verlängert sich dort bis zur Kündigung.",
			),
		).not.toBeOnTheScreen();
		expect(
			screen.getByRole("radio", { name: /Jährlich/ }).props.accessibilityState,
		).toEqual({ checked: false });
		expect(
			screen.getByRole("radio", { name: /Monatlich/ }).props.accessibilityState,
		).toEqual({ checked: true });
		expect(screen.getByTestId("subscription-plan-annual").props.style).toEqual(
			expect.objectContaining({
				backgroundColor: "rgba(255, 255, 255, 0.8)",
				borderColor: "rgba(255, 255, 255, 0.6)",
				borderWidth: 1,
				boxShadow:
					"inset 0 1px 0 rgba(255, 255, 255, 0.7), 0 6px 16px rgba(9, 54, 78, 0.08)",
			}),
		);
		expect(screen.getByTestId("subscription-plan-monthly").props.style).toEqual(
			expect.objectContaining({
				backgroundColor: "rgba(255, 255, 255, 0.8)",
				borderColor: "#1A1A1A",
				borderWidth: 1,
				boxShadow:
					"inset 0 1px 0 rgba(255, 255, 255, 0.64), 0 8px 20px rgba(9, 54, 78, 0.1)",
			}),
		);
		expect(
			screen.getByTestId("subscription-plan-monthly-indicator").props.style,
		).toEqual(
			expect.objectContaining({
				backgroundColor: "#1A1A1A",
				borderColor: "#1A1A1A",
			}),
		);
		expect(
			screen.getByRole("radio", {
				name: /Jährlich, 12,99 €. 155,88 € jährlich abgerechnet/,
			}),
		).toBeOnTheScreen();
		expect(
			screen.getByRole("radio", { name: /Monatlich, 14,99 €/ }),
		).toBeOnTheScreen();
		expect(
			screen.getByTestId("subscription-checkout-button").props.style,
		).toEqual(
			expect.objectContaining({
				backgroundColor: "#1A1A1A",
				borderColor: "#DCE6EE",
			}),
		);
		expect(screen.getByText("Käufe wiederherstellen").props.style).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					color: "#FFFFFF",
					textDecorationLine: "underline",
				}),
			]),
		);
		expect(
			screen.getByTestId("restore-purchases-link").props.accessibilityRole,
		).toBe("button");

		fireEvent.press(screen.getByRole("radio", { name: /Jährlich/ }));
		await waitFor(() => {
			expect(
				screen.getByTestId("subscription-plan-annual").props.style,
			).toEqual(
				expect.objectContaining({
					backgroundColor: "rgba(255, 255, 255, 0.8)",
					borderColor: "#1A1A1A",
					borderWidth: 1,
					boxShadow:
						"inset 0 1px 0 rgba(255, 255, 255, 0.64), 0 8px 20px rgba(9, 54, 78, 0.1)",
				}),
			);
		});
	});

	test("shows the parent payment model on its own page", async () => {
		const screen = await render(<SubscriptionScreen payer="parent" />);

		expect(
			screen.getByText("Mit deinen Eltern freischalten"),
		).toBeOnTheScreen();
		expect(screen.queryByText("Meine Eltern zahlen")).not.toBeOnTheScreen();
		expect(
			screen.getByText("Elternzahlung kommt mit der Dayova-Webzahlung"),
		).toBeOnTheScreen();
		expect(
			screen.getByTestId("subscription-payment-surface").props.style,
		).toEqual(
			expect.objectContaining({
				backgroundColor: "#FFFFFF",
				borderColor: "#4FD8FF",
			}),
		);
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

	test("redirects to the Pro welcome screen after a confirmed purchase", async () => {
		const screen = await render(<SubscriptionScreen payer="self" />);

		await screen.findByText("Abonnieren");
		await act(async () => {
			fireEvent.press(screen.getByText("Abonnieren"));
		});

		await waitFor(() => {
			expect(mockPurchase).toHaveBeenCalledWith("monthly");
			expect(mockRefreshPaidAccess).toHaveBeenCalledTimes(1);
			expect(mockReplace).toHaveBeenCalledWith("/pro-welcome");
		});
	});

	test("restores existing purchases without replaying the welcome screen", async () => {
		const screen = await render(<SubscriptionScreen payer="self" />);

		await screen.findByText("Käufe wiederherstellen");
		await act(async () => {
			fireEvent.press(screen.getByText("Käufe wiederherstellen"));
		});

		await waitFor(() => {
			expect(mockRestore).toHaveBeenCalledTimes(1);
			expect(mockRefreshPaidAccess).toHaveBeenCalledTimes(1);
			expect(mockReplace).toHaveBeenCalledWith("/home");
		});
	});
});
