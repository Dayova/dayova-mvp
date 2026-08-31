import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { View } from "react-native";
import type { Id } from "#convex/_generated/dataModel";
import { toDashboardAgendaItem } from "./dashboard-agenda";
import { EMPTY_DASHBOARD_PRIMARY_ACTION } from "./dashboard-empty-state";
import {
	DashboardAgendaEntryCard,
	DashboardNextStepCard,
	DashboardWeeklyProgressCard,
} from "./dashboard-product-cards";

jest.mock("~/components/ui/icon", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const icon = (name: string) => (props: Record<string, unknown>) =>
		React.createElement("Icon", { ...props, testID: `${name}-icon` });
	return {
		ArrowRight: icon("arrow-right"),
		ArrowUpRight: icon("arrow-up-right"),
		Backpack: icon("backpack"),
		CalendarDays: icon("calendar-days"),
		Check: icon("check"),
		Clock3: icon("clock"),
		Dumbbell: icon("dumbbell"),
		TimeManagement: icon("time-management"),
	};
});

jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		colors: {
			primaryStrong: "#00A0E6",
			secondaryText: "#697586",
			ueben: "#AF52DE",
		},
	}),
}));

const todayKey = "2026-08-31";
const nextStep = toDashboardAgendaItem(todayKey, {
	id: "dashboard-card-next" as Id<"learningPlanSessions">,
	relatedLearningPlanSessionId:
		"dashboard-card-next" as Id<"learningPlanSessions">,
	title: "Lineare Funktionen verstehen",
	kind: "Lernsession",
	time: "16:30",
	durationMinutes: 30,
	executionStatus: "notStarted",
});
const agendaEntry = toDashboardAgendaItem(todayKey, {
	id: "dashboard-card-task" as Id<"dayEntries">,
	title: "Mathe-Hausaufgabe",
	kind: "Hausaufgabe",
	notes: "Lineare Funktionen üben",
});
const progress = {
	completedLearningSessions: 4,
	completedMinutesToday: 30,
	completionPercent: 57,
	remainingLearningSessions: 3,
	totalLearningSessions: 7,
};

describe("shared dashboard product cards", () => {
	test("offers motion-free, non-interactive artwork presentations", async () => {
		const screen = await render(
			<View>
				<DashboardAgendaEntryCard
					mode="artwork"
					item={agendaEntry}
					testID="agenda-artwork"
				/>
				<DashboardWeeklyProgressCard
					mode="artwork"
					progress={progress}
					testID="progress-artwork"
				/>
				<DashboardNextStepCard
					mode="artwork"
					item={nextStep}
					todayKey={todayKey}
					testID="next-step-artwork"
				/>
			</View>,
		);
		const hidden = { includeHiddenElements: true };

		for (const testID of [
			"agenda-artwork",
			"progress-artwork",
			"next-step-artwork",
		]) {
			const card = screen.getByTestId(testID, hidden);
			expect(card.props.accessibilityElementsHidden).toBe(true);
			expect(card.props.importantForAccessibility).toBe("no-hide-descendants");
		}
		expect(screen.getByText("Mathe-Hausaufgabe", hidden)).toBeOnTheScreen();
		expect(screen.getByText("Wochenfortschritt", hidden)).toBeOnTheScreen();
		expect(
			screen.getByText("Lineare Funktionen verstehen", hidden),
		).toBeOnTheScreen();
		expect(screen.queryAllByRole("button", hidden)).toHaveLength(0);
	});

	test("keeps artwork progress copy inside a legible ring and header row", async () => {
		const screen = await render(
			<DashboardWeeklyProgressCard
				mode="artwork"
				progress={progress}
				testID="progress-artwork"
			/>,
		);
		const hidden = { includeHiddenElements: true };

		expect(
			screen.getByTestId("dashboard-progress-artwork-ring", hidden),
		).toHaveStyle({ width: 76, height: 76 });
		expect(screen.getByText("Wochenfortschritt", hidden)).toHaveProp(
			"adjustsFontSizeToFit",
			true,
		);
		expect(screen.getByText("Wochenfortschritt", hidden)).toHaveProp(
			"minimumFontScale",
			0.82,
		);
		expect(screen.getByText("geschafft", hidden).props.className).toContain(
			"max-w-16",
		);
		expect(
			screen.getByTestId("dashboard-progress-artwork-footer", hidden).props
				.className,
		).toContain("pr-3");
	});

	test("keeps the live dashboard presentations interactive", async () => {
		const onOpenAgenda = jest.fn();
		const onOpenNext = jest.fn();
		const onOpenFallback = jest.fn();
		const onOpenProgress = jest.fn();
		const screen = await render(
			<View>
				<DashboardAgendaEntryCard
					mode="screen"
					item={agendaEntry}
					isPast={false}
					onPress={onOpenAgenda}
				/>
				<DashboardWeeklyProgressCard
					mode="screen"
					isLoading={false}
					progress={progress}
					onOpenLearningPlans={onOpenProgress}
				/>
				<DashboardNextStepCard
					mode="screen"
					fallbackAction={EMPTY_DASHBOARD_PRIMARY_ACTION}
					isLoading={false}
					item={nextStep}
					todayKey={todayKey}
					onOpenFallback={onOpenFallback}
					onOpenItem={onOpenNext}
				/>
			</View>,
		);

		await fireEvent.press(
			screen.getByRole("button", { name: "Aufgabe: Mathe-Hausaufgabe" }),
		);
		await fireEvent.press(
			screen.getByRole("button", {
				name: "Wochenfortschritt: 4 von 7 Lernschritten geschafft. 30 Minuten heute",
			}),
		);
		await fireEvent.press(
			screen.getByRole("button", {
				name: /Nächsten Lernschritt öffnen: Lineare Funktionen verstehen/,
			}),
		);

		expect(onOpenAgenda).toHaveBeenCalledTimes(1);
		expect(onOpenProgress).toHaveBeenCalledTimes(1);
		expect(onOpenNext).toHaveBeenCalledWith(nextStep);
		expect(onOpenFallback).not.toHaveBeenCalled();
		expect(screen.getByText("geschafft").props.className).not.toContain(
			"max-w-16",
		);
	});
});
