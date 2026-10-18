import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { TrialActivationScreen } from "./trial-activation-screen";

const mockTrackFeature = jest.fn();
jest.mock("~/lib/use-feature-analytics", () => ({
	useFeatureAnalytics: () => mockTrackFeature,
}));
jest.mock("~/components/ui/icon", () => ({
	Bell: () => null,
	Check: () => null,
	SquareLock: () => null,
}));

const mockActivateTrial = jest.fn(async (_termsVersion: string) => undefined);
let mockInsets = { bottom: 34, left: 0, right: 0, top: 59 };

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
	useSafeAreaInsets: () => mockInsets,
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
		mockInsets = { bottom: 34, left: 0, right: 0, top: 59 };
	});

	test("updates the viewport when system insets change without losing an activation error", async () => {
		mockActivateTrial.mockRejectedValueOnce(new Error("offline"));
		const screen = await render(<TrialActivationScreen />);
		await fireEvent.press(
			screen.getByRole("button", { name: "Dayova starten" }),
		);
		await screen.findByRole("alert");

		mockInsets = { top: 24, bottom: 48, left: 8, right: 12 };
		await screen.rerender(<TrialActivationScreen />);
		expect(screen.getByRole("alert")).toHaveTextContent(
			"Deine Testphase konnte nicht gestartet werden.",
		);
	});

	test("announces an activation failure through the shared error contract", async () => {
		mockActivateTrial.mockRejectedValueOnce(new Error("offline"));
		const screen = await render(<TrialActivationScreen />);

		await fireEvent.press(
			screen.getByRole("button", { name: "Dayova starten" }),
		);

		expect(mockTrackFeature).toHaveBeenCalledWith("trial.start", "attempted");
		expect(mockTrackFeature).toHaveBeenCalledWith("trial.start", "failed");
		expect(mockTrackFeature).not.toHaveBeenCalledWith(
			"trial.start",
			"succeeded",
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
