import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { LearningTimeReminder } from "./learning-time-reminder";

let mockTimes: unknown = [];
jest.mock("convex/react", () => ({
	useConvexAuth: () => ({ isAuthenticated: true }),
	useQuery: () => {
		if (mockTimes instanceof Error) throw mockTimes;
		return mockTimes;
	},
}));
jest.mock("#convex/_generated/api", () => ({
	api: { learningTimes: { listMine: "listMine" } },
}));

describe("voluntary learning-time reminder", () => {
	test("query failure cannot block the primary completion action", async () => {
		mockTimes = new Error("Unavailable");
		const log = jest.spyOn(console, "error").mockImplementation(() => {});
		const onPrimary = jest.fn();
		try {
			const screen = await render(
				<>
					<LearningTimeReminder onOpen={jest.fn()} disabled={false} />
					<Button onPress={onPrimary}>
						<Text>Zum Lernplan</Text>
					</Button>
				</>,
			);
			expect(screen.queryByText("Lernzeiten eintragen")).toBeNull();
			await fireEvent.press(
				screen.getByRole("button", { name: "Zum Lernplan" }),
			);
			expect(onPrimary).toHaveBeenCalledTimes(1);
		} finally {
			log.mockRestore();
		}
	});
	test("explains the benefit and opens settings only on explicit action", async () => {
		mockTimes = [];
		const onOpen = jest.fn();
		const screen = await render(
			<LearningTimeReminder onOpen={onOpen} disabled={false} />,
		);
		expect(
			screen.getByText(/Verteile das Lernen auf mehrere Tage/),
		).toBeTruthy();
		expect(onOpen).not.toHaveBeenCalled();
		await fireEvent.press(
			screen.getByRole("button", { name: "Lernzeiten eintragen" }),
		);
		expect(onOpen).toHaveBeenCalledTimes(1);
	});
	test.each([
		undefined,
		[{ dayOfWeek: 1 }],
	])("does not prompt while loading or with personal times", async (times) => {
		mockTimes = times;
		const screen = await render(
			<LearningTimeReminder onOpen={jest.fn()} disabled={false} />,
		);
		expect(screen.queryByText("Lernzeiten eintragen")).toBeNull();
	});
	test("blocks navigation while completion is saving", async () => {
		mockTimes = [];
		const screen = await render(
			<LearningTimeReminder onOpen={jest.fn()} disabled />,
		);
		expect(
			screen.getByRole("button", { name: "Lernzeiten eintragen" }),
		).toBeDisabled();
	});
});
