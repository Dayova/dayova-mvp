import { describe, expect, jest, test } from "@jest/globals";
import { act, render } from "@testing-library/react-native";
import { View } from "react-native";
import { Path } from "react-native-svg";
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
	test("widens the notch for a pill without changing card height or action semantics", async () => {
		const screen = await render(
			<NotchedActionCard
				pressType="card"
				cardHeight={240}
				actionSize={48}
				actionWidth={144}
				actionIcon={<View />}
				cardAccessibilityLabel="Jetzt lernen"
				onPress={() => undefined}
				testID="pill-card"
			/>,
		);
		expect(screen.getByTestId("pill-card")).toHaveStyle({ minHeight: 240 });
		expect(screen.getAllByRole("button")).toHaveLength(1);
		expect(JSON.stringify(screen.toJSON())).toContain("H248");
	});
	test("clips optional artwork independently for each card without adding actions", async () => {
		const screen = await render(
			<View>
				{["first", "second"].map((id) => (
					<NotchedActionCard
						key={id}
						pressType="card"
						onPress={() => undefined}
						cardAccessibilityLabel={id}
						actionIcon={<View />}
						fillColor="#F1F7FB"
						cardHeight={144}
						contentClassName="p-5"
						backgroundArtwork={<Path testID={`artwork-${id}`} d="M0 0H20" />}
					>
						<View />
					</NotchedActionCard>
				))}
			</View>,
		);
		expect(screen.getAllByRole("button")).toHaveLength(2);
		expect(
			screen.getByTestId("artwork-first", { includeHiddenElements: true }),
		).toBeTruthy();
		const clipIds = JSON.stringify(screen.toJSON()).match(
			/notched-card-[a-zA-Z0-9_-]+/g,
		);
		expect(new Set(clipIds).size).toBe(2);
	});
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
