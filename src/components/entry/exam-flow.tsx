import { useEffect, useRef, useState } from "react";
import { Pressable, type TextInput, View } from "react-native";
import Animated, {
	FadeInDown,
	LinearTransition,
} from "react-native-reanimated";
import {
	Computer,
	CalendarDays,
	ChevronDown,
	GraduationCap,
	Mic,
	NotebookPen,
	Pencil,
	Plus,
} from "~/components/ui/icon";
import {
	Field,
	FieldAccessory,
	FieldLabel,
	FieldTrigger,
} from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import { formatAccessibleExamDate } from "~/lib/exam-date";
import { useDayovaTheme } from "~/lib/theme";
import { cn } from "~/lib/utils";

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
		<Animated.View
			entering={FadeInDown.duration(220)}
			layout={LinearTransition.duration(180)}
		>
			<Pressable
				accessibilityRole="radio"
				accessibilityState={{ selected }}
				onPress={onPress}
				className={cn(
					"min-h-16 flex-row items-center gap-4 rounded-[24px] border px-5 py-3 active:opacity-80",
					selected
						? "border-primary/40 bg-accent"
						: "border-transparent bg-card shadow-black/5 shadow-sm",
				)}
			>
				<View
					accessible={false}
					className={cn(
						"h-9 w-9 items-center justify-center rounded-full",
						selected ? "bg-primary/15" : "bg-accent",
					)}
				>
					<Icon
						size={20}
						color={selected ? colors.primary : colors.secondaryText}
						strokeWidth={2}
					/>
				</View>
				<Text
					className={cn(
						"flex-1 font-poppins text-body-2",
						selected ? "font-semibold text-primary" : "text-text",
					)}
				>
					{label}
				</Text>
				<RadioIndicator selected={selected} color={colors.primary} />
			</Pressable>
		</Animated.View>
	);
}

function RadioIndicator({
	selected,
	color,
}: {
	selected: boolean;
	color: string;
}) {
	return (
		<View
			className="h-6 w-6 items-center justify-center rounded-full border-2"
			// The selection color comes from the active runtime theme.
			style={{ borderColor: selected ? color : `${color}66` }}
		>
			{selected ? <View className="h-3 w-3 rounded-full bg-primary" /> : null}
		</View>
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
