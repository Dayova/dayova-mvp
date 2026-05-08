import { useEffect, useState } from "react";
import { ActivityIndicator, Animated, Easing, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { Textarea } from "~/components/ui/textarea";
import type { QuizQuestion } from "~/features/learning-plans/types";

const ANSWER_TEXTAREA_HEIGHT = 176;
const ANSWER_TEXTAREA_CARD_HEIGHT = 206;
const QUESTION_PROGRESS_SIZE = 72;
const QUESTION_PROGRESS_RADIUS = QUESTION_PROGRESS_SIZE / 2;
const QUESTION_PROGRESS_CENTER = QUESTION_PROGRESS_SIZE / 2;

const getQuestionProgressPath = (progress: number) => {
	const normalizedProgress = Math.max(0, Math.min(progress, 1));
	if (normalizedProgress >= 1) return null;

	const angle = normalizedProgress * 2 * Math.PI - Math.PI / 2;
	const endX =
		QUESTION_PROGRESS_CENTER + QUESTION_PROGRESS_RADIUS * Math.cos(angle);
	const endY =
		QUESTION_PROGRESS_CENTER + QUESTION_PROGRESS_RADIUS * Math.sin(angle);
	const largeArcFlag = normalizedProgress > 0.5 ? 1 : 0;

	return [
		`M ${QUESTION_PROGRESS_CENTER} ${QUESTION_PROGRESS_CENTER}`,
		`L ${QUESTION_PROGRESS_CENTER} 0`,
		`A ${QUESTION_PROGRESS_RADIUS} ${QUESTION_PROGRESS_RADIUS} 0 ${largeArcFlag} 1 ${endX} ${endY}`,
		"Z",
	].join(" ");
};

export function QuizStep({
	question,
	questionIndex,
	questionCount,
	answer,
	errorMessage,
	isBusy,
	onAnswerChange,
	onContinue,
}: {
	question: QuizQuestion;
	questionIndex: number;
	questionCount: number;
	answer: string;
	errorMessage: string | null;
	isBusy: boolean;
	onAnswerChange: (value: string) => void;
	onContinue: () => void;
}) {
	const questionNumber = questionIndex + 1;
	const questionProgress =
		questionCount > 0 ? questionNumber / questionCount : 0;
	const questionProgressPath = getQuestionProgressPath(questionProgress);
	const trimmedAnswer = answer.trim();
	const questionId = question.id;
	const [transition] = useState(() => new Animated.Value(1));

	useEffect(() => {
		if (!questionId) return;

		transition.setValue(0);
		Animated.timing(transition, {
			toValue: 1,
			duration: 280,
			easing: Easing.out(Easing.cubic),
			useNativeDriver: true,
		}).start();
	}, [questionId, transition]);

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
				<View className="mb-7 items-center">
					<View
						className="items-center justify-center overflow-hidden rounded-full bg-primary/55"
						style={{
							width: QUESTION_PROGRESS_SIZE,
							height: QUESTION_PROGRESS_SIZE,
						}}
					>
						<Svg
							width={QUESTION_PROGRESS_SIZE}
							height={QUESTION_PROGRESS_SIZE}
							style={{ position: "absolute" }}
							viewBox={`0 0 ${QUESTION_PROGRESS_SIZE} ${QUESTION_PROGRESS_SIZE}`}
						>
							{questionProgressPath ? (
								<Path d={questionProgressPath} fill="#3A7BFF" />
							) : (
								<Circle
									cx={QUESTION_PROGRESS_CENTER}
									cy={QUESTION_PROGRESS_CENTER}
									r={QUESTION_PROGRESS_RADIUS}
									fill="#3A7BFF"
								/>
							)}
						</Svg>
						<Text className="font-bold font-poppins text-24 text-white">
							{questionNumber}
						</Text>
					</View>
				</View>
				<Text className="font-poppins text-12 text-text/45">
					Frage {questionNumber} von {questionCount}
				</Text>
				<Text className="mt-2 font-bold font-poppins text-18 text-text">
					{question.prompt}
				</Text>
				<Text className="mt-7 mb-3 font-poppins font-semibold text-12 text-text">
					Antwort
				</Text>
				<View
					className="mb-8 items-start rounded-[28px] bg-white px-[18px] pt-[14px] pb-4"
					style={{ height: ANSWER_TEXTAREA_CARD_HEIGHT }}
				>
					<Textarea
						value={answer}
						onChangeText={onAnswerChange}
						placeholder="Schreibe hier deine Antwort rein..."
						style={{ height: ANSWER_TEXTAREA_HEIGHT }}
					/>
				</View>
				{errorMessage ? (
					<Text className="mb-4 font-poppins text-12 text-destructive">
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
