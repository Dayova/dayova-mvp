import type { ReactNode } from "react";
import { useCallback, useEffect } from "react";
import { I18nManager, Keyboard, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
	Easing,
	interpolate,
	useAnimatedStyle,
	useReducedMotion,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { shouldCommitRegistrationEdgeBack } from "~/lib/registration-navigation";

const EDGE_ACTIVATION_DISTANCE = 12;
const EDGE_VERTICAL_FAILURE_DISTANCE = 16;
const COMMIT_PREVIEW_MAX_DISTANCE = 112;

const dismissKeyboard = () => Keyboard.dismiss();

type OnboardingEdgeBackGestureProps = {
	children: ReactNode;
	enabled: boolean;
	onBack: () => void;
};

function OnboardingEdgeBackGesture({
	children,
	enabled,
	onBack,
}: OnboardingEdgeBackGestureProps) {
	const { width } = useWindowDimensions();
	const reducedMotion = useReducedMotion();
	const translateX = useSharedValue(0);
	const isCommitting = useSharedValue(false);
	const direction = I18nManager.isRTL ? -1 : 1;

	const commitBack = useCallback(() => {
		translateX.set(0);
		onBack();
	}, [onBack, translateX]);

	useEffect(() => {
		if (enabled) return;
		isCommitting.set(false);
		translateX.set(0);
	}, [enabled, isCommitting, translateX]);

	const gesture = Gesture.Pan()
		.enabled(enabled)
		.activeOffsetX(
			direction > 0
				? [-4, EDGE_ACTIVATION_DISTANCE]
				: [-EDGE_ACTIVATION_DISTANCE, 4],
		)
		.failOffsetY([
			-EDGE_VERTICAL_FAILURE_DISTANCE,
			EDGE_VERTICAL_FAILURE_DISTANCE,
		])
		.enableTrackpadTwoFingerGesture(true)
		.onBegin(() => {
			isCommitting.set(false);
		})
		.onStart(() => {
			scheduleOnRN(dismissKeyboard);
		})
		.onUpdate((event) => {
			const directionalTranslation = Math.max(
				event.translationX * direction,
				0,
			);
			translateX.set(
				direction * Math.min(directionalTranslation, width * 0.34),
			);
		})
		.onEnd((event) => {
			const shouldCommit = shouldCommitRegistrationEdgeBack({
				direction,
				translationX: event.translationX,
				velocityX: event.velocityX,
				viewportWidth: width,
			});

			if (!shouldCommit) {
				translateX.set(
					withTiming(0, {
						duration: reducedMotion ? 0 : 180,
						easing: Easing.out(Easing.cubic),
					}),
				);
				return;
			}

			isCommitting.set(true);
			const commitDistance =
				direction * Math.min(width * 0.28, COMMIT_PREVIEW_MAX_DISTANCE);
			translateX.set(
				withTiming(
					commitDistance,
					{
						duration: reducedMotion ? 0 : 120,
						easing: Easing.out(Easing.cubic),
					},
					(finished) => {
						if (finished) scheduleOnRN(commitBack);
					},
				),
			);
		})
		.onFinalize(() => {
			if (isCommitting.get()) return;
			translateX.set(
				withTiming(0, {
					duration: reducedMotion ? 0 : 180,
					easing: Easing.out(Easing.cubic),
				}),
			);
		});

	const animatedStyle = useAnimatedStyle(() => {
		const distance = Math.abs(translateX.get());
		return {
			opacity: interpolate(distance, [0, width * 0.34], [1, 0.92], "clamp"),
			transform: [{ translateX: translateX.get() }],
		};
	});

	return (
		<View className="flex-1">
			<Animated.View className="flex-1" style={animatedStyle}>
				{children}
			</Animated.View>
			{enabled ? (
				<GestureDetector gesture={gesture} userSelect="none">
					<View
						collapsable={false}
						accessible={false}
						importantForAccessibility="no"
						testID="onboarding-ios-edge-back"
						className={
							I18nManager.isRTL
								? "absolute top-0 right-0 bottom-0 w-7"
								: "absolute top-0 bottom-0 left-0 w-7"
						}
					/>
				</GestureDetector>
			) : null}
		</View>
	);
}

export { OnboardingEdgeBackGesture };
