import { useEffect, useRef, useState } from "react";
import { Pressable, type TextInput, View } from "react-native";
import Animated, {
	FadeInDown,
	LinearTransition,
} from "react-native-reanimated";
import { BackButton } from "~/components/ui/button";
import { FlowProgressBar } from "~/components/ui/flow-progress-bar";
import {
	Computer,
	GraduationCap,
	Mic,
	NotebookPen,
	Pencil,
	Plus,
} from "~/components/ui/icon";
import { Input } from "~/components/ui/input";
import { SnapCarouselSelector } from "~/components/ui/snap-carousel-selector";
import { Text } from "~/components/ui/text";
import { getDayKey } from "~/lib/day-key";
import {
	buildExamDateOptions,
	findExamDateIndex,
	formatAccessibleExamDate,
	formatExamDateDay,
	formatExamDateMonth,
} from "~/lib/exam-date";
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

function ExamFlowHeader({
	currentStep,
	onBack,
}: {
	currentStep: number;
	onBack: () => void;
}) {
	const totalSteps = 3;
	const safeStep = Math.min(Math.max(currentStep, 1), totalSteps);

	return (
		<View className="flex-row items-center gap-4">
			<BackButton onPress={onBack} />
			<View className="flex-1 gap-2">
				<View className="flex-row items-center justify-between">
					<Text className="font-poppins font-semibold text-body-3 text-text">
						Prüfung eintragen
					</Text>
					<Text className="font-poppins text-body-4 text-secondary-text">
						{safeStep} von {totalSteps}
					</Text>
				</View>
				<FlowProgressBar
					progress={safeStep / totalSteps}
					accessibilityRole="progressbar"
					accessibilityValue={{
						min: 1,
						max: totalSteps,
						now: safeStep,
						text: `Schritt ${safeStep} von ${totalSteps}`,
					}}
				/>
			</View>
		</View>
	);
}

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
	onSelect,
}: {
	selectedDate: Date;
	onSelect: (date: Date) => void;
}) {
	const [dateOptions] = useState(() => buildExamDateOptions({ selectedDate }));
	const selectedIndex = findExamDateIndex(dateOptions, selectedDate);

	return (
		<View className="mt-6 w-full items-center">
			<View className="mb-3 flex-row items-baseline justify-center gap-2">
				<Text
					className="font-poppins font-semibold text-display-counter text-text"
					// The day number is a counter, so tabular figures avoid width jumps.
					style={{ fontVariant: ["tabular-nums"] }}
				>
					{formatExamDateDay(selectedDate)}
				</Text>
				<Text className="font-poppins font-semibold text-heading-2 text-primary">
					{formatExamDateMonth(selectedDate)}
				</Text>
			</View>
			<SnapCarouselSelector
				accessibilityLabel="Prüfungstag auswählen"
				accessibilityValue={formatAccessibleExamDate(selectedDate)}
				decrementLabel="Vorheriger Tag"
				getItemKey={getDayKey}
				incrementLabel="Nächster Tag"
				items={dateOptions}
				onSelect={onSelect}
				selectedIndex={selectedIndex}
				showValueBubble={false}
			/>
		</View>
	);
}

export { ExamDateSelector, ExamFlowHeader, ExamTypePicker, SingleSelectOption };
