import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { api } from "#convex/_generated/api";
import { ScreenHeader } from "~/components/screen-header";
import { Button } from "~/components/ui/button";
import { ErrorMessage } from "~/components/ui/error-message";
import { Screen, ScreenScroll } from "~/components/ui/screen";
import { Text } from "~/components/ui/text";
import { ThemedStatusBar } from "~/components/ui/themed-status-bar";
import { useAuthSession } from "~/context/AuthContext";
import { ContactPreferencesForm } from "~/features/settings/contact-preferences-form";
import { createAsyncActionGate } from "~/lib/async-action-gate";
import {
	CONTACT_CONSENT_VERSION,
	type ContactChoice,
	type ContactPreferences,
	contactChoiceError,
	emptyContactChoice,
	prepareContactChoice,
} from "~/lib/contact-preferences";
import { goBackOrReplace } from "~/lib/navigation";
import { useFeatureAnalytics } from "~/lib/use-feature-analytics";

export default function ContactPreferencesScreen() {
	const router = useRouter();
	const { user } = useAuthSession();
	const { isAuthenticated } = useConvexAuth();
	const snapshot = useQuery(
		api.contactPreferences.getMine,
		user && isAuthenticated ? {} : "skip",
	);
	return (
		<Screen>
			<ThemedStatusBar />
			<ScreenScroll horizontalPadding={24}>
				<ScreenHeader
					title="Kontakt mit Dayova"
					onBack={() => goBackOrReplace(router, "/settings")}
				/>
				{snapshot === undefined ? (
					<ActivityIndicator accessibilityLabel="Kontaktauswahl wird geladen" />
				) : (
					<ContactSettings key={user?.clerkId} snapshot={snapshot} />
				)}
			</ScreenScroll>
		</Screen>
	);
}

function ContactSettings({
	snapshot,
}: {
	snapshot: ContactPreferences | null;
}) {
	const save = useMutation(api.contactPreferences.save);
	const withdraw = useMutation(api.contactPreferences.withdraw);
	const track = useFeatureAnalytics();
	const [choice, setChoice] = useState<ContactChoice>(() =>
		snapshot?.version === CONTACT_CONSENT_VERSION
			? snapshot
			: { ...emptyContactChoice(), phone: snapshot?.phone ?? "" },
	);
	const [revision, setRevision] = useState(snapshot?.revision ?? 0);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [saved, setSaved] = useState(false);
	const gate = useRef(createAsyncActionGate());
	const changedElsewhere = (snapshot?.revision ?? 0) > revision;
	const run = (revoke: boolean) => {
		void gate.current.run(async () => {
			setError(null);
			setSaved(false);
			const validation = revoke ? null : contactChoiceError(choice);
			if (validation) {
				setError(validation);
				return;
			}
			setBusy(true);
			try {
				const confirmed = revoke
					? await withdraw({})
					: await save({
							choice: prepareContactChoice(choice),
							expectedRevision: revision,
						});
				setChoice(confirmed);
				setRevision(confirmed.revision);
				setSaved(true);
				track(
					revoke ? "settings.contact_withdrawn" : "settings.contact_saved",
					"succeeded",
				);
			} catch {
				setError(
					"Die Kontaktauswahl konnte nicht gespeichert werden. Prüfe deine Verbindung und versuche es erneut.",
				);
			} finally {
				setBusy(false);
			}
		});
	};
	return (
		<View className="gap-5">
			<Text className="text-body-2 text-secondary-text">
				Du entscheidest, ob und wofür wir dich persönlich kontaktieren dürfen.
			</Text>
			<ContactPreferencesForm
				choice={choice}
				busy={busy}
				onChange={(value) => {
					setChoice(value);
					setSaved(false);
					setError(null);
				}}
			/>
			{changedElsewhere ? (
				<View className="gap-2">
					<ErrorMessage>
						Deine Kontaktauswahl wurde inzwischen geändert. Lade die aktuelle
						Auswahl, bevor du speicherst.
					</ErrorMessage>
					<Button
						variant="link"
						disabled={busy}
						onPress={() => {
							setChoice(
								snapshot?.version === CONTACT_CONSENT_VERSION
									? snapshot
									: emptyContactChoice(),
							);
							setRevision(snapshot?.revision ?? 0);
							setSaved(false);
							setError(null);
						}}
					>
						<Text>Aktuelle Auswahl laden</Text>
					</Button>
				</View>
			) : null}
			{error ? <ErrorMessage>{error}</ErrorMessage> : null}
			{saved ? (
				<Text
					accessibilityLiveRegion="polite"
					className="text-body-3 text-text"
				>
					Deine Kontaktauswahl wurde gespeichert.
				</Text>
			) : null}
			<Button
				disabled={busy || changedElsewhere}
				accessibilityState={{ busy, disabled: busy || changedElsewhere }}
				onPress={() => run(false)}
			>
				<Text>{busy ? "Wird gespeichert …" : "Auswahl speichern"}</Text>
			</Button>
			<Button variant="link" disabled={busy} onPress={() => run(true)}>
				<Text>Alle Kontaktfreigaben widerrufen</Text>
			</Button>
		</View>
	);
}
