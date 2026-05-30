import { useConvexAuth, useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { ScreenHeader } from "~/components/screen-header";
import { Clock3, Route2 } from "~/components/ui/icon";
import { Screen, ScreenScroll } from "~/components/ui/screen";
import { Surface } from "~/components/ui/surface";
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
import { formatGermanUiText } from "~/lib/german-ui-text";
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

	const title = formatGermanUiText(session.title);
	const goal = formatGermanUiText(session.goal);

	return (
		<Surface className="rounded-[28px] px-5 py-5" style={{ rowGap: 14 }}>
			<View
				className="flex-row items-start justify-between"
				style={{ gap: 14 }}
			>
				<View className="flex-1">
					<Text
						className="font-poppins font-semibold text-[#202127]"
						style={{ fontSize: 16, lineHeight: 21, includeFontPadding: false }}
					>
						{title}
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
				{goal}
			</Text>
		</Surface>
	);
}

export default function LearningPlanSessionsScreen() {
	const router = useRouter();
	const params = useLocalSearchParams<{ planId?: string }>();
	const planId = params.planId as Id<"learningPlans"> | undefined;
	const { user } = useAuth();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const snapshot = (useQuery(
		api.learningPlans.getSnapshot,
		user && isConvexAuthenticated && planId ? { id: planId } : "skip",
	) ?? null) as LearningPlanSnapshot | null;

	const title = snapshot
		? formatGermanUiText(
				`${snapshot.plan.subject} ${snapshot.plan.examTypeLabel}`.trim(),
			)
		: "Lernplan";

	const goBack = () => {
		goBackOrReplace(router, "/learning-plans");
	};

	return (
		<Screen>
			<Stack.Screen options={{ gestureEnabled: true }} />
			<StatusBar style="dark" />
			<ScreenScroll
				contentInsetAdjustmentBehavior="automatic"
				horizontalPadding={24}
				topPadding={46}
				bottomPadding={120}
				contentContainerStyle={{ rowGap: 24 }}
			>
				<ScreenHeader title="Lernplan" onBack={goBack} className="mb-0" />

				<Surface className="rounded-[34px] px-5 py-6">
					<View className="mb-5 h-14 w-14 items-center justify-center rounded-full bg-[#FFEAF8]">
						<Route2 size={27} color="#FF42C8" strokeWidth={2.2} />
					</View>
					<Text
						className="font-bold font-poppins text-[#202127]"
						style={{ fontSize: 25, lineHeight: 30, includeFontPadding: false }}
					>
						{title}
					</Text>
					<Text
						className="mt-2 font-poppins text-[#8D8F98]"
						style={{ fontSize: 13, lineHeight: 19, includeFontPadding: false }}
					>
						{snapshot
							? `${snapshot.sessions.length} ${
									snapshot.sessions.length === 1
										? "Lerneinheit"
										: "Lerneinheiten"
								}`
							: "Lerneinheiten werden geladen"}
					</Text>
				</Surface>

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
			</ScreenScroll>
		</Screen>
	);
}
