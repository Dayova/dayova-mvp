import { useRef, useState } from "react";
import { View } from "react-native";
import type { PreparationSlot } from "#convex/preparationSchedule";
import {
	slotDateLabel,
	timeLabel,
	timeMinutes,
} from "#convex/preparationSchedule";
import { Button } from "~/components/ui/button";
import { DateTimePickerSheet } from "~/components/ui/date-time-picker-sheet";
import { DayovaSheetFrame } from "~/components/ui/dayova-sheet-frame";
import { Text } from "~/components/ui/text";
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
	const [picker, setPicker] = useState<"date" | "time" | "end" | null>(null);
	const pending = useRef<"date" | "time" | "end" | null>(null);
	const closing = useRef(false);
	const close = () => {
		closing.current = true;
		setVisible(false);
	};
	const open = (target: "date" | "time" | "end") => {
		pending.current = target;
		setVisible(false);
	};
	const valid =
		(timeMinutes(draft.startTime) ?? 1440) + draft.durationMinutes <= 1440 &&
		draft.durationMinutes >= 5 &&
		draft.durationMinutes <= 240 &&
		draft.durationMinutes % 5 === 0;
	const pickerDate = new Date(
		`${draft.dateKey}T${picker === "end" ? timeLabel((timeMinutes(draft.startTime) ?? 0) + draft.durationMinutes) : draft.startTime}:00`,
	);
	return (
		<>
			<DayovaSheetFrame
				visible={visible}
				title={diagnostic ? "Wissenscheck planen" : "Lerntermin bearbeiten"}
				description={
					diagnostic
						? "Wähle einen Termin. Dayova erinnert dich daran."
						: "Passe diesen Termin für deinen Lernplan an."
				}
				onClose={close}
				onDismiss={() => {
					if (pending.current) {
						setPicker(pending.current);
						pending.current = null;
					} else if (closing.current) onClose();
				}}
				footer={
					<View className="gap-3">
						<View className="flex-row gap-3">
							<Button variant="cancel" className="flex-1" onPress={close}>
								<Text>Abbrechen</Text>
							</Button>
							<Button
								className="flex-1"
								disabled={!valid}
								onPress={() => {
									onSave(draft);
									close();
								}}
							>
								<Text>{diagnostic ? "Einplanen" : "Speichern"}</Text>
							</Button>
						</View>
						{onRemove ? (
							<Button
								variant="ghost"
								onPress={() => {
									onRemove();
									close();
								}}
							>
								<Text className="text-destructive">Entfernen</Text>
							</Button>
						) : null}
					</View>
				}
			>
				<View className="gap-5">
					<View className="gap-2">
						<Text className="text-secondary-text">Tag</Text>
						<Button variant="cancel" onPress={() => open("date")}>
							<Text>{slotDateLabel(draft.dateKey)}</Text>
						</Button>
					</View>
					<View className="gap-2">
						<Text className="text-secondary-text">Beginn</Text>
						<Button variant="cancel" onPress={() => open("time")}>
							<Text>{draft.startTime} Uhr</Text>
						</Button>
					</View>
					{!diagnostic ? (
						<View className="gap-2">
							<Text className="text-secondary-text">Ende</Text>
							<Button variant="cancel" onPress={() => open("end")}>
								<Text>
									{timeLabel(
										(timeMinutes(draft.startTime) ?? 0) + draft.durationMinutes,
									)}{" "}
									Uhr
								</Text>
							</Button>
							<Text className="text-secondary-text">
								{draft.durationMinutes} Minuten · in Schritten von 5 Minuten
							</Text>
						</View>
					) : null}

					{!valid ? (
						<Text accessibilityRole="alert" className="text-destructive">
							Wähle 5 bis 240 Minuten innerhalb eines Tages, in Schritten von 5
							Minuten.
						</Text>
					) : null}
				</View>
			</DayovaSheetFrame>
			<DateTimePickerSheet
				visible={picker !== null}
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
									...(picker === "end"
										? {
												durationMinutes:
													date.getHours() * 60 +
													date.getMinutes() -
													(timeMinutes(draft.startTime) ?? 0),
											}
										: {
												startTime: `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`,
											}),
								}),
					});
				}}
				onClose={() => {
					setPicker(null);
					setVisible(true);
				}}
			/>
		</>
	);
}
