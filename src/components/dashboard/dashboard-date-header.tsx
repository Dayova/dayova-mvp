import type { ReactNode } from "react";
import { TouchableOpacity, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
	FadeIn,
	FadeOut,
	useAnimatedStyle,
	useSharedValue,
	withSpring,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import {
	resolveDashboardDaySwipe,
	type DashboardDayDirection,
} from "~/components/dashboard/dashboard-day-swipe";
import { Text } from "~/components/ui/text";
import { useDayovaTheme } from "~/lib/theme";

export type DashboardHeaderDay = {
	key: string;
	weekday: string;
	dayOfMonth: string;
	isToday: boolean;
};

type DashboardDateHeaderProps = {
	days: DashboardHeaderDay[];
	firstName?: string;
	notificationButton: ReactNode;
	onSelectDay: (dayKey: string) => void;
	onSwipeDay: (direction: Exclude<DashboardDayDirection, 0>) => void;
	scale: number;
	selectedDayKey: string;
};

export function DashboardDateHeader({
	days,
	firstName,
	notificationButton,
	onSelectDay,
	onSwipeDay,
	scale,
	selectedDayKey,
}: DashboardDateHeaderProps) {
	const { colors } = useDayovaTheme();
	const translateX = useSharedValue(0);
	const animatedStyle = useAnimatedStyle(() => ({
		transform: [{ translateX: translateX.get() }],
	}));
	const panGesture = Gesture.Pan()
		.activeOffsetX([-18, 18])
		.failOffsetY([-14, 14])
		.onUpdate((event) => {
			"worklet";
			translateX.set(Math.max(Math.min(event.translationX * 0.16, 18), -18));
		})
		.onEnd((event) => {
			"worklet";
			const direction = resolveDashboardDaySwipe(
				event.translationX,
				event.velocityX,
			);
			if (direction !== 0) scheduleOnRN(onSwipeDay, direction);
			translateX.set(
				withSpring(0, {
					damping: 20,
					mass: 0.65,
					overshootClamping: true,
					stiffness: 260,
				}),
			);
		});
	const greeting = firstName ? `Hi ${firstName}.` : "Hi.";

	return (
		<View style={{ gap: 20 * scale }}>
			<View
				style={{
					position: "relative",
					minHeight: 56 * scale,
					paddingHorizontal: 62 * scale,
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				<Text
					adjustsFontSizeToFit
					minimumFontScale={0.72}
					numberOfLines={1}
					selectable
					style={{
						color: colors.text,
						fontFamily: "Poppins",
						fontSize: 34 * scale,
						fontWeight: "600",
						lineHeight: 46 * scale,
						textAlign: "center",
					}}
				>
					{greeting}
				</Text>
				<View
					style={{
						position: "absolute",
						right: 0,
						top: 0,
						transform: [{ scale: Math.min(scale, 1) }],
					}}
				>
					{notificationButton}
				</View>
			</View>

			<GestureDetector gesture={panGesture}>
				<Animated.View
					style={[
						{
							flexDirection: "row",
							alignItems: "stretch",
							justifyContent: "space-between",
							gap: 4 * scale,
						},
						animatedStyle,
					]}
				>
					{days.map((day) => {
						const selected = day.key === selectedDayKey;
						const textColor = selected
							? colors.text
							: day.isToday
								? colors.primaryStrong
								: colors.secondaryText;

						return (
							<TouchableOpacity
								key={day.key}
								accessibilityLabel={`${day.weekday}, ${day.dayOfMonth}`}
								accessibilityRole="button"
								accessibilityState={{ selected }}
								activeOpacity={0.72}
								onPress={() => onSelectDay(day.key)}
								style={{
									position: "relative",
									flex: 1,
									maxWidth: 48 * scale,
									height: 64 * scale,
									alignItems: "center",
									justifyContent: "center",
									gap: 2 * scale,
								}}
							>
								{selected ? (
									<Animated.View
										entering={FadeIn.duration(140)}
										exiting={FadeOut.duration(100)}
										pointerEvents="none"
										style={{
											position: "absolute",
											inset: 0,
											borderWidth: 1,
											borderColor: colors.border,
											borderRadius: 12 * scale,
											borderCurve: "continuous",
											backgroundColor: colors.surface,
											boxShadow: "0 2px 8px rgba(21, 29, 48, 0.06)",
										}}
									/>
								) : null}
								<Text
									selectable
									style={{
										color: textColor,
										fontFamily: "Poppins",
										fontSize: 12 * scale,
										lineHeight: 17 * scale,
									}}
								>
									{day.weekday}
								</Text>
								<Text
									selectable
									style={{
										color: textColor,
										fontFamily: "Poppins",
										fontSize: 17 * scale,
										fontWeight: "600",
										fontVariant: ["tabular-nums"],
										lineHeight: 22 * scale,
									}}
								>
									{day.dayOfMonth}
								</Text>
							</TouchableOpacity>
						);
					})}
				</Animated.View>
			</GestureDetector>

			<View style={{ height: 1, backgroundColor: colors.border }} />
		</View>
	);
}
