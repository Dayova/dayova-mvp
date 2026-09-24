import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { SuccessConfirmationScreen } from "~/components/ui/success-confirmation-screen";
import { ThemedStatusBar } from "~/components/ui/themed-status-bar";
import { buildDateTimeLabel } from "~/lib/date-time-label";
import { ROUTES } from "~/lib/routes";

export default function EntrySuccessScreen() {
	const router = useRouter();
	const params = useLocalSearchParams<{
		type?: string;
		dayKey?: string;
		completionDateKey?: string;
		completionDateLabel?: string;
		completionTime?: string;
		examDateLabel?: string;
	}>();
	const isExam = params.type === "exam";
	const completionDateTimeLabel = useMemo(
		() =>
			buildDateTimeLabel({
				dateKey: params.completionDateKey,
				dateLabel: params.completionDateLabel,
				time: params.completionTime,
			}),
		[params],
	);
	const content = isExam
		? {
				title: "Deine Prüfung\nist eingetragen",
				detailLabel: "Prüfungstermin",
				detailValue: params.examDateLabel,
				description:
					"Ein Lernplan-Eintrag wurde angelegt. Lade dort Schulmaterial hoch, um deinen Lernplan zu erstellen.",
			}
		: {
				title: "Deine Hausaufgabe\nist eingetragen",
				detailLabel: "Erledigungsdatum",
				detailValue: completionDateTimeLabel,
				description: undefined,
			};

	const finish = () => {
		if (isExam) {
			router.replace(ROUTES.learningPlans);
			return;
		}
		router.replace(
			`/home${params.dayKey ? `?dayKey=${encodeURIComponent(params.dayKey)}` : ""}`,
		);
	};

	return (
		<>
			<Stack.Screen options={{ gestureEnabled: false }} />
			<ThemedStatusBar />
			<SuccessConfirmationScreen {...content} onFinish={finish} />
		</>
	);
}
