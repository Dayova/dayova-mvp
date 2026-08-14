import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { processColor } from "react-native";
import {
	getExamCountdownLabel,
	LearningPath,
	SessionPreviewCard,
} from "~/app/learning-plans/[planId]/index";
import type { PlanSession } from "~/features/learning-plans/types";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";

jest.mock("expo-router", () => ({
	Stack: { Screen: () => null },
	useLocalSearchParams: () => ({ planId: "plan_1" }),
	useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("convex/react", () => ({
	useAction: () => jest.fn(),
	useConvexAuth: () => ({ isAuthenticated: true }),
	useMutation: () => jest.fn(),
	useQuery: () => null,
}));

jest.mock("#convex/_generated/api", () => ({
	api: {
		learningPlanAi: { ensureSessionContent: "ensureSessionContent" },
		learningPlans: {
			ensureNextRepeat: "ensureNextRepeat",
			getSnapshot: "getSnapshot",
		},
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
		expect(screen.queryByText("Als Nächstes")).toBeNull();

		fireEvent.press(startButton);
		expect(onOpen).toHaveBeenCalledTimes(1);
	});

	test("keeps a session closed while its content is being prepared", async () => {
		const screen = await render(
			<SessionPreviewCard
				canOpen={false}
				preparationState="preparing"
				session={session("session_preparing")}
				onOpen={() => undefined}
			/>,
		);

		expect(
			screen.getByText("Lerninhalte werden vorbereitet"),
		).toBeOnTheScreen();
		expect(screen.queryByText("Lernsession starten")).toBeNull();
	});

	test("offers a retry when content preparation fails", async () => {
		const onRetryPreparation = jest.fn();
		const screen = await render(
			<SessionPreviewCard
				canOpen={false}
				preparationState="failed"
				session={session("session_failed")}
				onOpen={() => undefined}
				onRetryPreparation={onRetryPreparation}
			/>,
		);

		fireEvent.press(
			screen.getByRole("button", { name: /Vorbereitung erneut/ }),
		);
		expect(onRetryPreparation).toHaveBeenCalledTimes(1);
	});

	test("keeps status and selection reason labels out of the preview card", async () => {
		const screen = await render(
			<SessionPreviewCard
				canOpen
				session={session("session_done", {
					completed: true,
					executionStatus: "completed",
					selectionReason:
						"Warum jetzt: „Lineare Funktionen“ ist noch nicht stabil.",
				})}
				onOpen={() => undefined}
			/>,
		);

		expect(screen.queryByText("Bearbeitet")).toBeNull();
		expect(screen.queryByText(/Warum jetzt/)).toBeNull();
	});

	test("explains that a provisional session can still change", async () => {
		const screen = await render(
			<SessionPreviewCard
				canOpen={false}
				session={session("session_2", { planningStatus: "provisional" })}
				onOpen={() => undefined}
			/>,
		);

		expect(screen.queryByText("Danach · Vorschau")).toBeNull();
		expect(
			screen.getByText(
				"Diese Vorschau kann sich nach deinem nächsten Abschluss ändern.",
			),
		).toBeOnTheScreen();
	});

	test("keeps node details out of the path and connects it to the exam", async () => {
		const onOpenSession = jest.fn();
		const onSelectSession = jest.fn();
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
				onOpenSession={onOpenSession}
				onSelectSession={onSelectSession}
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
		expect(
			screen.getByTestId("adaptive-continuation-endpoint"),
		).toBeOnTheScreen();
		expect(screen.getByTestId("adaptive-continuation-card")).toBeOnTheScreen();
		expect(screen.getByText("Dayova plant mit dir weiter")).toBeOnTheScreen();
		expect(screen.getByText("18. August 2026")).toBeOnTheScreen();
		expect(screen.getByText("Noch 14 Tage")).toBeOnTheScreen();
		expect(
			screen.getByTestId("learning-path-node-halo-session_current").props.stroke
				.payload,
		).toEqual(processColor(DAYOVA_DESIGN_SYSTEM.colors.path4));
		expect(
			screen.getByTestId("learning-path-node-puck-session_current").props.style
				.width,
		).toBe(60);
		expect(
			screen.getByTestId("learning-path-node-puck-session_current-face").props
				.style.backgroundColor,
		).toBe(DAYOVA_DESIGN_SYSTEM.colors.path1);
		expect(
			screen.getByTestId("learning-path-node-puck-session_preview").props.style
				.width,
		).toBe(52);
		expect(
			screen.queryByTestId("learning-path-node-halo-session_done"),
		).toBeNull();

		await fireEvent.press(
			screen.getByTestId("learning-path-node-session_current"),
		);
		expect(onOpenSession).toHaveBeenCalledWith(sessions[1]);
		expect(onSelectSession).not.toHaveBeenCalled();

		await fireEvent.press(
			screen.getByTestId("learning-path-node-session_preview"),
		);
		expect(onOpenSession).toHaveBeenCalledTimes(1);
		expect(onSelectSession).toHaveBeenCalledWith(sessions[2]);
	});

	test("asks for learning time instead of claiming an exhausted plan is finished", async () => {
		const onAddLearningTime = jest.fn();
		const sessions = [
			session("session_done", {
				completed: true,
				executionStatus: "completed",
			}),
		];
		const screen = await render(
			<LearningPath
				examCountdownLabel="Noch 1 Tag"
				examDateLabel="15. August 2026"
				onAddLearningTime={onAddLearningTime}
				onOpenSession={() => undefined}
				onSelectSession={() => undefined}
				selectedSessionId={sessions[0]?.id ?? null}
				sessions={sessions}
				showsAdaptiveContinuation
			/>,
		);

		expect(screen.getByText("Wiederholung offen")).toBeOnTheScreen();
		expect(screen.queryByText("Dayova plant mit dir weiter")).toBeNull();
		await fireEvent.press(
			screen.getByRole("button", {
				name: "Lernzeit für die nächste Wiederholung ergänzen",
			}),
		);
		expect(onAddLearningTime).toHaveBeenCalledTimes(1);
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
