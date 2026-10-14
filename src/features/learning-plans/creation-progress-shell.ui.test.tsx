import { expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import {
	LearningPlanCreationProgressShell,
	useLearningPlanCreationProgress,
} from "./creation-progress-shell";

// Model Expo UI's native button boundary; SwiftUI applies these modifiers on device.
jest.mock("@expo/ui", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const { Pressable, View } =
		jest.requireActual<typeof import("react-native")>("react-native");
	return {
		Host: View,
		RNHostView: View,
		Button: ({
			children,
			modifiers,
			disabled,
			onPress,
		}: {
			children: React.ReactNode;
			modifiers: Array<{ $type: string; label?: string }>;
			disabled?: boolean;
			onPress: () => void;
		}) =>
			React.createElement(
				Pressable,
				{
					accessible: true,
					accessibilityRole: "button",
					accessibilityLabel: modifiers.find(
						(modifier) => modifier.$type === "accessibilityLabel",
					)?.label,
					accessibilityState: { disabled },
					disabled,
					onPress,
				},
				children,
			),
	};
});
jest.mock("expo-router", () => ({ useIsFocused: () => true }));
jest.mock("react-native-safe-area-context", () => ({
	useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("~/components/ui/themed-status-bar", () => ({
	ThemedStatusBar: () => null,
}));
jest.mock("~/components/ui/flow-progress-bar", () => ({
	FlowProgressBar:
		jest.requireActual<typeof import("react-native")>("react-native").View,
}));
jest.mock("~/components/ui/icon", () => ({
	ArrowLeft: () => null,
	X: () => null,
}));
jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({ colors: { text: "#ffffff", path3: "#8A8D92" } }),
}));

function Step(props: {
	onBack: () => void;
	onClose: () => void;
	closeDisabled?: boolean;
}) {
	useLearningPlanCreationProgress({ active: true, currentStep: 2, ...props });
	return null;
}

test("routes the visible back and close controls to the current step and retains accessible progress", async () => {
	const onBack = jest.fn();
	const onClose = jest.fn();
	const nextClose = jest.fn();
	const screen = await render(
		<LearningPlanCreationProgressShell>
			<Step onBack={onBack} onClose={onClose} />
		</LearningPlanCreationProgressShell>,
	);
	expect(screen.getByRole("progressbar")).toHaveAccessibilityValue({
		min: 0,
		max: 100,
		now: 40,
	});
	await fireEvent.press(screen.getByRole("button", { name: "Zurück" }));
	expect(onBack).toHaveBeenCalledTimes(1);
	await fireEvent.press(screen.getByRole("button", { name: "Schließen" }));
	expect(onClose).toHaveBeenCalledTimes(1);

	await screen.rerender(
		<LearningPlanCreationProgressShell>
			<Step onBack={onBack} onClose={nextClose} />
		</LearningPlanCreationProgressShell>,
	);
	await fireEvent.press(screen.getByRole("button", { name: "Schließen" }));
	expect(nextClose).toHaveBeenCalledTimes(1);
	expect(onClose).toHaveBeenCalledTimes(1);

	await screen.rerender(
		<LearningPlanCreationProgressShell>
			<Step onBack={onBack} onClose={nextClose} closeDisabled />
		</LearningPlanCreationProgressShell>,
	);
	expect(screen.getByRole("button", { name: "Schließen" })).toBeDisabled();
	await fireEvent.press(screen.getByRole("button", { name: "Schließen" }));
	expect(nextClose).toHaveBeenCalledTimes(1);
});
