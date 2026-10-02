import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render } from "@testing-library/react-native";
import { ROUTES, withReturnTo } from "~/lib/routes";
import { CreateEntryButton } from "./create-entry-button";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
	useRouter: () => ({ push: mockPush }),
}));

jest.mock("~/components/ui/add-icon", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const { View } =
		jest.requireActual<typeof import("react-native")>("react-native");
	return {
		AddIcon: ({ outlinedGradient }: { outlinedGradient: boolean }) =>
			React.createElement(View, {
				testID: outlinedGradient
					? "outlined-gradient-add-icon"
					: "plain-add-icon",
			}),
	};
});

describe("CreateEntryButton", () => {
	beforeEach(() => {
		mockPush.mockClear();
	});

	test("opens learning-plan creation directly without a picker", async () => {
		const screen = await render(<CreateEntryButton returnTo={ROUTES.home} />);
		expect(screen.getByTestId("outlined-gradient-add-icon")).toBeTruthy();

		await act(() =>
			fireEvent.press(
				screen.getByRole("button", { name: "Lernplan erstellen" }),
			),
		);
		expect(
			screen.queryByRole("button", { name: "Prüfung auswählen" }),
		).toBeNull();
		expect(
			screen.queryByRole("button", { name: "Hausaufgabe auswählen" }),
		).toBeNull();
		expect(mockPush).toHaveBeenCalledTimes(1);

		expect(mockPush).toHaveBeenCalledWith(
			withReturnTo(ROUTES.createExam, ROUTES.home),
		);
	});

	test("preserves the return destination for learning-plan creation", async () => {
		const screen = await render(
			<CreateEntryButton returnTo={ROUTES.learningPlans} />,
		);

		await act(() =>
			fireEvent.press(
				screen.getByRole("button", { name: "Lernplan erstellen" }),
			),
		);

		expect(mockPush).toHaveBeenCalledWith(
			withReturnTo(ROUTES.createExam, ROUTES.learningPlans),
		);
	});
});
