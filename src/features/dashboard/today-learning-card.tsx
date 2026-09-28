import { View } from "react-native";
import { ArrowUpRight, GraduationCap } from "~/components/ui/icon";
import { NotchedActionCard } from "~/components/ui/notched-action-card";
import { useContentSizeLayout } from "~/components/ui/portrait-content";
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
	plan?: { subject: string; examTypeLabel: string; examDateLabel?: string };
	isLoading: boolean;
	fallbackAction: DashboardNextStepFallbackAction;
	onOpenItem: (item: DashboardAgendaItem) => void;
	onOpenFallback: () => void;
};

/** Plan-card visual language, focused on one learning action rather than plan progress. */
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
	const exam = [plan?.examTypeLabel, plan?.examDateLabel]
		.filter(Boolean)
		.join(" · ");
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
		<NotchedActionCard
			pressType="card"
			cardDisabled={isLoading}
			cardAccessibilityLabel={[
				action,
				item ? subject : null,
				exam,
				title,
				durationLabel,
			]
				.filter(Boolean)
				.join(". ")}
			cardAccessibilityHint={
				item ? "Öffnet diesen Lernschritt." : fallbackAction.accessibilityHint
			}
			onPress={() => {
				if (!isLoading) {
					if (item) onOpenItem(item);
					else onOpenFallback();
				}
			}}
			actionIcon={
				<ArrowUpRight
					size={24}
					color={DAYOVA_DESIGN_SYSTEM.colors.light1}
					strokeWidth={1.9}
				/>
			}
			testID="today-learning-card"
		>
			<View className="gap-3">
				<View
					className={cn(
						"items-start justify-between gap-3",
						shouldStackInlineContent ? "flex-col" : "flex-row",
					)}
					testID="today-learning-card-context"
				>
					<Text className="min-w-0 flex-shrink font-poppins font-semibold text-body-3 text-secondary-text">
						{item && !isLoading ? subject : "Nächster Lernschritt"}
					</Text>
					{durationLabel && !isLoading ? (
						<View className="min-h-7 shrink-0 justify-center rounded-full bg-system-subtle px-3 py-1">
							<Text className="font-poppins font-semibold text-body-5 text-primary-strong">
								{durationLabel}
							</Text>
						</View>
					) : null}
				</View>
				{exam && !isLoading ? (
					<View className="flex-row items-start gap-1">
						<GraduationCap
							size={14}
							color={colors.secondaryText}
							strokeWidth={2}
						/>
						<Text className="min-w-0 flex-1 font-poppins text-body-4 text-secondary-text">
							{exam}
						</Text>
					</View>
				) : null}
				<Text
					accessibilityRole="header"
					className="font-poppins font-semibold text-body-1 text-text"
				>
					{title}
				</Text>
			</View>
			<Text className="mt-5 pr-8 font-poppins font-semibold text-body-3 text-text">
				{action}
			</Text>
		</NotchedActionCard>
	);
}
