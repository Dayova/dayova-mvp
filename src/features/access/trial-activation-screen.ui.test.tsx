import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { SEMANTIC_HEADING_MAX_FONT_SIZE_MULTIPLIER } from "~/lib/content-size-layout";
import { TrialActivationScreen } from "./trial-activation-screen";

const mockActivateTrial = jest.fn(async (_termsVersion: string) => undefined);

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
		access: null,
		activateTrial: mockActivateTrial,
	}),
}));

jest.mock("~/lib/runtime-config", () => ({
	env: {
		EXPO_PUBLIC_PRIVACY_URL: "https://dayova.de/datenschutz",
		EXPO_PUBLIC_TERMS_URL: "https://dayova.de/nutzungsbedingungen",
	},
}));

describe("TrialActivationScreen", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockActivateTrial.mockResolvedValue(undefined);
	});

	test("uses shared semantic-heading scaling for the trial title", async () => {
		const screen = await render(<TrialActivationScreen />);

		expect(screen.getByText("So läuft deine Testphase")).toHaveProp(
			"maxFontSizeMultiplier",
			SEMANTIC_HEADING_MAX_FONT_SIZE_MULTIPLIER,
		);
	});

	test("announces an activation failure through the shared error contract", async () => {
		mockActivateTrial.mockRejectedValueOnce(new Error("offline"));
		const screen = await render(<TrialActivationScreen />);

		await fireEvent.press(
			screen.getByRole("button", { name: "Dayova starten" }),
		);

		await waitFor(() => {
			const error = screen.getByRole("alert", {
				name: "Deine Testphase konnte nicht gestartet werden.",
			});
			expect(error).toHaveProp("accessibilityLiveRegion", "polite");
			expect(error).toHaveProp("selectable", true);
		});
	});
});
