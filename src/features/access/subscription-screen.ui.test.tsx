import {
	afterEach,
	beforeEach,
	describe,
	expect,
	jest,
	test,
} from "@jest/globals";
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
let mockAccess: { state: string } | undefined;
let mockCanGoBack = true;
let mockStoreInitializationError: Error | null = null;

beforeEach(() => {
	jest.clearAllMocks();
	mockAccess = undefined;
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
	useAccess: () => ({
		access: mockAccess,
		refreshPaidAccess: mockRefreshPaidAccess,
	}),
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

		expect(screen.getByText("Dayova abonnieren")).toBeOnTheScreen();
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

	test("purchases the selected Store plan and opens the subscription success screen", async () => {
		const screen = await render(<SubscriptionScreen />);
		const annualPlan = await screen.findByRole("radio", {
			name: /Jährlich, 155,88 €/,
		});
		await act(async () => {
			await fireEvent.press(annualPlan);
		});

		await act(async () => {
			await fireEvent.press(screen.getByTestId("subscription-checkout-button"));
		});

		await waitFor(() => {
			expect(mockPurchase).toHaveBeenCalledWith("annual");
			expect(mockRefreshPaidAccess).toHaveBeenCalledTimes(1);
			expect(mockReplace).toHaveBeenCalledWith("/subscription-success");
		});
	});

	test("restores existing purchases without replaying the welcome screen", async () => {
		const screen = await render(<SubscriptionScreen />);
		await screen.findByText("Käufe wiederherstellen");

		await act(async () => {
			await fireEvent.press(screen.getByText("Käufe wiederherstellen"));
		});

		await waitFor(() => {
			expect(mockRestore).toHaveBeenCalledTimes(1);
			expect(mockReplace).toHaveBeenCalledWith("/home");
		});
	});

	test("disables restore and exposes its busy state while a Store action runs", async () => {
		let finishRestore: (() => void) | undefined;
		mockRestore.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					finishRestore = () => resolve({ status: "purchased" });
				}),
		);
		const screen = await render(<SubscriptionScreen />);
		const restoreButton = await screen.findByTestId("restore-purchases-link");

		await fireEvent.press(restoreButton);

		await waitFor(() => {
			expect(screen.getByTestId("restore-purchases-link")).toHaveProp(
				"accessibilityState",
				{
					busy: true,
					disabled: true,
				},
			);
		});
		await fireEvent.press(screen.getByTestId("restore-purchases-link"));
		expect(mockRestore).toHaveBeenCalledTimes(1);

		await act(async () => finishRestore?.());
	});

	test("returns direct links to the expired-access page", async () => {
		mockCanGoBack = false;
		const screen = await render(<SubscriptionScreen />);

		await fireEvent.press(screen.getByLabelText("Zurück"));
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

jest.mock("~/components/ui/icon", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const Icon = (props: Record<string, unknown>) =>
		React.createElement("Icon", props);
	return { ArrowLeft: Icon, Check: Icon };
});
afterEach(() => {
	jest.useRealTimers();
});

test.each([
	"error",
	"inactive",
])("keeps a confirmed purchase pending after %s and retries access without repurchasing", async (failure) => {
	jest.useFakeTimers();
	if (failure === "error")
		mockRefreshPaidAccess.mockRejectedValue(new Error("offline"));
	else mockRefreshPaidAccess.mockResolvedValue(false);
	const screen = await render(<SubscriptionScreen />);
	await act(async () => {
		await fireEvent.press(screen.getByTestId("subscription-checkout-button"));
	});
	expect(
		screen.queryByText("Der Kauf konnte nicht abgeschlossen werden."),
	).not.toBeOnTheScreen();
	expect(
		screen.getByText(
			"Dein Kauf war erfolgreich. Dein Zugang wird noch aktiviert.",
		),
	).toBeOnTheScreen();
	await act(async () => {
		await jest.advanceTimersByTimeAsync(10000);
	});
	expect(mockRefreshPaidAccess).toHaveBeenCalledTimes(3);
	expect(mockPurchase).toHaveBeenCalledTimes(1);
	mockRefreshPaidAccess.mockResolvedValue(true);
	await act(async () => {
		await fireEvent.press(screen.getByText("Zugang erneut prüfen"));
	});
	expect(mockPurchase).toHaveBeenCalledTimes(1);
	expect(mockRestore).not.toHaveBeenCalled();
	expect(mockReplace).toHaveBeenCalledWith("/subscription-success");
});

test("automatically recovers from a transient refresh failure", async () => {
	jest.useFakeTimers();
	mockRefreshPaidAccess.mockRejectedValueOnce(new Error("offline"));
	const screen = await render(<SubscriptionScreen />);
	await act(async () => {
		await fireEvent.press(screen.getByTestId("subscription-checkout-button"));
	});
	await act(async () => {
		await jest.advanceTimersByTimeAsync(2000);
	});
	expect(mockRefreshPaidAccess).toHaveBeenCalledTimes(2);
	expect(mockPurchase).toHaveBeenCalledTimes(1);
	expect(mockReplace).toHaveBeenCalledWith("/subscription-success");
});

test("continues when paid access arrives while the refresh is unresolved", async () => {
	mockRefreshPaidAccess.mockImplementationOnce(() => new Promise(() => {}));
	const screen = await render(<SubscriptionScreen />);
	await act(async () => {
		await fireEvent.press(screen.getByTestId("subscription-checkout-button"));
	});
	mockAccess = { state: "paid" };
	await screen.rerender(<SubscriptionScreen />);
	expect(mockReplace).toHaveBeenCalledWith("/subscription-success");
});

test("retains purchase failure for a rejected store operation", async () => {
	mockPurchase.mockRejectedValueOnce(new Error("store failure"));
	const screen = await render(<SubscriptionScreen />);
	await act(async () => {
		await fireEvent.press(screen.getByTestId("subscription-checkout-button"));
	});
	expect(
		screen.getByText("Der Kauf konnte nicht abgeschlossen werden."),
	).toBeOnTheScreen();
	expect(mockRefreshPaidAccess).not.toHaveBeenCalled();
});

test("retries restored access without calling the store again", async () => {
	jest.useFakeTimers();
	mockRefreshPaidAccess.mockResolvedValue(false);
	const screen = await render(<SubscriptionScreen />);
	await act(async () => {
		await fireEvent.press(screen.getByTestId("restore-purchases-link"));
	});
	expect(
		screen.getByText(
			"Dein Abo wurde gefunden. Dein Zugang wird noch aktiviert.",
		),
	).toBeOnTheScreen();
	await act(async () => {
		await jest.advanceTimersByTimeAsync(10000);
	});
	mockRefreshPaidAccess.mockResolvedValue(true);
	await act(async () => {
		await fireEvent.press(screen.getByText("Zugang erneut prüfen"));
		await fireEvent.press(screen.getByTestId("restore-purchases-link"));
	});
	expect(mockRestore).toHaveBeenCalledTimes(1);
	expect(mockPurchase).not.toHaveBeenCalled();
	expect(mockRefreshPaidAccess).toHaveBeenCalledTimes(4);
	expect(mockReplace).toHaveBeenCalledWith("/home");
});

test("cancels scheduled activation retries when leaving the screen", async () => {
	jest.useFakeTimers();
	mockRefreshPaidAccess.mockResolvedValue(false);
	const screen = await render(<SubscriptionScreen />);
	await act(async () => {
		await fireEvent.press(screen.getByTestId("subscription-checkout-button"));
	});
	await screen.unmount();
	await act(async () => {
		await jest.advanceTimersByTimeAsync(10000);
	});
	expect(mockRefreshPaidAccess).toHaveBeenCalledTimes(1);
	expect(mockReplace).not.toHaveBeenCalled();
});

test("does not mistake a trial for activated paid access", async () => {
	jest.useFakeTimers();
	mockAccess = { state: "trial" };
	mockRefreshPaidAccess.mockResolvedValue(false);
	const screen = await render(<SubscriptionScreen />);
	await act(async () => {
		await fireEvent.press(screen.getByTestId("subscription-checkout-button"));
	});
	expect(mockReplace).not.toHaveBeenCalled();
	await screen.unmount();
});

test("releases manual retry after access requests time out without backend updates", async () => {
	jest.useFakeTimers();
	mockRefreshPaidAccess.mockImplementation(() => new Promise(() => {}));
	const screen = await render(<SubscriptionScreen />);
	await act(async () => {
		await fireEvent.press(screen.getByTestId("subscription-checkout-button"));
	});
	await act(async () => {
		await jest.advanceTimersByTimeAsync(35000);
	});
	expect(mockRefreshPaidAccess).toHaveBeenCalledTimes(3);
	expect(screen.getByTestId("subscription-checkout-button")).toBeEnabled();
	mockRefreshPaidAccess.mockResolvedValue(true);
	await act(async () => {
		await fireEvent.press(screen.getByText("Zugang erneut prüfen"));
	});
	expect(mockPurchase).toHaveBeenCalledTimes(1);
	expect(mockReplace).toHaveBeenCalledWith("/subscription-success");
});
