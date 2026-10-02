import { describe, expect, jest, test } from "@jest/globals";
import { render } from "@testing-library/react-native";
import { StudyTimeFactContent } from "./study-time-fact-content";

jest.mock("react-native-reanimated", () => {
	const ReactNative =
		jest.requireActual<typeof import("react-native")>("react-native");
	const animationBuilder = {
		damping: () => animationBuilder,
		delay: () => animationBuilder,
		duration: () => animationBuilder,
		springify: () => animationBuilder,
	};

	return {
		__esModule: true,
		default: { View: ReactNative.View },
		FadeInUp: animationBuilder,
		useReducedMotion: () => false,
	};
});

jest.mock("~/components/ui/icon", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const icon = (name: string) => (props: Record<string, unknown>) =>
		React.createElement("Icon", { ...props, testID: `${name}-icon` });
	return {
		Bulb: icon("bulb"),
		Sparkles: icon("sparkles"),
	};
});

describe("StudyTimeFactContent", () => {
	test("renders the selected study-time fact with a screen-reader heading", async () => {
		const screen = await render(
			<StudyTimeFactContent
				title="Deine Lernzeit. Dein Anfang"
				studyTime="45"
			/>,
		);

		expect(
			screen.getByRole("header", {
				name: "Deine Lernzeit. Dein Anfang",
			}),
		).toBeOnTheScreen();
		expect(screen.getByText("Deine Auswahl")).toBeOnTheScreen();
		expect(
			screen.getByText(
				"45 Minuten an deinen Lerntagen sind ein guter Anfang. Du musst nicht alles auf einmal schaffen – du gibst dem Lernen einen festen Platz in deinem Alltag.",
			),
		).toBeOnTheScreen();
	});
});
