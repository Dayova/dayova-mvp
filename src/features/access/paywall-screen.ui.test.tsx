import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { PaywallScreen } from "./paywall-screen";

const mockGetPlans = jest.fn(async () => []);
let mockStoreInitializationError: Error | null = null;

beforeEach(() => {
	jest.clearAllMocks();
	mockGetPlans.mockResolvedValue([]);
	mockStoreInitializationError = null;
});

jest.mock("@clerk/expo", () => ({
	useUser: () => ({
		user: {
			delete: jest.fn(),
		},
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

jest.mock("~/components/ui/confirmation-sheet", () => ({
	ConfirmationSheet: () => null,
}));

jest.mock("~/context/AccessContext", () => ({
	useAccess: () => ({
		access: null,
		refreshPaidAccess: jest.fn(),
	}),
}));

jest.mock("~/context/AuthContext", () => ({
	useAccountActions: () => ({
		logout: jest.fn(),
	}),
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

describe("PaywallScreen", () => {
	test("presents the expired trial as a focused payer decision", async () => {
		const screen = await render(<PaywallScreen />);

		expect(screen.getByText("TESTPHASE BEENDET")).toBeOnTheScreen();
		expect(
			screen.getByText(
				"Dein Lernstand bleibt erhalten. Wähle jetzt, wie du mit Dayova weitermachen möchtest.",
			),
		).toBeOnTheScreen();
		expect(screen.getByText("Zugang freischalten")).toBeOnTheScreen();
		expect(screen.queryByText("Tarif wählen")).not.toBeOnTheScreen();
		expect(screen.getByTestId("paywall-utility-surface").props.style).toEqual(
			expect.objectContaining({
				backgroundColor: "#F1F7FB",
				borderColor: "#4FD8FF",
			}),
		);
	});

	test("expands the store plans below the selected self-payment path", async () => {
		let resolvePlans: (plans: never[]) => void = () => undefined;
		mockGetPlans.mockImplementation(
			() =>
				new Promise((resolve) => {
					resolvePlans = resolve;
				}),
		);
		const screen = await render(<PaywallScreen />);
		const selfPayment = screen.getByLabelText(
			"Ich zahle selbst. Direkt im App Store oder bei Google Play",
		);

		await fireEvent.press(selfPayment);
		await fireEvent.press(selfPayment);
		expect(mockGetPlans).toHaveBeenCalledTimes(1);

		await act(async () => {
			resolvePlans([]);
		});
		await waitFor(() => {
			expect(screen.getByText("Tarif wählen")).toBeOnTheScreen();
		});
		expect(selfPayment.props.accessibilityState).toEqual({ selected: true });
		expect(selfPayment.props.style).toEqual(
			expect.objectContaining({
				backgroundColor: "#F1F7FB",
				borderColor: "#00A0E6",
			}),
		);
		expect(screen.getByTestId("paywall-payment-surface").props.style).toEqual(
			expect.objectContaining({
				backgroundColor: "#FFFFFF",
				borderColor: "#4FD8FF",
			}),
		);
		expect(
			screen.getByRole("radio", { name: /Jährlich/ }).props.accessibilityState,
		).toEqual({
			checked: false,
		});
		expect(
			screen.getByRole("radio", { name: /Monatlich/ }).props.accessibilityState,
		).toEqual({ checked: true });
	});

	test("keeps the paywall usable when the native store client cannot start", async () => {
		mockStoreInitializationError = new Error("native module unavailable");
		const screen = await render(<PaywallScreen />);

		await fireEvent.press(
			screen.getByLabelText(
				"Ich zahle selbst. Direkt im App Store oder bei Google Play",
			),
		);

		expect(
			await screen.findAllByText(
				"Store-Käufe konnten auf diesem Gerät nicht gestartet werden. Bitte öffne die App erneut oder kontaktiere den Support.",
			),
		).not.toHaveLength(0);
	});
});
