import { useState } from "react";
import { View } from "react-native";
import { BackButton, Button } from "~/components/ui/button";
import {
	Bell,
	BookOpen,
	CreditCard,
	Logout,
	Mail,
	SquareLock,
	Timer,
	Trash2,
	UserRound,
} from "~/components/ui/icon";
import { Switch } from "~/components/ui/switch";
import { Text } from "~/components/ui/text";
import { InsetTextField } from "~/components/ui/text-field";
import { SettingsContent } from "~/features/settings/settings-content";
import {
	SettingsCard,
	SettingsDivider,
	SettingsRow,
	SettingsSection,
} from "~/features/settings/settings-list";

type Detail =
	| "profile"
	| "support"
	| "times"
	| "subjects"
	| "notifications"
	| "app"
	| "subscription"
	| "ai"
	| "privacy"
	| "terms"
	| "password"
	| "delete";
const titles: Record<Detail, string> = {
	profile: "Profil & Konto",
	support: "Support kontaktieren",
	times: "Lernzeiten",
	subjects: "Persönliche Fächer",
	notifications: "Mitteilungen",
	app: "App-Informationen",
	subscription: "Dayova",
	ai: "KI & Datenschutz",
	privacy: "Datenschutz",
	terms: "Nutzungsbedingungen",
	password: "Passwort ändern",
	delete: "Konto löschen",
};

/** Same settings hierarchy as the student app, with local parent-role actions. */
export function ParentSettings({
	linked,
	onConnection,
	onSignOut,
	onNavigate,
}: {
	linked: boolean;
	onConnection: () => void;
	onSignOut: () => void;
	onNavigate: () => void;
}) {
	const [detail, setDetail] = useState<Detail | null>(null);
	const [name, setName] = useState("Anna");
	const [email, setEmail] = useState("anna@example.com");
	const [savedName, setSavedName] = useState("Anna");
	const [feedback, setFeedback] = useState("");
	const [message, setMessage] = useState("");
	const [notifications, setNotifications] = useState({
		exams: true,
		homework: true,
		weekly: false,
	});
	const [ai, setAi] = useState(true);
	const open = (next: Detail) => {
		onNavigate();
		setFeedback("");
		setDetail(next);
	};
	if (!detail)
		return (
			<SettingsContent
				profileName={savedName}
				onProfile={() => open("profile")}
				support={
					<SettingsCard>
						<SettingsRow
							icon={Mail}
							label="Support kontaktieren"
							onPress={() => open("support")}
						/>
					</SettingsCard>
				}
				learning={
					<>
						<SettingsSection title="Familie">
							<SettingsRow
								icon={UserRound}
								label={linked ? "Mit Mia verbunden" : "Kind verbinden"}
								description="Verbindung & Freigaben"
								onPress={onConnection}
							/>
						</SettingsSection>
						<SettingsSection title="Lernen">
							<SettingsRow
								icon={Timer}
								label="Lernzeiten"
								description="Mias geplante Lernzeiten"
								onPress={() => open("times")}
							/>
							<SettingsDivider />
							<SettingsRow
								icon={BookOpen}
								label="Persönliche Fächer"
								description="Mias Fächer ansehen"
								onPress={() => open("subjects")}
							/>
						</SettingsSection>
					</>
				}
				subscriptionCard={
					<SettingsCard>
						<SettingsRow
							icon={CreditCard}
							label="Dayova"
							description="Zugang & Abo"
							onPress={() => open("subscription")}
						/>
					</SettingsCard>
				}
				isStoreSubscriber={true}
				onLearningTimes={() => open("times")}
				onSubjects={() => open("subjects")}
				onNotifications={() => open("notifications")}
				onAppInformation={() => open("app")}
				onPrivacy={() => open("privacy")}
				onTerms={() => open("terms")}
				openAiConsentSettings={() => open("ai")}
				aiConsentStatusLabel={ai ? "Aktiviert" : "Deaktiviert"}
			/>
		);
	return (
		<View className="gap-7">
			<View className="flex-row items-center gap-4">
				<BackButton
					onPress={() => {
						onNavigate();
						setDetail(
							detail === "password" || detail === "delete" ? "profile" : null,
						);
						setFeedback("");
					}}
				/>
				<Text variant="h2" className="flex-1">
					{titles[detail]}
				</Text>
			</View>
			{detail === "profile" && (
				<>
					<InsetTextField label="Name" value={name} onChangeText={setName} />
					<InsetTextField
						label="E-Mail"
						value={email}
						onChangeText={setEmail}
						autoCapitalize="none"
						keyboardType="email-address"
					/>
					<Button
						onPress={() => {
							if (name.trim().length < 2 || !/^\S+@\S+\.\S+$/.test(email)) {
								setFeedback(
									"Bitte gib einen Namen und eine gültige E-Mail-Adresse ein.",
								);
								return;
							}
							setSavedName(name.trim());
							setFeedback("Profil in dieser Demo gespeichert.");
						}}
					>
						<Text>Änderungen speichern</Text>
					</Button>
					<SettingsSection title="Sicherheit & Konto">
						<SettingsRow
							icon={SquareLock}
							label="Passwort ändern"
							onPress={() => open("password")}
						/>
						<SettingsDivider />
						<SettingsRow icon={Logout} label="Abmelden" onPress={onSignOut} />
						<SettingsDivider />
						<SettingsRow
							icon={Trash2}
							label="Konto löschen"
							destructive
							onPress={() => open("delete")}
						/>
					</SettingsSection>
				</>
			)}
			{detail === "notifications" && (
				<>
					<Text>Worüber möchtest du zu Mias Lernen informiert werden?</Text>
					<SettingsSection title="Erinnerungen">
						{(
							[
								{
									key: "exams",
									label: "Anstehende Arbeiten",
									description: "Zwei Tage vor einer Arbeit oder einem Test",
								},
								{
									key: "homework",
									label: "Fällige Hausaufgaben",
									description: "Am Tag vor der Abgabe",
								},
								{
									key: "weekly",
									label: "Wochenübersicht",
									description: "Einmal pro Woche ein Überblick",
								},
							] as const
						).map(({ key, label, description }) => (
							<SettingsRow
								key={key}
								icon={Bell}
								label={label}
								description={description}
								trailing={
									<Switch
										accessibilityLabel={label}
										value={notifications[key]}
										onValueChange={(value) =>
											setNotifications((current) => ({
												...current,
												[key]: value,
											}))
										}
									/>
								}
							/>
						))}
					</SettingsSection>
					<Text variant="small">
						Demo: Die Auswahl wird hier gespeichert, es werden keine
						Mitteilungen versendet.
					</Text>
				</>
			)}
			{detail === "times" && (
				<>
					<Text>
						{linked
							? "Mias freigegebene Lernzeiten"
							: "Verbinde deinen Elternzugang, um Mias Lernzeiten zu sehen."}
					</Text>
					{linked && (
						<>
							<SettingsSection title="Diese Woche">
								<SettingsRow
									icon={Timer}
									label="Montag · 16:00–16:20"
									description="Mathematik"
									showDisclosure={false}
								/>
								<SettingsDivider />
								<SettingsRow
									icon={Timer}
									label="Donnerstag · 16:00–16:20"
									description="Mathematik"
									showDisclosure={false}
								/>
								<SettingsDivider />
								<SettingsRow
									icon={Timer}
									label="Freitag · 15:30–15:45"
									description="Englisch"
									showDisclosure={false}
								/>
							</SettingsSection>
							<Text variant="small">
								Mia legt ihre Lernzeiten fest. Du kannst gemeinsam mit ihr
								passende Zeiten besprechen.
							</Text>
						</>
					)}
				</>
			)}
			{detail === "subjects" && (
				<>
					{linked ? (
						<SettingsSection title="Mias Fächer">
							{["Mathematik", "Englisch", "Deutsch"].map((subject) => (
								<SettingsRow
									key={subject}
									icon={BookOpen}
									label={subject}
									showDisclosure={false}
								/>
							))}
						</SettingsSection>
					) : (
						<Text>Verbinde deinen Elternzugang, um die Fächer zu sehen.</Text>
					)}
					<Text variant="small">
						Fächer werden in Mias Schüleransicht verwaltet.
					</Text>
				</>
			)}
			{detail === "support" && (
				<>
					<Text>Beschreibe deine Frage zum Elternzugang.</Text>
					<InsetTextField
						label="Deine Nachricht"
						value={message}
						onChangeText={setMessage}
						multiline
					/>
					<Button
						disabled={!message.trim()}
						onPress={() =>
							setFeedback(
								"Deine Support-Anfrage wurde als Demo vorbereitet. Es wurde nichts versendet.",
							)
						}
					>
						<Text>Anfrage ausprobieren</Text>
					</Button>
				</>
			)}
			{detail === "ai" && (
				<>
					<Text>
						Die Elternhilfe nutzt die von Mia freigegebenen Lerninhalte, um
						passende Gesprächsfragen und Übungen vorzuschlagen.
					</Text>
					<SettingsCard>
						<SettingsRow
							icon={SquareLock}
							label="KI-Elternhilfe"
							description="Einwilligung im Prototyp ausprobieren"
							trailing={
								<Switch
									accessibilityLabel="KI-Elternhilfe"
									value={ai}
									onValueChange={setAi}
								/>
							}
						/>
					</SettingsCard>
					<Text variant="small">
						Die Beispielhilfen sind vorbereitet. Dieser Schalter simuliert die
						Einwilligung; es werden keine Inhalte an eine KI übermittelt.
					</Text>
				</>
			)}
			{detail === "subscription" && (
				<>
					<SettingsSection title="Dein Zugang">
						<SettingsRow
							icon={CreditCard}
							label="Dayova"
							description="Elternzugang · Demo"
							showDisclosure={false}
						/>
					</SettingsSection>
					<Text>
						Hier verwaltest du später deinen Zugang und findest Informationen
						zum Abo.
					</Text>
					<Button
						onPress={() =>
							setFeedback(
								"Abo-Verwaltung als Demo geöffnet. Es wird kein Kauf gestartet.",
							)
						}
					>
						<Text>Abo-Verwaltung ansehen</Text>
					</Button>
					<Text variant="small">
						Der Umfang des Elternzugangs und das Abomodell sind noch offen.
					</Text>
				</>
			)}
			{detail === "app" && (
				<>
					<Text variant="h3">Dayova</Text>
					<Text>Elternansicht · klickbarer Entwicklungsprototyp</Text>
					<Text>
						Heute, Pläne und Einstellungen verwenden die Komponenten der
						Schüler-App. Inhalte und Kontofunktionen sind simuliert.
					</Text>
				</>
			)}
			{(detail === "privacy" || detail === "terms") && (
				<>
					<Text>
						{detail === "privacy"
							? "In der Elternansicht siehst du die von deinem Kind freigegebenen Lerninhalte. Persönliche Einzelantworten bleiben in der Schüleransicht."
							: "Hier werden im fertigen Elternzugang die geltenden Nutzungsbedingungen zugänglich sein."}
					</Text>
					<Text variant="small">
						Konzeptvorschau, kein Rechtstext. In dieser Demo werden keine
						Bedingungen akzeptiert und keine Freigaben geändert.
					</Text>
				</>
			)}
			{detail === "password" && (
				<>
					<Text>
						Im fertigen Elternzugang kannst du hier dein eigenes Passwort
						ändern.
					</Text>
					<Button
						onPress={() =>
							setFeedback(
								"Passwortänderung simuliert. Dein echtes Passwort bleibt unverändert.",
							)
						}
					>
						<Text>Passwortänderung ausprobieren</Text>
					</Button>
					<Text variant="small">
						Bitte gib im Prototyp keine echten Zugangsdaten ein.
					</Text>
				</>
			)}
			{detail === "delete" && (
				<>
					<Text>
						Beim Löschen deines Elternkontos wird deine Verbindung zu Mia
						entfernt. Mias Schülerkonto bleibt bestehen.
					</Text>
					<Button
						onPress={() =>
							setFeedback(
								"Kontolöschung simuliert. Es wurde kein Konto gelöscht.",
							)
						}
					>
						<Text>Löschung simulieren</Text>
					</Button>
				</>
			)}
			{!!feedback && <Text accessibilityRole="alert">{feedback}</Text>}
		</View>
	);
}
