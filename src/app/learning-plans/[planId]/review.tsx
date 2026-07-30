import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { Button } from "~/components/ui/button";
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
import type { LearningPlanSnapshot } from "~/features/learning-plans/types";
import { getErrorMessage } from "~/features/learning-plans/utils";

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
	const [showRoadmap, setShowRoadmap] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	const snapshot = (useQuery(
		api.learningPlans.getSnapshot,
		user && isConvexAuthenticated && planId ? { id: planId } : "skip",
	) ?? null) as LearningPlanSnapshot | null;
	const nextSession = snapshot?.sessions[0] ?? null;
	const laterSessions = snapshot?.sessions.slice(1) ?? [];
	const firstGap = snapshot?.plan.insight?.gaps[0] ?? null;
	const canStartNow = Boolean(
		nextSession && nextSession.dateKey.slice(0, 10) <= localDateKey(),
	);

	useEffect(() => {
		if (!planId || !snapshot) return;
		if (
			snapshot.plan.status === "draft" ||
			snapshot.plan.status === "questionsReady"
		) {
			router.replace(planPath(planId, "generating"));
			return;
		}
		if (snapshot.plan.status === "accepted") {
			router.replace(`/learning-plans/${planId}`);
		}
	}, [planId, router, snapshot]);

	const acceptRecommendedPath = async () => {
		if (!planId || !nextSession || isBusy) return;
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

	return (
		<Screen>
			<Stack.Screen options={{ gestureEnabled: false }} />
			<ScreenScroll contentContainerStyle={{ flexGrow: 1 }} includeTopSafeArea>
				<View className="flex-1">
					<View className="items-center">
						<View className="h-16 w-16 items-center justify-center rounded-[24px] bg-system-subtle">
							<Sparkles size={30} color="#00A0E6" strokeWidth={2.1} />
						</View>
						<Text className="mt-5 text-center font-poppins font-semibold text-heading-2 text-text">
							Du weißt jetzt, womit du anfangen solltest.
						</Text>
						<Text className="mt-3 max-w-[330px] text-center font-poppins text-body-3 text-secondary-text">
							Dein erster Schritt basiert auf deinen Schulunterlagen, deinen
							Antworten und der Zeit bis zur Arbeit.
						</Text>
					</View>

					<Surface className="mt-8 rounded-[32px] px-5 py-6" variant="soft">
						<View className="flex-row items-center gap-3">
							<View className="h-10 w-10 items-center justify-center rounded-[16px] bg-wrong-subtle">
								<Route2 size={21} color="#FF9500" strokeWidth={2.1} />
							</View>
							<Text className="font-poppins font-semibold text-body-3 text-text">
								Was wir erkannt haben
							</Text>
						</View>
						<Text
							selectable
							className="mt-4 font-poppins text-body-2 text-text"
						>
							{firstGap ??
								snapshot?.plan.insight?.summary ??
								"Wir beginnen mit dem Bereich, zu dem noch die wenigste sichere Evidenz vorliegt."}
						</Text>
						<Text className="mt-3 font-poppins text-body-4 text-secondary-text">
							Diesen Schritt priorisieren wir aus deinen Antworten innerhalb des
							bestätigten Prüfungsumfangs.
						</Text>
					</Surface>

					{nextSession ? (
						<Surface className="mt-5 rounded-[32px] px-5 py-6">
							<View className="flex-row items-center gap-2">
								<Check size={18} color="#34C759" strokeWidth={2.5} />
								<Text className="font-poppins font-semibold text-body-4 text-success">
									Dein nächster Lernschritt
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
							</View>
						</Surface>
					) : null}

					{showRoadmap ? (
						<View className="mt-7">
							<Text className="font-poppins font-semibold text-body-3 text-text">
								Dein weiterer Lernweg
							</Text>
							<Text className="mt-2 font-poppins text-body-4 text-secondary-text">
								Die Termine bleiben stabil. Die genauen Inhalte werden erst nach
								deinem jeweils letzten Lernschritt festgelegt.
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
											{session.dateLabel}, {session.startTime} · Inhalt wird
											angepasst
										</Text>
									</Surface>
								))}
							</View>
						</View>
					) : null}

					{snapshot?.plan.planningHint ? (
						<Text className="mt-5 text-center font-poppins text-body-4 text-secondary-text">
							{snapshot.plan.planningHint}
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
						{laterSessions.length > 0 ? (
							<Button
								variant="neutral"
								disabled={isBusy}
								onPress={() => setShowRoadmap((value) => !value)}
							>
								<Text>
									{showRoadmap ? "Lernweg ausblenden" : "Lernweg ansehen"}
								</Text>
							</Button>
						) : null}
					</View>
				</View>
			</ScreenScroll>
		</Screen>
	);
}
