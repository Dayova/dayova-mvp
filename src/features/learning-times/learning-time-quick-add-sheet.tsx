import { useConvexAuth, useMutation } from "convex/react";
import { useRef, useState } from "react";
import { View } from "react-native";
import { api } from "#convex/_generated/api";
import { Button } from "~/components/ui/button";
import {
	type DateTimePickerEvent,
	DateTimePickerSheet,
} from "~/components/ui/date-time-picker-sheet";
import { DayovaSheetFrame } from "~/components/ui/dayova-sheet-frame";
import { ErrorMessage } from "~/components/ui/error-message";
import { Text } from "~/components/ui/text";
import { createAsyncActionGate } from "~/lib/async-action-gate";
import { getUserFacingErrorMessage } from "~/lib/user-facing-errors";
import { LEARNING_DAYS, type LearningDayLabel } from "./learning-time-days";
import { LearningTimeEditorFields } from "./learning-time-editor-fields";

const dateForTime = (time: string) => {
	const [hours, minutes] = time.split(":").map(Number);
	const date = new Date();
	date.setHours(hours, minutes, 0, 0);
	return date;
};

/** Voluntary first learning window, without leaving the completed Wissenscheck. */
export function LearningTimeQuickAddSheet({
	onClose,
}: {
	onClose: () => void;
}) {
	const { isAuthenticated } = useConvexAuth();
	const saveLearningTime = useMutation(api.learningTimes.upsertMine);
	const gate = useRef(createAsyncActionGate());
	const [visible, setVisible] = useState(true);
	const pendingTimeField = useRef<"start" | "end" | null>(null);
	const isClosing = useRef(false);
	const close = () => {
		isClosing.current = true;
		setVisible(false);
	};
	const openTimePicker = (field: "start" | "end") => {
		pendingTimeField.current = field;
		setVisible(false);
	};
	const [selectedDay, setSelectedDay] = useState<LearningDayLabel>("Montag");
	const [startTime, setStartTime] = useState("17:00");
	const [endTime, setEndTime] = useState("17:30");
	const [activeTimeField, setActiveTimeField] = useState<
		"start" | "end" | null
	>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const validRange = endTime > startTime;
	const save = async () => {
		if (!isAuthenticated || !validRange || isSaving) return;
		await gate.current.run(async () => {
			setIsSaving(true);
			setError(null);
			try {
				await saveLearningTime({
					dayOfWeek:
						LEARNING_DAYS.find((day) => day.label === selectedDay)?.value ?? 1,
					startTime,
					endTime,
				});
				close();
			} catch (cause) {
				setError(
					getUserFacingErrorMessage(
						cause,
						"Die Lernzeit konnte nicht gespeichert werden. Bitte versuche es erneut.",
						{ source: "learning-times.quick-add" },
					),
				);
			} finally {
				setIsSaving(false);
			}
		});
	};
	const updateTime = (event: DateTimePickerEvent, date?: Date) => {
		if (event.type !== "set" || !date || !activeTimeField) return;
		const value = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
		if (activeTimeField === "start") setStartTime(value);
		else setEndTime(value);
	};
	return (
		<>
			<DayovaSheetFrame
				visible={visible}
				title="Lernzeit hinzufügen"
				description="Wähle einen Tag und die Zeit, zu der du regelmäßig lernen möchtest."
				closeAccessibilityLabel="Lernzeit schließen"
				dismissible={!isSaving}
				onClose={() => {
					if (!isSaving) close();
				}}
				onDismiss={() => {
					// Present the native wheel only after the editor is fully dismissed.
					// Keeping two interactive sheets stacked steals wheel gestures on iOS.
					if (pendingTimeField.current) {
						setActiveTimeField(pendingTimeField.current);
						pendingTimeField.current = null;
					} else if (isClosing.current) onClose();
				}}
				footer={
					<Button
						disabled={!isAuthenticated || !validRange || isSaving}
						onPress={() => void save()}
					>
						<Text>{isSaving ? "Speichert …" : "Speichern"}</Text>
					</Button>
				}
			>
				<View className="gap-6">
					<LearningTimeEditorFields
						selectedDay={selectedDay}
						startTime={startTime}
						endTime={endTime}
						onDayChange={setSelectedDay}
						onStartTimePress={() => openTimePicker("start")}
						onEndTimePress={() => openTimePicker("end")}
					/>
					{!validRange ? (
						<ErrorMessage>
							Die Endzeit muss nach der Startzeit liegen.
						</ErrorMessage>
					) : null}
					{error ? <ErrorMessage>{error}</ErrorMessage> : null}
				</View>
			</DayovaSheetFrame>
			<DateTimePickerSheet
				visible={Boolean(activeTimeField)}
				mode="time"
				display="spinner"
				value={dateForTime(activeTimeField === "end" ? endTime : startTime)}
				onChange={updateTime}
				onClose={() => {
					setActiveTimeField(null);
					setVisible(true);
				}}
			/>
		</>
	);
}
