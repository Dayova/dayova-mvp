import { describe, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render } from "@testing-library/react-native";
import { AccessibilityInfo, Animated, StyleSheet, View } from "react-native";
import { NotchedActionCard } from "./notched-action-card";

jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		colors: {
			border: "#DCE6EE",
			surface: "#FFFFFF",
		},
	}),
}));

function findVectorBackground(node: unknown): {
	props: Record<string, unknown>;
} {
	if (node && typeof node === "object") {
		const candidate = node as {
			children?: unknown[];
			props?: Record<string, unknown>;
		};

		if (typeof candidate.props?.vbHeight === "number") {
			return { props: candidate.props };
		}

		for (const child of candidate.children ?? []) {
			try {
				return findVectorBackground(child);
			} catch {
				// Continue until the SVG host node is found.
			}
		}
	}

	throw new Error("Vector card background not found");
}

describe("NotchedActionCard", () => {
	test("renders shared artwork without creating a dead press target", async () => {
		const screen = await render(
			<NotchedActionCard
				actionIcon={<View />}
				pressType="none"
				testID="artwork-card"
			>
				<View />
			</NotchedActionCard>,
		);

		const artwork = screen.getByTestId("artwork-card", {
			includeHiddenElements: true,
		});
		expect(artwork.props).toMatchObject({
			accessible: false,
			accessibilityElementsHidden: true,
			importantForAccessibility: "no-hide-descendants",
			pointerEvents: "none",
		});
		expect(screen.queryByRole("button")).toBeNull();
	});

	test("expands its vector background to contain content taller than its minimum height", async () => {
		const screen = await render(
			<NotchedActionCard
				actionAccessibilityLabel="Aktion öffnen"
				actionIcon={<View />}
				cardHeight={100}
				onPress={() => undefined}
				pressType="action"
				testID="card"
			>
				<View style={{ height: 160 }} />
			</NotchedActionCard>,
		);

		await act(() =>
			screen.getByTestId("card").props.onLayout({
				nativeEvent: { layout: { height: 160, width: 320, x: 0, y: 0 } },
			}),
		);

		const background = findVectorBackground(screen.toJSON());
		expect(background.props.height).toBe(160);
		expect(background.props.vbWidth).toBe(320);
		expect(background.props.vbHeight).toBe(160);
	});
});

test("the separate action hit target animates its visible circle and dispatches immediately", async () => {
	const preference = jest
		.spyOn(AccessibilityInfo, "isReduceMotionEnabled")
		.mockResolvedValue(false);
	const timing = jest.spyOn(Animated, "timing").mockImplementation((value) => {
		(value as Animated.Value).setValue(0.97);
		return {
			start: (callback) => callback?.({ finished: true }),
			stop: jest.fn(),
			reset: jest.fn(),
		};
	});
	const spring = jest.spyOn(Animated, "spring");
	try {
		const onPress = jest.fn();
		const screen = await render(
			<NotchedActionCard
				actionAccessibilityLabel="Öffnen"
				actionIcon={<View />}
				onPress={onPress}
				pressType="action"
			>
				<View />
			</NotchedActionCard>,
		);
		const action = screen.getByRole("button", { name: "Öffnen" });
		await fireEvent(action, "pressIn", {});
		expect(timing).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ toValue: 0.97 }),
		);
		const animatedScale = timing.mock.calls[0][0];
		// The visible circle uses the animated value; the independent hit target does not.
		const tree = JSON.stringify(screen.toJSON());
		expect(tree).toContain('"scale":0.97');
		expect(StyleSheet.flatten(action.props.style).transform).toBeUndefined();
		await fireEvent.press(action);
		expect(onPress).toHaveBeenCalledTimes(1);
		await fireEvent(action, "pressOut", {});
		expect(spring).toHaveBeenCalledWith(
			animatedScale,
			expect.objectContaining({ toValue: 1 }),
		);
	} finally {
		preference.mockRestore();
		timing.mockRestore();
		spring.mockRestore();
	}
});
