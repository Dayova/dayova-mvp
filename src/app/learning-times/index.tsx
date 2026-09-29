import { useConvexAuth, useQuery } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
	ActivityIndicator,
	ScrollView,
	useWindowDimensions,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { ScreenHeader as Header } from "~/components/screen-header";
import { Button } from "~/components/ui/button";
import { Plus, Timer } from "~/components/ui/icon";
import { Screen } from "~/components/ui/screen";
import { Surface } from "~/components/ui/surface";
import { Text } from "~/components/ui/text";
import { ThemedStatusBar } from "~/components/ui/themed-status-bar";
import { useAuthSession } from "~/context/AuthContext";
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
	const { fontScale } = useWindowDimensions();
	const { user } = useAuthSession();
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
						learningTimes?.length ? (
							<Button
								accessibilityLabel="Lernzeit hinzufügen"
								className="h-12 min-h-12 w-12 min-w-12 rounded-full border border-border bg-card px-0 active:bg-card/80"
								onPress={() => openEditor({ dayOfWeek: firstMissingDay })}
								size="icon"
								variant="ghost"
							>
								<Plus size={22} color={colors.primary} strokeWidth={2.2} />
							</Button>
						) : null
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
					style={{ lineHeight: 21 * fontScale }}
				>
					Lege fest, wann du normalerweise Zeit zum Lernen hast.
				</Text>

				<View className="mt-7">
					{learningTimes === undefined ? (
						<View className="items-center py-12">
							<ActivityIndicator color={DAYOVA_DESIGN_SYSTEM.colors.primary} />
						</View>
					) : learningTimes.length === 0 ? (
						<Surface className="items-center border border-border px-6 py-8">
							<View className="h-14 w-14 items-center justify-center rounded-full bg-accent">
								<Timer size={26} color={colors.primary} strokeWidth={2} />
							</View>
							<Text
								accessibilityRole="header"
								className="mt-5 text-center font-poppins font-semibold text-body-2 text-text"
								style={{ lineHeight: 24 * Math.min(fontScale, 1.75) }}
							>
								Noch keine Lernzeiten
							</Text>
							<Text
								className="mt-2 text-center font-poppins text-body-4 text-secondary-text"
								style={{ lineHeight: 18 * fontScale }}
							>
								Füge eine regelmäßige Lernzeit hinzu. Du kannst sie später
								jederzeit ändern.
							</Text>
							<Button
								accessibilityLabel="Lernzeit hinzufügen"
								className="mt-6 w-full"
								onPress={() => openEditor({ dayOfWeek: firstMissingDay })}
							>
								<Plus size={18} color={colors.onPrimary} strokeWidth={2.4} />
								<Text style={{ lineHeight: 24 * fontScale }}>
									Lernzeit hinzufügen
								</Text>
							</Button>
						</Surface>
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
