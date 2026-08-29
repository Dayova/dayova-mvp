import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { PaywallScreen } from "./paywall-screen";

const mockPush = jest.fn();
const mockLogout = jest.fn();
const mockSubscriptionManagementSheet: {
	onDismiss: null | (() => void);
	returnFocusRef: null | { current: unknown };
} = {
	onDismiss: null,
	returnFocusRef: null,
};

beforeEach(() => {
	jest.clearAllMocks();
	mockSubscriptionManagementSheet.onDismiss = null;
	mockSubscriptionManagementSheet.returnFocusRef = null;
});

jest.mock("@clerk/expo", () => ({
	useUser: () => ({
		user: {
			delete: jest.fn(),
		},
	}),
}));

jest.mock("expo-router", () => ({
	useRouter: () => ({ push: mockPush }),
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

jest.mock("~/components/ui/confirmation-sheet", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const { Text: NativeText } =
		jest.requireActual<typeof import("react-native")>("react-native");
	return {
		ConfirmationSheet: ({
			title,
			visible,
		}: {
			title: ReactNode;
			visible: boolean;
		}) => (visible ? React.createElement(NativeText, null, title) : null),
	};
});

jest.mock("~/components/ui/dayova-sheet-frame", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const { Text: NativeText, View: NativeView } =
		jest.requireActual<typeof import("react-native")>("react-native");
	return {
		DayovaSheetFrame: ({
			children,
			description,
			onDismiss,
			returnFocusRef,
			title,
			visible,
		}: {
			children?: ReactNode;
			description?: ReactNode;
			onDismiss?: () => void;
			returnFocusRef?: { current: unknown };
			title?: ReactNode;
			visible: boolean;
		}) => {
			mockSubscriptionManagementSheet.onDismiss = onDismiss ?? null;
			mockSubscriptionManagementSheet.returnFocusRef = returnFocusRef ?? null;

			if (!visible) return null;
			return React.createElement(
				NativeView,
				null,
				title ? React.createElement(NativeText, null, title) : null,
				description ? React.createElement(NativeText, null, description) : null,
				children,
			);
		},
	};
});

jest.mock("~/context/AuthContext", () => ({
	useAccountActions: () => ({
		logout: mockLogout,
	}),
}));

jest.mock("~/lib/runtime-config", () => ({
	env: {
		EXPO_PUBLIC_NATIVE_STORE_PURCHASES_ENABLED: "true",
		EXPO_PUBLIC_PARENT_CHECKOUT_URL: "https://dayova.com/kasse",
	},
}));

describe("PaywallScreen", () => {
	test("keeps the expired-trial page focused on choosing a payer", async () => {
		const screen = await render(<PaywallScreen />);

		expect(screen.getByText("TESTPHASE BEENDET")).toBeOnTheScreen();
		expect(
			screen.getByText(
				"Dein Lernstand bleibt erhalten. Wähle jetzt, wie du mit Dayova weitermachen möchtest.",
			),
		).toBeOnTheScreen();
		expect(screen.getByText("Zugang freischalten")).toBeOnTheScreen();
		expect(screen.queryByText("Tarif wählen")).not.toBeOnTheScreen();
		for (const testID of ["payer-self-action", "payer-parent-action"]) {
			expect(screen.getByTestId(testID).props.style).toEqual(
				expect.objectContaining({
					backgroundColor: "#FFFFFF",
					borderColor: "#FFFFFF",
				}),
			);
			expect(screen.getByTestId(testID).props.className).toContain("shadow-md");
		}
		expect(screen.getAllByText("SOFORT STARTEN")).toHaveLength(2);
		expect(
			screen.getByRole("link", { name: "Abo verwalten" }),
		).toBeOnTheScreen();
		expect(screen.queryByText("Konto wechseln")).toBeNull();
	});

	test("opens the separate subscription page for the chosen payer", async () => {
		const screen = await render(<PaywallScreen />);

		await fireEvent.press(
			screen.getByLabelText(
				"Meine Eltern zahlen. Zahlungslink oder QR-Code teilen",
			),
		);
		expect(mockPush).toHaveBeenLastCalledWith({
			pathname: "/subscription",
			params: { payer: "parent" },
		});

		await fireEvent.press(
			screen.getByLabelText(
				"Ich zahle selbst. Direkt im App Store oder bei Google Play",
			),
		);
		expect(mockPush).toHaveBeenLastCalledWith({
			pathname: "/subscription",
			params: { payer: "self" },
		});
		expect(screen.queryByText("Tarif wählen")).not.toBeOnTheScreen();
	});

	test("shows only web purchase redemption when no in-app checkout is released", async () => {
		const screen = await render(
			<PaywallScreen
				nativeStorePurchasesEnabled={false}
				parentPaymentEnabled={false}
			/>,
		);

		expect(screen.queryByTestId("payer-self-action")).toBeNull();
		expect(screen.queryByTestId("payer-parent-action")).toBeNull();
		expect(screen.getByTestId("redemption-only-state")).toBeOnTheScreen();
		expect(screen.getByText("Abo bereits gekauft?")).toBeOnTheScreen();
		expect(
			screen.getByText(
				"Dein Lernstand bleibt erhalten. Ein bereits gekauftes Dayova-Abo verbindest du mit deinem persönlichen Einlöse-Link.",
			),
		).toBeOnTheScreen();
	});

	test("moves account actions into subscription management", async () => {
		const screen = await render(<PaywallScreen />);

		fireEvent.press(screen.getByRole("link", { name: "Abo verwalten" }));

		expect(await screen.findByText("Konto wechseln")).toBeOnTheScreen();
		expect(screen.queryByText("Gut zu wissen")).toBeNull();
		expect(
			screen.getByLabelText("Abmelden oder Konto wechseln"),
		).toBeOnTheScreen();
		expect(screen.getByText("Konto löschen")).toBeOnTheScreen();

		await act(async () => {
			fireEvent.press(screen.getByLabelText("Abmelden oder Konto wechseln"));
		});
		expect(screen.queryByText("Konto wechseln")).toBeNull();
		expect(mockLogout).not.toHaveBeenCalled();

		await act(async () => {
			mockSubscriptionManagementSheet.onDismiss?.();
		});
		expect(mockLogout).toHaveBeenCalledTimes(1);
	});

	test("returns focus to the subscription management link", async () => {
		const screen = await render(<PaywallScreen />);

		fireEvent.press(screen.getByRole("link", { name: "Abo verwalten" }));
		expect(await screen.findByText("Konto wechseln")).toBeOnTheScreen();

		expect(mockSubscriptionManagementSheet.returnFocusRef).not.toBeNull();
		expect(
			mockSubscriptionManagementSheet.returnFocusRef?.current,
		).not.toBeNull();
	});

	test("keeps account deletion behind a separate confirmation", async () => {
		const screen = await render(<PaywallScreen />);

		fireEvent.press(screen.getByRole("link", { name: "Abo verwalten" }));
		const deleteAccountButton = await screen.findByText("Konto löschen");
		await act(async () => {
			fireEvent.press(deleteAccountButton);
		});
		expect(screen.queryByText("Konto wirklich löschen?")).toBeNull();

		await act(async () => {
			mockSubscriptionManagementSheet.onDismiss?.();
		});

		await waitFor(() => {
			expect(screen.getByText("Konto wirklich löschen?")).toBeOnTheScreen();
		});
	});
});
