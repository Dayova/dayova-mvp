import { usePathname, useRootNavigationState, useRouter } from "expo-router";
import { type ReactNode, useEffect, useState } from "react";
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
	const targetRoute =
		pendingSessionTask !== null || onboardingCompletionStatus !== "none"
			? authTargetRoute
			: (accessTargetRoute ?? authTargetRoute);
	const shouldMaskRoute =
		isSessionLoading ||
		onboardingCompletionStatus === "loading" ||
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
					{isVerificationRequired ? (
						<SafeAreaView className="flex-1">
							<ScrollView
								className="flex-1"
								contentContainerClassName="grow justify-center px-7 py-10"
							>
								<Text variant="h2">Zugang online prüfen</Text>
								<Text className="mt-3 text-body-3 text-secondary-text">
									Bitte verbinde dich mit dem Internet, damit Dayova deinen
									Zugang prüfen kann. Dein Lernstand bleibt erhalten.
								</Text>
								<Button
									className="mt-6"
									disabled={retrying}
									accessibilityState={{ busy: retrying }}
									onPress={() => {
										setRetrying(true);
										void retryAccessVerification()
											.catch(() => {})
											.finally(() => setRetrying(false));
									}}
								>
									<Text>{retrying ? "Wird geprüft …" : "Erneut prüfen"}</Text>
								</Button>
								<Button
									variant="ghost"
									className="mt-2"
									onPress={() => router.push("/profile")}
								>
									<Text>Konto verwalten</Text>
								</Button>
							</ScrollView>
						</SafeAreaView>
					) : null}
				</View>
			) : null}
		</View>
	);
}
