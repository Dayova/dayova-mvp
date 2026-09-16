import type { ReactNode } from "react";
import { ActivityIndicator, View } from "react-native";
import { Button } from "~/components/ui/button";
import { DayovaSheetFrame } from "~/components/ui/dayova-sheet-frame";
import { ErrorMessage } from "~/components/ui/error-message";
import { Sparkles } from "~/components/ui/icon";
import { Surface } from "~/components/ui/surface";
import { Text } from "~/components/ui/text";
import { AI_CONSENT_PROVIDER } from "~/lib/ai-consent";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { useDayovaTheme } from "~/lib/theme";

type AiConsentSheetMode = "required" | "manage";

type AiConsentSheetProps = {
	visible: boolean;
	mode: AiConsentSheetMode;
	hasCurrentConsent: boolean;
	isBusy: boolean;
	errorMessage: string | null;
	onAccept: () => void;
	onDecline: () => void;
	onWithdraw: () => void;
	onClose: () => void;
	onOpenPrivacy: () => void;
};

const DATA_CATEGORIES = [
	"Inhalte und Dateinamen deiner Lernmaterialien und Stundenpläne",
	"Prüfungsfach, Prüfungsart, Termin, Themen und Notizen",
	"Deine Lernzeiten, Antworten und dein bisheriger Lernfortschritt",
] as const;

function DataCategory({ children }: { children: ReactNode }) {
	return (
		<View className="flex-row items-start gap-3">
			<View
				accessible={false}
				className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary"
			/>
			<Text className="flex-1 font-poppins text-body-3 text-text">
				{children}
			</Text>
		</View>
	);
}

function AiConsentSheet({
	visible,
	mode,
	hasCurrentConsent,
	isBusy,
	errorMessage,
	onAccept,
	onDecline,
	onWithdraw,
	onClose,
	onOpenPrivacy,
}: AiConsentSheetProps) {
	const { colors } = useDayovaTheme();
	const isRequired = mode === "required";
	const description = hasCurrentConsent
		? "Du hast Dayova erlaubt, die unten beschriebenen Daten für KI-Funktionen zu übermitteln."
		: "Entscheide selbst, ob Dayova deine Daten für persönliche KI-Lernfunktionen übermitteln darf.";

	const footer = hasCurrentConsent ? (
		<View className="gap-3">
			<Button disabled={isBusy} onPress={onClose}>
				{isBusy ? (
					<ActivityIndicator color={DAYOVA_DESIGN_SYSTEM.colors.light1} />
				) : (
					<Text>Fertig</Text>
				)}
			</Button>
			<Button disabled={isBusy} onPress={onWithdraw} variant="neutral">
				<Text>Zustimmung widerrufen</Text>
			</Button>
		</View>
	) : (
		<View className="gap-3">
			<Button disabled={isBusy} onPress={onAccept}>
				{isBusy ? (
					<ActivityIndicator color={DAYOVA_DESIGN_SYSTEM.colors.light1} />
				) : (
					<Text>Zustimmen und fortfahren</Text>
				)}
			</Button>
			<Button
				disabled={isBusy}
				onPress={isRequired ? onDecline : onClose}
				variant="neutral"
			>
				<Text>Nicht zustimmen</Text>
			</Button>
		</View>
	);

	return (
		<DayovaSheetFrame
			visible={visible}
			title="KI-Verarbeitung erlauben?"
			description={description}
			onClose={onClose}
			dismissible={!isRequired && !isBusy}
			showCloseButton={!isRequired}
			closeAccessibilityLabel="KI-Datenschutz schließen"
			size="medium"
			scrollable
			footer={footer}
		>
			<View className="gap-5">
				<Surface className="flex-row items-center gap-4 rounded-3xl border border-border bg-muted p-4 shadow-none">
					<View className="h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/15">
						<Sparkles size={24} color={colors.primary} strokeWidth={2} />
					</View>
					<View className="min-w-0 flex-1">
						<Text className="font-poppins font-semibold text-body-3 text-text">
							Empfänger
						</Text>
						<Text className="font-poppins text-body-3 text-secondary-text">
							{AI_CONSENT_PROVIDER}
						</Text>
					</View>
				</Surface>

				<View className="gap-3">
					<Text
						accessibilityRole="header"
						className="font-poppins font-semibold text-body-2 text-text"
					>
						Welche Daten werden übermittelt?
					</Text>
					{DATA_CATEGORIES.map((category) => (
						<DataCategory key={category}>{category}</DataCategory>
					))}
				</View>

				<View className="gap-2">
					<Text
						accessibilityRole="header"
						className="font-poppins font-semibold text-body-2 text-text"
					>
						Wofür werden die Daten verwendet?
					</Text>
					<Text className="font-poppins text-body-3 text-secondary-text">
						Nur um deinen Lernplan, Diagnosefragen, Lerninhalte und die
						Stundenplan-Erkennung bereitzustellen. KI-generierte Ergebnisse
						können Fehler enthalten.
					</Text>
				</View>

				<Text className="font-poppins text-body-4 text-secondary-text">
					Ohne deine Zustimmung sendet Dayova keine Daten an{" "}
					{AI_CONSENT_PROVIDER}. Du kannst deine Zustimmung jederzeit in den
					Einstellungen für die Zukunft widerrufen.
				</Text>

				<Button
					accessibilityHint="Öffnet die Dayova-Datenschutzerklärung."
					className="self-start px-0 shadow-none"
					disabled={isBusy}
					onPress={onOpenPrivacy}
					variant="link"
					size="sm"
				>
					<Text>Mehr zum Datenschutz</Text>
				</Button>
				{errorMessage ? <ErrorMessage>{errorMessage}</ErrorMessage> : null}
			</View>
		</DayovaSheetFrame>
	);
}

export type { AiConsentSheetMode };
export { AiConsentSheet };
