import { expect, jest, test } from "@jest/globals";
import { render } from "@testing-library/react-native";
import { AnimatedFlowerLoader } from "./animated-flower-loader";

jest.mock("react-native-reanimated", () => ({
	...jest.requireActual<Record<string, unknown>>(
		"../../../tests/mocks/selection-reanimated.cjs",
	),
	cancelAnimation: jest.fn(),
	Easing: {
		cubic: "cubic",
		inOut: (value: unknown) => value,
		out: (value: unknown) => value,
	},
	useReducedMotion: () => true,
	withDelay: (_duration: number, value: unknown) => value,
	withRepeat: (value: unknown) => value,
	withSequence: (...values: unknown[]) => values.at(-1),
}));

test("announces loading and updates the accessible status supplied by its caller", async () => {
	const screen = await render(<AnimatedFlowerLoader />);
	expect(
		screen.getByRole("progressbar", { name: "Wird geladen" }),
	).toHaveAccessibilityValue({ text: "Wird geladen" });
	await screen.rerender(
		<AnimatedFlowerLoader accessibilityLabel="Lernplan wird erstellt" />,
	);
	expect(
		screen.getByRole("progressbar", { name: "Lernplan wird erstellt" }),
	).toHaveAccessibilityValue({ text: "Lernplan wird erstellt" });
	expect(
		screen.queryByRole("progressbar", { name: "Wird geladen" }),
	).toBeNull();
});
