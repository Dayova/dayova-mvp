import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { AiConsentSheet } from "./ai-consent-sheet";

jest.mock("~/components/ui/dayova-sheet-frame", () => ({
	DayovaSheetFrame: (() => {
		const React = jest.requireActual<typeof import("react")>("react");
		const Native =
			jest.requireActual<typeof import("react-native")>("react-native");
		return ({
			children,
			description,
			footer,
			title,
			visible,
		}: {
			children?: ReactNode;
			description?: ReactNode;
			footer?: ReactNode;
			title?: ReactNode;
			visible: boolean;
		}) =>
			visible
				? React.createElement(
						Native.View,
						{ accessibilityViewIsModal: true },
						React.createElement(Native.Text, null, title),
						React.createElement(Native.Text, null, description),
						children,
						footer,
					)
				: null;
	})(),
}));

jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({ colors: { primary: "#00A0E6" } }),
}));

jest.mock("~/components/ui/icon", () => ({
	Sparkles: () => {
		const React = jest.requireActual<typeof import("react")>("react");
		const Native =
			jest.requireActual<typeof import("react-native")>("react-native");
		return React.createElement(Native.View);
	},
}));

const renderSheet = (
	overrides: Partial<React.ComponentProps<typeof AiConsentSheet>> = {},
) => {
	const props: React.ComponentProps<typeof AiConsentSheet> = {
		visible: true,
		mode: "required",
		hasCurrentConsent: false,
		isBusy: false,
		errorMessage: null,
		onAccept: jest.fn(),
		onDecline: jest.fn(),
		onWithdraw: jest.fn(),
		onClose: jest.fn(),
		onOpenPrivacy: jest.fn(),
		...overrides,
	};
	return { props, screen: render(<AiConsentSheet {...props} />) };
};

describe("AiConsentSheet", () => {
	test("names the AI recipient, data categories, purpose, and both choices", async () => {
		const { props, screen: pendingScreen } = renderSheet();
		const screen = await pendingScreen;

		expect(screen.getByText("KI-Verarbeitung erlauben?")).toBeOnTheScreen();
		expect(screen.getByText("Google Cloud Vertex AI")).toBeOnTheScreen();
		expect(
			screen.getByText(/Inhalte und Dateinamen deiner Lernmaterialien/),
		).toBeOnTheScreen();
		expect(
			screen.getByText(/Nur um deinen Lernplan, Diagnosefragen/),
		).toBeOnTheScreen();
		expect(
			screen.getByText(/Ohne deine Zustimmung sendet Dayova keine Daten/),
		).toBeOnTheScreen();

		await fireEvent.press(
			screen.getByRole("button", { name: "Zustimmen und fortfahren" }),
		);
		await fireEvent.press(
			screen.getByRole("button", { name: "Nicht zustimmen" }),
		);
		await fireEvent.press(
			screen.getByRole("button", { name: "Mehr zum Datenschutz" }),
		);
		expect(props.onAccept).toHaveBeenCalledTimes(1);
		expect(props.onDecline).toHaveBeenCalledTimes(1);
		expect(props.onOpenPrivacy).toHaveBeenCalledTimes(1);
	});

	test("lets a user withdraw an existing consent from settings", async () => {
		const { props, screen: pendingScreen } = renderSheet({
			mode: "manage",
			hasCurrentConsent: true,
		});
		const screen = await pendingScreen;

		expect(screen.getByText(/Du hast Dayova erlaubt/)).toBeOnTheScreen();
		await fireEvent.press(
			screen.getByRole("button", { name: "Zustimmung widerrufen" }),
		);
		expect(props.onWithdraw).toHaveBeenCalledTimes(1);
	});
});
