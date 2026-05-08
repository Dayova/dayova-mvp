import { useConvexAuth, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ScrollView, TouchableOpacity, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "#convex/_generated/api";
import { NotificationButton } from "~/components/notification-button";
import { Plus, Route2 } from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
import { useAuth } from "~/context/AuthContext";
import { ROUTES } from "~/lib/routes";

type LearningPlanOverview = {
	id: string;
	subject: string;
	examTypeLabel: string;
	status: "draft" | "questionsReady" | "generated" | "accepted";
};

const STATUS_PROGRESS: Record<LearningPlanOverview["status"], number> = {
	draft: 12,
	questionsReady: 33,
	generated: 72,
	accepted: 100,
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
				stroke="rgba(58,123,255,0.14)"
				strokeWidth={strokeWidth}
				fill="transparent"
			/>
			<Circle
				cx={size / 2}
				cy={size / 2}
				r={radius}
				stroke="#3A7BFF"
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
	const progress = STATUS_PROGRESS[plan.status];

	return (
		<TouchableOpacity
			accessibilityHint="Öffnet diesen Lernplan."
			accessibilityLabel={`${plan.subject} ${plan.examTypeLabel}, ${progress} Prozent`}
			accessibilityRole="button"
			activeOpacity={0.9}
			onPress={() => router.push(getPlanHref(plan))}
			className="flex-row items-center rounded-[30px] bg-white px-5 py-4"
			style={{
				borderWidth: 1,
				borderColor: "rgba(17,24,39,0.04)",
				boxShadow: "0 14px 28px rgba(21, 29, 48, 0.08)",
				columnGap: 14,
			}}
		>
			<View
				className="h-[58px] w-[58px] items-center justify-center rounded-full py-3"
				style={{
					backgroundColor: "#FFEAF8",
					boxShadow: "0 10px 22px rgba(244, 43, 184, 0.18)",
				}}
			>
				<Route2 size={28} color="#FF42C8" strokeWidth={2.2} />
			</View>

			<View className="flex-1">
				<Text
					className="font-poppins font-semibold text-[#202127]"
					numberOfLines={1}
					style={{ fontSize: 15, lineHeight: 20, includeFontPadding: false }}
				>
					{`${plan.subject} ${plan.examTypeLabel}`.trim()}
				</Text>
			</View>

			<View className="items-center justify-center">
				<ProgressRing progress={progress} />
				<Text
					className="absolute font-bold font-poppins text-[#17171C]"
					style={{ fontSize: 12, lineHeight: 14, includeFontPadding: false }}
				>
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
		<View className="flex-1 bg-[#F6F4F7]">
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
					<Text
						className="font-bold font-poppins text-[#202127]"
						style={{ fontSize: 27, lineHeight: 32, includeFontPadding: false }}
					>
						Deine Lernpläne
					</Text>

					<NotificationButton />
				</View>

				<View style={{ rowGap: 16 }}>
					{visiblePlans.length > 0 ? (
						visiblePlans.map((plan) => (
							<LearningPlanCard key={plan.id} plan={plan} />
						))
					) : (
						<View
							className="items-center rounded-[30px] bg-white px-5 py-7"
							style={{
								borderWidth: 1,
								borderColor: "rgba(17,24,39,0.05)",
								boxShadow: "0 14px 28px rgba(21, 29, 48, 0.08)",
							}}
						>
							<View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-[#EEF4FF]">
								<Route2 size={30} color="#3A7BFF" strokeWidth={2.2} />
							</View>
							<Text
								className="text-center font-bold font-poppins text-[#202127]"
								style={{
									fontSize: 18,
									lineHeight: 23,
									includeFontPadding: false,
								}}
							>
								Noch keine Lernpläne
							</Text>
							<Text
								className="mt-2 text-center font-poppins text-[#8D8F98]"
								style={{
									fontSize: 13,
									lineHeight: 19,
									includeFontPadding: false,
								}}
							>
								Erstelle einen Lernplan aus einer Leistungskontrolle, damit er
								hier als Übersicht erscheint.
							</Text>
							<TouchableOpacity
								accessibilityRole="button"
								accessibilityLabel="Lernplan erstellen"
								activeOpacity={0.9}
								onPress={() => router.push(ROUTES.createLearningPlan)}
								className="mt-5 flex-row items-center rounded-full bg-[#17171C] px-5 py-3"
								style={{ columnGap: 8 }}
							>
								<Plus size={18} color="#FFFFFF" strokeWidth={2.4} />
								<Text
									className="font-poppins font-semibold text-white"
									style={{
										fontSize: 13,
										lineHeight: 17,
										includeFontPadding: false,
									}}
								>
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
