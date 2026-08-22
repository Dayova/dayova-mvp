import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import {
	captureRevenueCatRedemptionUrl,
	getPendingRevenueCatRedemptionUrl,
	resetRevenueCatRedemptionForTests,
} from "~/lib/revenuecat-redemption";
import { RevenueCatRedemptionSync } from "./revenuecat-redemption-sync";

const redemptionUrl =
	"rc-abc123://redeem_web_purchase?redemption_token=secret-token";
const mockReplace = jest.fn();
const mockRefreshPaidAccess = jest.fn<() => Promise<boolean>>();
const mockRedeemWebPurchase =
	jest.fn<
		() => Promise<
			{ status: "redeemed" } | { status: "expired"; obfuscatedEmail: string }
		>
	>();
const mockCreateNativeRevenueCatClient = jest.fn(
	(_options: { apiKey: string; appUserId: string }) => ({
		redeemWebPurchase: mockRedeemWebPurchase,
	}),
);

let mockUser: { clerkId: string } | null;
let mockIsConvexUserSynced: boolean;

beforeEach(() => {
	jest.clearAllMocks();
	resetRevenueCatRedemptionForTests();
	mockUser = { clerkId: "clerk_user_1" };
	mockIsConvexUserSynced = true;
	mockRedeemWebPurchase.mockResolvedValue({ status: "redeemed" });
	mockRefreshPaidAccess.mockResolvedValue(true);
});

jest.mock("expo-router", () => ({
	useRouter: () => ({ replace: mockReplace }),
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
	useAuthSession: () => ({
		user: mockUser,
		isConvexUserSynced: mockIsConvexUserSynced,
	}),
}));

jest.mock("~/lib/diagnostics", () => ({
	logDiagnosticError: jest.fn(),
}));

jest.mock("~/lib/revenuecat-client", () => ({
	createNativeRevenueCatClient: (options: {
		apiKey: string;
		appUserId: string;
	}) => mockCreateNativeRevenueCatClient(options),
}));

jest.mock("~/lib/runtime-config", () => ({
	env: {
		EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY: "goog_test",
		EXPO_PUBLIC_REVENUECAT_IOS_API_KEY: "appl_test",
	},
}));

describe("RevenueCatRedemptionSync", () => {
	test("redeems for the signed-in Clerk account and verifies Convex access", async () => {
		captureRevenueCatRedemptionUrl(redemptionUrl);
		await render(<RevenueCatRedemptionSync />);
		await waitFor(() =>
			expect(mockRedeemWebPurchase).toHaveBeenCalledWith(redemptionUrl),
		);
		await waitFor(() => expect(mockRefreshPaidAccess).toHaveBeenCalledTimes(1));
		await waitFor(() =>
			expect(mockReplace).toHaveBeenCalledWith("/pro-welcome"),
		);
		expect(mockCreateNativeRevenueCatClient).toHaveBeenCalledWith({
			apiKey: expect.any(String),
			appUserId: "clerk_user_1",
		});
		expect(getPendingRevenueCatRedemptionUrl()).toBeNull();
	});

	test("waits for authentication without persisting or discarding the link", async () => {
		mockUser = null;
		captureRevenueCatRedemptionUrl(redemptionUrl);
		const screen = await render(<RevenueCatRedemptionSync />);

		expect(screen.queryByTestId("revenuecat-redemption-overlay")).toBeNull();
		expect(mockCreateNativeRevenueCatClient).not.toHaveBeenCalled();
		expect(getPendingRevenueCatRedemptionUrl()).toBe(redemptionUrl);

		mockUser = { clerkId: "clerk_user_1" };
		await screen.rerender(<RevenueCatRedemptionSync />);
		await waitFor(() => expect(mockRedeemWebPurchase).toHaveBeenCalled());
	});

	test("explains that RevenueCat emailed a replacement for an expired link", async () => {
		mockRedeemWebPurchase.mockResolvedValue({
			status: "expired",
			obfuscatedEmail: "f***@example.com",
		});
		captureRevenueCatRedemptionUrl(redemptionUrl);
		const screen = await render(<RevenueCatRedemptionSync />);

		await waitFor(() =>
			expect(
				screen.getByRole("header", { name: "Einlöse-Link abgelaufen" }),
			).toBeOnTheScreen(),
		);
		expect(screen.getByText(/f\*\*\*@example.com/)).toBeOnTheScreen();
		expect(mockRefreshPaidAccess).not.toHaveBeenCalled();

		fireEvent.press(screen.getByRole("button", { name: "Verstanden" }));
		await waitFor(() =>
			expect(screen.queryByTestId("revenuecat-redemption-overlay")).toBeNull(),
		);
	});

	test("retries only Convex verification after RevenueCat already redeemed", async () => {
		mockRefreshPaidAccess
			.mockResolvedValueOnce(false)
			.mockResolvedValueOnce(true);
		captureRevenueCatRedemptionUrl(redemptionUrl);
		const screen = await render(<RevenueCatRedemptionSync />);

		await waitFor(() => expect(mockRefreshPaidAccess).toHaveBeenCalled());
		expect(mockRefreshPaidAccess).toHaveBeenCalledTimes(1);
		expect(mockReplace).not.toHaveBeenCalled();
		await waitFor(() =>
			expect(
				screen.getByRole("header", {
					name: "Kauf bestätigt, Zugang noch nicht aktualisiert",
				}),
			).toBeOnTheScreen(),
		);
		await act(async () => {
			fireEvent.press(screen.getByRole("button", { name: "Erneut versuchen" }));
		});

		await waitFor(() => expect(mockRefreshPaidAccess).toHaveBeenCalledTimes(2));
		expect(mockRedeemWebPurchase).toHaveBeenCalledTimes(1);
		await waitFor(() =>
			expect(mockReplace).toHaveBeenCalledWith("/pro-welcome"),
		);
	});
});
