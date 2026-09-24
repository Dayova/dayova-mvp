import { describe, expect, jest, test } from "@jest/globals";
import { render } from "@testing-library/react-native";
import { IntroLearningPathArtwork } from "./intro-learning-path-artwork";

const mockWithRepeat = jest.fn((value: unknown) => value);

jest.mock("react-native-reanimated", () => {
	const Native =
		jest.requireActual<typeof import("react-native")>("react-native");
	return {
		__esModule: true,
		default: { View: Native.View },
		cancelAnimation: jest.fn(),
		Easing: {
			inOut: (value: unknown) => value,
			sin: "sin",
		},
		useAnimatedStyle: (factory: () => unknown) => factory(),
		useReducedMotion: () => false,
		useSharedValue: (initialValue: number) => {
			let value = initialValue;
			return {
				get: () => value,
				set: (nextValue: number) => {
					value = nextValue;
				},
			};
		},
		withRepeat: mockWithRepeat,
		withTiming: (value: unknown) => value,
	};
});

jest.mock("~/components/ui/icon", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const Native =
		jest.requireActual<typeof import("react-native")>("react-native");
	const Icon = (props: Record<string, unknown>) =>
		React.createElement(Native.View, props);

	return new Proxy(
		{ __esModule: true },
		{
			get: (target, property) =>
				property in target ? target[property as keyof typeof target] : Icon,
		},
	);
});

describe("IntroLearningPathArtwork", () => {
	test("renders a focused excerpt through the shared decorative path mode", async () => {
		const screen = await render(<IntroLearningPathArtwork />);
		const hidden = { includeHiddenElements: true };
		const artwork = screen.getByTestId("intro-learning-path-artwork", hidden);

		expect(artwork.props).toMatchObject({
			accessible: false,
			accessibilityElementsHidden: true,
			importantForAccessibility: "no-hide-descendants",
		});
		expect(
			screen.getByTestId("learning-path-artwork-visual", hidden).props,
		).toMatchObject({
			accessible: false,
			accessibilityElementsHidden: true,
			importantForAccessibility: "no-hide-descendants",
			pointerEvents: "none",
		});
		expect(
			screen.getByTestId("learning-path-node-intro-path-completed", hidden),
		).toBeOnTheScreen();
		expect(
			screen.getByTestId("learning-path-node-intro-path-current", hidden),
		).toBeOnTheScreen();
		expect(
			screen.getByTestId("learning-path-node-intro-path-locked", hidden),
		).toBeOnTheScreen();
		expect(
			screen.getByTestId("learning-path-node-halo-intro-path-current", hidden),
		).toBeOnTheScreen();
		expect(
			screen.getByTestId("learning-path-node-puck-intro-path-current", hidden)
				.props.style.width,
		).toBe(60);
		expect(
			screen.getByTestId("learning-path-node-puck-intro-path-locked", hidden)
				.props.style.width,
		).toBe(52);
		expect(screen.queryByRole("button", hidden)).toBeNull();
		expect(mockWithRepeat).not.toHaveBeenCalled();
	});

	test("preserves explicit numeric artwork dimensions", async () => {
		const screen = await render(
			<IntroLearningPathArtwork width={250} height={168} />,
		);
		const artwork = screen.getByTestId("intro-learning-path-artwork", {
			includeHiddenElements: true,
		});

		expect(artwork).toHaveStyle({ width: 250, height: 168 });
	});
});
