import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { ScreenHeader as Header } from "~/components/screen-header";
import { Button } from "~/components/ui/button";
import { ConfirmationSheet } from "~/components/ui/confirmation-sheet";
import { Plus } from "~/components/ui/icon";
import { Screen } from "~/components/ui/screen";
import { Text } from "~/components/ui/text";
import { ThemedStatusBar } from "~/components/ui/themed-status-bar";
import { useAuthSession } from "~/context/AuthContext";
import { LEARNING_DAYS } from "~/features/learning-times/learning-time-days";
import {
	type WeeklyLearningTime,
	WeeklyLearningTimes,
} from "~/features/learning-times/weekly-learning-times";
import { createAsyncActionGate } from "~/lib/async-action-gate";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { goBackToReturnOrReplace } from "~/lib/navigation";
import { getSafeReturnTo, ROUTES, withReturnTo } from "~/lib/routes";
import { useDayovaTheme } from "~/lib/theme";
import { getUserFacingErrorMessage } from "~/lib/user-facing-errors";

export default function LearningTimesOverviewScreen() {
	const router = useRouter();
	const params = useLocalSearchParams<{ returnTo?: string }>();
	const insets = useSafeAreaInsets();
	const { user } = useAuthSession();
	const { colors } = useDayovaTheme();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const learningTimes = useQuery(
		api.learningTimes.listMine,
		user && isConvexAuthenticated ? {} : "skip",
	);

	const removeLearningTime = useMutation(api.learningTimes.removeMine);
	const [deletingEntry, setDeletingEntry] = useState<WeeklyLearningTime | null>(
		null,
	);
	const [isDeleting, setIsDeleting] = useState(false);
	const [deleteError, setDeleteError] = useState<string | null>(null);
	const deleteGate = useRef(createAsyncActionGate());
	const confirmDelete = () => {
		if (!deletingEntry) return;
		void deleteGate.current.run(async () => {
			setIsDeleting(true);
			setDeleteError(null);
			try {
				await removeLearningTime({
					id: deletingEntry.id as Id<"userLearningTimes">,
				});
				setDeletingEntry(null);
			} catch (error) {
				setDeleteError(
					getUserFacingErrorMessage(
						error,
						"Die Lernzeit konnte nicht gelöscht werden.",
						{ source: "learning-times.remove" },
					),
				);
			} finally {
				setIsDeleting(false);
			}
		});
	};

	const firstMissingDay =
		LEARNING_DAYS.find(
			(day) => !learningTimes?.some((entry) => entry.dayOfWeek === day.value),
		)?.value ?? 1;
	const returnTo = getSafeReturnTo(params.returnTo);
	const hasProposedTimes = learningTimes?.some(
		(entry) => entry.preferenceStatus === "systemDefault",
	);

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
							className="h-12 min-h-12 w-12 min-w-12 rounded-full border border-border bg-card px-0 active:bg-muted"
							onPress={() => openEditor({ dayOfWeek: firstMissingDay })}
							size="icon"
							variant="ghost"
						>
							<Plus size={28} color={colors.text} strokeWidth={1.8} />
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
					{hasProposedTimes
						? "Dayova hat diese Zeiten als Start vorgeschlagen. Sobald du eine Zeit bearbeitest oder ergänzt, gelten sie als deine bestätigten Lernzeiten."
						: "Dayova plant deine Lerneinheiten in diesen Zeiten."}
				</Text>

				<View className="mt-7">
					{learningTimes === undefined ? (
						<View className="items-center py-12">
							<ActivityIndicator color={DAYOVA_DESIGN_SYSTEM.colors.primary} />
						</View>
					) : (
						<WeeklyLearningTimes
							entries={learningTimes}
							onRemove={(entry) => {
								setDeleteError(null);
								setDeletingEntry(entry);
							}}
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
			<ConfirmationSheet
				visible={Boolean(deletingEntry)}
				title="Lernzeit löschen?"
				description={
					deletingEntry
						? `Möchtest du die Lernzeit ${deletingEntry.startTime}–${deletingEntry.endTime} wirklich löschen?`
						: ""
				}
				confirmLabel="Löschen"
				isBusy={isDeleting}
				errorMessage={deleteError}
				onConfirm={confirmDelete}
				onClose={() => {
					if (!isDeleting) setDeletingEntry(null);
				}}
			/>
		</Screen>
	);
}
