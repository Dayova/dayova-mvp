import { api } from "#convex/_generated/api";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	Platform,
	Pressable,
	View,
} from "react-native";
import { ScreenHeader as Header } from "~/components/screen-header";
import { Button } from "~/components/ui/button";
import {
	DateTimePickerSheet,
	type DateTimePickerEvent,
} from "~/components/ui/date-time-picker-sheet";
import {
	Field,
	FieldAccessory,
	FieldLabel,
	FieldTrigger,
} from "~/components/ui/field";
import { CalendarDays, ChevronDown, Timer, Trash2 } from "~/components/ui/icon";
import { Screen, ScreenScroll } from "~/components/ui/screen";
import { SelectSheet } from "~/components/ui/select-sheet";
import { Text } from "~/components/ui/text";
import { useAuth } from "~/context/AuthContext";
import { getUserFacingErrorMessage } from "~/lib/user-facing-errors";

const LEARNING_DAYS = [
	{ label: "Montag", value: 1 },
	{ label: "Dienstag", value: 2 },
	{ label: "Mittwoch", value: 3 },
	{ label: "Donnerstag", value: 4 },
	{ label: "Freitag", value: 5 },
	{ label: "Samstag", value: 6 },
	{ label: "Sonntag", value: 7 },
] as const;

type LearningDayLabel = (typeof LEARNING_DAYS)[number]["label"];
type TimeField = "start" | "end";

const DEFAULT_START_TIME = "17:00";
const DEFAULT_END_TIME = "17:30";

const formatTime = (date: Date) =>
	`${date.getHours().toString().padStart(2, "0")}:${date
		.getMinutes()
		.toString()
		.padStart(2, "0")}`;

const dateForTime = (time: string) => {
	const [hours, minutes] = time.split(":").map(Number);
	const date = new Date();
	date.setHours(hours || 0, minutes || 0, 0, 0);
	return date;
};

const parseTimeToMinutes = (time: string) => {
	const [hours, minutes] = time.split(":").map(Number);
	return (hours || 0) * 60 + (minutes || 0);
};

function TimeControl({
	label,
	value,
	onPress,
}: {
	label: string;
	value: string;
	onPress: () => void;
}) {
	return (
		<Pressable
			accessibilityLabel={`${label}: ${value}`}
			accessibilityRole="button"
			onPress={onPress}
			className="h-[54px] flex-1 flex-row items-center justify-between rounded-[27px] bg-white px-5 shadow-black/10 shadow-sm active:opacity-80"
		>
			<Text
				className="font-poppins text-[#7D8089]"
				style={{ fontSize: 14, lineHeight: 19, includeFontPadding: false }}
			>
				{value}
			</Text>
			<Timer size={19} color="#9A9DA5" strokeWidth={1.9} />
		</Pressable>
	);
}

export default function LearningTimesScreen() {
	const router = useRouter();
	const params = useLocalSearchParams<{ day?: string }>();
	const { user } = useAuth();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const learningTimes = useQuery(
		api.learningTimes.listMine,
		user && isConvexAuthenticated ? {} : "skip",
	);
	const saveLearningTime = useMutation(api.learningTimes.upsertMine);
	const removeLearningTime = useMutation(api.learningTimes.removeMine);

	const initialDay =
		LEARNING_DAYS.find((day) => String(day.value) === params.day)?.label ??
		"Montag";
	const [selectedDay, setSelectedDay] = useState<LearningDayLabel>(initialDay);
	const [startTime, setStartTime] = useState(DEFAULT_START_TIME);
	const [endTime, setEndTime] = useState(DEFAULT_END_TIME);
	const [daySheetVisible, setDaySheetVisible] = useState(false);
	const [activeTimeField, setActiveTimeField] = useState<TimeField | null>(
		null,
	);
	const [isSaving, setIsSaving] = useState(false);
	const [feedback, setFeedback] = useState<string | null>(null);

	const selectedDayValue =
		LEARNING_DAYS.find((day) => day.label === selectedDay)?.value ?? 1;
	const selectedEntry = useMemo(
		() => learningTimes?.find((entry) => entry.dayOfWeek === selectedDayValue),
		[learningTimes, selectedDayValue],
	);

	const currentEntryKey = selectedEntry
		? `${selectedEntry.dayOfWeek}:${selectedEntry.startTime}:${selectedEntry.endTime}`
		: `${selectedDayValue}:empty`;
	const [appliedEntryKey, setAppliedEntryKey] = useState(currentEntryKey);

	if (appliedEntryKey !== currentEntryKey) {
		setAppliedEntryKey(currentEntryKey);
		setStartTime(selectedEntry?.startTime ?? DEFAULT_START_TIME);
		setEndTime(selectedEntry?.endTime ?? DEFAULT_END_TIME);
		setFeedback(null);
	}

	const hasChanges =
		!selectedEntry ||
		startTime !== (selectedEntry?.startTime ?? DEFAULT_START_TIME) ||
		endTime !== (selectedEntry?.endTime ?? DEFAULT_END_TIME);
	const canRemove = Boolean(selectedEntry) && !isSaving;
	const canSave =
		hasChanges &&
		parseTimeToMinutes(endTime) > parseTimeToMinutes(startTime) &&
		!isSaving &&
		Boolean(user) &&
		isConvexAuthenticated;

	const goBack = () => {
		if (router.canGoBack()) {
			router.back();
			return;
		}

		router.replace("/learning-times");
	};

	const updateTime = (event: DateTimePickerEvent, selectedDate?: Date) => {
		if (event.type !== "set" || !selectedDate || !activeTimeField) return;

		const nextTime = formatTime(selectedDate);
		if (activeTimeField === "start") {
			setStartTime(nextTime);
		} else {
			setEndTime(nextTime);
		}
		setFeedback(null);
		if (Platform.OS === "android") setActiveTimeField(null);
	};

	const save = async () => {
		if (parseTimeToMinutes(endTime) <= parseTimeToMinutes(startTime)) {
			Alert.alert(
				"Uhrzeit prüfen",
				"Die Endzeit muss nach der Startzeit liegen.",
			);
			return;
		}

		setIsSaving(true);
		setFeedback(null);
		try {
			await saveLearningTime({
				dayOfWeek: selectedDayValue,
				startTime,
				endTime,
			});
			router.replace("/learning-times");
		} catch (error) {
			Alert.alert(
				"Lernzeit konnte nicht gespeichert werden",
				getUserFacingErrorMessage(error, "Bitte versuche es erneut.", {
					source: "learning-times.save",
				}),
			);
		} finally {
			setIsSaving(false);
		}
	};

	const remove = async () => {
		setIsSaving(true);
		setFeedback(null);
		try {
			await removeLearningTime({ dayOfWeek: selectedDayValue });
			setStartTime(DEFAULT_START_TIME);
			setEndTime(DEFAULT_END_TIME);
			setFeedback("Lernzeit entfernt.");
			router.replace("/learning-times");
		} catch (error) {
			Alert.alert(
				"Lernzeit konnte nicht entfernt werden",
				getUserFacingErrorMessage(error, "Bitte versuche es erneut.", {
					source: "learning-times.remove",
				}),
			);
		} finally {
			setIsSaving(false);
		}
	};

	const renderDaySelectSheet = () => {
		if (!daySheetVisible) return null;

		return (
			<SelectSheet
				visible
				title="Lerntag auswählen"
				options={LEARNING_DAYS.map((day) => day.label)}
				selectedValue={selectedDay}
				onSelect={setSelectedDay}
				onClose={() => setDaySheetVisible(false)}
				renderOptionIcon={(_option, isSelected) => (
					<CalendarDays
						size={19}
						color={isSelected ? "#3A7BFF" : "#6B7280"}
						strokeWidth={2}
					/>
				)}
			/>
		);
	};

	return (
		<Screen>
			<StatusBar style="dark" />
			<ScreenScroll topPadding={80} bottomPadding={120} horizontalPadding={24}>
				<Header title="Lernzeiten" onBack={goBack} />

				<View style={{ marginTop: 18, rowGap: 22 }}>
					<View style={{ rowGap: 7 }}>
						<Text
							className="font-poppins font-semibold text-[#202127]"
							style={{
								fontSize: 16,
								lineHeight: 22,
								includeFontPadding: false,
							}}
						>
							Lernzeit bearbeiten
						</Text>
						<Text
							className="font-poppins text-[#979AA3]"
							style={{
								fontSize: 14,
								lineHeight: 20,
								includeFontPadding: false,
							}}
						>
							Hier kannst du individuell deine Lernzeiten anpassen, so wie es
							passt.
						</Text>
					</View>

					<View>
						<Field className="mb-5">
							<FieldLabel>Lernzeit</FieldLabel>
							<FieldTrigger
								accessibilityLabel={`Lerntag ${selectedDay}`}
								accessibilityRole="button"
								className="min-h-[64px] rounded-[28px] px-5"
								onPress={() => setDaySheetVisible(true)}
								style={{
									boxShadow: "0 1px 4px rgba(0, 0, 0, 0.08)",
								}}
							>
								<Text
									className="flex-1 font-medium font-poppins text-[#202127]"
									style={{
										fontSize: 18,
										lineHeight: 24,
										includeFontPadding: false,
									}}
								>
									Lerntag
								</Text>
								<Text
									className="font-poppins text-[#8C8F98]"
									style={{
										fontSize: 18,
										lineHeight: 24,
										includeFontPadding: false,
									}}
								>
									{selectedDay}
								</Text>
								<FieldAccessory>
									<ChevronDown size={20} color="#202127" strokeWidth={2.1} />
								</FieldAccessory>
							</FieldTrigger>
						</Field>

						<View className="flex-row" style={{ gap: 8 }}>
							<TimeControl
								label="Startzeit"
								value={startTime}
								onPress={() => setActiveTimeField("start")}
							/>
							<TimeControl
								label="Endzeit"
								value={endTime}
								onPress={() => setActiveTimeField("end")}
							/>
						</View>
					</View>

					{learningTimes === undefined ? (
						<View className="items-center py-4">
							<ActivityIndicator color="#3A7BFF" />
						</View>
					) : null}

					{feedback ? (
						<Text
							className="font-poppins text-[#3A7BFF]"
							style={{
								fontSize: 13,
								lineHeight: 19,
								includeFontPadding: false,
							}}
						>
							{feedback}
						</Text>
					) : null}
				</View>
			</ScreenScroll>

			<View
				pointerEvents="box-none"
				className="absolute right-0 bottom-5 left-0 flex-row px-6 pb-16"
				style={{ gap: 10 }}
			>
				<Button
					variant="neutral"
					className="flex-1"
					disabled={!canRemove}
					onPress={remove}
				>
					<Trash2 size={18} color="#202127" strokeWidth={2} />
					<Text>Entfernen</Text>
				</Button>
				<Button className="flex-1" disabled={!canSave} onPress={save}>
					<Text>{isSaving ? "Speichern..." : "Speichern"}</Text>
				</Button>
			</View>

			{renderDaySelectSheet()}

			<DateTimePickerSheet
				visible={Boolean(activeTimeField)}
				value={dateForTime(activeTimeField === "end" ? endTime : startTime)}
				mode="time"
				display="spinner"
				onChange={updateTime}
				onClose={() => setActiveTimeField(null)}
			/>
		</Screen>
	);
}
