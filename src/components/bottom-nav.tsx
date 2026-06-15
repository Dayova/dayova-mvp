import { useEffect } from "react";
import { TouchableOpacity, useWindowDimensions, View } from "react-native";
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Home, Route2, Settings } from "~/components/ui/icon";

type BottomNavKey = "home" | "learningPath" | "settings";
type AppTabRouteName = "home" | "learning-plans" | "settings";
type BottomNavIcon = typeof Home;
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
	icon: BottomNavIcon;
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

const clamp = (value: number, min: number, max: number) =>
	Math.min(Math.max(value, min), max);

const ITEM_SIZE = 56;
const ITEM_GAP = 8;
const BAR_PADDING_HORIZONTAL = 10;
const BAR_PADDING_VERTICAL = 8;

function AnimatedTabIcon({
	active,
	Icon,
	scale,
}: {
	active: boolean;
	Icon: BottomNavIcon;
	scale: number;
}) {
	const focusProgress = useSharedValue(active ? 1 : 0);

	useEffect(() => {
		focusProgress.set(
			withSpring(active ? 1 : 0, {
				damping: 14,
				mass: 0.55,
				stiffness: 260,
			}),
		);
	}, [active, focusProgress]);

	const animatedStyle = useAnimatedStyle(() => {
		const progress = focusProgress.get();
		return {
			opacity: 0.76 + progress * 0.24,
			transform: [
				{ translateY: progress * -2 * scale },
				{ scale: 1 + progress * 0.1 },
			],
		};
	});

	return (
		<Animated.View style={animatedStyle}>
			<Icon
				size={22 * scale}
				color={active ? "#3A7BFF" : "#202127"}
				strokeWidth={active ? 2.15 : 2}
			/>
		</Animated.View>
	);
}

export function BottomNav({ state, navigation }: BottomNavProps) {
	const insets = useSafeAreaInsets();
	const { width } = useWindowDimensions();
	const scale = clamp(width / 393, 0.88, 1.08);
	const activeRouteName = state.routes[state.index]?.name;
	const activeItemIndex = Math.max(
		NAV_ITEMS.findIndex((item) => item.routeName === activeRouteName),
		0,
	);
	const indicatorPosition = useSharedValue(activeItemIndex);

	useEffect(() => {
		indicatorPosition.set(
			withSpring(activeItemIndex, {
				damping: 17,
				mass: 0.72,
				stiffness: 210,
			}),
		);
	}, [activeItemIndex, indicatorPosition]);

	const indicatorStyle = useAnimatedStyle(() => ({
		transform: [
			{
				translateX: indicatorPosition.get() * (ITEM_SIZE + ITEM_GAP) * scale,
			},
		],
	}));

	return (
		<View
			accessibilityRole="tablist"
			className="absolute right-0 left-0 items-center"
			style={{ bottom: Math.max(insets.bottom + 2 * scale, 8) }}
		>
			<View
				className="flex-row items-center rounded-full bg-white"
				style={{
					paddingHorizontal: BAR_PADDING_HORIZONTAL * scale,
					paddingVertical: BAR_PADDING_VERTICAL * scale,
					borderWidth: 1,
					borderColor: "rgba(17,24,39,0.05)",
					boxShadow: "0 18px 36px rgba(20, 28, 48, 0.12)",
					columnGap: ITEM_GAP * scale,
				}}
			>
				<Animated.View
					pointerEvents="none"
					style={[
						{
							position: "absolute",
							left: BAR_PADDING_HORIZONTAL * scale,
							top: BAR_PADDING_VERTICAL * scale,
							height: ITEM_SIZE * scale,
							width: ITEM_SIZE * scale,
							borderRadius: ITEM_SIZE * scale * 0.5,
							backgroundColor: "#FFFFFF",
							borderWidth: 1,
							borderColor: "rgba(58,123,255,0.12)",
							boxShadow: "0 8px 20px rgba(33, 37, 48, 0.10)",
						},
						indicatorStyle,
					]}
				/>
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
								height: ITEM_SIZE * scale,
								width: ITEM_SIZE * scale,
							}}
						>
							<AnimatedTabIcon active={active} Icon={Icon} scale={scale} />
						</TouchableOpacity>
					);
				})}
			</View>
		</View>
	);
}
