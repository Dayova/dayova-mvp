import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { ReactNode } from "react";
import { Alert, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { BackButton, Button } from "~/components/ui/button";
import {
	BookOpen,
	CalendarDays,
	Check,
	Clock3,
	NotebookPen,
	Timer,
	Trash2,
} from "~/components/ui/icon";
import { useContentSizeLayout } from "~/components/ui/portrait-content";
import { Text } from "~/components/ui/text";
import { ThemedStatusBar } from "~/components/ui/themed-status-bar";
import { useAuth } from "~/context/AuthContext";
import { formatGermanUiText } from "~/lib/german-ui-text";
import { goBackOrReplace } from "~/lib/navigation";

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
	const { horizontalPadding } = useContentSizeLayout();
	const { user } = useAuth();
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
	const canDelete = Boolean(entry && id && isDeletableKind);
	const canToggleCompleted = Boolean(entry && id);
	const isCompleted = entry?.completed === true;

	const handleDelete = () => {
		if (!canDelete || !id || !user || !isConvexAuthenticated) return;

		Alert.alert(title, "Möchtest du diesen Eintrag wirklich löschen?", [
			{
				text: "Abbrechen",
				style: "cancel",
			},
			{
				text: "Löschen",
				style: "destructive",
				onPress: async () => {
					const deletedDayKey = await deleteDayEntry({
						id: id as Id<"dayEntries">,
					});
					router.replace(
						`/home${deletedDayKey ? `?dayKey=${encodeURIComponent(deletedDayKey)}` : ""}`,
					);
				},
			},
		]);
	};

	const toggleCompleted = () => {
		if (!canToggleCompleted || !id || !user || !isConvexAuthenticated) return;
		void setDayEntryCompleted({
			id: id as Id<"dayEntries">,
			completed: !isCompleted,
		});
	};

	return (
		<View className="flex-1 bg-background">
			<ThemedStatusBar />
			<ScrollView
				className="flex-1"
				contentContainerStyle={{
					alignSelf: "center",
					maxWidth: 480,
					paddingHorizontal: horizontalPadding,
					paddingTop: 76,
					paddingBottom: Math.max(insets.bottom + 36, 56),
					width: "100%",
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
		</View>
	);
}
