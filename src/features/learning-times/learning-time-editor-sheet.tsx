import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useMemo, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { Button } from "~/components/ui/button";
import { ConfirmationSheetContent } from "~/components/ui/confirmation-sheet";
import {
	type DateTimePickerEvent,
	DateTimePickerSheet,
} from "~/components/ui/date-time-picker-sheet";
import { DayovaSheetFrame } from "~/components/ui/dayova-sheet-frame";
import { ErrorMessage } from "~/components/ui/error-message";
import { useContentSizeLayout } from "~/components/ui/portrait-content";
import { Text } from "~/components/ui/text";
import { useAuthSession } from "~/context/AuthContext";
import {
	LEARNING_DAYS,
	type LearningDayLabel,
} from "~/features/learning-times/learning-time-days";
import { LearningTimeEditorFields } from "~/features/learning-times/learning-time-editor-fields";
import { createAsyncActionGate } from "~/lib/async-action-gate";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { useFeatureAnalytics } from "~/lib/use-feature-analytics";
import { getUserFacingErrorMessage } from "~/lib/user-facing-errors";
import { cn } from "~/lib/utils";

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

export function LearningTimeEditorSheet({
	day,
	id,
	onClose,
}: {
	day: number;
	id?: string;
	onClose: () => void;
}) {
	const trackFeature = useFeatureAnalytics();
	const { shouldStackInlineContent } = useContentSizeLayout();
	const [visible, setVisible] = useState(true);
	// Native dismissal can invoke the callback captured when the sheet opened.
	const pendingTimeFieldRef = useRef<TimeField | null>(null);
	const [pendingTimeField, setPendingTimeField] = useState<TimeField | null>(
		null,
	);
	const openTimePicker = (field: TimeField) => {
		pendingTimeFieldRef.current = field;
		setPendingTimeField(field);
		setVisible(false);
	};
	const { user } = useAuthSession();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const learningTimes = useQuery(
		api.learningTimes.listMine,
		user && isConvexAuthenticated ? {} : "skip",
	);
	const saveLearningTime = useMutation(api.learningTimes.upsertMine);
	const removeLearningTime = useMutation(api.learningTimes.removeMine);

	const initialDay =
		LEARNING_DAYS.find((entry) => entry.value === day)?.label ?? "Montag";
	const [draft, setDraft] = useState<LearningTimeDraft>({ baseKey: "" });
	const [activeTimeField, setActiveTimeField] = useState<TimeField | null>(
		null,
	);
	const [isSaving, setIsSaving] = useState(false);
	const [isRemoveConfirmationVisible, setIsRemoveConfirmationVisible] =
		useState(false);
	const [removeDescription, setRemoveDescription] = useState("");
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const mutationGateRef = useRef(createAsyncActionGate());
	const learningTimeId = id as Id<"userLearningTimes"> | undefined;
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
		(learningTimeId ? `missing:${learningTimeId}` : `new:${day}`);
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
		setErrorMessage(null);
	};

	const hasValidTimeRange =
		parseTimeToMinutes(endTime) > parseTimeToMinutes(startTime);
	const hasChanges =
		!isEditingExisting ||
		selectedDayValue !== selectedEntry?.dayOfWeek ||
		startTime !== (selectedEntry?.startTime ?? DEFAULT_START_TIME) ||
		endTime !== (selectedEntry?.endTime ?? DEFAULT_END_TIME);
	const canRemove =
		Boolean(selectedEntry) &&
		Boolean(user) &&
		isConvexAuthenticated &&
		!isSaving;
	const canSave =
		hasValidTimeRange &&
		!isSaving &&
		Boolean(user) &&
		isConvexAuthenticated &&
		learningTimes !== undefined &&
		(!isEditingExisting || Boolean(selectedEntry));

	const closeToOverview = () => setVisible(false);
	const updateTime = (event: DateTimePickerEvent, selectedDate?: Date) => {
		if (event.type !== "set" || !selectedDate || !activeTimeField) return;

		const nextTime = formatTime(selectedDate);
		if (activeTimeField === "start") {
			updateDraft({ startTime: nextTime });
		} else {
			updateDraft({ endTime: nextTime });
		}
	};

	const save = async () => {
		if (!canSave) return;
		if (!hasChanges) {
			closeToOverview();
			return;
		}

		await mutationGateRef.current.run(async () => {
			setIsSaving(true);
			setErrorMessage(null);
			try {
				trackFeature("learning_times.save", "attempted");
				await saveLearningTime({
					id: selectedEntry?.id,
					dayOfWeek: selectedDayValue,
					startTime,
					endTime,
				});
				trackFeature("learning_times.save", "succeeded");
				closeToOverview();
			} catch (error) {
				trackFeature("learning_times.save", "failed");
				setErrorMessage(
					getUserFacingErrorMessage(error, "Bitte versuche es erneut.", {
						source: "learning-times.save",
					}),
				);
			} finally {
				setIsSaving(false);
			}
		});
	};

	const remove = async () => {
		if (!selectedEntry || !canRemove) return;

		await mutationGateRef.current.run(async () => {
			setIsSaving(true);
			setErrorMessage(null);
			try {
				trackFeature("learning_times.remove", "attempted");
				await removeLearningTime({ id: selectedEntry.id });
				trackFeature("learning_times.remove", "succeeded");
				closeToOverview();
			} catch (error) {
				trackFeature("learning_times.remove", "failed");
				setErrorMessage(
					getUserFacingErrorMessage(error, "Bitte versuche es erneut.", {
						source: "learning-times.remove",
					}),
				);
			} finally {
				setIsSaving(false);
			}
		});
	};

	const requestRemove = () => {
		if (!canRemove) return;
		setErrorMessage(null);
		setRemoveDescription(
			`${selectedEntryDay}, ${selectedEntry?.startTime}–${selectedEntry?.endTime} Uhr wird aus deinen wöchentlichen Lernzeiten entfernt.`,
		);
		setIsRemoveConfirmationVisible(true);
	};

	return (
		<>
			<DayovaSheetFrame
				visible={visible}
				dismissDurationMs={pendingTimeField ? 120 : undefined}
				title={
					isRemoveConfirmationVisible
						? "Lernzeit löschen?"
						: isEditingExisting
							? "Lernzeit bearbeiten"
							: "Lernzeit hinzufügen"
				}
				description={
					isRemoveConfirmationVisible
						? undefined
						: "Wähle den Wochentag und das Zeitfenster, in dem du regelmäßig lernen kannst."
				}
				closeAccessibilityLabel="Lernzeit schließen"
				dismissible={!isSaving}
				onClose={() => {
					if (!isSaving) setVisible(false);
				}}
				onDismiss={() => {
					if (pendingTimeFieldRef.current) {
						setActiveTimeField(pendingTimeFieldRef.current);
						pendingTimeFieldRef.current = null;
						setPendingTimeField(null);
					} else {
						onClose();
					}
				}}
			>
				{isRemoveConfirmationVisible ? (
					<ConfirmationSheetContent
						actionAppearance="outlined"
						description={removeDescription}
						confirmLabel="Löschen"
						isBusy={isSaving}
						errorMessage={errorMessage}
						onClose={closeToOverview}
						onConfirm={() => {
							void remove();
						}}
					/>
				) : (
					<View className="gap-6">
						<LearningTimeEditorFields
							disabled={
								isSaving ||
								!user ||
								!isConvexAuthenticated ||
								learningTimes === undefined
							}
							selectedDay={selectedDay}
							startTime={startTime}
							endTime={endTime}
							onDayChange={(day) => updateDraft({ selectedDay: day })}
							onStartTimePress={() => openTimePicker("start")}
							onEndTimePress={() => openTimePicker("end")}
						/>
						{!hasValidTimeRange ? (
							<ErrorMessage>
								Die Endzeit muss nach der Startzeit liegen.
							</ErrorMessage>
						) : null}
						{isEditingExisting &&
						learningTimes !== undefined &&
						!selectedEntry ? (
							<ErrorMessage>
								Diese Lernzeit ist nicht mehr verfügbar. Schließe den Dialog und
								wähle eine andere Lernzeit.
							</ErrorMessage>
						) : null}
						{errorMessage ? <ErrorMessage>{errorMessage}</ErrorMessage> : null}
						{learningTimes === undefined ? (
							<ActivityIndicator
								accessibilityLabel="Lernzeiten werden geladen"
								color={DAYOVA_DESIGN_SYSTEM.colors.primary}
							/>
						) : null}
						<View
							className={cn(
								"gap-3",
								(!isEditingExisting || !shouldStackInlineContent) && "flex-row",
							)}
						>
							{isEditingExisting ? (
								<Button
									variant="destructive-outline"
									className={cn(!shouldStackInlineContent && "flex-1")}
									disabled={!canRemove}
									onPress={requestRemove}
								>
									<Text>Löschen</Text>
								</Button>
							) : (
								<Button
									variant="cancel"
									className="min-h-14 flex-1 px-3"
									disabled={isSaving}
									onPress={() => setVisible(false)}
								>
									<Text className="shrink text-center">Abbrechen</Text>
								</Button>
							)}
							<Button
								className={cn(
									"min-h-14 px-3",
									(!isEditingExisting || !shouldStackInlineContent) && "flex-1",
								)}
								disabled={!canSave}
								accessibilityState={{ busy: isSaving, disabled: !canSave }}
								onPress={() => {
									void save();
								}}
							>
								<Text className="shrink text-center">
									{isSaving
										? "Speichert …"
										: isEditingExisting
											? "Speichern"
											: "Hinzufügen"}
								</Text>
							</Button>
						</View>
					</View>
				)}
			</DayovaSheetFrame>
			<DateTimePickerSheet
				visible={Boolean(activeTimeField)}
				value={dateForTime(activeTimeField === "end" ? endTime : startTime)}
				mode="time"
				display="spinner"
				onChange={updateTime}
				onClose={() => {
					setActiveTimeField(null);
					setVisible(true);
				}}
			/>
		</>
	);
}
