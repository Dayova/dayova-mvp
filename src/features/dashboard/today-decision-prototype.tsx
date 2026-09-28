/**
 * THROWAWAY decision demo: can Today provide one obvious next action while
 * Plans keeps the complete overview? One agreed design, switchable learner states.
 * Job: start or resume learning. Hierarchy: next action > day choice > remaining work.
 * Primary action: create/finish a plan or start/resume its next block.
 * Friction removed: progress carousel, large calendar/header, duplicate hero item.
 * All actions use fixtures in memory; no auth, backend, analytics or purchases.
 */
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AddIcon } from "~/components/ui/add-icon";
import { Button } from "~/components/ui/button";
import { DayovaSheetFrame } from "~/components/ui/dayova-sheet-frame";
import {
	ArrowRight,
	BookOpen,
	Check,
	Clock3,
	Dumbbell,
	Home,
	Settings,
} from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
import { ThemedStatusBar } from "~/components/ui/themed-status-bar";
import { useDayovaTheme } from "~/lib/theme";
import { cn } from "~/lib/utils";
import type { DayEntry } from "~/types/dayEntries";
import { EMPTY_DASHBOARD_PRIMARY_ACTION } from "./dashboard-empty-state";
import { DashboardNextStepCard } from "./dashboard-product-cards";

const STATES = [
	"Bereit",
	"Neu",
	"Begonnen",
	"Fortsetzen",
	"Erledigt",
	"Lernfrei",
	"Fehler",
] as const;
type DemoState = (typeof STATES)[number];
type Block = {
	id: string;
	subject: string;
	title: string;
	minutes: number;
	day: number;
};
const BLOCKS: Block[] = [
	{
		id: "math",
		subject: "Mathematik",
		title: "Den y-Achsenabschnitt bestimmen",
		minutes: 20,
		day: 0,
	},
	{
		id: "bio",
		subject: "Biologie",
		title: "Aufbau der Zelle wiederholen",
		minutes: 15,
		day: 0,
	},
	{
		id: "english",
		subject: "Englisch",
		title: "Simple Past üben",
		minutes: 10,
		day: 0,
	},
	{
		id: "math-next",
		subject: "Mathematik",
		title: "Lineare Funktionen anwenden",
		minutes: 15,
		day: 1,
	},
	{
		id: "bio-next",
		subject: "Biologie",
		title: "Zellorganellen zuordnen",
		minutes: 15,
		day: 2,
	},
];
const DAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const DATES = [28, 29, 30, 1, 2, 3, 4];

export function TodayDecisionPrototype() {
	const { colors } = useDayovaTheme();
	const insets = useSafeAreaInsets();
	const [state, setState] = useState<DemoState>("Bereit");
	const [tab, setTab] = useState("Heute");
	const [day, setDay] = useState(0);
	const [completed, setCompleted] = useState<string[]>([]);
	const [active, setActive] = useState<Block | null>(null);
	const [modal, setModal] = useState<"states" | "create" | "learn" | null>(
		null,
	);
	const hasPlan = !["Neu", "Begonnen"].includes(state);
	const todayBlocks = BLOCKS.filter(
		(block) => block.day === 0 && !completed.includes(block.id),
	);
	const finished =
		state === "Erledigt" || (hasPlan && todayBlocks.length === 0);
	const resting = state === "Lernfrei";
	const next = resting
		? BLOCKS[3]
		: state === "Fortsetzen" && active && !completed.includes(active.id)
			? active
			: todayBlocks[0];
	const selectedBlocks = BLOCKS.filter(
		(block) =>
			block.day === day &&
			!completed.includes(block.id) &&
			!(day === 0 && (finished || resting)) &&
			!(day === 0 && block.id === next?.id),
	);
	const dayTitle =
		day === 0
			? "Außerdem heute"
			: day === 1
				? "Morgen"
				: `${DAYS[day]}, ${DATES[day]}. ${day < 3 ? "September" : "Oktober"}`;
	const begin = (block: Block) => {
		setActive(block);
		setState("Fortsetzen");
		setModal("learn");
	};
	const chooseState = (value: DemoState) => {
		setState(value);
		setCompleted([]);
		setActive(null);
		setDay(0);
		setTab("Heute");
		setModal(null);
	};
	const noPlan = state === "Neu" || state === "Begonnen";
	const heroTitle =
		state === "Neu"
			? "Dein erster Lernplan"
			: state === "Begonnen"
				? "Dein Lernplan wartet auf dich"
				: state === "Fehler"
					? "Dein Lernschritt konnte nicht geladen werden"
					: finished
						? "Für heute geschafft!"
						: resting
							? "Heute ist nichts eingeplant"
							: next?.title;
	const heroCopy =
		state === "Neu"
			? "Für welche Prüfung möchtest du lernen? Erstelle aus deinen Unterlagen einen persönlichen Lernplan."
			: state === "Begonnen"
				? "Mathematik ist schon angelegt. Füge jetzt deine Unterlagen hinzu, um deinen Plan fertigzustellen."
				: state === "Fehler"
					? "Versuche es noch einmal. Dein Lernplan bleibt gespeichert."
					: finished
						? "Deine geplanten Lernblöcke sind erledigt. Morgen geht es mit Mathematik weiter."
						: resting
							? "Dein nächster Lernblock ist morgen. Wenn du möchtest, kannst du schon jetzt beginnen."
							: next?.subject === "Mathematik"
								? "Für deine Matheprüfung am Freitag"
								: `Aus deinem Lernplan für ${next?.subject}`;
	const heroAction =
		state === "Neu"
			? "Lernplan erstellen"
			: state === "Begonnen"
				? "Lernplan fertigstellen"
				: state === "Fehler"
					? "Erneut versuchen"
					: finished
						? "Lernpläne ansehen"
						: resting
							? "Nächsten Lernblock öffnen"
							: state === "Fortsetzen"
								? "Weiterlernen"
								: "Jetzt starten";
	const act = () => {
		if (noPlan) setModal("create");
		else if (state === "Fehler") setState("Bereit");
		else if (finished) setTab("Pläne");
		else if (next) begin(next);
	};

	return (
		<View className="flex-1 bg-background">
			<ThemedStatusBar />
			<ScrollView
				contentInsetAdjustmentBehavior="never"
				contentContainerStyle={{
					paddingTop: insets.top + 16,
					paddingBottom: 24,
				}}
			>
				<View className="mx-auto w-full max-w-xl gap-6 px-6">
					<View className="flex-row flex-wrap items-center justify-between gap-2">
						<View>
							<Text className="text-body-4 text-secondary-text">
								Montag, 28. September
							</Text>
							<Text
								accessibilityRole="header"
								className="font-semibold text-heading-2"
							>
								{tab}
							</Text>
						</View>
						{tab !== "Einstellungen" && (
							<Pressable
								accessibilityRole="button"
								className="min-h-12 flex-row items-center gap-2 active:opacity-80"
								accessibilityLabel="Neuen Lernplan erstellen"
								onPress={() => setModal("create")}
							>
								<Text className="text-body-4 text-secondary-text">
									Lernplan
								</Text>
								<AddIcon outlinedGradient />
							</Pressable>
						)}
					</View>
					{tab === "Heute" ? (
						<>
							{next &&
							hasPlan &&
							!finished &&
							!resting &&
							state !== "Fehler" ? (
								<DashboardNextStepCard
									mode="screen"
									layout="stacked"
									isLoading={false}
									todayKey="2026-09-28"
									item={{
										dayKey: `2026-09-${28 + next.day}`,
										kind: "learningSession",
										startMinutes: null,
										endMinutes: null,
										entry: {
											id: next.id as DayEntry["id"],
											title: `${next.subject}: ${next.title}`,
											durationMinutes: next.minutes,
											executionStatus:
												state === "Fortsetzen" ? "started" : "notStarted",
										},
									}}
									fallbackAction={EMPTY_DASHBOARD_PRIMARY_ACTION}
									onOpenFallback={() => setModal("create")}
									onOpenItem={() => begin(next)}
								/>
							) : (
								<View className="gap-4 rounded-card border border-border bg-system-subtle p-6">
									<View className="flex-row items-center gap-2">
										<BookOpen size={18} color={colors.primaryStrong} />
										<Text className="font-semibold text-body-3 text-primary-strong">
											{noPlan
												? "Dein Einstieg"
												: finished
													? "Heute erledigt"
													: "Dein nächster Lernschritt"}
										</Text>
									</View>
									{hasPlan && !finished && !resting && state !== "Fehler" && (
										<Text className="text-body-3 text-secondary-text">
											{next?.subject}
										</Text>
									)}
									<Text
										accessibilityRole="header"
										className="font-semibold text-heading-2"
									>
										{heroTitle}
									</Text>
									<Text className="text-body-3 text-secondary-text">
										{heroCopy}
									</Text>
									{hasPlan && !finished && state !== "Fehler" && (
										<View className="flex-row items-center gap-2">
											<Clock3 size={16} color={colors.secondaryText} />
											<Text className="text-body-3 text-secondary-text">
												Etwa {next?.minutes} Minuten
												{state === "Fortsetzen" ? " · Schon begonnen" : ""}
											</Text>
										</View>
									)}
									<Button onPress={act}>
										<Text>{heroAction}</Text>
										<ArrowRight size={20} color="white" />
									</Button>
								</View>
							)}
							{hasPlan && state !== "Fehler" && (
								<View className="gap-4">
									<Text
										accessibilityRole="header"
										className="font-semibold text-body-1"
									>
										Deine Woche
									</Text>
									<View className="flex-row gap-1">
										{DAYS.map((label, index) => (
											<Pressable
												key={label}
												accessibilityRole="button"
												accessibilityLabel={`${label}, ${DATES[index]}. ${index < 3 ? "September" : "Oktober"}`}
												accessibilityState={{ selected: day === index }}
												onPress={() => setDay(index)}
												className="min-h-20 flex-1 items-center justify-start gap-2"
											>
												<Text
													className={cn("text-body-4", "text-secondary-text")}
												>
													{label}
												</Text>
												<View
													className={cn(
														"min-h-11 min-w-11 items-center justify-center rounded-full border",
														day === index
															? "border-primary-strong/30 bg-system-subtle"
															: "border-transparent",
													)}
												>
													<Text
														className={cn(
															"font-semibold text-body-1",
															day === index
																? "text-primary-strong"
																: "text-text",
														)}
													>
														{DATES[index]}
													</Text>
												</View>
											</Pressable>
										))}
									</View>
									<Text
										accessibilityRole="header"
										className="font-semibold text-body-2"
									>
										{dayTitle}
									</Text>
									{selectedBlocks.length ? (
										selectedBlocks.map((block) => (
											<Pressable
												key={block.id}
												accessibilityRole="button"
												accessibilityLabel={`${block.subject}: ${block.title}, ${block.minutes} Minuten, öffnen`}
												onPress={() => begin(block)}
												className="flex-row items-center gap-3 rounded-3xl border border-border bg-card p-4"
											>
												<View className="h-10 w-10 items-center justify-center rounded-full bg-ueben-subtle">
													<Dumbbell size={20} color={colors.ueben} />
												</View>
												<View className="flex-1 gap-1">
													<Text className="text-body-4 text-secondary-text">
														{block.subject} · {block.minutes} Min.
													</Text>
													<Text className="font-semibold text-body-2">
														{block.title}
													</Text>
												</View>
												<ArrowRight size={20} color={colors.text} />
											</Pressable>
										))
									) : (
										<Text className="text-body-3 text-secondary-text">
											{day === 0 && finished
												? "Alle heutigen Lernblöcke abgeschlossen."
												: day === 0
													? "Keine weiteren Lernblöcke für heute."
													: "An diesem Tag ist nichts eingeplant."}
										</Text>
									)}
								</View>
							)}
						</>
					) : tab === "Pläne" ? (
						<View className="gap-4">
							<Text className="text-body-3 text-secondary-text">
								Alle Prüfungen und Lernpläne im Überblick.
							</Text>
							{hasPlan ? (
								[
									"Mathematik · Prüfung am Freitag",
									"Biologie · Prüfung nächste Woche",
									"Englisch · Prüfung nächste Woche",
								].map((title) => (
									<View
										key={title}
										className="gap-2 rounded-card border border-border bg-surface p-6"
									>
										<Text className="font-semibold text-body-1">{title}</Text>
										<Text className="text-body-3 text-primary-strong">
											Beispielplan · Detailansicht nicht Teil der Demo
										</Text>
									</View>
								))
							) : (
								<Button onPress={() => setModal("create")}>
									<Text>Ersten Lernplan erstellen</Text>
								</Button>
							)}
						</View>
					) : (
						<View className="gap-4">
							<Text className="text-body-2">
								Entscheidungsdemo mit Beispieldaten
							</Text>
							<Text className="text-body-3 text-secondary-text">
								Erstellung und Lernblöcke sind simuliert. Es werden keine echten
								Daten gespeichert.
							</Text>
							<Button variant="neutral" onPress={() => setModal("states")}>
								<Text>Demo-Zustand auswählen</Text>
							</Button>
						</View>
					)}
				</View>
			</ScrollView>
			<View
				className="bg-background px-6 pt-2"
				style={{ paddingBottom: insets.bottom }}
			>
				<View className="mx-auto w-full max-w-xl flex-row rounded-full border border-border bg-card p-1">
					{[
						{ name: "Heute", icon: Home },
						{ name: "Pläne", icon: BookOpen },
						{ name: "Einstellungen", icon: Settings },
					].map(({ name, icon: Icon }) => (
						<Pressable
							key={name}
							onPress={() => setTab(name)}
							accessibilityRole="tab"
							accessibilityState={{ selected: tab === name }}
							className={cn(
								"min-h-16 flex-1 items-center justify-center rounded-full py-2",
								tab === name && "bg-muted",
							)}
						>
							<Icon
								size={28}
								color={tab === name ? colors.primaryStrong : colors.text}
							/>
							<Text
								className={cn(
									"text-body-4",
									tab === name
										? "font-semibold text-primary-strong"
										: "text-secondary-text",
								)}
							>
								{name}
							</Text>
						</Pressable>
					))}
				</View>
				<Pressable
					onPress={() => setModal("states")}
					accessibilityRole="button"
					accessibilityLabel="Demo-Zustand wechseln"
					className="min-h-11 items-center justify-center"
				>
					<Text className="text-body-4 text-secondary-text">
						Demo · {state} · Zustand wechseln
					</Text>
				</Pressable>
			</View>
			<DayovaSheetFrame
				visible={modal !== null}
				onClose={() => setModal(null)}
				showCloseButton={false}
			>
				<View className="bg-background">
					<View className="gap-6">
						<Button variant="ghost" onPress={() => setModal(null)}>
							<Text className="text-text">Schließen</Text>
						</Button>
						<Text
							accessibilityRole="header"
							className="font-semibold text-heading-2"
						>
							{modal === "states"
								? "Demo-Zustand"
								: modal === "create"
									? "Lernplan erstellen"
									: active?.title}
						</Text>
						<Text className="text-body-3 text-secondary-text">
							Nur zur Gestaltung: Beispieldaten, keine Speicherung.
						</Text>
						{modal === "states" ? (
							STATES.map((value) => (
								<Button
									key={value}
									variant={state === value ? "default" : "neutral"}
									onPress={() => chooseState(value)}
								>
									<Text>{value}</Text>
								</Button>
							))
						) : modal === "create" ? (
							<>
								<Text>Mathematik · Lineare Funktionen</Text>
								<Text className="text-body-3 text-secondary-text">
									In der echten App öffnet diese Aktion eure bestehende
									Lernplanerstellung.
								</Text>
								<Button onPress={() => chooseState("Bereit")}>
									<Text>Fertigen Beispielplan anzeigen</Text>
								</Button>
								<Button
									variant="neutral"
									onPress={() => chooseState("Begonnen")}
								>
									<Text>Unterbrochene Erstellung zeigen</Text>
								</Button>
							</>
						) : (
							<>
								<Text>
									{active?.subject} · {active?.minutes} Minuten
								</Text>
								<Text className="text-body-3 text-secondary-text">
									Hier würde der vorhandene Lernblock starten. Für diese Demo
									kannst du Abschluss oder Unterbrechung ausprobieren.
								</Text>
								<Button
									onPress={() => {
										if (active) setCompleted((items) => [...items, active.id]);
										setState("Bereit");
										setModal(null);
									}}
								>
									<Check size={20} color="white" />
									<Text>Lernblock als erledigt zeigen</Text>
								</Button>
								<Button
									variant="neutral"
									onPress={() => {
										setState("Fortsetzen");
										setModal(null);
									}}
								>
									<Text>Später weiterlernen</Text>
								</Button>
							</>
						)}
					</View>
				</View>
			</DayovaSheetFrame>
		</View>
	);
}
