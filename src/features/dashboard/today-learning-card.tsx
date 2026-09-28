import { createElement } from "react";
import { View } from "react-native";
import { Button } from "~/components/ui/button";
import { ArrowRightStraight, Play, Plus } from "~/components/ui/icon";
import { useContentSizeLayout } from "~/components/ui/portrait-content";
import { Surface } from "~/components/ui/surface";
import { Text } from "~/components/ui/text";
import { LearningPlanStatusBadge } from "~/features/learning-plans/learning-plan-status-badge";
import { addDays, getDayKey, parseDayKey } from "~/lib/day-key";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { formatGermanUiText } from "~/lib/german-ui-text";
import { useDayovaTheme } from "~/lib/theme";
import { cn } from "~/lib/utils";
import {
	type DashboardAgendaItem,
	getAgendaEntryTitle,
} from "./dashboard-agenda";
import {
	type DashboardNextStepFallbackAction,
	EMPTY_DASHBOARD_PRIMARY_ACTION,
} from "./dashboard-empty-state";
import { LearningCardIllustration } from "./learning-card-illustration";

type Props = {
	todayKey?: string;
	item: DashboardAgendaItem | undefined;
	plan?: {
		subject: string;
		completedCount?: number;
		sessionCount?: number;
		currentSession?: {
			id: string;
			goal?: string;
			sessionPurpose?: "diagnostic" | "learning";
		} | null;
	};
	isLoading: boolean;
	fallbackAction: DashboardNextStepFallbackAction;
	onOpenItem: (item: DashboardAgendaItem) => void;
	onOpenFallback: () => void;
};

/** Reference-inspired learning card, using Dayova surfaces and one learning action. */
export function TodayLearningCard({
	todayKey = getDayKey(new Date()),
	item,
	plan,
	isLoading,
	fallbackAction,
	onOpenItem,
	onOpenFallback,
}: Props) {
	const { shouldStackInlineContent } = useContentSizeLayout();
	const { colors } = useDayovaTheme();
	// Theme-derived blue tint for the quieter inset action.
	const actionFill = `#${[1, 3, 5]
		.map((offset) =>
			Math.round(
				Number.parseInt(colors.systemSubtle.slice(offset, offset + 2), 16) *
					0.88 +
					Number.parseInt(colors.primary.slice(offset, offset + 2), 16) * 0.12,
			)
				.toString(16)
				.padStart(2, "0"),
		)
		.join("")}`;
	const subject = formatGermanUiText(
		plan?.subject ?? item?.entry.subject ?? "Dein Lernplan",
	);
	const fullTitle = item
		? formatGermanUiText(getAgendaEntryTitle(item.entry))
		: "";
	// Keep the visible title focused on the task; subject remains accessible.
	const topic = fullTitle.startsWith(`${subject} `)
		? fullTitle.slice(subject.length + 1)
		: fullTitle;
	const title = isLoading
		? "Dein nächster Lernschritt wird geladen …"
		: item
			? topic
			: "Kein Lernschritt geplant";
	const session =
		plan?.currentSession?.id === item?.entry.relatedLearningPlanSessionId
			? plan?.currentSession
			: undefined;
	const learningKind =
		session?.sessionPurpose === "diagnostic" ? "Wissenscheck" : "Lernen";
	const context = `${subject} · ${learningKind}`;
	const goal = session?.goal ? formatGermanUiText(session.goal).trim() : "";
	const hasNoPlan =
		fallbackAction.route === EMPTY_DASHBOARD_PRIMARY_ACTION.route;
	const description =
		goal ||
		(item
			? "Dein nächster Lernschritt"
			: "Hier findest du deine bestehenden Lernpläne.");
	const duration = item?.entry.durationMinutes;
	const stepDate = parseDayKey(item?.dayKey);
	const todayDate = parseDayKey(todayKey);
	const dayLabel =
		item && stepDate && todayDate
			? item.dayKey === todayKey
				? "Heute"
				: item.dayKey === getDayKey(addDays(todayDate, 1))
					? "Morgen"
					: new Intl.DateTimeFormat("de-DE", {
							day: "numeric",
							month: "short",
						}).format(stepDate)
			: null;
	const buttonLabel = isLoading
		? "Wird geladen …"
		: item
			? item.entry.executionStatus === "started"
				? "Weiterlernen"
				: "Jetzt lernen"
			: hasNoPlan
				? "Lernplan erstellen"
				: "Lernpläne ansehen";
	const metadata = [
		item?.dayKey !== todayKey ? dayLabel : null,
		duration != null && duration > 0
			? `${duration} ${duration === 1 ? "Minute" : "Minuten"}`
			: null,
	]
		.filter(Boolean)
		.join(" · ");
	const visibleTitle =
		!item && !isLoading && hasNoPlan ? "Noch kein Lernplan" : title;
	const supportingCopy = item
		? goal && goal.length <= 70
			? goal
			: session?.sessionPurpose === "diagnostic"
				? "Zeige mit kurzen Aufgaben, was du bereits sicher kannst."
				: "Festige dein Wissen mit passenden Aufgaben zu diesem Thema."
		: isLoading
			? ""
			: hasNoPlan
				? "Plane deine nächste Prüfung und lerne Schritt für Schritt."
				: "Hier findest du deine bestehenden Lernpläne.";
	const ActionIcon =
		item || isLoading ? Play : hasNoPlan ? Plus : ArrowRightStraight;
	return (
		<Surface
			className="rounded-button border border-border bg-system-subtle px-6 pt-6 pb-4"
			// Standard height is fixed; larger content sizes release it for vertical reflow.
			style={{
				backgroundColor: colors.systemSubtle,
				minHeight: 240,
				height: shouldStackInlineContent ? undefined : 240,
			}}
			testID="today-learning-card"
		>
			<View
				className={cn(
					"gap-2",
					!shouldStackInlineContent && "flex-1",
					shouldStackInlineContent ? "flex-col" : "flex-row items-start",
				)}
			>
				<View
					className={cn("gap-2", !shouldStackInlineContent && "flex-1")}
					testID="today-learning-card-context"
				>
					{item && !isLoading ? (
						<View
							className="flex-row flex-wrap gap-2"
							testID="today-learning-badges"
						>
							{[
								duration != null && duration > 0 ? `${duration} min` : null,
								dayLabel,
							]
								.filter((label): label is string => Boolean(label))
								.map((label) => (
									<LearningPlanStatusBadge
										key={label}
										className="border border-border"
										fixedTextScale={false}
										status={{
											label,
											background: DAYOVA_DESIGN_SYSTEM.colors.systemSubtle,
											foreground: DAYOVA_DESIGN_SYSTEM.colors.primary,
										}}
									/>
								))}
						</View>
					) : null}
					<Text
						accessibilityRole="header"
						numberOfLines={shouldStackInlineContent ? undefined : 2}
						ellipsizeMode="tail"
						className="font-poppins font-semibold text-body-1 text-text"
					>
						{visibleTitle}
					</Text>
					{supportingCopy ? (
						<Text
							numberOfLines={shouldStackInlineContent ? undefined : 2}
							ellipsizeMode="tail"
							className="font-poppins text-body-3 text-secondary-text"
						>
							{supportingCopy}
						</Text>
					) : null}
				</View>
				<LearningCardIllustration
					subject={item ? subject : undefined}
					backgroundColor={colors.systemSubtle}
				/>
			</View>
			<Button
				variant="soft"
				size="default"
				// Opaque blend of the active theme's semantic colors.
				style={{ backgroundColor: actionFill }}
				className={cn(
					"mt-2 w-full justify-between py-2 pr-2 pl-4",
					shouldStackInlineContent && "mt-6",
				)}
				disabled={isLoading}
				accessibilityLabel={[
					buttonLabel,
					item ? context : visibleTitle,
					title,
					description,
					dayLabel,
					metadata,
				]
					.filter(Boolean)
					.join(". ")}
				accessibilityHint={
					item ? "Öffnet diesen Lernschritt." : fallbackAction.accessibilityHint
				}
				onPress={() => {
					if (isLoading) return;
					if (item) onOpenItem(item);
					else onOpenFallback();
				}}
			>
				<Text className="flex-1 font-poppins font-semibold text-body-2 text-white">
					{buttonLabel}
				</Text>
				<View
					className="h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-strong"
					accessible={false}
				>
					{createElement(ActionIcon, {
						size: 22,
						color: DAYOVA_DESIGN_SYSTEM.colors.light1,
						strokeWidth: 2,
						testID: "today-learning-action-icon",
						accessible: false,
					})}
				</View>
			</Button>
		</Surface>
	);
}
