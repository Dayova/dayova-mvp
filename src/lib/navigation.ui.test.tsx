import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, renderHook } from "@testing-library/react-native";
import { BackHandler, Platform } from "react-native";
import { useBackIntent } from "./navigation";
import { goBackOrReplace } from "./navigation-actions";

type BeforeRemoveEvent = {
	data: { action: { type: string } };
	preventDefault: jest.Mock;
};

type BeforeRemoveListener = (event: BeforeRemoveEvent) => void;

let mockBeforeRemoveListener: BeforeRemoveListener | undefined;
const mockDispatch = jest.fn();
let mockIsFocused = true;

jest.mock("expo-router/react-navigation", () => ({
	useFocusEffect: (effect: () => undefined | (() => void)) => effect(),
	useIsFocused: () => mockIsFocused,
	useNavigation: () => ({ dispatch: mockDispatch }),
	usePreventRemove: (
		prevent: boolean,
		callback: (event: Pick<BeforeRemoveEvent, "data">) => void,
	) => {
		mockBeforeRemoveListener = (event) => {
			if (!prevent) return;
			event.preventDefault();
			callback({ data: event.data });
		};
	},
}));

const createBeforeRemoveEvent = (): BeforeRemoveEvent => ({
	data: { action: { type: "GO_BACK" } },
	preventDefault: jest.fn(),
});

describe("useBackIntent", () => {
	beforeEach(() => {
		mockBeforeRemoveListener = undefined;
		mockDispatch.mockClear();
		mockIsFocused = true;
		global.requestAnimationFrame = jest.fn(() => 1);
	});

	test("allows the queued header exit after the handler returns", async () => {
		const event = createBeforeRemoveEvent();
		let dispatch: (() => void) | undefined;
		const router = {
			canGoBack: () => true,
			back: jest.fn(() => {
				dispatch = () => mockBeforeRemoveListener?.(event);
			}),
			replace: jest.fn(),
			dismissTo: jest.fn(),
		};
		const hook = await renderHook(() =>
			useBackIntent(
				true,
				() => {
					goBackOrReplace(router, "/home");
					return true;
				},
				{ allowRouteRemoval: true },
			),
		);
		await act(async () => {
			hook.result.current();
		});
		await act(async () => {
			dispatch?.();
		});
		expect(router.back).toHaveBeenCalledTimes(1);
		expect(event.preventDefault).not.toHaveBeenCalled();
	});

	test("intercepts a picker or internal step rather than removing the route", async () => {
		const onBack = jest.fn(() => true);
		await renderHook(() =>
			useBackIntent(true, onBack, { allowRouteRemoval: false }),
		);
		const event = createBeforeRemoveEvent();
		await act(async () => {
			mockBeforeRemoveListener?.(event);
		});
		expect(onBack).toHaveBeenCalledTimes(1);
		expect(event.preventDefault).toHaveBeenCalledTimes(1);
	});

	test("blocks a second native removal in the same frame after handling an internal step", async () => {
		const onBack = jest.fn(() => true);
		await renderHook(() => useBackIntent(true, onBack));
		const first = createBeforeRemoveEvent();
		const second = createBeforeRemoveEvent();
		await act(async () => {
			mockBeforeRemoveListener?.(first);
			mockBeforeRemoveListener?.(second);
		});
		expect(onBack).toHaveBeenCalledTimes(1);
		expect(second.preventDefault).toHaveBeenCalledTimes(1);
	});

	test("resumes the original action when the back intent is unhandled", async () => {
		const onBack = jest.fn(() => false);
		await renderHook(() => useBackIntent(true, onBack));
		const event = createBeforeRemoveEvent();
		await act(async () => mockBeforeRemoveListener?.(event));
		expect(onBack).toHaveBeenCalledTimes(1);
		expect(mockDispatch).toHaveBeenCalledWith(event.data.action);
	});

	test("allows replacements without invoking the back intent", async () => {
		const onBack = jest.fn(() => true);
		await renderHook(() => useBackIntent(true, onBack));
		const event = createBeforeRemoveEvent();
		event.data.action.type = "REPLACE";
		await act(async () => mockBeforeRemoveListener?.(event));
		expect(onBack).not.toHaveBeenCalled();
		expect(mockDispatch).toHaveBeenCalledWith(event.data.action);
	});

	test("does not intercept removal while the screen is unfocused", async () => {
		mockIsFocused = false;
		const onBack = jest.fn(() => true);
		await renderHook(() => useBackIntent(true, onBack));
		const event = createBeforeRemoveEvent();
		await act(async () => mockBeforeRemoveListener?.(event));
		expect(event.preventDefault).not.toHaveBeenCalled();
		expect(onBack).not.toHaveBeenCalled();
	});

	test("uses Home once for repeated header Back when there is no history", async () => {
		const router = {
			canGoBack: jest.fn(() => false),
			back: jest.fn(),
			replace: jest.fn(),
			dismissTo: jest.fn(),
		};
		const hook = await renderHook(() =>
			useBackIntent(true, () => {
				goBackOrReplace(router, "/home");
				return true;
			}),
		);
		await act(async () => {
			hook.result.current();
			hook.result.current();
		});
		expect(router.back).not.toHaveBeenCalled();
		expect(router.replace).toHaveBeenCalledTimes(1);
		expect(router.replace).toHaveBeenCalledWith("/home");
	});

	test("allows Android hardware Back to reach router removal without recursion", async () => {
		const originalOS = Platform.OS;
		Object.defineProperty(Platform, "OS", {
			configurable: true,
			value: "android",
		});
		let hardwareBack: (() => boolean | null | undefined) | undefined;
		const subscription = jest
			.spyOn(BackHandler, "addEventListener")
			.mockImplementation((_name, listener) => {
				hardwareBack = () =>
					listener({ type: "hardwareBackPress", timeStamp: 0 });
				return { remove: jest.fn() };
			});
		try {
			const removal = createBeforeRemoveEvent();
			const router = {
				canGoBack: jest.fn(() => true),
				back: jest.fn(),
				replace: jest.fn(),
				dismissTo: jest.fn(),
			};
			await renderHook(() =>
				useBackIntent(
					true,
					() => {
						goBackOrReplace(router, "/home");
						return true;
					},
					{ allowRouteRemoval: true },
				),
			);
			await act(async () => {
				expect(hardwareBack?.()).toBe(true);
			});
			await act(async () => {
				mockBeforeRemoveListener?.(removal);
			});
			expect(router.back).toHaveBeenCalledTimes(1);
			expect(removal.preventDefault).not.toHaveBeenCalled();
		} finally {
			subscription.mockRestore();
			Object.defineProperty(Platform, "OS", {
				configurable: true,
				value: originalOS,
			});
		}
	});
});
