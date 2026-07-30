import { useEffect, useState } from "react";
import {
	ActivityIndicator,
	Animated,
	Easing,
	TouchableOpacity,
	View,
} from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { Button } from "~/components/ui/button";
import { ErrorMessage } from "~/components/ui/error-message";
import { Check } from "~/components/ui/icon";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import { Textarea } from "~/components/ui/textarea";
import type { QuizQuestion } from "~/features/learning-plans/types";
import { formatGermanUiText } from "~/lib/german-ui-text";

export function QuizStep({
	question,
	questionCount,
	questionNumber,
	answer,
	errorMessage,
	isBusy,
	onAnswerChange,
	onContinue,
}: {
	question: QuizQuestion;
	questionCount: number;
	questionNumber: number;
	answer: string;
	errorMessage: string | null;
	isBusy: boolean;
	onAnswerChange: (value: string) => void;
	onContinue: () => void;
}) {
	const trimmedAnswer = answer.trim();
	const questionId = question.id;
	const prompt = formatGermanUiText(question.prompt);
	const responseKind = question.responseKind ?? "longText";
	const options =
		responseKind === "multipleChoice" ? (question.options ?? []) : [];
	const reduceMotion = useReducedMotion();
	const [transition] = useState(() => new Animated.Value(1));

	useEffect(() => {
		if (!questionId) return;

		transition.stopAnimation();
		if (reduceMotion) {
			transition.setValue(1);
			return;
		}

		transition.setValue(0);
		const animation = Animated.timing(transition, {
			toValue: 1,
			duration: 280,
			easing: Easing.out(Easing.cubic),
			useNativeDriver: true,
		});
		animation.start();

		return () => animation.stop();
	}, [questionId, reduceMotion, transition]);

	const contentTranslateY = transition.interpolate({
		inputRange: [0, 1],
		outputRange: [18, 0],
	});

	return (
		<View className="flex-1">
			<Animated.View
				className="flex-1"
				style={{
					opacity: transition,
					transform: [{ translateY: contentTranslateY }],
				}}
			>
				<Text
					className="pt-8 font-poppins font-semibold text-body-4 text-primary"
					style={{ fontVariant: ["tabular-nums"] }}
				>
					Frage {questionNumber} von {questionCount}
				</Text>
				<Text className="mt-3 font-poppins font-semibold text-body-1 text-text">
					{prompt}
				</Text>
				{responseKind === "multipleChoice" ? (
					<View accessibilityRole="radiogroup" className="mt-6 gap-3">
						{options.map((option, index) => {
							const selected = answer === option;
							return (
								<TouchableOpacity
									key={`${question.id}-${option}`}
									accessibilityLabel={`Antwort ${String.fromCharCode(65 + index)}: ${option}`}
									accessibilityRole="radio"
									accessibilityState={{ selected, disabled: isBusy }}
									activeOpacity={0.86}
									disabled={isBusy}
									onPress={() => onAnswerChange(option)}
									className={`min-h-16 flex-row items-center gap-3 rounded-[24px] border px-4 py-3 ${
										selected
											? "border-primary bg-system-subtle"
											: "border-border bg-card"
									}`}
								>
									<View
										className={`h-9 w-9 items-center justify-center rounded-[14px] ${
											selected ? "bg-primary" : "bg-light-2"
										}`}
									>
										{selected ? (
											<Check size={18} color="#FFFFFF" strokeWidth={2.7} />
										) : (
											<Text className="font-poppins font-semibold text-body-4 text-secondary-text">
												{String.fromCharCode(65 + index)}
											</Text>
										)}
									</View>
									<Text className="flex-1 font-poppins text-body-3 text-text">
										{option}
									</Text>
								</TouchableOpacity>
							);
						})}
					</View>
				) : responseKind === "shortText" ? (
					<View className="mt-6 min-h-16 rounded-[24px] border border-border bg-card px-5 py-4">
						<Input
							autoFocus
							accessibilityLabel="Kurze Antwort"
							editable={!isBusy}
							value={answer}
							onChangeText={onAnswerChange}
							placeholder="Kurze Antwort"
							returnKeyType="done"
						/>
					</View>
				) : (
					<Textarea
						autoFocus
						accessibilityLabel="Antwort"
						className="mt-4 min-h-[180px] flex-1 py-2"
						editable={!isBusy}
						value={answer}
						onChangeText={onAnswerChange}
						placeholder="Schreibe hier deine Antwort."
					/>
				)}
				<Button
					className="mt-4 self-start px-5"
					size="sm"
					variant="ghost"
					disabled={isBusy}
					onPress={() => onAnswerChange("Weiß ich nicht")}
				>
					<Text>Weiß ich nicht</Text>
				</Button>
				{errorMessage ? (
					<ErrorMessage className="mb-4">{errorMessage}</ErrorMessage>
				) : null}
				<View className="mt-auto pt-8">
					<Button
						accessibilityLabel={isBusy ? "Weiter, wird geladen" : "Weiter"}
						accessibilityLiveRegion={isBusy ? "polite" : undefined}
						accessibilityState={{
							busy: isBusy,
							disabled: !trimmedAnswer || isBusy,
						}}
						disabled={!trimmedAnswer || isBusy}
						onPress={onContinue}
					>
						{isBusy ? (
							<ActivityIndicator color="#FFFFFF" />
						) : (
							<Text>Weiter</Text>
						)}
					</Button>
				</View>
			</Animated.View>
		</View>
	);
}
