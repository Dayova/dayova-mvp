import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { BackButton, Button } from "~/components/ui/button";
import {
	CalendarDays,
	Check,
	Route2,
	Sparkles,
	Time04,
} from "~/components/ui/icon";
import { Screen, ScreenScroll } from "~/components/ui/screen";
import { Surface } from "~/components/ui/surface";
import { Text } from "~/components/ui/text";
import { useAuthSession } from "~/context/AuthContext";
import { isDiagnosticLearningPlanSession } from "~/features/learning-plans/rolling-learning-window";
import { getErrorMessage } from "~/features/learning-plans/utils";
import { useBackIntent } from "~/lib/navigation";
import { ROUTES } from "~/lib/routes";

const planPath = (id: Id<"learningPlans">, step: string) =>
	`/learning-plans/${id}/${step}` as const;

const localDateKey = () => {
	const today = new Date();
	const year = today.getFullYear();
	const month = String(today.getMonth() + 1).padStart(2, "0");
	const day = String(today.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
};

export default function LearningPlanReviewScreen() {
	const router = useRouter();
	const params = useLocalSearchParams<{ planId?: string }>();
	const planId = params.planId as Id<"learningPlans"> | undefined;
	const { user } = useAuthSession();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const acceptPlan = useMutation(api.learningPlans.acceptPlan);
	const [isBusy, setIsBusy] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	const plan = useQuery(
		api.learningPlans.getPlanDetails,
		user && isConvexAuthenticated && planId ? { id: planId } : "skip",
	);
	const sessions = useQuery(
		api.learningPlans.listSessions,
		user && isConvexAuthenticated && planId
			? { learningPlanId: planId }
			: "skip",
	);
	const nextSession = sessions?.[0] ?? null;
	const laterSessions = sessions?.slice(1) ?? [];
	const startsWithDiagnostic = nextSession
		? isDiagnosticLearningPlanSession(nextSession)
		: false;
	const needsDiagnosticRegeneration = Boolean(
		plan?.status === "generated" && plan.diagnosticPlacement !== "firstSession",
	);
	const canStartNow = Boolean(
		nextSession && nextSession.dateKey.slice(0, 10) <= localDateKey(),
	);
	const goBack = () => {
		router.replace(ROUTES.learningPlans);
		return true;
	};
	useBackIntent(true, goBack);

	useEffect(() => {
		if (!planId || !plan || !sessions) return;
		if (needsDiagnosticRegeneration) {
			router.replace(planPath(planId, "analysis"));
			return;
		}
		if (plan.status === "draft") {
			router.replace(planPath(planId, "analysis"));
			return;
		}
		if (plan.status === "questionsReady") {
			router.replace(planPath(planId, "analysis"));
			return;
		}
		if (plan.status === "accepted") {
			router.replace(`/learning-plans/${planId}`);
			return;
		}
	}, [needsDiagnosticRegeneration, plan, planId, router, sessions]);

	const acceptRecommendedPath = async () => {
		if (!planId || !nextSession || isBusy) return;
		if (needsDiagnosticRegeneration) {
			router.replace(planPath(planId, "analysis"));
			return;
		}
		setIsBusy(true);
		setErrorMessage(null);
		try {
			await acceptPlan({ learningPlanId: planId });
			router.replace(
				canStartNow
					? `/learning-plans/${planId}/sessions/${nextSession.id}`
					: `/learning-plans/${planId}`,
			);
		} catch (error) {
			setErrorMessage(
				getErrorMessage(error, "Dein Lernweg konnte nicht eingetragen werden."),
			);
		} finally {
			setIsBusy(false);
		}
	};

	if (needsDiagnosticRegeneration) {
		return (
			<Screen>
				<View className="flex-1 items-center justify-center">
					<ActivityIndicator color="#00A0E6" />
				</View>
			</Screen>
		);
	}

	return (
		<Screen>
			<Stack.Screen options={{ gestureEnabled: true }} />
			<ScreenScroll contentContainerStyle={{ flexGrow: 1 }} includeTopSafeArea>
				<View className="flex-1">
					<View className="mb-6 items-start">
						<BackButton onPress={goBack} />
					</View>
					<View className="items-center">
						<View className="h-16 w-16 items-center justify-center rounded-[24px] bg-system-subtle">
							<Sparkles size={30} color="#00A0E6" strokeWidth={2.1} />
						</View>
						<Text className="mt-5 text-center font-poppins font-semibold text-heading-2 text-text">
							{startsWithDiagnostic
								? "Dein Lernweg startet mit einem Wissenscheck."
								: "Deine nächsten Lernschritte stehen fest."}
						</Text>
						<Text className="mt-3 max-w-[330px] text-center font-poppins text-body-3 text-secondary-text">
							{startsWithDiagnostic
								? "In 5–10 kurzen Fragen prüfst du zuerst deinen aktuellen Wissensstand. Danach passt Dayova jeden nächsten Lernschritt an."
								: "Dayova plant zunächst zwei Termine und passt die Inhalte nach jedem abgeschlossenen Lernschritt an."}
						</Text>
					</View>

					<Surface className="mt-8 rounded-[32px] px-5 py-6" variant="soft">
						<View className="flex-row items-center gap-3">
							<View className="h-10 w-10 items-center justify-center rounded-[16px] bg-wrong-subtle">
								<Route2 size={21} color="#FF9500" strokeWidth={2.1} />
							</View>
							<Text className="font-poppins font-semibold text-body-3 text-text">
								So wächst dein Lernweg
							</Text>
						</View>
						<Text className="mt-4 font-poppins text-body-3 text-secondary-text">
							Nach jedem abgeschlossenen Termin nutzt Dayova deine Antworten und
							Ergebnisse, um den darauffolgenden Lerninhalt neu festzulegen.
						</Text>
					</Surface>

					{nextSession ? (
						<Surface className="mt-5 rounded-[32px] px-5 py-6">
							<View className="flex-row items-center gap-2">
								<Check size={18} color="#34C759" strokeWidth={2.5} />
								<Text className="font-poppins font-semibold text-body-4 text-success">
									{startsWithDiagnostic
										? "Erster Termin · Wissenscheck"
										: "Dein nächster Lernschritt"}
								</Text>
							</View>
							<Text className="mt-4 font-poppins font-semibold text-body-1 text-text">
								{nextSession.title}
							</Text>
							<Text className="mt-2 font-poppins text-body-3 text-secondary-text">
								{nextSession.goal}
							</Text>
							<View className="mt-5 flex-row flex-wrap gap-3">
								<View className="flex-row items-center gap-2 rounded-full bg-light-2 px-3 py-2">
									<CalendarDays size={15} color="#697586" strokeWidth={2} />
									<Text className="font-poppins text-body-4 text-secondary-text">
										{nextSession.dateLabel}
									</Text>
								</View>
								<View className="flex-row items-center gap-2 rounded-full bg-system-subtle px-3 py-2">
									<Time04 size={15} color="#00A0E6" strokeWidth={2} />
									<Text className="font-poppins font-semibold text-body-4 text-primary">
										{nextSession.startTime} · {nextSession.durationMinutes} Min.
									</Text>
								</View>
								{startsWithDiagnostic ? (
									<View className="rounded-full bg-ueben-subtle px-3 py-2">
										<Text className="font-poppins font-semibold text-body-4 text-ueben">
											5–10 Fragen
										</Text>
									</View>
								) : null}
							</View>
						</Surface>
					) : null}

					{laterSessions.length > 0 ? (
						<View className="mt-7">
							<Text className="font-poppins font-semibold text-body-3 text-text">
								Danach · Vorschau
							</Text>
							<Text className="mt-2 font-poppins text-body-4 text-secondary-text">
								Der Termin steht schon fest. Was du dort lernst, wird nach
								deinem ersten Ergebnis noch einmal angepasst.
							</Text>
							<View className="mt-4 gap-3">
								{laterSessions.map((session) => (
									<Surface
										key={session.id}
										className="rounded-[24px] px-4 py-4"
										variant="flat"
									>
										<Text className="font-poppins font-semibold text-body-3 text-text">
											{session.title}
										</Text>
										<Text className="mt-1 font-poppins text-body-4 text-secondary-text">
											{`${session.dateLabel}, ${session.startTime} · ${session.durationMinutes} Min.`}
										</Text>
										<Text className="mt-2 font-poppins font-semibold text-body-5 text-primary">
											Inhalt wird nach deinem letzten Lernschritt angepasst
										</Text>
									</Surface>
								))}
							</View>
						</View>
					) : null}

					{plan?.rollingPlanEnabled ? (
						<Surface className="mt-5 rounded-[28px] px-5 py-5" variant="soft">
							<View className="flex-row items-start gap-3">
								<View className="h-10 w-10 items-center justify-center rounded-[16px] bg-system-subtle">
									<Sparkles size={20} color="#00A0E6" strokeWidth={2.1} />
								</View>
								<View className="min-w-0 flex-1">
									<Text className="font-poppins font-semibold text-body-3 text-text">
										Weitere Termine folgen automatisch
									</Text>
									<Text className="mt-1 font-poppins text-body-4 text-secondary-text">
										Nach jedem Abschluss plant Dayova einen weiteren Lerntermin.
										So bleiben bis zur Prüfung immer die nächsten zwei Schritte
										im Blick – solange noch genug Lernzeit frei ist.
									</Text>
								</View>
							</View>
						</Surface>
					) : null}

					{plan?.planningHint ? (
						<Text className="mt-5 text-center font-poppins text-body-4 text-secondary-text">
							{plan.planningHint}
						</Text>
					) : null}
					{errorMessage ? (
						<Text
							selectable
							accessibilityRole="alert"
							className="mt-5 text-center font-poppins text-body-4 text-destructive"
						>
							{errorMessage}
						</Text>
					) : null}

					<View className="mt-auto gap-3 pt-8">
						<Button
							disabled={!nextSession || isBusy}
							onPress={() => void acceptRecommendedPath()}
						>
							{isBusy ? (
								<ActivityIndicator color="#FFFFFF" />
							) : (
								<Text>
									{canStartNow ? "Lernschritt starten" : "Lernweg eintragen"}
								</Text>
							)}
						</Button>
					</View>
				</View>
			</ScreenScroll>
		</Screen>
	);
}
