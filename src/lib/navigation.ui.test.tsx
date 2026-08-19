import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, renderHook } from "@testing-library/react-native";
import { useBackIntent } from "./navigation";

type BeforeRemoveEvent = {
	data: { action: { type: string } };
	preventDefault: jest.Mock;
};

type BeforeRemoveListener = (event: BeforeRemoveEvent) => void;

let mockBeforeRemoveListener: BeforeRemoveListener | undefined;
const mockAddListener = jest.fn(
	(_eventName: string, listener: BeforeRemoveListener) => {
		mockBeforeRemoveListener = listener;
		return jest.fn();
	},
);

jest.mock("expo-router/react-navigation", () => ({
	useFocusEffect: (effect: () => undefined | (() => void)) => effect(),
	useNavigation: () => ({ addListener: mockAddListener }),
}));

const createBeforeRemoveEvent = (): BeforeRemoveEvent => ({
	data: { action: { type: "GO_BACK" } },
	preventDefault: jest.fn(),
});

describe("useBackIntent", () => {
	beforeEach(() => {
		mockBeforeRemoveListener = undefined;
		mockAddListener.mockClear();
		global.requestAnimationFrame = jest.fn(() => 1);
	});

	test("allows a back action started by the custom back control to remove the route", async () => {
		const removalEvent = createBeforeRemoveEvent();
		const onBack = jest.fn(() => {
			mockBeforeRemoveListener?.(removalEvent);
			return true;
		});
		const hook = await renderHook(() => useBackIntent(true, onBack));

		await act(async () => {
			hook.result.current();
		});

		expect(onBack).toHaveBeenCalledTimes(1);
		expect(removalEvent.preventDefault).not.toHaveBeenCalled();
	});

	test("handles a native back action once while allowing its replacement navigation", async () => {
		const replacementRemovalEvent = createBeforeRemoveEvent();
		const onBack = jest.fn(() => {
			mockBeforeRemoveListener?.(replacementRemovalEvent);
			return true;
		});
		await renderHook(() => useBackIntent(true, onBack));
		const nativeRemovalEvent = createBeforeRemoveEvent();

		await act(async () => {
			mockBeforeRemoveListener?.(nativeRemovalEvent);
		});

		expect(onBack).toHaveBeenCalledTimes(1);
		expect(nativeRemovalEvent.preventDefault).toHaveBeenCalledTimes(1);
		expect(replacementRemovalEvent.preventDefault).not.toHaveBeenCalled();
	});
});
