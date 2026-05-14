import { useConvexAuth, useQuery } from "convex/react";
import { StatusBar } from "expo-status-bar";
import { ScrollView, TouchableOpacity, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "#convex/_generated/api";
import { Bell, Route2 } from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
import { useAuth } from "~/context/AuthContext";

function ProgressRing({ progressPercent }: { progressPercent: number }) {
	const size = 52;
	const strokeWidth = 4;
	const radius = (size - strokeWidth) / 2;
	const circumference = 2 * Math.PI * radius;
	const progress = Math.max(0, Math.min(progressPercent, 100));

	return (
		<View className="h-[52px] w-[52px] items-center justify-center">
			<Svg width={size} height={size} style={{ position: "absolute" }}>
				<Circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					stroke="#E7EBF4"
					strokeWidth={strokeWidth}
					fill="none"
				/>
				<Circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					stroke="#3A7BFF"
					strokeWidth={strokeWidth}
					fill="none"
					strokeLinecap="round"
					strokeDasharray={`${circumference} ${circumference}`}
					strokeDashoffset={circumference - (progress / 100) * circumference}
					transform={`rotate(-90 ${size / 2} ${size / 2})`}
				/>
			</Svg>
			<Text
				className="font-poppins font-semibold text-[#17171C]"
				style={{ fontSize: 12, lineHeight: 14, includeFontPadding: false }}
			>
				{`${progress}%`}
			</Text>
		</View>
	);
}

function LearningPlanCard({
	subject,
	examTypeLabel,
	progressPercent,
}: {
	subject: string;
	examTypeLabel: string;
	progressPercent: number;
}) {
	const title = `${subject} ${examTypeLabel}`.trim();

	return (
		<TouchableOpacity
			activeOpacity={0.88}
			className="rounded-[32px] bg-white px-5 py-4"
			style={{
				borderWidth: 1,
				borderColor: "rgba(17,24,39,0.04)",
				boxShadow: "0 16px 34px rgba(22, 29, 48, 0.10)",
			}}
		>
			<View className="flex-row items-center">
				<View
					className="h-12 w-12 items-center justify-center rounded-full"
					style={{
						backgroundColor: "#FFE3F4",
						boxShadow: "0 8px 18px rgba(255, 105, 180, 0.16)",
					}}
				>
					<Route2 size={22} color="#FF58B8" strokeWidth={2.05} />
				</View>

				<Text
					className="ml-6 flex-1 font-poppins font-semibold text-[#17171C]"
					style={{ fontSize: 20, lineHeight: 24, includeFontPadding: false }}
				>
					{title}
				</Text>

				<ProgressRing progressPercent={progressPercent} />
			</View>
		</TouchableOpacity>
	);
}

export default function PlansScreen() {
	const insets = useSafeAreaInsets();
	const { user } = useAuth();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const learningPlans = useQuery(
		api.learningPlans.listOverview,
		user && isConvexAuthenticated ? {} : "skip",
	);

	return (
		<View className="flex-1 bg-[#F6F4F7]">
			<StatusBar style="dark" />
			<ScrollView
				className="flex-1"
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{
					paddingTop: Math.max(insets.top + 28, 84),
					paddingHorizontal: 24,
					paddingBottom: 150,
				}}
			>
				<View className="flex-row items-center justify-between">
					<Text
						className="font-bold font-poppins text-[#202127]"
						style={{ fontSize: 24, lineHeight: 28, includeFontPadding: false }}
					>
						Deine Lernpläne
					</Text>

					<TouchableOpacity
						activeOpacity={0.86}
						className="h-14 w-14 items-center justify-center rounded-full bg-white"
						style={{
							borderWidth: 1,
							borderColor: "rgba(17,24,39,0.06)",
							boxShadow: "0 10px 22px rgba(21, 29, 48, 0.08)",
						}}
					>
						<Bell size={22} color="#1A1A1A" strokeWidth={2.2} />
					</TouchableOpacity>
				</View>

				<View className="mt-9" style={{ rowGap: 18 }}>
					{learningPlans?.map((plan) => (
						<LearningPlanCard
							key={plan.id}
							subject={plan.subject}
							examTypeLabel={plan.examTypeLabel}
							progressPercent={plan.progressPercent}
						/>
					)) ?? null}
				</View>
			</ScrollView>
		</View>
	);
}
