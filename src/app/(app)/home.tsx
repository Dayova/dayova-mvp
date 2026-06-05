import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	Modal,
	type NativeScrollEvent,
	type NativeSyntheticEvent,
	Pressable,
	ScrollView,
	TouchableOpacity,
	useWindowDimensions,
	View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";
import { api } from "#convex/_generated/api";
import { NotificationButton } from "~/components/notification-button";
import {
	ClipboardEdit,
	GraduationCap,
	NotebookPen,
	Plus,
	X,
} from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
import { useAuth } from "~/context/AuthContext";
import {
	addDays,
	getDayKey,
	parseDayKey,
	useCurrentLocalDay,
} from "~/lib/day-key";
import { formatGermanUiText } from "~/lib/german-ui-text";
import type { DayEntry } from "~/types/dayEntries";

const EMPTY_ENTRIES_BY_DAY: Record<string, DayEntry[]> = {};
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

const clamp = (value: number, min: number, max: number) =>
	Math.min(Math.max(value, min), max);

type CreateTypeOptionProps = {
	icon: typeof ClipboardEdit;
	title: string;
	description: string;
	onPress: () => void;
	scale: number;
	width: number;
};

function CreateTypeOption({
	icon: Icon,
	title,
	description,
	onPress,
	scale,
	width,
}: CreateTypeOptionProps) {
	return (
		<TouchableOpacity
			accessibilityLabel={title}
			accessibilityRole="button"
			activeOpacity={0.86}
			onPress={onPress}
			className="flex-row items-center bg-white"
			style={{
				width,
				height: 96 * scale,
				borderRadius: 40 * scale,
				paddingHorizontal: 16 * scale,
				paddingVertical: 12 * scale,
				columnGap: 16 * scale,
				boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
			}}
		>
			<View
				className="items-center justify-center rounded-full bg-[#EAF3FF]"
				style={{
					width: 48 * scale,
					height: 48 * scale,
					boxShadow:
						"0 2px 4px -2px rgba(24, 39, 75, 0.12), 0 4px 4px -2px rgba(24, 39, 75, 0.08)",
				}}
			>
				<Icon size={24 * scale} color="#3A7BFF" strokeWidth={1.5} />
			</View>
			<View style={{ flex: 1, rowGap: 4 * scale }}>
				<Text
					className="font-medium font-poppins text-black"
					style={{
						fontSize: 16 * scale,
						lineHeight: 24 * scale,
						includeFontPadding: false,
					}}
				>
					{title}
				</Text>
				<Text
					className="font-poppins text-[#7E7E7E]"
					style={{
						fontSize: 12 * scale,
						lineHeight: 18 * scale,
						includeFontPadding: false,
					}}
				>
					{description}
				</Text>
			</View>
		</TouchableOpacity>
	);
}

type DragStartSliderProps = {
	scale: number;
	compactScale: number;
	onComplete: () => void;
};

function DragStartSlider({
	scale,
	compactScale,
	onComplete,
}: DragStartSliderProps) {
	const knobWidth = 110 * scale;
	const trackWidth = 228 * scale;
	const maxDrag = trackWidth - knobWidth - 8 * scale;
	const dragX = useSharedValue(0);
	const isCompleting = useSharedValue(false);

	const panGesture = Gesture.Pan()
		.activeOffsetX([-8 * scale, 8 * scale])
		.failOffsetY([-14 * scale, 14 * scale])
		.onBegin(() => {
			"worklet";
			dragX.value = 0;
			isCompleting.value = false;
		})
		.onUpdate((event) => {
			"worklet";
			dragX.value = Math.min(Math.max(event.translationX, 0), maxDrag);
		})
		.onEnd((event) => {
			"worklet";
			const nextValue = Math.min(Math.max(event.translationX, 0), maxDrag);
			const shouldComplete =
				nextValue >= maxDrag * 0.72 ||
				(event.velocityX > 650 && nextValue >= maxDrag * 0.35);

			if (!shouldComplete || isCompleting.value) return;

			isCompleting.value = true;
			dragX.value = withTiming(maxDrag, { duration: 90 }, (finished) => {
				"worklet";
				if (!finished) return;
				scheduleOnRN(onComplete);
				dragX.value = withTiming(0, { duration: 120 });
				isCompleting.value = false;
			});
		})
		.onFinalize(() => {
			"worklet";
			if (isCompleting.value) return;
			dragX.value = withTiming(0, { duration: 160 });
		});

	const knobAnimatedStyle = useAnimatedStyle(() => ({
		transform: [{ translateX: dragX.value }],
	}));

	return (
		<GestureDetector gesture={panGesture}>
			<View
				accessibilityRole="adjustable"
				accessibilityLabel="Zum Starten nach rechts ziehen"
				className="justify-center rounded-full bg-[#EDFDFC]"
				style={{
					width: trackWidth,
					height: 56 * scale,
					marginTop: 24 * compactScale,
					padding: 4 * scale,
					boxShadow: "0 8px 18px rgba(0, 0, 0, 0.10)",
				}}
			>
				<View
					className="absolute flex-row items-center"
					style={{ right: 34 * scale }}
					pointerEvents="none"
				>
					{[0.2, 0.6, 1].map((opacity, index) => (
						<Text
							key={opacity}
							className="font-poppins font-semibold text-[#3A7BFF]"
							style={{
								marginLeft: index === 0 ? 0 : -4 * scale,
								fontSize: 24 * scale,
								opacity,
							}}
						>
							›
						</Text>
					))}
				</View>
				<Animated.View
					style={[
						{
							width: knobWidth,
							height: 48 * scale,
							borderRadius: 100,
							overflow: "hidden",
						},
						knobAnimatedStyle,
					]}
				>
					<LinearGradient
						colors={["#3A7BFF", "#59D6CF"]}
						start={{ x: 0, y: 0.5 }}
						end={{ x: 1, y: 0.5 }}
						style={{
							flex: 1,
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<Text
							className="font-bold font-poppins text-white"
							style={{
								fontSize: 16 * scale,
								lineHeight: 17 * scale,
								includeFontPadding: false,
								textShadowColor: "rgba(0,0,0,0.15)",
								textShadowOffset: { width: 2, height: 4 },
								textShadowRadius: 8,
							}}
						>
							Starten
						</Text>
					</LinearGradient>
				</Animated.View>
			</View>
		</GestureDetector>
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

const isEntryActiveNow = (entry: DayEntry, now: Date) => {
	const startMinutes = parseTimeToMinutes(entry.time);
	if (startMinutes === null) return false;
	const nowMinutes = now.getHours() * 60 + now.getMinutes();
	return (
		nowMinutes >= startMinutes &&
		nowMinutes <= startMinutes + (entry.durationMinutes ?? 45)
	);
};

const getTimelineRow = (index: number) => index % 3;

export default function HomeScreen() {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const { width, height } = useWindowDimensions();
	const { user } = useAuth();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const today = useCurrentLocalDay();
	const [now, setNow] = useState(() => new Date());
	const [selectedDayKey, setSelectedDayKey] = useState(() => getDayKey(today));
	const [showCreateTypePicker, setShowCreateTypePicker] = useState(false);
	const timelineScrollRef = useRef<ScrollView | null>(null);
	const hasCenteredTimelineRef = useRef(false);
	const pendingTimelineSelectionRef = useRef<string | null>(null);
	const setSessionCompleted = useMutation(
		api.learningPlans.setSessionCompleted,
	);

	useEffect(() => {
		const timer = setInterval(() => setNow(new Date()), 60_000);
		return () => clearInterval(timer);
	}, []);

	const visibleDays = useMemo(
		() =>
			Array.from({ length: 7 }, (_, index) => {
				const date = addDays(today, index - 3);
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
			}),
		[today],
	);
	const visibleDayKeys = useMemo(
		() => visibleDays.map((day) => day.key),
		[visibleDays],
	);
	const entriesByDayResult = useQuery(
		api.dayEntries.listByDayKeys,
		user && isConvexAuthenticated ? { dayKeys: visibleDayKeys } : "skip",
	);
	const entriesByDay = entriesByDayResult ?? EMPTY_ENTRIES_BY_DAY;
	const selectedDate = parseDayKey(selectedDayKey) ?? today;
	const timelineEntries = useMemo(
		() =>
			visibleDays.flatMap((day, dayIndex) =>
				[...(entriesByDay[day.key] ?? [])]
					.sort((a, b) => getEntryStartMinutes(a) - getEntryStartMinutes(b))
					.map((entry, entryIndex) => ({
						day,
						dayIndex,
						entry,
						row: getTimelineRow(entryIndex),
					})),
			),
		[entriesByDay, visibleDays],
	);
	const todayEntries = useMemo(
		() =>
			[...(entriesByDay[getDayKey(today)] ?? [])].sort(
				(a, b) => getEntryStartMinutes(a) - getEntryStartMinutes(b),
			),
		[entriesByDay, today],
	);
	const heroEntry = useMemo(() => {
		const incompleteLearningEntries = todayEntries.filter(
			(entry) => isLearningEntry(entry) && !entry.completed,
		);
		return (
			incompleteLearningEntries.find((entry) => isEntryActiveNow(entry, now)) ??
			incompleteLearningEntries.find(
				(entry) =>
					getEntryStartMinutes(entry) >= now.getHours() * 60 + now.getMinutes(),
			) ??
			incompleteLearningEntries[0] ??
			todayEntries.find((entry) => !entry.completed) ??
			null
		);
	}, [todayEntries, now]);
	const screenScale = clamp(width / 393, 0.86, 1.08);
	const heightScale = clamp(height / 852, 0.82, 1.08);
	const compactScale = Math.min(screenScale, heightScale);
	const horizontalPadding = clamp((width - 369 * screenScale) / 2, 12, 24);
	const headerInset = clamp(24 * screenScale - horizontalPadding, 0, 12);
	const lessonCardWidth = Math.min(
		width - horizontalPadding * 2,
		345 * screenScale,
	);
	const planCardWidth = Math.min(
		width - horizontalPadding * 2,
		369 * screenScale,
	);
	const planInnerWidth = planCardWidth - 40 * screenScale;
	const scheduleScale = clamp(planInnerWidth / 297, 0.82, 1.08);
	const timelineViewportWidth = planInnerWidth;
	const hourWidth = 72 * scheduleScale;
	const dayWidth = hourWidth * 24;
	const timelineContentWidth = dayWidth * visibleDays.length;
	const timelineHeight = 188 * compactScale;
	const timelineRowHeight = 35 * compactScale;
	const timelineBlockHeight = 32 * screenScale;
	const timelineTopOffset = 32 * compactScale;
	const navClearance = Math.max(insets.bottom + 108 * screenScale, 132);
	const modalScale = clamp(width / 393, 0.88, 1);
	const modalWidth = width;
	const modalOptionWidth = Math.min(width - 48 * modalScale, 345 * modalScale);
	const modalBottomPadding = Math.max(insets.bottom + 28 * modalScale, 42);
	const selectedDayLabel = new Intl.DateTimeFormat("de-DE", {
		weekday: "long",
		day: "numeric",
		month: "long",
	}).format(selectedDate);
	const firstName =
		typeof user?.name === "string" && user.name.trim().length > 0
			? user.name.trim().split(/\s+/)[0]
			: "Max";
	const currentMinute = now.getHours() * 60 + now.getMinutes();
	const todayIndex = visibleDays.findIndex(
		(day) => day.key === getDayKey(today),
	);
	const currentTimelineX =
		Math.max(todayIndex, 0) * dayWidth + (currentMinute / 60) * hourWidth;

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
		},
		[dayWidth, timelineViewportWidth, visibleDays],
	);

	useEffect(() => {
		if (hasCenteredTimelineRef.current || timelineContentWidth <= 0) return;
		const frame = requestAnimationFrame(() => {
			scrollTimelineToX(currentTimelineX, false);
			hasCenteredTimelineRef.current = true;
		});
		return () => cancelAnimationFrame(frame);
	}, [currentTimelineX, scrollTimelineToX, timelineContentWidth]);

	const selectVisibleDay = (dayKey: string, dayIndex: number) => {
		pendingTimelineSelectionRef.current = dayKey;
		setSelectedDayKey(dayKey);
		const minuteToCenter =
			dayKey === getDayKey(today) ? currentMinute : 12 * 60;
		scrollTimelineToX(dayIndex * dayWidth + (minuteToCenter / 60) * hourWidth);
	};

	const selectCreateType = (type: "homework" | "exam") => {
		setShowCreateTypePicker(false);
		router.push(
			`/entry/new?type=${type}&dayKey=${encodeURIComponent(selectedDayKey)}&dayLabel=${encodeURIComponent(selectedDayLabel)}`,
		);
	};

	const openEntry = (entry: DayEntry) => {
		router.push(getEntryUrl(entry, selectedDayLabel));
	};

	const completeHeroEntry = () => {
		if (!heroEntry?.relatedLearningPlanSessionId) return;
		void setSessionCompleted({
			sessionId: heroEntry.relatedLearningPlanSessionId,
			completed: true,
		});
	};

	return (
		<View className="flex-1 bg-[#F4F8FB]">
			<StatusBar style="dark" />
			<ScrollView
				className="flex-1"
				contentInsetAdjustmentBehavior="automatic"
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{
					paddingTop: Math.max(
						insets.top + 16 * heightScale,
						48 * compactScale,
					),
					paddingBottom: navClearance,
					paddingHorizontal: horizontalPadding,
				}}
			>
				<View
					className="flex-row items-start justify-between"
					style={{ paddingHorizontal: headerInset }}
				>
					<View>
						<Text
							className="font-poppins font-semibold text-text"
							style={{
								fontSize: 24 * screenScale,
								lineHeight: 29 * screenScale,
								includeFontPadding: false,
							}}
						>
							{`Hi ${firstName},`}
						</Text>
						<Text
							className="font-poppins text-[#7E7E7E]"
							style={{
								fontSize: 16 * screenScale,
								lineHeight: 20 * screenScale,
								includeFontPadding: false,
							}}
						>
							schön dass du da bist
						</Text>
					</View>
					<NotificationButton />
				</View>

				<View className="items-center" style={{ marginTop: 28 * compactScale }}>
					<View
						className="items-center bg-white"
						style={{
							width: lessonCardWidth,
							justifyContent: "center",
							minHeight: 273 * compactScale,
							borderRadius: 40 * screenScale,
							paddingHorizontal: 24 * screenScale,
							paddingVertical: 32 * compactScale,
							boxShadow: "0 16px 22px rgba(0, 0, 0, 0.10)",
						}}
					>
						<View
							className="items-center justify-center rounded-full bg-[#EAF3FF]"
							style={{
								width: 48 * screenScale,
								height: 48 * screenScale,
								boxShadow: "0 8px 18px rgba(58, 123, 255, 0.12)",
							}}
						>
							<NotebookPen
								size={24 * screenScale}
								color="#3A7BFF"
								strokeWidth={1.7}
							/>
						</View>

						<View
							className="items-center"
							style={{
								marginTop: heroEntry ? 24 * compactScale : 18 * compactScale,
							}}
						>
							<Text
								className="text-center font-poppins font-semibold text-[#0D062D]"
								numberOfLines={1}
								adjustsFontSizeToFit
								style={{
									width: 274 * screenScale,
									fontSize: 24 * screenScale,
									lineHeight: 32 * screenScale,
									includeFontPadding: false,
								}}
							>
								{heroEntry ? getEntryDisplayTitle(heroEntry) : "Heute ist frei"}
							</Text>
							<Text
								className="mt-1 text-center font-poppins text-[#787486]"
								style={{
									maxWidth: 274 * screenScale,
									fontSize: 12 * screenScale,
									lineHeight: 18 * screenScale,
									includeFontPadding: false,
								}}
							>
								{heroEntry
									? `${heroEntry.time ?? ALL_DAY_TIME_LABEL}${heroEntry.durationMinutes ? ` • ${heroEntry.durationMinutes} Min.` : ""} • ${new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long" }).format(today)}`
									: "Keine offenen Aufgaben oder Lernblöcke für heute."}
							</Text>
						</View>

						{heroEntry ? (
							<DragStartSlider
								scale={screenScale}
								compactScale={compactScale}
								onComplete={() => openEntry(heroEntry)}
							/>
						) : null}

						{heroEntry?.relatedLearningPlanSessionId ? (
							<TouchableOpacity
								accessibilityRole="button"
								accessibilityLabel="Lernblock als erledigt markieren"
								activeOpacity={0.76}
								onPress={completeHeroEntry}
								style={{ marginTop: 12 * compactScale }}
							>
								<Text
									className="font-poppins font-semibold text-[#3A7BFF]"
									style={{
										fontSize: 12 * screenScale,
										lineHeight: 16 * screenScale,
										includeFontPadding: false,
									}}
								>
									Als erledigt markieren
								</Text>
							</TouchableOpacity>
						) : null}
					</View>

				</View>

				<View
					className="self-center bg-white"
					style={{
						width: planCardWidth,
						minHeight: 345 * compactScale,
						marginTop: 31 * compactScale,
						borderRadius: 42 * screenScale,
						paddingHorizontal: 20 * screenScale,
						paddingTop: 24 * compactScale,
						paddingBottom: 24 * compactScale,
						boxShadow: "0 16px 28px rgba(0, 0, 0, 0.10)",
					}}
				>
					<View className="flex-row items-start justify-between">
						<Text
							className="font-poppins font-semibold text-[#1A1A1A]"
							style={{
								fontSize: 24 * screenScale,
								lineHeight: 36 * screenScale,
								includeFontPadding: false,
							}}
						>
							Mein Plan
						</Text>
						<TouchableOpacity
							activeOpacity={0.9}
							accessibilityRole="button"
							accessibilityLabel="Neuen Eintrag erstellen"
							onPress={() => setShowCreateTypePicker(true)}
							className="items-center justify-center rounded-full bg-[#3B7CFF]"
							style={{
								width: 48 * screenScale,
								height: 48 * screenScale,
								marginTop: -4 * compactScale,
								marginRight: -4 * screenScale,
								boxShadow: "0 8px 18px rgba(58, 123, 255, 0.18)",
							}}
						>
							<Plus size={24 * screenScale} color="#FFFFFF" strokeWidth={1.7} />
						</TouchableOpacity>
					</View>

					<View style={{ marginTop: 24 * compactScale }}>
						<View className="flex-row items-center justify-between">
							{visibleDays.map((day, dayIndex) => (
								<TouchableOpacity
									key={day.key}
									activeOpacity={0.82}
									accessibilityRole="button"
									accessibilityState={{ selected: selectedDayKey === day.key }}
									accessibilityLabel={`${day.weekday}, ${day.dayOfMonth}`}
									onPress={() => selectVisibleDay(day.key, dayIndex)}
									className="items-center"
									style={{ width: (day.isToday ? 96 : 32) * scheduleScale }}
								>
									<Text
										className="font-poppins text-black"
										style={{
											fontSize: 12 * screenScale,
											lineHeight: 12 * screenScale,
											includeFontPadding: false,
										}}
									>
										{day.weekday}
									</Text>
								</TouchableOpacity>
							))}
						</View>
						<View
							className="flex-row items-center justify-between"
							style={{ marginTop: 10 * compactScale }}
						>
							{visibleDays.map((day, dayIndex) => {
								const selected = selectedDayKey === day.key;
								const content = (
									<Text
										key={`${day.key}-label`}
										className={`font-poppins ${selected ? "text-white" : "text-[#1A1A1A]"}`}
										style={{
											fontSize: 13 * screenScale,
											lineHeight: 16 * screenScale,
											includeFontPadding: true,
										}}
									>
										{day.isToday ? `Heute ${day.dayOfMonth}` : day.dayOfMonth}
									</Text>
								);
								const itemWidth = (day.isToday ? 96 : 32) * scheduleScale;
								return selected ? (
									<TouchableOpacity
										key={day.key}
										activeOpacity={0.82}
										onPress={() => selectVisibleDay(day.key, dayIndex)}
									>
										<LinearGradient
											colors={["#3A7BFF", "#59D6CF"]}
											start={{ x: 0, y: 0.5 }}
											end={{ x: 1, y: 0.5 }}
											style={{
												width: itemWidth,
												height: 32 * screenScale,
												borderRadius: 20,
												alignItems: "center",
												justifyContent: "center",
											}}
										>
											{content}
										</LinearGradient>
									</TouchableOpacity>
								) : (
									<TouchableOpacity
										key={day.key}
										activeOpacity={0.82}
										onPress={() => selectVisibleDay(day.key, dayIndex)}
										className="items-center justify-center rounded-full bg-[#F2F2F2]"
										style={{
											width: itemWidth,
											height: 34 * screenScale,
										}}
									>
										{content}
									</TouchableOpacity>
								);
							})}
						</View>
					</View>

					<View
						style={{
							marginTop: 18 * compactScale,
							height: timelineHeight,
							width: timelineViewportWidth,
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
								{visibleDays.map((day, dayIndex) => (
									<View
										key={`${day.key}-background`}
										className="absolute top-0 bottom-0"
										style={{
											left: dayIndex * dayWidth,
											width: dayWidth,
											borderLeftWidth: dayIndex === 0 ? 0 : 1,
											borderColor: "rgba(0,0,0,0.08)",
											backgroundColor:
												day.key === selectedDayKey
													? "rgba(58, 123, 255, 0.04)"
													: "transparent",
										}}
									>
										<Text
											className="absolute font-poppins font-semibold text-[#1A1A1A]"
											style={{
												left: 8 * scheduleScale,
												top: 0,
												fontSize: 12 * screenScale,
												lineHeight: 12 * screenScale,
												includeFontPadding: false,
											}}
										>
											{day.isToday
												? "Heute"
												: `${day.weekday} ${day.dayOfMonth}`}
										</Text>
									</View>
								))}

								{visibleDays.flatMap((day, dayIndex) =>
									TIMELINE_MARKER_HOURS.map((hour) => (
										<View
											key={`${day.key}-${hour}`}
											className="absolute"
											style={{
												left: dayIndex * dayWidth + hour * hourWidth,
												top: 18 * compactScale,
												bottom: 20 * compactScale,
												width: hour === 24 ? 0 : 1,
												backgroundColor:
													hour === 0 ? "rgba(0,0,0,0.12)" : "rgba(0,0,0,0.05)",
											}}
										>
											<Text
												className="absolute font-poppins text-black"
												style={{
													left: -20 * scheduleScale,
													bottom: -12 * compactScale,
													width: 40 * scheduleScale,
													fontSize: 12 * screenScale,
													lineHeight: 14 * screenScale,
													textAlign: "center",
													includeFontPadding: false,
												}}
											>
												{formatMinutes(hour * 60)}
											</Text>
										</View>
									)),
								)}

								{timelineEntries.map(({ day, dayIndex, entry, row }) => {
									const start = getEntryStartMinutes(entry);
									const duration = getEntryDurationMinutes(entry);
									const blockLeft =
										dayIndex * dayWidth + (start / 60) * hourWidth;
									const blockWidth = Math.max(
										(duration / 60) * hourWidth,
										72 * scheduleScale,
									);
									const isPast =
										day.key < getDayKey(today) ||
										(day.key === getDayKey(today) &&
											getEntryEndMinutes(entry) < currentMinute);

									return (
										<TouchableOpacity
											key={`${day.key}-${entry.id}`}
											activeOpacity={0.86}
											accessibilityRole="button"
											accessibilityLabel={`${getEntryDisplayTitle(entry)}, ${entry.time ?? ALL_DAY_TIME_LABEL}`}
											onPress={() => {
												setSelectedDayKey(day.key);
												openEntry(entry);
											}}
											className="absolute justify-center rounded-full"
											style={{
												top: timelineTopOffset + row * timelineRowHeight,
												left: blockLeft,
												width: Math.min(
													blockWidth,
													timelineContentWidth - blockLeft,
												),
												height: timelineBlockHeight,
												paddingHorizontal: 12 * scheduleScale,
												backgroundColor: isPast
													? "rgba(0,0,0,0.08)"
													: isLearningEntry(entry)
														? "#DDF4F3"
														: "#EAF3FF",
											}}
										>
											<Text
												className="font-poppins text-[#1A1A1A]"
												numberOfLines={1}
												style={{
													fontSize: 13 * screenScale,
													lineHeight: 16 * screenScale,
													includeFontPadding: false,
												}}
											>
												{getEntryDisplayTitle(entry)}
											</Text>
										</TouchableOpacity>
									);
								})}

								{todayIndex >= 0 ? (
									<View
										className="absolute items-center"
										style={{
											top: 9 * compactScale,
											left: currentTimelineX,
										}}
									>
										<View
											className="items-center justify-center rounded-full border border-[#3A7BFF] bg-white"
											style={{
												width: 14 * screenScale,
												height: 14 * screenScale,
											}}
										>
											<View
												className="rounded-full border border-white bg-[#3A7BFF]"
												style={{
													width: 10 * screenScale,
													height: 10 * screenScale,
												}}
											/>
										</View>
										<View
											className="bg-[#3A7BFF]"
											style={{
												width: 4 * screenScale,
												height: 112 * compactScale,
											}}
										/>
									</View>
								) : null}

								{timelineEntries.length === 0 ? (
									<View
										className="absolute items-center"
										style={{
											left: currentTimelineX - timelineViewportWidth / 2,
											top: 58 * compactScale,
											width: timelineViewportWidth,
										}}
									>
										<Text
											className="font-poppins text-[#787486]"
											style={{
												fontSize: 13 * screenScale,
												lineHeight: 18 * screenScale,
												includeFontPadding: false,
											}}
										>
											Keine Einträge in diesen 7 Tagen
										</Text>
									</View>
								) : null}

								<View
									className="absolute overflow-hidden"
									style={{
										top: 74 * compactScale,
										right: 8 * scheduleScale,
										width: 57 * scheduleScale,
										height: 37 * screenScale,
									}}
								>
									{HATCH_LINES.map((line, index) => (
										<View
											key={line}
											className="absolute bg-black/10"
											style={{
												width: 2 * screenScale,
												height: 49 * screenScale,
												left: index * 8 * scheduleScale,
												top: -9 * screenScale,
												transform: [{ rotate: "24deg" }],
											}}
										/>
									))}
								</View>
							</View>
						</ScrollView>
					</View>
				</View>
			</ScrollView>

			<Modal
				visible={showCreateTypePicker}
				transparent
				animationType="fade"
				onRequestClose={() => setShowCreateTypePicker(false)}
			>
				<View className="flex-1 justify-end">
					<Pressable
						className="absolute inset-0 bg-black/25"
						onPress={() => setShowCreateTypePicker(false)}
					/>
					<View
						className="bg-[#F4F8FB]"
						style={{
							width: modalWidth,
							borderTopLeftRadius: 40 * modalScale,
							borderTopRightRadius: 40 * modalScale,
							paddingTop: 24 * modalScale,
							paddingHorizontal: 24 * modalScale,
							paddingBottom: modalBottomPadding,
							boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
						}}
					>
						<View
							className="flex-row items-start justify-between gap-5"
							style={{ minHeight: 46 * modalScale }}
						>
							<View style={{ width: 311 * modalScale }}>
								<Text
									className="font-medium font-poppins text-black"
									style={{
										fontSize: 16 * modalScale,
										lineHeight: 24 * modalScale,
										includeFontPadding: false,
									}}
								>
									Was möchtest du planen?
								</Text>
								<Text
									className="font-poppins text-[#7E7E7E]"
									style={{
										fontSize: 12 * modalScale,
										lineHeight: 18 * modalScale,
										includeFontPadding: false,
									}}
								>
									Wähle zuerst die Art aus.
								</Text>
							</View>
							<TouchableOpacity
								accessibilityLabel="Auswahl schließen"
								accessibilityRole="button"
								hitSlop={8}
								activeOpacity={0.75}
								onPress={() => setShowCreateTypePicker(false)}
								className="items-center justify-center rounded-full bg-[#D9D9D9]"
								style={{
									width: 40 * modalScale,
									height: 40 * modalScale,
									boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
								}}
							>
								<X size={24 * modalScale} color="#1A1A1A" strokeWidth={2} />
							</TouchableOpacity>
						</View>

						<View
							className="items-center"
							style={{ marginTop: 12 * modalScale, rowGap: 24 * modalScale }}
						>
							<CreateTypeOption
								icon={ClipboardEdit}
								title="Neue Hausaufgabe"
								description="Fälligkeit, Fach und Lernzeit planen."
								scale={modalScale}
								width={modalOptionWidth}
								onPress={() => selectCreateType("homework")}
							/>
							<CreateTypeOption
								icon={GraduationCap}
								title="Neue Prüfung"
								description="Datum, Fach und Prüfungsart eintragen."
								scale={modalScale}
								width={modalOptionWidth}
								onPress={() => selectCreateType("exam")}
							/>
						</View>
					</View>
				</View>
			</Modal>
		</View>
	);
}
