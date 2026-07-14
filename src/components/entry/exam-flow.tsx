import { useEffect, useRef, useState } from "react";
import { Pressable, type TextInput, View } from "react-native";
import Animated, {
	FadeInDown,
	LinearTransition,
} from "react-native-reanimated";
import { BackButton } from "~/components/ui/button";
import { FlowProgressBar } from "~/components/ui/flow-progress-bar";
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
	{ label: "Test", emoji: "✏️" },
	{ label: "Klassenarbeit", emoji: "📝" },
	{ label: "Klausur", emoji: "🎓" },
	{ label: "Kurzkontrolle", emoji: "📋" },
	{ label: "Leistungskontrolle", emoji: "✅" },
	{ label: "Mündliche Prüfung", emoji: "🎤" },
	{ label: "Präsentation", emoji: "🖥️" },
] as const;

const CUSTOM_EXAM_TYPE_LABEL = "Andere Prüfungsart";

const formatExamDateTickLabel = (date: Date, isSelected: boolean) =>
	isSelected
		? `${formatExamDateDay(date)}\n${formatExamDateMonth(date)}`
		: formatExamDateDay(date);

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
		<View className="mb-8 flex-row items-center gap-4">
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
	const { colors } = useDayovaTheme();
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
					<Animated.View
						key={option.label}
						entering={FadeInDown.duration(220)}
						layout={LinearTransition.duration(180)}
					>
						<Pressable
							accessibilityRole="radio"
							accessibilityState={{ selected: isSelected }}
							onPress={() => selectPreset(option.label)}
							className={cn(
								"min-h-16 flex-row items-center gap-4 rounded-[24px] border px-5 py-3 active:opacity-80",
								isSelected
									? "border-primary/40 bg-accent"
									: "border-transparent bg-card shadow-black/5 shadow-sm",
							)}
						>
							<Text className="w-9 text-center text-heading-2">
								{option.emoji}
							</Text>
							<Text
								className={cn(
									"flex-1 font-poppins text-body-2",
									isSelected ? "font-semibold text-primary" : "text-text",
								)}
							>
								{option.label}
							</Text>
							<RadioIndicator selected={isSelected} color={colors.primary} />
						</Pressable>
					</Animated.View>
				);
			})}

			<Animated.View layout={LinearTransition.duration(180)}>
				<Pressable
					accessibilityRole="radio"
					accessibilityState={{ selected: isCustomSelected }}
					onPress={selectCustom}
					className={cn(
						"min-h-16 flex-row items-center gap-4 rounded-[24px] border px-5 py-3 active:opacity-80",
						isCustomSelected
							? "border-primary/40 bg-accent"
							: "border-transparent bg-card shadow-black/5 shadow-sm",
					)}
				>
					<Text className="w-9 text-center text-heading-2">➕</Text>
					<Text
						className={cn(
							"flex-1 font-poppins text-body-2",
							isCustomSelected ? "font-semibold text-primary" : "text-text",
						)}
					>
						{CUSTOM_EXAM_TYPE_LABEL}
					</Text>
					<RadioIndicator selected={isCustomSelected} color={colors.primary} />
				</Pressable>
			</Animated.View>

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
		<SnapCarouselSelector
			accessibilityLabel="Prüfungstag auswählen"
			accessibilityValue={formatAccessibleExamDate(selectedDate)}
			decrementLabel="Vorheriger Tag"
			getItemKey={getDayKey}
			incrementLabel="Nächster Tag"
			items={dateOptions}
			onSelect={onSelect}
			renderItemLabel={(date, _index, isSelected) =>
				formatExamDateTickLabel(date, isSelected)
			}
			selectedIndex={selectedIndex}
			showValueBubble={false}
		/>
	);
}

export { ExamDateSelector, ExamFlowHeader, ExamTypePicker };
