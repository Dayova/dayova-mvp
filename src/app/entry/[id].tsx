import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import type { ReactNode } from "react";
import { Alert, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { BackButton, Button } from "~/components/ui/button";
import {
	BookOpen,
	CalendarDays,
	Clock3,
	NotebookPen,
	Timer,
	Trash2,
} from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
import { useAuth } from "~/context/AuthContext";
import { goBackOrReplace } from "~/lib/navigation";

type ParsedNotes = {
	summary: string[];
	tasks: string[];
};

const parseNotes = (value?: string): ParsedNotes => {
	const lines =
		value
			?.split("\n")
			.map((line) => line.trim())
			.filter(Boolean) ?? [];

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
			className="flex-1 rounded-[24px] bg-white px-5 py-5"
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
				<Text className="ml-2 font-bold font-poppins text-11 text-text/50 uppercase">
					{label}
				</Text>
			</View>
			<Text
				className="font-bold font-poppins text-text"
				style={{ fontSize: 15, lineHeight: 20, includeFontPadding: false }}
			>
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
			className="mt-5 rounded-[28px] bg-white px-5 py-5"
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
					<NotebookPen size={18} color="#3A7BFF" strokeWidth={2.2} />
				</View>
				<View className="ml-3">
					<Text className="font-bold font-poppins text-13 text-text/55 uppercase">
						Notizen
					</Text>
					<Text className="mt-0.5 font-poppins text-12 text-text/42">
						Ziele und Aufgaben
					</Text>
				</View>
			</View>

			{summary.map((line) => (
				<Text
					key={line}
					className="mb-3 font-poppins text-[#2D2E34]"
					style={{ fontSize: 15, lineHeight: 22, includeFontPadding: false }}
				>
					{line}
				</Text>
			))}

			{tasks.length ? (
				<View className="mt-1" style={{ rowGap: 10 }}>
					{tasks.map((task) => (
						<View
							key={task}
							className="flex-row rounded-[18px] bg-[#F7F8FB] p-3"
						>
							<View className="mt-1.5 h-2 w-2 rounded-full bg-primary" />
							<Text
								className="ml-3 flex-1 font-poppins text-[#30323A]"
								style={{
									fontSize: 14,
									lineHeight: 21,
									includeFontPadding: false,
								}}
							>
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
	const { user } = useAuth();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const deleteDayEntry = useMutation(api.dayEntries.remove);
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
	const title = entry?.title ?? params.title ?? "Eintrag";
	const kind = entry?.kind ?? params.kind;
	const time = entry?.time ?? params.time;
	const plannedDate =
		entry?.plannedDateLabel ?? params.plannedDate ?? params.day;
	const examType = entry?.examTypeLabel ?? params.examType;
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

	return (
		<View className="flex-1 bg-background">
			<StatusBar style="dark" />
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
					<Text
						className="font-bold font-poppins text-text"
						style={{ fontSize: 31, lineHeight: 37, includeFontPadding: false }}
					>
						{title}
					</Text>
					{kind ? (
						<Text className="mt-3 font-bold font-poppins text-14 text-primary uppercase">
							{kind}
						</Text>
					) : null}
				</View>

				<View style={{ rowGap: 14 }}>
					<View className="flex-row" style={{ columnGap: 14 }}>
						<DetailTile
							icon={
								<CalendarDays size={15} color="#3A7BFF" strokeWidth={2.3} />
							}
							label={kind === "Hausaufgabe" ? "Geplant" : "Datum"}
							value={plannedDate}
						/>
						<DetailTile
							icon={<Clock3 size={15} color="#3A7BFF" strokeWidth={2.3} />}
							label="Uhrzeit"
							value={time}
						/>
					</View>
					<View className="flex-row" style={{ columnGap: 14 }}>
						<DetailTile
							icon={<Timer size={15} color="#3A7BFF" strokeWidth={2.3} />}
							label="Dauer"
							value={duration}
						/>
						<DetailTile
							icon={<BookOpen size={15} color="#3A7BFF" strokeWidth={2.3} />}
							label="Prüfung"
							value={examType}
						/>
					</View>
					<DetailTile
						icon={<CalendarDays size={15} color="#3A7BFF" strokeWidth={2.3} />}
						label={kind === "Hausaufgabe" ? "Fällig am" : "Termin"}
						value={dueDate}
					/>
				</View>

				<NotesCard value={notes} />
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
