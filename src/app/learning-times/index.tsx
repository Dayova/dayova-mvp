import { useConvexAuth, useQuery } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { ScreenHeader as Header } from "~/components/screen-header";
import { Button } from "~/components/ui/button";
import { Plus } from "~/components/ui/icon";
import { Screen } from "~/components/ui/screen";
import { Text } from "~/components/ui/text";
import { ThemedStatusBar } from "~/components/ui/themed-status-bar";
import { useAuth } from "~/context/AuthContext";
import { LEARNING_DAYS } from "~/features/learning-times/learning-time-days";
import {
	type WeeklyLearningTime,
	WeeklyLearningTimes,
} from "~/features/learning-times/weekly-learning-times";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { goBackToReturnOrReplace } from "~/lib/navigation";
import { getSafeReturnTo, ROUTES, withReturnTo } from "~/lib/routes";
import { useDayovaTheme } from "~/lib/theme";

export default function LearningTimesOverviewScreen() {
	const router = useRouter();
	const params = useLocalSearchParams<{ returnTo?: string }>();
	const insets = useSafeAreaInsets();
	const { user } = useAuth();
	const { colors } = useDayovaTheme();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const learningTimes = useQuery(
		api.learningTimes.listMine,
		user && isConvexAuthenticated ? {} : "skip",
	);

	const firstMissingDay =
		LEARNING_DAYS.find(
			(day) => !learningTimes?.some((entry) => entry.dayOfWeek === day.value),
		)?.value ?? 1;
	const returnTo = getSafeReturnTo(params.returnTo);

	const goBack = () => {
		goBackToReturnOrReplace(router, ROUTES.settings, returnTo);
	};

	const openEditor = ({
		dayOfWeek,
		id,
	}: {
		dayOfWeek: number;
		id?: Id<"userLearningTimes">;
	}) => {
		const idParam = id ? `&id=${encodeURIComponent(id)}` : "";
		router.push(
			withReturnTo(`/learning-times/edit?day=${dayOfWeek}${idParam}`, returnTo),
		);
	};

	return (
		<Screen>
			<ThemedStatusBar />
			<View
				className="bg-background px-6 pb-3"
				style={{ paddingTop: insets.top + 12 }}
			>
				<Header
					className="mb-0"
					title="Lernzeiten"
					onBack={goBack}
					right={
						<Button
							accessibilityLabel="Lernzeit hinzufügen"
							className="h-12 min-h-12 w-12 min-w-12 rounded-full bg-card px-0 shadow-black/10 shadow-sm active:bg-card/80"
							onPress={() => openEditor({ dayOfWeek: firstMissingDay })}
							size="icon"
							variant="ghost"
						>
							<Plus size={22} color={colors.primary} strokeWidth={2.2} />
						</Button>
					}
				/>
			</View>

			<ScrollView
				automaticallyAdjustContentInsets={false}
				className="flex-1 bg-background"
				contentContainerStyle={{
					paddingHorizontal: 24,
					paddingTop: 18,
					paddingBottom: Math.max(insets.bottom + 36, 80),
				}}
				contentInsetAdjustmentBehavior="never"
				showsVerticalScrollIndicator={false}
			>
				<Text
					selectable
					className="font-poppins text-body-3 text-secondary-text"
				>
					Dayova plant deine Lerneinheiten in diesen Zeiten.
				</Text>

				<View className="mt-7">
					{learningTimes === undefined ? (
						<View className="items-center py-12">
							<ActivityIndicator color={DAYOVA_DESIGN_SYSTEM.colors.primary} />
						</View>
					) : (
						<WeeklyLearningTimes
							entries={learningTimes}
							onAdd={(dayOfWeek) => openEditor({ dayOfWeek })}
							onEdit={(entry: WeeklyLearningTime) =>
								openEditor({
									dayOfWeek: entry.dayOfWeek,
									id: entry.id as Id<"userLearningTimes">,
								})
							}
						/>
					)}
				</View>
			</ScrollView>
		</Screen>
	);
}
