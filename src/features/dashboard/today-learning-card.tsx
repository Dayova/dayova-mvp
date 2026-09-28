import { View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { Button } from "~/components/ui/button";
import { ArrowRightStraight, Play } from "~/components/ui/icon";
import { NotchedActionCard } from "~/components/ui/notched-action-card";
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
	const isEmptyPlan = !item && !isLoading && !hasNoPlan;
	const description =
		goal ||
		(item
			? "Dein nächster Lernschritt"
			: "Hier findest du deine bestehenden Lernpläne.");
	const action = isLoading
		? "Wird geladen …"
		: item
			? item.entry.executionStatus === "started"
				? "Fortsetzen"
				: "Jetzt lernen"
			: fallbackAction.label;
	const duration = item?.entry.durationMinutes;
	const durationLabel =
		duration != null && duration > 0 ? `${duration} min` : null;
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
	if (!item && !isLoading && hasNoPlan) {
		const emptyAction = "Jetzt Lernplan erstellen";
		return (
			<Surface
				className="items-center justify-center gap-6 border border-border bg-system-subtle p-6"
				// Match the native notched-card geometry, releasing height at runtime for large text.
				style={{
					minHeight: 224,
					height: shouldStackInlineContent ? undefined : 224,
				}}
				testID="today-learning-card"
			>
				<View className="gap-3">
					<Text
						accessibilityRole="header"
						className="text-center font-poppins font-semibold text-body-1 text-text"
					>
						Noch kein Lernplan
					</Text>
					<Text className="text-center font-poppins text-body-3 text-secondary-text">
						Plane deine nächste Prüfung. Dayova hilft dir beim Lernen.
					</Text>
				</View>
				<Button
					className="w-full"
					accessibilityLabel={emptyAction}
					accessibilityHint={fallbackAction.accessibilityHint}
					onPress={onOpenFallback}
				>
					<Text className="text-center">{emptyAction}</Text>
				</Button>
			</Surface>
		);
	}
	return (
		<NotchedActionCard
			pressType="card"
			cardHeight={224}
			fillColor={colors.systemSubtle}
			className={cn(!shouldStackInlineContent && "h-56")}
			contentClassName={
				isEmptyPlan
					? cn("px-6 pt-8 pb-0", !shouldStackInlineContent && "h-56")
					: "gap-6 px-6 py-8"
			}
			cardDisabled={isLoading}
			actionIcon={
				isEmptyPlan ? (
					<ArrowRightStraight
						size={26}
						color={DAYOVA_DESIGN_SYSTEM.colors.light1}
						strokeWidth={2}
					/>
				) : (
					<Play
						testID="today-learning-play"
						size={26}
						color={DAYOVA_DESIGN_SYSTEM.colors.light1}
						fill="none"
						strokeWidth={2}
					/>
				)
			}
			backgroundArtwork={
				<>
					{/* DAY-490: reference-specific decorative loop, not an interface icon.
			    Hugeicons cannot reproduce this cropped background composition. */}
					<Svg
						width="100%"
						height="100%"
						viewBox="0 0 354 260"
						preserveAspectRatio="none"
						pointerEvents="none"
						accessible={false}
						accessibilityElementsHidden
						importantForAccessibility="no-hide-descendants"
					>
						<Path
							d="M 377 77 C 301 72 245 108 291 158 C 339 212 383 211 369 186 C 348 150 295 171 269 188 C 229 213 201 240 185 270"
							fill="none"
							stroke={colors.primary}
							strokeOpacity={0.22}
							strokeWidth={17}
						/>
					</Svg>
				</>
			}
			cardAccessibilityLabel={[
				action,
				item && !isLoading ? context : null,
				title,
				!isLoading ? description : null,
				!isLoading ? durationLabel : null,
				!isLoading ? dayLabel : null,
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
			testID="today-learning-card"
		>
			<View
				className={cn(
					"items-start justify-between gap-3",
					shouldStackInlineContent ? "flex-col" : "flex-row",
				)}
				testID="today-learning-card-context"
			>
				<Text
					accessibilityRole="header"
					numberOfLines={shouldStackInlineContent ? undefined : 2}
					ellipsizeMode="tail"
					className={cn(
						"font-poppins font-semibold text-body-1 text-text",
						!shouldStackInlineContent && "min-w-0 flex-1",
					)}
				>
					{title}
				</Text>
				{!isLoading && item ? (
					<View className="items-end gap-1">
						{durationLabel && (
							<LearningPlanStatusBadge
								className="shrink-0 border border-border"
								fixedTextScale={false}
								status={{
									label: durationLabel,
									background: DAYOVA_DESIGN_SYSTEM.colors.systemSubtle,
									foreground: DAYOVA_DESIGN_SYSTEM.colors.primary,
								}}
							/>
						)}
						<Text className="font-poppins text-body-4 text-secondary-text">
							{dayLabel}
						</Text>
					</View>
				) : null}
			</View>
			{!isLoading ? (
				<View className={isEmptyPlan ? "mt-6" : "gap-3"}>
					<Text
						numberOfLines={
							shouldStackInlineContent ? undefined : isEmptyPlan ? 2 : 3
						}
						ellipsizeMode="tail"
						className="pr-14 font-poppins text-body-3 text-secondary-text"
					>
						{description}
					</Text>
				</View>
			) : null}
			{isEmptyPlan && (
				<View
					className={cn(
						"justify-center pr-14",
						shouldStackInlineContent ? "mt-6 min-h-12" : "mt-auto h-12",
					)}
				>
					<Text className="font-poppins font-semibold text-body-3 text-text">
						Lernpläne ansehen
					</Text>
				</View>
			)}
		</NotchedActionCard>
	);
}
