import DateTimePicker, {
	type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useState } from "react";
import {
	ActivityIndicator,
	Modal,
	Platform,
	Pressable,
	ScrollView,
	TouchableOpacity,
	View,
} from "react-native";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { ScreenHeader as Header } from "~/components/screen-header";
import { Button } from "~/components/ui/button";
import { X } from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
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

		if (Platform.OS === "ios") {
			return (
				<View className="absolute inset-0 z-50 justify-end">
					<Pressable
						className="absolute inset-0 bg-black/30"
						onPress={() => setPickerTarget(null)}
					/>
					<View className="rounded-t-[32px] bg-white px-4 pt-3 pb-7">
						<View className="mb-1 flex-row justify-end">
							<TouchableOpacity
								accessibilityLabel="Auswahl schließen"
								accessibilityRole="button"
								hitSlop={8}
								onPress={() => setPickerTarget(null)}
								className="px-3 py-2"
							>
								<Text className="font-bold font-poppins text-16 text-primary">
									Fertig
								</Text>
							</TouchableOpacity>
						</View>
						<View className="items-center">
							<DateTimePicker
								value={value}
								mode={isDate ? "date" : "time"}
								display="spinner"
								onChange={handlePickerChange}
							/>
						</View>
					</View>
				</View>
			);
		}

		return (
			<DateTimePicker
				value={value}
				mode={isDate ? "date" : "time"}
				display="default"
				onChange={handlePickerChange}
			/>
		);
	};

	return (
		<View className="flex-1 bg-[#F5F3F6]">
			<Stack.Screen options={{ gestureEnabled: true }} />
			<StatusBar style="dark" />
			<ScrollView
				className="flex-1"
				contentContainerStyle={{
					flexGrow: 1,
					paddingHorizontal: 32,
					paddingTop: 80,
					paddingBottom: 60,
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
					<Text className="mt-4 font-poppins text-12 text-destructive">
						{errorMessage}
					</Text>
				) : null}
			</ScrollView>

			<Modal visible={isDeleteVisible} transparent animationType="fade">
				<View className="flex-1 justify-end">
					<Pressable
						className="absolute inset-0 bg-black/35"
						onPress={() => setIsDeleteVisible(false)}
					/>
					<View className="mx-8 mb-9 items-center rounded-[30px] bg-white px-5 pt-7 pb-5">
						<View className="mb-5 h-16 w-16 items-center justify-center rounded-full bg-red-100">
							<X size={31} color="#FF5147" strokeWidth={1.8} />
						</View>
						<Text className="font-bold font-poppins text-18 text-text">
							Bist du dir sicher?
						</Text>
						<Text className="mt-2 text-center font-poppins text-12 text-text/45">
							Klicke auf Entfernen wenn du dir sicher bist den Lerntag zu
							entfernen.
						</Text>
						<View className="mt-6 flex-row" style={{ columnGap: 10 }}>
							<Button
								variant="neutral"
								className="flex-1 shadow-none"
								onPress={() => setIsDeleteVisible(false)}
							>
								<Text className="text-text">Abbrechen</Text>
							</Button>
							<Button
								accessibilityLabel={
									isBusy ? "Entfernen, wird geladen" : "Entfernen"
								}
								accessibilityLiveRegion={isBusy ? "polite" : undefined}
								accessibilityState={{ busy: isBusy, disabled: isBusy }}
								className="flex-1"
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
					</View>
				</View>
			</Modal>

			{renderPicker()}
		</View>
	);
}

export default function LearningPlanSessionEditScreen() {
	const router = useRouter();
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
		<View className="flex-1 bg-[#F5F3F6]">
			<Stack.Screen options={{ gestureEnabled: true }} />
			<StatusBar style="dark" />
			<ScrollView
				className="flex-1"
				contentContainerStyle={{
					flexGrow: 1,
					paddingHorizontal: 32,
					paddingTop: 80,
					paddingBottom: 60,
				}}
				showsVerticalScrollIndicator={false}
			>
				<Header title="Bearbeiten" onBack={closeFallback} />
				<View className="flex-1 items-center justify-center py-20">
					<ActivityIndicator color="#3A7BFF" />
				</View>
			</ScrollView>
		</View>
	);
}
