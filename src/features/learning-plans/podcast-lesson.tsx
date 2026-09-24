import type { AudioSource } from "expo-audio";
import { type ReactNode, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import type { PodcastScript } from "#convex/podcastContent";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { cn } from "~/lib/utils";
import { PodcastPlayer } from "./podcast-episode";

/** One shared flow for real episodes and the development preview. */
export function PodcastLesson({
	title,
	goal,
	script,
	audio,
	position,
	listened,
	answers,
	onProgress,
	onAnswer,
	onExit,
	onStageChange,
	materials,
	preview = false,
}: {
	title: string;
	goal: string;
	script: PodcastScript;
	audio: AudioSource;
	position: number;
	listened: boolean;
	answers: number[];
	onProgress: (seconds: number) => Promise<unknown>;
	onAnswer: (question: number, option: number) => Promise<unknown>;
	onExit: () => void;
	onStageChange?: () => void;
	materials?: ReactNode;
	preview?: boolean;
}) {
	const [stage, setStage] = useState<"listen" | "questions" | "complete">(
		"listen",
	);
	const [finished, setFinished] = useState(listened);
	const [transcript, setTranscript] = useState(false);
	const [showMaterials, setShowMaterials] = useState(false);
	const [questionIndex, setQuestionIndex] = useState(0);
	const [selected, setSelected] = useState<number | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const gate = useRef(false);
	const lastLayout = useRef<string | null>(null);
	const layoutKey = stage === "questions" ? `question-${questionIndex}` : stage;
	function resetScroll() {
		if (lastLayout.current === layoutKey) return;
		lastLayout.current = layoutKey;
		onStageChange?.();
	}
	const question = script.questions[questionIndex];
	const submitted = answers[questionIndex] ?? -1;
	const correct = script.questions.filter(
		(q, index) => answers[index] === q.correctIndex,
	).length;
	function changeStage(next: typeof stage) {
		setStage(next);
		setError(null);
	}
	async function submit() {
		if (selected === null || gate.current) return;
		gate.current = true;
		setBusy(true);
		setError(null);
		try {
			await onAnswer(questionIndex, selected);
		} catch {
			setError(
				"Deine Antwort konnte nicht gespeichert werden. Bitte versuche es erneut.",
			);
		} finally {
			gate.current = false;
			setBusy(false);
		}
	}
	if (stage === "complete")
		return (
			<View key="complete" onLayout={resetScroll} className="gap-8">
				<View className="gap-3">
					<Text className="font-poppins font-semibold text-body-4 text-primary">
						ZUSAMMENFASSUNG
					</Text>
					<Text
						accessibilityRole="header"
						className="font-poppins font-semibold text-heading-2 text-text"
					>
						Das nimmst du mit
					</Text>
					<Text selectable className="text-body-2 text-secondary-text">
						Du hast {correct} von 3 Fragen richtig beantwortet. Die drei
						Kerngedanken findest du hier noch einmal.
					</Text>
				</View>
				<View className="gap-5 rounded-card bg-card p-6">
					{script.questions.map((q, index) => (
						<View key={q.prompt} className="gap-2">
							<Text className="font-poppins font-semibold text-body-4 text-primary">
								{index + 1} / 3
							</Text>
							<Text selectable className="text-body-2 text-text">
								{q.explanation}
							</Text>
						</View>
					))}
				</View>
				<Text className="text-body-3 text-secondary-text">
					Der Podcast-Check ist abgeschlossen. Dein Lernplan und dein Lernstand
					bleiben unverändert.
				</Text>
				<Button onPress={onExit}>
					<Text>Zurück zum Lernplan</Text>
				</Button>
				<Button variant="ghost" onPress={() => changeStage("listen")}>
					<Text>Noch einmal anhören</Text>
				</Button>
			</View>
		);
	if (stage === "questions")
		return (
			<View
				key={`question-${questionIndex}`}
				onLayout={resetScroll}
				className="gap-8"
			>
				<View className="gap-3">
					<Text className="font-poppins font-semibold text-body-4 text-primary">
						FRAGE {questionIndex + 1} VON 3
					</Text>
					<Text
						accessibilityRole="header"
						className="font-poppins font-semibold text-heading-2 text-text"
					>
						{question.prompt}
					</Text>
					<Text className="text-body-3 text-secondary-text">
						Erinnere dich an das Gespräch. Wähle eine Antwort.
					</Text>
				</View>
				<View className="gap-3">
					{question.options.map((option, index) => (
						<Pressable
							key={option}
							accessibilityRole="radio"
							accessibilityLabel={option}
							accessibilityState={{
								checked: (submitted >= 0 ? submitted : selected) === index,
								disabled: busy || submitted >= 0,
							}}
							disabled={busy || submitted >= 0}
							onPress={() => setSelected(index)}
							className={cn(
								"min-h-16 justify-center rounded-3xl border border-border bg-card p-5",
								(submitted >= 0 ? submitted : selected) === index &&
									"border-primary bg-system-subtle",
							)}
						>
							<Text className="text-body-2 text-text">{option}</Text>
						</Pressable>
					))}
				</View>
				{submitted >= 0 ? (
					<View
						accessibilityLiveRegion="polite"
						className="gap-3 rounded-3xl bg-card p-5"
					>
						<Text className="font-poppins font-semibold text-body-2 text-text">
							{submitted === question.correctIndex
								? "Richtig!"
								: "Noch nicht ganz"}
						</Text>
						<Text selectable className="text-body-2 text-secondary-text">
							{question.explanation}
						</Text>
					</View>
				) : null}
				{error ? (
					<Text
						accessibilityRole="alert"
						className="text-body-3 text-destructive"
					>
						{error}
					</Text>
				) : null}
				{submitted >= 0 ? (
					<Button
						onPress={() => {
							if (questionIndex === 2) changeStage("complete");
							else {
								setQuestionIndex(questionIndex + 1);
								setSelected(null);
							}
						}}
					>
						<Text>
							{questionIndex === 2
								? "Zusammenfassung ansehen"
								: "Nächste Frage"}
						</Text>
					</Button>
				) : (
					<Button
						disabled={selected === null || busy}
						accessibilityState={{ busy }}
						onPress={() => void submit()}
					>
						<Text>{busy ? "Wird gespeichert …" : "Antwort prüfen"}</Text>
					</Button>
				)}
				<Button variant="ghost" onPress={() => changeStage("listen")}>
					<Text>Noch einmal reinhören</Text>
				</Button>
			</View>
		);
	return (
		<View key="listen" onLayout={resetScroll} className="gap-8">
			<View className="gap-3">
				<Text className="font-poppins font-semibold text-body-4 text-primary">
					1 ANHÖREN · 2 ZUSAMMENFASSEN
				</Text>
				<Text
					accessibilityRole="header"
					className="font-poppins font-semibold text-heading-2 text-text"
				>
					{title}
				</Text>
				<Text selectable className="text-body-2 text-secondary-text">
					{goal}
				</Text>
			</View>
			{preview ? (
				<Text className="text-body-4 text-secondary-text">
					Ablauf-Test mit Systemstimmen – keine Vorschau der späteren
					KI-Stimmqualität.
				</Text>
			) : null}
			<PodcastPlayer
				caption={preview ? "Technische Hörprobe · Systemstimmen" : undefined}
				url={audio}
				title={title}
				initialPosition={position}
				onProgress={onProgress}
				onFinished={() => setFinished(true)}
			/>
			{finished || listened ? (
				<Button
					onPress={() => {
						const next = script.questions.findIndex(
							(_, index) => (answers[index] ?? -1) < 0,
						);
						setQuestionIndex(next < 0 ? 0 : next);
						setSelected(null);
						changeStage(next < 0 ? "complete" : "questions");
					}}
				>
					<Text>
						{answers.filter((answer) => answer >= 0).length === 3
							? "Zusammenfassung ansehen"
							: "Weiter zu den 3 Fragen"}
					</Text>
				</Button>
			) : (
				<Text className="text-body-3 text-secondary-text">
					Hör dir zuerst das Gespräch an. Danach fasst du es mit drei kurzen
					Fragen zusammen.
				</Text>
			)}
			<View className="gap-2 border-border border-t pt-4">
				<Button
					variant="ghost"
					accessibilityState={{ expanded: transcript }}
					onPress={() => setTranscript(!transcript)}
				>
					<Text>
						{transcript ? "Transkript schließen" : "Transkript mitlesen"}
					</Text>
				</Button>
				{transcript ? (
					<View className="gap-5 py-4">
						{script.turns.map((turn, index) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: Transcript turns are immutable and can repeat.
							<View key={index} className="gap-2">
								<Text className="font-poppins font-semibold text-body-4 text-primary">
									{turn.speaker}
								</Text>
								<Text selectable className="text-body-2 text-text">
									{turn.text}
								</Text>
							</View>
						))}
					</View>
				) : null}
				{materials ? (
					<>
						<Button
							variant="ghost"
							accessibilityState={{ expanded: showMaterials }}
							onPress={() => setShowMaterials(!showMaterials)}
						>
							<Text>Materialien zum Gespräch</Text>
						</Button>
						{showMaterials ? materials : null}
					</>
				) : null}
			</View>
		</View>
	);
}
