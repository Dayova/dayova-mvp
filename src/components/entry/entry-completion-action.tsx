import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import Animated, {
	Easing,
	FadeInDown,
	FadeOutUp,
	useReducedMotion,
} from "react-native-reanimated";
import { Button } from "~/components/ui/button";
import { ErrorMessage } from "~/components/ui/error-message";
import { Check } from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
import { createAsyncActionGate } from "~/lib/async-action-gate";
import { useDayovaTheme } from "~/lib/theme";

const CONFIRMATION_DURATION_MS = 1_400;
const COMPLETE_ACTION_LABEL = "Als erledigt markieren";
const contentEntering = FadeInDown.duration(240)
	.delay(90)
	.easing(Easing.out(Easing.cubic))
	.withInitialValues({ transform: [{ translateY: 12 }] });
const contentExiting = FadeOutUp.duration(140)
	.easing(Easing.in(Easing.cubic))
	.withTargetValues({ transform: [{ translateY: -12 }] });

/** The caller owns the optimistic query result and Convex owns its rollback. */
export function EntryCompletionAction({
	completed,
	disabled = false,
	onChange,
}: {
	completed: boolean;
	disabled?: boolean;
	onChange: (completed: boolean) => Promise<unknown>;
}) {
	const { colors } = useDayovaTheme();
	const iconColor = completed ? colors.background : "#FFFFFF";
	const gate = useRef(createAsyncActionGate());
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [feedback, setFeedback] = useState<boolean | null>(null);
	const [hasSubmitted, setHasSubmitted] = useState(false);
	const reducedMotion = useReducedMotion();
	const transitioning = feedback !== null && (busy || feedback === completed);
	const actionDisabled = disabled || busy || transitioning;
	const actionLabel = completed ? "Als offen markieren" : COMPLETE_ACTION_LABEL;
	const label = transitioning
		? feedback
			? "Als erledigt markiert."
			: "Wieder offen."
		: actionLabel;

	useEffect(() => {
		if (feedback === null) return;
		const timeout = setTimeout(
			() => setFeedback(null),
			CONFIRMATION_DURATION_MS,
		);
		return () => clearTimeout(timeout);
	}, [feedback]);

	const save = () => {
		if (actionDisabled) return;
		void gate.current.run(async () => {
			const next = !completed;
			setFeedback(next);
			setHasSubmitted(true);
			setBusy(true);
			setError(null);
			try {
				await onChange(next);
			} catch {
				setFeedback(null);
				setError(
					"Der Status konnte nicht gespeichert werden. Bitte versuche es erneut.",
				);
			} finally {
				setBusy(false);
			}
		});
	};
	return (
		<View className="mt-5 gap-3">
			<Button
				variant={completed ? "neutral" : "default"}
				className={busy || transitioning ? "opacity-100" : undefined}
				onPress={save}
				disabled={actionDisabled}
				accessibilityLabel={busy ? `${label} Wird gespeichert.` : label}
				accessibilityHint={
					busy ? "Die Änderung wird noch gespeichert." : undefined
				}
				accessibilityLiveRegion="polite"
				accessibilityState={{ busy, disabled: actionDisabled }}
			>
				<View className="w-full" collapsable={false}>
					{/* Reserve the longest label's height, including at large text sizes. */}
					<View
						className="flex-row items-center justify-center gap-2 opacity-0"
						accessibilityElementsHidden
						importantForAccessibility="no-hide-descendants"
						pointerEvents="none"
					>
						<View className="h-[18px] w-[18px] shrink-0" />
						<Text className="shrink text-center">{COMPLETE_ACTION_LABEL}</Text>
					</View>
					<Animated.View
						key={label}
						className="absolute inset-0 flex-row items-center justify-center gap-2"
						entering={
							reducedMotion || !hasSubmitted ? undefined : contentEntering
						}
						exiting={reducedMotion ? undefined : contentExiting}
					>
						{busy ? (
							<ActivityIndicator color={iconColor} />
						) : (
							<Check size={18} color={iconColor} strokeWidth={2.3} />
						)}
						<Text className="shrink text-center">{label}</Text>
					</Animated.View>
				</View>
			</Button>
			{error ? <ErrorMessage>{error}</ErrorMessage> : null}
		</View>
	);
}
