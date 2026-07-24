import { beforeEach, describe, expect, test } from "@jest/globals";
import { act, render } from "@testing-library/react-native";
import { Text } from "react-native";
import DayovaSystemAppearance from "../../modules/dayova-system-appearance";
import { useSystemColorScheme } from "./system-color-scheme.ios";

type AppearanceMock = {
	__emit: (colorScheme: "light" | "dark") => void;
	__emitResume: (generation: number) => void;
	__getReleaseSnapshotShieldGenerations: () => number[];
	__getSubscriberCount: () => number;
	__reset: () => void;
	__setBeforeNextSubscription: (colorScheme: "light" | "dark") => void;
};

const appearanceMock = DayovaSystemAppearance as unknown as AppearanceMock;

function ColorSchemeProbe() {
	return <Text>{useSystemColorScheme()}</Text>;
}

describe("useSystemColorScheme on iOS", () => {
	beforeEach(() => appearanceMock.__reset());

	test("does not miss a native appearance change during subscription", async () => {
		appearanceMock.__setBeforeNextSubscription("dark");

		const screen = await render(<ColorSchemeProbe />);

		expect(screen.getByText("dark")).toBeOnTheScreen();
	});

	test("updates from native changes and removes the subscription on unmount", async () => {
		const screen = await render(<ColorSchemeProbe />);

		expect(screen.getByText("light")).toBeOnTheScreen();
		expect(appearanceMock.__getSubscriberCount()).toBe(1);

		await act(() => appearanceMock.__emit("dark"));
		expect(screen.getByText("dark")).toBeOnTheScreen();

		await act(() => screen.unmount());
		expect(appearanceMock.__getSubscriberCount()).toBe(0);
	});

	test("releases the current snapshot shield after a resumed commit", async () => {
		await render(<ColorSchemeProbe />);

		expect(appearanceMock.__getReleaseSnapshotShieldGenerations()).toEqual([]);

		await act(() => appearanceMock.__emitResume(7));
		expect(appearanceMock.__getReleaseSnapshotShieldGenerations()).toEqual([7]);
	});

	test("coalesces rapid resume acknowledgements to the latest generation", async () => {
		await render(<ColorSchemeProbe />);

		await act(() => {
			appearanceMock.__emitResume(8);
			appearanceMock.__emitResume(9);
		});

		expect(appearanceMock.__getReleaseSnapshotShieldGenerations()).toEqual([9]);
	});
});
