import { useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated";
import { Button } from "~/components/ui/button";
import { ErrorMessage } from "~/components/ui/error-message";
import { Check } from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
import { createAsyncActionGate } from "~/lib/async-action-gate";
import { useDayovaTheme } from "~/lib/theme";

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
	const [error, setError] = useState(false);
	const [saved, setSaved] = useState<boolean | null>(null);
	const reducedMotion = useReducedMotion();
	const label = completed ? "Als offen markieren" : "Als erledigt markieren";
	const save = () => {
		if (disabled) return;
		void gate.current.run(async () => {
			const next = !completed;
			setBusy(true);
			setError(false);
			setSaved(null);
			try {
				await onChange(next);
				setSaved(next);
			} catch {
				setError(true);
			} finally {
				setBusy(false);
			}
		});
	};
	return (
		<View className="mt-5 gap-3">
			<Button
				variant={completed ? "neutral" : "default"}
				onPress={save}
				disabled={disabled || busy}
				accessibilityLabel={busy ? "Wird gespeichert" : label}
				accessibilityState={{ busy, disabled: disabled || busy }}
			>
				{busy ? (
					<ActivityIndicator color={iconColor} />
				) : (
					<Check size={18} color={iconColor} strokeWidth={2.3} />
				)}
				<Text>{busy ? "Wird gespeichert …" : label}</Text>
			</Button>
			{error ? (
				<ErrorMessage>
					Der Status konnte nicht gespeichert werden. Bitte versuche es erneut.
				</ErrorMessage>
			) : null}
			{saved !== null && saved === completed ? (
				<Animated.View
					entering={reducedMotion ? undefined : FadeIn.duration(180)}
				>
					<Text
						accessibilityLiveRegion="polite"
						className="text-center font-poppins text-body-4 text-secondary-text"
					>
						{saved ? "Als erledigt markiert." : "Wieder offen."}
					</Text>
				</Animated.View>
			) : null}
		</View>
	);
}
