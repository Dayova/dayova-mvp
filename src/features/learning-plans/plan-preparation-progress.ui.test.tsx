import { expect, jest, test } from "@jest/globals";
import { render } from "@testing-library/react-native";
import { PlanPreparationProgress } from "./plan-preparation-progress";

jest.mock("react-native-reanimated", () => ({ useReducedMotion: () => true }));
jest.mock("~/components/ui/animated-flower-loader", () => ({
	AnimatedFlowerLoader: () => null,
}));
jest.mock("~/components/ui/flow-progress-bar", () => ({
	FlowProgressBar:
		jest.requireActual<typeof import("react-native")>("react-native").View,
}));
jest.mock("~/components/ui/icon", () => ({ Check: () => null }));
jest.mock("~/components/ui/surface", () => ({
	Surface:
		jest.requireActual<typeof import("react-native")>("react-native").View,
}));
jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		colors: { primary: "#00A0E6", onPrimary: "#FFFFFF" },
	}),
}));

test("exposes estimated progress and announces stage, completion, and interruption", async () => {
	const screen = await render(<PlanPreparationProgress stage={0} />);
	const progress = () => screen.getByRole("progressbar");
	const status = () => screen.getByRole("header");
	expect(progress()).toHaveAccessibilityValue({ min: 0, max: 3, now: 0 });
	expect(status()).toHaveProp("accessibilityLiveRegion", "polite");
	expect(status()).toHaveProp("accessibilityState", { busy: true });
	await screen.rerender(<PlanPreparationProgress stage={1} />);
	expect(progress()).toHaveAccessibilityValue({ min: 0, max: 3, now: 1 });
	expect(status()).toHaveProp(
		"accessibilityLabel",
		"Dein Lernplan entsteht. Prüfungsstoff zusammenstellen",
	);
	await screen.rerender(<PlanPreparationProgress stage={1} failed />);
	expect(status()).toHaveProp("accessibilityState", { busy: false });
	expect(status()).toHaveProp(
		"accessibilityLabel",
		"Dein Lernplan entsteht. Vorbereitung unterbrochen",
	);
	await screen.rerender(<PlanPreparationProgress stage={3} />);
	expect(progress()).toHaveAccessibilityValue({ min: 0, max: 3, now: 3 });
	expect(status()).toHaveProp("accessibilityState", { busy: false });
	expect(status()).toHaveProp(
		"accessibilityLabel",
		"Dein Lernplan entsteht. Vorbereitung abgeschlossen",
	);
});
