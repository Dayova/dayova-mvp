import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	Platform,
	Pressable,
	View,
} from "react-native";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { ScreenHeader as Header } from "~/components/screen-header";
import { Button } from "~/components/ui/button";
import {
	type DateTimePickerEvent,
	DateTimePickerSheet,
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
import { ThemedStatusBar } from "~/components/ui/themed-status-bar";
import { useAuth } from "~/context/AuthContext";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { dismissToOrReplace } from "~/lib/navigation";
import { getSafeReturnTo, ROUTES, withReturnTo } from "~/lib/routes";
import { useDayovaTheme } from "~/lib/theme";
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
type LearningTimeDraft = {
	baseKey: string;
	selectedDay?: LearningDayLabel;
	startTime?: string;
	endTime?: string;
};

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
			className="h-[54px] flex-1 flex-row items-center justify-between rounded-[27px] bg-card px-5 shadow-black/10 shadow-sm active:opacity-80"
		>
			<Text className="font-poppins text-body-3 text-secondary-text">
				{value}
			</Text>
			<Timer size={19} color="#697586" strokeWidth={1.9} />
		</Pressable>
	);
}

export default function LearningTimesScreen() {
	const router = useRouter();
	const params = useLocalSearchParams<{
		day?: string;
		id?: string;
		returnTo?: string;
	}>();
	const { user } = useAuth();
	const { colors } = useDayovaTheme();
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
	const [draft, setDraft] = useState<LearningTimeDraft>({ baseKey: "" });
	const [daySheetVisible, setDaySheetVisible] = useState(false);
	const [activeTimeField, setActiveTimeField] = useState<TimeField | null>(
		null,
	);
	const [isSaving, setIsSaving] = useState(false);
	const [feedback, setFeedback] = useState<string | null>(null);
	const returnTo = getSafeReturnTo(params.returnTo);
	const overviewPath = withReturnTo(ROUTES.learningTimes, returnTo);
	const learningTimeId = params.id as Id<"userLearningTimes"> | undefined;
	const isEditingExisting = Boolean(learningTimeId);

	const selectedEntry = useMemo(
		() => learningTimes?.find((entry) => entry.id === learningTimeId),
		[learningTimeId, learningTimes],
	);
	const selectedEntryKey = selectedEntry
		? `${selectedEntry.id}:${selectedEntry.dayOfWeek}:${selectedEntry.startTime}:${selectedEntry.endTime}`
		: null;
	const formBaseKey =
		selectedEntryKey ??
		(learningTimeId ? `missing:${learningTimeId}` : `new:${params.day ?? ""}`);
	const currentDraft = draft.baseKey === formBaseKey ? draft : null;
	const selectedEntryDay =
		selectedEntry &&
		(LEARNING_DAYS.find((day) => day.value === selectedEntry.dayOfWeek)
			?.label ??
			"Montag");
	const selectedDay =
		currentDraft?.selectedDay ?? selectedEntryDay ?? initialDay;
	const selectedDayValue =
		LEARNING_DAYS.find((day) => day.label === selectedDay)?.value ?? 1;
	const startTime =
		currentDraft?.startTime ?? selectedEntry?.startTime ?? DEFAULT_START_TIME;
	const endTime =
		currentDraft?.endTime ?? selectedEntry?.endTime ?? DEFAULT_END_TIME;

	const updateDraft = (patch: Omit<Partial<LearningTimeDraft>, "baseKey">) => {
		setDraft((current) => ({
			...(current.baseKey === formBaseKey ? current : {}),
			...patch,
			baseKey: formBaseKey,
		}));
		setFeedback(null);
	};

	const hasChanges =
		!isEditingExisting ||
		selectedDayValue !== selectedEntry?.dayOfWeek ||
		startTime !== (selectedEntry?.startTime ?? DEFAULT_START_TIME) ||
		endTime !== (selectedEntry?.endTime ?? DEFAULT_END_TIME);
	const canRemove = Boolean(selectedEntry) && !isSaving;
	const canSave =
		hasChanges &&
		parseTimeToMinutes(endTime) > parseTimeToMinutes(startTime) &&
		!isSaving &&
		Boolean(user) &&
		isConvexAuthenticated &&
		(!isEditingExisting || Boolean(selectedEntry));

	const goBack = () => {
		if (router.canGoBack()) {
			router.back();
			return;
		}

		router.replace(overviewPath);
	};

	const closeToOverview = () => {
		dismissToOrReplace(router, overviewPath);
	};

	const updateTime = (event: DateTimePickerEvent, selectedDate?: Date) => {
		if (event.type !== "set" || !selectedDate || !activeTimeField) return;

		const nextTime = formatTime(selectedDate);
		if (activeTimeField === "start") {
			updateDraft({ startTime: nextTime });
		} else {
			updateDraft({ endTime: nextTime });
		}
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
				id: selectedEntry?.id,
				dayOfWeek: selectedDayValue,
				startTime,
				endTime,
			});
			closeToOverview();
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
		if (!selectedEntry) return;

		setIsSaving(true);
		setFeedback(null);
		try {
			await removeLearningTime({ id: selectedEntry.id });
			setFeedback("Lernzeit entfernt.");
			closeToOverview();
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
				onSelect={(nextDay) =>
					updateDraft({ selectedDay: nextDay as LearningDayLabel })
				}
				onClose={() => setDaySheetVisible(false)}
				renderOptionIcon={(_option, isSelected) => (
					<CalendarDays
						size={19}
						color={isSelected ? "#00BAFF" : "#697586"}
						strokeWidth={2}
					/>
				)}
			/>
		);
	};

	return (
		<Screen>
			<ThemedStatusBar />
			<ScreenScroll topPadding={80} bottomPadding={120} horizontalPadding={24}>
				<Header title="Lernzeiten" onBack={goBack} />

				<View style={{ marginTop: 18, rowGap: 22 }}>
					<View className="gap-2">
						<Text className="font-poppins font-semibold text-body-2 text-text">
							Lernzeit bearbeiten
						</Text>
						<Text className="font-poppins text-body-3 text-secondary-text">
							Passe deine Lernzeiten so an, wie sie für dich passen.
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
								<Text className="flex-1 font-poppins font-semibold text-body-1 text-text">
									Lerntag
								</Text>
								<Text className="font-poppins text-body-1 text-secondary-text">
									{selectedDay}
								</Text>
								<FieldAccessory>
									<ChevronDown
										size={20}
										color={colors.text}
										strokeWidth={2.1}
									/>
								</FieldAccessory>
							</FieldTrigger>
						</Field>

						<View className="flex-row gap-2">
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
							<ActivityIndicator color={DAYOVA_DESIGN_SYSTEM.colors.primary} />
						</View>
					) : null}

					{feedback ? (
						<Text className="font-poppins text-body-4 text-primary">
							{feedback}
						</Text>
					) : null}
				</View>
			</ScreenScroll>

			<View
				pointerEvents="box-none"
				className="absolute right-0 bottom-5 left-0 flex-row gap-3 px-6 pb-16"
			>
				<Button
					variant="neutral"
					className="flex-1"
					disabled={!canRemove}
					onPress={remove}
				>
					<Trash2
						size={18}
						color={DAYOVA_DESIGN_SYSTEM.colors.light1}
						strokeWidth={2}
					/>
					<Text>Entfernen</Text>
				</Button>
				<Button className="flex-1" disabled={!canSave} onPress={save}>
					<Text>{isSaving ? "Speichert..." : "Speichern"}</Text>
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
