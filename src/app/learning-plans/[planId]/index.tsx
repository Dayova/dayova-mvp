import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { TouchableOpacity, View, type ViewStyle } from "react-native";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { ScreenHeader } from "~/components/screen-header";
import { Check, CircleAlert, Clock3, Route2 } from "~/components/ui/icon";
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
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";

const PHASE_LABEL: Record<PlanSession["phase"], string> = {
	theory: "Theorie",
	practice: "Üben",
	rehearsal: "Testmodus",
};

const sessionsScrollContentStyle = { rowGap: 24 } satisfies ViewStyle;

function SessionOverviewCard({
	session,
	onToggleCompleted,
}: {
	session: PlanSession;
	onToggleCompleted: () => void;
}) {
	const endTime = timeFromMinutes(
		minutesFromTime(session.startTime) + session.durationMinutes,
	);

	const title = formatGermanUiText(session.title);
	const goal = formatGermanUiText(session.goal);

	return (
		<Surface className="gap-4 rounded-[28px] px-5 py-5">
			<View className="flex-row items-start justify-between gap-4">
				<View className="flex-1">
					<Text className="font-poppins font-semibold text-body-2 text-foreground">
						{title}
					</Text>
					<Text className="mt-2 font-poppins text-body-4 text-muted-foreground">
						{PHASE_LABEL[session.phase]}
					</Text>
				</View>
				<View className="rounded-full bg-accent px-3 py-2">
					<Text className="font-poppins font-semibold text-body-4 text-primary">
						{`${session.durationMinutes} Min.`}
					</Text>
				</View>
			</View>

			<View className="flex-row items-center gap-2">
				<Clock3
					size={16}
					color={DAYOVA_DESIGN_SYSTEM.colors.textMuted}
					strokeWidth={2.1}
				/>
				<Text className="font-poppins text-body-4 text-muted-foreground">
					{`${session.dateLabel} · ${session.startTime} - ${endTime}`}
				</Text>
			</View>

			<Text className="font-poppins text-body-4 text-muted-foreground">
				{goal}
			</Text>

			<TouchableOpacity
				accessibilityRole="button"
				accessibilityLabel={
					session.completed
						? "Lerneinheit als offen markieren"
						: "Lerneinheit als erledigt markieren"
				}
				activeOpacity={0.84}
				onPress={onToggleCompleted}
				className={`mt-1 flex-row items-center justify-center gap-2 rounded-full px-4 py-3 ${session.completed ? "bg-button-neutral" : "bg-primary"}`}
			>
				<Check
					size={16}
					color={session.completed ? "#1A1A1A" : "#FFFFFF"}
					strokeWidth={2.2}
				/>
				<Text
					className={`font-poppins font-semibold text-body-4 ${session.completed ? "text-foreground" : "text-white"}`}
				>
					{session.completed ? "Als offen markieren" : "Als erledigt markieren"}
				</Text>
			</TouchableOpacity>
		</Surface>
	);
}

export default function LearningPlanSessionsScreen() {
	const router = useRouter();
	const params = useLocalSearchParams<{ planId?: string }>();
	const planId = params.planId as Id<"learningPlans"> | undefined;
	const { user } = useAuth();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const setSessionCompleted = useMutation(
		api.learningPlans.setSessionCompleted,
	);
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
				// KeyboardSafeScrollView requires content layout through style.
				contentContainerStyle={sessionsScrollContentStyle}
			>
				<ScreenHeader title="Lernplan" onBack={goBack} className="mb-0" />

				<Surface className="rounded-[34px] px-5 py-6">
					<View className="mb-5 h-14 w-14 items-center justify-center rounded-full bg-secondary/15">
						<Route2
							size={27}
							color={DAYOVA_DESIGN_SYSTEM.colors.primary}
							strokeWidth={2.2}
						/>
					</View>
					<Text className="font-poppins font-semibold text-foreground text-heading-2">
						{title}
					</Text>
					<Text className="mt-2 font-poppins text-body-4 text-muted-foreground">
						{snapshot
							? `${snapshot.sessions.length} ${
									snapshot.sessions.length === 1
										? "Lerneinheit"
										: "Lerneinheiten"
								}`
							: "Lerneinheiten werden geladen"}
					</Text>
				</Surface>

				{snapshot?.plan.planningHint ? (
					<Surface className="flex-row gap-3 rounded-[24px] px-5 py-4">
						<CircleAlert
							size={20}
							color={DAYOVA_DESIGN_SYSTEM.colors.warning}
							strokeWidth={2.2}
						/>
						<Text className="flex-1 font-poppins text-body-4 text-warning-foreground">
							{snapshot.plan.planningHint}
						</Text>
					</Surface>
				) : null}

				<View className="gap-4">
					{snapshot?.sessions.map((session) => (
						<SessionOverviewCard
							key={session.id}
							session={session}
							onToggleCompleted={() =>
								void setSessionCompleted({
									sessionId: session.id,
									completed: !session.completed,
								})
							}
						/>
					))}
				</View>

				{snapshot && snapshot.sessions.length === 0 ? (
					<View className="items-center rounded-[28px] bg-card px-5 py-7">
						<Text className="text-center font-poppins font-semibold text-foreground">
							Keine Lerneinheiten vorhanden
						</Text>
					</View>
				) : null}
			</ScreenScroll>
		</Screen>
	);
}
