import { TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Home, Route2, Settings } from "~/components/ui/icon";

type BottomNavKey = "home" | "learningPath" | "settings";
type AppTabRouteName = "home" | "learning-plans" | "settings";
type AppTabRoute = {
	key: string;
	name: string;
	params?: object;
};
type BottomNavProps = {
	state: {
		index: number;
		routes: AppTabRoute[];
	};
	navigation: {
		emit: (options: {
			type: "tabPress";
			target: string;
			canPreventDefault: true;
		}) => { defaultPrevented: boolean };
		navigate: (name: string, params?: object) => void;
	};
};

const NAV_ITEMS: Array<{
	key: BottomNavKey;
	icon: typeof Home;
	routeName: AppTabRouteName;
	label: string;
}> = [
	{ key: "home", icon: Home, routeName: "home", label: "Startseite" },
	{
		key: "learningPath",
		icon: Route2,
		routeName: "learning-plans",
		label: "Lernpläne",
	},
	{
		key: "settings",
		icon: Settings,
		routeName: "settings",
		label: "Einstellungen",
	},
];

export function BottomNav({ state, navigation }: BottomNavProps) {
	const insets = useSafeAreaInsets();
	const activeRouteName = state.routes[state.index]?.name;

	return (
		<View
			accessibilityRole="tablist"
			className="absolute right-0 left-0 items-center"
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
					const active = activeRouteName === item.routeName;
					const route = state.routes.find(
						(candidate) => candidate.name === item.routeName,
					);

					return (
						<TouchableOpacity
							key={item.key}
							accessibilityLabel={item.label}
							accessibilityRole="tab"
							accessibilityState={{ selected: active }}
							activeOpacity={0.84}
							onPress={() => {
								if (!route || active) return;

								const event = navigation.emit({
									type: "tabPress",
									target: route.key,
									canPreventDefault: true,
								});

								if (!event.defaultPrevented) {
									navigation.navigate(route.name, route.params);
								}
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
