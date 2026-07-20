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
	};
});

describe("StudyTimeFactContent", () => {
	test("renders the selected study-time fact with a screen-reader heading", async () => {
		const screen = await render(
			<StudyTimeFactContent
				title="Deine Lernzeit reicht aus"
				studyTime="45 min"
			/>,
		);

		expect(
			screen.getByRole("header", { name: "Deine Lernzeit reicht aus" }),
		).toBeOnTheScreen();
		expect(screen.getByText("Schon gewusst?")).toBeOnTheScreen();
		expect(
			screen.getByText(
				"Deine 45 Minuten reichen aus, um eine starke Lernroutine aufzubauen. Studien zeigen: Kleine Lerneinheiten bleiben länger hängen als langes Pauken auf einmal.",
			),
		).toBeOnTheScreen();
	});
});
