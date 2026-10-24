import { reloadAppAsync } from "expo";
import { usePathname, useRootNavigationState, useRouter } from "expo-router";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { useAccess } from "~/context/AccessContext";
import { useAuthSession } from "~/context/AuthContext";
import { isAccessRecoveryPath, resolveAccessRoute } from "~/lib/access-policy";
import { getAuthNavigationTarget } from "~/lib/auth-routing";
import { cn } from "~/lib/utils";

type AuthNavigationGateProps = {
	children: ReactNode;
};

export function AuthNavigationGate({ children }: AuthNavigationGateProps) {
	const router = useRouter();
	const pathname = usePathname();
	const rootNavigationState = useRootNavigationState();
	const {
		user,
		isSessionLoading,
		pendingSessionTask,
		onboardingCompletionStatus,
	} = useAuthSession();
	const {
		access,
		isAccessLoading,
		isVerificationRequired,
		retryAccessVerification,
	} = useAccess();
	const [retrying, setRetrying] = useState(false);
	const retryingRef = useRef(false);
	const [retryError, setRetryError] = useState<string | null>(null);
	const [sessionRestoreTimedOut, setSessionRestoreTimedOut] = useState(false);
	const sessionRecoveryRequired = isSessionLoading && sessionRestoreTimedOut;
	if (!isSessionLoading && sessionRestoreTimedOut) {
		setSessionRestoreTimedOut(false);
	}
	useEffect(() => {
		if (!isSessionLoading) return;
		// Clerk may not finish its initial load offline, before an identity is known.
		const timeout = setTimeout(() => setSessionRestoreTimedOut(true), 10_000);
		return () => clearTimeout(timeout);
	}, [isSessionLoading]);
	const authTargetRoute = getAuthNavigationTarget({
		hasUser: Boolean(user),
		isSessionLoading,
		onboardingCompletionStatus,
		pathname,
		pendingSessionTask,
	});
	const accessTargetRoute = user
		? resolveAccessRoute({
				accessState: access?.state,
				isSessionLoading,
				pathname,
				user: { id: user.clerkId },
			})
		: null;
	const recoveringAccount =
		user && pendingSessionTask === null && isAccessRecoveryPath(pathname);
	const targetRoute = recoveringAccount
		? accessTargetRoute
		: pendingSessionTask !== null || onboardingCompletionStatus !== "none"
			? authTargetRoute
			: (accessTargetRoute ?? authTargetRoute);
	const shouldMaskRoute =
		isSessionLoading ||
		(onboardingCompletionStatus === "loading" &&
			!isAccessRecoveryPath(pathname)) ||
		(onboardingCompletionStatus === "none" &&
			isAccessLoading &&
			!isAccessRecoveryPath(pathname)) ||
		targetRoute !== null;

	useEffect(() => {
		if (!targetRoute || !rootNavigationState?.key) return;

		const frame = requestAnimationFrame(() => {
			router.replace(targetRoute);
		});

		return () => cancelAnimationFrame(frame);
	}, [rootNavigationState?.key, router, targetRoute]);

	return (
		<View className="flex-1">
			<View
				testID="auth-route-content"
				className={cn("flex-1", shouldMaskRoute && "opacity-0")}
				accessibilityElementsHidden={shouldMaskRoute}
				importantForAccessibility={
					shouldMaskRoute ? "no-hide-descendants" : "auto"
				}
				pointerEvents={shouldMaskRoute ? "none" : "auto"}
			>
				{children}
			</View>
			{shouldMaskRoute ? (
				<View
					testID="auth-bootstrap-mask"
					accessible={false}
					importantForAccessibility="no"
					pointerEvents="auto"
					className="absolute inset-0 bg-background"
				>
					{isVerificationRequired || sessionRecoveryRequired ? (
						<SafeAreaView className="flex-1">
							<ScrollView
								className="flex-1"
								contentContainerClassName="grow justify-center px-7 py-10"
							>
								<Text variant="h2">Zugang online prüfen</Text>
								<Text className="mt-3 text-body-3 text-secondary-text">
									{sessionRecoveryRequired
										? "Verbinde dich mit dem Internet und starte Dayova erneut, damit deine Anmeldung geladen und dein Zugang geprüft werden können. Dein Lernstand bleibt erhalten."
										: "Bitte verbinde dich mit dem Internet, damit Dayova deinen Zugang prüfen kann. Dein Lernstand bleibt erhalten."}
								</Text>
								{retryError ? (
									<Text
										accessibilityRole="alert"
										className="mt-3 text-body-3 text-destructive"
									>
										{retryError}
									</Text>
								) : null}
								<Button
									className="mt-6"
									disabled={retrying}
									accessibilityState={{ busy: retrying, disabled: retrying }}
									onPress={() => {
										if (retryingRef.current) return;
										retryingRef.current = true;
										setRetrying(true);
										setRetryError(null);
										let timeout: ReturnType<typeof setTimeout>;
										let restartAccepted = false;
										void Promise.race([
											sessionRecoveryRequired
												? reloadAppAsync()
												: retryAccessVerification(),
											new Promise<never>((_resolve, reject) => {
												timeout = setTimeout(
													() => reject(new Error("Verification timed out")),
													10_000,
												);
											}),
										])
											.then(() => {
												restartAccepted = sessionRecoveryRequired;
											})
											.catch(() =>
												setRetryError(
													sessionRecoveryRequired
														? "Der Neustart hat nicht geklappt. Schließe Dayova und öffne die App mit Internetverbindung erneut."
														: "Die Prüfung hat nicht geklappt. Prüfe deine Internetverbindung und versuche es erneut.",
												),
											)
											.finally(() => {
												clearTimeout(timeout);
												if (!restartAccepted) {
													retryingRef.current = false;
													setRetrying(false);
												}
											});
									}}
								>
									<Text>
										{sessionRecoveryRequired
											? retrying
												? "Wird neu gestartet …"
												: "App neu starten"
											: retrying
												? "Wird geprüft …"
												: "Erneut prüfen"}
									</Text>
								</Button>
								{!sessionRecoveryRequired ? (
									<Button
										variant="ghost"
										className="mt-2"
										onPress={() => router.push("/profile")}
									>
										<Text>Konto verwalten</Text>
									</Button>
								) : null}
							</ScrollView>
						</SafeAreaView>
					) : null}
				</View>
			) : null}
		</View>
	);
}
