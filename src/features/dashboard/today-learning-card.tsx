import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";
import { Button } from "~/components/ui/button";
import { useContentSizeLayout } from "~/components/ui/portrait-content";
import { Surface } from "~/components/ui/surface";
import { Text } from "~/components/ui/text";
import { addDays, getDayKey, parseDayKey } from "~/lib/day-key";
import { formatGermanUiText } from "~/lib/german-ui-text";
import { useDayovaTheme } from "~/lib/theme";
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
	const { colors, isDark } = useDayovaTheme();
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
				? "Jetzt Lernplan erstellen"
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
		? metadata
		: isLoading
			? ""
			: hasNoPlan
				? "Plane deine nächste Prüfung mit Dayova."
				: "Hier findest du deine bestehenden Lernpläne.";
	return (
		<Surface
			className="justify-between overflow-hidden rounded-card border border-border bg-system-subtle p-6"
			// Runtime content-size mode releases the common illustrated-card height.
			style={{
				minHeight: 352,
				height: shouldStackInlineContent ? undefined : 352,
			}}
			testID="today-learning-card"
		>
			<LinearGradient
				colors={
					isDark
						? [colors.systemSubtle, colors.background]
						: [colors.surface, colors.systemSubtle]
				}
				start={{ x: 1, y: 0 }}
				end={{ x: 0, y: 1 }}
				// Native gradient API requires absolute geometry and runtime theme colors.
				style={StyleSheet.absoluteFill}
				pointerEvents="none"
				accessible={false}
			/>
			<LearningCardIllustration subject={item ? subject : undefined} />
			<View className="gap-3 py-4" testID="today-learning-card-context">
				<Text
					accessibilityRole="header"
					numberOfLines={shouldStackInlineContent ? undefined : 2}
					ellipsizeMode="tail"
					className="text-center font-poppins font-semibold text-body-1 text-text"
				>
					{visibleTitle}
				</Text>
				{supportingCopy ? (
					<Text className="text-center font-poppins text-body-3 text-secondary-text">
						{supportingCopy}
					</Text>
				) : null}
			</View>
			<Button
				className="w-full"
				disabled={isLoading}
				accessibilityLabel={
					item
						? [buttonLabel, context, title, description, dayLabel, metadata]
								.filter(Boolean)
								.join(". ")
						: buttonLabel
				}
				accessibilityHint={
					item ? "Öffnet diesen Lernschritt." : fallbackAction.accessibilityHint
				}
				onPress={() => {
					if (isLoading) return;
					if (item) onOpenItem(item);
					else onOpenFallback();
				}}
			>
				<Text className="text-center">{buttonLabel}</Text>
			</Button>
		</Surface>
	);
}
