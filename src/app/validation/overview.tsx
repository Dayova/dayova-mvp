import {
	useConvexAuth,
	useMutation,
	useQuery_experimental as useQueryWithStatus,
} from "convex/react";
import { Stack, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Share, TouchableOpacity, View } from "react-native";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { ScreenHeader } from "~/components/screen-header";
import { ErrorMessage } from "~/components/ui/error-message";
import { Screen, ScreenScroll } from "~/components/ui/screen";
import { Surface } from "~/components/ui/surface";
import { Text } from "~/components/ui/text";
import { ThemedStatusBar } from "~/components/ui/themed-status-bar";
import { useAuthSession } from "~/context/AuthContext";
import { SESSION_EXECUTION_STATUS_LABEL } from "~/features/learning-plans/constants";
import { addDays, getDayKey } from "~/lib/day-key";
import { logDiagnosticError } from "~/lib/diagnostics";
import { goBackOrReplace } from "~/lib/navigation";
import { getUserFacingErrorMessage } from "~/lib/user-facing-errors";
import {
	ATTRIBUTION_LABEL,
	ATTRIBUTION_SOURCES,
	type AttributionSource,
} from "~/types/validation";

const csvCell = (value: unknown) => {
	const stringValue = String(value ?? "");
	const safeValue = /^[=+\-@]/.test(stringValue)
		? `'${stringValue}`
		: stringValue;
	return `"${safeValue.replaceAll('"', '""')}"`;
};

function PillButton({
	label,
	selected,
	disabled,
	onPress,
}: {
	label: string;
	selected?: boolean;
	disabled?: boolean;
	onPress: () => void;
}) {
	return (
		<TouchableOpacity
			accessibilityRole="button"
			accessibilityLabel={label}
			activeOpacity={0.84}
			disabled={disabled}
			onPress={onPress}
			className="rounded-full px-3 py-2"
			style={{
				backgroundColor: selected ? "#3A7BFF" : "#EEF4FF",
				opacity: disabled ? 0.55 : 1,
			}}
		>
			<Text
				className="font-poppins font-semibold"
				style={{
					color: selected ? "#FFFFFF" : "#3A7BFF",
					fontSize: 12,
					lineHeight: 16,
					includeFontPadding: false,
				}}
			>
				{label}
			</Text>
		</TouchableOpacity>
	);
}

function AttributionButton({
	source,
	selected,
	disabled,
	onPress,
}: {
	source: AttributionSource;
	selected: boolean;
	disabled: boolean;
	onPress: () => void;
}) {
	return (
		<PillButton
			label={ATTRIBUTION_LABEL[source]}
			selected={selected}
			disabled={disabled}
			onPress={onPress}
		/>
	);
}

export default function ValidationOverviewScreen() {
	const router = useRouter();
	const { user } = useAuthSession();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const [dayOffset, setDayOffset] = useState(0);
	const [pendingSessionId, setPendingSessionId] =
		useState<Id<"learningPlanSessions"> | null>(null);
	const dayKey = useMemo(
		() => getDayKey(addDays(new Date(), dayOffset)),
		[dayOffset],
	);
	const meState = useQueryWithStatus({
		query: api.users.getMe,
		args: user && isConvexAuthenticated ? {} : "skip",
	});
	const canReadOverview =
		meState.status === "success" && meState.data?.validationRole === "founder";
	const isMeLoading =
		Boolean(user && isConvexAuthenticated) && meState.status === "pending";
	const hasNoAccess =
		meState.status === "success" && meState.data?.validationRole !== "founder";
	const overviewState = useQueryWithStatus({
		query: api.validationAnalytics.dailyOverview,
		args: canReadOverview ? { dayKey } : "skip",
	});
	const overview =
		overviewState.status === "success" ? overviewState.data : undefined;
	const accessErrorMessage =
		meState.status === "error"
			? getUserFacingErrorMessage(
					meState.error,
					"Zugriff konnte nicht geprüft werden.",
					{
						source: "validation.overview.getMe",
						log: false,
					},
				)
			: null;
	const overviewErrorMessage =
		overviewState.status === "error"
			? getUserFacingErrorMessage(
					overviewState.error,
					"Die Validierungsübersicht konnte nicht geladen werden.",
					{
						source: "validation.overview.dailyOverview",
						log: false,
					},
				)
			: null;
	const recordAttribution = useMutation(
		api.validationAnalytics.recordAttribution,
	);

	const goBack = () => {
		goBackOrReplace(router, "/home");
	};

	const markAttribution = (
		sessionId: Id<"learningPlanSessions">,
		source: AttributionSource,
	) => {
		setPendingSessionId(sessionId);
		void recordAttribution({ sessionId, source })
			.catch((error: unknown) => {
				logDiagnosticError("Failed to record validation attribution.", error, {
					source: "validation.overview.recordAttribution",
					level: "warn",
				});
			})
			.finally(() => setPendingSessionId(null));
	};

	const shareCsv = () => {
		if (!overview) return;

		const header = [
			"day_key",
			"validation_student_code",
			"student_name",
			"subject",
			"exam_type",
			"session_title",
			"start_time",
			"duration_minutes",
			"status",
			"missed_reason",
			"attribution_source",
			"attribution_note",
		];
		const rows = overview.rows.map((row) =>
			[
				row.dateKey,
				row.validationStudentCode,
				row.studentName,
				row.subject,
				row.examTypeLabel,
				row.title,
				row.startTime,
				row.durationMinutes,
				row.status,
				row.missedReason,
				row.attribution?.source,
				row.attribution?.note,
			]
				.map(csvCell)
				.join(","),
		);

		void Share.share({
			message: [header.map(csvCell).join(","), ...rows].join("\n"),
			title: `Dayova validation ${overview.dayKey}`,
		});
	};

	return (
		<Screen>
			<Stack.Screen options={{ gestureEnabled: true }} />
			<ThemedStatusBar />
			<ScreenScroll
				contentInsetAdjustmentBehavior="automatic"
				horizontalPadding={24}
				topPadding={46}
				bottomPadding={120}
				contentContainerStyle={{ rowGap: 18 }}
			>
				<ScreenHeader title="Validation" onBack={goBack} className="mb-0" />

				<Surface className="rounded-[28px] px-5 py-5">
					<Text
						className="font-bold font-poppins text-[#202127]"
						style={{ fontSize: 24, lineHeight: 30, includeFontPadding: false }}
					>
						{dayKey}
					</Text>
					<View className="mt-4 flex-row" style={{ gap: 10 }}>
						<PillButton
							label="Gestern"
							onPress={() => setDayOffset((value) => value - 1)}
						/>
						<PillButton
							label="Heute"
							selected={dayOffset === 0}
							onPress={() => setDayOffset(0)}
						/>
						<PillButton
							label="Morgen"
							onPress={() => setDayOffset((value) => value + 1)}
						/>
					</View>
					<View className="mt-3 flex-row">
						<PillButton
							label="CSV teilen"
							disabled={!overview || overview.rows.length === 0}
							onPress={shareCsv}
						/>
					</View>
				</Surface>

				{isMeLoading ? (
					<View className="items-center py-8">
						<ActivityIndicator color="#3A7BFF" />
					</View>
				) : null}

				{accessErrorMessage ? (
					<Surface className="rounded-[24px] px-5 py-5">
						<ErrorMessage className="text-14">
							{accessErrorMessage}
						</ErrorMessage>
					</Surface>
				) : null}

				{hasNoAccess ? (
					<Surface className="rounded-[24px] px-5 py-5">
						<Text className="font-poppins text-14 text-[#6F727C]">
							Kein Zugriff auf die Validierungsübersicht.
						</Text>
					</Surface>
				) : null}

				{canReadOverview && overviewState.status === "pending" ? (
					<View className="items-center py-8">
						<ActivityIndicator color="#3A7BFF" />
					</View>
				) : null}

				{overviewErrorMessage ? (
					<Surface className="rounded-[24px] px-5 py-5">
						<ErrorMessage className="text-14">
							{overviewErrorMessage}
						</ErrorMessage>
					</Surface>
				) : null}

				{overview?.rows.map((row) => (
					<Surface
						key={row.sessionId}
						className="rounded-[24px] px-5 py-5"
						style={{ rowGap: 12 }}
					>
						<View
							className="flex-row items-start justify-between"
							style={{ gap: 12 }}
						>
							<View className="flex-1">
								<Text
									className="font-poppins font-semibold text-[#202127]"
									style={{
										fontSize: 16,
										lineHeight: 21,
										includeFontPadding: false,
									}}
								>
									{row.validationStudentCode ?? row.studentName ?? "Ohne Code"}
								</Text>
								<Text
									className="mt-1 font-poppins text-[#8D8F98]"
									style={{
										fontSize: 12,
										lineHeight: 17,
										includeFontPadding: false,
									}}
								>
									{`${row.subject} · ${row.examTypeLabel}`}
								</Text>
							</View>
							<View className="rounded-full bg-[#F2F3F6] px-3 py-2">
								<Text
									className="font-poppins font-semibold text-[#6F727C]"
									style={{
										fontSize: 11,
										lineHeight: 14,
										includeFontPadding: false,
									}}
								>
									{SESSION_EXECUTION_STATUS_LABEL[row.status]}
								</Text>
							</View>
						</View>

						<Text
							className="font-poppins text-[#6F727C]"
							style={{
								fontSize: 13,
								lineHeight: 18,
								includeFontPadding: false,
							}}
						>
							{`${row.startTime} · ${row.durationMinutes} Min. · ${row.title}`}
						</Text>

						<View className="flex-row flex-wrap" style={{ gap: 8 }}>
							{ATTRIBUTION_SOURCES.map((source) => (
								<AttributionButton
									key={source}
									source={source}
									selected={row.attribution?.source === source}
									disabled={pendingSessionId === row.sessionId}
									onPress={() => markAttribution(row.sessionId, source)}
								/>
							))}
						</View>
					</Surface>
				))}

				{overview && overview.rows.length === 0 ? (
					<Surface className="rounded-[24px] px-5 py-5">
						<Text className="text-center font-poppins text-14 text-[#6F727C]">
							Keine Lernblöcke für diesen Tag.
						</Text>
					</Surface>
				) : null}
			</ScreenScroll>
		</Screen>
	);
}
