import { useConvexAuth, useQuery } from "convex/react";
import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { api } from "#convex/_generated/api";
import { NotificationButton } from "~/components/notification-button";
import { Route2 } from "~/components/ui/icon";
import { Screen, ScreenScroll } from "~/components/ui/screen";
import { ActionSurface } from "~/components/ui/surface";
import { Text } from "~/components/ui/text";
import { ThemedStatusBar } from "~/components/ui/themed-status-bar";
import { useAuth } from "~/context/AuthContext";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { formatGermanUiText } from "~/lib/german-ui-text";
import { useDayovaTheme } from "~/lib/theme";

function ProgressRing({ progressPercent }: { progressPercent: number }) {
	const { colors } = useDayovaTheme();
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
					stroke={colors.light2}
					strokeWidth={strokeWidth}
					fill="none"
				/>
				<Circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					stroke={DAYOVA_DESIGN_SYSTEM.colors.primary}
					strokeWidth={strokeWidth}
					fill="none"
					strokeLinecap="round"
					strokeDasharray={`${circumference} ${circumference}`}
					strokeDashoffset={circumference - (progress / 100) * circumference}
					transform={`rotate(-90 ${size / 2} ${size / 2})`}
				/>
			</Svg>
			<Text className="font-poppins font-semibold text-body-4 text-text">
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
	const title = formatGermanUiText(`${subject} ${examTypeLabel}`.trim());

	return (
		<ActionSurface activeOpacity={0.88} className="px-5 py-4">
			<View className="flex-row items-center">
				<View className="h-12 w-12 items-center justify-center rounded-full bg-system-subtle shadow-md shadow-primary/15">
					<Route2
						size={22}
						color={DAYOVA_DESIGN_SYSTEM.colors.primary}
						strokeWidth={2.05}
					/>
				</View>

				<Text className="ml-6 flex-1 font-poppins font-semibold text-body-1 text-text">
					{title}
				</Text>

				<ProgressRing progressPercent={progressPercent} />
			</View>
		</ActionSurface>
	);
}

export default function PlansScreen() {
	const { user } = useAuth();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const learningPlans = useQuery(
		api.learningPlans.listOverview,
		user && isConvexAuthenticated ? {} : "skip",
	);

	return (
		<Screen>
			<ThemedStatusBar />
			<ScreenScroll topPadding={84} bottomPadding={150} horizontalPadding={24}>
				<View className="flex-row items-center justify-between">
					<Text className="font-poppins font-semibold text-heading-2 text-text">
						Deine Lernpläne
					</Text>

					<NotificationButton />
				</View>

				<View className="mt-9 gap-5">
					{learningPlans
						?.filter((plan) => plan.status === "accepted")
						.map((plan) => (
							<LearningPlanCard
								key={plan.id}
								subject={plan.subject}
								examTypeLabel={plan.examTypeLabel}
								progressPercent={plan.progressPercent}
							/>
						)) ?? null}
				</View>
			</ScreenScroll>
		</Screen>
	);
}
