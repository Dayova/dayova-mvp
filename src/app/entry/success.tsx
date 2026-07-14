import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { SuccessConfirmationScreen } from "~/components/ui/success-confirmation-screen";
import { ThemedStatusBar } from "~/components/ui/themed-status-bar";
import { buildDateTimeLabel } from "~/lib/date-time-label";

export default function EntrySuccessScreen() {
	const router = useRouter();
	const params = useLocalSearchParams<{
		dayKey?: string;
		completionDateKey?: string;
		completionDateLabel?: string;
		completionTime?: string;
	}>();
	const completionDateTimeLabel = useMemo(
		() =>
			buildDateTimeLabel({
				dateKey: params.completionDateKey,
				dateLabel: params.completionDateLabel,
				time: params.completionTime,
			}),
		[params],
	);

	const finish = () => {
		router.replace(
			`/home${params.dayKey ? `?dayKey=${encodeURIComponent(params.dayKey)}` : ""}`,
		);
	};

	return (
		<>
			<Stack.Screen options={{ gestureEnabled: false }} />
			<ThemedStatusBar />
			<SuccessConfirmationScreen
				title={"Deine Hausaufgabe\nist eingetragen"}
				detailLabel="Erledigungsdatum"
				detailValue={completionDateTimeLabel}
				onFinish={finish}
			/>
		</>
	);
}
