import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, within } from "@testing-library/react-native";
import type { ViewProps } from "react-native";
import { DayovaThemeProvider } from "~/lib/theme";
import { EntryCompletionAction } from "./entry-completion-action";

let mockReducedMotion = false;
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
				return React.createElement(Native.View, props);
			},
		},
		useReducedMotion: () => mockReducedMotion,
		FadeInDown: transition,
		FadeOutUp: transition,
		Easing: { cubic: undefined, in: () => undefined, out: () => undefined },
	};
});
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

// Observable contract: pressing updates feedback before the RPC settles, blocks
// duplicate writes, then exposes the next action. A wait-for-server regression fails.
test("immediate status feedback transitions to the optimistic next action while saving", async () => {
	let finish!: () => void;
	const change = jest.fn<(completed: boolean) => Promise<void>>(
		() =>
			new Promise<void>((resolve) => {
				finish = resolve;
			}),
	);
	const screen = await render(
		<EntryCompletionAction completed={false} onChange={change} />,
		{ wrapper: DayovaThemeProvider },
	);
	const button = screen.getByRole("button");
	await fireEvent.press(button);
	await fireEvent.press(button);
	expect(change).toHaveBeenCalledTimes(1);
	expect(change).toHaveBeenCalledWith(true);
	const status = screen.getByRole("button", {
		name: "Als erledigt markiert. Wird gespeichert.",
	});
	expect(within(status).getByText("Als erledigt markiert.")).toBeTruthy();
	expect(status).toBeDisabled();
	expect(status.props.accessibilityState.busy).toBe(true);
	// The caller supplies Convex's optimistic result, before the response.
	await screen.rerender(<EntryCompletionAction completed onChange={change} />);
	await act(() => jest.advanceTimersByTime(1_400));
	const next = screen.getByRole("button", {
		name: "Als offen markieren Wird gespeichert.",
	});
	expect(next).toBeDisabled();
	await fireEvent.press(next);
	expect(change).toHaveBeenCalledTimes(1);
	await act(() => finish());
	expect(
		screen.getByRole("button", { name: "Als offen markieren" }),
	).toBeEnabled();
});

// A fast acknowledgement must not erase the readable temporary state.
test("keeps quick successful feedback briefly and reverses using the same interaction", async () => {
	const change = jest
		.fn<(completed: boolean) => Promise<void>>()
		.mockResolvedValue();
	const screen = await render(
		<EntryCompletionAction completed={false} onChange={change} />,
		{ wrapper: DayovaThemeProvider },
	);
	await fireEvent.press(screen.getByRole("button"));
	await screen.rerender(<EntryCompletionAction completed onChange={change} />);
	expect(
		screen.getByRole("button", { name: "Als erledigt markiert." }),
	).toBeDisabled();
	await act(() => jest.advanceTimersByTime(1_400));
	await fireEvent.press(
		screen.getByRole("button", { name: "Als offen markieren" }),
	);
	await screen.rerender(
		<EntryCompletionAction completed={false} onChange={change} />,
	);
	expect(change.mock.calls).toEqual([[true], [false]]);
	expect(screen.getByRole("button", { name: "Wieder offen." })).toBeDisabled();
	await act(() => jest.advanceTimersByTime(1_400));
	expect(
		screen.getByRole("button", { name: "Als erledigt markieren" }),
	).toBeEnabled();
});

// The RPC boundary rejects after an optimistic update. Leaving feedback or the
// retry disabled, or sending the opposite target after rollback, must fail.
test("shows the existing recoverable error after rollback and retries the requested change", async () => {
	let reject!: (error: Error) => void;
	const change = jest
		.fn<(completed: boolean) => Promise<void>>()
		.mockImplementationOnce(
			() =>
				new Promise<void>((_resolve, fail) => {
					reject = fail;
				}),
		)
		.mockResolvedValue();
	const screen = await render(
		<EntryCompletionAction completed={false} onChange={change} />,
		{ wrapper: DayovaThemeProvider },
	);
	await fireEvent.press(screen.getByRole("button"));
	await screen.rerender(<EntryCompletionAction completed onChange={change} />);
	await act(() => reject(new Error("synthetic save rejection")));
	await screen.rerender(
		<EntryCompletionAction completed={false} onChange={change} />,
	);
	expect(screen.getByRole("alert")).toHaveTextContent(
		"Der Status konnte nicht gespeichert werden. Bitte versuche es erneut.",
	);
	const retry = screen.getByRole("button", { name: "Als erledigt markieren" });
	expect(retry).toBeEnabled();
	await fireEvent.press(retry);
	await screen.rerender(<EntryCompletionAction completed onChange={change} />);
	expect(screen.queryByRole("alert")).toBeNull();
	expect(change.mock.calls).toEqual([[true], [true]]);
	expect(
		screen.getByRole("button", { name: "Als erledigt markiert." }),
	).toBeDisabled();
	await act(() => jest.advanceTimersByTime(1_400));
	expect(
		screen.getByRole("button", { name: "Als offen markieren" }),
	).toBeEnabled();
});

// Historical/externally changed entries must not replay the action's feedback.
test("shows existing status without replay and supports reduced-motion reopening", async () => {
	mockReducedMotion = true;
	const change = jest
		.fn<(completed: boolean) => Promise<void>>()
		.mockResolvedValue();
	const screen = await render(
		<EntryCompletionAction completed onChange={change} />,
		{ wrapper: DayovaThemeProvider },
	);
	await act(() => jest.advanceTimersByTime(2_000));
	expect(screen.queryByText("Als erledigt markiert.")).toBeNull();
	await fireEvent.press(
		screen.getByRole("button", { name: "Als offen markieren" }),
	);
	await screen.rerender(
		<EntryCompletionAction completed={false} onChange={change} />,
	);
	expect(screen.getByRole("button", { name: "Wieder offen." })).toBeDisabled();
	await act(() => jest.advanceTimersByTime(1_400));
	expect(
		screen.getByRole("button", { name: "Als erledigt markieren" }),
	).toBeEnabled();
});

// Lost authentication/deletion disables the public action rather than sending a write.
test("does not submit when unavailable", async () => {
	const change = jest.fn<(completed: boolean) => Promise<void>>();
	const screen = await render(
		<EntryCompletionAction completed={false} disabled onChange={change} />,
		{ wrapper: DayovaThemeProvider },
	);
	await fireEvent.press(screen.getByRole("button"));
	expect(change).not.toHaveBeenCalled();
});
