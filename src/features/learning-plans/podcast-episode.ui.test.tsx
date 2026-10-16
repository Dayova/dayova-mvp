import { expect, jest, test } from "@jest/globals";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { PodcastPlayer } from "./podcast-episode";

const mockPlayer = {
	seekTo: jest.fn(async (_seconds: number) => {}),
	play: jest.fn(),
	pause: jest.fn(),
	replace: jest.fn(),
	setPlaybackRate: jest.fn(),
	setActiveForLockScreen: jest.fn(),
	get currentTime() {
		return 30;
	},
};
jest.mock("expo-audio", () => ({
	useAudioPlayer: () => mockPlayer,
	useAudioPlayerStatus: () => ({
		isLoaded: true,
		duration: 120,
		currentTime: 30,
		playing: false,
		didJustFinish: false,
		error: null,
	}),
	setAudioModeAsync: jest.fn(async () => {}),
}));
jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({ colors: { primary: "#00BAFF" } }),
}));
jest.mock("~/components/ui/button", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const { Pressable } =
		jest.requireActual<typeof import("react-native")>("react-native");
	return {
		Button: (props: Record<string, unknown>) =>
			React.createElement(Pressable, { ...props, accessibilityRole: "button" }),
	};
});
jest.mock("~/components/ui/flow-progress-bar", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const { View } =
		jest.requireActual<typeof import("react-native")>("react-native");
	return {
		FlowProgressBar: (props: Record<string, unknown>) =>
			React.createElement(View, props),
	};
});

test("restores position without autoplay and exposes playback, seek and speed controls", async () => {
	const progress = jest.fn(async (_seconds: number) => {});
	const screen = await render(
		<PodcastPlayer
			url="https://example.test/audio.wav"
			title="Metaphern"
			initialPosition={30}
			onProgress={progress}
		/>,
	);
	await waitFor(() => expect(mockPlayer.seekTo).toHaveBeenCalledWith(30));
	expect(mockPlayer.play).not.toHaveBeenCalled();
	await fireEvent.press(
		screen.getByRole("button", { name: "Podcast abspielen" }),
	);
	await waitFor(() => expect(mockPlayer.play).toHaveBeenCalled());
	await fireEvent.press(screen.getByText("15 Sek. zurück"));
	expect(mockPlayer.seekTo).toHaveBeenCalledWith(15);
	await fireEvent.press(screen.getByText("1× Tempo"));
	expect(mockPlayer.setPlaybackRate).toHaveBeenCalledWith(1.25);
	const nativePosition = jest.spyOn(mockPlayer, "currentTime", "get");
	nativePosition.mockImplementation(() => {
		throw new Error("Native object released");
	});
	await screen.unmount();
	expect(progress).toHaveBeenLastCalledWith(30);
	nativePosition.mockRestore();
});
