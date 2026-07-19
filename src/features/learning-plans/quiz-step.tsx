import { useEffect, useState } from "react";
import { ActivityIndicator, Animated, Easing, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { Textarea } from "~/components/ui/textarea";
import type { QuizQuestion } from "~/features/learning-plans/types";
import { formatGermanUiText } from "~/lib/german-ui-text";

export function QuizStep({
	question,
	answer,
	errorMessage,
	isBusy,
	onAnswerChange,
	onContinue,
}: {
	question: QuizQuestion;
	answer: string;
	errorMessage: string | null;
	isBusy: boolean;
	onAnswerChange: (value: string) => void;
	onContinue: () => void;
}) {
	const trimmedAnswer = answer.trim();
	const questionId = question.id;
	const prompt = formatGermanUiText(question.prompt);
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
				<Text className="pt-11 font-poppins font-semibold text-body-1 text-text">
					{prompt}
				</Text>
				<Textarea
					autoFocus
					accessibilityLabel="Antwort"
					className="mt-4 min-h-[180px] flex-1 py-2"
					value={answer}
					onChangeText={onAnswerChange}
					placeholder="Schreibe hier deine Antwort."
				/>
				{errorMessage ? (
					<Text className="mt-4 font-poppins text-body-4 text-destructive">
						{errorMessage}
					</Text>
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
