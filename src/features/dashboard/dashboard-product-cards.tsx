import {
	type TextStyle,
	TouchableOpacity,
	View,
	type ViewStyle,
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import {
	ArrowRight,
	ArrowUpRight,
	Backpack,
	CalendarDays,
	Check,
	Clock3,
	Dumbbell,
	TimeManagement,
} from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
import { parseDayKey } from "~/lib/day-key";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { formatGermanUiText } from "~/lib/german-ui-text";
import { useDayovaTheme } from "~/lib/theme";
import { cn } from "~/lib/utils";
import type { DayEntry } from "~/types/dayEntries";
import {
	type DashboardAgendaItem,
	type DashboardWeekProgress,
	getAgendaEntryTitle,
	getNextLearningStepAccessibilityLabel,
} from "./dashboard-agenda";
import type { DashboardNextStepFallbackAction } from "./dashboard-empty-state";

type DashboardNextStepCardProps =
	| {
			mode: "artwork";
			item: DashboardAgendaItem;
			testID?: string;
			todayKey: string;
	  }
	| {
			fallbackAction: DashboardNextStepFallbackAction;
			isLoading: boolean;
			item: DashboardAgendaItem | undefined;
			mode: "screen";
			onOpenFallback: () => void;
			onOpenItem: (item: DashboardAgendaItem) => void;
			testID?: string;
			todayKey: string;
	  };

type DashboardWeeklyProgressCardProps =
	| {
			mode: "artwork";
			progress: DashboardWeekProgress;
			testID?: string;
	  }
	| {
			isLoading: boolean;
			mode: "screen";
			onOpenLearningPlans: () => void;
			progress: DashboardWeekProgress;
			testID?: string;
	  };

type DashboardAgendaEntryCardProps =
	| {
			item: DashboardAgendaItem;
			mode: "artwork";
			testID?: string;
	  }
	| {
			isPast: boolean;
			item: DashboardAgendaItem;
			mode: "screen";
			onPress: () => void;
			testID?: string;
	  };

// These are native rendering controls with no NativeWind equivalent.
const continuousBorderStyle = {
	borderCurve: "continuous",
} satisfies ViewStyle;
const tabularNumberStyle = {
	fontVariant: ["tabular-nums"],
} satisfies TextStyle;

const formatMinutes = (minutes: number) => {
	const hours = Math.floor(minutes / 60)
		.toString()
		.padStart(2, "0");
	const remainder = (minutes % 60).toString().padStart(2, "0");
	return `${hours}:${remainder}`;
};

const getEntrySummary = (entry: DayEntry) => {
	const firstNoteLine = entry.notes
		?.split("\n")
		.map((line) => line.replace(/^-\s*/, "").trim())
		.find(Boolean);
	if (firstNoteLine) return formatGermanUiText(firstNoteLine);
	if (entry.examTypeLabel) return formatGermanUiText(entry.examTypeLabel);
	if (entry.kind) return formatGermanUiText(entry.kind);
	return "Für deinen Tag eingeplant";
};

const getNextStepDateLabel = (item: DashboardAgendaItem, todayKey: string) => {
	const date = parseDayKey(item.dayKey);
	if (!date) return "Termin folgt";
	if (item.dayKey === todayKey) return "Heute";

	return formatGermanUiText(
		new Intl.DateTimeFormat("de-DE", {
			weekday: "short",
			day: "numeric",
			month: "short",
		}).format(date),
	);
};

const getNextStepTimeLabel = (item: DashboardAgendaItem) => {
	const durationMinutes = item.entry.durationMinutes ?? 45;
	if (item.startMinutes === null) return `${durationMinutes} Min.`;
	return `${formatMinutes(item.startMinutes)} Uhr · ${durationMinutes} Min.`;
};

const getNextStepFooter = (item: DashboardAgendaItem, todayKey: string) => {
	if (item.entry.executionStatus === "started") return "Fortsetzen";
	if (item.dayKey === todayKey) return "Jetzt starten";
	return "Lernschritt öffnen";
};

function DashboardNextStepCard(props: DashboardNextStepCardProps) {
	const { colors } = useDayovaTheme();
	const isArtwork = props.mode === "artwork";
	const isLoading = isArtwork ? false : props.isLoading;
	const item = props.item;
	const title = isLoading
		? "Wird geladen …"
		: item
			? formatGermanUiText(getAgendaEntryTitle(item.entry))
			: "Noch nichts geplant";
	const dateLabel = item ? getNextStepDateLabel(item, props.todayKey) : null;
	const timeLabel = item ? getNextStepTimeLabel(item) : null;
	const footer = isLoading
		? "Lernplan wird geladen …"
		: item
			? getNextStepFooter(item, props.todayKey)
			: props.mode === "screen"
				? props.fallbackAction.label
				: "Lernplan öffnen";
	const content = (
		<>
			<View className="flex-row items-start gap-1">
				<Dumbbell
					size={isArtwork ? 13 : 14}
					color={colors.primaryStrong}
					strokeWidth={2}
				/>
				<Text
					allowFontScaling={!isArtwork}
					maxFontSizeMultiplier={isArtwork ? 1 : undefined}
					className="flex-1 font-poppins font-semibold text-body-5 text-primary-strong"
					numberOfLines={isArtwork ? 1 : 2}
				>
					Nächster Lernschritt
				</Text>
			</View>
			<Text
				allowFontScaling={!isArtwork}
				maxFontSizeMultiplier={isArtwork ? 1 : undefined}
				className={cn(
					"font-poppins font-semibold text-text",
					isArtwork ? "mt-1 text-body-3" : "mt-4 text-body-1",
				)}
				numberOfLines={isArtwork ? 2 : 3}
			>
				{title}
			</Text>
			{isArtwork ? (
				<View className="mt-auto flex-row items-end justify-between gap-2 pt-1">
					<View className="flex-1 gap-1">
						{dateLabel ? (
							<View className="flex-row items-center gap-2">
								<CalendarDays
									size={13}
									color={colors.secondaryText}
									strokeWidth={1.9}
								/>
								<Text
									allowFontScaling={false}
									maxFontSizeMultiplier={1}
									className="flex-1 font-poppins text-body-5 text-secondary-text"
									numberOfLines={1}
								>
									{[dateLabel, timeLabel].filter(Boolean).join(" · ")}
								</Text>
							</View>
						) : null}
						<Text
							allowFontScaling={false}
							maxFontSizeMultiplier={1}
							className="font-poppins font-semibold text-body-5 text-text"
							numberOfLines={1}
						>
							{footer}
						</Text>
					</View>
					<View className="h-10 w-10 items-center justify-center rounded-full bg-primary">
						<ArrowRight
							size={19}
							color={DAYOVA_DESIGN_SYSTEM.colors.light1}
							strokeWidth={2}
						/>
					</View>
				</View>
			) : (
				<>
					<View className="mt-3 flex-1 gap-2">
						{dateLabel ? (
							<View className="flex-row items-center gap-2">
								<CalendarDays
									size={16}
									color={colors.secondaryText}
									strokeWidth={1.9}
								/>
								<Text
									className="flex-1 font-poppins text-body-5 text-secondary-text"
									numberOfLines={1}
								>
									{dateLabel}
								</Text>
							</View>
						) : null}
						{timeLabel ? (
							<View className="flex-row items-center gap-2">
								<Clock3
									size={16}
									color={colors.secondaryText}
									strokeWidth={1.9}
								/>
								<Text
									className="flex-1 font-poppins text-body-5 text-secondary-text"
									numberOfLines={1}
									style={tabularNumberStyle}
								>
									{timeLabel}
								</Text>
							</View>
						) : null}
					</View>
					<View className="mt-4 flex-row items-end justify-between gap-2">
						<Text
							className="flex-1 pr-1 font-poppins font-semibold text-body-4 text-text"
							numberOfLines={2}
						>
							{footer}
						</Text>
						<View className="h-12 w-12 items-center justify-center rounded-full bg-primary">
							<ArrowRight
								size={22}
								color={DAYOVA_DESIGN_SYSTEM.colors.light1}
								strokeWidth={2}
							/>
						</View>
					</View>
				</>
			)}
		</>
	);

	if (props.mode === "artwork") {
		return (
			<View
				accessible={false}
				accessibilityElementsHidden
				importantForAccessibility="no-hide-descendants"
				testID={props.testID}
				className="h-full w-full overflow-hidden rounded-card border border-border bg-system-subtle px-4 py-2"
				style={continuousBorderStyle}
			>
				{content}
			</View>
		);
	}

	const handlePress = () => {
		if (props.isLoading) return;
		if (props.item) {
			props.onOpenItem(props.item);
			return;
		}
		props.onOpenFallback();
	};

	return (
		<TouchableOpacity
			activeOpacity={0.82}
			accessibilityRole="button"
			accessibilityState={{ disabled: props.isLoading }}
			accessibilityLabel={
				props.isLoading
					? "Nächster Lernschritt wird geladen"
					: props.item
						? getNextLearningStepAccessibilityLabel({
								isStarted: props.item.entry.executionStatus === "started",
								title,
								dateLabel,
								timeLabel,
							})
						: props.fallbackAction.label
			}
			accessibilityHint={
				props.isLoading
					? "Warte, bis dein Lernplan geladen wurde."
					: props.item
						? "Öffnet deinen persönlichen Lernplan."
						: props.fallbackAction.accessibilityHint
			}
			disabled={props.isLoading}
			onPress={handlePress}
			testID={props.testID}
			className="min-h-72 flex-1 overflow-hidden rounded-card border border-border bg-system-subtle px-4 pt-5 pb-4"
			style={continuousBorderStyle}
		>
			{content}
		</TouchableOpacity>
	);
}

function DashboardWeeklyProgressCard(props: DashboardWeeklyProgressCardProps) {
	const { colors } = useDayovaTheme();
	const isArtwork = props.mode === "artwork";
	const isLoading = isArtwork ? false : props.isLoading;
	const hasPlannedSessions = props.progress.totalLearningSessions > 0;
	const ringValue = isLoading
		? "–"
		: hasPlannedSessions
			? `${props.progress.completedLearningSessions} / ${props.progress.totalLearningSessions}`
			: "0";
	const ringLabel = isLoading
		? "wird geladen"
		: hasPlannedSessions
			? "geschafft"
			: "geplant";
	const ringSize = isArtwork ? 76 : 112;
	const ringStrokeWidth = isArtwork ? 7 : 9;
	const ringRadius = (ringSize - ringStrokeWidth) / 2;
	const ringCircumference = 2 * Math.PI * ringRadius;
	const progressOffset =
		ringCircumference *
		(1 - (isLoading ? 0 : props.progress.completionPercent) / 100);
	const footer = isLoading
		? "Diese Woche"
		: hasPlannedSessions
			? `${props.progress.completedMinutesToday} Min. heute`
			: "Lernplan öffnen";
	const content = (
		<>
			<View className="flex-row items-start gap-1">
				<TimeManagement
					size={isArtwork ? 13 : 14}
					color={colors.ueben}
					strokeWidth={2}
				/>
				<Text
					allowFontScaling={!isArtwork}
					adjustsFontSizeToFit={isArtwork}
					maxFontSizeMultiplier={isArtwork ? 1 : undefined}
					minimumFontScale={isArtwork ? 0.82 : undefined}
					className="flex-1 font-poppins font-semibold text-body-5 text-ueben"
					numberOfLines={isArtwork ? 1 : 2}
				>
					Wochenfortschritt
				</Text>
			</View>
			<View
				className={cn(
					"flex-1 items-center justify-center",
					isArtwork ? "py-1" : "py-2",
				)}
			>
				<View
					accessible={false}
					className="items-center justify-center"
					// SVG ring geometry uses runtime dimensions for the artwork density.
					style={{ width: ringSize, height: ringSize }}
					testID={isArtwork ? "dashboard-progress-artwork-ring" : undefined}
				>
					<Svg
						pointerEvents="none"
						width={ringSize}
						height={ringSize}
						viewBox={`0 0 ${ringSize} ${ringSize}`}
						// SVG positioning is not expressible through NativeWind classes.
						style={{ position: "absolute" }}
					>
						<Circle
							cx={ringSize / 2}
							cy={ringSize / 2}
							r={ringRadius}
							fill="none"
							stroke={colors.ueben}
							strokeOpacity={0.24}
							strokeWidth={ringStrokeWidth}
						/>
						<Circle
							cx={ringSize / 2}
							cy={ringSize / 2}
							r={ringRadius}
							fill="none"
							stroke={colors.ueben}
							strokeDasharray={`${ringCircumference} ${ringCircumference}`}
							strokeDashoffset={progressOffset}
							strokeLinecap="round"
							strokeWidth={ringStrokeWidth}
							transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`}
						/>
					</Svg>
					<Text
						allowFontScaling={!isArtwork}
						adjustsFontSizeToFit={isArtwork}
						maxFontSizeMultiplier={isArtwork ? 1 : undefined}
						minimumFontScale={isArtwork ? 0.82 : undefined}
						className={cn(
							"font-poppins font-semibold text-text",
							isArtwork ? "max-w-16 text-center text-body-4" : "text-body-1",
						)}
						numberOfLines={1}
						style={tabularNumberStyle}
					>
						{ringValue}
					</Text>
					<Text
						allowFontScaling={!isArtwork}
						adjustsFontSizeToFit={isArtwork}
						maxFontSizeMultiplier={isArtwork ? 1 : undefined}
						minimumFontScale={isArtwork ? 0.82 : undefined}
						className={cn(
							"font-poppins text-body-5 text-secondary-text",
							isArtwork && "max-w-16 text-center",
						)}
						numberOfLines={1}
					>
						{ringLabel}
					</Text>
				</View>
			</View>
			<View
				className={cn(
					"flex-row items-end justify-between gap-2",
					isArtwork ? "mt-1 pr-3" : "mt-4",
				)}
				testID={isArtwork ? "dashboard-progress-artwork-footer" : undefined}
			>
				<View className="flex-1 flex-row items-center gap-2 pr-1">
					{hasPlannedSessions && !isLoading ? (
						<Clock3
							size={isArtwork ? 13 : 16}
							color={colors.secondaryText}
							strokeWidth={1.9}
						/>
					) : null}
					<Text
						allowFontScaling={!isArtwork}
						maxFontSizeMultiplier={isArtwork ? 1 : undefined}
						className={cn(
							"flex-1 font-poppins font-semibold text-text",
							isArtwork ? "text-body-5" : "text-body-4",
						)}
						numberOfLines={isArtwork ? 1 : 2}
						style={tabularNumberStyle}
					>
						{footer}
					</Text>
				</View>
				<View
					className={cn(
						"items-center justify-center rounded-full bg-secondary",
						isArtwork ? "h-8 w-8" : "h-12 w-12",
					)}
				>
					<ArrowUpRight
						size={isArtwork ? 16 : 22}
						color={DAYOVA_DESIGN_SYSTEM.colors.light1}
						strokeWidth={2}
					/>
				</View>
			</View>
		</>
	);

	if (props.mode === "artwork") {
		return (
			<View
				accessible={false}
				accessibilityElementsHidden
				importantForAccessibility="no-hide-descendants"
				testID={props.testID}
				className="h-full w-full overflow-hidden rounded-card border border-border bg-ueben-subtle px-3 py-3"
				style={continuousBorderStyle}
			>
				{content}
			</View>
		);
	}

	return (
		<TouchableOpacity
			activeOpacity={0.82}
			accessibilityRole="button"
			accessibilityLabel={
				props.isLoading
					? "Wochenfortschritt wird geladen"
					: hasPlannedSessions
						? `Wochenfortschritt: ${props.progress.completedLearningSessions} von ${props.progress.totalLearningSessions} Lernschritten geschafft. ${props.progress.completedMinutesToday} Minuten heute`
						: "Wochenfortschritt: Noch keine Lernschritte geplant"
			}
			accessibilityHint="Öffnet deine persönlichen Lernpläne."
			onPress={props.onOpenLearningPlans}
			testID={props.testID}
			className="min-h-72 flex-1 overflow-hidden rounded-card border border-border bg-ueben-subtle px-4 pt-5 pb-4"
			style={continuousBorderStyle}
		>
			{content}
		</TouchableOpacity>
	);
}

function DashboardAgendaEntryCard(props: DashboardAgendaEntryCardProps) {
	const { colors } = useDayovaTheme();
	const isArtwork = props.mode === "artwork";
	const isPast = props.mode === "screen" && props.isPast;
	const isExam = props.item.kind === "exam";
	const Icon = isExam ? Backpack : Check;
	const accentColor = isExam
		? DAYOVA_DESIGN_SYSTEM.colors.wrong
		: DAYOVA_DESIGN_SYSTEM.colors.hausaufgabe;
	const content = (
		<>
			<View
				className={cn(
					"h-10 w-10 items-center justify-center rounded-full",
					isExam ? "bg-wrong-subtle" : "bg-hausaufgabe-subtle",
				)}
			>
				<Icon size={19} color={accentColor} strokeWidth={2} />
			</View>
			<View className="ml-3 flex-1">
				<Text
					allowFontScaling={!isArtwork}
					maxFontSizeMultiplier={isArtwork ? 1 : undefined}
					className={cn(
						"font-poppins font-semibold text-body-5",
						isExam ? "text-wrong" : "text-hausaufgabe",
					)}
				>
					{isExam ? "Prüfung" : "Aufgabe"}
				</Text>
				<Text
					allowFontScaling={!isArtwork}
					maxFontSizeMultiplier={isArtwork ? 1 : undefined}
					className="font-poppins font-semibold text-body-3 text-text"
					numberOfLines={1}
				>
					{formatGermanUiText(getAgendaEntryTitle(props.item.entry))}
				</Text>
				<Text
					allowFontScaling={!isArtwork}
					maxFontSizeMultiplier={isArtwork ? 1 : undefined}
					className="font-poppins text-body-4 text-secondary-text"
					numberOfLines={1}
				>
					{getEntrySummary(props.item.entry)}
				</Text>
			</View>
			<ArrowUpRight size={18} color={colors.secondaryText} strokeWidth={1.9} />
		</>
	);

	if (props.mode === "artwork") {
		return (
			<View
				accessible={false}
				accessibilityElementsHidden
				importantForAccessibility="no-hide-descendants"
				testID={props.testID}
				className="h-full w-full flex-row items-center rounded-3xl border border-border bg-card px-4 py-4"
				style={continuousBorderStyle}
			>
				{content}
			</View>
		);
	}

	return (
		<TouchableOpacity
			activeOpacity={0.86}
			accessibilityRole="button"
			accessibilityLabel={`${isExam ? "Prüfung" : "Aufgabe"}: ${formatGermanUiText(getAgendaEntryTitle(props.item.entry))}`}
			onPress={props.onPress}
			testID={props.testID}
			className={cn(
				"min-h-24 flex-row items-center rounded-3xl border border-border bg-card px-4 py-4",
				isPast && "opacity-55",
			)}
			style={continuousBorderStyle}
		>
			{content}
		</TouchableOpacity>
	);
}

export {
	DashboardAgendaEntryCard,
	DashboardNextStepCard,
	DashboardWeeklyProgressCard,
};
