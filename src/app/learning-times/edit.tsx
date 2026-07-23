import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	Platform,
	Pressable,
	ScrollView,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { Button } from "~/components/ui/button";
import {
	type DateTimePickerEvent,
	DateTimePickerSheet,
} from "~/components/ui/date-time-picker-sheet";
import { Field, FieldLabel } from "~/components/ui/field";
import { Timer, Trash2, X } from "~/components/ui/icon";
import { Screen } from "~/components/ui/screen";
import { Text } from "~/components/ui/text";
import { ThemedStatusBar } from "~/components/ui/themed-status-bar";
import { useAuth } from "~/context/AuthContext";
import {
	LEARNING_DAYS,
	type LearningDayLabel,
} from "~/features/learning-times/learning-time-days";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { dismissToOrReplace } from "~/lib/navigation";
import { getSafeReturnTo, ROUTES, withReturnTo } from "~/lib/routes";
import { useDayovaTheme } from "~/lib/theme";
import { getUserFacingErrorMessage } from "~/lib/user-facing-errors";

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
	const { colors } = useDayovaTheme();

	return (
		<View className="flex-1 gap-2">
			<Text className="font-poppins text-body-4 text-secondary-text">
				{label}
			</Text>
			<Pressable
				accessibilityLabel={`${label}: ${value}`}
				accessibilityRole="button"
				className="min-h-16 flex-row items-center justify-between rounded-[28px] bg-card px-5 shadow-black/10 shadow-sm active:opacity-80"
				onPress={onPress}
				style={{ borderCurve: "continuous" }}
			>
				<Text
					selectable
					className="font-poppins font-semibold text-body-2 text-text"
					style={{ fontVariant: ["tabular-nums"] }}
				>
					{value}
				</Text>
				<Timer size={19} color={colors.secondaryText} strokeWidth={1.9} />
			</Pressable>
		</View>
	);
}

export default function LearningTimesScreen() {
	const router = useRouter();
	const params = useLocalSearchParams<{
		day?: string;
		id?: string;
		returnTo?: string;
	}>();
	const insets = useSafeAreaInsets();
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
	const [activeTimeField, setActiveTimeField] = useState<TimeField | null>(
		null,
	);
	const [isSaving, setIsSaving] = useState(false);
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
	};

	const hasValidTimeRange =
		parseTimeToMinutes(endTime) > parseTimeToMinutes(startTime);
	const hasChanges =
		!isEditingExisting ||
		selectedDayValue !== selectedEntry?.dayOfWeek ||
		startTime !== (selectedEntry?.startTime ?? DEFAULT_START_TIME) ||
		endTime !== (selectedEntry?.endTime ?? DEFAULT_END_TIME);
	const canRemove = Boolean(selectedEntry) && !isSaving;
	const canSave =
		hasChanges &&
		hasValidTimeRange &&
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
		if (!hasValidTimeRange) {
			Alert.alert(
				"Uhrzeit prüfen",
				"Die Endzeit muss nach der Startzeit liegen.",
			);
			return;
		}

		setIsSaving(true);
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
		try {
			await removeLearningTime({ id: selectedEntry.id });
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

	const requestRemove = () => {
		if (!canRemove) return;

		Alert.alert(
			"Lernzeit entfernen?",
			`${selectedDay}, ${startTime}–${endTime} wird dauerhaft entfernt.`,
			[
				{ text: "Abbrechen", style: "cancel" },
				{
					text: "Entfernen",
					style: "destructive",
					onPress: () => {
						void remove();
					},
				},
			],
		);
	};

	return (
		<Screen>
			<ThemedStatusBar />
			<View
				className="min-h-16 flex-row items-center justify-between px-6 pb-2"
				style={{ paddingTop: insets.top + 12 }}
			>
				<Text
					accessibilityRole="header"
					className="font-poppins font-semibold text-body-1 text-text"
				>
					{isEditingExisting ? "Lernzeit bearbeiten" : "Neue Lernzeit"}
				</Text>
				<Pressable
					accessibilityLabel="Lernzeit schließen"
					accessibilityRole="button"
					hitSlop={8}
					className="h-10 w-10 items-center justify-center rounded-full bg-muted active:opacity-75"
					onPress={goBack}
				>
					<X size={18} color={colors.text} strokeWidth={2.2} />
				</Pressable>
			</View>

			<ScrollView
				automaticallyAdjustContentInsets={false}
				className="flex-1 bg-background"
				contentContainerStyle={{
					gap: 24,
					paddingHorizontal: 24,
					paddingTop: 12,
					paddingBottom: 28,
				}}
				contentInsetAdjustmentBehavior="never"
				showsVerticalScrollIndicator={false}
			>
				<Text
					selectable
					className="font-poppins text-body-3 text-secondary-text"
				>
					Wähle den Wochentag und das Zeitfenster, in dem du regelmäßig lernen
					kannst.
				</Text>

				<Field className="mb-0">
					<View className="mb-2 flex-row items-center justify-between">
						<FieldLabel className="mb-0">Wochentag</FieldLabel>
						<Text
							selectable
							className="font-poppins font-semibold text-body-4 text-secondary-text"
						>
							{selectedDay}
						</Text>
					</View>
					<View className="flex-row gap-1.5">
						{LEARNING_DAYS.map((day) => {
							const isSelected = day.value === selectedDayValue;

							return (
								<Pressable
									key={day.value}
									accessibilityLabel={day.label}
									accessibilityRole="radio"
									accessibilityState={{ checked: isSelected }}
									className="h-12 flex-1 items-center justify-center rounded-full active:opacity-80"
									onPress={() => updateDraft({ selectedDay: day.label })}
									style={{
										backgroundColor: isSelected
											? colors.primary
											: colors.surface,
										borderCurve: "continuous",
									}}
								>
									<Text
										className="font-poppins font-semibold text-body-4"
										style={{ color: isSelected ? colors.light1 : colors.text }}
									>
										{day.abbreviation}
									</Text>
								</Pressable>
							);
						})}
					</View>
				</Field>

				<View className="flex-row gap-3">
					<TimeControl
						label="Beginn"
						value={startTime}
						onPress={() => setActiveTimeField("start")}
					/>
					<TimeControl
						label="Ende"
						value={endTime}
						onPress={() => setActiveTimeField("end")}
					/>
				</View>

				{hasValidTimeRange ? null : (
					<Text
						selectable
						className="font-poppins text-body-4 text-destructive"
					>
						Die Endzeit muss nach der Startzeit liegen.
					</Text>
				)}

				{learningTimes === undefined ? (
					<View className="items-center py-4">
						<ActivityIndicator color={DAYOVA_DESIGN_SYSTEM.colors.primary} />
					</View>
				) : null}

				{isEditingExisting ? (
					<Pressable
						accessibilityLabel="Lernzeit entfernen"
						accessibilityRole="button"
						className="min-h-12 flex-row items-center justify-center gap-2 rounded-[24px] active:bg-destructive/10 disabled:opacity-50"
						disabled={!canRemove}
						onPress={requestRemove}
					>
						<Trash2 size={18} color={colors.destructive} strokeWidth={2} />
						<Text className="font-poppins font-semibold text-body-3 text-destructive">
							Lernzeit entfernen
						</Text>
					</Pressable>
				) : null}
			</ScrollView>

			<View
				className="border-border border-t bg-background px-6 pt-4"
				style={{ paddingBottom: Math.max(insets.bottom, 20) }}
			>
				<Button disabled={!canSave} onPress={save}>
					<Text>{isSaving ? "Speichert..." : "Speichern"}</Text>
				</Button>
			</View>

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
