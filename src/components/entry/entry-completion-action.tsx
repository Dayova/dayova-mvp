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
const PERSISTENCE_WAIT_TIMEOUT_MS = 10_000;
const COMPLETE_ACTION_LABEL = "Als erledigt markieren";
const contentEntering = FadeInDown.duration(240)
	.delay(90)
	.easing(Easing.out(Easing.cubic))
	.withInitialValues({ transform: [{ translateY: 12 }] });
const contentExiting = FadeOutUp.duration(140)
	.easing(Easing.in(Easing.cubic))
	.withTargetValues({ transform: [{ translateY: -12 }] });

/** The caller owns persisted state; feedback never optimistically completes an entry. */
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
	const [saved, setSaved] = useState<boolean | null>(null);
	const [hasSubmitted, setHasSubmitted] = useState(false);
	const confirmationShown = useRef(false);
	const previousCompleted = useRef(completed);
	const reducedMotion = useReducedMotion();
	const confirming = saved !== null && saved === completed;
	const saving = busy || (saved !== null && !confirming);
	const actionDisabled = disabled || saving || confirming;
	const actionLabel = completed ? "Als offen markieren" : COMPLETE_ACTION_LABEL;
	const confirmationLabel = completed
		? "Als erledigt markiert."
		: "Wieder offen.";
	const label = saving
		? "Wird gespeichert …"
		: confirming
			? confirmationLabel
			: actionLabel;

	useEffect(() => {
		if (previousCompleted.current !== completed) {
			previousCompleted.current = completed;
			setError(null);
		}
		if (saved === null) {
			confirmationShown.current = false;
			return;
		}
		if (saved !== completed) {
			// A later external update must not replay this acknowledgement.
			if (confirmationShown.current) {
				setSaved(null);
				return;
			}
			const timeout = setTimeout(() => {
				setSaved(null);
				setError(
					"Der Status konnte noch nicht bestätigt werden. Bitte versuche es erneut.",
				);
			}, PERSISTENCE_WAIT_TIMEOUT_MS);
			return () => clearTimeout(timeout);
		}
		confirmationShown.current = true;
		const timeout = setTimeout(() => setSaved(null), CONFIRMATION_DURATION_MS);
		return () => clearTimeout(timeout);
	}, [completed, saved]);

	const save = () => {
		if (actionDisabled) return;
		void gate.current.run(async () => {
			const next = !completed;
			confirmationShown.current = false;
			setHasSubmitted(true);
			setBusy(true);
			setError(null);
			setSaved(null);
			try {
				await onChange(next);
				setSaved(next);
			} catch {
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
				className={confirming ? "opacity-100" : undefined}
				onPress={save}
				disabled={actionDisabled}
				accessibilityLabel={saving ? "Wird gespeichert" : label}
				accessibilityLiveRegion="polite"
				accessibilityState={{ busy: saving, disabled: actionDisabled }}
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
						{saving ? (
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
