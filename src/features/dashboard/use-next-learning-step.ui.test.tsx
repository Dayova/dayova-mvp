import { beforeEach, expect, jest, test } from "@jest/globals";
import { renderHook } from "@testing-library/react-native";
import type { Id } from "#convex/_generated/dataModel";
import {
	selectNextLearningCandidate,
	useNextLearningStep,
} from "./use-next-learning-step";

const row = (time: string, dayKey = "2027-03-01") => ({
	scanDateKey: dayKey,
	step: {
		dayKey,
		subject: "Mathematik",
		session: {
			_id: time as Id<"learningPlanSessions">,
			learningPlanId: "plan" as Id<"learningPlans">,
			title: "Gleichungen",
			startTime: time,
			durationMinutes: 17,
			goal: "Übe Gleichungen.",
			executionStatus: undefined,
			completed: undefined,
			sessionPurpose: undefined,
		},
	},
});
const mockLoadMore = jest.fn();
let mockPage: {
	results: Array<ReturnType<typeof row> | { scanDateKey: string; step: null }>;
	status: string;
	loadMore: typeof mockLoadMore;
};
jest.mock("convex/react", () => ({ usePaginatedQuery: () => mockPage }));
jest.mock("#convex/_generated/api", () => ({
	api: { dashboardNextStep: { listCandidates: "candidates" } },
}));

beforeEach(() => {
	mockLoadMore.mockClear();
	mockPage = {
		results: [],
		status: "LoadingFirstPage",
		loadMore: mockLoadMore,
	};
});

test("does not expose the empty state while searching through skipped pages", async () => {
	mockPage = {
		...mockPage,
		results: [{ scanDateKey: "2026-10-01", step: null }],
		status: "CanLoadMore",
	};
	const { result } = await renderHook(() =>
		useNextLearningStep("2026-09-29", true),
	);
	expect(result.current.isLoading).toBe(true);
	expect(mockLoadMore).toHaveBeenCalledWith(32);
});

test("waits for a full candidate day before selecting the earliest time across page boundaries", () => {
	expect(selectNextLearningCandidate([row("18:00")], false).settled).toBe(
		false,
	);
	const selected = selectNextLearningCandidate(
		[row("18:00"), row("08:00"), { scanDateKey: "2027-03-02", step: null }],
		false,
	);
	expect(selected.settled).toBe(true);
	expect(selected.next?.session.startTime).toBe("08:00");
});

test("settles at end of data, with either a far-future step or a genuine empty state", async () => {
	mockPage = { ...mockPage, results: [row("17:00")], status: "Exhausted" };
	const { result, rerender } = await renderHook(() =>
		useNextLearningStep("2026-09-29", true),
	);
	expect(result.current.isLoading).toBe(false);
	expect(result.current.item?.dayKey).toBe("2027-03-01");
	expect(result.current.plan?.currentSession.goal).toBe("Übe Gleichungen.");
	expect(mockLoadMore).not.toHaveBeenCalled();
	mockPage = { ...mockPage, results: [] };
	await rerender({});
	expect(result.current.isLoading).toBe(false);
	expect(result.current.item).toBeUndefined();
});

test("does not load more when unauthenticated or when the earliest day is settled", async () => {
	mockPage = { ...mockPage, status: "CanLoadMore" };
	await renderHook(() => useNextLearningStep("2026-09-29", false));
	expect(mockLoadMore).not.toHaveBeenCalled();
	mockPage = {
		...mockPage,
		results: [row("17:00"), row("08:00", "2027-03-02")],
	};
	const { result } = await renderHook(() =>
		useNextLearningStep("2026-09-29", true),
	);
	expect(result.current.isLoading).toBe(false);
	expect(mockLoadMore).not.toHaveBeenCalled();
});
