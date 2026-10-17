import { expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { PreparationAcceptAction } from "./preparation-accept-action";

jest.mock("~/lib/theme", () => ({ useDayovaTheme: () => ({ colors: {} }) }));
jest.mock("~/components/ui/portrait-content", () => ({
	useContentSizeLayout: () => ({ shouldStackInlineContent: false }),
}));
jest.mock("~/components/ui/dayova-sheet-frame", () => ({
	DayovaSheetFrame: ({
		visible,
		title,
		children,
		footer,
	}: {
		visible: boolean;
		title: React.ReactNode;
		children: React.ReactNode;
		footer: React.ReactNode;
	}) => {
		const { View, Text } =
			jest.requireActual<typeof import("react-native")>("react-native");
		return visible ? (
			<View>
				<Text>{title}</Text>
				{children}
				{footer}
			</View>
		) : null;
	},
}));

test("matching the remaining budget saves directly", async () => {
	const accept = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
	const screen = await render(
		<PreparationAcceptAction
			plannedMinutes={120}
			recommendedMinutes={120}
			busy={false}
			disabled={false}
			onAccept={accept}
		/>,
	);
	await fireEvent.press(screen.getByRole("button", { name: "Übernehmen" }));
	expect(accept).toHaveBeenCalledTimes(1);
	expect(screen.queryByText("Mehr Zeit einplanen?")).toBeNull();
	expect(screen.queryByText("Weniger Zeit einplanen?")).toBeNull();
});

test.each<[number, string]>([
	[150, "Mehr Zeit einplanen?"],
	[90, "Weniger Zeit einplanen?"],
])("%s minutes requires explicit confirmation", async (minutes, title) => {
	const accept = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
	const screen = await render(
		<PreparationAcceptAction
			plannedMinutes={minutes}
			recommendedMinutes={120}
			busy={false}
			disabled={false}
			onAccept={accept}
		/>,
	);
	await fireEvent.press(screen.getByRole("button", { name: "Übernehmen" }));
	expect(screen.getByText(title)).toBeOnTheScreen();
	expect(accept).not.toHaveBeenCalled();
	await fireEvent.press(screen.getByRole("button", { name: "Anpassen" }));
	expect(accept).not.toHaveBeenCalled();
	expect(screen.queryByText(title)).toBeNull();
	await fireEvent.press(screen.getByRole("button", { name: "Übernehmen" }));
	const buttons = screen.getAllByRole("button", { name: "Übernehmen" });
	await fireEvent.press(buttons[buttons.length - 1]);
	expect(accept).toHaveBeenCalledTimes(1);
});

test("busy or empty schedules cannot submit", async () => {
	const accept = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
	const screen = await render(
		<PreparationAcceptAction
			plannedMinutes={0}
			recommendedMinutes={120}
			busy={false}
			disabled
			onAccept={accept}
		/>,
	);
	expect(screen.getByRole("button", { name: "Übernehmen" })).toBeDisabled();
	await fireEvent.press(screen.getByRole("button", { name: "Übernehmen" }));
	expect(accept).not.toHaveBeenCalled();
	await screen.rerender(
		<PreparationAcceptAction
			plannedMinutes={120}
			recommendedMinutes={120}
			busy
			disabled={false}
			onAccept={accept}
		/>,
	);
	expect(screen.getByRole("button")).toBeDisabled();
});
