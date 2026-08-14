import { useEffect, useMemo, useRef, useState } from "react";
import {
	type NativeScrollEvent,
	type NativeSyntheticEvent,
	Pressable,
	ScrollView,
	type TextStyle,
	View,
	type ViewStyle,
} from "react-native";
import { Button } from "~/components/ui/button";
import { CalendarDays, Clock3, Trash2 } from "~/components/ui/icon";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import {
	sortTimetableLessons,
	TIMETABLE_WEEKDAYS,
	type TimetableLessonDraft,
} from "~/features/timetable/timetable-editor";
import { useDayovaTheme } from "~/lib/theme";
import { cn } from "~/lib/utils";

// These are native rendering controls with no NativeWind equivalent.
const continuousBorderStyle = {
	borderCurve: "continuous",
} satisfies ViewStyle;
const tabularNumberStyle = {
	fontVariant: ["tabular-nums"],
} satisfies TextStyle;

type TimetableWeekEditorProps = {
	lessons: TimetableLessonDraft[];
	selectedDay: number;
	isAddDisabled: boolean;
	onSelectedDayChange: (dayOfWeek: number) => void;
	onAddLesson: (dayOfWeek: number) => void;
	onChangeLesson: (
		lessonKey: string,
		patch: Partial<TimetableLessonDraft>,
	) => void;
	onRemoveLesson: (lessonKey: string) => void;
	onOpenTime: (lessonKey: string, field: "startTime" | "endTime") => void;
	onOpenDayPicker: (lessonKey: string) => void;
};

function TimeButton({
	label,
	value,
	onPress,
}: {
	label: string;
	value: string;
	onPress: () => void;
}) {
	const { colors } = useDayovaTheme();

	return (
		<View className="flex-1">
			<Text className="mb-1 font-poppins text-body-5 text-secondary-text">
				{label}
			</Text>
			<Pressable
				accessibilityLabel={`${label}: ${value}`}
				accessibilityRole="button"
				className="h-12 flex-row items-center justify-between rounded-2xl bg-muted px-4 active:opacity-75"
				onPress={onPress}
			>
				<Text
					className="font-poppins font-semibold text-body-3 text-text"
					style={tabularNumberStyle}
				>
					{value}
				</Text>
				<Clock3 size={17} color={colors.secondaryText} strokeWidth={2} />
			</Pressable>
		</View>
	);
}

function LessonEditorCard({
	lesson,
	position,
	onChange,
	onRemove,
	onOpenTime,
	onOpenDayPicker,
}: {
	lesson: TimetableLessonDraft;
	position: number;
	onChange: (patch: Partial<TimetableLessonDraft>) => void;
	onRemove: () => void;
	onOpenTime: (field: "startTime" | "endTime") => void;
	onOpenDayPicker: () => void;
}) {
	const { colors } = useDayovaTheme();
	const weekday =
		TIMETABLE_WEEKDAYS.find((day) => day.value === lesson.dayOfWeek) ??
		TIMETABLE_WEEKDAYS[0];
	const lessonLabel = lesson.subject.trim() || "Leere Stunde";

	return (
		<View
			className="rounded-card border border-border bg-card p-5"
			style={continuousBorderStyle}
		>
			<View className="flex-row items-center justify-between gap-3">
				<Text className="flex-1 font-poppins font-semibold text-body-3 text-text">
					{position}. Stunde
				</Text>
				<View className="flex-row gap-2">
					<Pressable
						accessibilityLabel={`Wochentag für ${lessonLabel} ändern. Aktuell ${weekday.label}`}
						accessibilityRole="button"
						hitSlop={4}
						className="h-11 flex-row items-center gap-2 rounded-full bg-muted px-3 active:opacity-75"
						onPress={onOpenDayPicker}
					>
						<CalendarDays
							size={17}
							color={colors.secondaryText}
							strokeWidth={2}
						/>
						<Text className="font-poppins font-semibold text-body-4 text-secondary-text">
							{weekday.shortLabel}
						</Text>
					</Pressable>
					<Pressable
						accessibilityLabel={`${lessonLabel} entfernen`}
						accessibilityRole="button"
						hitSlop={4}
						className="h-11 w-11 items-center justify-center rounded-full bg-muted active:opacity-75"
						onPress={onRemove}
					>
						<Trash2 size={18} color={colors.wrong} strokeWidth={2} />
					</Pressable>
				</View>
			</View>

			<View className="mt-4 h-14 justify-center rounded-2xl bg-muted px-4">
				<Input
					accessibilityLabel="Unterrichtsfach"
					autoCapitalize="words"
					maxLength={80}
					placeholder="Fach, z. B. Mathematik"
					value={lesson.subject}
					onChangeText={(subject) => onChange({ subject })}
				/>
			</View>
			<View className="mt-3 h-14 justify-center rounded-2xl bg-muted px-4">
				<Input
					accessibilityLabel="Raum, optional"
					autoCapitalize="characters"
					maxLength={40}
					placeholder="Raum (optional)"
					value={lesson.room}
					onChangeText={(room) => onChange({ room })}
				/>
			</View>
			<View className="mt-4 flex-row gap-3">
				<TimeButton
					label="Beginn"
					value={lesson.startTime}
					onPress={() => onOpenTime("startTime")}
				/>
				<TimeButton
					label="Ende"
					value={lesson.endTime}
					onPress={() => onOpenTime("endTime")}
				/>
			</View>
		</View>
	);
}

function TimetableWeekEditor({
	lessons,
	selectedDay,
	isAddDisabled,
	onSelectedDayChange,
	onAddLesson,
	onChangeLesson,
	onRemoveLesson,
	onOpenTime,
	onOpenDayPicker,
}: TimetableWeekEditorProps) {
	const lessonPagerRef = useRef<ScrollView>(null);
	const shouldAnimateLessonScrollRef = useRef(false);
	const [lessonPagerWidth, setLessonPagerWidth] = useState(0);
	const [lessonIndexByDay, setLessonIndexByDay] = useState<
		Record<number, number>
	>({});
	const lessonsByDay = useMemo(
		() =>
			TIMETABLE_WEEKDAYS.map((day) => ({
				...day,
				lessons: sortTimetableLessons(
					lessons.filter((lesson) => lesson.dayOfWeek === day.value),
				),
			})),
		[lessons],
	);
	const selectedDayIndex = Math.max(
		0,
		TIMETABLE_WEEKDAYS.findIndex((day) => day.value === selectedDay),
	);
	const selectedDayData = lessonsByDay[selectedDayIndex] ?? lessonsByDay[0];
	const selectedDayLessons = selectedDayData?.lessons ?? [];
	const selectedLessonIndex = Math.max(
		0,
		Math.min(
			lessonIndexByDay[selectedDay] ?? 0,
			Math.max(0, selectedDayLessons.length - 1),
		),
	);

	useEffect(() => {
		if (lessonPagerWidth <= 0) return;
		lessonPagerRef.current?.scrollTo({
			x: selectedLessonIndex * lessonPagerWidth,
			animated: shouldAnimateLessonScrollRef.current,
		});
		shouldAnimateLessonScrollRef.current = false;
	}, [lessonPagerWidth, selectedLessonIndex]);

	const handleLessonPageChange = (
		event: NativeSyntheticEvent<NativeScrollEvent>,
	) => {
		if (lessonPagerWidth <= 0) return;
		const nextIndex = Math.max(
			0,
			Math.min(
				Math.max(0, selectedDayLessons.length - 1),
				Math.round(event.nativeEvent.contentOffset.x / lessonPagerWidth),
			),
		);
		setLessonIndexByDay((current) => ({
			...current,
			[selectedDay]: nextIndex,
		}));
	};

	const handleAddLesson = () => {
		shouldAnimateLessonScrollRef.current = true;
		setLessonIndexByDay((current) => ({
			...current,
			[selectedDay]: selectedDayLessons.length,
		}));
		onAddLesson(selectedDay);
	};

	return (
		<View className="gap-4">
			<View
				accessibilityLabel="Wochentag auswählen"
				className="flex-row justify-between gap-1"
			>
				{lessonsByDay.map((day) => {
					const selected = day.value === selectedDay;
					const lessonCount = day.lessons.length;

					return (
						<Pressable
							key={day.value}
							accessible
							accessibilityLabel={`${day.label}, ${lessonCount} ${lessonCount === 1 ? "Stunde" : "Stunden"}`}
							accessibilityRole="button"
							accessibilityState={{ selected }}
							className={cn(
								"h-11 min-w-11 items-center justify-center rounded-full active:opacity-75",
								selected ? "bg-primary" : "bg-muted",
							)}
							onPress={() => onSelectedDayChange(day.value)}
						>
							<Text
								className={cn(
									"font-poppins font-semibold text-body-4",
									selected ? "text-white" : "text-secondary-text",
								)}
							>
								{day.shortLabel}
							</Text>
						</Pressable>
					);
				})}
			</View>

			<Text className="font-poppins text-body-4 text-secondary-text">
				Wische nach links oder rechts, um die Stunden zu prüfen.
			</Text>

			<View className="flex-row items-baseline justify-between gap-4">
				<Text className="font-poppins font-semibold text-heading-2 text-text">
					{selectedDayData?.label}
				</Text>
				<Text
					accessibilityLiveRegion="polite"
					className="font-poppins text-body-4 text-secondary-text"
				>
					{selectedDayLessons.length === 0
						? "0 Stunden"
						: `${selectedLessonIndex + 1} / ${selectedDayLessons.length}`}
				</Text>
			</View>

			{selectedDayLessons.length === 0 ? (
				<View className="rounded-card border border-border bg-card px-5 py-6">
					<Text className="font-poppins font-semibold text-body-3 text-text">
						Noch keine Stunden
					</Text>
					<Text className="mt-2 font-poppins text-body-4 text-secondary-text">
						Für {selectedDayData?.label} ist noch kein Unterricht eingetragen.
					</Text>
				</View>
			) : (
				<View
					testID="timetable-lesson-pager-frame"
					className="overflow-hidden"
					onLayout={(event) =>
						setLessonPagerWidth(event.nativeEvent.layout.width)
					}
				>
					<ScrollView
						ref={lessonPagerRef}
						testID="timetable-lesson-pager"
						horizontal
						pagingEnabled
						accessibilityLabel={`Stunden für ${selectedDayData?.label}`}
						accessibilityHint="Wische nach links oder rechts, um zwischen den Stunden zu wechseln."
						onMomentumScrollEnd={handleLessonPageChange}
						scrollEventThrottle={16}
						showsHorizontalScrollIndicator={false}
					>
						{selectedDayLessons.map((lesson, index) => (
							<View
								key={lesson.key}
								accessibilityElementsHidden={index !== selectedLessonIndex}
								importantForAccessibility={
									index === selectedLessonIndex ? "yes" : "no-hide-descendants"
								}
								className="pr-1"
								// Horizontal paging requires each page to match the measured viewport.
								style={{ width: lessonPagerWidth }}
							>
								<LessonEditorCard
									lesson={lesson}
									position={index + 1}
									onChange={(patch) => onChangeLesson(lesson.key, patch)}
									onRemove={() => onRemoveLesson(lesson.key)}
									onOpenTime={(field) => onOpenTime(lesson.key, field)}
									onOpenDayPicker={() => onOpenDayPicker(lesson.key)}
								/>
							</View>
						))}
					</ScrollView>
				</View>
			)}

			<Button
				accessibilityLabel={`Unterrichtsstunde für ${selectedDayData?.label} hinzufügen`}
				disabled={isAddDisabled}
				size="sm"
				variant="outline"
				onPress={handleAddLesson}
			>
				<Text>Stunde für {selectedDayData?.label} hinzufügen</Text>
			</Button>
		</View>
	);
}

export type { TimetableWeekEditorProps };
export { TimetableWeekEditor };
