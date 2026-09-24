import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { useState } from "react";
import {
	SelectionBadge,
	SelectionControl,
	SelectionIndicator,
	SelectionText,
} from "./selection-control";

let mockReducedMotion = false;
const mockAnimate = jest.fn();
jest.mock("react-native-reanimated", () => ({
	...jest.requireActual<Record<string, unknown>>(
		"../../../tests/mocks/selection-reanimated.cjs",
	),
	useReducedMotion: () => mockReducedMotion,
	withTiming: (value: number) => {
		mockAnimate();
		return value;
	},
	withSpring: (value: number) => {
		mockAnimate();
		return value;
	},
}));
jest.mock("~/components/ui/icon", () => ({ Check: () => null }));
jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		colors: jest.requireActual<typeof import("~/lib/design-system")>(
			"~/lib/design-system",
		).DAYOVA_DESIGN_SYSTEM.colors,
	}),
}));

type Appearance = "card" | "pill" | "payment";
function Choices({
	appearance,
	disabled = false,
	onSelect,
}: {
	appearance: Appearance;
	disabled?: boolean;
	onSelect: (id: string) => void;
}) {
	const [selected, setSelected] = useState("monthly");
	return (
		<>
			{["annual", "monthly"].map((id) => (
				<SelectionControl
					key={id}
					appearance={appearance}
					selected={selected === id}
					disabled={disabled}
					accessibilityLabel={id}
					onPress={() => {
						setSelected(id);
						onSelect(id);
					}}
				>
					<SelectionBadge>{id[0]}</SelectionBadge>
					<SelectionText>{id}</SelectionText>
					<SelectionIndicator plain={appearance === "pill"} />
				</SelectionControl>
			))}
		</>
	);
}
beforeEach(() => {
	mockReducedMotion = false;
	jest.clearAllMocks();
});

describe.each<Appearance>([
	"card",
	"pill",
	"payment",
])("%s selection", (appearance) => {
	test("keeps one checked choice during rapid changes without waiting for motion", async () => {
		const onSelect = jest.fn();
		const screen = await render(
			<Choices appearance={appearance} onSelect={onSelect} />,
		);
		for (const id of ["annual", "monthly", "annual", "monthly"]) {
			await fireEvent.press(screen.getByRole("radio", { name: id }));
			expect(screen.getAllByRole("radio", { checked: true })).toHaveLength(1);
			expect(screen.getByRole("radio", { name: id })).toBeChecked();
		}
		expect(onSelect.mock.calls).toEqual([
			["annual"],
			["monthly"],
			["annual"],
			["monthly"],
		]);
	});
	test("does not commit canceled presses or transform the hit target", async () => {
		const onSelect = jest.fn();
		const screen = await render(
			<Choices appearance={appearance} onSelect={onSelect} />,
		);
		const annual = screen.getByRole("radio", { name: "annual" });
		await fireEvent(annual, "pressIn");
		await fireEvent(annual, "pressOut");
		expect(onSelect).not.toHaveBeenCalled();
		expect(screen.getByRole("radio", { name: "monthly" })).toBeChecked();
		expect(annual.props.style).toBeUndefined();
	});
	test("locks the choice when disabled during a press", async () => {
		const onSelect = jest.fn();
		const screen = await render(
			<Choices appearance={appearance} onSelect={onSelect} />,
		);
		await fireEvent(screen.getByRole("radio", { name: "annual" }), "pressIn");
		await screen.rerender(
			<Choices appearance={appearance} disabled onSelect={onSelect} />,
		);
		await fireEvent.press(screen.getByRole("radio", { name: "annual" }));
		expect(onSelect).not.toHaveBeenCalled();
		expect(screen.getByRole("radio", { name: "monthly" })).toBeChecked();
		expect(screen.getByRole("radio", { name: "annual" })).toBeDisabled();
	});
	test("selects without any nonessential animation under reduced motion", async () => {
		mockReducedMotion = true;
		const screen = await render(
			<Choices appearance={appearance} onSelect={jest.fn()} />,
		);
		const annual = screen.getByRole("radio", { name: "annual" });
		await fireEvent(annual, "pressIn");
		await fireEvent(annual, "pressOut");
		await fireEvent.press(annual);
		expect(annual).toBeChecked();
		expect(mockAnimate).not.toHaveBeenCalled();
	});
});

test("checkboxes toggle independently rather than imposing radio behavior", async () => {
	function Days() {
		const [days, setDays] = useState<string[]>([]);
		return (
			<>
				{["Montag", "Dienstag"].map((day) => (
					<SelectionControl
						key={day}
						appearance="pill"
						accessibilityRole="checkbox"
						accessibilityLabel={day}
						selected={days.includes(day)}
						onPress={() =>
							setDays((current) =>
								current.includes(day)
									? current.filter((x) => x !== day)
									: [...current, day],
							)
						}
					>
						<SelectionIndicator plain />
						<SelectionText>{day}</SelectionText>
					</SelectionControl>
				))}
			</>
		);
	}
	const screen = await render(<Days />);
	await fireEvent.press(screen.getByRole("checkbox", { name: "Montag" }));
	await fireEvent.press(screen.getByRole("checkbox", { name: "Dienstag" }));
	expect(screen.getAllByRole("checkbox", { checked: true })).toHaveLength(2);
	await fireEvent.press(screen.getByRole("checkbox", { name: "Montag" }));
	expect(screen.getByRole("checkbox", { name: "Montag" })).not.toBeChecked();
	expect(screen.getByRole("checkbox", { name: "Dienstag" })).toBeChecked();
});
