import {
	afterEach,
	beforeEach,
	describe,
	expect,
	jest,
	test,
} from "@jest/globals";
import { act, fireEvent, render } from "@testing-library/react-native";
import type { ReactElement, ReactNode } from "react";
import { AccessibilityInfo, BackHandler, Platform, View } from "react-native";
import { DayovaSheetFrame } from "./dayova-sheet-frame";
import {
	SheetAccessibilityProvider,
	useSheetAccessibility,
} from "./sheet-accessibility";

const mockSheetHarness = {
	present: jest.fn(),
	dismiss: jest.fn(),
	onChange: null as null | ((index: number) => void),
	onDismiss: null as null | (() => void),
};

jest.mock("react-native", () => {
	const actual =
		jest.requireActual<typeof import("react-native")>("react-native");
	const findNodeHandle = jest.fn(() => 42);
	return new Proxy(actual, {
		get(target, property, receiver) {
			if (property === "findNodeHandle") return findNodeHandle;
			return Reflect.get(target, property, receiver);
		},
	});
});

jest.mock("react-native-safe-area-context", () => ({
	useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));

jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		colors: { border: "#CCCCCC", surface: "#FFFFFF" },
		isDark: false,
	}),
}));

jest.mock("~/components/ui/text", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	return {
		Text: ({ children, ...props }: { children?: ReactNode }) =>
			React.createElement("Text", props, children),
	};
});

jest.mock("~/components/ui/close-button", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	return {
		CloseButton: (props: Record<string, unknown>) =>
			React.createElement("CloseButton", props),
	};
});

jest.mock("@gorhom/bottom-sheet", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const BottomSheetModal = React.forwardRef(
		(
			{
				children,
				onChange,
				onDismiss,
				...props
			}: {
				children?: ReactNode;
				onChange?: (index: number) => void;
				onDismiss?: () => void;
			},
			ref: import("react").ForwardedRef<{
				dismiss: typeof mockSheetHarness.dismiss;
				present: typeof mockSheetHarness.present;
			}>,
		) => {
			mockSheetHarness.onChange = onChange ?? null;
			mockSheetHarness.onDismiss = onDismiss ?? null;
			React.useImperativeHandle(ref, () => ({
				dismiss: mockSheetHarness.dismiss,
				present: mockSheetHarness.present,
			}));
			return React.createElement(
				"BottomSheetModal",
				{ testID: "bottom-sheet-modal", ...props },
				children,
			);
		},
	);

	return {
		BottomSheetBackdrop: (props: Record<string, unknown>) =>
			React.createElement("BottomSheetBackdrop", props),
		BottomSheetModal,
		BottomSheetScrollView: ({ children, ...props }: { children?: ReactNode }) =>
			React.createElement("BottomSheetScrollView", props, children),
		BottomSheetView: ({ children, ...props }: { children?: ReactNode }) =>
			React.createElement("BottomSheetView", props, children),
	};
});

describe("DayovaSheetFrame", () => {
	let animationFrames: FrameRequestCallback[];
	let focusSpy: jest.SpiedFunction<
		typeof AccessibilityInfo.setAccessibilityFocus
	>;
	let androidBackHandler:
		| null
		| Parameters<typeof BackHandler.addEventListener>[1];
	let originalPlatform: typeof Platform.OS;
	const setPlatformOS = (value: typeof Platform.OS) => {
		Object.defineProperty(Platform, "OS", { configurable: true, value });
	};

	beforeEach(() => {
		originalPlatform = Platform.OS;
		jest.restoreAllMocks();
		mockSheetHarness.present.mockReset();
		mockSheetHarness.dismiss.mockReset();
		mockSheetHarness.onChange = null;
		mockSheetHarness.onDismiss = null;
		androidBackHandler = null;
		jest
			.spyOn(BackHandler, "addEventListener")
			.mockImplementation((_eventName, handler) => {
				androidBackHandler = handler;
				return {
					remove: jest.fn(() => {
						if (androidBackHandler === handler) androidBackHandler = null;
					}),
				};
			});
		focusSpy = jest
			.spyOn(AccessibilityInfo, "setAccessibilityFocus")
			.mockImplementation(() => undefined);
		animationFrames = [];
		global.requestAnimationFrame = (callback: FrameRequestCallback) => {
			animationFrames.push(callback);
			return animationFrames.length;
		};
		global.cancelAnimationFrame = jest.fn();
	});

	afterEach(() => {
		setPlatformOS(originalPlatform);
	});

	const flushAnimationFrames = () => {
		const callbacks = animationFrames.splice(0);
		for (const callback of callbacks) callback(performance.now());
	};

	test("reopens after an in-flight controlled dismissal without closing the new sheet", async () => {
		const onClose = jest.fn();
		const onDismiss = jest.fn();
		const view = await render(
			<DayovaSheetFrame
				visible
				onClose={onClose}
				onDismiss={onDismiss}
				title="Auswahl"
			/>,
		);

		await act(flushAnimationFrames);
		expect(mockSheetHarness.present).toHaveBeenCalledTimes(1);

		await view.rerender(
			<DayovaSheetFrame
				visible={false}
				onClose={onClose}
				onDismiss={onDismiss}
				title="Auswahl"
			/>,
		);
		expect(mockSheetHarness.dismiss).toHaveBeenCalledTimes(1);

		await view.rerender(
			<DayovaSheetFrame
				visible
				onClose={onClose}
				onDismiss={onDismiss}
				title="Auswahl"
			/>,
		);
		await act(() => mockSheetHarness.onDismiss?.());
		await act(flushAnimationFrames);

		expect(onClose).not.toHaveBeenCalled();
		expect(onDismiss).toHaveBeenCalledTimes(1);
		expect(mockSheetHarness.present).toHaveBeenCalledTimes(2);

		await act(() => mockSheetHarness.onDismiss?.());
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	test("releases Android back when a controlled reopen is cancelled", async () => {
		setPlatformOS("android");
		const view = await render(
			<DayovaSheetFrame visible onClose={jest.fn()} title="Auswahl" />,
		);
		await act(flushAnimationFrames);
		await act(() => mockSheetHarness.onChange?.(0));
		await act(flushAnimationFrames);

		await view.rerender(
			<DayovaSheetFrame visible={false} onClose={jest.fn()} title="Auswahl" />,
		);
		await view.rerender(
			<DayovaSheetFrame visible onClose={jest.fn()} title="Auswahl" />,
		);
		await act(() => mockSheetHarness.onDismiss?.());

		await view.rerender(
			<DayovaSheetFrame visible={false} onClose={jest.fn()} title="Auswahl" />,
		);
		await act(flushAnimationFrames);

		expect(mockSheetHarness.present).toHaveBeenCalledTimes(1);
		expect(androidBackHandler).toBeNull();
	});

	test("the close control requests a native dismissal", async () => {
		const view = await render(
			<DayovaSheetFrame visible onClose={jest.fn()} title="Auswahl" />,
		);
		await act(flushAnimationFrames);

		fireEvent.press(view.getByLabelText("Dialog schließen"));

		expect(mockSheetHarness.dismiss).toHaveBeenCalledTimes(1);
	});

	test("Android system back dismisses the sheet before the underlying route", async () => {
		const onClose = jest.fn();
		setPlatformOS("android");
		await render(
			<DayovaSheetFrame visible onClose={onClose} title="Auswahl" />,
		);
		await act(flushAnimationFrames);

		expect(androidBackHandler).not.toBeNull();
		let handled = false;
		await act(() => {
			handled = androidBackHandler?.(undefined as never) ?? false;
		});
		expect(handled).toBe(true);
		expect(mockSheetHarness.dismiss).toHaveBeenCalledTimes(1);

		await act(() => mockSheetHarness.onDismiss?.());
		expect(onClose).toHaveBeenCalledTimes(1);
		expect(mockSheetHarness.present).toHaveBeenCalledTimes(1);
	});

	test("Android back cancels a deferred opening before the sheet can appear", async () => {
		const onClose = jest.fn();
		setPlatformOS("android");
		await render(
			<DayovaSheetFrame visible onClose={onClose} title="Auswahl" />,
		);

		let handled = false;
		await act(() => {
			handled = androidBackHandler?.(undefined as never) ?? false;
		});
		expect(handled).toBe(true);
		expect(onClose).toHaveBeenCalledTimes(1);
		await act(flushAnimationFrames);
		expect(mockSheetHarness.present).not.toHaveBeenCalled();
	});

	test("Android back remains captured until a closing sheet is fully dismissed", async () => {
		setPlatformOS("android");
		const view = await render(
			<DayovaSheetFrame visible onClose={jest.fn()} title="Auswahl" />,
		);
		await act(flushAnimationFrames);
		await act(() => mockSheetHarness.onChange?.(0));
		await act(flushAnimationFrames);

		await view.rerender(
			<DayovaSheetFrame visible={false} onClose={jest.fn()} title="Auswahl" />,
		);
		expect(mockSheetHarness.dismiss).toHaveBeenCalledTimes(1);
		expect(androidBackHandler).not.toBeNull();
		let handled = false;
		await act(() => {
			handled = androidBackHandler?.(undefined as never) ?? false;
		});
		expect(handled).toBe(true);

		await act(() => mockSheetHarness.onDismiss?.());
		expect(androidBackHandler).toBeNull();
	});

	test("exposes modal semantics, moves focus to its heading, and handles escape", async () => {
		const view = await render(
			<DayovaSheetFrame
				visible
				onClose={jest.fn()}
				title="Auswahl"
				closeAccessibilityLabel="Auswahl schließen"
			/>,
		);
		await act(flushAnimationFrames);

		const heading = view.getByRole("header", { name: "Auswahl" });
		const modalContent = heading.parent?.parent?.parent;
		const modal = view.getByTestId("bottom-sheet-modal");
		expect(heading).toBeOnTheScreen();
		expect(modal.props.accessible).toBe(false);
		const BackgroundComponent = modal.props.backgroundComponent as (
			props: Record<string, unknown>,
		) => ReactElement<{
			accessible?: boolean;
			importantForAccessibility?: string;
		}>;
		const background = BackgroundComponent({ style: {} });
		expect(background.props.accessible).toBe(false);
		expect(background.props.importantForAccessibility).toBe(
			"no-hide-descendants",
		);
		expect(modalContent?.props.accessibilityViewIsModal).toBe(true);
		expect(modalContent?.props.accessibilityActions).toEqual([
			{ name: "escape", label: "Auswahl schließen" },
		]);
		focusSpy.mockClear();

		await act(() => mockSheetHarness.onChange?.(0));
		await act(flushAnimationFrames);
		expect(focusSpy).toHaveBeenCalledTimes(1);

		if (!modalContent) throw new Error("Expected modal content container");
		fireEvent(modalContent, "accessibilityEscape");
		expect(mockSheetHarness.dismiss).toHaveBeenCalledTimes(1);
	});

	test("hides background content from screen readers while a sheet is open", async () => {
		function BackgroundProbe() {
			const sheetAccessibility = useSheetAccessibility();
			return (
				<View
					testID="background"
					accessibilityElementsHidden={
						sheetAccessibility?.hasOpenSheet ?? false
					}
				/>
			);
		}

		const view = await render(
			<SheetAccessibilityProvider>
				<BackgroundProbe />
				<DayovaSheetFrame visible onClose={jest.fn()} title="Auswahl" />
			</SheetAccessibilityProvider>,
		);
		await act(flushAnimationFrames);
		expect(
			view.getByTestId("background").props.accessibilityElementsHidden,
		).toBe(false);

		await act(() => mockSheetHarness.onChange?.(0));
		expect(
			view.getByTestId("background", { includeHiddenElements: true }).props
				.accessibilityElementsHidden,
		).toBe(true);

		await act(() => mockSheetHarness.onDismiss?.());
		expect(
			view.getByTestId("background").props.accessibilityElementsHidden,
		).toBe(false);
	});
});
