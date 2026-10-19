import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, within } from "@testing-library/react-native";
import type { ViewProps } from "react-native";
import { EntryCompletionAction } from "./entry-completion-action";

let mockReducedMotion = false;
let mockPress: () => void;
let mockContentMotion: { entering?: unknown; exiting?: unknown };
jest.mock("react-native-reanimated", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const Native =
		jest.requireActual<typeof import("react-native")>("react-native");
	const transition = {
		duration: () => transition,
		delay: () => transition,
		easing: () => transition,
		withInitialValues: () => transition,
		withTargetValues: () => transition,
	};
	return {
		__esModule: true,
		default: {
			View: (props: ViewProps & { entering?: unknown; exiting?: unknown }) => {
				mockContentMotion = props;
				return React.createElement(Native.View, props);
			},
		},
		useReducedMotion: () => mockReducedMotion,
		FadeInDown: transition,
		FadeOutUp: transition,
		Easing: { cubic: undefined, in: () => undefined, out: () => undefined },
	};
});
jest.mock("~/components/ui/button", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const Native =
		jest.requireActual<typeof import("react-native")>("react-native");
	return {
		Button: (props: { onPress: () => void }) => {
			mockPress = props.onPress;
			return React.createElement(Native.Pressable, {
				accessibilityRole: "button",
				...props,
			});
		},
	};
});
jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({ colors: { background: "#F6F6F4" } }),
}));
jest.mock("~/components/ui/icon", () => ({ Check: () => null }));
beforeEach(() => {
	jest.useFakeTimers();
	jest.clearAllMocks();
	mockReducedMotion = false;
});
afterEach(() => {
	jest.restoreAllMocks();
	jest.clearAllTimers();
	jest.useRealTimers();
});

test("waits for mutation and persisted state, confirms inside the button, then restores its next action", async () => {
	let finish!: () => void;
	const change = jest.fn<(completed: boolean) => Promise<void>>(
		() =>
			new Promise<void>((resolve) => {
				finish = resolve;
			}),
	);
	const screen = await render(
		<EntryCompletionAction completed={false} onChange={change} />,
	);
	const press = mockPress;
	await act(() => {
		press();
		press();
	});
	expect(change).toHaveBeenCalledTimes(1);
	expect(change).toHaveBeenCalledWith(true);
	expect(screen.getByRole("button").props.accessibilityState.busy).toBe(true);
	await act(() => finish());
	await act(() => jest.advanceTimersByTime(5_000));
	expect(screen.queryByText("Als erledigt markiert.")).toBeNull();
	expect(screen.getByRole("button").props.accessibilityState.busy).toBe(true);
	await screen.rerender(<EntryCompletionAction completed onChange={change} />);
	const confirmation = screen.getByRole("button", {
		name: "Als erledigt markiert.",
	});
	expect(within(confirmation).getByText("Als erledigt markiert.")).toBeTruthy();
	expect(confirmation.props.accessibilityState).toEqual({
		busy: false,
		disabled: true,
	});
	await act(() => mockPress());
	expect(change).toHaveBeenCalledTimes(1);
	await act(() => jest.advanceTimersByTime(1_399));
	expect(
		screen.getByRole("button", { name: "Als erledigt markiert." }),
	).toBeTruthy();
	await act(() => jest.advanceTimersByTime(1));
	expect(
		screen.getByRole("button", { name: "Als offen markieren" }).props
			.accessibilityState.disabled,
	).toBe(false);
	expect(screen.queryByText("Als erledigt markiert.")).toBeNull();
	expect(mockContentMotion.entering).toBeDefined();
	expect(mockContentMotion.exiting).toBeDefined();
});

test("does not confirm an early persisted update until the mutation succeeds", async () => {
	let finish!: () => void;
	const change = jest.fn<(completed: boolean) => Promise<void>>(
		() =>
			new Promise<void>((resolve) => {
				finish = resolve;
			}),
	);
	const screen = await render(
		<EntryCompletionAction completed={false} onChange={change} />,
	);
	await fireEvent.press(screen.getByRole("button"));
	await screen.rerender(<EntryCompletionAction completed onChange={change} />);
	expect(screen.queryByText("Als erledigt markiert.")).toBeNull();
	await act(() => finish());
	expect(
		screen.getByRole("button", { name: "Als erledigt markiert." }),
	).toBeTruthy();
});

test("preserves the recoverable error and runs a successful retry through the same confirmation", async () => {
	const change = jest
		.fn<(completed: boolean) => Promise<void>>()
		.mockRejectedValueOnce(new Error("offline"))
		.mockResolvedValueOnce();
	const screen = await render(
		<EntryCompletionAction completed={false} onChange={change} />,
	);
	await fireEvent.press(screen.getByRole("button"));
	expect(screen.getByRole("alert").props.children).toBe(
		"Der Status konnte nicht gespeichert werden. Bitte versuche es erneut.",
	);
	expect(screen.getByRole("button").props.accessibilityState.disabled).toBe(
		false,
	);
	expect(screen.queryByText("Als erledigt markiert.")).toBeNull();
	await fireEvent.press(screen.getByRole("button"));
	expect(change).toHaveBeenCalledTimes(2);
	expect(screen.queryByRole("alert")).toBeNull();
	await screen.rerender(<EntryCompletionAction completed onChange={change} />);
	expect(
		screen.getByRole("button", { name: "Als erledigt markiert." }),
	).toBeTruthy();
	await act(() => jest.advanceTimersByTime(1_400));
	expect(
		screen.getByRole("button", { name: "Als offen markieren" }),
	).toBeTruthy();
});

test("does not celebrate historical completion and confirms reopening without motion", async () => {
	mockReducedMotion = true;
	const change = jest
		.fn<(completed: boolean) => Promise<void>>()
		.mockResolvedValue();
	const screen = await render(
		<EntryCompletionAction completed onChange={change} />,
	);
	expect(screen.queryByText("Als erledigt markiert.")).toBeNull();
	await fireEvent.press(screen.getByRole("button"));
	expect(change).toHaveBeenCalledWith(false);
	await screen.rerender(
		<EntryCompletionAction completed={false} onChange={change} />,
	);
	expect(screen.getByRole("button", { name: "Wieder offen." })).toBeTruthy();
	expect(mockContentMotion.entering).toBeUndefined();
	expect(mockContentMotion.exiting).toBeUndefined();
	await act(() => jest.advanceTimersByTime(1_400));
	expect(
		screen.getByRole("button", { name: "Als erledigt markieren" }),
	).toBeTruthy();
});

test("clears a confirmation after a conflicting update instead of replaying it later", async () => {
	const change = jest
		.fn<(completed: boolean) => Promise<void>>()
		.mockResolvedValue();
	const screen = await render(
		<EntryCompletionAction completed={false} onChange={change} />,
	);
	await fireEvent.press(screen.getByRole("button"));
	await screen.rerender(<EntryCompletionAction completed onChange={change} />);
	expect(
		screen.getByRole("button", { name: "Als erledigt markiert." }),
	).toBeTruthy();
	await screen.rerender(
		<EntryCompletionAction completed={false} onChange={change} />,
	);
	expect(
		screen.getByRole("button", { name: "Als erledigt markieren" }).props
			.accessibilityState.disabled,
	).toBe(false);
	await screen.rerender(<EntryCompletionAction completed onChange={change} />);
	expect(screen.queryByText("Als erledigt markiert.")).toBeNull();
});

test("removes the confirmation timer on unmount", async () => {
	const schedule = jest.spyOn(global, "setTimeout");
	const cancel = jest.spyOn(global, "clearTimeout");
	const change = jest
		.fn<(completed: boolean) => Promise<void>>()
		.mockResolvedValue();
	const screen = await render(
		<EntryCompletionAction completed={false} onChange={change} />,
	);
	await fireEvent.press(screen.getByRole("button"));
	await screen.rerender(<EntryCompletionAction completed onChange={change} />);
	const confirmationTimer =
		schedule.mock.results[
			schedule.mock.calls.findIndex(([, delay]) => delay === 1_400)
		].value;
	await screen.unmount();
	expect(cancel.mock.calls.map(([timer]) => timer)).toContain(
		confirmationTimer,
	);
});

test("unavailable actions never save", async () => {
	const change = jest.fn<(completed: boolean) => Promise<void>>();
	await render(
		<EntryCompletionAction completed={false} disabled onChange={change} />,
	);
	await act(() => mockPress());
	expect(change).not.toHaveBeenCalled();
});
