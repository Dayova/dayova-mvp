import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import {
	getExamCountdownLabel,
	LearningPath,
	SessionPreviewCard,
} from "~/app/learning-plans/[planId]/index";
import type { PlanSession } from "~/features/learning-plans/types";

jest.mock("expo-router", () => ({
	Stack: { Screen: () => null },
	useLocalSearchParams: () => ({ planId: "plan_1" }),
	useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("convex/react", () => ({
	useAction: () => jest.fn(),
	useConvexAuth: () => ({ isAuthenticated: true }),
	useQuery: () => null,
}));

jest.mock("#convex/_generated/api", () => ({
	api: {
		learningPlanAi: { ensureSessionContent: "ensureSessionContent" },
		learningPlans: { getSnapshot: "getSnapshot" },
	},
}));

jest.mock("~/context/AuthContext", () => ({
	useAuthSession: () => ({ user: { clerkId: "user_1" } }),
}));

jest.mock("~/components/ui/screen", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const Native =
		jest.requireActual<typeof import("react-native")>("react-native");
	return {
		Screen: ({ children }: { children: import("react").ReactNode }) =>
			React.createElement(Native.View, null, children),
	};
});

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
		FadeIn: { duration: () => undefined },
		FadeOut: { duration: () => undefined },
		useAnimatedStyle: (factory: () => unknown) => factory(),
		useReducedMotion: () => true,
		useSharedValue: (initialValue: number) => {
			let value = initialValue;
			return {
				get: () => value,
				set: (nextValue: number) => {
					value = nextValue;
				},
			};
		},
		withRepeat: (value: unknown) => value,
		withSequence: (value: unknown) => value,
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

jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		colors: {
			border: "#DCE6EE",
			secondaryText: "#697586",
			surface: "#FFFFFF",
			text: "#1A1A1A",
		},
	}),
}));

const session = (
	id: string,
	overrides: Partial<PlanSession> = {},
): PlanSession => ({
	id: id as PlanSession["id"],
	phase: "theory",
	title: "Lineare Funktionen verstehen",
	dateKey: "2026-08-04",
	dateLabel: "4. August 2026",
	startTime: "17:20",
	durationMinutes: 15,
	goal: "Verstehe Steigung und Achsenabschnitt.",
	tasks: [],
	expectedOutcome: "Du kannst eine Gerade erklären.",
	sortOrder: 0,
	completed: false,
	executionStatus: "notStarted",
	planningStatus: "committed",
	...overrides,
});

describe("learning-plan path", () => {
	test("uses a named action for the available session", async () => {
		const onOpen = jest.fn();
		const screen = await render(
			<SessionPreviewCard
				canOpen
				session={session("session_1")}
				onOpen={onOpen}
			/>,
		);

		const startButton = screen.getByRole("button", {
			name: "Lernsession starten: Lineare Funktionen verstehen",
		});
		expect(screen.getByText("Lernsession starten")).toBeOnTheScreen();

		fireEvent.press(startButton);
		expect(onOpen).toHaveBeenCalledTimes(1);
	});

	test("explains that a provisional session can still change", async () => {
		const screen = await render(
			<SessionPreviewCard
				canOpen={false}
				session={session("session_2", { planningStatus: "provisional" })}
				onOpen={() => undefined}
			/>,
		);

		expect(screen.getByText("Danach · Vorschau")).toBeOnTheScreen();
		expect(
			screen.getByText(
				"Diese Vorschau kann sich nach deinem nächsten Abschluss ändern.",
			),
		).toBeOnTheScreen();
	});

	test("keeps node details out of the path and connects it to the exam", async () => {
		const sessions = [
			session("session_done", {
				completed: true,
				executionStatus: "completed",
			}),
			session("session_current"),
			session("session_preview", {
				dateKey: "2026-08-06",
				dateLabel: "6. August 2026",
				planningStatus: "provisional",
				sortOrder: 1,
			}),
		];
		const screen = await render(
			<LearningPath
				examCountdownLabel="Noch 14 Tage"
				examDateLabel="18. August 2026"
				onSelectSession={() => undefined}
				selectedSessionId={sessions[1]?.id ?? null}
				sessions={sessions}
				showsAdaptiveContinuation
			/>,
		);

		expect(screen.queryByText("Erledigt")).toBeNull();
		expect(screen.queryByText("Als Nächstes")).toBeNull();
		expect(screen.queryByText("Vorschau")).toBeNull();
		expect(screen.queryByText("4. Aug. · 17:20")).toBeNull();
		const continuationPath = screen.getByTestId("adaptive-continuation-path");
		expect(continuationPath.props.d).toContain(" H ");
		expect(continuationPath.props.d).toContain(" Q ");
		expect(continuationPath.props.d).toContain(" V ");
		expect(continuationPath.props.d).not.toContain(" C ");
		expect(screen.getByTestId("adaptive-continuation-card")).toBeOnTheScreen();
		expect(screen.getByText("Dayova plant mit dir weiter")).toBeOnTheScreen();
		expect(screen.getByText("18. August 2026")).toBeOnTheScreen();
		expect(screen.getByText("Noch 14 Tage")).toBeOnTheScreen();
	});

	test("formats the exam countdown for today and future dates", () => {
		expect(getExamCountdownLabel("2026-08-04", new Date(2026, 7, 4))).toBe(
			"Heute",
		);
		expect(getExamCountdownLabel("2026-08-05", new Date(2026, 7, 4))).toBe(
			"Noch 1 Tag",
		);
		expect(getExamCountdownLabel("2026-08-18", new Date(2026, 7, 4))).toBe(
			"Noch 14 Tage",
		);
	});
});
