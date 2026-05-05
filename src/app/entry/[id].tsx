import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
	ArrowLeft,
	BookOpen,
	CalendarDays,
	Clock3,
	NotebookPen,
	Timer,
	Trash2,
} from "~/components/ui/icon";
import type { ReactNode } from "react";
import { Alert, ScrollView, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { useAuth } from "~/context/AuthContext";

function DetailRow({
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
			className="mb-3 rounded-[24px] bg-white px-5 py-4"
			style={{
				borderWidth: 1.2,
				borderColor: "rgba(0,0,0,0.10)",
				shadowColor: "#000000",
				shadowOpacity: 0.05,
				shadowRadius: 7,
				shadowOffset: { width: 0, height: 3 },
				elevation: 2,
			}}
		>
			<View className="mb-2 flex-row items-center">
				{icon}
				<Text className="ml-2 font-bold font-poppins text-12 text-text/56 uppercase">
					{label}
				</Text>
			</View>
			<Text className="font-bold font-poppins text-16 text-text">{value}</Text>
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
				<TouchableOpacity
					activeOpacity={0.75}
					onPress={() => router.back()}
					className="mb-9 h-11 w-11 items-center justify-center rounded-full bg-black/5"
				>
					<ArrowLeft size={20} color="#1A1A1A" strokeWidth={2.3} />
				</TouchableOpacity>

				<View className="mb-8">
					<View className="mb-4 h-14 w-14 items-center justify-center rounded-full bg-primary/12">
						<BookOpen size={27} color="#3A7BFF" strokeWidth={2.2} />
					</View>
					<Text className="font-bold font-poppins text-32 text-text">
						{title}
					</Text>
					{kind ? (
						<Text className="mt-3 font-bold font-poppins text-14 text-primary uppercase">
							{kind}
						</Text>
					) : null}
				</View>

				<DetailRow
					icon={<CalendarDays size={15} color="#3A7BFF" strokeWidth={2.3} />}
					label={kind === "Hausaufgabe" ? "Geplant am" : "Datum"}
					value={plannedDate}
				/>
				<DetailRow
					icon={<BookOpen size={15} color="#3A7BFF" strokeWidth={2.3} />}
					label="Prüfungsart"
					value={examType}
				/>
				<DetailRow
					icon={<Clock3 size={15} color="#3A7BFF" strokeWidth={2.3} />}
					label="Uhrzeit"
					value={time}
				/>
				<DetailRow
					icon={<CalendarDays size={15} color="#3A7BFF" strokeWidth={2.3} />}
					label={kind === "Hausaufgabe" ? "Fällig am" : "Termin"}
					value={dueDate}
				/>
				<DetailRow
					icon={<Timer size={15} color="#3A7BFF" strokeWidth={2.3} />}
					label="Bearbeitungszeit"
					value={duration}
				/>
				<DetailRow
					icon={<NotebookPen size={15} color="#3A7BFF" strokeWidth={2.3} />}
					label="Notiz"
					value={notes}
				/>
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
