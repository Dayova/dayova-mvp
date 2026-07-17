import type { ReactNode } from "react";
import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render } from "@testing-library/react-native";
import { DayovaSheetFrame } from "./dayova-sheet-frame";

const mockSheetHarness = {
	present: jest.fn(),
	dismiss: jest.fn(),
	onDismiss: null as null | (() => void),
};

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
				onDismiss,
				...props
			}: { children?: ReactNode; onDismiss?: () => void },
			ref: import("react").ForwardedRef<{
				dismiss: typeof mockSheetHarness.dismiss;
				present: typeof mockSheetHarness.present;
			}>,
		) => {
			mockSheetHarness.onDismiss = onDismiss ?? null;
			React.useImperativeHandle(ref, () => ({
				dismiss: mockSheetHarness.dismiss,
				present: mockSheetHarness.present,
			}));
			return React.createElement("BottomSheetModal", props, children);
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

	beforeEach(() => {
		mockSheetHarness.present.mockReset();
		mockSheetHarness.dismiss.mockReset();
		mockSheetHarness.onDismiss = null;
		animationFrames = [];
		global.requestAnimationFrame = (callback: FrameRequestCallback) => {
			animationFrames.push(callback);
			return animationFrames.length;
		};
		global.cancelAnimationFrame = jest.fn();
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

	test("the close control requests a native dismissal", async () => {
		const view = await render(
			<DayovaSheetFrame visible onClose={jest.fn()} title="Auswahl" />,
		);
		await act(flushAnimationFrames);

		fireEvent.press(view.getByLabelText("Dialog schließen"));

		expect(mockSheetHarness.dismiss).toHaveBeenCalledTimes(1);
	});
});
