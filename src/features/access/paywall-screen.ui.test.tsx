import { describe, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { PaywallScreen } from "./paywall-screen";

const mockGetPlans = jest.fn(async () => []);

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
	createNativeRevenueCatClient: () => ({
		getPlans: mockGetPlans,
		purchase: jest.fn(),
		restore: jest.fn(),
	}),
}));

jest.mock("~/lib/runtime-config", () => ({
	env: {
		EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY: "android_test_key",
		EXPO_PUBLIC_REVENUECAT_IOS_API_KEY: "ios_test_key",
	},
}));

jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		colors: {
			background: "#F6F6F4",
			border: "#DCE6EE",
			buttonNeutral: "#1A1A1A",
			destructive: "#FF3B30",
			primary: "#00BAFF",
			primaryStrong: "#00A0E6",
			secondaryText: "#697586",
			success: "#34C759",
			successSubtle: "#EAFFF1",
			surface: "#FFFFFF",
			systemSubtle: "#F1F7FB",
			text: "#1A1A1A",
		},
	}),
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
	});

	test("expands the store plans below the selected self-payment path", async () => {
		const screen = await render(<PaywallScreen />);
		const selfPayment = screen.getByLabelText(
			"Ich zahle selbst. Direkt im App Store oder bei Google Play",
		);

		await act(async () => {
			fireEvent.press(selfPayment);
		});

		await waitFor(() => {
			expect(screen.getByText("Tarif wählen")).toBeOnTheScreen();
			expect(mockGetPlans).toHaveBeenCalled();
		});
		expect(selfPayment.props.accessibilityState).toEqual({ selected: true });
		expect(
			screen.getByRole("radio", { name: /Jährlich/ }).props.accessibilityState,
		).toEqual({
			checked: false,
		});
		expect(
			screen.getByRole("radio", { name: /Monatlich/ }).props.accessibilityState,
		).toEqual({ checked: true });
	});
});
