import { expect, jest, test } from "@jest/globals";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import type { PodcastScript } from "#convex/podcastContent";
import { PodcastPlayer, PodcastStudyContent } from "./podcast-episode";
import script from "./podcast-preview-script.json";

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

test("transcript is optional and comprehension choices provide feedback without completion", async () => {
	const onAnswer = jest.fn();
	const screen = await render(
		<PodcastStudyContent
			script={script as PodcastScript}
			answers={[-1, -1]}
			onAnswer={onAnswer}
		/>,
	);
	expect(screen.queryByText(script.turns[0].text)).toBeNull();
	await fireEvent.press(screen.getByText("Transkript mitlesen"));
	expect(screen.getByText(script.turns[0].text)).toBeTruthy();
	await fireEvent.press(
		screen.getByRole("radio", { name: script.questions[0].options[0] }),
	);
	expect(onAnswer).toHaveBeenCalledWith(0, 0);
	await screen.rerender(
		<PodcastStudyContent
			script={script as PodcastScript}
			answers={[0, -1]}
			onAnswer={onAnswer}
		/>,
	);
	expect(
		screen.getByText(`Richtig. ${script.questions[0].explanation}`),
	).toBeTruthy();
	expect(screen.getByText(/Anhören allein schließt/)).toBeTruthy();
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
