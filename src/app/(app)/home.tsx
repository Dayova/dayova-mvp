import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { LinearGradient as ExpoLinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import {
	Modal,
	Pressable,
	ScrollView,
	TouchableOpacity,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "#convex/_generated/api";
import {
	DayCarousel,
	type DayCarouselHandle,
	getDayItemFromKey,
} from "~/components/day-carousel";
import { NotificationButton } from "~/components/notification-button";
import {
	ArrowUpRight,
	CheckCircle2,
	ClipboardList,
	Clock3,
	GraduationCap,
	Plus,
	Check,
	X,
} from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
import { useAuth } from "~/context/AuthContext";
import { getDayKey, parseDayKey, useCurrentLocalDay } from "~/lib/day-key";
import type { DayEntry } from "~/types/dayEntries";

const ALL_DAY_TIME_LABEL = "Ganztägig";
const EMPTY_ENTRIES_BY_DAY: Record<string, DayEntry[]> = {};

const timeToMinutes = (timeLabel: string) => {
	if (timeLabel.trim().toLowerCase() === ALL_DAY_TIME_LABEL.toLowerCase()) {
		return 8 * 60;
	}
	const match = /^(\d{1,2}):(\d{2})$/.exec(timeLabel.trim());
	if (!match) return Number.MAX_SAFE_INTEGER;

	return Number(match[1]) * 60 + Number(match[2]);
};

const isLearningSlotEntry = (entry: DayEntry) =>
	/lern/i.test(`${entry.kind ?? ""} ${getEntryTitle(entry)}`);

const isExamEntry = (entry: DayEntry) =>
	/leistungskontrolle|test|klausur|quiz|mündlich|muendlich/i.test(
		`${entry.kind ?? ""} ${getEntryTitle(entry)}`,
	);

const getEntryTitle = (entry: DayEntry) =>
	typeof entry.title === "string" ? entry.title : "";

const getSubjectFromEntry = (entry: DayEntry) => {
	const fromTitle = getEntryTitle(entry)
		.replace(
			/\s*(Hausaufgabe|Leistungskontrolle|Kurzkontrolle|Test\/Klausur|Test|Klausur Deutsch\/Kunst\/Fremdsprache|Klausur|Quiz|Mündliche Prüfung|Muendliche Pruefung|Praktische Prüfung|Praktische Pruefung|Komplexe Leistung|Abschlussprüfung HSA\/Quali\/RSA|Abschlusspruefung HSA\/Quali\/RSA|Vorabi Grundkurs|Vorabi Leistungskurs|Abitur Grundkurs schriftlich|Abitur Leistungskurs schriftlich|Lernen|Lernslot)\s*$/i,
			"",
		)
		.trim();
	if (fromTitle.length > 0) return fromTitle;
	if (!entry.kind) return "Allgemein";
	return entry.kind.replace(/\/Klausur/i, "").trim();
};

const getEntryLabel = (entry: DayEntry) => {
	const subject = getSubjectFromEntry(entry);
	if (isLearningSlotEntry(entry)) return `Lernen ${subject}`;
	return `${isExamEntry(entry) ? "LK" : "HA"} ${subject}`;
};

const getEntryTimeLabel = (entry: DayEntry) => entry.time ?? ALL_DAY_TIME_LABEL;

const getLearningRangeLabel = (entry: DayEntry) => {
	const timeLabel = getEntryTimeLabel(entry);
	const match = /^(\d{1,2}):(\d{2})$/.exec(timeLabel.trim());
	if (!match) return timeLabel;

	const startMinutes = Number(match[1]) * 60 + Number(match[2]);
	const endMinutes = startMinutes + (entry.durationMinutes ?? 45);
	const endHour = Math.floor((endMinutes % (24 * 60)) / 60);
	const endMinute = endMinutes % 60;
	return `${timeLabel} - ${endHour.toString().padStart(2, "0")}:${endMinute.toString().padStart(2, "0")}`;
};

export default function HomeScreen() {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const params = useLocalSearchParams<{ dayKey?: string }>();
	const { user } = useAuth();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const setSessionCompleted = useMutation(
		api.learningPlans.setSessionCompleted,
	);
	const [showCreateTypePicker, setShowCreateTypePicker] = useState(false);
	const [isReturningToToday, setIsReturningToToday] = useState(false);
	const dayCarouselRef = useRef<DayCarouselHandle | null>(null);
	const today = useCurrentLocalDay();
	const todayKey = getDayKey(today);
	const initialDayKey = (() => {
		const initialDate =
			typeof params.dayKey === "string" ? parseDayKey(params.dayKey) : null;
		return getDayKey(initialDate ?? today);
	})();
	const [selectedDayKey, setSelectedDayKey] = useState(initialDayKey);
	const selectedDay = getDayItemFromKey(selectedDayKey, today);
	const selectedDayQueryKeys = useMemo(() => {
		const selectedDate = parseDayKey(selectedDayKey);
		const legacyIsoDayKey = selectedDate?.toISOString();

		return legacyIsoDayKey && legacyIsoDayKey !== selectedDayKey
			? [selectedDayKey, legacyIsoDayKey]
			: [selectedDayKey];
	}, [selectedDayKey]);
	const entriesByDayResult = useQuery(
		api.dayEntries.listByDayKeys,
		user && isConvexAuthenticated
			? {
					dayKeys: selectedDayQueryKeys,
				}
			: "skip",
	);
	const entriesByDay = entriesByDayResult ?? EMPTY_ENTRIES_BY_DAY;
	const isSelectedToday = selectedDayKey === todayKey;
	const selectedEntries = useMemo(
		() => selectedDayQueryKeys.flatMap((dayKey) => entriesByDay[dayKey] ?? []),
		[entriesByDay, selectedDayQueryKeys],
	);
	const sortedSelectedEntries = useMemo(
		() =>
			[...selectedEntries].sort(
				(a, b) =>
					timeToMinutes(getEntryTimeLabel(a)) -
					timeToMinutes(getEntryTimeLabel(b)),
			),
		[selectedEntries],
	);
	const selectedDate = parseDayKey(selectedDayKey) ?? today;
	const monthLabel = new Intl.DateTimeFormat("de-DE", {
		month: "long",
	}).format(selectedDate);
	const visibleEntries = sortedSelectedEntries.slice(0, 4);
	const featuredEntry = useMemo(
		() =>
			sortedSelectedEntries.find(isLearningSlotEntry) ??
			sortedSelectedEntries[0] ??
			null,
		[sortedSelectedEntries],
	);
	const featuredSubject = featuredEntry
		? getSubjectFromEntry(featuredEntry)
		: "";
	const featuredDurationLabel = featuredEntry?.durationMinutes
		? `${featuredEntry.durationMinutes}min`
		: null;
	const heroHeadline = featuredEntry
		? `Heute musst du für ${featuredSubject} lernen!`
		: "Heute stehen keine Aufgaben an";
	const taskSummary = `${sortedSelectedEntries.length} ${
		sortedSelectedEntries.length === 1 ? "Aufgabe" : "Aufgaben"
	}`;
	const firstName =
		typeof user?.name === "string" && user.name.trim().length > 0
			? user.name.trim().split(/\s+/)[0]
			: "Fabius";

	const getEntryUrl = (entry: DayEntry) => {
		if (
			entry.relatedLearningPlanId &&
			entry.relatedLearningPlanSessionId === entry.id
		) {
			return `/learning-plans/${encodeURIComponent(entry.relatedLearningPlanId)}`;
		}

		const dayLabel = selectedDay
			? `${selectedDay.fullLabel} ${selectedDay.dayOfMonth}`
			: "";
		const details: Array<[string, string]> = [
			["title", getEntryTitle(entry) || getEntryLabel(entry)],
			["day", dayLabel],
		];
		if (entry.kind) details.push(["kind", entry.kind]);
		if (entry.notes) details.push(["notes", entry.notes]);
		if (entry.examTypeLabel) details.push(["examType", entry.examTypeLabel]);
		if (entry.dueDateLabel) details.push(["dueDate", entry.dueDateLabel]);
		if (entry.plannedDateLabel) {
			details.push(["plannedDate", entry.plannedDateLabel]);
		}
		if (entry.durationMinutes) {
			details.push(["duration", `${entry.durationMinutes}`]);
		}
		if (entry.time) details.push(["time", entry.time]);
		const query = details
			.map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
			.join("&");

		return `/entry/${encodeURIComponent(entry.id)}?${query}`;
	};

	const getCreateEntryUrl = (type: "homework" | "exam") =>
		`/entry/new?type=${type}&dayKey=${encodeURIComponent(selectedDay?.key ?? "")}&dayLabel=${encodeURIComponent(
			selectedDay ? `${selectedDay.fullLabel} ${selectedDay.dayOfMonth}` : "",
		)}`;

	const selectCreateType = (type: "homework" | "exam") => {
		setShowCreateTypePicker(false);
		router.push(getCreateEntryUrl(type));
	};

	const toggleEntryCompleted = (entry: DayEntry) => {
		if (!entry.relatedLearningPlanSessionId) return;
		void setSessionCompleted({
			sessionId: entry.relatedLearningPlanSessionId,
			completed: !entry.completed,
		});
	};

	const returnToToday = () => {
		if (isReturningToToday) return;

		setIsReturningToToday(true);
		setSelectedDayKey(todayKey);
		requestAnimationFrame(() => {
			dayCarouselRef.current?.scrollToDay(todayKey, true);
		});
	};

	useEffect(() => {
		if (typeof params.dayKey === "string" && params.dayKey) {
			const nextDate = parseDayKey(params.dayKey);
			if (!nextDate) return;

			const nextDayKey = getDayKey(nextDate);
			const frame = requestAnimationFrame(() => {
				setSelectedDayKey(nextDayKey);
				dayCarouselRef.current?.scrollToDay(nextDayKey, true);
			});

			return () => cancelAnimationFrame(frame);
		}
	}, [params.dayKey]);

	useEffect(() => {
		if (!isReturningToToday || selectedDayKey !== todayKey) return;

		const timeoutId = setTimeout(() => {
			setIsReturningToToday(false);
		}, 120);

		return () => clearTimeout(timeoutId);
	}, [isReturningToToday, selectedDayKey, todayKey]);

	return (
		<View className="flex-1" style={{ backgroundColor: "#F6F4F7" }}>
			<StatusBar style="dark" />
			<ScrollView
				className="flex-1"
				contentInsetAdjustmentBehavior="automatic"
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{
					paddingTop: Math.max(insets.top + 12, 20),
					paddingBottom: Math.max(insets.bottom + 120, 150),
					paddingHorizontal: 24,
					rowGap: 22,
				}}
			>
				<View className="flex-row items-start justify-between">
					<View className="max-w-[230px]">
						<Text
							className="font-bold font-poppins text-[#17171C]"
							style={{
								fontSize: 26,
								lineHeight: 27,
								includeFontPadding: false,
							}}
						>
							{`Hi ${firstName}, schön`}
						</Text>
						<Text
							className="font-bold font-poppins text-[#8D8F98]"
							style={{
								fontSize: 26,
								lineHeight: 27,
								includeFontPadding: false,
							}}
						>
							{`das du da bist`}
						</Text>
					</View>

					<NotificationButton />
				</View>

				<View>
					<ExpoLinearGradient
						colors={["#6AA4FF", "#4F8EF6"]}
						start={{ x: 0, y: 0 }}
						end={{ x: 1, y: 1 }}
						style={{
							borderRadius: 34,
							paddingHorizontal: 20,
							paddingTop: 18,
							paddingBottom: 18,
							minHeight: 232,
							boxShadow: "0 20px 36px rgba(79, 142, 246, 0.22)",
						}}
					>
						{featuredDurationLabel ? (
							<View
								className="self-start rounded-full px-5 py-3"
								style={{ backgroundColor: "rgba(255,255,255,0.24)" }}
							>
								<View className="flex-row items-center">
									<Clock3 size={16} color="#FFFFFF" strokeWidth={2.1} />
									<Text
										className="ml-2 font-poppins text-white"
										style={{
											fontSize: 19,
											lineHeight: 22,
											includeFontPadding: false,
										}}
									>
										{featuredDurationLabel}
									</Text>
								</View>
							</View>
						) : null}

						<View className="mt-7 max-w-[215px]">
							<Text
								className="font-bold font-poppins text-white"
								style={{
									fontSize: 23,
									lineHeight: 24,
									includeFontPadding: false,
								}}
							>
								{heroHeadline}
							</Text>
						</View>

						<View className="mt-7 flex-row items-center justify-between">
							{featuredEntry ? (
								<TouchableOpacity
									accessibilityLabel={`${getEntryLabel(featuredEntry)} ${featuredEntry.completed ? "als offen markieren" : "als erledigt markieren"}`}
									accessibilityRole="button"
									accessibilityState={{ checked: featuredEntry.completed }}
									activeOpacity={0.88}
									onPress={() => toggleEntryCompleted(featuredEntry)}
									className="h-14 w-14 items-center justify-center rounded-full bg-white"
									style={{ boxShadow: "0 10px 18px rgba(0,0,0,0.10)" }}
								>
									{featuredEntry.completed ? (
										<Check size={23} color="#28C76F" strokeWidth={2.8} />
									) : (
										<CheckCircle2 size={22} color="#1A1A1A" strokeWidth={2.3} />
									)}
								</TouchableOpacity>
							) : (
								<View style={{ width: 56 }} />
							)}

							<TouchableOpacity
								accessibilityLabel={
									featuredEntry
										? `${getEntryLabel(featuredEntry)} öffnen`
										: "Neuen Eintrag erstellen"
								}
								accessibilityRole="button"
								activeOpacity={0.9}
								onPress={() =>
									featuredEntry
										? router.push(getEntryUrl(featuredEntry))
										: setShowCreateTypePicker(true)
								}
								className="h-14 w-14 items-center justify-center rounded-full bg-white"
								style={{ boxShadow: "0 10px 18px rgba(0,0,0,0.10)" }}
							>
								<ArrowUpRight size={22} color="#1A1A1A" strokeWidth={2.3} />
							</TouchableOpacity>
						</View>
					</ExpoLinearGradient>

					<View
						className="mt-3 flex-row items-center justify-center"
						style={{ columnGap: 6 }}
					>
						<View
							className="rounded-full"
							style={{ width: 22, height: 7, backgroundColor: "#1A1A1A" }}
						/>
						<View
							className="rounded-full"
							style={{ width: 7, height: 7, backgroundColor: "#A9ADB8" }}
						/>
						<View
							className="rounded-full"
							style={{ width: 7, height: 7, backgroundColor: "#D5D8E0" }}
						/>
					</View>
				</View>

				<View
					className="rounded-[34px] bg-white px-6 pt-6 pb-6"
					style={{
						borderWidth: 1,
						borderColor: "rgba(17,24,39,0.05)",
						boxShadow: "0 16px 35px rgba(19, 28, 45, 0.08)",
					}}
				>
					<View className="flex-row items-start justify-between">
						<View>
							<Text
								className="font-bold font-poppins text-[#17171C]"
								style={{
									fontSize: 22,
									lineHeight: 24,
									includeFontPadding: false,
								}}
							>
								{monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}
							</Text>
							<Text
								className="mt-1 font-poppins text-[#9599A4]"
								style={{
									fontSize: 13,
									lineHeight: 18,
									includeFontPadding: false,
								}}
							>
								{taskSummary}
							</Text>
						</View>

						<TouchableOpacity
							accessibilityLabel="Neuen Eintrag erstellen"
							accessibilityRole="button"
							activeOpacity={0.9}
							onPress={() => setShowCreateTypePicker(true)}
							className="h-14 w-14 items-center justify-center rounded-full bg-[#17171C]"
							style={{ boxShadow: "0 14px 28px rgba(23, 23, 28, 0.18)" }}
						>
							<Plus size={24} color="#FFFFFF" strokeWidth={2.5} />
						</TouchableOpacity>
					</View>

					<View className="mt-4">
						<DayCarousel
							ref={dayCarouselRef}
							initialDayKey={initialDayKey}
							onSelectedDayChange={(day) => setSelectedDayKey(day.key)}
							selectedDayKey={selectedDayKey}
						/>
					</View>

					<View className="mt-6" style={{ rowGap: 18 }}>
						{visibleEntries.length > 0 ? (
							visibleEntries.map((entry, index) => (
								<TouchableOpacity
									key={entry.id}
									accessibilityHint="Öffnet die Details dieses Eintrags."
									accessibilityLabel={`${getEntryLabel(entry)}, ${
										isLearningSlotEntry(entry)
											? getLearningRangeLabel(entry)
											: getEntryTimeLabel(entry)
									}`}
									accessibilityRole="button"
									activeOpacity={0.88}
									onPress={() => router.push(getEntryUrl(entry))}
									className="rounded-[26px] bg-white px-6 py-6"
									style={{
										borderWidth: 1,
										borderColor: "rgba(17,24,39,0.05)",
										boxShadow: "0 10px 24px rgba(20, 28, 48, 0.07)",
									}}
								>
									<View className="flex-row items-center justify-between">
										<View className="flex-1 flex-row items-center">
											<View
												className="mr-5 h-14 w-1 rounded-full"
												style={{
													backgroundColor:
														index % 2 === 0 ? "#79DFC7" : "#FFB380",
												}}
											/>
											<View className="flex-1">
												<Text
													className="font-poppins font-semibold text-[#202127]"
													style={{
														fontSize: 16,
														lineHeight: 20,
														includeFontPadding: false,
													}}
												>
													{getEntryLabel(entry)}
												</Text>
												<View className="mt-1 flex-row items-center">
													<Clock3 size={12} color="#9A9DA8" strokeWidth={2.1} />
													<Text
														className="ml-1.5 font-poppins text-[#9A9DA8]"
														style={{
															fontSize: 12,
															lineHeight: 16,
															includeFontPadding: false,
														}}
													>
														{isLearningSlotEntry(entry)
															? getLearningRangeLabel(entry)
															: getEntryTimeLabel(entry)}
													</Text>
												</View>
											</View>
										</View>

										<TouchableOpacity
											accessibilityLabel={`${getEntryLabel(entry)} ${entry.completed ? "als offen markieren" : "als erledigt markieren"}`}
											accessibilityRole="checkbox"
											accessibilityState={{ checked: entry.completed }}
											activeOpacity={0.82}
											disabled={!entry.relatedLearningPlanSessionId}
											onPress={(event) => {
												event.stopPropagation();
												toggleEntryCompleted(entry);
											}}
											className="ml-4 h-11 w-11 items-center justify-center rounded-full"
											style={{
												borderWidth: 1,
												borderColor: entry.completed
													? "rgba(40,199,111,0.24)"
													: "rgba(17,24,39,0.08)",
												backgroundColor: entry.completed
													? "#EAFBF1"
													: "#FFFFFF",
											}}
										>
											{entry.completed ? (
												<Check size={19} color="#28C76F" strokeWidth={2.8} />
											) : (
												<CheckCircle2
													size={19}
													color="#202127"
													strokeWidth={2.2}
												/>
											)}
										</TouchableOpacity>
									</View>
								</TouchableOpacity>
							))
						) : (
							<View className="rounded-[24px] bg-[#F7F8FB] px-5 py-6">
								<Text
									className="text-center font-poppins font-semibold text-[#202127]"
									style={{
										fontSize: 16,
										lineHeight: 21,
										includeFontPadding: false,
									}}
								>
									Keine Aufgaben
								</Text>
							</View>
						)}
					</View>
				</View>
			</ScrollView>

			<Modal
				visible={showCreateTypePicker}
				transparent
				animationType="fade"
				onRequestClose={() => setShowCreateTypePicker(false)}
			>
				<View className="flex-1 justify-end">
					<Pressable
						className="absolute inset-0 bg-black/25"
						onPress={() => setShowCreateTypePicker(false)}
					/>
					<View
						className="mx-5 mb-7 rounded-[32px] bg-white px-5 pt-5 pb-6"
						style={{
							borderWidth: 1,
							borderColor: "rgba(0,0,0,0.08)",
							boxShadow: "0 20px 34px rgba(0,0,0,0.16)",
						}}
					>
						<View className="mb-4 flex-row items-start justify-between">
							<View className="flex-1 pr-4">
								<Text className="font-bold font-poppins text-24 text-text">
									Was möchtest du planen?
								</Text>
								<Text className="mt-2 font-poppins text-14 text-text/65">
									Wähle zuerst die Art aus.
								</Text>
							</View>
							<TouchableOpacity
								accessibilityLabel="Auswahl schließen"
								accessibilityRole="button"
								hitSlop={8}
								activeOpacity={0.75}
								onPress={() => setShowCreateTypePicker(false)}
								className="h-11 w-11 items-center justify-center rounded-full bg-black/5"
							>
								<X size={18} color="#1A1A1A" strokeWidth={2.3} />
							</TouchableOpacity>
						</View>

						<TouchableOpacity
							accessibilityHint="Startet den Dialog zum Eintragen einer neuen Hausaufgabe."
							accessibilityLabel="Neue Hausaufgabe"
							accessibilityRole="button"
							activeOpacity={0.86}
							className="mb-3 min-h-[88px] flex-row items-center rounded-[24px] border border-black/10 bg-white px-5 py-4"
							onPress={() => selectCreateType("homework")}
						>
							<View className="h-11 w-11 items-center justify-center rounded-full bg-primary/12">
								<ClipboardList size={22} color="#3A7BFF" strokeWidth={2.2} />
							</View>
							<View className="ml-3 flex-1">
								<Text className="font-bold font-poppins text-16 text-text">
									Neue Hausaufgabe
								</Text>
								<Text className="mt-1 font-poppins text-12 text-text/58">
									Fälligkeit, Fach und Lernzeit planen.
								</Text>
							</View>
						</TouchableOpacity>

						<TouchableOpacity
							accessibilityHint="Startet den Dialog zum Eintragen einer neuen Leistungskontrolle."
							accessibilityLabel="Neue Leistungskontrolle"
							accessibilityRole="button"
							activeOpacity={0.86}
							className="min-h-[88px] flex-row items-center rounded-[24px] border border-black/10 bg-white px-5 py-4"
							onPress={() => selectCreateType("exam")}
						>
							<View className="h-11 w-11 items-center justify-center rounded-full bg-primary/12">
								<GraduationCap size={23} color="#3A7BFF" strokeWidth={2.2} />
							</View>
							<View className="ml-3 flex-1">
								<Text className="font-bold font-poppins text-16 text-text">
									Neue Leistungskontrolle
								</Text>
								<Text className="mt-1 font-poppins text-12 text-text/58">
									Datum, Fach und Prüfungsart eintragen.
								</Text>
							</View>
						</TouchableOpacity>
					</View>
				</View>
			</Modal>
		</View>
	);
}
