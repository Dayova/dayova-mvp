import DateTimePicker, {
	type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
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
import {
	CalendarDays,
	Check,
	Clock3,
	Plus,
	Trash2,
	X,
} from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
import { useAuth } from "~/context/AuthContext";
import {
	SectionTitle,
	SessionCard,
} from "~/features/learning-plans/learning-plan-ui";
import type {
	LearningPlanSnapshot,
	PickerTarget,
	PlanSession,
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

const planPath = (id: Id<"learningPlans">, step: string) =>
	`/learning-plans/${id}/${step}` as const;

export default function LearningPlanReviewScreen() {
	const router = useRouter();
	const params = useLocalSearchParams<{ planId?: string }>();
	const planId = params.planId as Id<"learningPlans"> | undefined;
	const { user } = useAuth();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const updateSession = useMutation(api.learningPlans.updateSession);
	const addSession = useMutation(api.learningPlans.addSession);
	const removeSession = useMutation(api.learningPlans.removeSession);
	const acceptPlan = useMutation(api.learningPlans.acceptPlan);

	const [isBusy, setIsBusy] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [successDayKey, setSuccessDayKey] = useState<string | null>(null);
	const [editingSession, setEditingSession] = useState<PlanSession | null>(
		null,
	);
	const [deleteSession, setDeleteSession] = useState<PlanSession | null>(null);
	const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);
	const [editDate, setEditDate] = useState(new Date());
	const [editStart, setEditStart] = useState("17:00");
	const [editEnd, setEditEnd] = useState("17:30");

	const snapshot = (useQuery(
		api.learningPlans.getSnapshot,
		user && isConvexAuthenticated && planId ? { id: planId } : "skip",
	) ?? null) as LearningPlanSnapshot | null;

	useEffect(() => {
		if (!planId || !snapshot) return;

		if (
			snapshot.plan.status === "draft" ||
			snapshot.plan.status === "questionsReady"
		) {
			router.replace(planPath(planId, "analysis"));
		}
	}, [planId, router, snapshot]);

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

	const openEdit = (session: PlanSession) => {
		setEditingSession(session);
		setEditDate(parseDateKey(session.dateKey));
		setEditStart(session.startTime);
		setEditEnd(
			timeFromMinutes(
				minutesFromTime(session.startTime) + session.durationMinutes,
			),
		);
	};

	const saveEdit = async () => {
		if (!editingSession || isBusy) return;

		await runWithErrorHandling(
			"Der Lerntag konnte nicht gespeichert werden.",
			async () => {
				const startMinutes = minutesFromTime(editStart);
				const endMinutes = minutesFromTime(editEnd);
				const duration =
					endMinutes > startMinutes
						? endMinutes - startMinutes
						: editingSession.durationMinutes;
				await updateSession({
					id: editingSession.id,
					dateKey: getDateKey(editDate),
					dateLabel: formatDate(editDate),
					startTime: editStart,
					durationMinutes: duration,
				});
				setEditingSession(null);
			},
		);
	};

	const confirmDelete = async () => {
		if (!deleteSession || isBusy) return;

		await runWithErrorHandling(
			"Der Lerntag konnte nicht entfernt werden.",
			async () => {
				await removeSession({ id: deleteSession.id });
				setDeleteSession(null);
				setEditingSession(null);
			},
		);
	};

	const acceptGeneratedPlan = async () => {
		if (!planId || isBusy) return;

		await runWithErrorHandling(
			"Der Lernplan konnte nicht eingetragen werden.",
			async () => {
				const dayKey = await acceptPlan({ learningPlanId: planId });
				setSuccessDayKey(dayKey);
			},
		);
	};

	const addRecommendedSession = async () => {
		if (!planId || isBusy) return;

		await runWithErrorHandling(
			"Der zusätzliche Lerntag konnte nicht erstellt werden.",
			async () => {
				await addSession({ learningPlanId: planId });
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
								accessibilityLabel="Zeitauswahl schließen"
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
						<DateTimePicker
							value={value}
							mode={isDate ? "date" : "time"}
							display="spinner"
							onChange={handlePickerChange}
						/>
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

	const goBack = useCallback(() => {
		if (deleteSession) {
			setDeleteSession(null);
			return true;
		}
		if (editingSession) {
			setEditingSession(null);
			return true;
		}
		if (pickerTarget) {
			setPickerTarget(null);
			return true;
		}
		if (planId) {
			router.replace(planPath(planId, "generating"));
			return true;
		}
		goBackOrReplace(router, "/home");
		return true;
	}, [deleteSession, editingSession, pickerTarget, planId, router]);

	useBackIntent(
		Boolean(deleteSession || editingSession || pickerTarget || planId),
		goBack,
	);

	return (
		<View className="flex-1 bg-[#F5F3F6]">
			<Stack.Screen options={{ gestureEnabled: true }} />
			<StatusBar style="dark" />
			<ScrollView
				className="flex-1"
				contentContainerStyle={{
					paddingHorizontal: 32,
					paddingTop: 80,
					paddingBottom: 60,
				}}
				keyboardShouldPersistTaps="handled"
				showsVerticalScrollIndicator={false}
			>
				<Header title="Lernplan" onBack={goBack} />
				<SectionTitle
					title="Lernplan erstellen"
					description="Passe deine Lerntage an und trage den Plan danach in den Kalender ein."
				/>
				{snapshot?.sessions.map((session) => (
					<SessionCard
						key={session.id}
						session={session}
						onEdit={() => openEdit(session)}
					/>
				))}
				{errorMessage ? (
					<Text className="mb-4 font-poppins text-12 text-destructive">
						{errorMessage}
					</Text>
				) : null}
				<View className="flex-row items-center gap-3">
					<Button
						accessibilityLabel={
							isBusy ? "Lernplan erstellen, wird geladen" : "Lernplan erstellen"
						}
						accessibilityLiveRegion={isBusy ? "polite" : undefined}
						accessibilityState={{
							busy: isBusy,
							disabled: isBusy || !snapshot?.sessions.length,
						}}
						disabled={isBusy || !snapshot?.sessions.length}
						onPress={acceptGeneratedPlan}
						variant="neutral"
						className="h-14 flex-1"
						style={{ minWidth: 0 }}
					>
						{isBusy ? (
							<ActivityIndicator color="#1A1A1A" />
						) : (
							<Text className="font-bold font-poppins text-15 text-text">
								Lernplan erstellen
							</Text>
						)}
					</Button>
					<TouchableOpacity
						accessibilityLabel="Lerntag hinzufügen"
						accessibilityRole="button"
						accessibilityState={{
							disabled: isBusy || !snapshot?.sessions.length,
						}}
						activeOpacity={0.86}
						disabled={isBusy || !snapshot?.sessions.length}
						onPress={addRecommendedSession}
						className="h-14 w-14 items-center justify-center rounded-full bg-primary"
						style={{
							shadowColor: "#3A7BFF",
							shadowOpacity: 0.32,
							shadowRadius: 16,
							shadowOffset: { width: 0, height: 7 },
							elevation: 5,
							opacity: isBusy || !snapshot?.sessions.length ? 0.55 : 1,
						}}
					>
						<Plus size={28} color="#FFFFFF" strokeWidth={2.4} />
					</TouchableOpacity>
				</View>
			</ScrollView>

			<Modal visible={Boolean(editingSession)} transparent animationType="fade">
				<View className="flex-1 justify-end">
					<Pressable
						className="absolute inset-0 bg-black/25"
						onPress={() => setEditingSession(null)}
					/>
					<View className="mx-5 mb-6 rounded-[32px] bg-[#F5F3F6] px-5 pt-5 pb-6">
						<Header
							title="Bearbeiten"
							onBack={() => setEditingSession(null)}
							right={
								<TouchableOpacity
									accessibilityHint="Öffnet die Bestätigung zum Entfernen dieses Lerntags."
									accessibilityLabel="Lerntag entfernen"
									accessibilityRole="button"
									hitSlop={8}
									onPress={() =>
										editingSession && setDeleteSession(editingSession)
									}
									className="h-12 w-12 items-center justify-center rounded-full bg-white"
								>
									<Trash2 size={18} color="#FF5147" strokeWidth={2.3} />
								</TouchableOpacity>
							}
						/>
						<Text className="font-bold font-poppins text-16 text-text">
							{(editingSession?.sortOrder ?? 0) + 1}. Lerntag bearbeiten
						</Text>
						<Text className="mt-2 mb-5 font-poppins text-14 text-text/55">
							Hier kannst du individuell deinen Lernplan anpassen.
						</Text>

						<Text className="mb-3 font-bold font-poppins text-12 text-text">
							Lerndatum
						</Text>
						<TouchableOpacity
							accessibilityLabel="Lerndatum ändern"
							accessibilityRole="button"
							onPress={() => setPickerTarget("editDate")}
							className="mb-3 h-14 flex-row items-center justify-between rounded-[28px] bg-white px-5"
						>
							<Text className="font-poppins text-14 text-text/55">
								{formatDate(editDate)}
							</Text>
							<CalendarDays size={18} color="#3A7BFF" strokeWidth={2.2} />
						</TouchableOpacity>
						<View className="mb-8 flex-row" style={{ columnGap: 8 }}>
							<TouchableOpacity
								accessibilityLabel="Startzeit ändern"
								accessibilityRole="button"
								onPress={() => setPickerTarget("editStart")}
								className="h-14 flex-1 flex-row items-center justify-between rounded-[28px] bg-white px-5"
							>
								<Text className="font-poppins text-14 text-text/55">
									{editStart}
								</Text>
								<Clock3 size={17} color="#A3A3A3" strokeWidth={2.1} />
							</TouchableOpacity>
							<TouchableOpacity
								accessibilityLabel="Endzeit ändern"
								accessibilityRole="button"
								onPress={() => setPickerTarget("editEnd")}
								className="h-14 flex-1 flex-row items-center justify-between rounded-[28px] bg-white px-5"
							>
								<Text className="font-poppins text-14 text-text/55">
									{editEnd}
								</Text>
								<Clock3 size={17} color="#A3A3A3" strokeWidth={2.1} />
							</TouchableOpacity>
						</View>

						<View className="flex-row" style={{ columnGap: 10 }}>
							<Button
								variant="neutral"
								className="flex-1 shadow-none"
								onPress={() =>
									editingSession && setDeleteSession(editingSession)
								}
							>
								<Text className="text-text">Entfernen</Text>
							</Button>
							<Button
								accessibilityLabel={
									isBusy ? "Speichern, wird geladen" : "Speichern"
								}
								accessibilityLiveRegion={isBusy ? "polite" : undefined}
								accessibilityState={{ busy: isBusy, disabled: isBusy }}
								className="flex-1"
								onPress={saveEdit}
								disabled={isBusy}
							>
								{isBusy ? (
									<ActivityIndicator color="#FFFFFF" />
								) : (
									<Text>Speichern</Text>
								)}
							</Button>
						</View>
					</View>
				</View>
			</Modal>

			<Modal visible={Boolean(deleteSession)} transparent animationType="fade">
				<View className="flex-1 justify-end">
					<Pressable
						className="absolute inset-0 bg-black/35"
						onPress={() => setDeleteSession(null)}
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
							Entfernen
						</Text>
						<View className="mt-6 flex-row" style={{ columnGap: 10 }}>
							<Button
								variant="neutral"
								className="flex-1 shadow-none"
								onPress={() => setDeleteSession(null)}
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
								<Text>Entfernen</Text>
							</Button>
						</View>
					</View>
				</View>
			</Modal>

			<Modal visible={Boolean(successDayKey)} transparent animationType="fade">
				<View className="flex-1 justify-end">
					<View className="absolute inset-0 bg-black/30" />
					<View className="mx-8 mb-9 items-center rounded-[30px] bg-white px-5 pt-8 pb-5">
						<View className="mb-6 h-16 w-16 items-center justify-center rounded-full bg-green-100">
							<Check size={31} color="#28C76F" strokeWidth={1.9} />
						</View>
						<Text className="font-bold font-poppins text-18 text-text">
							Lernplan ist eingetragen
						</Text>
						<Text className="mt-2 text-center font-poppins text-12 text-text/45">
							Deine Lernplan wurde erfolgreich eingetragen.
						</Text>
						<Button
							className="mt-6 w-full"
							onPress={() =>
								router.replace(
									`/home${successDayKey ? `?dayKey=${encodeURIComponent(successDayKey)}` : ""}`,
								)
							}
						>
							<Text>Fertig</Text>
						</Button>
					</View>
				</View>
			</Modal>

			{renderPicker()}
		</View>
	);
}
