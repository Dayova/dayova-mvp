import { beforeEach, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render } from "@testing-library/react-native";
import { EntryCompletionAction } from "./entry-completion-action";

let mockReducedMotion = false;
let mockPress: () => void;
const mockFade = jest.fn(() => "fade");
jest.mock("react-native-reanimated", () => {
	const Native =
		jest.requireActual<typeof import("react-native")>("react-native");
	return {
		__esModule: true,
		default: { View: Native.View },
		useReducedMotion: () => mockReducedMotion,
		FadeIn: { duration: () => mockFade() },
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
	jest.clearAllMocks();
	mockReducedMotion = false;
});

test("waits for persistence and guards even two synchronous presses", async () => {
	let finish!: () => void;
	const change = jest.fn(
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
	expect(screen.queryByText("Als erledigt markiert.")).toBeNull();
	await act(() => finish());
	expect(screen.queryByText("Als erledigt markiert.")).toBeNull();
	await screen.rerender(<EntryCompletionAction completed onChange={change} />);
	expect(screen.getByText("Als erledigt markiert.")).toBeTruthy();
	expect(screen.getByRole("button").props.accessibilityState.disabled).toBe(
		false,
	);
	expect(mockFade).toHaveBeenCalled();
});

test("shows no false success on rejection and permits retry", async () => {
	const change = jest
		.fn<() => Promise<void>>()
		.mockRejectedValueOnce(new Error("offline"))
		.mockResolvedValueOnce();
	const screen = await render(
		<EntryCompletionAction completed={false} onChange={change} />,
	);
	await fireEvent.press(screen.getByRole("button"));
	expect(screen.getByRole("alert")).toBeTruthy();
	expect(screen.queryByText("Als erledigt markiert.")).toBeNull();
	expect(screen.getByRole("button").props.accessibilityState.disabled).toBe(
		false,
	);
	await fireEvent.press(screen.getByRole("button"));
	expect(change).toHaveBeenCalledTimes(2);
	expect(screen.queryByRole("alert")).toBeNull();
});

test("does not celebrate historical completion and confirms reopening without motion", async () => {
	mockReducedMotion = true;
	const change = jest.fn<() => Promise<void>>().mockResolvedValue();
	const screen = await render(
		<EntryCompletionAction completed onChange={change} />,
	);
	expect(screen.queryByText("Als erledigt markiert.")).toBeNull();
	await fireEvent.press(screen.getByRole("button"));
	expect(change).toHaveBeenCalledWith(false);
	await screen.rerender(
		<EntryCompletionAction completed={false} onChange={change} />,
	);
	expect(screen.getByText("Wieder offen.")).toBeTruthy();
	expect(mockFade).not.toHaveBeenCalled();
});

test("unavailable actions never save", async () => {
	const change = jest.fn<() => Promise<void>>();
	await render(
		<EntryCompletionAction completed={false} disabled onChange={change} />,
	);
	await act(() => mockPress());
	expect(change).not.toHaveBeenCalled();
});
