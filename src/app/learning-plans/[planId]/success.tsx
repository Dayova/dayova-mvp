import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo } from "react";
import { SuccessConfirmationScreen } from "~/components/ui/success-confirmation-screen";
import { buildDateTimeLabel } from "~/lib/date-time-label";

export default function LearningPlanSuccessScreen() {
	const router = useRouter();
	const params = useLocalSearchParams<{
		dayKey?: string;
		examDateKey?: string;
		examDateLabel?: string;
		examTime?: string;
	}>();
	const examDateTimeLabel = useMemo(
		() =>
			buildDateTimeLabel({
				dateKey: params.examDateKey,
				dateLabel: params.examDateLabel,
				time: params.examTime,
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
			<StatusBar style="dark" />
			<SuccessConfirmationScreen
				title={"Dein Lernplan\nwurde erstellt."}
				detailLabel="Prüfungsdatum"
				detailValue={examDateTimeLabel}
				onFinish={finish}
			/>
		</>
	);
}
