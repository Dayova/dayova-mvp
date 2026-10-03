import { useState } from "react";
import { Platform, Pressable, View } from "react-native";
import type { PreparationSlot } from "#convex/preparationSchedule";
import {
	slotDateLabel,
	timeLabel,
	timeMinutes,
} from "#convex/preparationSchedule";
import { Button } from "~/components/ui/button";
import { DateTimePickerSheet } from "~/components/ui/date-time-picker-sheet";
import { DayovaSheetFrame } from "~/components/ui/dayova-sheet-frame";
import { DurationPickerSheet } from "~/components/ui/duration-picker-sheet";
import { Text } from "~/components/ui/text";
import { LEARNING_DAYS } from "~/features/learning-times/learning-time-days";
import { LearningTimeEditorFields } from "~/features/learning-times/learning-time-editor-fields";
export function PreparationSlotEditor({
	slot,
	examDateKey,
	onSave,
	onRemove,
	onClose,
	diagnostic = false,
}: {
	slot: PreparationSlot;
	examDateKey: string;
	onSave: (slot: PreparationSlot) => void;
	onRemove?: () => void;
	onClose: () => void;
	diagnostic?: boolean;
}) {
	const [draft, setDraft] = useState(slot);
	const [visible, setVisible] = useState(true);
	const [picker, setPicker] = useState<"date" | "time" | "duration" | null>(
		null,
	);
	const close = () => {
		setVisible(false);
	};
	const open = (target: "date" | "time" | "duration") => {
		setPicker(target);
	};
	const inlinePicker =
		picker === "duration" || (picker !== null && Platform.OS !== "android");
	const valid =
		(timeMinutes(draft.startTime) ?? 1440) + draft.durationMinutes <= 1440 &&
		draft.durationMinutes >= 5 &&
		draft.durationMinutes <= 240 &&
		draft.durationMinutes % 5 === 0;
	const pickerDate = new Date(`${draft.dateKey}T${draft.startTime}:00`);
	return (
		<DayovaSheetFrame
			visible={visible}
			title={
				inlinePicker
					? picker === "duration"
						? "Lerndauer"
						: picker === "date"
							? "Datum"
							: "Beginn"
					: diagnostic
						? "Wissenscheck planen"
						: onRemove
							? "Lernzeit bearbeiten"
							: "Lernzeit hinzufügen"
			}
			scrollable={!inlinePicker}
			description={
				inlinePicker
					? undefined
					: diagnostic
						? "Wähle einen Termin. Dayova erinnert dich daran."
						: "Wähle den Wochentag und das Zeitfenster für diesen Lerntermin."
			}
			onClose={close}
			onDismiss={onClose}
			footer={
				inlinePicker ? undefined : (
					<View className="gap-3">
						<View className="flex-row gap-3">
							<Button
								variant="cancel"
								className="flex-1"
								onPress={() => {
									onRemove?.();
									close();
								}}
							>
								<Text className={onRemove ? "text-destructive" : undefined}>
									{onRemove ? "Entfernen" : "Abbrechen"}
								</Text>
							</Button>
							<Button
								className="flex-1"
								disabled={!valid}
								onPress={() => {
									onSave(draft);
									close();
								}}
							>
								<Text>
									{diagnostic
										? "Einplanen"
										: onRemove
											? "Speichern"
											: "Hinzufügen"}
								</Text>
							</Button>
						</View>
					</View>
				)
			}
		>
			{!inlinePicker ? (
				<View className="gap-5">
					{diagnostic ? (
						<>
							<Button variant="cancel" onPress={() => open("date")}>
								<Text>{slotDateLabel(draft.dateKey)}</Text>
							</Button>
							<Button variant="cancel" onPress={() => open("time")}>
								<Text>{draft.startTime} Uhr</Text>
							</Button>
						</>
					) : (
						<>
							<Pressable
								accessibilityRole="button"
								accessibilityLabel={`Datum ändern: ${slotDateLabel(draft.dateKey)}`}
								onPress={() => open("date")}
								className="min-h-11 justify-center"
								hitSlop={8}
							>
								<Text className="font-poppins text-body-4 text-primary">
									{slotDateLabel(draft.dateKey)} · Datum ändern
								</Text>
							</Pressable>
							<LearningTimeEditorFields
								outlinedDays
								selectedDay={
									LEARNING_DAYS[
										(new Date(`${draft.dateKey}T12:00:00Z`).getUTCDay() + 6) % 7
									].label
								}
								startTime={draft.startTime}
								endLabel="Lerndauer"
								endTime={`${draft.durationMinutes} Min.`}
								onDayChange={(day) => {
									const date = new Date(`${draft.dateKey}T12:00:00Z`);
									const selected =
										LEARNING_DAYS.find((d) => d.label === day)?.value ?? 1;
									date.setUTCDate(
										date.getUTCDate() + selected - (date.getUTCDay() || 7),
									);
									setDraft({
										...draft,
										dateKey: date.toISOString().slice(0, 10),
									});
								}}
								onStartTimePress={() => open("time")}
								onEndTimePress={() => open("duration")}
							/>
							<Text className="text-body-4 text-secondary-text">
								Ende{" "}
								{timeLabel(
									(timeMinutes(draft.startTime) ?? 0) + draft.durationMinutes,
								)}{" "}
								Uhr
							</Text>
						</>
					)}

					{!valid ? (
						<Text accessibilityRole="alert" className="text-destructive">
							Wähle 5 bis 240 Minuten innerhalb eines Tages, in Schritten von 5
							Minuten.
						</Text>
					) : null}
				</View>
			) : null}
			<DateTimePickerSheet
				embedded
				visible={picker === "date" || picker === "time"}
				mode={picker === "date" ? "date" : "time"}
				display="spinner"
				value={pickerDate}
				minimumDate={picker === "date" ? new Date() : undefined}
				maximumDate={
					picker === "date"
						? new Date(
								new Date(`${examDateKey.slice(0, 10)}T12:00:00`).getTime() -
									86400000,
							)
						: undefined
				}
				onChange={(event, date) => {
					if (event.type !== "set" || !date) return;
					setDraft({
						...draft,
						...(picker === "date"
							? {
									dateKey: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
								}
							: {
									startTime: `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`,
								}),
					});
				}}
				onClose={() => {
					setPicker(null);
				}}
			/>
			{picker === "duration" ? (
				<DurationPickerSheet
					embedded
					value={draft.durationMinutes}
					onConfirm={(durationMinutes) =>
						setDraft({ ...draft, durationMinutes })
					}
					onDismiss={() => {
						setPicker(null);
					}}
				/>
			) : null}
		</DayovaSheetFrame>
	);
}
