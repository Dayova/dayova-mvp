import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { PaywallScreen } from "./paywall-screen";

const mockPush = jest.fn();

beforeEach(() => {
	jest.clearAllMocks();
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

jest.mock("~/components/ui/confirmation-sheet", () => ({
	ConfirmationSheet: () => null,
}));

jest.mock("~/context/AuthContext", () => ({
	useAccountActions: () => ({
		logout: jest.fn(),
	}),
}));

jest.mock("~/lib/runtime-config", () => ({
	env: {},
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
		expect(screen.getByTestId("paywall-utility-surface").props.style).toEqual(
			expect.objectContaining({
				backgroundColor: "#F1F7FB",
				borderColor: "#4FD8FF",
			}),
		);
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
});
