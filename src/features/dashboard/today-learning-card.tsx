import { LinearGradient } from "expo-linear-gradient";
import { View } from "react-native";
import { ArrowUpRight, BookOpen, Clock3 } from "~/components/ui/icon";
import { useContentSizeLayout } from "~/components/ui/portrait-content";
import { ActionSurface } from "~/components/ui/surface";
import { Text } from "~/components/ui/text";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { formatGermanUiText } from "~/lib/german-ui-text";
import { useDayovaTheme } from "~/lib/theme";
import { cn } from "~/lib/utils";
import {
	type DashboardAgendaItem,
	getAgendaEntryTitle,
} from "./dashboard-agenda";
import type { DashboardNextStepFallbackAction } from "./dashboard-empty-state";

type Props = {
	item: DashboardAgendaItem | undefined;
	plan?: {
		subject: string;
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
	// Agenda titles include the subject; it already has its own context line here.
	const topic = fullTitle.startsWith(`${subject} `)
		? fullTitle.slice(subject.length + 1)
		: fullTitle;
	const title = isLoading
		? "Dein nächster Lernschritt wird geladen …"
		: item
			? topic
			: "Noch kein Lernschritt geplant";
	const session =
		plan?.currentSession?.id === item?.entry.relatedLearningPlanSessionId
			? plan?.currentSession
			: undefined;
	const learningKind =
		session?.sessionPurpose === "diagnostic" ? "Wissenscheck" : "Lernen";
	const context = `${subject} · ${learningKind}`;
	const goal = session?.goal ? formatGermanUiText(session.goal).trim() : "";
	const description =
		goal &&
		!goal.toLocaleLowerCase("de-DE").includes(topic.toLocaleLowerCase("de-DE"))
			? goal
			: null;
	const action = isLoading
		? "Wird geladen …"
		: item
			? item.entry.executionStatus === "started"
				? "Fortsetzen"
				: "Jetzt lernen"
			: fallbackAction.label;
	const duration = item?.entry.durationMinutes;
	const durationLabel =
		duration != null && duration > 0 ? `ca. ${duration} Min.` : null;
	return (
		<ActionSurface
			className="min-h-[211px] border border-border bg-system-subtle p-6"
			accessible
			accessibilityRole="button"
			disabled={isLoading}
			accessibilityState={{ disabled: isLoading }}
			accessibilityLabel={[
				action,
				item && !isLoading ? context : null,
				title,
				!isLoading ? description : null,
				!isLoading ? durationLabel : null,
			]
				.filter(Boolean)
				.join(". ")}
			accessibilityHint={
				item ? "Öffnet diesen Lernschritt." : fallbackAction.accessibilityHint
			}
			onPress={() => {
				if (!isLoading) {
					if (item) onOpenItem(item);
					else onOpenFallback();
				}
			}}
			testID="today-learning-card"
		>
			<View className="gap-4">
				<View
					className={cn(
						"items-start justify-between gap-3",
						shouldStackInlineContent ? "flex-col" : "flex-row",
					)}
					testID="today-learning-card-context"
				>
					<View
						className={cn(
							"flex-row items-center gap-2",
							!shouldStackInlineContent && "flex-1",
						)}
					>
						<View className="h-8 w-8 items-center justify-center rounded-full bg-card">
							<BookOpen
								size={18}
								color={colors.primaryStrong}
								strokeWidth={1.9}
							/>
						</View>
						<Text className="min-w-0 flex-1 font-poppins font-semibold text-body-4 text-primary-strong">
							{item && !isLoading ? context : "Nächster Lernschritt"}
						</Text>
					</View>
					{durationLabel && !isLoading ? (
						<View className="min-h-8 shrink-0 flex-row items-center gap-1 rounded-full bg-card px-3 py-1">
							<Clock3
								size={14}
								color={colors.secondaryText}
								strokeWidth={1.9}
							/>
							<Text className="font-poppins font-semibold text-body-5 text-text">
								{durationLabel}
							</Text>
						</View>
					) : null}
				</View>
				<Text
					accessibilityRole="header"
					className="font-poppins font-semibold text-body-1 text-text"
				>
					{title}
				</Text>
				{description && !isLoading ? (
					<Text className="font-poppins text-body-3 text-secondary-text">
						{description}
					</Text>
				) : null}
			</View>
			<View className="mt-auto flex-row items-center justify-between gap-4 pt-3">
				<Text className="flex-1 font-poppins font-semibold text-body-3 text-text">
					{action}
				</Text>
				<View
					accessible={false}
					accessibilityElementsHidden
					importantForAccessibility="no-hide-descendants"
					className="h-12 w-12 overflow-hidden rounded-full"
				>
					<LinearGradient
						colors={DAYOVA_DESIGN_SYSTEM.gradients.primaryInteractive.colors}
						start={DAYOVA_DESIGN_SYSTEM.gradients.primaryInteractive.start}
						end={DAYOVA_DESIGN_SYSTEM.gradients.primaryInteractive.end}
						// Expo's native gradient requires native geometry styles.
						style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
					>
						<ArrowUpRight
							size={24}
							color={DAYOVA_DESIGN_SYSTEM.colors.light1}
							strokeWidth={1.9}
						/>
					</LinearGradient>
				</View>
			</View>
		</ActionSurface>
	);
}
