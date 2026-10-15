/** Throwaway native concept: compare overview, week and support-first layouts.
 * Job: understand the next school deadline and offer useful, material-based help.
 * Hierarchy: next step → homework → plans. Primary action: So kannst du helfen.
 * Friction: one child, no full calendar, no marks or activity surveillance.
 * Decision: overview is the default; native comparison stays in this demo only.
 * All people, dates, documents and AI suggestions below are fixtures.
 */
import { vars } from "nativewind";
import { type ReactNode, useMemo, useState } from "react";
import { Pressable, ScrollView, useWindowDimensions, View } from "react-native";
import {
	SafeAreaProvider,
	useSafeAreaInsets,
} from "react-native-safe-area-context";
import { BackButton, Button } from "~/components/ui/button";
import {
	ArrowLeft,
	ArrowRight,
	BookOpen,
	CalendarDays,
	Check,
	Clock3,
	Sparkles,
} from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
import { DayovaThemeProvider, useDayovaTheme } from "~/lib/theme";
import { DARK_THEME_VARIABLES } from "~/lib/theme-variables";

type Page = "home" | "plan" | "help" | "homework" | "sharing" | "connect";
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
function Card({
	children,
	accent = false,
}: {
	children: ReactNode;
	accent?: boolean;
}) {
	return (
		<View
			className={
				accent
					? "gap-4 rounded-3xl border border-border bg-system-subtle p-5"
					: "gap-3 rounded-3xl border border-border bg-card p-5"
			}
		>
			{children}
		</View>
	);
}
function Label({ children }: { children: ReactNode }) {
	return (
		<Text className="font-semibold text-body-4 text-secondary-text">
			{children}
		</Text>
	);
}
function Section({ children }: { children: ReactNode }) {
	return (
		<Text variant="h3" className="mt-2">
			{children}
		</Text>
	);
}
function Row({
	title,
	subtitle,
	onPress,
	finished = false,
}: {
	title: string;
	subtitle: string;
	onPress: () => void;
	finished?: boolean;
}) {
	const { colors } = useDayovaTheme();
	return (
		<Pressable
			accessibilityRole="button"
			onPress={onPress}
			className="min-h-16 flex-row items-center gap-3 rounded-2xl bg-card p-4 active:opacity-70"
		>
			<View className="flex-1 gap-1">
				<Text className="font-semibold">{title}</Text>
				<Text className="text-body-4 text-secondary-text">{subtitle}</Text>
			</View>
			{finished ? (
				<Check size={20} color={colors.text} />
			) : (
				<ArrowRight size={20} color={colors.text} />
			)}
		</Pressable>
	);
}
export function ParentPrototypeRoot() {
	return (
		<SafeAreaProvider>
			<DayovaThemeProvider>
				<ParentPrototype />
			</DayovaThemeProvider>
		</SafeAreaProvider>
	);
}
function ParentPrototype() {
	const { colors, resolvedTheme } = useDayovaTheme();
	const themeVariables = useMemo(
		() => vars(resolvedTheme === "dark" ? DARK_THEME_VARIABLES : {}),
		[resolvedTheme],
	);
	const insets = useSafeAreaInsets();
	const largeText = useWindowDimensions().fontScale > 1.3;
	const [page, setPage] = useState<Page>("home");
	const [variant, setVariant] = useState(0);
	const [planIndex, setPlanIndex] = useState(0);
	const [homeworkIndex, setHomeworkIndex] = useState(0);
	const [revealed, setRevealed] = useState(false);
	const [savedPlans, setSavedPlans] = useState<number[]>([]);
	const saved = savedPlans.includes(planIndex);
	const [empty, setEmpty] = useState(false);
	const [linked, setLinked] = useState(true);
	const plan = plans[planIndex];
	const assignment = homework[homeworkIndex];
	const openPlan = (index: number) => {
		setPlanIndex(index);
		setRevealed(false);
		setPage("plan");
	};
	const openHomework = (index: number) => {
		setHomeworkIndex(index);
		setPage("homework");
	};
	const back = () => {
		setRevealed(false);
		setPage(page === "help" ? "plan" : "home");
	};
	const planList = (
		<>
			<Section>Aktive Lernpläne</Section>
			<Text className="text-body-3 text-secondary-text">
				Was Mia gerade lernt – und wie du helfen kannst.
			</Text>
			{plans.map((item, index) => (
				<Pressable
					key={item.subject}
					accessibilityRole="button"
					accessibilityLabel={`${item.subject}: ${item.title}`}
					onPress={() => openPlan(index)}
				>
					<Card>
						<View className="flex-row items-center justify-between gap-2">
							<Label>{item.subject}</Label>
							<BookOpen size={20} color={colors.theorie} />
						</View>
						<Text variant="h3">{item.title}</Text>
						<Text className="text-body-3 text-secondary-text">
							{item.kind} · {item.date}
						</Text>
						<View className="border-border border-t pt-3">
							<Text className="text-body-4 text-secondary-text">
								Nächster Lernschritt
							</Text>
							<Text className="mt-1">{item.session}</Text>
						</View>
						<View className="flex-row items-center justify-between">
							<Text className="font-semibold text-body-3">
								Lernplan ansehen
							</Text>
							<ArrowRight size={20} color={colors.text} />
						</View>
					</Card>
				</Pressable>
			))}
		</>
	);
	const homeworkList = (
		<>
			<Section>Hausaufgaben</Section>
			<Text className="text-body-3 text-secondary-text">
				2 offen · 1 erledigt
			</Text>
			{homework.map((item, index) => (
				<Row
					key={item.subject}
					title={item.title}
					subtitle={`${item.subject} · ${item.done ? "Erledigt" : item.due}`}
					finished={item.done}
					onPress={() => openHomework(index)}
				/>
			))}
		</>
	);
	const nextCard = (
		<Card accent>
			<View className="flex-row items-center gap-2">
				<CalendarDays size={18} color={colors.text} />
				<Label>Nächste Arbeit · In 5 Tagen</Label>
			</View>
			<Text variant="h3">Mathematik: Brüche</Text>
			<Text className="text-body-3 text-secondary-text">
				Dienstag, 20. Oktober
			</Text>
			<View className="gap-2 rounded-2xl bg-card p-4">
				<Label>Heute im Lernplan</Label>
				<Text className="font-semibold">Brüche auf einen Nenner bringen</Text>
				<View className="flex-row items-center gap-2">
					<Clock3 size={16} color={colors.secondaryText} />
					<Text className="text-body-4 text-secondary-text">
						16:00 Uhr · 20 Minuten
					</Text>
				</View>
			</View>
			<Button
				variant="neutral"
				onPress={() => {
					setPlanIndex(0);
					setRevealed(false);
					setPage("help");
				}}
			>
				<Text>So kannst du helfen</Text>
			</Button>
		</Card>
	);
	const controls = (
		<View className="mx-auto w-full max-w-xl gap-1 border-border border-t bg-card px-4 py-2">
			<View className="flex-row items-center justify-between">
				<Button
					variant="ghost"
					size="icon"
					accessibilityLabel="Vorherige Konzeptvariante"
					onPress={() => {
						setVariant((variant + 2) % 3);
						setPage("home");
					}}
				>
					<ArrowLeft size={20} color={colors.text} />
				</Button>
				<View className="flex-1 items-center">
					<Text className="font-semibold text-body-4">
						{
							["A · Überblick (Empfehlung)", "B · Woche", "C · Begleiten"][
								variant
							]
						}
					</Text>
					<Text className="text-body-5 text-secondary-text">
						Konzept wechseln
					</Text>
				</View>
				<Button
					variant="ghost"
					size="icon"
					accessibilityLabel="Nächste Konzeptvariante"
					onPress={() => {
						setVariant((variant + 1) % 3);
						setPage("home");
					}}
				>
					<ArrowRight size={20} color={colors.text} />
				</Button>
			</View>
			<View className="flex-row justify-center gap-2">
				<Pressable
					accessibilityRole="button"
					className="min-h-11 flex-1 justify-center px-3"
					onPress={() => {
						setEmpty(!empty);
						setLinked(true);
						setPage("home");
					}}
				>
					<Text className="text-body-4 text-secondary-text">
						{empty ? "Beispieldaten" : "Leerzustand"}
					</Text>
				</Pressable>
				<Pressable
					accessibilityRole="button"
					className="min-h-11 flex-1 justify-center px-3"
					onPress={() => {
						setLinked(false);
						setPage("home");
					}}
				>
					<Text className="text-body-4 text-secondary-text">
						Ohne Verbindung
					</Text>
				</Pressable>
			</View>
		</View>
	);
	return (
		<View
			className="flex-1 bg-background"
			style={[
				themeVariables,
				{ paddingTop: insets.top, paddingBottom: insets.bottom },
			]}
		>
			<View
				className={
					largeText
						? "mx-auto w-full max-w-xl gap-2 px-5 py-2"
						: "mx-auto w-full max-w-xl flex-row items-center justify-between gap-2 px-5 py-2"
				}
			>
				<Text
					className={
						largeText
							? "w-full font-semibold text-body-4 text-secondary-text"
							: "flex-1 font-semibold text-body-4 text-secondary-text"
					}
				>
					DAYOVA · ELTERN
				</Text>
				<Text
					className={
						largeText
							? "w-full text-body-4 text-secondary-text"
							: "flex-1 text-right text-body-4 text-secondary-text"
					}
				>
					Prototyp · Beispieldaten
				</Text>
			</View>
			<ScrollView
				key={`${page}-${variant}-${empty}-${linked}`}
				contentInsetAdjustmentBehavior="automatic"
				contentContainerStyle={{ paddingBottom: 24 }}
			>
				<View className="mx-auto w-full max-w-xl gap-4 px-5 pt-3">
					{page !== "home" && (
						<View className="flex-row items-center gap-3">
							<BackButton onPress={back} />
							<Text className="text-body-3 text-secondary-text">
								{page === "help" ? "Lernplan" : "Übersicht"}
							</Text>
						</View>
					)}
					{page === "home" && (
						<>
							<View className="gap-3 pb-2">
								<View className="flex-row items-center justify-between gap-2">
									<Text variant="h1" className="flex-1 text-left">
										Für Mia da sein.
									</Text>
									<Pressable
										accessibilityRole="button"
										accessibilityLabel="Verbindung und Freigabe ansehen"
										onPress={() => setPage(linked ? "sharing" : "connect")}
										className="min-h-12 min-w-12 items-center justify-center rounded-full bg-theorie-subtle"
									>
										<Text className="font-semibold text-text">M</Text>
									</Pressable>
								</View>
								<Text className="text-secondary-text">
									{linked
										? "Das steht an. So kannst du unterstützen."
										: "Verbinde dich mit deinem Kind."}
								</Text>
								<Label>Donnerstag, 15. Oktober · Demo-Woche</Label>
							</View>
							{!linked ? (
								<Card>
									<Text variant="h3">Gemeinsam starten</Text>
									<Text>
										Mit einer Einladung von Mia siehst du ihre freigegebenen
										Lernpläne und Hausaufgaben.
									</Text>
									<Button variant="neutral" onPress={() => setPage("connect")}>
										<Text>Einladung ansehen</Text>
									</Button>
								</Card>
							) : empty ? (
								<Card>
									<BookOpen size={28} color={colors.theorie} />
									<Text variant="h3">Gerade steht nichts an</Text>
									<Text>
										Mia hat noch keine Lernpläne oder Hausaufgaben geteilt.
										Sobald sie etwas freigibt, erscheint es hier.
									</Text>
									<Button variant="neutral" onPress={() => setPage("sharing")}>
										<Text>Freigabe ansehen</Text>
									</Button>
								</Card>
							) : (
								<>
									{variant === 0 && (
										<>
											{nextCard}
											{homeworkList}
											{planList}
										</>
									)}
									{variant === 1 && (
										<>
											<Section>Die nächste Woche</Section>
											<Text className="text-body-3 text-secondary-text">
												Lernen, Abgaben und Arbeiten in einer Reihenfolge.
											</Text>
											{[
												{
													day: "HEUTE · 15. OKT",
													title: "16:00 · Brüche üben",
													sub: "Lernsession · 20 Minuten",
													action: () => openPlan(0),
												},
												{
													day: "MORGEN · 16. OKT",
													title: "Brüche kürzen abgeben",
													sub: "Hausaufgabe · Mathematik",
													action: () => openHomework(0),
												},
												{
													day: "MORGEN · 16. OKT",
													title: "17:00 · Simple past",
													sub: "Lernsession · 15 Minuten",
													action: () => openPlan(1),
												},
												{
													day: "MONTAG · 19. OKT",
													title: "Fabel abgeben",
													sub: "Hausaufgabe · Deutsch",
													action: () => openHomework(1),
												},
												{
													day: "DIENSTAG · 20. OKT",
													title: "Klassenarbeit: Brüche",
													sub: "Mathematik · in 5 Tagen",
													action: () => openPlan(0),
												},
												{
													day: "FREITAG · 23. OKT",
													title: "Test: Simple past",
													sub: "Englisch · in 8 Tagen",
													action: () => openPlan(1),
												},
											].map((item) => (
												<View
													key={item.title}
													className="gap-2 border-border border-l-2 pl-4"
												>
													<Label>{item.day}</Label>
													<Row
														title={item.title}
														subtitle={item.sub}
														onPress={item.action}
													/>
												</View>
											))}
											{planList}
											{homeworkList}
										</>
									)}
									{variant === 2 && (
										<>
											<Card accent>
												<Sparkles size={28} color={colors.theorie} />
												<Label>Ein kleiner Moment zusammen</Label>
												<Text variant="h3">
													„Warum ist eine Hälfte genauso viel wie zwei Viertel?“
												</Text>
												<Text className="text-body-3">
													Diese Frage passt zu Mias heutiger Lernsession. Du
													musst dafür kein Mathe-Profi sein.
												</Text>
												<Button
													variant="neutral"
													onPress={() => {
														setPlanIndex(0);
														setPage("help");
													}}
												>
													<Text>5 Minuten gemeinsam lernen</Text>
												</Button>
											</Card>
											<Section>Das steht an</Section>
											<Row
												title="Mathematik · Klassenarbeit"
												subtitle="Di, 20.10. · In 5 Tagen"
												onPress={() => openPlan(0)}
											/>
											<Row
												title="Englisch · Test"
												subtitle="Fr, 23.10. · In 8 Tagen"
												onPress={() => openPlan(1)}
											/>
											{homeworkList}
											{planList}
										</>
									)}
									<Text className="py-2 text-body-4 text-secondary-text">
										Du siehst, was Mia teilt. Die Angaben zeigen den Stand in
										Dayova und können vom Schulalltag abweichen.
									</Text>
								</>
							)}
						</>
					)}
					{page === "plan" && (
						<>
							<Label>
								{plan.subject} · {plan.kind}
							</Label>
							<Text variant="h1" className="text-left">
								{plan.title}
							</Text>
							<Text className="text-secondary-text">
								{plan.date} · {plan.countdown}
							</Text>
							<Card accent>
								<Label>Nächster Lernschritt · {plan.time}</Label>
								<Text variant="h3">{plan.session}</Text>
								<Text>{plan.goal}</Text>
								<Button
									variant="neutral"
									onPress={() => {
										setRevealed(false);
										setPage("help");
									}}
								>
									<Text>So kannst du helfen</Text>
								</Button>
							</Card>
							<Section>Darum geht es in der Arbeit</Section>
							{plan.topics.map((topic) => (
								<Text key={topic}>• {topic}</Text>
							))}
							<Section>Im Lernplan</Section>
							<Card>
								<Label>Bisher</Label>
								<Text>{plan.done}</Text>
								<View className="border-border border-t pt-3">
									<Label>Danach · Vorschau</Label>
									<Text className="mt-2 font-semibold">{plan.preview}</Text>
									<Text className="text-body-4 text-secondary-text">
										{plan.next}
									</Text>
									<Text className="mt-2 text-body-3 text-secondary-text">
										Der nächste Schritt kann sich nach der aktuellen Lernsession
										noch ändern.
									</Text>
								</View>
							</Card>
							<Section>Grundlage aus der Schule</Section>
							<Card>
								<Text className="font-semibold">{plan.material}</Text>
								<Text className="text-body-3 text-secondary-text">
									Von Mia hochgeladen · Beispielmaterial im Prototyp
								</Text>
								<Text className="text-body-3">
									Der Lernplan orientiert sich an Mias Schulmaterial. Der
									tatsächliche Prüfungsumfang wird von der Lehrkraft festgelegt.
								</Text>
							</Card>
						</>
					)}
					{page === "help" && (
						<>
							<Label>{plan.subject} · Gemeinsam etwa 5 Minuten</Label>
							<Text variant="h1" className="text-left">
								So kannst du helfen.
							</Text>
							<Text className="text-secondary-text">
								Passend zu „{plan.session}“.
							</Text>
							<Card accent>
								<View className="flex-row items-center gap-2">
									<Sparkles size={20} color={colors.theorie} />
									<Label>KI-Hilfestellung · Beispiel</Label>
								</View>
								<Text>{plan.goal}</Text>
								<Text className="text-body-4 text-secondary-text">
									Grundlage: {plan.material}
								</Text>
							</Card>
							<Section>1. Mit einer Frage starten</Section>
							<Card>
								<Text className="font-semibold text-body-1">
									„{plan.question}“
								</Text>
								<Text className="text-body-3 text-secondary-text">
									Lass Mia erst selbst erklären. Zuhören ist schon
									Unterstützung.
								</Text>
							</Card>
							<Section>2. Gemeinsam ausprobieren</Section>
							<Text>{plan.exercise}</Text>
							<Button
								variant="neutral"
								onPress={() => setRevealed(!revealed)}
								accessibilityState={{ expanded: revealed }}
							>
								<Text>
									{revealed
										? "Erklärung ausblenden"
										: "Erklärung für dich anzeigen"}
								</Text>
							</Button>
							{revealed && (
								<Card>
									<Text variant="h4">Das steckt dahinter</Text>
									<Text>{plan.hint}</Text>
								</Card>
							)}
							<Section>3. Wenn es noch hakt</Section>
							<Text>{plan.nudge}</Text>
							<Card>
								<Text className="font-semibold">Ein guter Abschluss</Text>
								<Text>
									„Was war gerade hilfreich für dich?“ Wenn es zu viel wird,
									macht eine Pause und vereinbart gemeinsam, wann es weitergeht.
								</Text>
							</Card>
							<Text className="text-body-4 text-secondary-text">
								Hier sind die Hinweise vorbereitet. Später werden sie aus der
								freigegebenen Lernsession und dem Schulmaterial erzeugt.
							</Text>
							<Button
								variant="neutral"
								onPress={() =>
									setSavedPlans(
										saved
											? savedPlans.filter((index) => index !== planIndex)
											: [...savedPlans, planIndex],
									)
								}
								accessibilityState={{ selected: saved }}
							>
								<Text>{saved ? "Gemerkt ✓" : "Für später merken"}</Text>
							</Button>
						</>
					)}
					{page === "homework" && (
						<>
							<Label>{assignment.subject} · Hausaufgabe</Label>
							<Text variant="h1" className="text-left">
								{assignment.title}
							</Text>
							<Text className="text-secondary-text">
								{assignment.done
									? "Erledigt · von Mia markiert"
									: `Abgabe ${assignment.due}`}
							</Text>
							<Card>
								<Label>Aufgabe aus der Schule</Label>
								<Text variant="h3">{assignment.task}</Text>
								<Text>{assignment.note}</Text>
							</Card>
							<Section>So kannst du unterstützen</Section>
							<Card accent>
								<Text>{assignment.help}</Text>
								<Text className="text-body-4 text-secondary-text">
									Beispiel-Hinweis zur Aufgabe · keine Musterlösung
								</Text>
							</Card>
							<Text className="text-body-3 text-secondary-text">
								Mia plant und erledigt die Aufgabe selbst. Der Status wird in
								ihrer Ansicht gepflegt.
							</Text>
							{homeworkIndex === 0 && (
								<Button variant="neutral" onPress={() => openPlan(0)}>
									<Text>Passenden Lernplan ansehen</Text>
								</Button>
							)}
						</>
					)}
					{page === "sharing" && (
						<>
							<Label>Elternzugang</Label>
							<Text variant="h1" className="text-left">
								Mit Mia verbunden.
							</Text>
							<Text className="text-secondary-text">
								Ein eigener Zugang. Gemeinsam vereinbarter Einblick.
							</Text>
							<Card>
								<Text variant="h3">Mia teilt mit dir</Text>
								{[
									"Anstehende Arbeiten und Tests",
									"Lernpläne und nächste Lernschritte",
									"Hausaufgaben und ihren Status",
									"Hilfestellungen zu geteilten Lerninhalten",
								].map((item) => (
									<View key={item} className="flex-row gap-3">
										<Check size={20} color={colors.text} />
										<Text className="flex-1">{item}</Text>
									</View>
								))}
							</Card>
							<Card>
								<Text variant="h3">Mia behält die Kontrolle</Text>
								<Text>
									Die Freigabe wird in Mias Account verwaltet. Persönliche
									Antworten und einzelne Fehler bleiben in ihrer Lernansicht.
								</Text>
								<Text className="text-body-3 text-secondary-text">
									Konzeptvorschlag: Eltern begleiten; Lernpläne und Aufgaben
									werden weiterhin vom Kind bearbeitet.
								</Text>
							</Card>
							<Button variant="neutral" onPress={() => setPage("connect")}>
								<Text>Einladungsablauf ansehen</Text>
							</Button>
						</>
					)}
					{page === "connect" && (
						<>
							<Label>Demo · Zugang und Verknüpfung</Label>
							<Text variant="h1" className="text-left">
								Mia lädt dich ein.
							</Text>
							<Text className="text-secondary-text">
								Begleite ihr Lernen mit deinem eigenen Elternzugang.
							</Text>
							<Card>
								<Text variant="h3">So würde der Einstieg funktionieren</Text>
								<Text>1. Mia sendet dir eine Einladung aus ihrer App.</Text>
								<Text>
									2. Du meldest dich an oder erstellst deinen Eltern-Account.
								</Text>
								<Text>3. Du siehst die von Mia freigegebenen Inhalte.</Text>
							</Card>
							<Text className="text-body-3 text-secondary-text">
								Im Prototyp überspringen wir die Anmeldung. Es wird kein Account
								erstellt und keine Einladung verschickt.
							</Text>
							<Button
								variant="neutral"
								onPress={() => {
									setLinked(true);
									setEmpty(false);
									setPage("home");
								}}
							>
								<Text>Elternansicht ausprobieren</Text>
							</Button>
						</>
					)}
				</View>
				{largeText && controls}
			</ScrollView>
			{!largeText && controls}
		</View>
	);
}
