import { beforeEach, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { LearningTimeImpactSheet } from "./learning-time-impact-sheet";

jest.mock("~/components/ui/icon", () => ({ ArrowLeft: () => null }));

const mockApply = jest.fn<(...args: unknown[]) => Promise<unknown>>();
let mockImpact:
	| {
			revision: string;
			changes: unknown[];
			conflicts: Array<{
				sessionId: string;
				title: string;
				examDateKey: string;
			}>;
	  }
	| null
	| undefined;
jest.mock("#convex/_generated/api", () => ({
	api: {
		learningTimes: {
			previewBehavioralSuggestion: "preview",
			applyBehavioralSuggestion: "apply",
		},
	},
}));
jest.mock("convex/react", () => ({
	useQuery: () => mockImpact,
	useMutation: () => mockApply,
}));
jest.mock("~/components/ui/dayova-sheet-frame", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const Native =
		jest.requireActual<typeof import("react-native")>("react-native");
	return {
		DayovaSheetFrame: ({
			visible,
			children,
			footer,
		}: {
			visible: boolean;
			children: import("react").ReactNode;
			footer: import("react").ReactNode;
		}) =>
			visible ? React.createElement(Native.View, null, children, footer) : null,
	};
});
beforeEach(() => {
	mockApply.mockReset();
	mockApply.mockResolvedValue({});
	mockImpact = { revision: "reviewed-revision", changes: [], conflicts: [] };
});

test("does not apply just by opening and cancellation preserves the schedule", async () => {
	const onClose = jest.fn();
	const screen = await render(
		<LearningTimeImpactSheet
			fingerprint="proposal"
			referenceTime={1}
			onClose={onClose}
		/>,
	);
	expect(mockApply).not.toHaveBeenCalled();
	await fireEvent.press(screen.getByRole("button", { name: "Abbrechen" }));
	expect(onClose).toHaveBeenCalledTimes(1);
	expect(mockApply).not.toHaveBeenCalled();
});
test("binds explicit acceptance to the displayed revision", async () => {
	const onClose = jest.fn();
	const screen = await render(
		<LearningTimeImpactSheet
			fingerprint="proposal"
			referenceTime={1}
			onClose={onClose}
		/>,
	);
	await fireEvent.press(
		screen.getByRole("button", { name: "Änderungen übernehmen" }),
	);
	expect(mockApply).toHaveBeenCalledWith({
		fingerprint: "proposal",
		expectedImpactRevision: "reviewed-revision",
	});
	expect(onClose).toHaveBeenCalledTimes(1);
});
test.each([
	undefined,
	null,
	{
		revision: "blocked",
		changes: [],
		conflicts: [{ sessionId: "s", title: "Mathe", examDateKey: "2026-10-01" }],
	},
])("blocks acceptance without a feasible current preview (%s)", async (value) => {
	mockImpact = value;
	const screen = await render(
		<LearningTimeImpactSheet
			fingerprint="proposal"
			referenceTime={1}
			onClose={jest.fn()}
		/>,
	);
	expect(
		screen.getByRole("button", { name: "Änderungen übernehmen" }),
	).toBeDisabled();
	expect(mockApply).not.toHaveBeenCalled();
});
