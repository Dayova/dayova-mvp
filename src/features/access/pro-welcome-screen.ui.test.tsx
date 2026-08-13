import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { ProWelcomeScreen } from "./pro-welcome-screen";

const mockReplace = jest.fn();

beforeEach(() => {
	jest.clearAllMocks();
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

jest.mock("~/lib/safe-haptics", () => ({
	triggerSuccessHaptic: jest.fn(async () => undefined),
}));

describe("ProWelcomeScreen", () => {
	test("celebrates the unlocked subscription in the paywall visual language", async () => {
		const screen = await render(<ProWelcomeScreen />);

		expect(screen.getByText("DAYOVA PRO")).toBeOnTheScreen();
		expect(screen.getByRole("header")).toHaveTextContent(
			"Willkommen bei Dayova Pro",
		);
		expect(screen.getByText("Alles freigeschaltet")).toBeOnTheScreen();
		expect(
			screen.getByText("Dein Lernstand bleibt vollständig erhalten"),
		).toBeOnTheScreen();
		expect(
			screen.getByTestId("pro-welcome-confirmation-card").props.style,
		).toEqual(
			expect.objectContaining({
				backgroundColor: "#FFFFFF",
				borderColor: "#4FD8FF",
			}),
		);
	});

	test("continues to the dashboard without returning to checkout", async () => {
		const screen = await render(<ProWelcomeScreen />);

		fireEvent.press(screen.getByRole("button", { name: "Jetzt loslernen" }));
		expect(mockReplace).toHaveBeenCalledWith("/home");
	});
});
