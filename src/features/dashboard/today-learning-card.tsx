import { createElement } from "react";
import { View } from "react-native";
import { ArrowRightStraight, Play, Plus } from "~/components/ui/icon";
import { NotchedActionCard } from "~/components/ui/notched-action-card";
import { useContentSizeLayout } from "~/components/ui/portrait-content";
import { Text } from "~/components/ui/text";
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
	const { colors } = useDayovaTheme();
	const { shouldStackInlineContent } = useContentSizeLayout();
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
				: "Lernsession starten"
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
		<NotchedActionCard
			pressType="card"
			cardHeight={280}
			fillColor={colors.systemSubtle}
			contentClassName="px-6 pt-8 pb-0"
			// Standard height is fixed; larger content sizes release it for vertical reflow.
			cardStyle={{ height: shouldStackInlineContent ? undefined : 280 }}
			style={{ height: shouldStackInlineContent ? undefined : 280 }}
			actionIcon={createElement(ActionIcon, {
				size: 26,
				color: DAYOVA_DESIGN_SYSTEM.colors.light1,
				strokeWidth: 2,
				testID: "today-learning-action-icon",
			})}
			cardDisabled={isLoading}
			cardAccessibilityLabel={
				item
					? [buttonLabel, context, title, description, dayLabel, metadata]
							.filter(Boolean)
							.join(". ")
					: [buttonLabel, visibleTitle, supportingCopy]
							.filter(Boolean)
							.join(". ")
			}
			cardAccessibilityHint={
				item ? "Öffnet diesen Lernschritt." : fallbackAction.accessibilityHint
			}
			onPress={() => {
				if (isLoading) return;
				if (item) onOpenItem(item);
				else onOpenFallback();
			}}
			testID="today-learning-card"
		>
			<View
				className={cn(
					"gap-2",
					shouldStackInlineContent ? "flex-col" : "flex-row items-start",
				)}
			>
				<View
					className={cn("gap-3", !shouldStackInlineContent && "flex-1")}
					testID="today-learning-card-context"
				>
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
							numberOfLines={shouldStackInlineContent ? undefined : 3}
							ellipsizeMode="tail"
							className="font-poppins text-body-3 text-secondary-text"
						>
							{supportingCopy}
						</Text>
					) : null}
				</View>
				<LearningCardIllustration subject={item ? subject : undefined} />
			</View>
			<View
				className={cn(
					"justify-center pr-14",
					shouldStackInlineContent ? "mt-6 min-h-12" : "mt-auto h-12",
				)}
			>
				{!item || isLoading ? (
					<Text className="font-poppins font-semibold text-body-3 text-text">
						{buttonLabel}
					</Text>
				) : null}
			</View>
		</NotchedActionCard>
	);
}
