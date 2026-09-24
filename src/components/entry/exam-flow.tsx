import { useEffect, useRef, useState } from "react";
import { type TextInput, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
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
	Plus,
} from "~/components/ui/icon";
import { Input } from "~/components/ui/input";
import {
	SelectionControl,
	SelectionIndicator,
} from "~/components/ui/selection-control";
import { Text } from "~/components/ui/text";
import { formatAccessibleExamDate } from "~/lib/exam-date";
import { useDayovaTheme } from "~/lib/theme";

const EXAM_TYPE_OPTIONS = [
	{ label: "Test", Icon: Pencil },
	{ label: "Klassenarbeit", Icon: NotebookPen },
	{ label: "Klausur", Icon: GraduationCap },
	{ label: "Mündliche Prüfung", Icon: Mic },
	{ label: "Präsentation", Icon: Computer },
] as const;

const CUSTOM_EXAM_TYPE_LABEL = "Andere Prüfungsart";

function ExamTypePicker({
	selectedValue,
	onSelect,
}: {
	selectedValue: string;
	onSelect: (value: string) => void;
}) {
	const customInputRef = useRef<TextInput>(null);
	const [isCustomSelected, setIsCustomSelected] = useState(
		() =>
			selectedValue.length > 0 &&
			!EXAM_TYPE_OPTIONS.some((option) => option.label === selectedValue),
	);

	useEffect(() => {
		if (!isCustomSelected) return;
		const frame = requestAnimationFrame(() => customInputRef.current?.focus());
		return () => cancelAnimationFrame(frame);
	}, [isCustomSelected]);

	const selectPreset = (value: string) => {
		setIsCustomSelected(false);
		onSelect(value);
	};

	const selectCustom = () => {
		if (isCustomSelected) {
			customInputRef.current?.focus();
			return;
		}
		setIsCustomSelected(true);
		onSelect("");
	};

	return (
		<View className="gap-3" accessibilityRole="radiogroup">
			{EXAM_TYPE_OPTIONS.map((option) => {
				const isSelected = !isCustomSelected && selectedValue === option.label;

				return (
					<SingleSelectOption
						key={option.label}
						Icon={option.Icon}
						label={option.label}
						selected={isSelected}
						onPress={() => selectPreset(option.label)}
					/>
				);
			})}

			<SingleSelectOption
				Icon={Plus}
				label={CUSTOM_EXAM_TYPE_LABEL}
				selected={isCustomSelected}
				onPress={selectCustom}
			/>

			{isCustomSelected ? (
				<Animated.View
					entering={FadeInDown.duration(220)}
					className="gap-2 pt-1"
				>
					<Text className="font-poppins text-body-4 text-text">
						Eigene Prüfungsart
					</Text>
					<View className="min-h-16 flex-row items-center rounded-input border border-border bg-card px-5">
						<Input
							ref={customInputRef}
							value={selectedValue}
							onChangeText={onSelect}
							placeholder="Zum Beispiel Vokabeltest"
							returnKeyType="done"
							maxLength={60}
						/>
					</View>
				</Animated.View>
			) : null}
		</View>
	);
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

export { ExamDateSelector, ExamTypePicker, SingleSelectOption };
