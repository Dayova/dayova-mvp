import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Platform, ScrollView, View } from "react-native";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { ScreenHeader as Header } from "~/components/screen-header";
import { ActionModal } from "~/components/ui/action-modal";
import { Button } from "~/components/ui/button";
import type { DateTimePickerEvent } from "~/components/ui/date-time-picker-sheet";
import { DateTimePickerSheet } from "~/components/ui/date-time-picker-sheet";
import { X } from "~/components/ui/icon";
import { useContentSizeLayout } from "~/components/ui/portrait-content";
import { Text } from "~/components/ui/text";
import { ThemedStatusBar } from "~/components/ui/themed-status-bar";
import { useAuth } from "~/context/AuthContext";
import { SessionEditForm } from "~/features/learning-plans/learning-plan-ui";
import type {
	LearningPlanSnapshot,
	PickerTarget,
	PlanSession,
	SessionPhase,
} from "~/features/learning-plans/types";
import {
	dateWithTime,
	formatDate,
	formatTime,
	getDateKey,
	getErrorMessage,
	minutesFromTime,
	parseDateKey,
	timeFromMinutes,
} from "~/features/learning-plans/utils";
import { goBackOrReplace, useBackIntent } from "~/lib/navigation";
import { cn } from "~/lib/utils";

const reviewPath = (id: Id<"learningPlans">) =>
	`/learning-plans/${id}/review` as const;

function LoadedSessionEditScreen({
	planId,
	session,
}: {
	planId: Id<"learningPlans">;
	session: PlanSession;
}) {
	const router = useRouter();
	const { horizontalPadding, shouldStackInlineContent } =
		useContentSizeLayout();
	const updateSession = useMutation(api.learningPlans.updateSession);
	const removeSession = useMutation(api.learningPlans.removeSession);

	const [isBusy, setIsBusy] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [isDeleteVisible, setIsDeleteVisible] = useState(false);
	const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);
	const [editDate, setEditDate] = useState(() => parseDateKey(session.dateKey));
	const [editStart, setEditStart] = useState(session.startTime);
	const [editEnd, setEditEnd] = useState(() =>
		timeFromMinutes(
			minutesFromTime(session.startTime) + session.durationMinutes,
		),
	);
	const [editPhase, setEditPhase] = useState<SessionPhase>(session.phase);

	const closeScreen = useCallback(() => {
		if (pickerTarget) {
			setPickerTarget(null);
			return true;
		}
		if (isDeleteVisible) {
			setIsDeleteVisible(false);
			return true;
		}
		router.replace(reviewPath(planId));
		return true;
	}, [isDeleteVisible, pickerTarget, planId, router]);

	useBackIntent(
		Boolean(pickerTarget || isDeleteVisible || planId),
		closeScreen,
	);

	const runWithErrorHandling = async (
		fallback: string,
		task: () => Promise<void>,
	) => {
		setIsBusy(true);
		setErrorMessage(null);
		try {
			await task();
		} catch (error) {
			setErrorMessage(getErrorMessage(error, fallback));
		} finally {
			setIsBusy(false);
		}
	};

	const saveEdit = async () => {
		if (isBusy) return;

		await runWithErrorHandling(
			"Der Lerntag konnte nicht gespeichert werden.",
			async () => {
				const startMinutes = minutesFromTime(editStart);
				const endMinutes = minutesFromTime(editEnd);
				const duration =
					endMinutes > startMinutes
						? endMinutes - startMinutes
						: session.durationMinutes;

				await updateSession({
					id: session.id,
					phase: editPhase,
					dateKey: getDateKey(editDate),
					dateLabel: formatDate(editDate),
					startTime: editStart,
					durationMinutes: duration,
				});
				router.replace(reviewPath(planId));
			},
		);
	};

	const confirmDelete = async () => {
		if (isBusy) return;

		await runWithErrorHandling(
			"Der Lerntag konnte nicht entfernt werden.",
			async () => {
				await removeSession({ id: session.id });
				router.replace(reviewPath(planId));
			},
		);
	};

	const handlePickerChange = (
		event: DateTimePickerEvent,
		selectedDate?: Date,
	) => {
		if (Platform.OS === "android") setPickerTarget(null);
		if (event.type === "dismissed" || !selectedDate || !pickerTarget) return;

		if (pickerTarget === "editDate")
			setEditDate(parseDateKey(getDateKey(selectedDate)));
		if (pickerTarget === "editStart") setEditStart(formatTime(selectedDate));
		if (pickerTarget === "editEnd") setEditEnd(formatTime(selectedDate));
	};

	const renderPicker = () => {
		if (!pickerTarget) return null;

		const isDate = pickerTarget === "editDate";
		const value = isDate
			? editDate
			: dateWithTime(
					getDateKey(editDate),
					pickerTarget === "editStart" ? editStart : editEnd,
				);

		return (
			<DateTimePickerSheet
				visible
				value={value}
				mode={isDate ? "date" : "time"}
				onChange={handlePickerChange}
				onClose={() => setPickerTarget(null)}
			/>
		);
	};

	return (
		<View className="flex-1 bg-background">
			<Stack.Screen options={{ gestureEnabled: true }} />
			<ThemedStatusBar />
			<ScrollView
				className="flex-1"
				contentContainerStyle={{
					alignSelf: "center",
					flexGrow: 1,
					maxWidth: 480,
					paddingHorizontal: horizontalPadding,
					paddingTop: 80,
					paddingBottom: 60,
					width: "100%",
				}}
				keyboardShouldPersistTaps="handled"
				showsVerticalScrollIndicator={false}
			>
				<Header title="Bearbeiten" onBack={closeScreen} />
				<SessionEditForm
					session={session}
					editDate={editDate}
					editStart={editStart}
					editEnd={editEnd}
					editPhase={editPhase}
					isSaving={isBusy}
					onChangeDate={() => setPickerTarget("editDate")}
					onChangeStart={() => setPickerTarget("editStart")}
					onChangeEnd={() => setPickerTarget("editEnd")}
					onChangePhase={setEditPhase}
					onRemove={() => setIsDeleteVisible(true)}
					onSave={saveEdit}
				/>
				{errorMessage ? (
					<Text className="mt-4 font-poppins text-body-4 text-destructive">
						{errorMessage}
					</Text>
				) : null}
			</ScrollView>

			<ActionModal
				visible={isDeleteVisible}
				dismissible
				onClose={() => setIsDeleteVisible(false)}
				accessibilityLabel="Entfernen-Dialog schließen"
				title="Bist du dir sicher?"
				description="Tippe auf Entfernen, wenn du diesen Lerntag wirklich löschen möchtest."
				icon={<X size={48} color="#FF5147" strokeWidth={1.8} />}
				iconContainerClassName="bg-red-100"
			>
				<View
					className={cn("mt-6 gap-3", !shouldStackInlineContent && "flex-row")}
				>
					<Button
						variant="neutral"
						className={
							shouldStackInlineContent
								? "w-full shadow-none"
								: "flex-1 shadow-none"
						}
						onPress={() => setIsDeleteVisible(false)}
					>
						<Text>Abbrechen</Text>
					</Button>
					<Button
						accessibilityLabel={
							isBusy ? "Entfernen, wird geladen" : "Entfernen"
						}
						accessibilityLiveRegion={isBusy ? "polite" : undefined}
						accessibilityState={{ busy: isBusy, disabled: isBusy }}
						className={shouldStackInlineContent ? "w-full" : "flex-1"}
						onPress={confirmDelete}
						disabled={isBusy}
					>
						{isBusy ? (
							<ActivityIndicator color="#FFFFFF" />
						) : (
							<Text>Entfernen</Text>
						)}
					</Button>
				</View>
			</ActionModal>

			{renderPicker()}
		</View>
	);
}

export default function LearningPlanSessionEditScreen() {
	const router = useRouter();
	const { horizontalPadding } = useContentSizeLayout();
	const params = useLocalSearchParams<{
		planId?: string;
		sessionId?: string;
	}>();
	const planId = params.planId as Id<"learningPlans"> | undefined;
	const sessionId = params.sessionId as Id<"learningPlanSessions"> | undefined;
	const { user } = useAuth();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();

	const snapshot = (useQuery(
		api.learningPlans.getSnapshot,
		user && isConvexAuthenticated && planId ? { id: planId } : "skip",
	) ?? null) as LearningPlanSnapshot | null;

	const session = snapshot?.sessions.find((item) => item.id === sessionId) as
		| PlanSession
		| undefined;

	const closeFallback = () => {
		if (planId) {
			router.replace(reviewPath(planId));
			return true;
		}
		goBackOrReplace(router, "/home");
		return true;
	};

	useBackIntent(Boolean(planId), closeFallback);

	if (planId && session) {
		return (
			<LoadedSessionEditScreen
				key={session.id}
				planId={planId}
				session={session}
			/>
		);
	}

	return (
		<View className="flex-1 bg-background">
			<Stack.Screen options={{ gestureEnabled: true }} />
			<ThemedStatusBar />
			<ScrollView
				className="flex-1"
				contentContainerStyle={{
					alignSelf: "center",
					flexGrow: 1,
					maxWidth: 480,
					paddingHorizontal: horizontalPadding,
					paddingTop: 80,
					paddingBottom: 60,
					width: "100%",
				}}
				showsVerticalScrollIndicator={false}
			>
				<Header title="Bearbeiten" onBack={closeFallback} />
				<View className="flex-1 items-center justify-center py-20">
					<ActivityIndicator color="#00BAFF" />
				</View>
			</ScrollView>
		</View>
	);
}
