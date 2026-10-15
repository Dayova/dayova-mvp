/** Throwaway parent concept, composed from the actual Today and Plans UI.
 * Job: see the child's upcoming work and open contextual parent support.
 * Hierarchy: Today learning card → shared calendar/agenda; original Plans and full settings.
 * Primary action: So kannst du helfen. No competing layout variants.
 * All data, sharing and AI guidance remain local fixtures.
 */
import { Stack } from "expo-router";
import { ThemeProvider } from "expo-router/react-navigation";
import { vars } from "nativewind";
import {
	createContext,
	type ReactNode,
	useContext,
	useMemo,
	useRef,
	useState,
} from "react";
import { PanResponder, Pressable, ScrollView, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
	SafeAreaProvider,
	useSafeAreaInsets,
} from "react-native-safe-area-context";
import { SafeAreaView } from "react-native-screens/experimental";
import type { Id } from "#convex/_generated/dataModel";
import { BackButton, Button } from "~/components/ui/button";
import {
	ArrowRightStraight,
	ArrowUpRight,
	Check,
	Clock3,
	Sparkles,
} from "~/components/ui/icon";
import { CompactNotchedActionCard } from "~/components/ui/notched-action-card";
import { Surface } from "~/components/ui/surface";
import { Text } from "~/components/ui/text";
import { ThemedStatusBar } from "~/components/ui/themed-status-bar";
import type { DashboardAgendaItem } from "~/features/dashboard/dashboard-agenda";
import { EMPTY_DASHBOARD_PRIMARY_ACTION } from "~/features/dashboard/dashboard-empty-state";
import { TodayLearningCard } from "~/features/dashboard/today-learning-card";
import { LearningPlanCardVisual } from "~/features/learning-plans/learning-plan-card-visual";
import { LearningPlanStatusBadge } from "~/features/learning-plans/learning-plan-status-badge";
import {
	PlansTabSwitch,
	type PlanTab,
} from "~/features/learning-plans/plans-tab-switch";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { DayovaThemeProvider, NAV_THEMES, useDayovaTheme } from "~/lib/theme";
import { DARK_THEME_VARIABLES } from "~/lib/theme-variables";
import { ParentCalendar } from "./parent-calendar";
import { ParentSettings } from "./parent-settings";

type RootPage = "home" | "plans" | "more";
type Page =
	| "plans"
	| "more"
	| "home"
	| "plan"
	| "help"
	| "homework"
	| "sharing"
	| "connect";
const plans = [
	{
		subject: "Mathematik",
		title: "Brüche verstehen",
		date: "Di, 20. Oktober",
		countdown: "In 5 Tagen",
		kind: "Klassenarbeit",
		session: "Brüche auf einen Nenner bringen",
		time: "Heute · 16:00 · 20 Min.",
		next: "Fr, 16.10. · 16:00 · 20 Min.",
		preview: "Brüche addieren",
		material: "Arbeitsblatt Brüche · Seite 2",
		goal: "Mia übt, Brüche so zu erweitern, dass sie denselben Nenner haben.",
		question: "Warum sind 1/2 und 2/4 gleich viel?",
		exercise:
			"Zeichnet zwei gleich große Rechtecke. Teilt eines in zwei, das andere in vier Teile. Mia malt jeweils die Hälfte aus und erklärt, was gleich bleibt.",
		hint: "Die Stücke werden kleiner, die markierte Menge bleibt gleich. Beim Erweitern werden Zähler und Nenner mit derselben Zahl multipliziert.",
		nudge:
			"Wenn Mia stockt: Fragt zuerst, was der Nenner über die Größe der Stücke aussagt. Lasst Mia selbst zeichnen und erklären.",
		topics: ["Brüche darstellen", "Erweitern und Kürzen", "Brüche addieren"],
		done: "Wissenscheck abgeschlossen",
	},
	{
		subject: "Englisch",
		title: "Simple past erzählen",
		date: "Fr, 23. Oktober",
		countdown: "In 8 Tagen",
		kind: "Test",
		session: "Regelmäßige und unregelmäßige Verben",
		time: "Morgen · 17:00 · 15 Min.",
		next: "Sa, 17.10. · 11:00 · 15 Min.",
		preview: "Fragen mit did",
		material: "Unit 3 · Hefteintrag vom 12.10.",
		goal: "Mia übt, von vergangenen Erlebnissen zu erzählen und passende Verbformen zu verwenden.",
		question: "How was your weekend? Tell me three things you did.",
		exercise:
			"Erzählt abwechselnd von gestern. Mia sucht drei Verben aus ihrem Hefteintrag aus und bildet eigene Sätze damit.",
		hint: "Regelmäßige Verben enden meist auf -ed. Unregelmäßige Formen wie went oder saw werden einzeln gelernt. Nach did steht die Grundform.",
		nudge:
			"Lasst Mia zuerst zu Ende erzählen. Sucht danach gemeinsam eine Verbform im Heft nach, statt jeden Satz sofort zu verbessern.",
		topics: ["Verben im simple past", "Verneinungen", "Fragen mit did"],
		done: "Wissenscheck abgeschlossen",
	},
];
const homework = [
	{
		subject: "Mathematik",
		title: "Brüche kürzen",
		due: "Morgen · Fr, 16.10.",
		task: "Buch S. 42, Aufgaben 3 und 4",
		note: "Rechenwege ins Heft schreiben.",
		help: "Lasst Mia an einer Aufgabe erklären, durch welche Zahl sie Zähler und Nenner teilt. Fragt: Woran erkennst du, dass du nicht weiter kürzen kannst?",
		done: false,
	},
	{
		subject: "Deutsch",
		title: "Eine Fabel lesen",
		due: "Mo, 19.10.",
		task: "Der Fuchs und der Rabe · Arbeitsblatt",
		note: "Lies die Fabel und beschreibe die Absicht des Fuchses in drei Sätzen.",
		help: "Lest die Fabel abwechselnd vor. Fragt anschließend: Was wollte der Fuchs erreichen, und woran erkennst du das im Text?",
		done: false,
	},
	{
		subject: "Englisch",
		title: "Vokabeln Unit 3",
		due: "Heute · Do, 15.10.",
		task: "Workbook S. 18, Aufgabe 2",
		note: "Von Mia als erledigt markiert.",
		help: "Fragt Mia, welches neue Wort sie heute in einem eigenen Satz verwenden würde. Eine kurze Wiederholung reicht.",
		done: true,
	},
];
const nextStep: DashboardAgendaItem = {
	dayKey: "2026-10-15",
	kind: "learningSession",
	startMinutes: 960,
	endMinutes: 980,
	entry: {
		id: "prototype-session" as Id<"learningPlanSessions">,
		subject: "Mathematik",
		title: "Brüche auf einen Nenner bringen",
		durationMinutes: 20,
		relatedLearningPlanSessionId:
			"prototype-session" as Id<"learningPlanSessions">,
	},
};
function Block({ children }: { children: ReactNode }) {
	return <Surface className="gap-3 p-6">{children}</Surface>;
}
function Heading({ children }: { children: ReactNode }) {
	return <Text variant="h3">{children}</Text>;
}
function Meta({ children }: { children: ReactNode }) {
	return <Text className="text-body-4 text-secondary-text">{children}</Text>;
}
const DemoContext = createContext<{
	linked: boolean;
	setLinked: (value: boolean) => void;
	empty: boolean;
	setEmpty: (value: boolean) => void;
	signedOut: boolean;
	setSignedOut: (value: boolean) => void;
} | null>(null);
function PrototypeNavigationTheme({ children }: { children: ReactNode }) {
	const { resolvedTheme } = useDayovaTheme();
	return (
		<ThemeProvider value={NAV_THEMES[resolvedTheme]}>{children}</ThemeProvider>
	);
}
export function ParentPrototypeRoot() {
	const [linked, setLinked] = useState(true);
	const [empty, setEmpty] = useState(false);
	const [signedOut, setSignedOut] = useState(false);
	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
			<SafeAreaProvider>
				<DayovaThemeProvider>
					<PrototypeNavigationTheme>
						<DemoContext.Provider
							value={{
								linked,
								setLinked,
								empty,
								setEmpty,
								signedOut,
								setSignedOut,
							}}
						>
							<Stack
								initialRouteName="parent-prototype"
								screenOptions={{ headerShown: false }}
							>
								<Stack.Screen name="parent-prototype" />
								<Stack.Protected guard={false}>
									{[
										"subscription-success",
										"(app)",
										"subscription",
										"entry/[id]",
										"entry/success",
										"(creation)",
										"change-password",
										"password-reset-success",
										"trial",
										"session-tasks/reset-password",
										"paywall",
										"learning-plans/[planId]/index",
										"learning-plans/[planId]/review",
										"learning-plans/[planId]/success",
										"learning-plans/[planId]/preparation",
										"learning-plans/[planId]/sessions/[sessionId]/index",
										"learning-plans/[planId]/sessions/[sessionId]/edit",
										"notifications",
										"personal-subjects",
										"profile",
										"analyse",
										"(auth)",
										"notification-settings",
										"timetable",
										"learning-times/index",
										"learning-times/edit",
									].map((name) => (
										<Stack.Screen key={name} name={name} />
									))}
								</Stack.Protected>
							</Stack>
						</DemoContext.Provider>
					</PrototypeNavigationTheme>
				</DayovaThemeProvider>
			</SafeAreaProvider>
		</GestureHandlerRootView>
	);
}

export function ParentPrototype({ rootPage }: { rootPage: RootPage }) {
	const demo = useContext(DemoContext);
	if (!demo) throw new Error("Parent prototype provider missing");
	const { linked, setLinked, empty, setEmpty, signedOut, setSignedOut } = demo;
	const { colors, resolvedTheme } = useDayovaTheme();
	const themeVariables = useMemo(
		() => vars(resolvedTheme === "dark" ? DARK_THEME_VARIABLES : {}),
		[resolvedTheme],
	);
	const insets = useSafeAreaInsets();
	const scroll = useRef<ScrollView>(null);
	const [page, setPage] = useState<Page>(rootPage);
	const [history, setHistory] = useState<Page[]>([]);
	const navigate = (next: Page) => {
		setHistory((current) => [...current, page]);
		setPage(next);
	};
	const goBack = () => {
		setPage(history.at(-1) ?? rootPage);
		setHistory((current) => current.slice(0, -1));
	};
	const [activeTab, setActiveTab] = useState<PlanTab>("learningPlans");
	const [planIndex, setPlanIndex] = useState(0);
	const [homeworkIndex, setHomeworkIndex] = useState(0);
	const [revealed, setRevealed] = useState(false);
	const plan = plans[planIndex];
	const assignment = homework[homeworkIndex];
	const openPlan = (index: number) => {
		setPlanIndex(index);
		setRevealed(false);
		navigate("plan");
	};
	const openHelp = () => {
		setRevealed(false);
		navigate("help");
	};
	const swipe = useMemo(
		() =>
			PanResponder.create({
				onMoveShouldSetPanResponderCapture: (_, g) =>
					Math.abs(g.dx) > 24 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
				onPanResponderRelease: (_, g) => {
					if (Math.abs(g.dx) > 50)
						setActiveTab(g.dx < 0 ? "homework" : "learningPlans");
				},
			}),
		[],
	);
	const title =
		page === "plans"
			? "Mias Pläne"
			: page === "more"
				? "Einstellungen"
				: page === "home"
					? "Hallo Anna"
					: page === "plan"
						? plan.subject
						: page === "help"
							? "Gemeinsam lernen"
							: page === "homework"
								? "Hausaufgabe"
								: page === "sharing"
									? "Elternzugang"
									: "Einladung";
	if (signedOut)
		return (
			<View
				className="flex-1 justify-center gap-6 bg-background px-6"
				style={themeVariables}
			>
				<Heading>Du bist abgemeldet</Heading>
				<Text>
					Die Demo ist beendet. Es wurde kein echter Account abgemeldet.
				</Text>
				<Button
					onPress={() => {
						setSignedOut(false);
						setPage(rootPage);
						setHistory([]);
					}}
				>
					<Text>Demo erneut öffnen</Text>
				</Button>
			</View>
		);
	return (
		<SafeAreaView
			edges={{ bottom: true }}
			className="flex-1 bg-background"
			style={[
				themeVariables,
				{
					flex: 1,
					backgroundColor: colors.background,
					paddingTop: insets.top + 16,
				},
			]}
		>
			<ThemedStatusBar />
			{page !== "more" && (
				<View className="mx-auto w-full max-w-xl gap-1 px-6 pb-6">
					<View className="min-h-12 flex-row items-center gap-4">
						{page !== rootPage && <BackButton onPress={goBack} />}
						<Text
							accessibilityRole="header"
							className="min-w-0 flex-1 font-semibold text-heading-2"
						>
							{title}
						</Text>
						{page === "home" && (
							<Pressable
								accessibilityRole="button"
								accessibilityLabel="Verbindung mit Mia ansehen"
								onPress={() => navigate(linked ? "sharing" : "connect")}
								className="h-12 w-12 items-center justify-center rounded-full border border-border bg-card"
							>
								<Text className="font-semibold">M</Text>
							</Pressable>
						)}
					</View>
					{page === "home" && (
						<Meta>
							{linked
								? empty
									? "Noch keine geteilten Inhalte"
									: "Mias Lernen im Überblick"
								: "Gemeinsam mit deinem Kind starten"}
						</Meta>
					)}
				</View>
			)}
			<ScrollView
				ref={scroll}
				key={page}
				contentInsetAdjustmentBehavior="never"
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{ paddingBottom: 32 }}
			>
				<View className="mx-auto w-full max-w-xl gap-6 px-6">
					{page === "home" &&
						(!linked ? (
							<Block>
								<Heading>Mia lädt dich ein</Heading>
								<Text>
									Verbinde deinen Elternzugang mit Mia, um ihre freigegebenen
									Pläne zu sehen.
								</Text>
								<Button onPress={() => navigate("connect")}>
									<Text>Einladung ansehen</Text>
								</Button>
							</Block>
						) : empty ? (
							<Block>
								<Heading>Noch keine geteilten Pläne</Heading>
								<Text>
									Sobald Mia Lernpläne oder Hausaufgaben teilt, erscheinen sie
									hier.
								</Text>
								<Button onPress={() => navigate("sharing")}>
									<Text>Freigabe ansehen</Text>
								</Button>
							</Block>
						) : (
							<>
								<TodayLearningCard
									todayKey="2026-10-15"
									item={nextStep}
									plan={{
										subject: "Mathematik",
										currentSession: {
											id: "prototype-session",
											goal: "Hilf Mia mit einer kurzen gemeinsamen Übung.",
											sessionPurpose: "learning",
										},
									}}
									isLoading={false}
									fallbackAction={EMPTY_DASHBOARD_PRIMARY_ACTION}
									onOpenItem={() => {
										setPlanIndex(0);
										openHelp();
									}}
									onOpenFallback={() => openPlan(0)}
									action={{
										label: "So kannst du helfen",
										hint: "Öffnet passende Hilfestellungen für Eltern.",
										icon: ArrowRightStraight,
									}}
								/>
								<ParentCalendar
									onPlan={openPlan}
									onHomework={(index) => {
										setHomeworkIndex(index);
										navigate("homework");
									}}
								/>
								<Meta>
									Von Mia geteilt. Der Status zeigt ihre Angaben in Dayova.
								</Meta>
							</>
						))}
					{page === "plans" &&
						(!linked ? (
							<Block>
								<Heading>Noch nicht verbunden</Heading>
								<Text>
									Mit Mias Einladung kannst du ihre freigegebenen Pläne sehen.
								</Text>
								<Button onPress={() => navigate("connect")}>
									<Text>Einladung ansehen</Text>
								</Button>
							</Block>
						) : empty ? (
							<Block>
								<Heading>Noch keine geteilten Pläne</Heading>
								<Text>Sobald Mia etwas teilt, erscheint es hier.</Text>
							</Block>
						) : (
							<>
								<View className="gap-6" {...swipe.panHandlers}>
									<PlansTabSwitch
										activeTab={activeTab}
										onChange={setActiveTab}
									/>
									{activeTab === "learningPlans" ? (
										<View className="gap-7">
											{plans.map((item, index) => (
												<LearningPlanCardVisual
													key={item.subject}
													accessibilityLabel={`${item.subject}: ${item.title}. Lernplan ansehen.`}
													accessibilityHint="Zeigt Mias Lernplan und passende Unterstützung für Eltern."
													onPress={() => openPlan(index)}
													model={{
														subject: item.subject,
														status: {
															label: index === 0 ? "Heute" : "Morgen",
															background: colors.systemSubtle,
															foreground: colors.primary,
														},
														examDateLabel: `${item.kind} · ${item.date}`,
														currentTitle: item.session,
														state: {
															kind: "ready",
															durationMinutes: index === 0 ? 20 : 15,
															progress: index === 0 ? 40 : 20,
															remainingDays: index === 0 ? 5 : 8,
															rollingWindowLabel: "Nächster Schritt + Vorschau",
														},
													}}
												/>
											))}
										</View>
									) : (
										<View className="gap-7">
											{homework.map((item, index) => (
												<CompactNotchedActionCard
													key={item.subject}
													pressType="card"
													onPress={() => {
														setHomeworkIndex(index);
														navigate("homework");
													}}
													cardAccessibilityLabel={`${item.subject}: ${item.title}. ${item.done ? "Erledigt" : item.due}`}
													cardAccessibilityHint="Öffnet die Hausaufgabe mit Hinweisen für Eltern."
													actionIcon={
														<ArrowUpRight
															size={24}
															color={DAYOVA_DESIGN_SYSTEM.colors.light1}
															strokeWidth={1.9}
														/>
													}
												>
													<View className="gap-2">
														<View className="flex-row flex-wrap items-start justify-between gap-3">
															<Text className="font-semibold text-body-1">
																{item.subject}
															</Text>
															<LearningPlanStatusBadge
																fixedTextScale={false}
																status={{
																	label: item.done ? "Erledigt" : "Offen",
																	background: item.done
																		? colors.successSubtle
																		: colors.hausaufgabeSubtle,
																	foreground: colors.text,
																}}
															/>
														</View>
														<View className="flex-row items-center gap-1">
															<Clock3 size={14} color={colors.secondaryText} />
															<Meta>{item.due}</Meta>
														</View>
														<Text className="font-semibold text-body-4">
															{item.title} · {item.task}
														</Text>
													</View>
												</CompactNotchedActionCard>
											))}
										</View>
									)}
								</View>
								<Meta>Von Mia geteilt · Beispieldaten</Meta>
							</>
						))}
					{page === "more" && (
						<>
							<ParentSettings
								onNavigate={() =>
									scroll.current?.scrollTo({ y: 0, animated: false })
								}
								linked={linked}
								onConnection={() => navigate(linked ? "sharing" : "connect")}
								onSignOut={() => setSignedOut(true)}
							/>
							<View className="gap-2 border-border border-t pt-4">
								<Meta>Prototyp · Beispieldaten vom 15.10.2026</Meta>
								<View className="flex-row flex-wrap gap-4">
									<Pressable
										accessibilityRole="button"
										className="min-h-11 justify-center"
										onPress={() => {
											setEmpty(!empty);
											setLinked(true);
										}}
									>
										<Meta>
											{empty ? "Beispieldaten anzeigen" : "Leerzustand ansehen"}
										</Meta>
									</Pressable>
									<Pressable
										accessibilityRole="button"
										className="min-h-11 justify-center"
										onPress={() => {
											setLinked(false);
											setEmpty(false);
										}}
									>
										<Meta>Ohne Verbindung</Meta>
									</Pressable>
								</View>
							</View>
						</>
					)}
					{page === "plan" && (
						<>
							<View className="gap-2">
								<Heading>{plan.title}</Heading>
								<Meta>
									{plan.kind} · {plan.date} · {plan.countdown}
								</Meta>
							</View>
							<Block>
								<View className="flex-row items-center gap-2">
									<Clock3 size={18} color={colors.primaryStrong} />
									<Meta>{plan.time}</Meta>
								</View>
								<Heading>{plan.session}</Heading>
								<Text className="text-body-3 text-secondary-text">
									{plan.goal}
								</Text>
								<Button onPress={openHelp}>
									<Text>So kannst du helfen</Text>
								</Button>
							</Block>
							<View className="gap-4">
								<Heading>Mias Lernplan</Heading>
								<View className="flex-row items-start gap-3">
									<View className="h-9 w-9 items-center justify-center rounded-full bg-success-subtle">
										<Check size={18} color={colors.text} />
									</View>
									<View className="flex-1 gap-1">
										<Text className="font-semibold">Wissenscheck</Text>
										<Meta>Abgeschlossen</Meta>
									</View>
								</View>
								<View className="ml-4 h-5 border-border border-l-2" />
								<View className="flex-row items-start gap-3">
									<View className="h-9 w-9 items-center justify-center rounded-full bg-primary">
										<Text className="font-semibold text-on-primary">2</Text>
									</View>
									<View className="flex-1 gap-1">
										<Text className="font-semibold">{plan.session}</Text>
										<Meta>{plan.time}</Meta>
									</View>
								</View>
								<View className="ml-4 h-5 border-border border-l-2" />
								<View className="flex-row items-start gap-3">
									<View className="h-9 w-9 items-center justify-center rounded-full border border-border">
										<Text>3</Text>
									</View>
									<View className="flex-1 gap-1">
										<Text>{plan.preview}</Text>
										<Meta>{plan.next} · Vorschau</Meta>
									</View>
								</View>
								<Meta>
									Die Vorschau passt sich nach der aktuellen Lernsession an.
								</Meta>
							</View>
							<Block>
								<Text className="font-semibold">Themen der Arbeit</Text>
								{plan.topics.map((topic) => (
									<Text key={topic} className="text-body-3">
										{topic}
									</Text>
								))}
							</Block>
							<Block>
								<Text className="font-semibold">
									Schulmaterial als Grundlage
								</Text>
								<Text className="text-body-3">{plan.material}</Text>
								<Meta>Von Mia hochgeladen · Beispielmaterial</Meta>
							</Block>
						</>
					)}
					{page === "help" && (
						<>
							<View className="gap-3">
								<View className="flex-row items-center gap-2">
									<Sparkles size={18} color={colors.theorie} />
									<Meta>{plan.subject} · Etwa 5 Minuten zusammen</Meta>
								</View>
								<Heading>{plan.session}</Heading>
								<Text className="text-body-3 text-secondary-text">
									{plan.goal}
								</Text>
							</View>
							<Block>
								<Meta>1 · Ins Gespräch kommen</Meta>
								<Heading>„{plan.question}“</Heading>
								<Text className="text-body-3 text-secondary-text">
									Lass Mia erst selbst erklären. Zuhören ist schon
									Unterstützung.
								</Text>
							</Block>
							<Block>
								<Meta>2 · Gemeinsam ausprobieren</Meta>
								<Text>{plan.exercise}</Text>
								<Button
									variant="neutral"
									onPress={() => setRevealed(!revealed)}
									accessibilityState={{ expanded: revealed }}
								>
									<Text>
										{revealed ? "Erklärung ausblenden" : "Erklärung für dich"}
									</Text>
								</Button>
								{revealed && <Text className="text-body-3">{plan.hint}</Text>}
							</Block>
							<Block>
								<Meta>3 · Wenn es noch hakt</Meta>
								<Text>{plan.nudge}</Text>
							</Block>
							<Text className="text-body-3 text-secondary-text">
								Zum Abschluss: „Was war gerade hilfreich für dich?“ Wenn es zu
								viel wird, macht eine Pause.
							</Text>
							<View className="gap-2 border-border border-t pt-4">
								<Meta>Grundlage: {plan.material}</Meta>
								<Meta>
									KI-Hilfestellung als vorbereitetes Beispiel. In der fertigen
									Version passend zu Mias freigegebenem Schulmaterial.
								</Meta>
							</View>
						</>
					)}
					{page === "homework" && (
						<>
							<View className="gap-2">
								<Meta>
									{assignment.subject} ·{" "}
									{assignment.done ? "Erledigt" : "Offen"}
								</Meta>
								<Heading>{assignment.title}</Heading>
								<Meta>Abgabe: {assignment.due}</Meta>
							</View>
							<Block>
								<Text className="font-semibold">{assignment.task}</Text>
								<Text>{assignment.note}</Text>
							</Block>
							<View className="flex-row items-center gap-2">
								<Sparkles size={20} color={colors.theorie} />
								<Heading>So kannst du helfen</Heading>
							</View>
							<Block>
								<Text>{assignment.help}</Text>
								<Meta>Beispiel-Hinweis zur Hausaufgabe</Meta>
							</Block>
							<Meta>
								Mia bearbeitet die Aufgabe und aktualisiert ihren Status selbst.
							</Meta>
							{homeworkIndex === 0 && (
								<Button onPress={() => openPlan(0)}>
									<Text>Zum Lernplan Mathematik</Text>
								</Button>
							)}
						</>
					)}
					{page === "sharing" && (
						<>
							<Heading>Mit Mia verbunden</Heading>
							<Text className="text-secondary-text">
								Du siehst die Inhalte, die Mia mit dir teilt.
							</Text>
							<Block>
								{[
									"Arbeiten und Tests",
									"Lernpläne und nächste Lernschritte",
									"Hausaufgaben und ihren Status",
									"Passende Hilfestellungen",
								].map((item) => (
									<View key={item} className="flex-row gap-3">
										<Check size={20} color={colors.text} />
										<Text className="flex-1">{item}</Text>
									</View>
								))}
							</Block>
							<Block>
								<Text className="font-semibold">
									Gemeinsam vereinbarter Einblick
								</Text>
								<Text>
									Mia verwaltet die Freigabe in ihrer App. Persönliche Antworten
									und einzelne Fehler bleiben in ihrer Lernansicht.
								</Text>
							</Block>
							<Button onPress={() => navigate("connect")}>
								<Text>Einladungsablauf ansehen</Text>
							</Button>
							<Meta>Freigabe-Konzept · im Prototyp simuliert</Meta>
						</>
					)}
					{page === "connect" && (
						<>
							<Heading>Mia lädt dich ein</Heading>
							<Block>
								<Text>1. Mia sendet dir eine Einladung aus ihrer App.</Text>
								<Text>
									2. Du meldest dich mit deinem eigenen Eltern-Account an.
								</Text>
								<Text>3. Du siehst ihre freigegebenen Inhalte.</Text>
							</Block>
							<Meta>
								Demo: Es wird kein Account erstellt und keine Einladung
								verschickt.
							</Meta>
							<Button
								onPress={() => {
									setLinked(true);
									setEmpty(false);
									setHistory([]);
									setPage(rootPage);
								}}
							>
								<Text>Elternansicht ausprobieren</Text>
							</Button>
						</>
					)}
				</View>
			</ScrollView>
		</SafeAreaView>
	);
}
