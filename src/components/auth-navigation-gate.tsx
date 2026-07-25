import { usePathname, useRootNavigationState, useRouter } from "expo-router";
import { type ReactNode, useEffect } from "react";
import { View } from "react-native";
import { useAuthSession } from "~/context/AuthContext";
import { getAuthNavigationTarget } from "~/lib/auth-routing";
import { cn } from "~/lib/utils";

type AuthNavigationGateProps = {
	children: ReactNode;
};

export function AuthNavigationGate({ children }: AuthNavigationGateProps) {
	const router = useRouter();
	const pathname = usePathname();
	const rootNavigationState = useRootNavigationState();
	const { user, isSessionLoading, pendingSessionTask } = useAuthSession();
	const targetRoute = getAuthNavigationTarget({
		hasUser: Boolean(user),
		isSessionLoading,
		pathname,
		pendingSessionTask,
	});
	const shouldMaskRoute = isSessionLoading || targetRoute !== null;

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
				/>
			) : null}
		</View>
	);
}
