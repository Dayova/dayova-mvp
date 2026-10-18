import { z } from "zod";
import {
	MAX_MULTIPLE_CHOICE_OPTION_CHARS,
	MAX_MULTIPLE_CHOICE_PROMPT_CHARS,
} from "../convex/learningSessionContentConstraints";
import { MAX_LEARNING_TOPIC_COUNT } from "../convex/learningTopicMap";

const MAX_SESSION_TITLE_CHARS = 28;
const MIN_TOPIC_MAP_COUNT = 3;
export const GERMAN_UI_TEXT_RULE =
	"All visible German UI text must use correct umlauts and ß, not ae/oe/ue/ss substitutions.";
const KNOWLEDGE_QUESTIONS_OUTPUT_DESCRIPTION = `${GERMAN_UI_TEXT_RULE} Return exactly ten objectively assessable questions for the first-session knowledge check.`;
const GENERATED_PLAN_OUTPUT_DESCRIPTION = `${GERMAN_UI_TEXT_RULE} Return a realistic, calendar-ready German learning plan with concrete study sessions.`;
export const sessionPhaseSchema = z.enum(["theory", "practice", "rehearsal"]);
export type GeneratedSessionPhase = z.infer<typeof sessionPhaseSchema>;

const atMostArray = <TItem extends z.ZodType>(
	itemSchema: TItem,
	maxItems: number,
) =>
	z.preprocess(
		(value) => (Array.isArray(value) ? value.slice(0, maxItems) : value),
		z.array(itemSchema).max(maxItems),
	);

const boundedArray = <TItem extends z.ZodType>(
	itemSchema: TItem,
	minItems: number,
	maxItems: number,
) =>
	z.preprocess(
		(value) => (Array.isArray(value) ? value.slice(0, maxItems) : value),
		z.array(itemSchema).min(minItems).max(maxItems),
	);

const exactArray = <TItem extends z.ZodType>(
	itemSchema: TItem,
	itemCount: number,
) =>
	z.preprocess(
		(value) => (Array.isArray(value) ? value.slice(0, itemCount) : value),
		z.array(itemSchema).length(itemCount),
	);

export const germanTextSchema = (
	minLength: number,
	description: string,
	maxVisibleLength?: number,
) =>
	(maxVisibleLength
		? z.string().min(minLength).max(maxVisibleLength)
		: z.string().min(minLength)
	).describe(`${description} ${GERMAN_UI_TEXT_RULE}`);

export type GeneratedGermanText = z.infer<ReturnType<typeof germanTextSchema>>;

export const questionsSchema = z
	.object({
		sourceSummary: germanTextSchema(
			20,
			"Brief German summary of the uploaded learning material.",
		),
		topics: boundedArray(
			z.object({
				id: z
					.string()
					.min(3)
					.max(48)
					.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
				title: germanTextSchema(3, "Short German name of one exam topic."),
				learningGoal: germanTextSchema(
					12,
					"Observable German learning goal for this topic.",
				),
				keywords: boundedArray(
					germanTextSchema(2, "Short German keyword for this topic."),
					1,
					8,
				),
				priority: z.enum(["high", "medium", "low"]),
				requiredEvidenceDimensions: z
					.array(z.enum(["understanding", "problemSolving", "independent"]))
					.min(1)
					.max(3)
					.describe(
						"Evidence dimensions actually required by the exam material for this topic: understanding for explaining concepts, problemSolving for selecting and applying a method, independent for completing exam-like tasks without hints.",
					),
			}),
			MIN_TOPIC_MAP_COUNT,
			MAX_LEARNING_TOPIC_COUNT,
		),
		questions: boundedArray(
			z.object({
				topicId: z.string().min(3).max(48),
				kind: z.literal("performance"),
				evidenceDimension: z.enum([
					"understanding",
					"problemSolving",
					"independent",
				]),
				responseKind: z.enum(["multipleChoice", "shortText", "longText"]),
				options: atMostArray(
					germanTextSchema(
						1,
						"One concise German answer option. Only return options for multiple-choice questions.",
						100,
					),
					4,
				),
				correctOptionIndex: z.number().int().min(0).max(3).nullable(),
				prompt: germanTextSchema(
					12,
					"One short, direct German diagnostic question the student can answer without deciphering nested instructions. Ask one thing only and never reference files or uploads.",
					180,
				),
				targetInsight: germanTextSchema(
					8,
					"What this answer reveals about the student's strengths, gaps, or needed learning blocks.",
				),
				idealAnswer: germanTextSchema(
					1,
					"Concise German ideal answer used to evaluate the student's response.",
				),
				explanation: germanTextSchema(
					12,
					"Brief German feedback that explains why the ideal answer is correct.",
				),
				evaluationKeywords: boundedArray(
					germanTextSchema(
						1,
						"Short expected concept or result used to evaluate demonstrated knowledge.",
					),
					1,
					5,
				),
			}),
			10,
			10,
		),
	})
	.describe(KNOWLEDGE_QUESTIONS_OUTPUT_DESCRIPTION);

export const generatedPlanSchema = z
	.object({
		sourceSummary: germanTextSchema(
			20,
			"Brief German summary of the material used for this plan.",
		),
		insight: z.object({
			summary: germanTextSchema(
				20,
				"German summary of the student's current readiness.",
			),
			strengths: atMostArray(
				germanTextSchema(
					1,
					"Specific topic or skill the student already handles well.",
				),
				4,
			),
			gaps: boundedArray(
				germanTextSchema(
					1,
					"Specific gap that should shape the generated study sessions.",
				),
				1,
				5,
			),
		}),
		sessions: boundedArray(
			z.object({
				phase: sessionPhaseSchema,
				title: germanTextSchema(
					3,
					`Short German UI label for this study session. Max ${MAX_SESSION_TITLE_CHARS} characters.`,
				),
				dayOffsetBeforeExam: z.number().int().min(0).max(120),
				startTime: z.string().regex(/^\d{2}:\d{2}$/),
				durationMinutes: z.number().int().min(15).max(180),
				goal: germanTextSchema(
					20,
					"Student-facing goal for this session, tied to the student's answers and exam topic.",
				),
				tasks: boundedArray(
					germanTextSchema(
						8,
						"Concrete task the student can complete during this study session.",
					),
					2,
					5,
				),
				expectedOutcome: germanTextSchema(
					12,
					"Observable result the student should have after finishing this session.",
				),
			}),
			1,
			5,
		),
	})
	.describe(GENERATED_PLAN_OUTPUT_DESCRIPTION);

export const generatedTaskChoiceSchema = z.object({
	text: germanTextSchema(
		1,
		`Concise German answer option containing one concept and at most one distinguishing characteristic. Keep it within ${MAX_MULTIPLE_CHOICE_OPTION_CHARS} characters.`,
	),
	isCorrect: z.boolean(),
});

export const writtenAnswerEvaluationSchema = z.object({
	rating: z.enum(["notCorrect", "partiallyCorrect", "correct"]),
	review: germanTextSchema(
		12,
		"A concise German review of the learner's answer. State what is correct and integrate the essential correction or correct result without adding a separate ideal-answer section.",
		700,
	),
});

const generatedTaskBaseSchema = {
	title: germanTextSchema(3, "Short German UI label for this task."),
	explanation: germanTextSchema(
		20,
		"German feedback explanation that teaches the key idea and common mistake.",
	),
	idealAnswer: germanTextSchema(
		1,
		"German ideal answer; concise numeric or technical answers are valid when the explanation contains the reasoning.",
	),
	keywords: atMostArray(
		germanTextSchema(
			1,
			"Short German evaluation keyword; numeric answers such as 6 are valid.",
		),
		8,
	),
};

export const generatedTaskItemSchema = z.union([
	z.object({
		kind: z.literal("multipleChoice"),
		...generatedTaskBaseSchema,
		prompt: germanTextSchema(
			12,
			"One direct German multiple-choice question without irrelevant scenario details.",
			MAX_MULTIPLE_CHOICE_PROMPT_CHARS,
		),
		choices: z.array(generatedTaskChoiceSchema).min(2).max(4),
	}),
	z.object({
		kind: z.literal("written"),
		...generatedTaskBaseSchema,
		prompt: germanTextSchema(
			12,
			"Concrete German written task prompt the learner can answer directly.",
		),
	}),
]);

export const generatedTheoryItemSchema = z.object({
	conceptTitle: germanTextSchema(
		3,
		"Short, precise German title for exactly one concept.",
	),
	question: germanTextSchema(
		12,
		"One short German curiosity question shown before the theory. The learner has not seen the explanation yet and must be able to answer with an intuitive first guess. Ask one thing only. Never demand a definition, complete list, comparison, or step-by-step solution. Avoid specialist wording when everyday language works.",
		140,
	),
	explanation: germanTextSchema(
		60,
		"Concise German teaching explanation in one or two connected sentences. Explain why the idea works, not only what the result is.",
		320,
	),
	keyPoints: boundedArray(
		germanTextSchema(
			12,
			"One specific German key point that adds information and is not merely a keyword or a copy of another section.",
			150,
		),
		1,
		2,
	),
	example: germanTextSchema(
		45,
		"A concrete worked German example with an input or situation, the decisive step, and the result. Never copy the short answer or memory cue.",
		300,
	),
	memoryCue: germanTextSchema(
		12,
		"One memorable German rule of thumb that helps recall the concept. It must not duplicate the example or a key point.",
		120,
	),
	commonMistake: germanTextSchema(
		24,
		"One concept-specific German mistake, including how the learner can notice or prevent it.",
		180,
	),
	keywords: atMostArray(
		germanTextSchema(
			1,
			"Short German evaluation keyword; numeric answers such as 6 are valid.",
		),
		8,
	),
});

export const createSessionTasksSchema = (itemCount: number) =>
	z
		.object({
			items: exactArray(generatedTaskItemSchema, itemCount),
		})
		.describe(
			`${GERMAN_UI_TEXT_RULE} Return concrete guided-practice or praxis tasks for a learning session.`,
		);

export const createTheoryTopicsSchema = (itemCount: number) =>
	z
		.object({
			items: exactArray(generatedTheoryItemSchema, itemCount),
		})
		.describe(
			`${GERMAN_UI_TEXT_RULE} Return self-contained, instructional theory pages for a learning session.`,
		);

export const generatedTextRetrySystemInstruction = (attempt: number) =>
	attempt === 0
		? ""
		: " Die vorherige Ausgabe war ungültig oder wiederholte bereits vorhandene Fragen. Erzeuge alle Fragen vollständig neu, ohne inhaltliche Duplikate und mit korrekten Unicode-Zeichen wie ä, ö, ü, Ä, Ö, Ü und ß.";

export const theoryGenerationSystemInstruction = (attempt: number) =>
	`Du bist ein präziser Lerncoach für Schüler der 10. bis 12. Klasse in Deutschland. Erstelle eine zusammenhängende Mini-Lektion aus kurzen deutschen Theorie-Seiten. Jede Seite konzentriert sich auf die in der Planung genannte Seitenrolle und baut auf der vorherigen Seite auf. Alle Pflichtfelder des Schemas unterstützen diese Rolle, statt ein zweites Thema einzuführen. Wiederhole keine Erklärung, kein Beispiel und keinen Merksatz auf einer späteren Seite.

Die hochgeladenen Schulunterlagen und die gespeicherte Materialzusammenfassung sind die fachliche Quelle. Übernimm ihre Begriffe und Schwerpunktsetzung. Erfinde keine Gesetze, Grenzwerte, Formeln, Fachbegriffe oder angeblichen Prüfungsanforderungen, die dort nicht belegt sind. Falls für ein Beispiel Details fehlen, verwende ein einfaches, ausdrücklich illustratives Beispiel ohne neue Fachbehauptungen.

Die erste Leitfrage wird vor der Erklärung als lockerer Einstieg gezeigt. Sie muss ohne Vorwissen mit einer Vermutung beantwortbar sein, genau eine Sache fragen und darf keine Definition, vollständige Aufzählung, keinen Vergleich oder fertigen Lösungsweg verlangen. Spätere Leitfragen lenken jeweils auf den nächsten Gedanken der Mini-Lektion.

Schreibe klar und altersgerecht. Halte alle Felder knapp: eine bis zwei Erklärungssätze, ein bis zwei konkrete Kernpunkte, ein kurzes nachvollziehbares Beispiel, einen knappen Merksatz und einen spezifischen Fehlerhinweis. Die Bereiche dürfen sich nicht inhaltlich wiederholen. Verwende keine Meta-Anweisungen oder internen Labels. Halte Reihenfolge und Seitenrollen exakt ein und antworte ausschließlich im vorgegebenen JSON-Schema.${generatedTextRetrySystemInstruction(attempt)}`;

export const writtenAnswerSystemInstruction = `Du bewertest schriftliche Antworten von Schülerinnen und Schülern fachlich präzise und fair. Bewerte Bedeutung, Lösungsweg und Vollständigkeit – niemals Wortanzahl, Schreibstil oder bloße Schlüsselworttreffer. "correct" gilt nur, wenn alle für die Frage wesentlichen Aussagen oder Rechenschritte stimmen. "partiallyCorrect" gilt bei einem fachlich brauchbaren Ansatz mit einer konkreten Lücke. "notCorrect" gilt bei einem falschen Ergebnis, einem grundlegenden Missverständnis oder fehlender fachlicher Substanz.

Die Rückmeldung besteht aus höchstens zwei kurzen deutschen Sätzen in direkter Du-Ansprache. Nenne konkret, welcher Teil der Antwort stimmt und welcher Teil fehlt oder falsch ist. Integriere das richtige Ergebnis oder die entscheidende fachliche Korrektur ausdrücklich in dieselbe Rückmeldung. Gib dafür nur die nötige Kernaussage der idealen Antwort wieder, nicht die vollständige Musterlösung. Die Rückmeldung muss allein verständlich sein und darf den Lernenden nicht auf eine separate ideale oder perfekte Antwort verweisen. Verwende keine Überschriften, keine Listen, keine Punktebewertung und keine allgemeinen Floskeln. Antworte ausschließlich im vorgegebenen JSON-Schema. ${GERMAN_UI_TEXT_RULE}`;
export type WrittenAnswerContext = {
	subject: string;
	topicTitle: string | null;
	learningGoal: string | null;
	evidenceDimension: string | null;
	questionAngle: string | null;
	prompt: string;
	idealAnswer: string;
	explanation: string;
	evaluationKeywords: string[];
};
export const buildWrittenAnswerPrompt = (
	context: WrittenAnswerContext,
	answerText: string,
) => `Fach: ${context.subject}
Thema: ${context.topicTitle ?? "Nicht näher benannt"}
Lernziel: ${context.learningGoal ?? "Nicht näher benannt"}
Evidenzdimension: ${context.evidenceDimension ?? "allgemein"}
Aufgabenart: ${context.questionAngle ?? "allgemein"}

Frage:
${context.prompt}

Antwort des Lernenden:
${answerText}

Ideale Antwort:
${context.idealAnswer}

Fachliche Erklärung:
${context.explanation}

Erwartete Kernbegriffe oder Ergebnisse (nur als Hilfsmittel, nicht als Worttreffer-Test):
${context.evaluationKeywords.join("; ") || "Keine zusätzlichen Kernbegriffe"}`;

export const sessionTaskSystemInstruction = (attempt: number) =>
	`Du bist ein praxisnaher Lerncoach. Erstelle natürliche, konkrete Aufgaben, die der Schüler ohne Entschlüsseln einer Meta-Anweisung direkt bearbeiten kann. Gib bei Rechen- oder Anwendungsaufgaben alle nötigen Werte und Bedingungen an. Frage pro Aufgabe genau eine Leistung ab. Zitiere keine andere Aufgabenformulierung, verwende keine internen Labels wie „Variante 1“ und schreibe nie Konstruktionen wie „Erkläre deinen Lösungsweg zu …“. Halte die vorgegebene Reihenfolge, Antwortmodi und individuellen Zeitbudgets ein. Antworte ausschließlich im vorgegebenen JSON-Schema.${generatedTextRetrySystemInstruction(attempt)}`;
export const batchTaskSystemInstruction = (attempt: number) =>
	`Du bist ein praxisnaher Lerncoach. Erstelle direkte, konkrete deutsche Aufgaben mit allen nötigen Werten und Bedingungen. Halte Reihenfolge, Antwortmodi und Zeitbudgets exakt ein und antworte ausschließlich im JSON-Schema.${generatedTextRetrySystemInstruction(attempt)}`;
export const diagnosticSystemInstruction = (attempt: number) =>
	`Du bist ein präziser Lerncoach für Schüler der 10. bis 12. Klasse in Deutschland. Antworte ausschließlich im vorgegebenen JSON-Schema.${generatedTextRetrySystemInstruction(attempt)}`;
export const planSystemInstruction = (attempt: number) =>
	`Du bist ein strenger, praxisnaher Lernplaner. Plane nur realistische, kalendereignete Lernslots und antworte ausschließlich im vorgegebenen JSON-Schema.${generatedTextRetrySystemInstruction(attempt)}`;

const PREFERRED_TOPIC_MAP_COUNT = 6;
export const TOPIC_MAP_GENERATION_INSTRUCTION = `Erstelle zuerst eine möglichst vollständige Themenkarte mit ${MIN_TOPIC_MAP_COUNT} bis ${MAX_LEARNING_TOPIC_COUNT} klar getrennten, einzeln prüfbaren Fähigkeiten. Ziele auf mindestens ${PREFERRED_TOPIC_MAP_COUNT} Themen, wenn die internen Schulmaterialien genügend fachliche Substanz enthalten; erfinde oder dupliziere aber keine Themen, um diese Zahl zu erreichen. Zerlege breite Sammelthemen in konkrete Fähigkeiten, die der Schüler jeweils erklären und in einer Aufgabe anwenden oder lösen können muss. Nutze kurze stabile ASCII-IDs wie "steigung-berechnen". Das learningGoal beschreibt beobachtbar, was der Schüler zu diesem Thema verstehen und lösen oder anwenden können muss. requiredEvidenceDimensions enthält grundsätzlich understanding und problemSolving; ergänze independent, wenn das Material eine selbstständige prüfungsnahe Anwendung verlangt. Lass problemSolving nur bei nachweislich reinem Faktenwissen weg. Nutze die vom Lernenden angegebenen Prüfungsthemen, um die relevanten Inhalte in den internen Schulmaterialien zu erkennen. Leite den wahrscheinlichen Prüfungsstoff aus dieser Themenangabe und den internen Schulmaterialien ab; die Schulmaterialien bleiben für die konkrete Ausgestaltung maßgeblich. Externe Lernhilfen definieren niemals den Prüfungsstoff. Priorisiere explizite Prüfungshinweise vor allgemeinen oder älteren Übungsinhalten.`;
export const buildDiagnosticPrompt = (baseContext: string) => `${baseContext}

${TOPIC_MAP_GENERATION_INSTRUCTION}
Verteile die Fragen über die bestätigten Prüfungsthemen, mit mehr Gewicht auf wichtige Themen. Erstelle danach genau 10 kurze, objektiv bewertbare Fragen für den Wissenscheck in der ersten Lernsession. Jede Frage muss als kind "performance" tatsächliches Wissen durch kurzes Lösen, Erklären oder Anwenden prüfen. Verwende keine Selbsteinschätzungs- oder Sicherheitsfragen. Ordne jede Frage über topicId exakt einer zuvor erzeugten Themen-ID und über evidenceDimension genau einer Evidenzdimension zu. Liefere außerdem eine fachlich richtige idealAnswer, eine kurze explanation und 1 bis 5 evaluationKeywords. Ziel ist nicht Notengebung, sondern belastbare Evidenz für den jeweils nächsten Lernschritt.
Die Fragen müssen sich konkret auf Prüfungsthema und Inhalte aus dem Material beziehen, aber wie normale Prüfungs- oder Verständnisfragen formuliert sein.
Jede Frage fragt genau eine Sache ab, ist ohne verschachtelte Arbeitsanweisung direkt verständlich und lässt sich in wenigen Sätzen beantworten.
Keine Frage darf eine andere Aufgabenformulierung zitieren oder Formulierungen wie „Erkläre deinen Lösungsweg zu …“ enthalten.
Verweise in den Fragen nie direkt auf Quellen oder Uploads: keine Formulierungen wie "laut Material", "im Dokument", "auf dem Bild", "in der Datei", "Material 3 sagt" und keine Dateinamen.
Wähle für jede Frage das Antwortformat mit der geringsten Reibung, das noch belastbare Evidenz liefert:
- multipleChoice für klare fachliche Unterscheidungen; liefere dann 3 bis 4 kurze plausible Optionen.
- shortText für Zahlen, Formeln, Begriffe oder Antworten bis ungefähr einem Satz; liefere dann options: [].
- longText nur wenn ein Lösungsweg oder eine Begründung wirklich beobachtet werden muss; liefere dann options: [].
Liefere für jede multipleChoice-Frage den nullbasierten correctOptionIndex der eindeutig richtigen Option. Für shortText und longText ist correctOptionIndex null.
Verwende bei 10 Fragen mindestens 4 Multiple-Choice-Fragen und höchstens 3 longText-Fragen. "Weiß ich nicht" wird separat von der App angeboten und gehört nicht in options.
Formuliere alle sichtbaren Texte in korrektem Deutsch mit Umlauten und Sonderzeichen: ä, ö, ü, Ä, Ö, Ü, ß. Verwende keine Ersatzschreibweisen wie ae, oe, ue oder ss, wenn ein Umlaut oder ß gemeint ist.`;
