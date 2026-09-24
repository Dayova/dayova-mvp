import { expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { useState } from "react";
import type { PodcastScript } from "#convex/podcastContent";
import { PodcastLesson } from "./podcast-lesson";
import script from "./podcast-preview-script.json";

jest.mock("./podcast-episode", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const { Pressable, Text } =
		jest.requireActual<typeof import("react-native")>("react-native");
	return {
		PodcastPlayer: ({ onFinished }: { onFinished: () => void }) =>
			React.createElement(
				Pressable,
				{
					onPress: onFinished,
					accessibilityRole: "button",
					accessibilityLabel: "Audio ended",
				},
				React.createElement(Text, null, "Player"),
			),
	};
});
jest.mock("~/components/ui/button", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const { Pressable } =
		jest.requireActual<typeof import("react-native")>("react-native");
	return {
		Button: (props: Record<string, unknown>) =>
			React.createElement(Pressable, { ...props, accessibilityRole: "button" }),
	};
});

function Harness({ save = async () => {} }: { save?: () => Promise<void> }) {
	const [answers, setAnswers] = useState<number[]>([]);
	return (
		<PodcastLesson
			title="Metaphern"
			goal="Sprachliche Bilder verstehen"
			script={script as PodcastScript}
			audio="fixture"
			position={0}
			listened={false}
			answers={answers}
			onExit={() => {}}
			onProgress={async () => {}}
			onAnswer={async (question, option) => {
				await save();
				setAnswers((previous) =>
					script.questions.map((_, index) =>
						index === question ? option : (previous[index] ?? -1),
					),
				);
			}}
		/>
	);
}

test("listen first, then exactly three separately checked questions and a summary", async () => {
	const screen = await render(<Harness />);
	expect(screen.queryByText(script.questions[0].prompt)).toBeNull();
	expect(screen.queryByText("Weiter zu den 3 Fragen")).toBeNull();
	await fireEvent.press(screen.getByRole("button", { name: "Audio ended" }));
	expect(screen.queryByText(script.questions[0].prompt)).toBeNull();
	await fireEvent.press(screen.getByText("Weiter zu den 3 Fragen"));
	expect(screen.queryByText("Player")).toBeNull();
	for (let index = 0; index < 3; index++) {
		const q = script.questions[index];
		expect(screen.getByText(`FRAGE ${index + 1} VON 3`)).toBeTruthy();
		expect(screen.getByText(q.prompt)).toBeTruthy();
		if (index < 2)
			expect(screen.queryByText(script.questions[index + 1].prompt)).toBeNull();
		await fireEvent.press(
			screen.getByRole("radio", { name: q.options[q.correctIndex] }),
		);
		expect(screen.queryByText("Richtig!")).toBeNull();
		await fireEvent.press(screen.getByText("Antwort prüfen"));
		expect(await screen.findByText("Richtig!")).toBeTruthy();
		await fireEvent.press(
			screen.getByText(
				index === 2 ? "Zusammenfassung ansehen" : "Nächste Frage",
			),
		);
	}
	expect(screen.getByText("Das nimmst du mit")).toBeTruthy();
	expect(screen.getByText(/3 von 3/)).toBeTruthy();
	expect(screen.getByText(/Lernstand bleiben unverändert/)).toBeTruthy();
});

test("failed answer save keeps the question and allows retry", async () => {
	const save = jest
		.fn<() => Promise<void>>()
		.mockRejectedValueOnce(new Error("offline"))
		.mockResolvedValueOnce();
	const screen = await render(<Harness save={save} />);
	await fireEvent.press(screen.getByRole("button", { name: "Audio ended" }));
	await fireEvent.press(screen.getByText("Weiter zu den 3 Fragen"));
	await fireEvent.press(
		screen.getByRole("radio", { name: script.questions[0].options[0] }),
	);
	await fireEvent.press(screen.getByText("Antwort prüfen"));
	expect(await screen.findByRole("alert")).toBeTruthy();
	expect(screen.queryByText("Nächste Frage")).toBeNull();
	await fireEvent.press(screen.getByText("Antwort prüfen"));
	expect(await screen.findByText("Nächste Frage")).toBeTruthy();
});
