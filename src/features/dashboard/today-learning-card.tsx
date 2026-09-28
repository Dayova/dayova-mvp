import { View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { Button } from "~/components/ui/button";
import { ArrowRightStraight } from "~/components/ui/icon";
import { NotchedActionCard } from "~/components/ui/notched-action-card";
import { useContentSizeLayout } from "~/components/ui/portrait-content";
import { Surface } from "~/components/ui/surface";
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
	if (item || isLoading) {
		const buttonLabel = isLoading
			? "Wird geladen …"
			: item?.entry.executionStatus === "started"
				? "Weiterlernen"
				: "Lernsession starten";
		const metadata = [
			item?.dayKey !== todayKey ? dayLabel : null,
			duration != null && duration > 0
				? `${duration} ${duration === 1 ? "Minute" : "Minuten"}`
				: null,
		]
			.filter(Boolean)
			.join(" · ");
		return (
			<Surface
				className="justify-between gap-6 border border-border bg-system-subtle p-6"
				// Runtime content-size mode releases the common card height for accessibility.
				style={{
					minHeight: 224,
					height: shouldStackInlineContent ? undefined : 224,
				}}
				testID="today-learning-card"
			>
				<View className="gap-3" testID="today-learning-card-context">
					<Text
						accessibilityRole="header"
						numberOfLines={shouldStackInlineContent ? undefined : 2}
						ellipsizeMode="tail"
						className="font-poppins font-semibold text-body-1 text-text"
					>
						{title}
					</Text>
					{!isLoading && metadata ? (
						<Text className="font-poppins text-body-3 text-secondary-text">
							{metadata}
						</Text>
					) : null}
				</View>
				<Button
					className="w-full"
					disabled={isLoading}
					accessibilityLabel={[
						buttonLabel,
						context,
						title,
						!isLoading ? description : null,
						!isLoading ? dayLabel : null,
						!isLoading ? metadata : null,
					]
						.filter(Boolean)
						.join(". ")}
					accessibilityHint="Öffnet diesen Lernschritt."
					onPress={() => {
						if (item && !isLoading) onOpenItem(item);
					}}
				>
					<Text className="text-center">{buttonLabel}</Text>
				</Button>
			</Surface>
		);
	}
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
			contentClassName={cn(
				"px-6 pt-8 pb-0",
				!shouldStackInlineContent && "h-56",
			)}
			actionIcon={
				<ArrowRightStraight
					size={26}
					color={DAYOVA_DESIGN_SYSTEM.colors.light1}
					strokeWidth={2}
				/>
			}
			backgroundArtwork={
				// DAY-490: decorative reference artwork, not an interface icon.
				<Svg
					width="100%"
					height="100%"
					viewBox="0 0 354 260"
					preserveAspectRatio="none"
					pointerEvents="none"
					accessible={false}
				>
					<Path
						d="M 377 77 C 301 72 245 108 291 158 C 339 212 383 211 369 186 C 348 150 295 171 269 188 C 229 213 201 240 185 270"
						fill="none"
						stroke={colors.primary}
						strokeOpacity={0.22}
						strokeWidth={17}
					/>
				</Svg>
			}
			cardAccessibilityLabel={["Lernpläne ansehen", title, description].join(
				". ",
			)}
			cardAccessibilityHint={fallbackAction.accessibilityHint}
			onPress={onOpenFallback}
			testID="today-learning-card"
		>
			<Text
				accessibilityRole="header"
				numberOfLines={shouldStackInlineContent ? undefined : 2}
				className="font-poppins font-semibold text-body-1 text-text"
			>
				{title}
			</Text>
			<Text
				numberOfLines={shouldStackInlineContent ? undefined : 2}
				className="mt-6 pr-14 font-poppins text-body-3 text-secondary-text"
			>
				{description}
			</Text>
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
		</NotchedActionCard>
	);
}
