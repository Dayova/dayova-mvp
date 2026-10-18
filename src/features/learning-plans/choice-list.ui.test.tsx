import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { useState } from "react";
import type { Id } from "#convex/_generated/dataModel";
import { ChoiceList } from "./choice-list";

let mockReducedMotion = false;
const mockAnimate = jest.fn();

jest.mock("react-native-reanimated", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const Native =
		jest.requireActual<typeof import("react-native")>("react-native");
	return {
		__esModule: true,
		default: {
			View: Native.View,
			createAnimatedComponent: (component: unknown) => component,
		},
		Easing: { cubic: "cubic", out: (value: unknown) => value },
		useReducedMotion: () => mockReducedMotion,
		useSharedValue: (initial: number) => {
			const ref = React.useRef(initial);
			return React.useMemo(
				() => ({
					get: () => ref.current,
					set: (value: number) => {
						ref.current = value;
					},
				}),
				[],
			);
		},
		useAnimatedStyle: (factory: () => unknown) => factory(),
		interpolateColor: (value: number, _input: number[], output: string[]) =>
			output[value === 0 ? 0 : 1],
		// Keep animations pending so selection cannot depend on completion callbacks.
		withTiming: (value: number) => {
			mockAnimate(value);
			return value;
		},
		withSpring: (value: number) => {
			mockAnimate(value);
			return value;
		},
	};
});

jest.mock("~/components/ui/icon", () => ({ Check: () => null }));

jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		colors: jest.requireActual<typeof import("~/lib/design-system")>(
			"~/lib/design-system",
		).DAYOVA_DESIGN_SYSTEM.colors,
	}),
}));

const item = {
	id: "question-1" as Id<"learningSessionContentItems">,
	choices: [
		{ id: "a", text: "Er behauptet, er sei aus dem Bett gefallen." },
		{ id: "b", text: "Er schiebt die Schuld auf den Schreiber Licht." },
	],
};

function Question({ disabled = false, onSelect = (_id: string) => {} }) {
	const [selected, setSelected] = useState<string | null>(null);
	return (
		<ChoiceList
			item={item}
			selectedChoiceId={selected}
			disabled={disabled}
			onSelect={(id) => {
				setSelected(id);
				onSelect(id);
			}}
		/>
	);
}

describe("answer selection", () => {
	beforeEach(() => {
		mockReducedMotion = false;
		jest.clearAllMocks();
	});

	test("switches answers immediately during repeated taps and exposes one checked radio", async () => {
		const onSelect = jest.fn();
		const screen = await render(<Question onSelect={onSelect} />);
		for (const name of ["A.", "B.", "A.", "B."]) {
			await fireEvent.press(
				screen.getByRole("radio", { name: new RegExp(`^${name}`) }),
			);
			expect(screen.getAllByRole("radio", { checked: true })).toHaveLength(1);
			expect(
				screen.getByRole("radio", { name: new RegExp(`^${name}`) }),
			).toBeChecked();
		}
		expect(onSelect.mock.calls).toEqual([["a"], ["b"], ["a"], ["b"]]);
	});

	test("a canceled press does not change the answer", async () => {
		const onSelect = jest.fn();
		const screen = await render(<Question onSelect={onSelect} />);
		const answer = screen.getAllByRole("radio")[0];
		await fireEvent(answer, "pressIn");
		await fireEvent(answer, "pressOut");
		expect(onSelect).not.toHaveBeenCalled();
		expect(screen.queryAllByRole("radio", { checked: true })).toHaveLength(0);
	});

	test("locks selection while an answer is being submitted", async () => {
		const onSelect = jest.fn();
		const screen = await render(<Question disabled onSelect={onSelect} />);
		for (const answer of screen.getAllByRole("radio")) {
			expect(answer).toBeDisabled();
			await fireEvent.press(answer);
		}
		expect(onSelect).not.toHaveBeenCalled();
	});

	test("supports selection with all nonessential motion disabled", async () => {
		mockReducedMotion = true;
		const screen = await render(<Question />);
		const answer = screen.getAllByRole("radio")[0];
		await fireEvent(answer, "pressIn");
		await fireEvent(answer, "pressOut");
		await fireEvent.press(answer);
		expect(screen.getAllByRole("radio", { checked: true })).toHaveLength(1);
		expect(mockAnimate).not.toHaveBeenCalled();
	});
});
