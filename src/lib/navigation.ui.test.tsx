import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { TouchableOpacity } from "react-native";
import { useBackIntent } from "./navigation";

type BeforeRemoveEvent = {
	data: { action: { type: string } };
	preventDefault: jest.Mock;
};

let beforeRemoveListener: ((event: BeforeRemoveEvent) => void) | undefined;
const mockAddListener = jest.fn(
	(_eventName: string, listener: (event: BeforeRemoveEvent) => void) => {
		beforeRemoveListener = listener;
		return jest.fn();
	},
);

jest.mock("expo-router/react-navigation", () => {
	const React = jest.requireActual<typeof import("react")>("react");

	return {
		useFocusEffect: (effect: React.EffectCallback) =>
			React.useEffect(effect, [effect]),
		useNavigation: () => ({ addListener: mockAddListener }),
	};
});

const createBackEvent = (): BeforeRemoveEvent => ({
	data: { action: { type: "GO_BACK" } },
	preventDefault: jest.fn(),
});

function BackIntentHarness({ onBack }: { onBack: () => boolean }) {
	const invokeBack = useBackIntent(true, onBack);
	return <TouchableOpacity testID="back-button" onPress={invokeBack} />;
}

describe("useBackIntent", () => {
	beforeEach(() => {
		beforeRemoveListener = undefined;
		mockAddListener.mockClear();
		global.requestAnimationFrame = jest.fn(() => 1);
	});

	test("allows the router.back event triggered by a custom back handler", async () => {
		const nestedEvent = createBackEvent();
		const onBack = jest.fn(() => {
			beforeRemoveListener?.(nestedEvent);
			return true;
		});
		await render(<BackIntentHarness onBack={onBack} />);
		const originalEvent = createBackEvent();

		beforeRemoveListener?.(originalEvent);

		expect(onBack).toHaveBeenCalledTimes(1);
		expect(nestedEvent.preventDefault).not.toHaveBeenCalled();
		expect(originalEvent.preventDefault).toHaveBeenCalledTimes(1);
	});

	test("allows a custom back button to perform exactly one navigation", async () => {
		const nestedEvent = createBackEvent();
		const onBack = jest.fn(() => {
			beforeRemoveListener?.(nestedEvent);
			return true;
		});
		const screen = await render(<BackIntentHarness onBack={onBack} />);

		fireEvent.press(screen.getByTestId("back-button"));

		expect(onBack).toHaveBeenCalledTimes(1);
		expect(nestedEvent.preventDefault).not.toHaveBeenCalled();
	});
});
