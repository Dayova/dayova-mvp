import { useState } from "react";
import {
	ActivityIndicator,
	ScrollView,
	TouchableOpacity,
	View,
} from "react-native";
import Animated, {
	FadeInDown,
	useReducedMotion,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "~/components/ui/button";
import { FlowProgressBar } from "~/components/ui/flow-progress-bar";
import {
	BookOpen,
	Bulb,
	ChevronDown,
	CircleAlert,
	Pencil,
} from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { useDayovaTheme } from "~/lib/theme";
import { cn } from "~/lib/utils";
import {
	adaptTheoryTopic,
	getTheoryPagePresentation,
	getTheoryTopicNavigation,
	type TheoryTopic,
} from "./theory-topic";
import type { SessionContentItem } from "./types";

type TheoryTopicPageProps = {
	item: SessionContentItem;
	currentIndex: number;
	total: number;
	isCompleting: boolean;
	onPrevious: () => void;
	onNext: () => void;
};

function TheoryTopicProgress({
	currentIndex,
	total,
}: {
	currentIndex: number;
	total: number;
}) {
	const safeTotal = Math.max(total, 1);
	const safeIndex = Math.min(Math.max(currentIndex, 0), safeTotal - 1);

	return (
		<View className="border-border border-b bg-background px-6 py-5">
			<View className="mb-3 flex-row items-center justify-between">
				<Text
					selectable
					className="font-poppins font-semibold text-body-5 text-primary"
				>
					THEMA {safeIndex + 1}
				</Text>
				<Text
					selectable
					className="font-poppins text-body-5 text-secondary-text"
					// Tabular counter alignment requires React Native's text style API.
					style={{ fontVariant: ["tabular-nums"] }}
				>
					{safeIndex + 1} von {safeTotal}
				</Text>
			</View>
			<FlowProgressBar
				progress={(safeIndex + 1) / safeTotal}
				accessibilityRole="progressbar"
				accessibilityValue={{
					min: 1,
					max: safeTotal,
					now: safeIndex + 1,
					text: `Thema ${safeIndex + 1} von ${safeTotal}`,
				}}
			/>
		</View>
	);
}

function TheoryTopicIntroduction({ topic }: { topic: TheoryTopic }) {
	return (
		<Text
			selectable
			accessibilityRole="header"
			className="font-poppins font-semibold text-heading-2 text-text"
		>
			{topic.question}
		</Text>
	);
}

function CollapsibleTheorySection({
	chevronColor,
	children,
	className,
	icon,
	title,
}: {
	chevronColor: string;
	children: React.ReactNode;
	className?: string;
	icon: React.ReactNode;
	title: string;
}) {
	const [isExpanded, setIsExpanded] = useState(false);

	return (
		<View className={cn("gap-4", className)}>
			<TouchableOpacity
				accessibilityHint={
					isExpanded
						? "Blendet den Inhalt dieses Abschnitts aus."
						: "Blendet den Inhalt dieses Abschnitts ein."
				}
				accessibilityLabel={`${title} ${isExpanded ? "einklappen" : "ausklappen"}`}
				accessibilityRole="button"
				accessibilityState={{ expanded: isExpanded }}
				activeOpacity={0.72}
				className="min-h-12 flex-row items-center gap-3"
				onPress={() => setIsExpanded((value) => !value)}
			>
				<View className="h-10 w-10 items-center justify-center rounded-full bg-system-subtle">
					{icon}
				</View>
				<Text className="flex-1 font-poppins font-semibold text-body-2 text-text">
					{title}
				</Text>
				<View className={cn(isExpanded && "rotate-180")}>
					<ChevronDown size={20} color={chevronColor} strokeWidth={2.1} />
				</View>
			</TouchableOpacity>
			{isExpanded ? children : null}
		</View>
	);
}

export function TheoryTopicPage({
	item,
	currentIndex,
	total,
	isCompleting,
	onPrevious,
	onNext,
}: TheoryTopicPageProps) {
	const insets = useSafeAreaInsets();
	const { colors } = useDayovaTheme();
	const reduceMotion = useReducedMotion();
	const topic = adaptTheoryTopic(item, currentIndex);
	const presentation = getTheoryPagePresentation(item.questionAngle);
	const navigation = getTheoryTopicNavigation(currentIndex, total);

	return (
		<View className="flex-1 bg-background">
			<TheoryTopicProgress currentIndex={currentIndex} total={total} />

			<ScrollView
				contentInsetAdjustmentBehavior="automatic"
				contentContainerStyle={{
					paddingHorizontal: 24,
					paddingTop: 28,
					paddingBottom: 36,
				}}
				showsVerticalScrollIndicator={false}
			>
				<Animated.View
					key={item.id}
					entering={reduceMotion ? undefined : FadeInDown.duration(220)}
					className="gap-7"
				>
					<TheoryTopicIntroduction topic={topic} />

					<CollapsibleTheorySection
						chevronColor={colors.secondaryText}
						title={presentation.sectionTitle}
						icon={
							<BookOpen
								size={20}
								color={DAYOVA_DESIGN_SYSTEM.colors.primary}
								strokeWidth={2.1}
							/>
						}
					>
						<Text
							selectable
							className="font-poppins text-body-2 text-secondary-text"
						>
							{topic.explanation}
						</Text>
						{presentation.showKeyPoints && topic.keyPoints.length > 0 ? (
							<View className="gap-3">
								{topic.keyPoints.map((keyPoint) => (
									<View key={keyPoint} className="flex-row gap-3">
										<View className="mt-2 h-2 w-2 rounded-full bg-primary" />
										<Text
											selectable
											className="flex-1 font-poppins text-body-2 text-text"
										>
											{keyPoint}
										</Text>
									</View>
								))}
							</View>
						) : null}
					</CollapsibleTheorySection>

					{presentation.showExample && topic.example ? (
						<CollapsibleTheorySection
							chevronColor={colors.secondaryText}
							className="rounded-[32px] border border-primary/20 bg-system-subtle px-5 py-5"
							title="Beispiel"
							icon={
								<Pencil
									size={19}
									color={DAYOVA_DESIGN_SYSTEM.colors.primary}
									strokeWidth={2.1}
								/>
							}
						>
							<Text selectable className="font-poppins text-body-2 text-text">
								{topic.example}
							</Text>
						</CollapsibleTheorySection>
					) : null}

					{presentation.showMemoryCue && topic.memoryCue ? (
						<CollapsibleTheorySection
							chevronColor={colors.secondaryText}
							className="rounded-[32px] bg-theorie-subtle px-5 py-5"
							title="Merksatz"
							icon={
								<Bulb
									size={20}
									color={DAYOVA_DESIGN_SYSTEM.colors.theorie}
									strokeWidth={2.1}
								/>
							}
						>
							<Text selectable className="font-poppins text-body-2 text-text">
								{topic.memoryCue}
							</Text>
						</CollapsibleTheorySection>
					) : null}

					{presentation.showCommonMistake && topic.commonMistake ? (
						<CollapsibleTheorySection
							chevronColor={colors.secondaryText}
							className="rounded-[32px] bg-wrong-subtle px-5 py-5"
							title="Typischer Fehler"
							icon={
								<CircleAlert
									size={20}
									color={DAYOVA_DESIGN_SYSTEM.colors.wrong}
									strokeWidth={2.1}
								/>
							}
						>
							<Text selectable className="font-poppins text-body-2 text-text">
								{topic.commonMistake}
							</Text>
						</CollapsibleTheorySection>
					) : null}
				</Animated.View>
			</ScrollView>

			<View
				className="flex-row gap-3 border-border border-t bg-card px-6 pt-4"
				// Footer padding depends on the device safe area.
				style={{ paddingBottom: Math.max(insets.bottom, 16) }}
			>
				<Button
					className="flex-1 px-4"
					disabled={!navigation.canGoPrevious || isCompleting}
					onPress={onPrevious}
					variant="neutral"
				>
					<Text>Zurück</Text>
				</Button>
				<Button
					className="flex-[1.35] px-4"
					disabled={isCompleting}
					onPress={onNext}
				>
					{isCompleting ? (
						<ActivityIndicator color={colors.light1} />
					) : (
						<Text>{navigation.primaryLabel}</Text>
					)}
				</Button>
			</View>
		</View>
	);
}
