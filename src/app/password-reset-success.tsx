import { useRouter } from "expo-router";
import { Screen } from "~/components/ui/screen";
import { SuccessConfirmationScreen } from "~/components/ui/success-confirmation-screen";
import { ThemedStatusBar } from "~/components/ui/themed-status-bar";

export default function PasswordResetSuccessScreen() {
	const router = useRouter();

	return (
		<Screen>
			<ThemedStatusBar />
			<SuccessConfirmationScreen
				title="Passwort gespeichert"
				detailLabel="Dein neues Passwort ist aktiv."
				detailValue="Alle anderen Geräte wurden abgemeldet."
				onFinish={() => router.replace("/home")}
			/>
		</Screen>
	);
}
