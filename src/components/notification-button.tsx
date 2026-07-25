import { useConvexAuth, useQuery } from "convex/react";
import { router } from "expo-router";
import { TouchableOpacity, View } from "react-native";
import { api } from "#convex/_generated/api";
import { Bell } from "~/components/ui/icon";
import { useAuthSession } from "~/context/AuthContext";
import { useDayovaTheme } from "~/lib/theme";

export function NotificationButton() {
	const { user } = useAuthSession();
	const { colors } = useDayovaTheme();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const unreadSummary = useQuery(
		api.notifications.getUnreadSummary,
		user && isConvexAuthenticated ? {} : "skip",
	);
	const hasUnread = unreadSummary?.hasUnread === true;

	return (
		<TouchableOpacity
			activeOpacity={0.86}
			accessibilityRole="button"
			accessibilityLabel={
				hasUnread
					? "In-App-Mitteilungen öffnen, neue Mitteilungen vorhanden"
					: "In-App-Mitteilungen öffnen"
			}
			onPress={() => router.push("/notifications")}
			className="h-14 w-14 items-center justify-center rounded-full bg-card"
			style={{
				borderWidth: 1,
				borderColor: colors.border,
				boxShadow: "0 10px 22px rgba(21, 29, 48, 0.08)",
			}}
		>
			<Bell size={22} color={colors.text} strokeWidth={2.2} />
			{hasUnread ? (
				<View
					accessible={false}
					accessibilityElementsHidden
					importantForAccessibility="no-hide-descendants"
					className="absolute rounded-full bg-destructive"
					style={{
						top: 14,
						right: 14,
						width: 10,
						height: 10,
						borderWidth: 2,
						borderColor: colors.surface,
					}}
				/>
			) : null}
		</TouchableOpacity>
	);
}
