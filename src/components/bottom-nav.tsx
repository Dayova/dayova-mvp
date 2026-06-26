import { LinearGradient } from "expo-linear-gradient";
import { useEffect } from "react";
import { TouchableOpacity, useWindowDimensions, View } from "react-native";
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Home, Route2, Settings } from "~/components/ui/icon";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";

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
const BAR_PADDING_HORIZONTAL = 4;
const BAR_PADDING_VERTICAL = 4;

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
			transform: [{ scale: 1 + progress * 0.1 }],
		};
	});

	return (
		// Reanimated transform/opacity values must be supplied through style.
		<Animated.View style={animatedStyle}>
			<Icon
				size={22 * scale}
				color={
					active
						? DAYOVA_DESIGN_SYSTEM.colors.light1
						: DAYOVA_DESIGN_SYSTEM.colors.text
				}
				strokeWidth={active ? 2.15 : 2}
			/>
		</Animated.View>
	);
}

export function BottomNav({ state, navigation }: BottomNavProps) {
	const insets = useSafeAreaInsets();
	const { width } = useWindowDimensions();
	const selectedGradient = DAYOVA_DESIGN_SYSTEM.gradients.primaryInteractive;
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
			// Bottom offset depends on safe-area insets and responsive scale.
			style={{ bottom: Math.max(insets.bottom + 4 * scale, 8) }}
		>
			<View
				className="flex-row items-center rounded-full border border-text/5 bg-card shadow-black/10 shadow-lg"
				// Padding and gap scale with viewport width to keep the compact
				// Figma nav proportions on narrow and wide devices.
				style={{
					paddingHorizontal: BAR_PADDING_HORIZONTAL * scale,
					paddingVertical: BAR_PADDING_VERTICAL * scale,
					boxShadow: "0 18px 36px rgba(20, 28, 48, 0.12)",
					columnGap: ITEM_GAP * scale,
				}}
			>
				<Animated.View
					pointerEvents="none"
					// Animated indicator position and size are runtime values.
					style={[
						{
							position: "absolute",
							left: BAR_PADDING_HORIZONTAL * scale,
							top: BAR_PADDING_VERTICAL * scale,
							height: ITEM_SIZE * scale,
							width: ITEM_SIZE * scale,
							borderRadius: ITEM_SIZE * scale * 0.5,
							overflow: "hidden",
						},
						indicatorStyle,
					]}
				>
					<LinearGradient
						colors={selectedGradient.colors}
						start={selectedGradient.start}
						end={selectedGradient.end}
						style={{ flex: 1 }}
					/>
				</Animated.View>
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
							// Tab hit target scales with viewport width.
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
