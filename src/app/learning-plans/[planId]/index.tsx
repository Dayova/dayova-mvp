import { useConvexAuth, useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { ScreenHeader } from "~/components/screen-header";
import { Clock3, Route2 } from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
import { useAuth } from "~/context/AuthContext";
import type {
	LearningPlanSnapshot,
	PlanSession,
} from "~/features/learning-plans/types";
import {
	minutesFromTime,
	timeFromMinutes,
} from "~/features/learning-plans/utils";
import { goBackOrReplace } from "~/lib/navigation";

const PHASE_LABEL: Record<PlanSession["phase"], string> = {
	theory: "Theorie",
	practice: "Üben",
	rehearsal: "Testmodus",
};

function SessionOverviewCard({ session }: { session: PlanSession }) {
	const endTime = timeFromMinutes(
		minutesFromTime(session.startTime) + session.durationMinutes,
	);

	return (
		<View
			className="rounded-[28px] bg-white px-5 py-5"
			style={{
				borderWidth: 1,
				borderColor: "rgba(17,24,39,0.05)",
				boxShadow: "0 14px 28px rgba(21, 29, 48, 0.08)",
				rowGap: 14,
			}}
		>
			<View className="flex-row items-start justify-between" style={{ gap: 14 }}>
				<View className="flex-1">
					<Text
						className="font-poppins font-semibold text-[#202127]"
						style={{ fontSize: 16, lineHeight: 21, includeFontPadding: false }}
					>
						{session.title}
					</Text>
					<Text
						className="mt-2 font-poppins text-[#8D8F98]"
						style={{ fontSize: 12, lineHeight: 17, includeFontPadding: false }}
					>
						{PHASE_LABEL[session.phase]}
					</Text>
				</View>
				<View className="rounded-full bg-[#EEF4FF] px-3 py-2">
					<Text
						className="font-poppins font-semibold text-[#3A7BFF]"
						style={{ fontSize: 12, lineHeight: 15, includeFontPadding: false }}
					>
						{`${session.durationMinutes} min`}
					</Text>
				</View>
			</View>

			<View className="flex-row items-center" style={{ columnGap: 8 }}>
				<Clock3 size={16} color="#9A9DA8" strokeWidth={2.1} />
				<Text
					className="font-poppins text-[#6F727C]"
					style={{ fontSize: 13, lineHeight: 18, includeFontPadding: false }}
				>
					{`${session.dateLabel} · ${session.startTime} - ${endTime}`}
				</Text>
			</View>

			<Text
				className="font-poppins text-[#6F727C]"
				style={{ fontSize: 13, lineHeight: 19, includeFontPadding: false }}
			>
				{session.goal}
			</Text>
		</View>
	);
}

export default function LearningPlanSessionsScreen() {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const params = useLocalSearchParams<{ planId?: string }>();
	const planId = params.planId as Id<"learningPlans"> | undefined;
	const { user } = useAuth();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const snapshot = (useQuery(
		api.learningPlans.getSnapshot,
		user && isConvexAuthenticated && planId ? { id: planId } : "skip",
	) ?? null) as LearningPlanSnapshot | null;

	const goBack = () => {
		goBackOrReplace(router, "/learning-plans");
	};

	return (
		<View className="flex-1 bg-[#F6F4F7]">
			<Stack.Screen options={{ gestureEnabled: true }} />
			<StatusBar style="dark" />
			<ScrollView
				className="flex-1"
				contentInsetAdjustmentBehavior="automatic"
				contentContainerStyle={{
					paddingHorizontal: 24,
					paddingTop: Math.max(insets.top + 22, 46),
					paddingBottom: Math.max(insets.bottom + 90, 120),
					rowGap: 24,
				}}
				showsVerticalScrollIndicator={false}
			>
				<ScreenHeader title="Lernplan" onBack={goBack} className="mb-0" />

				<View
					className="rounded-[34px] bg-white px-5 py-6"
					style={{
						borderWidth: 1,
						borderColor: "rgba(17,24,39,0.05)",
						boxShadow: "0 16px 32px rgba(21, 29, 48, 0.08)",
					}}
				>
					<View className="mb-5 h-14 w-14 items-center justify-center rounded-full bg-[#FFEAF8]">
						<Route2 size={27} color="#FF42C8" strokeWidth={2.2} />
					</View>
					<Text
						className="font-bold font-poppins text-[#202127]"
						style={{ fontSize: 25, lineHeight: 30, includeFontPadding: false }}
					>
						{snapshot
							? `${snapshot.plan.subject} ${snapshot.plan.examTypeLabel}`.trim()
							: "Lernplan"}
					</Text>
					<Text
						className="mt-2 font-poppins text-[#8D8F98]"
						style={{ fontSize: 13, lineHeight: 19, includeFontPadding: false }}
					>
						{snapshot
							? `${snapshot.sessions.length} ${
									snapshot.sessions.length === 1 ? "Lerneinheit" : "Lerneinheiten"
								}`
							: "Lerneinheiten werden geladen"}
					</Text>
				</View>

				<View style={{ rowGap: 14 }}>
					{snapshot?.sessions.map((session) => (
						<SessionOverviewCard key={session.id} session={session} />
					))}
				</View>

				{snapshot && snapshot.sessions.length === 0 ? (
					<View className="items-center rounded-[28px] bg-white px-5 py-7">
						<Text className="text-center font-poppins font-semibold text-[#202127]">
							Keine Lerneinheiten vorhanden
						</Text>
					</View>
				) : null}
			</ScrollView>
		</View>
	);
}
