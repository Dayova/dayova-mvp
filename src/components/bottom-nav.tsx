import { usePathname, useRouter } from "expo-router";
import { TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Home, Route2, Settings } from "~/components/ui/icon";

type BottomNavKey = "home" | "learningPath" | "settings";

const NAV_ITEMS: Array<{
	key: BottomNavKey;
	icon: typeof Home;
	href: "/home" | "/learning-plans" | "/settings";
}> = [
	{ key: "home", icon: Home, href: "/home" },
	{ key: "learningPath", icon: Route2, href: "/learning-plans" },
	{ key: "settings", icon: Settings, href: "/settings" },
];

export function BottomNav() {
	const insets = useSafeAreaInsets();
	const router = useRouter();
	const pathname = usePathname();

	if (pathname === "/profile") return null;

	const activeKey: BottomNavKey =
		pathname === "/settings"
			? "settings"
			: pathname === "/learning-plans"
				? "learningPath"
				: "home";

	return (
		<View
			className="absolute left-0 right-0 items-center"
			style={{ bottom: Math.max(insets.bottom + 2, 8) }}
		>
			<View
				className="flex-row items-center rounded-full bg-white px-[10px] py-[8px]"
				style={{
					borderWidth: 1,
					borderColor: "rgba(17,24,39,0.05)",
					boxShadow: "0 18px 36px rgba(20, 28, 48, 0.12)",
					columnGap: 8,
				}}
			>
				{NAV_ITEMS.map((item) => {
					const Icon = item.icon;
					const active = activeKey === item.key;

					return (
						<TouchableOpacity
							key={item.key}
							activeOpacity={0.84}
							onPress={() => {
								if (!item.href || pathname === item.href) return;
								router.navigate(item.href);
							}}
							className="items-center justify-center rounded-full"
							style={{
								height: active ? 56 : 48,
								width: active ? 56 : 48,
								backgroundColor: active ? "#FFFFFF" : "transparent",
								borderWidth: active ? 1 : 0,
								borderColor: active ? "rgba(58,123,255,0.10)" : "transparent",
								boxShadow: active
									? "0 8px 20px rgba(33, 37, 48, 0.08)"
									: "none",
							}}
						>
							<Icon
								size={active ? 24 : 22}
								color={active ? "#3A7BFF" : "#202127"}
								strokeWidth={active ? 2.15 : 2}
							/>
						</TouchableOpacity>
					);
				})}
			</View>
		</View>
	);
}
