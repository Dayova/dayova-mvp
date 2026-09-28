import { createElement, useState } from "react";
import { View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { Button } from "~/components/ui/button";
import { CalendarDays, Play } from "~/components/ui/icon";
import { useContentSizeLayout } from "~/components/ui/portrait-content";
import { ActionSurface, Surface } from "~/components/ui/surface";
import { Text } from "~/components/ui/text";
import { LearningPlanStatusBadge } from "~/features/learning-plans/learning-plan-status-badge";
import { getSubjectIcon } from "~/features/subjects/subject-catalog";
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
	item,
	plan,
	isLoading,
	fallbackAction,
	onOpenItem,
	onOpenFallback,
}: Props) {
	const { colors } = useDayovaTheme();
	const [cardLayout, setCardLayout] = useState({ width: 354, height: 260 });
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
		goal ||
		(item
			? `${subject} · Dein nächster Lernschritt`
			: "Erstelle einen Lernplan für deine nächste Prüfung.");
	const progress =
		item &&
		plan?.completedCount != null &&
		plan.sessionCount != null &&
		plan.sessionCount > 0
			? `${plan.completedCount} von ${plan.sessionCount} Lernschritten`
			: null;
	const action = isLoading
		? "Wird geladen …"
		: item
			? item.entry.executionStatus === "started"
				? "Fortsetzen"
				: "Jetzt lernen"
			: fallbackAction.label;
	const duration = item?.entry.durationMinutes;
	const completedFraction =
		progress && plan?.sessionCount
			? Math.max(0, Math.min(1, (plan.completedCount ?? 0) / plan.sessionCount))
			: null;
	const remaining =
		progress && plan?.sessionCount != null
			? Math.max(0, plan.sessionCount - (plan.completedCount ?? 0))
			: null;
	const ringCircumference = 2 * Math.PI * 23;
	const durationLabel =
		duration != null && duration > 0 ? `${duration} min` : null;
	if (!item && !isLoading) {
		const hasNoPlan =
			fallbackAction.route === EMPTY_DASHBOARD_PRIMARY_ACTION.route;
		const emptyAction = hasNoPlan
			? "Jetzt Lernplan erstellen"
			: "Lernpläne öffnen";
		return (
			<Surface
				className="items-center justify-center gap-6 border border-border bg-system-subtle p-6"
				// Keep the learning card's measured minimum ratio; content can grow.
				style={{ minHeight: cardLayout.width / 1.36 }}
				onLayout={({ nativeEvent: { layout } }) => {
					setCardLayout((previous) =>
						previous.width === layout.width ? previous : layout,
					);
				}}
				testID="today-learning-card"
			>
				<View
					accessible={false}
					accessibilityElementsHidden
					importantForAccessibility="no-hide-descendants"
					className="h-16 w-16 items-center justify-center rounded-full bg-card"
				>
					<CalendarDays
						size={28}
						color={colors.primaryStrong}
						strokeWidth={1.9}
					/>
				</View>
				<View className="gap-3">
					<Text
						accessibilityRole="header"
						className="text-center font-poppins font-semibold text-body-1 text-text"
					>
						{hasNoPlan ? "Noch kein Lernplan" : "Kein Lernschritt geplant"}
					</Text>
					<Text className="text-center font-poppins text-body-3 text-secondary-text">
						{hasNoPlan
							? "Erstelle deinen ersten Lernplan und finde heraus, was du als Nächstes lernen kannst."
							: "Aktuell steht kein weiterer Lernschritt an. In deinen Lernplänen findest du deine Übersicht."}
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
		<ActionSurface
			className="overflow-hidden border border-border bg-system-subtle p-5"
			onLayout={(event) => {
				const { width, height } = event.nativeEvent.layout;
				setCardLayout((previous) =>
					previous.width === width && previous.height === height
						? previous
						: { width, height },
				);
			}}
			// Reference aspect ratio is a minimum; scaled/long text can grow vertically.
			style={{ minHeight: cardLayout.width / 1.36 }}
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
				!isLoading && progress ? `${progress} abgeschlossen` : null,
				!isLoading && remaining != null
					? `${remaining} Lernschritte noch offen`
					: null,
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
			{/* DAY-490: reference-specific decorative loop, not an interface icon.
			    Hugeicons cannot reproduce this cropped background composition. */}
			<Svg
				width={cardLayout.width}
				height={cardLayout.height}
				viewBox="0 0 354 260"
				preserveAspectRatio="none"
				pointerEvents="none"
				accessible={false}
				accessibilityElementsHidden
				importantForAccessibility="no-hide-descendants"
				// SVG background positioning uses its native geometry API.
				style={{ position: "absolute", top: 0, left: 0 }}
			>
				<Path
					d="M 377 77 C 301 72 245 108 291 158 C 339 212 383 211 369 186 C 348 150 295 171 269 188 C 229 213 201 240 185 270"
					fill="none"
					stroke={colors.primary}
					strokeOpacity={0.22}
					strokeWidth={17}
				/>
			</Svg>
			<View className="gap-5">
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
						<View className="h-12 w-12 items-center justify-center rounded-full bg-card">
							{createElement(getSubjectIcon(subject), {
								testID: "today-subject-icon",
								size: 24,
								color: colors.text,
								strokeWidth: 1.9,
							})}
						</View>
						<Text className="min-w-0 flex-1 font-poppins font-semibold text-body-2 text-primary-strong">
							{item && !isLoading ? subject : "Lernplan"}
						</Text>
					</View>
					{durationLabel && !isLoading ? (
						<LearningPlanStatusBadge
							className="border border-border"
							fixedTextScale={false}
							status={{
								label: durationLabel,
								background: DAYOVA_DESIGN_SYSTEM.colors.systemSubtle,
								foreground: DAYOVA_DESIGN_SYSTEM.colors.primary,
							}}
						/>
					) : null}
				</View>
				<Text
					accessibilityRole="header"
					className="font-poppins font-semibold text-body-1 text-text"
				>
					{title}
				</Text>
				{description && !isLoading ? (
					<Text
						numberOfLines={shouldStackInlineContent ? undefined : 2}
						ellipsizeMode="tail"
						className="font-poppins text-body-3 text-secondary-text"
					>
						{description}
					</Text>
				) : null}
			</View>
			<View className="mt-auto flex-row items-center justify-between gap-4 pt-6">
				<Text className="flex-1 font-poppins text-body-3 text-text">
					{!isLoading && progress ? progress : action}
				</Text>
				<View
					accessible={false}
					accessibilityElementsHidden
					importantForAccessibility="no-hide-descendants"
					className="h-12 w-12 items-center justify-center rounded-full border border-border bg-card"
				>
					{completedFraction != null && !isLoading ? (
						<Svg
							width={48}
							height={48}
							viewBox="0 0 48 48"
							pointerEvents="none"
							// The ring overlays the existing 48-point action visual.
							style={{ position: "absolute", top: -1, left: -1 }}
						>
							<Circle
								cx={24}
								cy={24}
								r={23}
								fill="none"
								stroke={colors.border}
								strokeWidth={2}
							/>
							{completedFraction > 0 ? (
								<Circle
									testID="today-learning-progress-ring"
									cx={24}
									cy={24}
									r={23}
									fill="none"
									stroke={colors.primaryStrong}
									strokeWidth={2}
									strokeDasharray={[ringCircumference, ringCircumference]}
									strokeDashoffset={ringCircumference * (1 - completedFraction)}
									rotation={-90}
									origin="24, 24"
								/>
							) : null}
						</Svg>
					) : null}
					<Play
						testID="today-learning-play"
						size={26}
						color={colors.text}
						fill={colors.text}
						strokeWidth={2.5}
					/>
				</View>
			</View>
		</ActionSurface>
	);
}
