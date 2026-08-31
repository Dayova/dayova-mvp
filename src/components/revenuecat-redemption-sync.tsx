import { useRouter } from "expo-router";
import {
	useCallback,
	useEffect,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";
import { Platform } from "react-native";
import {
	RedemptionStatusOverlay,
	type RedemptionFailure,
} from "~/features/access/redemption-status-overlay";
import { useAccess } from "~/context/AccessContext";
import { useAuthSession } from "~/context/AuthContext";
import { logDiagnosticError } from "~/lib/diagnostics";
import { createNativeRevenueCatClient } from "~/lib/revenuecat-client";
import {
	clearPendingRevenueCatRedemptionUrl,
	getPendingRevenueCatRedemptionUrl,
	subscribeToRevenueCatRedemptionUrl,
} from "~/lib/revenuecat-redemption";
import { env } from "~/lib/runtime-config";

const CONFIGURATION_FAILURE: RedemptionFailure = {
	title: "Abo-Verknüpfung nicht verfügbar",
	description:
		"Diese App-Version kann Website-Käufe noch nicht verbinden. Bitte aktualisiere Dayova und öffne den Link anschließend erneut.",
	canRetry: false,
};

const VERIFICATION_FAILURE: RedemptionFailure = {
	title: "Kauf bestätigt, Zugang noch nicht aktualisiert",
	description:
		"RevenueCat hat den Kauf verbunden, aber Dayova konnte den Zugang noch nicht bestätigen. Versuche die Prüfung bitte erneut.",
	canRetry: true,
};

const RETRYABLE_REDEMPTION_FAILURE: RedemptionFailure = {
	title: "Abo konnte noch nicht verbunden werden",
	description:
		"Die Verbindung zu RevenueCat war nicht erfolgreich. Prüfe deine Internetverbindung und versuche es erneut.",
	canRetry: true,
};

const getStoreApiKey = () =>
	Platform.select({
		ios: env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
		android: env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY,
	});

export function RevenueCatRedemptionSync() {
	const router = useRouter();
	const { refreshPaidAccess } = useAccess();
	const { user, isConvexUserSynced } = useAuthSession();
	const pendingUrl = useSyncExternalStore(
		subscribeToRevenueCatRedemptionUrl,
		getPendingRevenueCatRedemptionUrl,
		() => null,
	);
	const [failure, setFailure] = useState<RedemptionFailure | null>(null);
	const [isProcessing, setIsProcessing] = useState(false);
	const [attempt, setAttempt] = useState(0);
	const attemptInFlightRef = useRef(false);
	const confirmedRedemptionRef = useRef(false);
	const handledAttemptRef = useRef(0);
	const isMountedRef = useRef(true);
	const storeApiKey = getStoreApiKey();
	const configurationFailure =
		pendingUrl && user && isConvexUserSynced && !storeApiKey
			? CONFIGURATION_FAILURE
			: null;

	useEffect(() => {
		isMountedRef.current = true;
		return () => {
			isMountedRef.current = false;
		};
	}, []);

	useEffect(() => {
		// This counter intentionally retriggers the effect after an explicit retry.
		const isExplicitRetry = attempt !== handledAttemptRef.current;
		if (isExplicitRetry) handledAttemptRef.current = attempt;
		if (
			(!pendingUrl && !(confirmedRedemptionRef.current && isExplicitRetry)) ||
			!user ||
			!isConvexUserSynced ||
			attemptInFlightRef.current
		) {
			return;
		}

		if (!storeApiKey) return;

		attemptInFlightRef.current = true;

		const synchronizeAccess = async () => {
			try {
				const active = await refreshPaidAccess();
				if (!isMountedRef.current) return false;
				if (!active) {
					setFailure(VERIFICATION_FAILURE);
					return false;
				}
				return true;
			} catch (error) {
				logDiagnosticError(
					"Unable to verify redeemed RevenueCat access.",
					error,
					{
						source: "revenuecat.redemption.verify",
						level: "error",
					},
				);
				if (isMountedRef.current) setFailure(VERIFICATION_FAILURE);
				return false;
			}
		};

		const redeem = async () => {
			if (confirmedRedemptionRef.current) {
				const active = await synchronizeAccess();
				if (active && isMountedRef.current) {
					confirmedRedemptionRef.current = false;
					router.replace("/pro-welcome");
				}
				return;
			}
			if (!pendingUrl) return;

			try {
				const client = createNativeRevenueCatClient({
					apiKey: storeApiKey,
					appUserId: user.clerkId,
				});
				const result = await client.redeemWebPurchase(pendingUrl);
				if (!isMountedRef.current) return;

				switch (result.status) {
					case "redeemed":
						clearPendingRevenueCatRedemptionUrl(pendingUrl);
						confirmedRedemptionRef.current = true;
						if (await synchronizeAccess()) {
							confirmedRedemptionRef.current = false;
							router.replace("/pro-welcome");
						}
						return;
					case "expired":
						clearPendingRevenueCatRedemptionUrl(pendingUrl);
						setFailure({
							title: "Einlöse-Link abgelaufen",
							description: `RevenueCat hat einen neuen Link an ${result.obfuscatedEmail} gesendet. Öffne bitte diese E-Mail auf deinem Smartphone.`,
							canRetry: false,
						});
						return;
					case "belongsToOtherUser":
						clearPendingRevenueCatRedemptionUrl(pendingUrl);
						setFailure({
							title: "Abo gehört zu einem anderen Konto",
							description:
								"Dieser Kauf wurde bereits mit einem anderen RevenueCat-Konto verbunden. Melde dich mit dem passenden Dayova-Konto an oder kontaktiere den Support.",
							canRetry: false,
						});
						return;
					case "invalidToken":
						clearPendingRevenueCatRedemptionUrl(pendingUrl);
						setFailure({
							title: "Einlöse-Link ungültig",
							description:
								"Öffne den persönlichen Link aus deiner RevenueCat-Zahlungsbestätigung erneut. Bereits verwendete Links können nicht geteilt oder ein zweites Mal eingelöst werden.",
							canRetry: false,
						});
						return;
					case "error":
						logDiagnosticError(
							"Unable to redeem RevenueCat web purchase.",
							result.error,
							{ source: "revenuecat.redemption.redeem", level: "error" },
						);
						setFailure(RETRYABLE_REDEMPTION_FAILURE);
				}
			} catch (error) {
				logDiagnosticError("Unable to redeem RevenueCat web purchase.", error, {
					source: "revenuecat.redemption.redeem",
					level: "error",
				});
				if (isMountedRef.current) setFailure(RETRYABLE_REDEMPTION_FAILURE);
			}
		};

		void Promise.resolve().then(async () => {
			if (!isMountedRef.current) {
				attemptInFlightRef.current = false;
				return;
			}
			setFailure(null);
			setIsProcessing(true);
			try {
				await redeem();
			} finally {
				attemptInFlightRef.current = false;
				if (isMountedRef.current) setIsProcessing(false);
			}
		});
	}, [
		attempt,
		isConvexUserSynced,
		pendingUrl,
		refreshPaidAccess,
		router,
		storeApiKey,
		user,
	]);

	const dismiss = useCallback(() => {
		if (pendingUrl) clearPendingRevenueCatRedemptionUrl(pendingUrl);
		confirmedRedemptionRef.current = false;
		setFailure(null);
	}, [pendingUrl]);

	return (
		<RedemptionStatusOverlay
			failure={failure ?? configurationFailure}
			isProcessing={isProcessing}
			onDismiss={dismiss}
			onRetry={() => setAttempt((current) => current + 1)}
		/>
	);
}
