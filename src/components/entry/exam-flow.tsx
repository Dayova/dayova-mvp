import { useState } from "react";
import { View } from "react-native";
import { AddOptionButton } from "~/components/ui/add-option-button";
import { Button } from "~/components/ui/button";
import { DayovaSheetFrame } from "~/components/ui/dayova-sheet-frame";
import {
	Field,
	FieldAccessory,
	FieldLabel,
	FieldTrigger,
} from "~/components/ui/field";
import {
	CalendarDays,
	ChevronDown,
	Computer,
	GraduationCap,
	Mic,
	NotebookPen,
	Pencil,
} from "~/components/ui/icon";
import { Input } from "~/components/ui/input";
import {
	SelectionControl,
	SelectionIndicator,
} from "~/components/ui/selection-control";
import { Text } from "~/components/ui/text";
import { InlineSubjectPicker } from "~/features/subjects/subject-picker";
import type { SubjectSelection } from "~/features/subjects/use-subject-options";
import { formatAccessibleExamDate } from "~/lib/exam-date";
import { useDayovaTheme } from "~/lib/theme";

const EXAM_TYPE_OPTIONS = [
	{ label: "Test", Icon: Pencil },
	{ label: "Klassenarbeit", Icon: NotebookPen },
	{ label: "Klausur", Icon: GraduationCap },
	{ label: "Mündliche Prüfung", Icon: Mic },
	{ label: "Präsentation", Icon: Computer },
] as const;

function ExamTypePicker({
	selectedValue,
	onSelect,
}: {
	selectedValue: string;
	onSelect: (value: string) => void;
}) {
	const [showAdd, setShowAdd] = useState(false);
	const [draft, setDraft] = useState("");
	const isCustom =
		selectedValue.length > 0 &&
		!EXAM_TYPE_OPTIONS.some((option) => option.label === selectedValue);
	const cleanedName = draft.trim().replace(/\s+/g, " ");
	const close = () => setShowAdd(false);
	const save = () => {
		if (!cleanedName) return;
		const preset = EXAM_TYPE_OPTIONS.find(
			(option) =>
				option.label.toLocaleLowerCase("de") ===
				cleanedName.toLocaleLowerCase("de"),
		);
		onSelect(preset?.label ?? cleanedName);
		close();
	};
	return (
		<View className="gap-3">
			<View className="gap-3" accessibilityRole="radiogroup">
				{EXAM_TYPE_OPTIONS.map((option) => (
					<SingleSelectOption
						key={option.label}
						Icon={option.Icon}
						label={option.label}
						selected={selectedValue === option.label}
						onPress={() => onSelect(option.label)}
					/>
				))}
				{isCustom ? (
					<SingleSelectOption
						Icon={Pencil}
						label={selectedValue}
						selected
						onPress={() => {
							setDraft(selectedValue);
							setShowAdd(true);
						}}
					/>
				) : null}
			</View>
			<AddOptionButton
				label="Prüfungsart hinzufügen"
				onPress={() => {
					setDraft(isCustom ? selectedValue : "");
					setShowAdd(true);
				}}
			/>
			<DayovaSheetFrame
				visible={showAdd}
				onClose={close}
				title="Prüfungsart hinzufügen"
				description="Gib eine Prüfungsart ein, die noch nicht in der Liste steht. Sie wird für diese Prüfung verwendet."
				closeAccessibilityLabel="Prüfungsart hinzufügen schließen"
				scrollable
			>
				<View className="gap-4">
					<View className="min-h-16 flex-row items-center rounded-input border border-border bg-card px-5">
						<Input
							accessibilityLabel="Name der Prüfungsart"
							autoCapitalize="words"
							maxLength={60}
							placeholder="Zum Beispiel Vokabeltest"
							returnKeyType="done"
							value={draft}
							onChangeText={setDraft}
							onSubmitEditing={save}
						/>
					</View>
					<Button disabled={!cleanedName} onPress={save}>
						<Text>Prüfungsart hinzufügen</Text>
					</Button>
					<Button variant="cancel" onPress={close}>
						<Text>Abbrechen</Text>
					</Button>
				</View>
			</DayovaSheetFrame>
		</View>
	);
}

function ExamSubjectPicker({
	selectedValue,
	onSelect,
}: {
	selectedValue: SubjectSelection;
	onSelect: (value: SubjectSelection) => void;
}) {
	return <InlineSubjectPicker selected={selectedValue} onSelect={onSelect} />;
}

function SingleSelectOption({
	Icon,
	label,
	selected,
	onPress,
}: {
	Icon: typeof Pencil;
	label: string;
	selected: boolean;
	onPress: () => void;
}) {
	const { colors } = useDayovaTheme();
	return (
		<SelectionControl
			selected={selected}
			accessibilityLabel={label}
			onPress={onPress}
			contentClassName="min-h-16 flex-row items-center gap-4 px-5 py-3"
		>
			<View
				accessible={false}
				className="h-9 w-9 items-center justify-center rounded-full bg-accent"
			>
				<Icon size={20} color={colors.secondaryText} strokeWidth={2} />
			</View>
			<Text className="flex-1 font-poppins text-body-2 text-text">{label}</Text>
			<SelectionIndicator />
		</SelectionControl>
	);
}

function ExamDateSelector({
	selectedDate,
	onOpen,
}: {
	selectedDate: Date;
	onOpen: () => void;
}) {
	const { colors } = useDayovaTheme();
	const selectedDateLabel = formatAccessibleExamDate(selectedDate);

	return (
		<Field className="mt-6 mb-0">
			<FieldLabel>Prüfungsdatum</FieldLabel>
			<FieldTrigger
				accessibilityLabel="Prüfungsdatum ändern"
				accessibilityRole="button"
				accessibilityValue={{ text: selectedDateLabel }}
				onPress={onOpen}
			>
				<View className="mr-4 h-9 w-9 items-center justify-center rounded-full bg-accent">
					<CalendarDays size={20} color={colors.primary} strokeWidth={2.1} />
				</View>
				<Text
					className="flex-1 font-poppins font-semibold text-body-2 text-text"
					numberOfLines={2}
				>
					{selectedDateLabel}
				</Text>
				<FieldAccessory>
					<ChevronDown
						size={20}
						color={colors.secondaryText}
						strokeWidth={2.1}
					/>
				</FieldAccessory>
			</FieldTrigger>
			<Text className="mt-2 ml-1 font-poppins text-body-4 text-secondary-text">
				Im Kalender auswählen
			</Text>
		</Field>
	);
}

export {
	ExamDateSelector,
	ExamSubjectPicker,
	ExamTypePicker,
	SingleSelectOption,
};
