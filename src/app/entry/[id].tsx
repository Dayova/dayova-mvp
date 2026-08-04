import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { type ReactNode, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { BackButton, Button } from "~/components/ui/button";
import { ConfirmationSheet } from "~/components/ui/confirmation-sheet";
import {
	Attachment,
	BookOpen,
	CalendarDays,
	Check,
	Clock3,
	NotebookPen,
	Timer,
	Trash2,
} from "~/components/ui/icon";
import { Surface } from "~/components/ui/surface";
import { Text } from "~/components/ui/text";
import { ThemedStatusBar } from "~/components/ui/themed-status-bar";
import { useAuthSession } from "~/context/AuthContext";
import type { LearningPlanSnapshot } from "~/features/learning-plans/types";
import { createAsyncActionGate } from "~/lib/async-action-gate";
import { formatGermanUiText } from "~/lib/german-ui-text";
import { goBackOrReplace } from "~/lib/navigation";
import { ROUTES } from "~/lib/routes";

type ParsedNotes = {
	summary: string[];
	tasks: string[];
};

const parseNotes = (value?: string): ParsedNotes => {
	const lines = (value ?? "")
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);

	const summary: string[] = [];
	const tasks: string[] = [];
	for (const line of lines) {
		if (line.startsWith("-")) {
			const task = line.replace(/^-\s*/, "").trim();
			if (task) tasks.push(task);
			continue;
		}

		summary.push(line);
	}

	return { summary, tasks };
};

function DetailTile({
	icon,
	label,
	value,
}: {
	icon: ReactNode;
	label: string;
	value?: string;
}) {
	if (!value) return null;

	return (
		<View
			className="flex-1 rounded-[24px] bg-card px-5 py-5"
			style={{
				borderWidth: 1.2,
				borderColor: "rgba(17,24,39,0.07)",
				shadowColor: "#000000",
				shadowOpacity: 0.04,
				shadowRadius: 10,
				shadowOffset: { width: 0, height: 4 },
				elevation: 2,
			}}
		>
			<View className="mb-3 flex-row items-center">
				{icon}
				<Text className="ml-2 font-poppins font-semibold text-body-5 text-text/50 uppercase">
					{label}
				</Text>
			</View>
			<Text className="font-poppins font-semibold text-body-3 text-text">
				{value}
			</Text>
		</View>
	);
}

function NotesCard({ value }: { value?: string }) {
	const { summary, tasks } = parseNotes(value);
	if (!summary.length && !tasks.length) return null;

	return (
		<View
			className="mt-5 rounded-[28px] bg-card px-5 py-5"
			style={{
				borderWidth: 1.2,
				borderColor: "rgba(17,24,39,0.07)",
				shadowColor: "#000000",
				shadowOpacity: 0.05,
				shadowRadius: 12,
				shadowOffset: { width: 0, height: 5 },
				elevation: 2,
			}}
		>
			<View className="mb-4 flex-row items-center">
				<View className="h-9 w-9 items-center justify-center rounded-full bg-primary/10">
					<NotebookPen size={18} color="#00BAFF" strokeWidth={2.2} />
				</View>
				<View className="ml-3">
					<Text className="font-poppins font-semibold text-body-4 text-text/55 uppercase">
						Notizen
					</Text>
					<Text className="mt-1 font-poppins text-body-4 text-text/42">
						Ziele und Aufgaben
					</Text>
				</View>
			</View>

			{summary.map((line) => (
				<Text key={line} className="mb-3 font-poppins text-body-3 text-text">
					{line}
				</Text>
			))}

			{tasks.length ? (
				<View className="mt-1 gap-3">
					{tasks.map((task) => (
						<View key={task} className="flex-row rounded-[18px] bg-muted p-3">
							<View className="mt-2 h-2 w-2 rounded-full bg-primary" />
							<Text className="ml-3 flex-1 font-poppins text-body-3 text-text">
								{task}
							</Text>
						</View>
					))}
				</View>
			) : null}
		</View>
	);
}

export default function EntryDetailScreen() {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const { user } = useAuthSession();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const deleteDayEntry = useMutation(api.dayEntries.remove);
	const setDayEntryCompleted = useMutation(api.dayEntries.setCompleted);
	const params = useLocalSearchParams<{
		id?: string;
		title?: string;
		time?: string;
		day?: string;
		kind?: string;
		notes?: string;
		examType?: string;
		dueDate?: string;
		plannedDate?: string;
		duration?: string;
	}>();
	const id = typeof params.id === "string" ? params.id : "";
	const entry =
		useQuery(
			api.dayEntries.get,
			user && isConvexAuthenticated && id
				? {
						id: id as Id<"dayEntries">,
					}
				: "skip",
		) ?? undefined;
	const relatedLearningPlanId = entry?.relatedLearningPlanId;
	const relatedPlanResult = useQuery(
		api.learningPlans.getSnapshot,
		user && isConvexAuthenticated && relatedLearningPlanId
			? { id: relatedLearningPlanId }
			: "skip",
	) as LearningPlanSnapshot | null | undefined;
	const isRelatedPlanLoading = Boolean(
		relatedLearningPlanId && relatedPlanResult === undefined,
	);
	const relatedPlan = relatedPlanResult ?? null;
	const hasRelatedSchoolMaterial = Boolean(
		relatedPlan?.documents.some((document) => document.sourceKind === "school"),
	);
	const title = formatGermanUiText(entry?.title ?? params.title ?? "Eintrag");
	const kind = entry?.kind ?? params.kind;
	const displayKind = kind ? formatGermanUiText(kind) : undefined;
	const time = entry?.time ?? params.time;
	const plannedDate =
		entry?.plannedDateLabel ?? params.plannedDate ?? params.day;
	const examType = entry?.examTypeLabel ?? params.examType;
	const displayExamType = examType ? formatGermanUiText(examType) : undefined;
	const dueDate = entry?.dueDateLabel ?? params.dueDate;
	const notes = entry?.notes ?? params.notes;
	const duration =
		entry?.durationMinutes || params.duration
			? `${entry?.durationMinutes ?? params.duration} Min.`
			: undefined;
	const isDeletableKind =
		kind === "Hausaufgabe" ||
		kind === "Leistungskontrolle" ||
		Boolean(examType);
	const isExam = kind === "Leistungskontrolle" || Boolean(examType);
	const subject =
		entry?.subject?.trim() ||
		(displayExamType &&
		title
			.toLocaleLowerCase("de-DE")
			.endsWith(displayExamType.toLocaleLowerCase("de-DE"))
			? title.slice(0, -displayExamType.length).trim()
			: title);
	const canDelete = Boolean(entry && id && isDeletableKind);
	const relatedLearningPlanSessionId = entry?.relatedLearningPlanSessionId;
	const canOpenLearningSession = Boolean(
		relatedLearningPlanId && relatedLearningPlanSessionId,
	);
	const canToggleCompleted = Boolean(
		entry && id && !relatedLearningPlanSessionId,
	);
	const isCompleted = entry?.completed === true;
	const [isDeleteVisible, setIsDeleteVisible] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [deleteError, setDeleteError] = useState<string | null>(null);
	const deleteActionGateRef = useRef(createAsyncActionGate());

	const handleDelete = () => {
		if (!canDelete || !id || !user || !isConvexAuthenticated) return;
		setDeleteError(null);
		setIsDeleteVisible(true);
	};

	const confirmDelete = async () => {
		if (!canDelete || !id || !user || !isConvexAuthenticated) {
			return;
		}

		await deleteActionGateRef.current.run(async () => {
			setIsDeleting(true);
			setDeleteError(null);
			try {
				const deletedDayKey = await deleteDayEntry({
					id: id as Id<"dayEntries">,
				});
				setIsDeleteVisible(false);
				router.replace(
					`/home${deletedDayKey ? `?dayKey=${encodeURIComponent(deletedDayKey)}` : ""}`,
				);
			} catch {
				setDeleteError("Bitte versuche es gleich noch einmal.");
			} finally {
				setIsDeleting(false);
			}
		});
	};

	const closeDeleteSheet = () => {
		if (deleteActionGateRef.current.isRunning) return;
		setIsDeleteVisible(false);
		setDeleteError(null);
	};

	const toggleCompleted = () => {
		if (!canToggleCompleted || !id || !user || !isConvexAuthenticated) return;
		void setDayEntryCompleted({
			id: id as Id<"dayEntries">,
			completed: !isCompleted,
		});
	};

	const openLearningPlan = () => {
		if (!entry || !isExam || isRelatedPlanLoading) return;

		if (relatedLearningPlanId) {
			if (relatedPlan?.plan.status === "accepted") {
				router.push(`/learning-plans/${relatedLearningPlanId}`);
				return;
			}
			if (relatedPlan?.plan.status === "generated") {
				router.push(
					relatedPlan.plan.diagnosticPlacement === "firstSession"
						? `/learning-plans/${relatedLearningPlanId}/review`
						: `/learning-plans/${relatedLearningPlanId}/analysis`,
				);
				return;
			}
			if (relatedPlan?.plan.status === "questionsReady") {
				router.push(`/learning-plans/${relatedLearningPlanId}/analysis`);
				return;
			}
		}

		const query = [
			["examDayEntryId", entry.id],
			["subject", subject],
			["examTypeLabel", examType ?? "Leistungskontrolle"],
			["examDateKey", entry.dayKey ?? ""],
			["examDateLabel", plannedDate ?? ""],
			["durationMinutes", String(entry.durationMinutes ?? 45)],
			["learningPlanId", relatedLearningPlanId],
		]
			.filter(([, value]) => value !== undefined && value !== "")
			.map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
			.join("&");
		router.push(`${ROUTES.createLearningPlan}?${query}`);
	};
	const openLearningSession = () => {
		if (!relatedLearningPlanId || !relatedLearningPlanSessionId) return;
		router.push(
			`/learning-plans/${relatedLearningPlanId}/sessions/${relatedLearningPlanSessionId}`,
		);
	};
	const learningPlanActionLabel = isRelatedPlanLoading
		? "Lernplan wird geladen"
		: relatedPlan?.plan.status === "accepted"
			? "Lernplan öffnen"
			: relatedPlan?.plan.status === "generated"
				? relatedPlan.plan.diagnosticPlacement === "firstSession"
					? "Lernplan prüfen"
					: "Vorbereitung aktualisieren"
				: relatedPlan?.plan.status === "questionsReady"
					? "Prüfungsstoff prüfen"
					: relatedLearningPlanId && hasRelatedSchoolMaterial
						? "Vorbereitung fortsetzen"
						: "Material hochladen";

	return (
		<View className="flex-1 bg-background">
			<ThemedStatusBar />
			<ScrollView
				className="flex-1"
				contentContainerStyle={{
					paddingHorizontal: 32,
					paddingTop: 76,
					paddingBottom: Math.max(insets.bottom + 36, 56),
				}}
				showsVerticalScrollIndicator={false}
			>
				<BackButton
					className="mb-8"
					onPress={() => goBackOrReplace(router, "/home")}
				/>

				<View className="mb-8">
					<Text className="font-poppins font-semibold text-heading-1 text-text">
						{title}
					</Text>
					{displayKind ? (
						<Text className="mt-3 font-poppins font-semibold text-body-3 text-primary uppercase">
							{displayKind}
						</Text>
					) : null}
				</View>

				<View className="gap-4">
					<DetailTile
						icon={<CalendarDays size={15} color="#00BAFF" strokeWidth={2.3} />}
						label={kind === "Hausaufgabe" ? "Geplant" : "Datum"}
						value={plannedDate}
					/>
					<DetailTile
						icon={<Clock3 size={15} color="#00BAFF" strokeWidth={2.3} />}
						label="Uhrzeit"
						value={time}
					/>
					<DetailTile
						icon={<Timer size={15} color="#00BAFF" strokeWidth={2.3} />}
						label="Dauer"
						value={duration}
					/>
					<DetailTile
						icon={<BookOpen size={15} color="#00BAFF" strokeWidth={2.3} />}
						label="Prüfung"
						value={displayExamType}
					/>
					<DetailTile
						icon={<CalendarDays size={15} color="#00BAFF" strokeWidth={2.3} />}
						label={kind === "Hausaufgabe" ? "Fällig am" : "Termin"}
						value={dueDate}
					/>
				</View>

				<NotesCard value={notes} />
				{entry && isExam ? (
					<Surface className="mt-5 rounded-[32px] px-5 py-6" variant="soft">
						<View className="flex-row items-start gap-3">
							<View className="h-11 w-11 items-center justify-center rounded-[18px] bg-system-subtle">
								<Attachment size={22} color="#00A0E6" strokeWidth={2.1} />
							</View>
							<View className="min-w-0 flex-1">
								<Text className="font-poppins font-semibold text-body-2 text-text">
									{isRelatedPlanLoading
										? "Lernplan wird geladen"
										: relatedLearningPlanId && hasRelatedSchoolMaterial
											? "Dein persönlicher Lernplan"
											: "Noch kein Lernplan"}
								</Text>
								<Text className="mt-1 font-poppins text-body-4 text-secondary-text">
									{isRelatedPlanLoading
										? "Einen Moment – wir laden den aktuellen Stand deiner Prüfung."
										: relatedLearningPlanId && hasRelatedSchoolMaterial
											? "Öffne den Lernweg oder setze die Vorbereitung mit deinem Material fort."
											: "Lade deine Schulunterlagen hoch. Danach plant Dayova einen Wissenscheck und den nächsten Lerntermin."}
								</Text>
							</View>
						</View>
						<Button
							className="mt-5"
							disabled={isRelatedPlanLoading}
							onPress={openLearningPlan}
						>
							{isRelatedPlanLoading ? (
								<ActivityIndicator color="#FFFFFF" />
							) : (
								<Text>{learningPlanActionLabel}</Text>
							)}
						</Button>
					</Surface>
				) : null}
				{canOpenLearningSession ? (
					<Button className="mt-5" onPress={openLearningSession}>
						<BookOpen size={18} color="#FFFFFF" strokeWidth={2.3} />
						<Text>Lernblock öffnen</Text>
					</Button>
				) : null}
				{canToggleCompleted ? (
					<Button
						className="mt-5"
						variant={isCompleted ? "neutral" : "default"}
						onPress={toggleCompleted}
					>
						<Check
							size={18}
							color={isCompleted ? "#1A1A1A" : "#FFFFFF"}
							strokeWidth={2.3}
						/>
						<Text>
							{isCompleted ? "Als offen markieren" : "Als erledigt markieren"}
						</Text>
					</Button>
				) : null}
				{canDelete ? (
					<Button className="mt-5" variant="destructive" onPress={handleDelete}>
						<Trash2 size={18} color="#FFFFFF" strokeWidth={2.3} />
						<Text>Eintrag löschen</Text>
					</Button>
				) : null}
			</ScrollView>
			<ConfirmationSheet
				visible={isDeleteVisible}
				title={title}
				description="Möchtest du diesen Eintrag wirklich löschen?"
				confirmLabel="Löschen"
				isBusy={isDeleting}
				errorMessage={deleteError}
				onClose={closeDeleteSheet}
				onConfirm={() => void confirmDelete()}
			/>
		</View>
	);
}
