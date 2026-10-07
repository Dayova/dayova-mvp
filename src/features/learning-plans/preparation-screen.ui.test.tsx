import { beforeEach, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import PreparationScreen from "~/app/learning-plans/[planId]/preparation";

const mockRouter = { replace: jest.fn() };
const mockSave = jest.fn<(...args: unknown[]) => Promise<void>>();
let mockSchedule = makeSchedule();
function makeSchedule(revision = 0, startTime = "17:00") {
	return {
		revision,
		budgetMinutes: 30,
		totalMinutes: 60,
		correctCount: 8,
		questionCount: 10,
		slots: [
			{
				id: "slot-1",
				dateKey: "2026-12-01",
				startTime,
				durationMinutes: 30,
				locked: false,
				completed: false,
				completedMinutes: 0,
			},
		],
	};
}
jest.mock("expo-router", () => ({
	useLocalSearchParams: () => ({ planId: "plan-1" }),
	useRouter: () => mockRouter,
}));
jest.mock("#convex/_generated/api", () => ({
	api: {
		learningPlans: {
			getPreparationSchedule: "schedule",
			getSnapshot: "snapshot",
			savePreparationSchedule: "save",
			startFlexiblePreparation: "flexible",
		},
	},
}));
jest.mock("convex/react", () => ({
	useConvexAuth: () => ({ isAuthenticated: true }),
	useQuery: (reference: string) =>
		reference === "schedule"
			? mockSchedule
			: {
					plan: { examDateKey: "2026-12-31", preparationState: "review" },
				},
	useMutation: () => mockSave,
}));
jest.mock("react-native-safe-area-context", () => ({
	useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("~/components/ui/portrait-content", () => ({
	PortraitContent:
		jest.requireActual<typeof import("react-native")>("react-native").View,
	useContentSizeLayout: () => ({ horizontalPadding: 32 }),
}));
jest.mock("~/components/ui/screen", () => {
	const { View } =
		jest.requireActual<typeof import("react-native")>("react-native");
	return { Screen: View, ScreenScroll: View };
});
jest.mock("~/components/ui/text", () => ({
	Text: jest.requireActual<typeof import("react-native")>("react-native").Text,
}));
jest.mock("~/components/ui/button", () => ({
	Button:
		jest.requireActual<typeof import("react-native")>("react-native").Pressable,
}));
jest.mock("~/components/ui/icon", () => ({
	Time04: () => null,
	Pencil: () => null,
	Plus: () => null,
}));
jest.mock("~/features/learning-plans/utils", () => ({
	getErrorMessage: (cause: Error) => cause.message,
}));
jest.mock("~/features/learning-plans/preparation-accept-action", () => ({
	PreparationAcceptAction: ({
		onAccept,
		busy,
	}: {
		onAccept: () => Promise<void>;
		busy: boolean;
	}) => {
		const { Pressable, Text } =
			jest.requireActual<typeof import("react-native")>("react-native");
		return (
			<Pressable disabled={busy} onPress={() => void onAccept()}>
				<Text>Übernehmen</Text>
			</Pressable>
		);
	},
}));
jest.mock("~/features/learning-plans/preparation-slot-editor", () => ({
	PreparationSlotEditor: ({
		slot,
		onSave,
		onClose,
	}: {
		slot: {
			id: string;
			dateKey: string;
			startTime: string;
			durationMinutes: number;
		};
		onSave: (value: typeof slot) => void;
		onClose: () => void;
	}) => {
		const { Pressable, Text } =
			jest.requireActual<typeof import("react-native")>("react-native");
		return (
			<Pressable
				onPress={() => {
					onSave({ ...slot, durationMinutes: 45 });
					onClose();
				}}
			>
				<Text>Dauer ändern</Text>
			</Pressable>
		);
	},
}));
beforeEach(() => {
	mockSchedule = makeSchedule();
	mockSave.mockReset().mockResolvedValue(undefined);
	mockRouter.replace.mockClear();
});
async function editDuration(screen: Awaited<ReturnType<typeof render>>) {
	await fireEvent.press(screen.getByRole("button", { name: /bearbeiten/ }));
	await fireEvent.press(screen.getByText("Dauer ändern"));
}
test.each([
	false,
	true,
])("a stale draft recovers when the server changes during save: %s", async (duringSave) => {
	const screen = await render(<PreparationScreen />);
	await editDuration(screen);
	let rejectSave: (reason: Error) => void = () => {};
	mockSave.mockImplementationOnce(
		() =>
			new Promise<void>((_resolve, reject) => {
				rejectSave = reject;
			}),
	);
	if (!duringSave) {
		mockSchedule = makeSchedule(1, "18:00");
		await screen.rerender(<PreparationScreen />);
	}
	await fireEvent.press(screen.getByText("Übernehmen"));
	if (duringSave) {
		mockSchedule = makeSchedule(1, "18:00");
		await screen.rerender(<PreparationScreen />);
	}
	await act(() =>
		rejectSave(new Error("Dein Lernplan wurde inzwischen geändert.")),
	);
	await waitFor(() => expect(screen.getByRole("alert")).toBeOnTheScreen());
	await fireEvent.press(screen.getByText("Übernehmen"));
	expect(mockSave).toHaveBeenNthCalledWith(
		1,
		expect.objectContaining({
			revision: 0,
			slots: [expect.objectContaining({ durationMinutes: 45 })],
		}),
	);
	expect(mockSave).toHaveBeenNthCalledWith(
		2,
		expect.objectContaining({
			revision: 1,
			slots: [
				expect.objectContaining({ startTime: "18:00", durationMinutes: 30 }),
			],
		}),
	);
	expect(mockRouter.replace).toHaveBeenCalledWith("/learning-plans/plan-1");
});
test("a transient save failure preserves edits on the same revision", async () => {
	const screen = await render(<PreparationScreen />);
	await editDuration(screen);
	mockSave.mockRejectedValueOnce(new Error("Bitte versuche es erneut."));
	await fireEvent.press(screen.getByText("Übernehmen"));
	await waitFor(() => expect(screen.getByRole("alert")).toBeOnTheScreen());
	await fireEvent.press(screen.getByText("Übernehmen"));
	expect(mockSave).toHaveBeenLastCalledWith(
		expect.objectContaining({
			revision: 0,
			slots: [expect.objectContaining({ durationMinutes: 45 })],
		}),
	);
});
