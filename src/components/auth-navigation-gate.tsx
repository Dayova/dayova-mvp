import { usePathname, useRootNavigationState, useRouter } from "expo-router";
import { type ReactNode, useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useAccess } from "~/context/AccessContext";
import { useAuthSession } from "~/context/AuthContext";
import { resolveAccessRoute } from "~/lib/access-policy";
import { getAuthNavigationTarget } from "~/lib/auth-routing";
import { cn } from "~/lib/utils";

type AuthNavigationGateProps = {
	children: ReactNode;
};

const BACKEND_BOOTSTRAP_STALL_MS = 10_000;

function StalledConnectionMessage() {
	const [isStalled, setIsStalled] = useState(false);

	useEffect(() => {
		const timeout = setTimeout(
			() => setIsStalled(true),
			BACKEND_BOOTSTRAP_STALL_MS,
		);
		return () => clearTimeout(timeout);
	}, []);

	if (!isStalled) return null;

	return (
		<View className="mt-6 items-center gap-2">
			<Text className="text-center font-semibold text-foreground text-lg">
				Die Verbindung zu Dayova dauert länger als erwartet.
			</Text>
			<Text className="text-center text-muted-foreground">
				Wir versuchen es weiter. Prüfe bitte deine Internetverbindung.
			</Text>
		</View>
	);
}

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
	const { access, isAccessLoading } = useAccess();
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
		(onboardingCompletionStatus === "none" && isAccessLoading) ||
		targetRoute !== null;
	const isBackendBootstrapPending =
		Boolean(user) &&
		!isSessionLoading &&
		onboardingCompletionStatus === "none" &&
		isAccessLoading;

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
					className="absolute inset-0 items-center justify-center bg-background px-8"
				>
					<ActivityIndicator accessibilityLabel="Dayova lädt" size="large" />
					{isBackendBootstrapPending ? (
						<StalledConnectionMessage key={user?.clerkId} />
					) : null}
				</View>
			) : null}
		</View>
	);
}
