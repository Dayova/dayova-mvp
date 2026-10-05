import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { ScreenHeader } from "~/components/screen-header";
import { Button } from "~/components/ui/button";
import { ConfirmationSheet } from "~/components/ui/confirmation-sheet";
import { Plus } from "~/components/ui/icon";
import { PortraitContent } from "~/components/ui/portrait-content";
import { Screen, ScreenScroll } from "~/components/ui/screen";
import { Text } from "~/components/ui/text";
import { ThemedStatusBar } from "~/components/ui/themed-status-bar";
import { useAuthSession } from "~/context/AuthContext";
import { LEARNING_DAYS } from "~/features/learning-times/learning-time-days";
import { LearningTimeEditorSheet } from "~/features/learning-times/learning-time-editor-sheet";
import {
	type WeeklyLearningTime,
	WeeklyLearningTimes,
} from "~/features/learning-times/weekly-learning-times";
import { createAsyncActionGate } from "~/lib/async-action-gate";
import { goBackToReturnOrReplace } from "~/lib/navigation";
import { getSafeReturnTo, ROUTES } from "~/lib/routes";
import { useDayovaTheme } from "~/lib/theme";
import { useFeatureAnalytics } from "~/lib/use-feature-analytics";
import { getUserFacingErrorMessage } from "~/lib/user-facing-errors";

export default function LearningTimesOverviewScreen({
	initialEditor,
	onEditorClose,
}: {
	initialEditor?: { day: number; id?: string };
	onEditorClose?: () => void;
} = {}) {
	const trackFeature = useFeatureAnalytics();
	const router = useRouter();
	const params = useLocalSearchParams<{ returnTo?: string }>();
	const insets = useSafeAreaInsets();
	const { user } = useAuthSession();
	const { colors } = useDayovaTheme();
	const { isAuthenticated } = useConvexAuth();
	const learningTimes = useQuery(
		api.learningTimes.listMine,
		user && isAuthenticated ? {} : "skip",
	);
	const removeLearningTime = useMutation(api.learningTimes.removeMine);
	const [deletingEntry, setDeletingEntry] = useState<WeeklyLearningTime | null>(
		null,
	);
	const [isRemoving, setIsRemoving] = useState(false);
	const [removeError, setRemoveError] = useState<string | null>(null);
	const actionGate = useRef(createAsyncActionGate());
	const [editor, setEditor] = useState(initialEditor ?? null);
	const canManage =
		Boolean(user) &&
		isAuthenticated &&
		learningTimes !== undefined &&
		!isRemoving;
	const returnTo = getSafeReturnTo(params.returnTo);
	const firstMissingDay =
		LEARNING_DAYS.find(
			(day) => !learningTimes?.some((entry) => entry.dayOfWeek === day.value),
		)?.value ?? 1;
	const openEditor = (dayOfWeek: number, id?: string) => {
		if (canManage) setEditor({ day: dayOfWeek, id });
	};
	const confirmRemove = async () => {
		if (!deletingEntry || !canManage) return;
		await actionGate.current.run(async () => {
			setIsRemoving(true);
			setRemoveError(null);
			try {
				trackFeature("learning_times.remove", "attempted");
				await removeLearningTime({
					id: deletingEntry.id as Id<"userLearningTimes">,
				});
				trackFeature("learning_times.remove", "succeeded");
				setDeletingEntry(null);
			} catch (error) {
				trackFeature("learning_times.remove", "failed");
				setRemoveError(
					getUserFacingErrorMessage(
						error,
						"Die Lernzeit konnte nicht gelöscht werden. Bitte versuche es erneut.",
						{ source: "learning-times.remove" },
					),
				);
			} finally {
				setIsRemoving(false);
			}
		});
	};
	const deletingDay = LEARNING_DAYS.find(
		(day) => day.value === deletingEntry?.dayOfWeek,
	)?.label;
	return (
		<Screen>
			<ThemedStatusBar />
			<PortraitContent
				className="bg-background px-6"
				// Safe-area spacing follows the neighboring personal-subject settings.
				style={{ paddingTop: Math.max(insets.top + 28, 64) }}
			>
				<ScreenHeader
					title="Lernzeiten"
					onBack={() =>
						goBackToReturnOrReplace(router, ROUTES.settings, returnTo)
					}
					right={
						<Button
							accessibilityLabel="Lernzeit hinzufügen"
							disabled={!canManage}
							className="h-12 min-h-12 w-12 min-w-12 rounded-full border border-border bg-card px-0 active:bg-card/80"
							size="icon"
							variant="ghost"
							onPress={() => openEditor(firstMissingDay)}
						>
							<Plus size={28} color={colors.primary} strokeWidth={1.8} />
						</Button>
					}
				/>
			</PortraitContent>
			<ScreenScroll
				includeTopSafeArea={false}
				horizontalPadding={24}
				topPadding={24}
				bottomPadding={80}
				showsVerticalScrollIndicator={false}
			>
				<Text className="mb-5 text-body-3 text-secondary-text">
					Diese wöchentlichen Zeiten bilden die Grundlage für deine Lernplanung.
					Du kannst sie hier hinzufügen, bearbeiten oder löschen.
				</Text>
				{learningTimes === undefined ? (
					<View
						accessible
						accessibilityLabel="Lernzeiten werden geladen"
						accessibilityRole="progressbar"
						className="min-h-32 items-center justify-center"
					>
						<ActivityIndicator color={colors.primary} />
					</View>
				) : (
					<WeeklyLearningTimes
						entries={learningTimes}
						disabled={!canManage}
						onAdd={(day) => openEditor(day)}
						onEdit={(entry) => openEditor(entry.dayOfWeek, entry.id)}
						onRemove={(entry) => {
							setRemoveError(null);
							setDeletingEntry(entry);
						}}
					/>
				)}
			</ScreenScroll>
			<ConfirmationSheet
				actionAppearance="outlined"
				visible={Boolean(deletingEntry)}
				title="Lernzeit löschen?"
				description={`${deletingDay ?? "Die Lernzeit"}, ${deletingEntry?.startTime ?? ""}–${deletingEntry?.endTime ?? ""} Uhr wird aus deinen wöchentlichen Lernzeiten entfernt.`}
				confirmLabel="Löschen"
				isBusy={isRemoving}
				errorMessage={removeError}
				onClose={() => {
					if (!isRemoving) {
						setDeletingEntry(null);
						setRemoveError(null);
					}
				}}
				onConfirm={() => {
					void confirmRemove();
				}}
			/>
			{editor ? (
				<LearningTimeEditorSheet
					day={editor.day}
					id={editor.id}
					onClose={() => {
						setEditor(null);
						onEditorClose?.();
					}}
				/>
			) : null}
		</Screen>
	);
}
