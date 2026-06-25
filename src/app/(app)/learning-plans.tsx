import { useConvexAuth, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ScrollView, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import { api } from "#convex/_generated/api";
import { NotificationButton } from "~/components/notification-button";
import { Plus, Route2 } from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
import { useAuth } from "~/context/AuthContext";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { formatGermanUiText } from "~/lib/german-ui-text";
import { ROUTES } from "~/lib/routes";

type LearningPlanOverview = {
	id: string;
	subject: string;
	examTypeLabel: string;
	status: "draft" | "questionsReady" | "generated" | "accepted";
	progressPercent: number;
};

const getPlanHref = (plan: LearningPlanOverview) => {
	if (plan.status === "draft") return ROUTES.createLearningPlan;
	if (plan.status === "questionsReady") {
		return `/learning-plans/${plan.id}/quiz/0` as const;
	}
	return `/learning-plans/${plan.id}` as const;
};

function ProgressRing({ progress }: { progress: number }) {
	const size = 74;
	const strokeWidth = 4;
	const radius = (size - strokeWidth) / 2;
	const circumference = 2 * Math.PI * radius;
	const dashOffset = circumference * (1 - progress / 100);

	return (
		<Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
			<Circle
				cx={size / 2}
				cy={size / 2}
				r={radius}
				stroke={`${DAYOVA_DESIGN_SYSTEM.colors.primary}24`}
				strokeWidth={strokeWidth}
				fill="transparent"
			/>
			<Circle
				cx={size / 2}
				cy={size / 2}
				r={radius}
				stroke={DAYOVA_DESIGN_SYSTEM.colors.primary}
				strokeWidth={strokeWidth}
				fill="transparent"
				strokeDasharray={`${circumference} ${circumference}`}
				strokeDashoffset={dashOffset}
				strokeLinecap="round"
				rotation="-90"
				originX={size / 2}
				originY={size / 2}
			/>
		</Svg>
	);
}

function LearningPlanCard({ plan }: { plan: LearningPlanOverview }) {
	const router = useRouter();
	const progress = Math.max(0, Math.min(plan.progressPercent, 100));
	const title = formatGermanUiText(
		`${plan.subject} ${plan.examTypeLabel}`.trim(),
	);

	return (
		<TouchableOpacity
			accessibilityHint="Öffnet diesen Lernplan."
			accessibilityLabel={`${title}, ${progress} Prozent`}
			accessibilityRole="button"
			activeOpacity={0.9}
			onPress={() => router.push(getPlanHref(plan))}
			className="flex-row items-center gap-4 rounded-[30px] border border-border/50 bg-card px-5 py-4 shadow-black/5 shadow-lg"
		>
			<View className="h-14 w-14 items-center justify-center rounded-full bg-system-subtle py-3 shadow-md shadow-primary/20">
				<Route2
					size={28}
					color={DAYOVA_DESIGN_SYSTEM.colors.primary}
					strokeWidth={2.2}
				/>
			</View>

			<View className="flex-1">
				<Text
					className="font-poppins font-semibold text-body-3 text-text"
					numberOfLines={1}
				>
					{title}
				</Text>
			</View>

			<View className="items-center justify-center">
				<ProgressRing progress={progress} />
				<Text className="absolute font-poppins font-semibold text-body-4 text-text">
					{`${progress}%`}
				</Text>
			</View>
		</TouchableOpacity>
	);
}

export default function LearningPlansScreen() {
	const insets = useSafeAreaInsets();
	const router = useRouter();
	const { user } = useAuth();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const plans = useQuery(
		api.learningPlans.listOverview,
		user && isConvexAuthenticated ? {} : "skip",
	);
	const visiblePlans = plans ?? [];

	return (
		<View className="flex-1 bg-background">
			<StatusBar style="dark" />
			<ScrollView
				className="flex-1"
				contentInsetAdjustmentBehavior="automatic"
				contentContainerStyle={{
					paddingHorizontal: 24,
					paddingTop: Math.max(insets.top + 30, 54),
					paddingBottom: Math.max(insets.bottom + 120, 150),
					rowGap: 30,
				}}
				showsVerticalScrollIndicator={false}
			>
				<View className="flex-row items-center justify-between">
					<Text className="font-poppins font-semibold text-heading-2 text-text">
						Deine Lernpläne
					</Text>

					<NotificationButton />
				</View>

				<View className="gap-4">
					{visiblePlans.length > 0 ? (
						visiblePlans.map((plan) => (
							<LearningPlanCard key={plan.id} plan={plan} />
						))
					) : (
						<View className="items-center rounded-[30px] border border-border/50 bg-card px-5 py-7 shadow-black/5 shadow-lg">
							<View className="h-16 w-16 items-center justify-center rounded-full bg-accent">
								<Route2
									size={30}
									color={DAYOVA_DESIGN_SYSTEM.colors.primary}
									strokeWidth={2.2}
								/>
							</View>
							<Text className="text-center font-poppins font-semibold text-body-1 text-text">
								Noch keine Lernpläne
							</Text>
							<Text className="mt-2 text-center font-poppins text-body-3 text-secondary-text">
								Erstelle einen Lernplan aus einer Prüfung, damit er hier als
								Übersicht erscheint.
							</Text>
							<TouchableOpacity
								accessibilityRole="button"
								accessibilityLabel="Lernplan erstellen"
								activeOpacity={0.9}
								onPress={() => router.push(ROUTES.createExam)}
								className="mt-5 flex-row items-center gap-2 rounded-full bg-text px-5 py-3"
							>
								<Plus size={18} color="#FFFFFF" strokeWidth={2.4} />
								<Text className="font-poppins font-semibold text-body-4 text-white">
									Neuen Lernplan starten
								</Text>
							</TouchableOpacity>
						</View>
					)}
				</View>
			</ScrollView>
		</View>
	);
}
