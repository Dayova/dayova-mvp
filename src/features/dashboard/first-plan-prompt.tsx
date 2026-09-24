import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { api } from "#convex/_generated/api";
import { ConfirmationSheet } from "~/components/ui/confirmation-sheet";
import { useAccess } from "~/context/AccessContext";
import { useAuthSession } from "~/context/AuthContext";
import { ROUTES } from "~/lib/routes";

export function FirstPlanPrompt() {
	const { user, onboardingCompletionStatus, isPostAuthSyncing } =
		useAuthSession();
	const { isAuthenticated } = useConvexAuth();
	const { access, isAccessLoading } = useAccess();
	const [focused, setFocused] = useState(false);
	useFocusEffect(
		useCallback(() => {
			setFocused(true);
			return () => setFocused(false);
		}, []),
	);
	const ready = Boolean(
		user &&
			isAuthenticated &&
			onboardingCompletionStatus === "none" &&
			!isPostAuthSyncing &&
			!isAccessLoading &&
			access?.canUseApp &&
			focused,
	);
	const pending = useQuery(
		api.users.shouldShowFirstPlanPrompt,
		ready ? {} : "skip",
	);
	const resolve = useMutation(api.users.resolveFirstPlanPrompt);
	const router = useRouter();
	const inFlight = useRef(false);
	const [busy, setBusy] = useState(false);
	const [handled, setHandled] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const choose = async (choice: "create" | "explore") => {
		if (inFlight.current) return;
		inFlight.current = true;
		setBusy(true);
		setError(null);
		try {
			const accepted = await resolve({ choice });
			setHandled(true);
			if (accepted && choice === "create") router.push(ROUTES.createExam);
		} catch {
			setError(
				"Deine Auswahl konnte nicht gespeichert werden. Bitte versuche es erneut.",
			);
		} finally {
			inFlight.current = false;
			setBusy(false);
		}
	};
	return (
		<ConfirmationSheet
			visible={ready && pending === true && !handled}
			title="Bereit für deinen ersten Lernplan?"
			description="Trage deine nächste Prüfung ein. Danach erstellen wir mit deinen Themen und Unterlagen deinen persönlichen Lernplan."
			confirmLabel="Jetzt Lernplan erstellen"
			cancelLabel="Erstmal die App anschauen"
			closeAccessibilityLabel="Erstmal die App anschauen"
			confirmTone="primary"
			actionLayout="stacked"
			isBusy={busy}
			errorMessage={error}
			onConfirm={() => void choose("create")}
			onClose={() => void choose("explore")}
		/>
	);
}
