import { useState } from "react";
import { View } from "react-native";
import type { Id } from "#convex/_generated/dataModel";
import { Button } from "~/components/ui/button";
import { Surface } from "~/components/ui/surface";
import { Text } from "~/components/ui/text";
import { LearningPathVisual } from "~/features/learning-plans/learning-path-visual";
import { SessionPreviewCard } from "~/features/learning-plans/session-preview-card";
import type { PlanSession } from "~/features/learning-plans/types";

type Lesson = {
	title: string;
	goal: string;
	explanation: string;
	example: string;
	mistake: string;
	question: string;
	answer: string;
	exercise: string;
	graphic: "halves" | "expand" | "add" | "verbs" | "negative" | "questions";
};
const math: Lesson[] = [
	{
		title: "Brüche darstellen",
		goal: "Zähler und Nenner verstehen",
		explanation:
			"Ein Bruch beschreibt gleich große Teile eines Ganzen. Der Nenner nennt die Anzahl aller Teile. Der Zähler sagt, wie viele davon gemeint sind. Vergleichen lässt sich die Menge nur, wenn die Ganzen gleich groß sind.",
		example:
			"Bei 1/2 ist eines von zwei gleich großen Teilen markiert. Bei 2/4 sind es zwei von vier Teilen. Beide Markierungen bedecken die Hälfte.",
		mistake:
			"Ein größerer Nenner bedeutet bei gleichem Zähler kleinere Stücke, nicht automatisch mehr.",
		question: "Warum sind 1/2 und 2/4 gleich viel?",
		answer:
			"Das gleiche Ganze wird feiner aufgeteilt. Die markierte Menge bleibt gleich.",
		exercise:
			"Faltet zwei gleich große Papierstreifen in zwei beziehungsweise vier Teile und markiert jeweils die Hälfte.",
		graphic: "halves",
	},
	{
		title: "Brüche auf einen Nenner bringen",
		goal: "Brüche erweitern und gleich große Teile herstellen",
		explanation:
			"Zum Vergleichen oder Addieren brauchen Brüche gleich große Teile. Beim Erweitern werden Zähler und Nenner mit derselben Zahl multipliziert. Der Wert bleibt erhalten. Ein gemeinsamer Nenner von 2 und 4 ist 4.",
		example:
			"1/2 = (1 × 2)/(2 × 2) = 2/4. Jetzt lassen sich 2/4 und 1/4 direkt vergleichen.",
		mistake:
			"Nur den Nenner zu verändern würde den Wert verändern. Zähler und Nenner müssen denselben Faktor bekommen.",
		question: "Was verändert sich beim Erweitern – und was bleibt gleich?",
		answer:
			"Die Anzahl und Größe der Stücke verändern sich. Die dargestellte Menge bleibt gleich.",
		exercise:
			"Lasst Mia 1/3 auf Sechstel erweitern und mit einer Zeichnung erklären: 1/3 = 2/6.",
		graphic: "expand",
	},
	{
		title: "Brüche addieren",
		goal: "Ungleichnamige Brüche richtig zusammenfassen",
		explanation:
			"Zuerst auf einen gemeinsamen Nenner bringen, dann die Zähler addieren. Der Nenner bleibt gleich, weil die Stücke ihre Größe behalten. Das Ergebnis lässt sich manchmal noch kürzen.",
		example: "1/2 + 1/4 = 2/4 + 1/4 = 3/4.",
		mistake: "Die Nenner werden nicht addiert. 1/2 + 1/4 ist nicht 2/6.",
		question: "Warum bleibt der Nenner bei 2/4 + 1/4 gleich?",
		answer:
			"Wir zählen Viertel zusammen. Aus zwei Vierteln und einem Viertel werden drei Viertel.",
		exercise:
			"Rechnet gemeinsam 1/3 + 1/6. Mia erklärt jeden Schritt: 2/6 + 1/6 = 3/6 = 1/2.",
		graphic: "add",
	},
];
const english: Lesson[] = [
	{
		title: "Von gestern erzählen",
		goal: "Abgeschlossene Ereignisse erkennen",
		explanation:
			"Das simple past beschreibt abgeschlossene Ereignisse in der Vergangenheit. Zeitangaben wie yesterday oder last weekend helfen beim Einordnen. Die Verbform zeigt die Vergangenheit an.",
		example:
			"Today I play. Yesterday I played. Bei go lautet die Vergangenheitsform went.",
		mistake:
			"Nicht jedes Verb bekommt -ed: unregelmäßige Formen werden gesondert gelernt.",
		question: "Welche Wörter zeigen, dass die Geschichte schon passiert ist?",
		answer: "Zum Beispiel yesterday, last week oder two days ago.",
		exercise:
			"Mia erzählt zwei Dinge von gestern. Sucht gemeinsam das Zeitwort und das Verb.",
		graphic: "verbs",
	},
	{
		title: "Regelmäßige und unregelmäßige Verben",
		goal: "Passende Vergangenheitsformen auswählen",
		explanation:
			"Regelmäßige Verben bilden die Vergangenheit meist mit -ed, zum Beispiel play → played. Unregelmäßige Verben haben eigene Formen, etwa go → went. Diese Formen bleiben bei I, you, he und they gleich.",
		example: "I played football. She went home. They saw a film.",
		mistake:
			"Formen wie goed sind falsch. Die passende Form lässt sich in der Verbliste nachschlagen.",
		question: "Welche Form passt: Yesterday she go oder went home?",
		answer: "Went: Yesterday she went home.",
		exercise:
			"Mia wählt drei Verben aus dem Hefteintrag und formuliert je einen Satz über gestern.",
		graphic: "verbs",
	},
	{
		title: "Fragen mit did",
		goal: "Fragen und Verneinungen im simple past bilden",
		explanation:
			"Bei Fragen übernimmt did die Vergangenheit. Das Hauptverb steht deshalb in der Grundform: Did you go? Bei Verneinungen gilt dasselbe: I did not go oder I didn’t go.",
		example: "She went home. → Did she go home? → She didn’t go home.",
		mistake: "Nicht Did she went? Nach did steht go, nicht went.",
		question: "Warum heißt es Did you see und nicht Did you saw?",
		answer:
			"Did zeigt bereits die Vergangenheit an. See bleibt in der Grundform.",
		exercise:
			"Formt She played tennis in eine Frage um: Did she play tennis? Dann in eine Verneinung: She didn’t play tennis.",
		graphic: "questions",
	},
];
export const parentLessons = [math, english];
export function parentSessions(planIndex: number): PlanSession[] {
	return parentLessons[planIndex].map((lesson, index) => ({
		id: `parent-${planIndex}-${index}` as Id<"learningPlanSessions">,
		phase: index === 2 ? "practice" : "theory",
		title: lesson.title,
		dateKey: `2026-10-${index === 0 ? 14 : index === 1 ? (planIndex === 0 ? 15 : 16) : 17}`,
		dateLabel:
			index === 0
				? "Mi, 14.10."
				: index === 1
					? planIndex === 0
						? "Do, 15.10."
						: "Fr, 16.10."
					: "Sa, 17.10.",
		startTime: planIndex === 0 ? "16:00" : "17:00",
		durationMinutes: planIndex === 0 ? 20 : 15,
		goal: lesson.goal,
		tasks: [],
		expectedOutcome: lesson.goal,
		sortOrder: index,
		completed: index === 0,
		executionStatus: index === 0 ? "completed" : "notStarted",
		planningStatus: index === 2 ? "provisional" : "committed",
	}));
}

export function ParentLearningPlan({
	planIndex,
	onRead,
	selectedIndex,
	onSelect,
}: {
	planIndex: number;
	onRead: () => void;
	selectedIndex: number;
	onSelect: (index: number) => void;
}) {
	const sessions = parentSessions(planIndex);
	const session = sessions[selectedIndex];
	const isMath = planIndex === 0;
	return (
		<View className="gap-7">
			<Surface className="gap-2 p-5">
				<Text variant="small">
					{isMath ? "Mathematik · Klassenarbeit" : "Englisch · Test"}
				</Text>
				<Text variant="h3">
					{isMath ? "20. Oktober · in 5 Tagen" : "23. Oktober · in 8 Tagen"}
				</Text>
				<Text>{isMath ? "Brüche verstehen" : "Simple past erzählen"}</Text>
				<Text variant="small">
					1 von 3 Einheiten abgeschlossen · Stand der Demo: 15.10.2026
				</Text>
			</Surface>
			<SessionPreviewCard
				key={session.id}
				canOpen
				session={session}
				onOpen={onRead}
				actionLabelOverride={
					selectedIndex === 2 ? "Themenvorschau lesen" : "Thema verstehen"
				}
			/>
			{selectedIndex === 2 && (
				<Text variant="small">
					Adaptive Vorschau: Inhalt und Termin können sich nach Mias nächster
					Einheit ändern. Die Erklärung zeigt das geplante Thema.
				</Text>
			)}
			<LearningPathVisual
				mode="screen"
				sessions={sessions}
				selectedSessionId={session.id}
				showsAdaptiveContinuation={false}
				examDateLabel={isMath ? "Di, 20. Oktober" : "Fr, 23. Oktober"}
				examCountdownLabel={isMath ? "In 5 Tagen" : "In 8 Tagen"}
				onSelectSession={(next) =>
					onSelect(sessions.findIndex((item) => item.id === next.id))
				}
				onOpenSession={onRead}
			/>
			<Surface className="gap-3 p-5">
				<Text variant="h3">Was gehört zur Arbeit?</Text>
				{parentLessons[planIndex].map((lesson) => (
					<Text key={lesson.title}>• {lesson.title}</Text>
				))}
			</Surface>
			<Text variant="small">
				Gleicher Lernpfad wie bei Mia. Du liest Erklärungen zu ihren Einheiten;
				ihren Fortschritt verändert das nicht.
			</Text>
		</View>
	);
}
function FractionBar({
	parts,
	filled,
	label,
}: {
	parts: number;
	filled: number;
	label: string;
}) {
	return (
		<View accessible accessibilityLabel={label} className="gap-2">
			<Text className="font-semibold">{label}</Text>
			<View className="h-11 flex-row overflow-hidden rounded-lg border border-primary">
				{["first", "second", "third", "fourth"]
					.slice(0, parts)
					.map((segment, i) => (
						<View
							key={segment}
							className={`flex-1 border-primary border-r ${i < filled ? "bg-primary" : "bg-card"}`}
						/>
					))}
			</View>
		</View>
	);
}
function LessonGraphic({ kind }: { kind: Lesson["graphic"] }) {
	if (kind === "halves" || kind === "expand")
		return (
			<Surface className="gap-5 p-5">
				<Text variant="h3">Gleiche Menge, andere Einteilung</Text>
				<FractionBar parts={2} filled={1} label="1/2 · ein halbes Ganzes" />
				<Text className="text-center font-semibold">
					Zähler × 2 · Nenner × 2
				</Text>
				<FractionBar parts={4} filled={2} label="2/4 · dasselbe halbe Ganze" />
				<Text variant="small">
					Beide Balken stellen ein gleich großes Ganzes dar. Die blaue Fläche
					bleibt gleich.
				</Text>
			</Surface>
		);
	if (kind === "add")
		return (
			<Surface className="gap-4 p-5">
				<Text variant="h3">Viertel zusammenzählen</Text>
				<FractionBar parts={4} filled={2} label="1/2 = 2/4" />
				<Text>+ 1/4</Text>
				<FractionBar parts={4} filled={3} label="Ergebnis: 3/4" />
				<Text variant="small">
					Zwei Viertel plus ein Viertel ergeben drei Viertel.
				</Text>
			</Surface>
		);
	const rows =
		kind === "questions"
			? [
					["Aussage", "She went home."],
					["Frage", "Did she go home?"],
					["Verneinung", "She didn’t go home."],
				]
			: [
					["play → played", "regelmäßig"],
					["go → went", "unregelmäßig"],
					["see → saw", "unregelmäßig"],
				];
	return (
		<Surface className="gap-4 p-5">
			<Text variant="h3">
				{kind === "questions"
					? "Ein Satz, drei Formen"
					: "Verbformen im Überblick"}
			</Text>
			{rows.map(([left, right]) => (
				<View key={left} className="gap-1 border-border border-b pb-3">
					<Text className="font-semibold">{left}</Text>
					<Text>{right}</Text>
				</View>
			))}
			<Text variant="small">
				{kind === "questions"
					? "did + Grundform: Die Vergangenheit steckt bereits in did."
					: "Vergangenheit ← yesterday · today → Gegenwart"}
			</Text>
		</Surface>
	);
}
export function ParentUnitReading({
	planIndex,
	selectedIndex,
}: {
	planIndex: number;
	selectedIndex: number;
}) {
	const lesson = parentLessons[planIndex][selectedIndex];
	const [showHelp, setShowHelp] = useState(false);
	return (
		<View className="gap-6">
			<Text variant="small">
				{planIndex === 0 ? "Mathematik" : "Englisch"} · Einheit{" "}
				{selectedIndex + 1} ·{" "}
				{selectedIndex === 0
					? "Abgeschlossen"
					: selectedIndex === 1
						? "Aktueller Lernschritt"
						: "Themenvorschau"}
			</Text>
			<Text variant="h2">{lesson.title}</Text>
			<Text>{lesson.goal}</Text>
			<Surface className="gap-3 p-5">
				<Text variant="h3">Das Thema verstehen</Text>
				<Text>{lesson.explanation}</Text>
			</Surface>
			<LessonGraphic kind={lesson.graphic} />
			<Surface className="gap-3 p-5">
				<Text variant="h3">Ein Beispiel Schritt für Schritt</Text>
				<Text>{lesson.example}</Text>
			</Surface>
			<Surface className="gap-3 p-5">
				<Text variant="h3">Darauf kommt es an</Text>
				<Text>{lesson.mistake}</Text>
			</Surface>
			<Button
				variant="neutral"
				accessibilityState={{ expanded: showHelp }}
				onPress={() => setShowHelp(!showHelp)}
			>
				<Text>
					{showHelp ? "Unterstützung ausblenden" : "So kannst du unterstützen"}
				</Text>
			</Button>
			{showHelp && (
				<Surface className="gap-4 p-5">
					<Text variant="h3">Gemeinsam lernen · etwa 5 Minuten</Text>
					<Text className="font-semibold">Frag Mia: „{lesson.question}“</Text>
					<Text>Für dich: {lesson.answer}</Text>
					<Text>{lesson.exercise}</Text>
					<Text variant="small">
						Lass Mia zuerst selbst erklären. Wenn sie stockt, schaut gemeinsam
						auf die Grafik. Eine kurze Pause ist auch in Ordnung.
					</Text>
				</Surface>
			)}
			<Text variant="small">
				Beispiel-Grundlage:{" "}
				{planIndex === 0
					? "Arbeitsblatt Brüche · Seite 2"
					: "Unit 3 · Hefteintrag vom 12.10."}
				. Vorbereitete Erklärung und Grafik für diesen Prototyp; keine
				Auswertung echten Schulmaterials.
			</Text>
		</View>
	);
}
