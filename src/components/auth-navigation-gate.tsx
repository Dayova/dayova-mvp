import { usePathname, useRootNavigationState, useRouter } from "expo-router";
import { type ReactNode, useEffect } from "react";
import { View, type ViewStyle } from "react-native";
import { useAuthSession } from "~/context/AuthContext";
import { getAuthNavigationTarget } from "~/lib/auth-routing";
import { useDayovaTheme } from "~/lib/theme";

type AuthNavigationGateProps = {
	children: ReactNode;
};

export function AuthNavigationGate({ children }: AuthNavigationGateProps) {
	const router = useRouter();
	const pathname = usePathname();
	const rootNavigationState = useRootNavigationState();
	const { user, isSessionLoading, pendingSessionTask } = useAuthSession();
	const { colors } = useDayovaTheme();
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
				className="flex-1"
				accessibilityElementsHidden={shouldMaskRoute}
				importantForAccessibility={
					shouldMaskRoute ? "no-hide-descendants" : "auto"
				}
				pointerEvents={shouldMaskRoute ? "none" : "auto"}
				style={shouldMaskRoute ? hiddenRouteStyle : undefined}
			>
				{children}
			</View>
			{shouldMaskRoute ? (
				<View
					testID="auth-bootstrap-mask"
					accessible={false}
					importantForAccessibility="no"
					pointerEvents="auto"
					style={[absoluteFillStyle, { backgroundColor: colors.background }]}
				/>
			) : null}
		</View>
	);
}

const hiddenRouteStyle = { opacity: 0 } satisfies ViewStyle;
const absoluteFillStyle = {
	bottom: 0,
	left: 0,
	position: "absolute",
	right: 0,
	top: 0,
} satisfies ViewStyle;
