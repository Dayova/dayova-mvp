import { useConvexAuth, useMutation, useQuery } from "convex/react";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { api } from "#convex/_generated/api";
import { useAuthSession } from "~/context/AuthContext";
import type { AiConsentSheetMode } from "~/features/privacy/ai-consent-sheet";
import { AiConsentSheet } from "~/features/privacy/ai-consent-sheet";
import { AI_CONSENT_VERSION, type AiConsentSnapshot } from "~/lib/ai-consent";
import { logDiagnosticError } from "~/lib/diagnostics";
import { openExternalUrl } from "~/lib/open-external-url";
import { env } from "~/lib/runtime-config";

type AiConsentContextValue = {
	statusLabel: "Aktiv" | "Nicht aktiv" | "Wird geladen";
	hasCurrentConsent: boolean;
	requestAiConsent: () => Promise<boolean>;
	openAiConsentSettings: () => void;
};

const AiConsentContext = createContext<AiConsentContextValue | null>(null);

function AiConsentProvider({ children }: { children: ReactNode }) {
	const { user, isConvexUserSynced } = useAuthSession();
	const { isAuthenticated } = useConvexAuth();
	const userKey = user?.clerkId ?? null;
	const canQuery = Boolean(user && isAuthenticated && isConvexUserSynced);
	const serverSnapshot = useQuery(
		api.aiConsent.getMine,
		canQuery ? {} : "skip",
	);
	const setDecision = useMutation(api.aiConsent.setDecision);
	const withdraw = useMutation(api.aiConsent.withdraw);
	const [localState, setLocalState] = useState<{
		userKey: string;
		snapshot: AiConsentSnapshot;
	} | null>(null);
	const localSnapshot =
		localState?.userKey === userKey &&
		(localState.snapshot.updatedAt ?? 0) > (serverSnapshot?.updatedAt ?? 0)
			? localState.snapshot
			: null;
	const [visible, setVisible] = useState(false);
	const [mode, setMode] = useState<AiConsentSheetMode>("required");
	const [isBusy, setIsBusy] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const pendingResolversRef = useRef<Array<(allowed: boolean) => void>>([]);
	const stateRef = useRef({
		canQuery,
		isLoaded: !canQuery || serverSnapshot !== undefined,
		snapshot: localSnapshot ?? serverSnapshot ?? null,
	});
	useEffect(() => {
		stateRef.current = {
			canQuery,
			isLoaded: !canQuery || serverSnapshot !== undefined,
			snapshot: localSnapshot ?? serverSnapshot ?? null,
		};
	}, [canQuery, localSnapshot, serverSnapshot]);

	const resolvePending = useCallback((allowed: boolean) => {
		const resolvers = pendingResolversRef.current.splice(0);
		for (const resolve of resolvers) resolve(allowed);
	}, []);

	const showRequiredSheet = useCallback(() => {
		setErrorMessage(null);
		setMode("required");
		setVisible(true);
	}, []);

	useEffect(() => {
		void canQuery;
		void serverSnapshot;
		if (pendingResolversRef.current.length === 0) return;
		const state = stateRef.current;
		if (!state.canQuery) {
			resolvePending(false);
			return;
		}
		if (!state.isLoaded) return;
		if (state.snapshot?.hasCurrentConsent) {
			resolvePending(true);
			return;
		}
		showRequiredSheet();
	}, [canQuery, resolvePending, serverSnapshot, showRequiredSheet]);

	useEffect(
		() => () => {
			const resolvers = pendingResolversRef.current.splice(0);
			for (const resolve of resolvers) resolve(false);
		},
		[],
	);

	const requestAiConsent = useCallback(() => {
		const state = stateRef.current;
		if (!state.canQuery) return Promise.resolve(false);
		if (state.snapshot?.hasCurrentConsent) return Promise.resolve(true);

		return new Promise<boolean>((resolve) => {
			pendingResolversRef.current.push(resolve);
			if (state.isLoaded) showRequiredSheet();
		});
	}, [showRequiredSheet]);

	const close = useCallback(() => {
		if (mode === "required" || isBusy) return;
		setVisible(false);
		setErrorMessage(null);
	}, [isBusy, mode]);

	const handleAccept = useCallback(() => {
		if (isBusy) return;
		setIsBusy(true);
		setErrorMessage(null);
		void setDecision({ decision: "granted", version: AI_CONSENT_VERSION })
			.then((snapshot) => {
				if (userKey) setLocalState({ userKey, snapshot });
				setVisible(false);
				resolvePending(true);
			})
			.catch((error: unknown) => {
				logDiagnosticError("Failed to grant AI consent.", error, {
					source: "aiConsent.grant",
					level: "error",
				});
				setErrorMessage(
					"Die Zustimmung konnte nicht gespeichert werden. Bitte versuche es erneut.",
				);
			})
			.finally(() => setIsBusy(false));
	}, [isBusy, resolvePending, setDecision, userKey]);

	const handleDecline = useCallback(() => {
		if (isBusy) return;
		setIsBusy(true);
		setErrorMessage(null);
		setVisible(false);
		resolvePending(false);
		void setDecision({ decision: "declined", version: AI_CONSENT_VERSION })
			.catch((error: unknown) => {
				logDiagnosticError("Failed to persist declined AI consent.", error, {
					source: "aiConsent.decline",
					level: "warn",
				});
			})
			.finally(() => setIsBusy(false));
	}, [isBusy, resolvePending, setDecision]);

	const handleWithdraw = useCallback(() => {
		if (isBusy) return;
		setIsBusy(true);
		setErrorMessage(null);
		void withdraw({})
			.then((snapshot) => {
				if (userKey) setLocalState({ userKey, snapshot });
				setVisible(false);
			})
			.catch((error: unknown) => {
				logDiagnosticError("Failed to withdraw AI consent.", error, {
					source: "aiConsent.withdraw",
					level: "error",
				});
				setErrorMessage(
					"Die Zustimmung konnte nicht widerrufen werden. Bitte versuche es erneut.",
				);
			})
			.finally(() => setIsBusy(false));
	}, [isBusy, userKey, withdraw]);

	const openAiConsentSettings = useCallback(() => {
		setErrorMessage(null);
		setMode("manage");
		setVisible(true);
	}, []);

	const openPrivacy = useCallback(() => {
		void openExternalUrl(env.EXPO_PUBLIC_PRIVACY_URL).then((opened) => {
			setErrorMessage(
				opened
					? null
					: "Die Datenschutzerklärung konnte nicht geöffnet werden. Bitte versuche es erneut.",
			);
		});
	}, []);

	const snapshot = localSnapshot ?? serverSnapshot ?? null;
	const value = useMemo<AiConsentContextValue>(
		() => ({
			statusLabel:
				!canQuery || serverSnapshot === undefined
					? "Wird geladen"
					: snapshot?.hasCurrentConsent
						? "Aktiv"
						: "Nicht aktiv",
			hasCurrentConsent: snapshot?.hasCurrentConsent ?? false,
			requestAiConsent,
			openAiConsentSettings,
		}),
		[
			canQuery,
			openAiConsentSettings,
			requestAiConsent,
			serverSnapshot,
			snapshot?.hasCurrentConsent,
		],
	);

	return (
		<AiConsentContext.Provider value={value}>
			{children}
			<AiConsentSheet
				visible={visible}
				mode={mode}
				hasCurrentConsent={snapshot?.hasCurrentConsent ?? false}
				isBusy={isBusy}
				errorMessage={errorMessage}
				onAccept={handleAccept}
				onDecline={handleDecline}
				onWithdraw={handleWithdraw}
				onClose={close}
				onOpenPrivacy={openPrivacy}
			/>
		</AiConsentContext.Provider>
	);
}

function useAiConsent() {
	const value = useContext(AiConsentContext);
	if (!value) {
		throw new Error("useAiConsent must be used within AiConsentProvider");
	}
	return value;
}

export { AiConsentProvider, useAiConsent };
