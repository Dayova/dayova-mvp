import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo } from "react";
import { useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "~/components/ui/button";
import { Check } from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";

const normalizeDateLabel = (dateLabel?: string) => {
	const trimmed = dateLabel?.trim();
	if (!trimmed) return "";

	return trimmed.replace(/\s+\d{4}$/, "").replace(/^(\d{1,2})\.\s/u, "$1 ");
};

const parseCalendarDateKey = (dateKey?: string) => {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey ?? "");
	if (!match) return null;

	const year = Number(match[1]);
	const monthIndex = Number(match[2]) - 1;
	const day = Number(match[3]);
	const parsed = new Date(year, monthIndex, day);

	return parsed.getFullYear() === year &&
		parsed.getMonth() === monthIndex &&
		parsed.getDate() === day
		? parsed
		: null;
};

const formatDateFromKey = (dateKey?: string) => {
	const parsed = parseCalendarDateKey(dateKey);
	if (!parsed) return "";

	return new Intl.DateTimeFormat("de-DE", {
		day: "numeric",
		month: "long",
	})
		.format(parsed)
		.replace(/^(\d{1,2})\.\s/u, "$1 ");
};

const buildExamDateTimeLabel = ({
	examDateKey,
	examDateLabel,
	examTime,
}: {
	examDateKey?: string;
	examDateLabel?: string;
	examTime?: string;
}) => {
	const dateLabel =
		normalizeDateLabel(examDateLabel) || formatDateFromKey(examDateKey);
	const timeLabel = examTime?.trim();

	return [dateLabel, timeLabel].filter(Boolean).join(", ");
};

export default function LearningPlanSuccessScreen() {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const { height } = useWindowDimensions();
	const params = useLocalSearchParams<{
		dayKey?: string;
		examDateKey?: string;
		examDateLabel?: string;
		examTime?: string;
	}>();
	const examDateTimeLabel = useMemo(
		() => buildExamDateTimeLabel(params),
		[params],
	);
	const successMarkTop = Math.max(152, Math.min(224, height * 0.235));
	const headlineTopMargin = Math.max(72, Math.min(80, height * 0.085));
	const buttonBottomPadding = Math.max(insets.bottom + 28, 64);

	const finish = () => {
		router.replace(
			`/home${params.dayKey ? `?dayKey=${encodeURIComponent(params.dayKey)}` : ""}`,
		);
	};

	return (
		<View className="flex-1 bg-background px-7">
			<Stack.Screen options={{ gestureEnabled: false }} />
			<StatusBar style="dark" />

			<View className="items-center" style={{ paddingTop: successMarkTop }}>
				<View className="h-36 w-36 items-center justify-center rounded-full bg-success-subtle">
					<Check
						size={64}
						color={DAYOVA_DESIGN_SYSTEM.colors.success}
						strokeWidth={2.2}
					/>
				</View>

				<Text
					accessibilityRole="header"
					className="text-center font-poppins font-semibold text-heading-1 text-text"
					style={{ marginTop: headlineTopMargin }}
				>
					Dein Lernplan{"\n"}wurde erstellt.
				</Text>

				<View className="mt-6 items-center">
					<Text className="text-center font-poppins text-body-2 text-text">
						Prüfungsdatum
					</Text>
					{examDateTimeLabel ? (
						<Text
							selectable
							className="text-center font-poppins text-body-2 text-secondary-text"
						>
							{examDateTimeLabel}
						</Text>
					) : null}
				</View>
			</View>

			<View
				className="absolute right-0 bottom-0 left-0 px-7"
				style={{ paddingBottom: buttonBottomPadding }}
			>
				<Button accessibilityLabel="Fertig" className="w-full" onPress={finish}>
					<Text>Fertig</Text>
				</Button>
			</View>
		</View>
	);
}
