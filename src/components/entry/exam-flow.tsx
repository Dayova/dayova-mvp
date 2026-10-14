import { useRef, useState } from "react";
import { Keyboard, type TextInput, View } from "react-native";
import Animated, {
	FadeInDown,
	LinearTransition,
} from "react-native-reanimated";
import { AddOptionButton } from "~/components/ui/add-option-button";
import { Button } from "~/components/ui/button";
import { DayovaSheetFrame } from "~/components/ui/dayova-sheet-frame";
import { Field, FieldControl, FieldLabel } from "~/components/ui/field";
import {
	CalendarDays,
	Computer,
	GraduationCap,
	Mic,
	NotebookPen,
	Pencil,
} from "~/components/ui/icon";
import { InlineDatePicker } from "~/components/ui/inline-date-picker";
import { Input } from "~/components/ui/input";
import { SelectionOptionRow } from "~/components/ui/selection-option-row";
import { Text } from "~/components/ui/text";
import { InlineSubjectPicker } from "~/features/subjects/subject-picker";
import type { SubjectSelection } from "~/features/subjects/use-subject-options";
import {
	formatAccessibleExamDate,
	getExamDatePickerRange,
} from "~/lib/exam-date";
import { useDayovaTheme } from "~/lib/theme";

const EXAM_TYPE_OPTIONS = [
	{ label: "Test", Icon: Pencil },
	{ label: "Klassenarbeit", Icon: NotebookPen },
	{ label: "Klausur", Icon: GraduationCap },
	{ label: "Vorabitur", Icon: GraduationCap },
	{ label: "Abitur", Icon: GraduationCap },
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
	const inputRef = useRef<TextInput>(null);
	const [showAdd, setShowAdd] = useState(false);
	const [draft, setDraft] = useState("");
	const isCustom =
		selectedValue.length > 0 &&
		!EXAM_TYPE_OPTIONS.some((option) => option.label === selectedValue);
	const cleanedName = draft.trim().replace(/\s+/g, " ");
	const close = () => {
		Keyboard.dismiss();
		setShowAdd(false);
	};
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
				onOpening={() => inputRef.current?.focus()}
				title="Prüfungsart hinzufügen"
				description="Gib eine Prüfungsart ein, die noch nicht in der Liste steht. Sie wird für diese Prüfung verwendet."
				closeAccessibilityLabel="Prüfungsart hinzufügen schließen"
				scrollable
			>
				<View className="gap-4">
					<View className="min-h-16 flex-row items-center rounded-input border border-border bg-card px-5">
						<Input
							ref={inputRef}
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
	return (
		<Animated.View
			entering={FadeInDown.duration(220)}
			layout={LinearTransition.duration(180)}
		>
			<SelectionOptionRow
				Icon={Icon}
				label={label}
				selected={selected}
				onPress={onPress}
			/>
		</Animated.View>
	);
}

function ExamDateSelector({
	selectedDate,
	onSelect,
}: {
	selectedDate: Date;
	onSelect: (date: Date) => void;
}) {
	const { colors } = useDayovaTheme();
	const selectedDateLabel = formatAccessibleExamDate(selectedDate);
	const dateRange = getExamDatePickerRange({ selectedDate });

	return (
		<Field className="mt-6 mb-0">
			<FieldLabel>Prüfungsdatum</FieldLabel>
			<FieldControl>
				<View
					className="mr-4 h-9 w-9 items-center justify-center rounded-full bg-accent"
					accessibilityElementsHidden
					importantForAccessibility="no-hide-descendants"
				>
					<CalendarDays size={20} color={colors.primary} strokeWidth={2.1} />
				</View>
				<Text
					className="flex-1 font-poppins font-semibold text-body-2 text-text"
					accessibilityLiveRegion="polite"
				>
					{selectedDateLabel}
				</Text>
			</FieldControl>
			<View className="mt-4">
				<InlineDatePicker
					value={selectedDate}
					onChange={onSelect}
					{...dateRange}
				/>
			</View>
		</Field>
	);
}

export {
	ExamDateSelector,
	ExamSubjectPicker,
	ExamTypePicker,
	SingleSelectOption,
};
