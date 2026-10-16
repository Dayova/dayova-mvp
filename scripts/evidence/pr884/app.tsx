// Isolated native component evidence. Never imported by the production entry.
import "../../../src/global.css";
import { vars } from "nativewind";
import { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, Linking, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import {
	SafeAreaProvider,
	useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Button } from "~/components/ui/button";
import { Screen, ScreenScroll } from "~/components/ui/screen";
import { Text } from "~/components/ui/text";
import { ThemedStatusBar } from "~/components/ui/themed-status-bar";
import { LearningPlanCreationProgressHeader } from "~/features/learning-plans/creation-progress-header";
import {
	MaterialUploadStep,
	RequiredTopicsStep,
} from "~/features/learning-plans/learning-plan-setup-steps";
import type { SearchTopics } from "~/features/learning-plans/topic-search";
import { DayovaThemeProvider, useDayovaTheme } from "~/lib/theme";
import { DARK_THEME_VARIABLES } from "~/lib/theme-variables";

// Generated verbatim from the pinned integration base by prepare.cjs.
const {
	RequiredTopicsStep: Baseline,
} = require("../../../src/features/learning-plans/pr884-baseline.generated");

import { isMeaningfulTopicDescription } from "../../../convex/topicDescriptionValidation";

const accounting = "Buchhaltung, Inventur, Belege, Inventar, Vermögen, Bilanz";
const tax =
	"* Umsatzsteuer (USt)\n* Vorsteuer (VSt)\n* Netto- und Bruttobeträge\n* Umsatzsteuersätze 19 % und 7 %\n* Umsatzsteuer berechnen\n* Vorsteuer berechnen\n* Netto aus Brutto berechnen\n* Brutto aus Netto berechnen\n* Zahllast berechnen\n* Vorsteuerüberhang\n* Mehrwert / Mehrwertsteuer\n* Wareneingang und Warenausgang\n* Umsatzsteuer beim Einkauf und Verkauf\n* Rolle des Finanzamts\n* Endverbraucher und Umsatzsteuer\n* Rohgewinn im Zusammenhang mit Netto-/Bruttobeträgen";
const vector =
	"Analytische Geometrie ohne Hilfsmittel\n• Vektoren und ihre Beträge\n• Spiegeln an Ebenen und Achsen\n• Skalarprodukt und Winkel";
const examples: Record<string, string> = {
	accounting,
	tax,
	conditions: vector,
	"before-conditions": vector,
	"before-tax": tax,
	single: "Evolution",
	vague: "Wiederholung Klasse 8–10",
	task: "Aufgabe 3 auf Seite 42",
	placeholder: "asdf",
	busy: "Gedichtanalyse",
	error: "Gedichtanalyse",
	results: "Metaphern und ihre Wirkung erklären",
	retry: "Metaphern und ihre Wirkung erklären",
	many: vector,
	stale: "Gedichtanalyse",
	subject: "Gedichtanalyse",
};
const titles = [
	"Vektoren",
	"Vektoren addieren",
	"Vektoren im Raum",
	"Vektoren und Geraden",
	"Vektoren und Ebenen",
	"Vektoren multiplizieren",
	"Vektoren zeichnen",
];

function EvidenceScreen() {
	const { isDark, setPreference } = useDayovaTheme();
	const insets = useSafeAreaInsets();
	const [scenario, setScenario] = useState("after");
	const [topics, setTopics] = useState("");
	const [subject, setSubject] = useState("Deutsch");
	const [material, setMaterial] = useState(false);
	const [notice, setNotice] = useState<string | null>(null);
	const [generation, setGeneration] = useState(0);
	const attempts = useRef(0);
	useEffect(() => {
		const open = ({ url }: { url: string }) => {
			const params = new URL(url).searchParams;
			const next = params.get("case") ?? "after";
			if (params.get("keep") === "1") {
				setSubject(params.get("subject") ?? "Mathematik");
				return;
			}
			Keyboard.dismiss();
			attempts.current = 0;
			setScenario(next);
			setTopics(params.get("topics") ?? examples[next] ?? "");
			setSubject(
				params.get("subject") ??
					(next === "accounting"
						? "Rechnungswesen"
						: ["tax", "conditions", "many", "legacy"].includes(next)
							? "Mathematik"
							: next === "single"
								? "Biologie"
								: "Deutsch"),
			);
			if (next === "legacy") setTopics(accounting);
			setMaterial(false);
			setNotice(
				next === "validation"
					? "Beschreibe das Prüfungsthema bitte genauer."
					: null,
			);
			setGeneration((value) => value + 1);
			void setPreference(params.get("theme") === "dark" ? "dark" : "light");
		};
		const listener = Linking.addEventListener("url", open);
		void Linking.getInitialURL().then((url) => {
			if (url) open({ url });
		});
		return () => listener.remove();
	}, [setPreference]);
	const searchTopics = useCallback<SearchTopics>(
		async (args) => {
			if (scenario === "controlled-context") {
				return {
					topics: [
						{
							id: "bio",
							title: "Vorgänge in der Zelle",
							subjects: ["Biologie"],
							isAdditional: false,
						},
						{
							id: "it",
							title: "Zellen in Tabellen",
							subjects: ["Informatik"],
							isAdditional: true,
						},
					],
					truncated: false,
				};
			}
			if (
				[
					"after",
					"live",
					"legacy",
					"accounting",
					"tax",
					"conditions",
					"single",
					"vague",
					"task",
					"placeholder",
				].includes(scenario)
			) {
				const url = `http://127.0.0.1:8764/?query=${encodeURIComponent(args.query)}&subject=${encodeURIComponent(args.subject)}`;
				const response = await fetch(url);
				if (!response.ok) throw new Error("Provider unavailable");
				return response.json();
			}
			const attempt = ++attempts.current;
			await new Promise((resolve) =>
				setTimeout(
					resolve,
					scenario === "loading"
						? 60_000
						: scenario === "stale" && args.query === "Alt"
							? 15000
							: 700,
				),
			);
			if (scenario === "error" || (scenario === "retry" && attempt === 1))
				throw new Error("Simulated outage");
			if (scenario === "empty") return { topics: [], truncated: false };
			const result =
				scenario === "many"
					? titles
					: args.query === "Alt"
						? ["ALTE ANTWORT – darf nicht erscheinen"]
						: args.subject === "Mathematik"
							? ["Vektoren"]
							: ["Gedichtanalyse"];
			return {
				topics: result.map((title, index) => ({ id: String(index), title })),
				truncated: scenario === "many",
			};
		},
		[scenario],
	);
	const canContinue =
		scenario !== "busy" && isMeaningfulTopicDescription(topics);
	const props = {
		topics,
		canContinue,
		isBusy: scenario === "busy",
		errorMessage: notice,
		onChangeTopics: setTopics,
		onContinue: () => {
			Keyboard.dismiss();
			setMaterial(true);
		},
	};
	return (
		<View
			key={generation}
			style={[{ flex: 1 }, isDark ? vars(DARK_THEME_VARIABLES) : undefined]}
		>
			<Screen>
				<ThemedStatusBar />
				<View
					className="bg-background px-8 pb-8"
					style={{ paddingTop: Math.max(insets.top + 20, 52) }}
				>
					<LearningPlanCreationProgressHeader
						currentStep={material ? 3.5 : 3}
						onClose={() =>
							setNotice("Isolierter Testaufbau: kein Lernplan gespeichert.")
						}
						onBack={() => {
							setMaterial(false);
							setNotice(null);
						}}
					/>
				</View>
				<ScreenScroll
					key={`${generation}-${material}`}
					includeTopSafeArea={false}
					topPadding={0}
					contentContainerStyle={{ flexGrow: 1 }}
				>
					{material ? (
						<MaterialUploadStep
							canUpload
							canContinue={false}
							documents={[]}
							errorMessage={null}
							isBusy={false}
							isUploading={false}
							onContinue={() => {}}
							onOpenUpload={() => {}}
							onRemoveDocument={() => {}}
							onSkip={() => setMaterial(false)}
							openingUploadAction={null}
						/>
					) : scenario.startsWith("before") ? (
						<Baseline {...props} />
					) : (
						<RequiredTopicsStep
							key={generation}
							{...props}
							subject={subject}
							searchTopics={searchTopics}
						/>
					)}
					{material ? (
						<Button variant="neutral" onPress={() => setMaterial(false)}>
							<Text>Zurück zu meinen Themen</Text>
						</Button>
					) : null}
				</ScreenScroll>
				<Text
					className="bg-background px-8 font-poppins text-body-5 text-secondary-text"
					style={{ paddingBottom: Math.max(insets.bottom, 8) }}
				>
					PR 884 · isolierte Komponente · {scenario} · {subject}
				</Text>
			</Screen>
		</View>
	);
}

export default function EvidenceApp() {
	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
			<SafeAreaProvider>
				<DayovaThemeProvider>
					<KeyboardProvider preload={false}>
						<EvidenceScreen />
					</KeyboardProvider>
				</DayovaThemeProvider>
			</SafeAreaProvider>
		</GestureHandlerRootView>
	);
}
