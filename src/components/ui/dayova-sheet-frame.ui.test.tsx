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
const mockWindowDimensions = {
	fontScale: 1,
	height: 852,
	scale: 3,
	width: 393,
};
const mockSafeAreaInsets = { bottom: 0, left: 0, right: 0, top: 0 };

jest.mock("react-native", () => {
	const actual =
		jest.requireActual<typeof import("react-native")>("react-native");
	const findNodeHandle = jest.fn(() => 42);
	return new Proxy(actual, {
		get(target, property, receiver) {
			if (property === "findNodeHandle") return findNodeHandle;
			if (property === "useWindowDimensions") {
				return () => mockWindowDimensions;
			}
			return Reflect.get(target, property, receiver);
		},
	});
});

jest.mock("react-native-safe-area-context", () => ({
	useSafeAreaInsets: () => mockSafeAreaInsets,
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
				footerComponent: Footer,
				containerComponent: Container = React.Fragment,
				...props
			}: {
				children?: ReactNode;
				onChange?: (index: number) => void;
				onDismiss?: () => void;
				footerComponent?: import("react").ComponentType;
				containerComponent?: import("react").ComponentType<{
					children?: ReactNode;
				}>;
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
				Container,
				{},
				React.createElement(
					"BottomSheetModal",
					{ testID: "bottom-sheet-modal", footerComponent: Footer, ...props },
					children,
					Footer ? React.createElement(Footer) : null,
				),
			);
		},
	);

	return {
		BottomSheetBackdrop: (props: Record<string, unknown>) =>
			React.createElement("BottomSheetBackdrop", props),
		BottomSheetModal,
		BottomSheetFooter: ({ children }: { children?: ReactNode }) =>
			React.createElement("BottomSheetFooter", {}, children),
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
		Object.assign(mockWindowDimensions, {
			fontScale: 1,
			height: 852,
			scale: 3,
			width: 393,
		});
		Object.assign(mockSafeAreaInsets, {
			bottom: 0,
			left: 0,
			right: 0,
			top: 0,
		});
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
		const modalContent = view.getByTestId("dayova-sheet-content");
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
		expect(
			view.getByTestId("dayova-sheet-modal").props.accessibilityViewIsModal,
		).toBe(true);
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

	test("fits ordinary information to content and allows overflow to scroll", async () => {
		const view = await render(
			<DayovaSheetFrame visible onClose={jest.fn()} title="App-Informationen">
				<View testID="information" />
			</DayovaSheetFrame>,
		);
		const modal = view.getByTestId("bottom-sheet-modal");
		expect(modal.props.enableDynamicSizing).toBe(true);
		expect(modal.props.snapPoints).toBeUndefined();
		expect(view.getByTestId("dayova-sheet-scroll-content")).toContainElement(
			view.getByTestId("information"),
		);
	});

	test("keeps enlarged headings and actions in one reachable scroll flow", async () => {
		Object.assign(mockWindowDimensions, {
			fontScale: 2,
			height: 568,
			width: 320,
		});
		const view = await render(
			<DayovaSheetFrame
				visible
				onClose={jest.fn()}
				title="Schulmaterial fehlt"
				footer={<View testID="sheet-footer" />}
			>
				<View testID="material" />
			</DayovaSheetFrame>,
		);
		const scroll = view.getByTestId("dayova-sheet-scroll-content");
		expect(scroll).toContainElement(
			view.getByRole("header", { name: "Schulmaterial fehlt" }),
		);
		expect(scroll).toContainElement(view.getByTestId("sheet-footer"));
		expect(
			view.getByTestId("bottom-sheet-modal").props.footerComponent,
		).toBeUndefined();
	});

	test("scrolls the heading with the content and reserves space for pinned actions", async () => {
		const view = await render(
			<DayovaSheetFrame
				visible
				footer={<View testID="sheet-footer" />}
				onClose={jest.fn()}
				scrollable
				title="Fester Titel"
			>
				<View testID="long-sheet-content" />
			</DayovaSheetFrame>,
		);
		await act(flushAnimationFrames);

		const scrollContent = view.getByTestId("dayova-sheet-scroll-content");
		const header = view.getByTestId("dayova-sheet-header");
		const footer = view.getByTestId("sheet-footer");

		expect(scrollContent).toContainElement(header);
		expect(scrollContent.props.enableFooterMarginAdjustment).toBe(true);
		expect(scrollContent).toContainElement(
			view.getByTestId("long-sheet-content"),
		);
		expect(scrollContent).not.toContainElement(footer);
	});

	test.each([
		1, 2,
	])("keeps close chrome above full-width copy at font scale %s", async (fontScale) => {
		mockWindowDimensions.fontScale = fontScale;
		const view = await render(
			<DayovaSheetFrame
				visible
				onClose={jest.fn()}
				title="Was möchtest du planen?"
				description="Wähle deine nächste Aufgabe aus."
			/>,
		);
		const closeRow = view.getByTestId("dayova-sheet-close-row");
		const titleRow = view.getByTestId("dayova-sheet-title-row");
		expect(closeRow).not.toContainElement(
			view.getByRole("header", { name: "Was möchtest du planen?" }),
		);
		expect(titleRow).toContainElement(
			view.getByRole("header", { name: "Was möchtest du planen?" }),
		);
		expect(titleRow.props.className).toBe("w-full");
		expect(closeRow.props.className).toContain("mb-2");
	});

	test("respects landscape safe areas and uses the available scroll height", async () => {
		Object.assign(mockWindowDimensions, { height: 390, width: 844 });
		Object.assign(mockSafeAreaInsets, { left: 47, right: 21 });

		const view = await render(
			<DayovaSheetFrame
				visible
				maxWidth={760}
				onClose={jest.fn()}
				scrollable
				title="Querformat"
			>
				<View />
			</DayovaSheetFrame>,
		);
		await act(flushAnimationFrames);

		const modal = view.getByTestId("bottom-sheet-modal");
		expect(modal.props.style).toMatchObject({
			marginHorizontal: 47,
			width: 750,
		});
		expect(modal.props.snapPoints).toBeUndefined();
		expect(modal.props.maxDynamicContentSize).toBe(370);
	});

	test("moves oversized measured actions into the scroll flow", async () => {
		const view = await render(
			<DayovaSheetFrame
				visible
				onClose={jest.fn()}
				title="Bestätigung"
				footer={<View testID="action" />}
			/>,
		);
		expect(
			view.getByTestId("dayova-sheet-scroll-content"),
		).not.toContainElement(view.getByTestId("action"));
		await fireEvent(view.getByTestId("dayova-sheet-actions"), "layout", {
			nativeEvent: { layout: { height: 330 } },
		});
		expect(view.getByTestId("dayova-sheet-scroll-content")).toContainElement(
			view.getByTestId("action"),
		);
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
			view.getByTestId("background", { includeHiddenElements: true }).props
				.accessibilityElementsHidden,
		).toBe(false);

		await act(() => mockSheetHarness.onChange?.(0));
		expect(
			view.getByTestId("background", { includeHiddenElements: true }).props
				.accessibilityElementsHidden,
		).toBe(true);

		await act(() => mockSheetHarness.onDismiss?.());
		expect(
			view.getByTestId("background", { includeHiddenElements: true }).props
				.accessibilityElementsHidden,
		).toBe(false);
	});
});
