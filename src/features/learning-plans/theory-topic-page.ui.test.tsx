import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import type { SessionContentItem } from "./types";
import { TheoryTopicPage } from "./theory-topic-page";

jest.mock("react-native-reanimated", () => {
	const Native =
		jest.requireActual<typeof import("react-native")>("react-native");
	return {
		__esModule: true,
		default: { View: Native.View },
		FadeInDown: { duration: () => undefined },
		LinearTransition: { duration: () => undefined },
		useReducedMotion: () => true,
	};
});

jest.mock("react-native-safe-area-context", () => ({
	useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));

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

jest.mock("~/lib/theme", () => ({
	useDayovaTheme: jest.fn(() => ({
		colors: {
			light1: "#FFFFFF",
			secondaryText: "#697586",
		},
	})),
}));

const mockUseDayovaTheme = jest.requireMock<{
	useDayovaTheme: jest.Mock;
}>("~/lib/theme").useDayovaTheme;

const item: SessionContentItem = {
	id: "content-item" as SessionContentItem["id"],
	sessionId: "session" as SessionContentItem["sessionId"],
	phase: "theory",
	kind: "learnCard",
	title: "IT-Schadensszenarien",
	prompt: "Was könnte schlimmstenfalls passieren?",
	front: "Was könnte schlimmstenfalls passieren?",
	back: "Ein Ausfall kann den Betrieb unterbrechen.",
	explanation: "Ein Ausfall kann den Betrieb unterbrechen.",
	idealAnswer: "Schütze zuerst die geschäftskritischen Systeme.",
	choices: [],
	learningBlockIndex: 0,
	topicId: "it-schadensszenarien",
	questionAngle: "overview",
	coverageKey: "it-schadensszenarien:overview:0",
	estimatedSeconds: 40,
	sortOrder: 0,
	theoryContent: {
		conceptTitle: "IT-Schadensszenarien",
		question:
			"Was könnte schlimmstenfalls passieren, wenn ein Firmenserver plötzlich ausfällt?",
		explanation: "Der Betrieb kann vollständig zum Stillstand kommen.",
		keyPoints: [
			"Mitarbeitende können nicht mehr auf wichtige Daten zugreifen.",
		],
		example: "Ein Onlineshop kann keine Bestellungen mehr verarbeiten.",
		memoryCue: "Kritische Systeme brauchen einen Wiederanlaufplan.",
		commonMistake: "Nur den technischen Schaden zu betrachten.",
	},
};

describe("TheoryTopicPage", () => {
	beforeEach(() => {
		mockUseDayovaTheme.mockClear();
	});

	test("uses the question as the plain page heading without a read control", async () => {
		const screen = await render(
			<TheoryTopicPage
				currentIndex={0}
				isCompleting={false}
				item={item}
				onNext={() => undefined}
				onPrevious={() => undefined}
				total={1}
			/>,
		);

		const heading = screen.getByRole("header");
		expect(heading).toHaveTextContent(item.theoryContent?.question ?? "");
		expect(heading.props.className).not.toContain("bg-");
		expect(screen.queryByText("IT-Schadensszenarien")).toBeNull();
		expect(screen.queryByText("Leitfrage")).toBeNull();
		expect(screen.queryByRole("button", { name: /vorlesen/i })).toBeNull();
		expect(mockUseDayovaTheme).toHaveBeenCalledTimes(1);
	});

	test("starts every theory section collapsed and toggles independently", async () => {
		const screen = await render(
			<TheoryTopicPage
				currentIndex={0}
				isCompleting={false}
				item={item}
				onNext={() => undefined}
				onPrevious={() => undefined}
				total={1}
			/>,
		);

		const sections = [
			["Das solltest du wissen", item.theoryContent?.explanation],
			["Beispiel", item.theoryContent?.example],
			["Merksatz", item.theoryContent?.memoryCue],
			["Typischer Fehler", item.theoryContent?.commonMistake],
		] as const;

		for (const [title, content] of sections) {
			expect(content).toBeDefined();
			expect(screen.queryByText(content ?? "")).toBeNull();
			expect(
				screen.getByRole("button", { name: `${title} ausklappen` }).props
					.accessibilityState,
			).toEqual({ expanded: false });

			fireEvent.press(
				screen.getByRole("button", { name: `${title} ausklappen` }),
			);
			await waitFor(() =>
				expect(screen.getByText(content ?? "")).toBeOnTheScreen(),
			);
			expect(
				screen.getByRole("button", { name: `${title} einklappen` }).props
					.accessibilityState,
			).toEqual({ expanded: true });

			fireEvent.press(
				screen.getByRole("button", { name: `${title} einklappen` }),
			);
			await waitFor(() => expect(screen.queryByText(content ?? "")).toBeNull());
		}
	});

	test("also starts the focused Kernidee section collapsed", async () => {
		const focusedItem = { ...item, questionAngle: "recall" };
		const screen = await render(
			<TheoryTopicPage
				currentIndex={0}
				isCompleting={false}
				item={focusedItem}
				onNext={() => undefined}
				onPrevious={() => undefined}
				total={1}
			/>,
		);

		expect(
			screen.queryByText(item.theoryContent?.explanation ?? ""),
		).toBeNull();
		expect(
			screen.getByRole("button", { name: "Kernidee ausklappen" }).props
				.accessibilityState,
		).toEqual({ expanded: false });

		fireEvent.press(
			screen.getByRole("button", { name: "Kernidee ausklappen" }),
		);
		await waitFor(() =>
			expect(
				screen.getByText(item.theoryContent?.explanation ?? ""),
			).toBeOnTheScreen(),
		);
	});
});
