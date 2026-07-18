import { useConvexAuth, useQueries } from "convex/react";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	type NativeScrollEvent,
	type NativeSyntheticEvent,
	ScrollView,
	type StyleProp,
	TouchableOpacity,
	useWindowDimensions,
	View,
	type ViewStyle,
} from "react-native";
import Animated, {
	type AnimatedStyle,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, {
	Defs,
	Path,
	Rect,
	Stop,
	LinearGradient as SvgLinearGradient,
} from "react-native-svg";
import { scheduleOnRN } from "react-native-worklets";
import { api } from "#convex/_generated/api";
import { CreateTypePickerModal } from "~/components/create-type-picker-modal";
import { NotificationButton } from "~/components/notification-button";
import {
	ArrowUpRight,
	Backpack,
	CalendarDays,
	Dumbbell,
	Plus,
	PropertyEdit,
} from "~/components/ui/icon";
import { NotchedActionCard } from "~/components/ui/notched-action-card";
import { useContentSizeLayout } from "~/components/ui/portrait-content";
import { Text } from "~/components/ui/text";
import { ThemedStatusBar } from "~/components/ui/themed-status-bar";
import { useAuth } from "~/context/AuthContext";
import { useValidationAnalytics } from "~/lib/analytics";
import {
	addDays,
	getDayKey,
	parseDayKey,
	useCurrentLocalDay,
} from "~/lib/day-key";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { formatGermanUiText } from "~/lib/german-ui-text";
import { useDayovaTheme } from "~/lib/theme";
import type { DayEntry } from "~/types/dayEntries";

const ALL_DAY_TIME_LABEL = "Ganztägig";
const HATCH_LINES = [
	"hatch-0",
	"hatch-1",
	"hatch-2",
	"hatch-3",
	"hatch-4",
	"hatch-5",
	"hatch-6",
	"hatch-7",
];
const TIMELINE_MARKER_HOURS = Array.from({ length: 25 }, (_, hour) => hour);
const TIMELINE_PAST_DAYS = 3;
const TIMELINE_FUTURE_DAYS = 14;
const DAY_ENTRY_QUERY_BATCH_SIZE = 31;
const PRIMARY_INTERACTIVE_GRADIENT =
	DAYOVA_DESIGN_SYSTEM.gradients.primaryInteractive;

const clamp = (value: number, min: number, max: number) =>
	Math.min(Math.max(value, min), max);

const chunkArray = <T,>(items: T[], chunkSize: number) => {
	const chunks: T[][] = [];
	for (let index = 0; index < items.length; index += chunkSize) {
		chunks.push(items.slice(index, index + chunkSize));
	}
	return chunks;
};

function SideScrollIndicator({
	scale,
	style,
}: {
	scale: number;
	style?: StyleProp<ViewStyle>;
}) {
	const { colors } = useDayovaTheme();

	return (
		<Svg
			accessible={false}
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
			pointerEvents="none"
			width={8 * scale}
			height={36 * scale}
			viewBox="0 0 8 36"
			fill="none"
			style={style}
		>
			<Path
				d="M0 16H6C7.10457 16 8 16.8954 8 18C8 19.1046 7.10457 20 6 20H0V16Z"
				fill={colors.text}
			/>
			<Path
				d="M0 8H4C5.10457 8 6 8.89543 6 10C6 11.1046 5.10457 12 4 12H0V8Z"
				fill={colors.text}
				fillOpacity={0.35}
			/>
			<Path
				d="M0 2H2C3.10457 2 4 2.89543 4 4C4 5.10457 3.10457 6 2 6H0V2Z"
				fill={colors.text}
				fillOpacity={0.15}
			/>
			<Path
				d="M0 23H4C5.10457 23 6 23.8954 6 25C6 26.1046 5.10457 27 4 27H0V23Z"
				fill={colors.text}
				fillOpacity={0.35}
			/>
			<Path
				d="M0 30H2C3.10457 30 4 30.8954 4 32C4 33.1046 3.10457 34 2 34H0V30Z"
				fill={colors.text}
				fillOpacity={0.15}
			/>
		</Svg>
	);
}

function DayNavigationHandle({
	onNext,
	onPrevious,
	scale,
	style,
}: {
	onNext: () => void;
	onPrevious: () => void;
	scale: number;
	style?: StyleProp<ViewStyle>;
}) {
	const touchTargetSize = Math.max(44, 42 * scale);
	const handleWidth = Math.max(44, 32 * scale);

	return (
		<View
			// Runtime scale and placement keep the control attached to its hero card.
			style={[
				{
					width: handleWidth,
					height: touchTargetSize * 2,
					zIndex: 50,
				},
				style,
			]}
		>
			<SideScrollIndicator
				scale={scale}
				// Runtime scale keeps the SVG centered inside its scaled touch target.
				style={{
					position: "absolute",
					left: 0,
					top: 24 * scale,
				}}
			/>
			<TouchableOpacity
				accessibilityRole="button"
				accessibilityLabel="Nächsten Tag anzeigen"
				activeOpacity={0.5}
				onPress={onNext}
				// Runtime scale defines the invisible hit region around the custom SVG.
				style={{
					position: "absolute",
					left: 0,
					top: 0,
					width: handleWidth,
					height: touchTargetSize,
				}}
			/>
			<TouchableOpacity
				accessibilityRole="button"
				accessibilityLabel="Vorherigen Tag anzeigen"
				activeOpacity={0.5}
				onPress={onPrevious}
				// Runtime scale defines the invisible hit region around the custom SVG.
				style={{
					position: "absolute",
					left: 0,
					bottom: 0,
					width: handleWidth,
					height: touchTargetSize,
				}}
			/>
		</View>
	);
}

function LearningSessionCard({
	cardWidth,
	entry,
	scale,
	compactScale,
	date,
	onPress,
	previousBlueContainer,
	currentBlueContainerAnimatedStyle,
	previousBlueContainerAnimatedStyle,
}: {
	cardWidth: number;
	entry: DayEntry | null;
	scale: number;
	compactScale: number;
	date: Date;
	onPress: () => void;
	previousBlueContainer?: {
		date: Date;
		entry: DayEntry | null;
	} | null;
	currentBlueContainerAnimatedStyle?: AnimatedStyle<ViewStyle>;
	previousBlueContainerAnimatedStyle?: AnimatedStyle<ViewStyle>;
}) {
	const innerWidth = Math.max(cardWidth - 48 * scale, 0);
	const { shouldStackInlineContent } = useContentSizeLayout({
		requestedHorizontalPadding: 24,
	});
	const startMinutes = entry ? getEntryStartMinutes(entry) : 14 * 60;
	const endMinutes = entry ? getEntryEndMinutes(entry) : startMinutes + 30;
	const title = entry ? getEntryDisplayTitle(entry) : "Heute ist frei";
	const summary = getLearningCardSummary(entry);
	const renderBlueContainerContent = (
		contentDate: Date,
		contentEntry: DayEntry | null,
	) => {
		const contentStartMinutes = contentEntry
			? getEntryStartMinutes(contentEntry)
			: 14 * 60;
		const contentEndMinutes = contentEntry
			? getEntryEndMinutes(contentEntry)
			: contentStartMinutes + 30;
		const contentMonth = getMonthLabel(contentDate).slice(0, 3);
		const contentDay = contentDate.getDate().toString().padStart(2, "0");

		return (
			<LinearGradient
				colors={PRIMARY_INTERACTIVE_GRADIENT.colors}
				start={PRIMARY_INTERACTIVE_GRADIENT.start}
				end={PRIMARY_INTERACTIVE_GRADIENT.end}
				// Runtime scale and content-size mode control the card's native layout.
				style={{
					flex: 1,
					paddingHorizontal: 24 * scale,
					paddingVertical: shouldStackInlineContent ? 16 * scale : 0,
					flexDirection: shouldStackInlineContent ? "column" : "row",
					alignItems: shouldStackInlineContent ? "flex-start" : "center",
					justifyContent: shouldStackInlineContent ? "center" : "space-between",
					rowGap: shouldStackInlineContent ? 8 * scale : 0,
				}}
			>
				<View
					className="items-center"
					// Runtime content-size mode reflows the date without changing defaults.
					style={{
						flexDirection: shouldStackInlineContent ? "row" : "column",
						columnGap: shouldStackInlineContent ? 8 * scale : 0,
					}}
				>
					<Text
						className="font-poppins text-white"
						style={{ fontSize: 12 * scale, lineHeight: 18 * scale }}
					>
						{contentMonth}
					</Text>
					<Text
						className="font-poppins font-semibold text-white"
						style={{ fontSize: 32 * scale, lineHeight: 34 * scale }}
					>
						{contentDay}
					</Text>
				</View>
				<Text
					className="font-poppins font-semibold text-white"
					style={{ fontSize: 20 * scale, lineHeight: 24 * scale }}
				>
					{`${formatMinutes(contentStartMinutes)} - ${formatMinutes(contentEndMinutes)}`}
				</Text>
			</LinearGradient>
		);
	};

	return (
		<View
			className="relative"
			style={{
				width: cardWidth,
				height: shouldStackInlineContent ? undefined : 254 * compactScale,
				minHeight: 254 * compactScale,
				marginTop: 30 * compactScale,
			}}
		>
			<NotchedActionCard
				cardHeight={238 * compactScale}
				actionIcon={
					<ArrowUpRight
						size={24 * scale}
						color={DAYOVA_DESIGN_SYSTEM.colors.light1}
						strokeWidth={1.9}
					/>
				}
				actionSize={48 * scale}
				cardAccessibilityHint="Öffnet die nächste Lerneinheit."
				cardAccessibilityLabel={`${title}, ${formatMinutes(startMinutes)} bis ${formatMinutes(endMinutes)}`}
				onPress={onPress}
				pressType="card"
				style={{
					position: shouldStackInlineContent ? "relative" : "absolute",
					top: shouldStackInlineContent ? undefined : 8 * compactScale,
					left: 0,
					width: cardWidth,
					marginTop: shouldStackInlineContent ? 8 * compactScale : 0,
				}}
				cardStyle={{
					paddingHorizontal: 24 * scale,
					paddingTop: 12 * compactScale,
					paddingBottom: shouldStackInlineContent
						? 72 * compactScale
						: 22 * compactScale,
				}}
			>
				<View
					className="absolute rounded-full"
					style={{
						left: 96 * scale,
						top: -16 * compactScale,
						width: 12 * scale,
						height: 32 * compactScale,
						backgroundColor: DAYOVA_DESIGN_SYSTEM.colors.path1,
					}}
				/>
				<View
					className="absolute rounded-full"
					style={{
						right: 96 * scale,
						top: -16 * compactScale,
						width: 12 * scale,
						height: 32 * compactScale,
						backgroundColor: DAYOVA_DESIGN_SYSTEM.colors.path1,
					}}
				/>
				<Animated.View
					style={[
						{
							width: innerWidth,
							height: shouldStackInlineContent ? undefined : 86 * compactScale,
							minHeight: 86 * compactScale,
							borderRadius: 30 * scale,
							overflow: "hidden",
						},
						currentBlueContainerAnimatedStyle,
					]}
				>
					{renderBlueContainerContent(date, entry)}
				</Animated.View>
				{previousBlueContainer && !shouldStackInlineContent ? (
					<Animated.View
						pointerEvents="none"
						style={[
							{
								position: "absolute",
								left: 24 * scale,
								top: 12 * compactScale,
								width: innerWidth,
								height: 86 * compactScale,
								borderRadius: 30 * scale,
								overflow: "hidden",
							},
							previousBlueContainerAnimatedStyle,
						]}
					>
						{renderBlueContainerContent(
							previousBlueContainer.date,
							previousBlueContainer.entry,
						)}
					</Animated.View>
				) : null}
				<View style={{ marginTop: 27 * compactScale, width: innerWidth }}>
					<Text
						className="font-poppins font-semibold text-text"
						numberOfLines={shouldStackInlineContent ? undefined : 1}
						style={{ fontSize: 16 * scale, lineHeight: 24 * scale }}
					>
						{title}
					</Text>
					<Text
						className="mt-2 font-poppins text-secondary-text"
						numberOfLines={shouldStackInlineContent ? undefined : 2}
						style={{
							width: shouldStackInlineContent ? "100%" : 301 * scale,
							fontSize: 12 * scale,
							lineHeight: 18 * scale,
						}}
					>
						{summary}
					</Text>
				</View>
			</NotchedActionCard>
		</View>
	);
}

const getEntryTitle = (entry: DayEntry) =>
	typeof entry.title === "string" && entry.title.trim().length > 0
		? formatGermanUiText(entry.title.trim())
		: "Aufgabe";

const getSubjectFromEntry = (entry: DayEntry) => {
	const title = getEntryTitle(entry)
		.replace(
			/\s*(Hausaufgabe|Leistungskontrolle|Kurzkontrolle|Test\/Klausur|Test|Klausur Deutsch\/Kunst\/Fremdsprache|Klausur|Quiz|Mündliche Prüfung|Muendliche Pruefung|Praktische Prüfung|Praktische Pruefung|Komplexe Leistung|Abschlussprüfung HSA\/Quali\/RSA|Abschlusspruefung HSA\/Quali\/RSA|Vorabi Grundkurs|Vorabi Leistungskurs|Abitur Grundkurs schriftlich|Abitur Leistungskurs schriftlich|Lernen|Lernslot|Theorie|Übung|Uebung|Probe)\s*$/i,
			"",
		)
		.trim();
	if (title.length > 0) return title;
	return entry.kind?.trim()
		? formatGermanUiText(entry.kind.trim())
		: "Allgemein";
};

const isLearningEntry = (entry: DayEntry) => {
	if (entry.relatedLearningPlanSessionId) return true;

	return /lern|theorie|übung|uebung|probe|rehearsal|practice/i.test(
		`${entry.kind ?? ""} ${getEntryTitle(entry)}`,
	);
};

const isExamEntry = (entry: DayEntry) =>
	/leistungskontrolle|test|klausur|quiz|mündlich|muendlich/i.test(
		`${entry.kind ?? ""} ${getEntryTitle(entry)}`,
	);

const getEntryDisplayTitle = (entry: DayEntry) => {
	if (isLearningEntry(entry)) return `${getSubjectFromEntry(entry)} • lernen`;
	if (isExamEntry(entry)) return `${getSubjectFromEntry(entry)} • Prüfung`;
	return getEntryTitle(entry);
};

const parseTimeToMinutes = (timeLabel?: string) => {
	if (!timeLabel || timeLabel.trim().toLowerCase() === "ganztägig") return null;
	const match = /^(\d{1,2}):(\d{2})$/.exec(timeLabel.trim());
	if (!match) return null;
	const hour = Number(match[1]);
	const minute = Number(match[2]);
	if (hour > 23 || minute > 59) return null;
	return hour * 60 + minute;
};

const getEntryStartMinutes = (entry: DayEntry) =>
	parseTimeToMinutes(entry.time) ?? 8 * 60;

const getEntryEndMinutes = (entry: DayEntry) =>
	getEntryStartMinutes(entry) + (entry.durationMinutes ?? 45);

const getEntryDurationMinutes = (entry: DayEntry) =>
	Math.max(entry.durationMinutes ?? 45, 15);

const formatMinutes = (minutes: number) => {
	const boundedMinutes = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
	const hour = Math.floor(boundedMinutes / 60);
	const minute = boundedMinutes % 60;
	return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
};

const getMonthLabel = (date: Date) =>
	new Intl.DateTimeFormat("de-DE", { month: "long" }).format(date);

const getLearningCardSummary = (entry: DayEntry | null) => {
	if (!entry) return "Keine offenen Aufgaben oder Lernblöcke für heute.";
	if (entry.notes?.trim()) return formatGermanUiText(entry.notes.trim());
	if (entry.kind?.trim()) return formatGermanUiText(entry.kind.trim());
	return "Sicheres Auflösen komplexerer Gleichungen mit Klammern und Variablen auf beiden Seiten.";
};

const getEntryUrl = (entry: DayEntry, selectedDayLabel: string) => {
	if (entry.relatedLearningPlanId) {
		return `/learning-plans/${encodeURIComponent(entry.relatedLearningPlanId)}`;
	}

	const details: Array<[string, string]> = [
		["title", getEntryTitle(entry)],
		["day", selectedDayLabel],
	];
	if (entry.kind) details.push(["kind", formatGermanUiText(entry.kind)]);
	if (entry.notes) details.push(["notes", entry.notes]);
	if (entry.examTypeLabel)
		details.push(["examType", formatGermanUiText(entry.examTypeLabel)]);
	if (entry.dueDateLabel) details.push(["dueDate", entry.dueDateLabel]);
	if (entry.plannedDateLabel)
		details.push(["plannedDate", entry.plannedDateLabel]);
	if (entry.durationMinutes)
		details.push(["duration", `${entry.durationMinutes}`]);
	if (entry.time) details.push(["time", entry.time]);

	const query = details
		.map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
		.join("&");
	return `/entry/${encodeURIComponent(entry.id)}?${query}`;
};

const getTimelineRow = (index: number) => index % 2;
const getAnalyticsEntryKind = (entry: DayEntry) =>
	isLearningEntry(entry) ? "learning" : (entry.kind ?? "entry");

export default function HomeScreen() {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const { colors, isDark } = useDayovaTheme();
	const { width, height, fontScale } = useWindowDimensions();
	const contentSizeLayout = useContentSizeLayout({
		requestedHorizontalPadding: 24,
	});
	const { user } = useAuth();
	const { capture } = useValidationAnalytics();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const today = useCurrentLocalDay();
	const [now, setNow] = useState(() => new Date());
	const [selectedDayKey, setSelectedDayKey] = useState(() => getDayKey(today));
	const [showCreateTypePicker, setShowCreateTypePicker] = useState(false);
	const [previousBlueContainer, setPreviousBlueContainer] = useState<{
		date: Date;
		entry: DayEntry | null;
	} | null>(null);
	const [measuredScheduleContentHeight, setMeasuredScheduleContentHeight] =
		useState(0);
	const timelineScrollRef = useRef<ScrollView | null>(null);
	const dayStripScrollRef = useRef<ScrollView | null>(null);
	const hasCenteredTimelineRef = useRef(false);
	const pendingTimelineSelectionRef = useRef<string | null>(null);
	const didCaptureDashboardViewRef = useRef(false);
	const blueCardSlide = useSharedValue(1);
	const blueCardSlideDirection = useSharedValue(1);

	useEffect(() => {
		const timer = setInterval(() => setNow(new Date()), 60_000);
		return () => clearInterval(timer);
	}, []);

	const visibleDays = useMemo(
		() =>
			Array.from(
				{ length: TIMELINE_PAST_DAYS + TIMELINE_FUTURE_DAYS + 1 },
				(_, index) => {
					const date = addDays(today, index - TIMELINE_PAST_DAYS);
					const key = getDayKey(date);
					return {
						key,
						date,
						weekday: new Intl.DateTimeFormat("de-DE", {
							weekday: "short",
						})
							.format(date)
							.replace(".", ""),
						dayOfMonth: date.getDate().toString(),
						isToday: key === getDayKey(today),
					};
				},
			),
		[today],
	);
	const visibleDayKeys = useMemo(
		() => visibleDays.map((day) => day.key),
		[visibleDays],
	);
	const dayKeyBatches = useMemo(
		() => chunkArray(visibleDayKeys, DAY_ENTRY_QUERY_BATCH_SIZE),
		[visibleDayKeys],
	);
	const entriesByDayResults = useQueries(
		user && isConvexAuthenticated
			? Object.fromEntries(
					dayKeyBatches.map((dayKeys, index) => [
						`days_${index}`,
						{
							query: api.dayEntries.listByDayKeys,
							args: { dayKeys },
						},
					]),
				)
			: {},
	);
	const entriesByDay = useMemo(() => {
		const grouped: Record<string, DayEntry[]> = {};
		for (const result of Object.values(entriesByDayResults)) {
			if (result instanceof Error) throw result;
			if (result === undefined) continue;
			Object.assign(grouped, result);
		}
		return grouped;
	}, [entriesByDayResults]);
	const isDashboardDataLoaded = Object.values(entriesByDayResults).every(
		(result) => result !== undefined,
	);
	const selectedDate = parseDayKey(selectedDayKey) ?? today;
	const layoutViewportWidth = Math.min(
		width,
		contentSizeLayout.containerMaxWidth,
	);
	const screenScale = clamp(layoutViewportWidth / 393, 0.86, 1.08);
	const heightScale = clamp(height / 852, 0.82, 1.08);
	const compactScale = Math.min(screenScale, heightScale);
	const blueContainerHeight = 86 * compactScale;
	const currentBlueContainerAnimatedStyle = useAnimatedStyle(() => {
		const progress = blueCardSlide.get();
		const direction = blueCardSlideDirection.get();
		const hiddenProgress = 1 - progress;

		return {
			opacity: 0.58 + progress * 0.42,
			zIndex: 1,
			transform: [
				{ perspective: 760 },
				{
					translateY: hiddenProgress * blueContainerHeight * 0.58 * direction,
				},
				{
					scale: 0.93 + progress * 0.07,
				},
				{
					rotateX: `${-hiddenProgress * 38 * direction}deg`,
				},
			],
		};
	});
	const previousBlueContainerAnimatedStyle = useAnimatedStyle(() => {
		const progress = blueCardSlide.get();
		const direction = blueCardSlideDirection.get();

		return {
			opacity: 1 - progress * 0.58,
			zIndex: 2,
			transform: [
				{ perspective: 760 },
				{
					translateY: -progress * blueContainerHeight * 0.74 * direction,
				},
				{
					scale: 1 - progress * 0.045,
				},
				{
					rotateX: `${progress * 64 * direction}deg`,
				},
			],
		};
	});
	const horizontalPadding = clamp(
		(layoutViewportWidth - 369 * screenScale) / 2,
		12,
		contentSizeLayout.horizontalPadding,
	);
	const headerInset = clamp(24 * screenScale - horizontalPadding, 0, 12);
	const contentTop = Math.max(insets.top + 16 * heightScale, 48 * compactScale);
	const sideHandleTop = contentTop + 170 * compactScale;
	const planCardWidth = Math.min(
		layoutViewportWidth - horizontalPadding * 2,
		369 * screenScale,
	);
	const scheduleCardWidth = Math.min(
		layoutViewportWidth - horizontalPadding * 2,
		369 * screenScale,
	);
	const planInnerWidth = planCardWidth - 40 * screenScale;
	const scheduleScale = clamp(planInnerWidth / 297, 0.82, 1.08);
	const timelineViewportWidth = scheduleCardWidth - 24 * screenScale;
	const hourWidth = 72 * scheduleScale;
	const dayWidth = hourWidth * 24;
	const timelineContentWidth = dayWidth * visibleDays.length;
	const timelineTopOffset = 62 * compactScale;
	const timelineBlockHeight = contentSizeLayout.shouldStackInlineContent
		? Math.max(70 * compactScale, (44 + 26 * fontScale) * screenScale)
		: 70 * compactScale;
	const timelineRowHeight = contentSizeLayout.shouldStackInlineContent
		? timelineBlockHeight + 12 * compactScale
		: 82 * compactScale;
	const timelineBottomClearance = contentSizeLayout.shouldStackInlineContent
		? 20 * compactScale + 18 * screenScale * fontScale
		: 0;
	const timelineHeight = contentSizeLayout.shouldStackInlineContent
		? Math.max(
				259 * compactScale,
				timelineTopOffset +
					timelineRowHeight +
					timelineBlockHeight +
					timelineBottomClearance,
			)
		: 259 * compactScale;
	const currentTimelineLineHeight = contentSizeLayout.shouldStackInlineContent
		? Math.max(
				0,
				timelineHeight -
					timelineBottomClearance -
					24 * compactScale -
					14 * screenScale,
			)
		: 177 * compactScale;
	const timelineMarkerColor = isDark
		? "rgba(255,255,255,0.10)"
		: "rgba(0,0,0,0.08)";
	const timelineDayMarkerColor = isDark
		? "rgba(255,255,255,0.16)"
		: "rgba(0,0,0,0.12)";
	const timelineHatchColor = isDark
		? "rgba(255,255,255,0.12)"
		: "rgba(0,0,0,0.10)";
	const timelineLearningCardColor = isDark ? colors.uebenSubtle : "#F4ECFF";
	const timelineHomeworkCardColor = isDark
		? colors.hausaufgabeSubtle
		: "#F3E8F0";
	const dayStripGap = 10 * scheduleScale;
	const getDayStripItemWidth = useCallback(
		(_isToday?: boolean) =>
			contentSizeLayout.shouldStackInlineContent
				? Math.max(42 * scheduleScale, 42 * fontScale)
				: 42 * scheduleScale,
		[contentSizeLayout.shouldStackInlineContent, fontScale, scheduleScale],
	);
	const dayStripOffsets = useMemo(() => {
		let offset = 0;
		return visibleDays.map((day) => {
			const dayOffset = offset;
			offset += getDayStripItemWidth(day.isToday) + dayStripGap;
			return dayOffset;
		});
	}, [dayStripGap, getDayStripItemWidth, visibleDays]);
	const dayStripContentWidth =
		dayStripOffsets[dayStripOffsets.length - 1] +
		getDayStripItemWidth(visibleDays[visibleDays.length - 1]?.isToday ?? false);
	const navClearance = Math.max(insets.bottom + 108 * screenScale, 132);
	const scheduleInnerWidth = scheduleCardWidth - 24 * screenScale;
	const minimumScheduleCardHeight =
		434 * compactScale +
		(contentSizeLayout.shouldStackInlineContent ? 72 * compactScale : 0);
	const scheduleCardHeight = Math.max(
		minimumScheduleCardHeight,
		measuredScheduleContentHeight,
	);
	const timelineTimeLabelWidth = contentSizeLayout.shouldStackInlineContent
		? Math.min(hourWidth, Math.max(40 * screenScale, 40 * fontScale))
		: 40;
	const timelineTimeLabelGap = contentSizeLayout.shouldStackInlineContent
		? Math.max(
				0,
				24 * scheduleScale - (timelineTimeLabelWidth - 40 * screenScale),
			)
		: 24 * scheduleScale;
	const selectedDayLabel = new Intl.DateTimeFormat("de-DE", {
		weekday: "long",
		day: "numeric",
		month: "long",
	}).format(selectedDate);
	const firstName =
		typeof user?.name === "string" && user.name.trim().length > 0
			? user.name.trim().split(/\s+/)[0]
			: "Max";
	const todayIndex = visibleDays.findIndex(
		(day) => day.key === getDayKey(today),
	);
	const selectedDayIndex = visibleDays.findIndex(
		(day) => day.key === selectedDayKey,
	);
	const selectedDayEntries = useMemo(
		() =>
			[...(entriesByDay[selectedDayKey] ?? [])].sort(
				(a, b) => getEntryStartMinutes(a) - getEntryStartMinutes(b),
			),
		[entriesByDay, selectedDayKey],
	);
	const currentHeroEntry =
		selectedDayEntries.find(
			(entry) => isLearningEntry(entry) && !entry.completed,
		) ??
		selectedDayEntries.find((entry) => !entry.completed) ??
		selectedDayEntries[0] ??
		null;
	const selectedTimelineEntries = selectedDayEntries.map(
		(entry, entryIndex) => ({
			day: visibleDays[selectedDayIndex],
			dayIndex: Math.max(selectedDayIndex, 0),
			entry,
			row: getTimelineRow(entryIndex),
		}),
	);
	const currentMinute = now.getHours() * 60 + now.getMinutes();
	const timelineLabelBaseMinute = Math.round(currentMinute / 30) * 30;
	const currentTimelineX =
		Math.max(todayIndex, 0) * dayWidth + (currentMinute / 60) * hourWidth;

	useEffect(() => {
		if (didCaptureDashboardViewRef.current || !isDashboardDataLoaded) return;
		didCaptureDashboardViewRef.current = true;
		capture("dashboard_viewed", {
			selected_day_key: selectedDayKey,
			visible_days_count: visibleDays.length,
			selected_day_entries_count: selectedDayEntries.length,
			has_hero_entry: Boolean(currentHeroEntry),
		});
	}, [
		capture,
		currentHeroEntry,
		isDashboardDataLoaded,
		selectedDayEntries.length,
		selectedDayKey,
		visibleDays.length,
	]);

	const scrollTimelineToX = useCallback(
		(x: number, animated = true) => {
			const maxScrollX = Math.max(
				timelineContentWidth - timelineViewportWidth,
				0,
			);
			timelineScrollRef.current?.scrollTo({
				x: clamp(x - timelineViewportWidth / 2, 0, maxScrollX),
				animated,
			});
		},
		[timelineContentWidth, timelineViewportWidth],
	);

	const scrollDayStripToIndex = useCallback(
		(dayIndex: number, animated = true) => {
			const itemOffset = dayStripOffsets[dayIndex] ?? 0;
			const itemWidth = getDayStripItemWidth(
				visibleDays[dayIndex]?.isToday ?? false,
			);
			const maxScrollX = Math.max(
				dayStripContentWidth - timelineViewportWidth,
				0,
			);
			dayStripScrollRef.current?.scrollTo({
				x: clamp(
					itemOffset + itemWidth / 2 - timelineViewportWidth / 2,
					0,
					maxScrollX,
				),
				animated,
			});
		},
		[
			dayStripContentWidth,
			dayStripOffsets,
			getDayStripItemWidth,
			timelineViewportWidth,
			visibleDays,
		],
	);

	const updateSelectedDayFromTimelineScroll = useCallback(
		(event: NativeSyntheticEvent<NativeScrollEvent>) => {
			if (dayWidth <= 0 || visibleDays.length === 0) return;

			const centerX =
				event.nativeEvent.contentOffset.x + timelineViewportWidth / 2;
			const centeredDayIndex = clamp(
				Math.floor(centerX / dayWidth),
				0,
				visibleDays.length - 1,
			);
			const centeredDayKey = visibleDays[centeredDayIndex]?.key;
			if (!centeredDayKey) return;
			if (
				pendingTimelineSelectionRef.current &&
				centeredDayKey !== pendingTimelineSelectionRef.current
			) {
				return;
			}

			pendingTimelineSelectionRef.current = null;

			setSelectedDayKey((currentDayKey) =>
				currentDayKey === centeredDayKey ? currentDayKey : centeredDayKey,
			);
			scrollDayStripToIndex(centeredDayIndex);
		},
		[dayWidth, scrollDayStripToIndex, timelineViewportWidth, visibleDays],
	);

	useEffect(() => {
		if (
			hasCenteredTimelineRef.current ||
			todayIndex < 0 ||
			timelineContentWidth <= 0
		)
			return;
		const frame = requestAnimationFrame(() => {
			scrollTimelineToX(currentTimelineX, false);
			scrollDayStripToIndex(todayIndex, false);
			hasCenteredTimelineRef.current = true;
		});
		return () => cancelAnimationFrame(frame);
	}, [
		currentTimelineX,
		scrollDayStripToIndex,
		scrollTimelineToX,
		timelineContentWidth,
		todayIndex,
	]);

	const selectVisibleDay = useCallback(
		(
			dayKey: string,
			dayIndex: number,
			source: "day_strip" | "today_button" | "hero_handle" = "day_strip",
		) => {
			pendingTimelineSelectionRef.current = dayKey;
			setSelectedDayKey(dayKey);
			const minuteToCenter =
				dayKey === getDayKey(today) ? currentMinute : 12 * 60;
			scrollTimelineToX(
				dayIndex * dayWidth + (minuteToCenter / 60) * hourWidth,
			);
			scrollDayStripToIndex(dayIndex);
			capture(
				source === "today_button"
					? "dashboard_today_selected"
					: "dashboard_day_selected",
				{
					selected_day_key: dayKey,
					selected_day_offset: dayIndex - TIMELINE_PAST_DAYS,
					source,
				},
			);
		},
		[
			capture,
			currentMinute,
			dayWidth,
			hourWidth,
			scrollDayStripToIndex,
			scrollTimelineToX,
			today,
		],
	);

	const clearPreviousBlueContainer = useCallback(() => {
		setPreviousBlueContainer(null);
	}, []);

	const navigateHeroDay = useCallback(
		(direction: 1 | -1) => {
			const baseIndex =
				selectedDayIndex >= 0 ? selectedDayIndex : Math.max(todayIndex, 0);
			const nextIndex = clamp(baseIndex + direction, 0, visibleDays.length - 1);
			const nextDay = visibleDays[nextIndex];
			if (!nextDay || nextIndex === baseIndex) return;

			setPreviousBlueContainer({
				date: selectedDate,
				entry: currentHeroEntry,
			});
			capture("dashboard_hero_day_changed", {
				direction: direction === 1 ? "next" : "previous",
				from_day_key: selectedDayKey,
				to_day_key: nextDay.key,
				to_day_offset: nextIndex - TIMELINE_PAST_DAYS,
			});
			blueCardSlideDirection.set(direction);
			blueCardSlide.set(0);
			selectVisibleDay(nextDay.key, nextIndex, "hero_handle");
			blueCardSlide.set(
				withTiming(1, { duration: 420 }, () => {
					"worklet";
					scheduleOnRN(clearPreviousBlueContainer);
				}),
			);
		},
		[
			blueCardSlide,
			blueCardSlideDirection,
			clearPreviousBlueContainer,
			currentHeroEntry,
			capture,
			selectVisibleDay,
			selectedDate,
			selectedDayKey,
			selectedDayIndex,
			todayIndex,
			visibleDays,
		],
	);

	const selectCreateType = (type: "homework" | "exam") => {
		setShowCreateTypePicker(false);
		capture("dashboard_create_type_selected", {
			entry_type: type,
			selected_day_key: selectedDayKey,
		});
		router.push(
			`/entry/new?type=${type}&dayKey=${encodeURIComponent(selectedDayKey)}&dayLabel=${encodeURIComponent(selectedDayLabel)}`,
		);
	};

	const openEntry = (entry: DayEntry, source: "hero_card" | "timeline") => {
		capture("dashboard_entry_opened", {
			entry_id: entry.id,
			entry_kind: getAnalyticsEntryKind(entry),
			source,
			selected_day_key: selectedDayKey,
			completed: Boolean(entry.completed),
		});
		router.push(getEntryUrl(entry, selectedDayLabel));
	};

	return (
		<View className="flex-1 bg-background">
			<ThemedStatusBar />
			<ScrollView
				className="flex-1"
				contentInsetAdjustmentBehavior="automatic"
				showsVerticalScrollIndicator={false}
				// Safe-area and responsive readable-width values are runtime layout data.
				contentContainerStyle={{
					alignSelf: "center",
					maxWidth: contentSizeLayout.containerMaxWidth,
					paddingTop: Math.max(
						insets.top + 16 * heightScale,
						48 * compactScale,
					),
					paddingBottom: navClearance,
					paddingHorizontal: horizontalPadding,
					width: "100%",
				}}
			>
				<View
					className="items-start justify-between"
					// Runtime-scaled typography keeps this dense home layout fitting device width.
					style={{
						paddingHorizontal: headerInset,
						flexDirection: contentSizeLayout.shouldStackInlineContent
							? "column"
							: "row",
						rowGap: contentSizeLayout.shouldStackInlineContent ? 12 : 0,
					}}
				>
					<View
						className="min-w-0"
						// Runtime content-size mode stacks the greeting and notification action.
						style={{
							flex: contentSizeLayout.shouldStackInlineContent ? undefined : 1,
							paddingRight: contentSizeLayout.shouldStackInlineContent ? 0 : 12,
							width: contentSizeLayout.shouldStackInlineContent
								? "100%"
								: undefined,
						}}
					>
						<Text
							className="font-poppins font-semibold text-text"
							// Runtime-scaled typography keeps this dense home layout fitting device width.
							style={{
								fontSize: 24 * screenScale,
								lineHeight: 36 * screenScale,
							}}
						>
							{`Hi ${firstName},`}
						</Text>
						<Text
							className="font-poppins text-secondary-text"
							// Runtime-scaled typography keeps this dense home layout fitting device width.
							style={{
								fontSize: 16 * screenScale,
								lineHeight: 24 * screenScale,
							}}
						>
							schön, dass du da bist!
						</Text>
					</View>
					<View
						// Runtime content-size mode moves the notification action below the copy.
						style={{
							alignSelf: contentSizeLayout.shouldStackInlineContent
								? "flex-end"
								: undefined,
						}}
					>
						<NotificationButton />
					</View>
				</View>

				<View
					className="relative items-center"
					// The enlarged wrapper spans the bounded composition so edge controls stay hittable.
					style={
						contentSizeLayout.shouldStackInlineContent
							? {
									marginLeft: -horizontalPadding,
									width: layoutViewportWidth,
								}
							: undefined
					}
				>
					<View
						className="relative"
						// Measured viewport width preserves the original hero-card proportions.
						style={{ width: planCardWidth }}
					>
						<LearningSessionCard
							cardWidth={planCardWidth}
							entry={currentHeroEntry}
							scale={screenScale}
							compactScale={compactScale}
							date={selectedDate}
							previousBlueContainer={previousBlueContainer}
							currentBlueContainerAnimatedStyle={
								currentBlueContainerAnimatedStyle
							}
							previousBlueContainerAnimatedStyle={
								previousBlueContainerAnimatedStyle
							}
							onPress={() =>
								currentHeroEntry
									? openEntry(currentHeroEntry, "hero_card")
									: undefined
							}
						/>
					</View>
					{contentSizeLayout.shouldStackInlineContent ? (
						<DayNavigationHandle
							onNext={() => navigateHeroDay(1)}
							onPrevious={() => navigateHeroDay(-1)}
							scale={screenScale}
							// Runtime scale preserves the edge-aligned enlarged handle position.
							style={{ position: "absolute", left: 0, top: 104 * compactScale }}
						/>
					) : null}
				</View>

				<View
					className="relative self-center"
					// Measured content height lets the decorative SVG grow with text.
					style={{
						width: scheduleCardWidth,
						height: scheduleCardHeight,
						marginTop: 28 * compactScale,
					}}
				>
					<Svg
						accessible={false}
						accessibilityElementsHidden
						importantForAccessibility="no-hide-descendants"
						pointerEvents="none"
						width="100%"
						height="100%"
						viewBox="0 0 369 434"
						preserveAspectRatio="none"
						// SVG geometry must fill the measured decorative frame.
						style={{ position: "absolute", inset: 0 }}
					>
						<Path
							d="M70.4004 0.150391H239.266C253.395 0.150391 264.85 11.6047 264.85 25.7344V30.7344C264.85 43.2435 274.991 53.3838 287.5 53.3838H314.75C323.267 53.3838 327.507 53.3845 331.058 53.9717C349.436 57.0115 363.888 71.3317 367.097 89.6816C367.716 93.2265 367.756 97.467 367.834 105.983L368.85 216.618V362.834C368.85 375.157 368.85 384.391 368.251 391.721C367.652 399.049 366.456 404.46 364.07 409.142C359.866 417.392 353.158 424.101 344.907 428.305C340.226 430.69 334.815 431.887 327.487 432.485C320.158 433.084 310.923 433.084 298.6 433.084H70.4004C58.0768 433.084 48.8423 433.084 41.5127 432.485C34.1852 431.887 28.774 430.69 24.0928 428.305C15.8419 424.101 9.13374 417.392 4.92969 409.142C2.5444 404.46 1.34773 399.049 0.749023 391.721C0.150198 384.391 0.150391 375.157 0.150391 362.834V70.4004C0.150391 58.0768 0.150174 48.8423 0.749023 41.5127C1.34774 34.1851 2.54447 28.7741 4.92969 24.0928C9.13374 15.8419 15.8419 9.13374 24.0928 4.92969C28.7741 2.54447 34.1851 1.34774 41.5127 0.749023C48.8423 0.150174 58.0768 0.150391 70.4004 0.150391Z"
							fill={colors.surface}
							stroke={colors.border}
							strokeWidth={0.3}
						/>
					</Svg>
					<View
						className="relative z-10"
						onLayout={({ nativeEvent }) => {
							setMeasuredScheduleContentHeight(nativeEvent.layout.height);
						}}
						// Runtime scale and measured content make the decorative frame grow with text.
						style={{
							paddingHorizontal: 12 * screenScale,
							paddingTop: 24 * compactScale,
							paddingBottom: 12 * compactScale,
						}}
					>
						<View
							className="items-start justify-between"
							// Runtime content-size mode reflows the schedule heading and actions.
							style={{
								flexDirection: contentSizeLayout.shouldStackInlineContent
									? "column"
									: "row",
								rowGap: contentSizeLayout.shouldStackInlineContent
									? 8 * compactScale
									: 0,
							}}
						>
							<Text
								className="ml-3 font-poppins font-semibold text-text"
								// Runtime scale keeps this dense decorative card proportional.
								style={{
									fontSize: 24 * screenScale,
									lineHeight: 36 * screenScale,
								}}
							>
								{`Plan für ${getMonthLabel(selectedDate)}`}
							</Text>
							<View
								className="relative"
								// Runtime scale and reflow mode place the custom SVG action rail.
								style={{
									position: contentSizeLayout.shouldStackInlineContent
										? "relative"
										: "absolute",
									top: contentSizeLayout.shouldStackInlineContent
										? undefined
										: -24 * compactScale,
									right: contentSizeLayout.shouldStackInlineContent
										? undefined
										: -12 * screenScale,
									alignSelf: contentSizeLayout.shouldStackInlineContent
										? "flex-end"
										: undefined,
									width: 104 * screenScale,
									height: 52 * screenScale,
								}}
							>
								<Svg
									accessible={false}
									accessibilityElementsHidden
									importantForAccessibility="no-hide-descendants"
									pointerEvents="none"
									width="100%"
									height="100%"
									viewBox="0 0 104 52"
									preserveAspectRatio="none"
									// SVG geometry fills the runtime-scaled action rail.
									style={{ position: "absolute", inset: 0 }}
								>
									<Path
										d="M29 0.150391H78.1299C92.3346 0.150391 103.85 11.6654 103.85 25.8701C103.85 40.1753 92.1775 51.7318 77.873 51.5889L54.002 51.3496H27C14.3803 51.3496 4.15039 41.1197 4.15039 28.5V25C4.15039 11.2757 15.2757 0.150391 29 0.150391Z"
										fill={colors.surface}
										stroke={colors.border}
										strokeWidth={0.3}
									/>
									<Rect
										x={8}
										y={6}
										width={40}
										height={40}
										rx={20}
										fill={colors.systemSubtle}
									/>
									<Rect
										x={56}
										y={6}
										width={40}
										height={40}
										rx={20}
										fill="url(#dashboardActionsGradient)"
									/>
									<Path
										d="M76.001 19V33.002"
										stroke="white"
										strokeWidth={1.5}
										strokeLinecap="round"
										strokeLinejoin="round"
									/>
									<Path
										d="M83.002 26.002H69"
										stroke="white"
										strokeWidth={1.5}
										strokeLinecap="round"
										strokeLinejoin="round"
									/>
									<Defs>
										<SvgLinearGradient
											id="dashboardActionsGradient"
											x1={76}
											y1={6}
											x2={76}
											y2={46}
											gradientUnits="userSpaceOnUse"
										>
											<Stop stopColor="#00A0E6" />
											<Stop offset={1} stopColor="#4FD8FF" />
										</SvgLinearGradient>
									</Defs>
								</Svg>
								<View
									pointerEvents="none"
									className="absolute items-center justify-center"
									style={{
										left: 8 * screenScale,
										top: 6 * screenScale,
										width: 40 * screenScale,
										height: 40 * screenScale,
									}}
								>
									<CalendarDays
										size={20 * screenScale}
										color={DAYOVA_DESIGN_SYSTEM.colors.primary}
										strokeWidth={1.8}
									/>
									<Text
										className="absolute font-poppins font-semibold text-primary"
										style={{
											top: 20.5 * screenScale,
											fontSize: 6 * screenScale,
											lineHeight: 9 * screenScale,
										}}
									>
										{today.getDate()}
									</Text>
								</View>
								<View
									pointerEvents="none"
									className="absolute items-center justify-center"
									style={{
										left: 56 * screenScale,
										top: 6 * screenScale,
										width: 40 * screenScale,
										height: 40 * screenScale,
									}}
								>
									<Plus
										size={24 * screenScale}
										color={DAYOVA_DESIGN_SYSTEM.colors.light1}
										strokeWidth={1.7}
									/>
								</View>
								<TouchableOpacity
									activeOpacity={0.82}
									accessibilityRole="button"
									accessibilityLabel="Zum heutigen Plan springen"
									onPress={() =>
										selectVisibleDay(
											getDayKey(today),
											todayIndex,
											"today_button",
										)
									}
									style={{
										position: "absolute",
										left: 8 * screenScale,
										top: 6 * screenScale,
										width: 40 * screenScale,
										height: 40 * screenScale,
										borderRadius: 20 * screenScale,
									}}
								/>
								<TouchableOpacity
									activeOpacity={0.9}
									accessibilityRole="button"
									accessibilityLabel="Neuen Eintrag erstellen"
									onPress={() => {
										capture("dashboard_create_opened", {
											selected_day_key: selectedDayKey,
										});
										setShowCreateTypePicker(true);
									}}
									style={{
										position: "absolute",
										left: 56 * screenScale,
										top: 6 * screenScale,
										width: 40 * screenScale,
										height: 40 * screenScale,
										borderRadius: 20 * screenScale,
									}}
								/>
							</View>
						</View>

						<ScrollView
							ref={dayStripScrollRef}
							horizontal
							showsHorizontalScrollIndicator={false}
							// Runtime scale and reflow mode set the day strip's vertical rhythm.
							style={{
								marginTop: contentSizeLayout.shouldStackInlineContent
									? 16 * compactScale
									: 23 * compactScale,
								alignSelf: "center",
							}}
							contentContainerStyle={{ width: dayStripContentWidth }}
						>
							<View
								className="flex-row"
								style={{
									columnGap: dayStripGap,
									width: dayStripContentWidth,
								}}
							>
								{visibleDays.map((day, dayIndex) => {
									const selected = selectedDayKey === day.key;
									const itemWidth = getDayStripItemWidth(day.isToday);
									const itemHeight = contentSizeLayout.shouldStackInlineContent
										? itemWidth
										: 42 * screenScale;
									const content = (
										<Text
											key={`${day.key}-label`}
											className={`font-poppins font-semibold ${selected ? "text-white" : "text-text"}`}
											style={{
												fontSize: 16 * screenScale,
												lineHeight: 24 * screenScale,
											}}
										>
											{day.dayOfMonth}
										</Text>
									);

									return (
										<View
											key={day.key}
											className="items-center"
											style={{ width: itemWidth, rowGap: 4 * compactScale }}
										>
											<Text
												className="font-poppins font-semibold text-secondary-text"
												style={{
													fontSize: 12 * screenScale,
													lineHeight: 18 * screenScale,
												}}
											>
												{day.weekday}
											</Text>
											<TouchableOpacity
												activeOpacity={0.82}
												accessibilityRole="button"
												accessibilityState={{ selected }}
												accessibilityLabel={`${day.weekday}, ${day.dayOfMonth}`}
												onPress={() =>
													selectVisibleDay(day.key, dayIndex, "day_strip")
												}
											>
												{selected ? (
													<LinearGradient
														colors={PRIMARY_INTERACTIVE_GRADIENT.colors}
														start={PRIMARY_INTERACTIVE_GRADIENT.start}
														end={PRIMARY_INTERACTIVE_GRADIENT.end}
														style={{
															width: itemWidth,
															height: itemHeight,
															borderRadius: 99,
															alignItems: "center",
															justifyContent: "center",
														}}
													>
														{content}
													</LinearGradient>
												) : (
													<View
														className="items-center justify-center rounded-full"
														style={{
															width: itemWidth,
															height: itemHeight,
														}}
													>
														{content}
													</View>
												)}
											</TouchableOpacity>
										</View>
									);
								})}
							</View>
						</ScrollView>

						<View
							className="overflow-hidden bg-light-2"
							style={{
								marginTop: 14 * compactScale,
								height: timelineHeight,
								width: scheduleInnerWidth,
								borderRadius: 28 * screenScale,
							}}
						>
							<ScrollView
								ref={timelineScrollRef}
								horizontal
								showsHorizontalScrollIndicator={false}
								decelerationRate="fast"
								onScroll={updateSelectedDayFromTimelineScroll}
								scrollEventThrottle={16}
								nestedScrollEnabled
							>
								<View
									className="relative"
									style={{
										width: timelineContentWidth,
										height: timelineHeight,
									}}
								>
									{visibleDays.flatMap((day, dayIndex) =>
										TIMELINE_MARKER_HOURS.map((hour) => (
											<View
												key={`${day.key}-${hour}`}
												className="absolute"
												style={{
													left: dayIndex * dayWidth + hour * hourWidth,
													top: 38 * compactScale,
													bottom: 38 * compactScale,
													width: hour === 24 ? 0 : 1,
													backgroundColor:
														hour === 0
															? timelineDayMarkerColor
															: timelineMarkerColor,
												}}
											/>
										)),
									)}

									{selectedTimelineEntries.map(
										({ day, dayIndex, entry, row }) => {
											if (!day) return null;
											const start = getEntryStartMinutes(entry);
											const duration = getEntryDurationMinutes(entry);
											const blockLeft =
												dayIndex * dayWidth + (start / 60) * hourWidth;
											const blockWidth = Math.max(
												(duration / 60) * hourWidth,
												155 * scheduleScale,
											);
											const learning = isLearningEntry(entry);
											const Icon = learning
												? row === 0
													? Dumbbell
													: PropertyEdit
												: Backpack;

											return (
												<TouchableOpacity
													key={`${day.key}-${entry.id}`}
													activeOpacity={0.86}
													accessibilityRole="button"
													accessibilityLabel={`${getEntryDisplayTitle(entry)}, ${entry.time ?? ALL_DAY_TIME_LABEL}`}
													onPress={() => {
														setSelectedDayKey(day.key);
														openEntry(entry, "timeline");
													}}
													className="absolute rounded-2xl"
													style={{
														left: blockLeft,
														top: timelineTopOffset + row * timelineRowHeight,
														width: Math.min(
															blockWidth,
															timelineContentWidth - blockLeft,
														),
														height: timelineBlockHeight,
														padding: 12 * screenScale,
														backgroundColor: learning
															? timelineLearningCardColor
															: timelineHomeworkCardColor,
													}}
												>
													<Icon
														size={16 * screenScale}
														color={
															learning
																? DAYOVA_DESIGN_SYSTEM.colors.ueben
																: DAYOVA_DESIGN_SYSTEM.colors.hausaufgabe
														}
														strokeWidth={1.9}
													/>
													<Text
														className="mt-1 font-poppins font-semibold text-text"
														numberOfLines={1}
														style={{
															fontSize: 12 * screenScale,
															lineHeight: 14 * screenScale,
														}}
													>
														{getSubjectFromEntry(entry)}
													</Text>
													<Text
														className="font-poppins text-secondary-text"
														numberOfLines={1}
														style={{
															fontSize: 10 * screenScale,
															lineHeight: 12 * screenScale,
														}}
													>
														{entry.time ??
															(learning ? "Lerneinheit" : "Aufgabe")}
													</Text>
													<View
														className="absolute items-center justify-center rounded-full bg-card"
														style={{
															right: 12 * screenScale,
															top: 12 * compactScale,
															width: 23 * screenScale,
															height: 23 * screenScale,
														}}
													>
														<ArrowUpRight
															size={14 * screenScale}
															color={colors.text}
															strokeWidth={2}
														/>
													</View>
												</TouchableOpacity>
											);
										},
									)}

									<View
										className="absolute items-center"
										style={{
											top: 24 * compactScale,
											left: currentTimelineX,
										}}
									>
										<View
											className="items-center justify-center rounded-full border border-primary bg-card"
											style={{
												width: 14 * screenScale,
												height: 14 * screenScale,
											}}
										>
											<View
												className="rounded-full bg-primary"
												style={{
													width: 10 * screenScale,
													height: 10 * screenScale,
												}}
											/>
										</View>
										<View
											className="bg-primary"
											style={{
												width: 4 * screenScale,
												height: currentTimelineLineHeight,
											}}
										/>
									</View>

									<View
										className="absolute flex-row"
										style={{
											left: currentTimelineX - 136 * scheduleScale,
											bottom: 20 * compactScale,
											columnGap: timelineTimeLabelGap,
										}}
									>
										{[-90, -60, -30, 0, 30].map((offset) => (
											<Text
												key={offset}
												className="text-center font-poppins text-text"
												numberOfLines={1}
												style={{
													width: timelineTimeLabelWidth,
													fontSize: 12 * screenScale,
													lineHeight: 18 * screenScale,
													fontWeight: offset === 0 ? "600" : "400",
												}}
											>
												{formatMinutes(timelineLabelBaseMinute + offset)}
											</Text>
										))}
									</View>
									<View
										className="absolute overflow-hidden"
										style={{
											top: 143 * compactScale,
											right: 12 * scheduleScale,
											width: 57 * scheduleScale,
											height: 37 * screenScale,
										}}
									>
										{HATCH_LINES.map((line, index) => (
											<View
												key={line}
												className="absolute"
												style={{
													width: 2 * screenScale,
													height: 49 * screenScale,
													left: index * 8 * scheduleScale,
													top: -9 * screenScale,
													backgroundColor: timelineHatchColor,
													transform: [{ rotate: "24deg" }],
												}}
											/>
										))}
									</View>
								</View>
							</ScrollView>
							{selectedTimelineEntries.length === 0 ? (
								<View
									pointerEvents="none"
									className="absolute right-0 left-0 items-center"
									// Runtime scale vertically centers the empty state in the timeline.
									style={
										contentSizeLayout.shouldStackInlineContent
											? { top: 0, bottom: 0, justifyContent: "center" }
											: { top: 105 * compactScale }
									}
								>
									<Text
										className="w-full px-3 text-center font-poppins text-secondary-text"
										// Runtime scale keeps timeline annotation text proportional.
										style={{
											fontSize: 12 * screenScale,
											lineHeight: 18 * screenScale,
										}}
									>
										Keine Einträge an diesem Tag
									</Text>
								</View>
							) : null}
						</View>
					</View>
				</View>
			</ScrollView>

			{contentSizeLayout.shouldStackInlineContent ? null : (
				<DayNavigationHandle
					onNext={() => navigateHeroDay(1)}
					onPrevious={() => navigateHeroDay(-1)}
					scale={screenScale}
					// Runtime safe-area and scale values preserve the default handle position.
					style={{
						position: "absolute",
						left: Math.max((width - layoutViewportWidth) / 2, 0),
						top: sideHandleTop,
					}}
				/>
			)}

			<CreateTypePickerModal
				visible={showCreateTypePicker}
				onRequestClose={() => setShowCreateTypePicker(false)}
				onSelect={selectCreateType}
			/>
		</View>
	);
}
