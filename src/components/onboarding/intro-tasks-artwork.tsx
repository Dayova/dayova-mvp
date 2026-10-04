import { View } from "react-native";
import { ArrowRight, Check, Clock3 } from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
import { useDayovaTheme } from "~/lib/theme";

export function IntroTasksArtwork({
	width = 345,
	height = 380,
}: {
	width?: number;
	height?: number;
}) {
	const { colors } = useDayovaTheme();
	const scale = Math.min(width / 345, height / 380);
	return (
		<View
			testID="intro-tasks-artwork"
			accessible={false}
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
			pointerEvents="none"
			className="items-center justify-center"
			// Native page dimensions bound the decorative composition.
			style={{ width, height }}
		>
			<View
				className="h-[380px] w-[345px] justify-center gap-6"
				// Fixed-size editorial elements scale as one composition.
				style={{ transform: [{ scale }] }}
			>
				<View
					className="flex-row items-center gap-3 self-start rounded-full bg-primary/10 px-6 py-5"
					style={{ transform: [{ rotate: "-6deg" }] }}
				>
					<View className="h-4 w-4 rounded-full bg-primary" />
					<Text
						allowFontScaling={false}
						className="font-poppins font-semibold text-heading-2 text-primary-strong"
					>
						Heute anfangen
					</Text>
				</View>
				<View
					className="flex-row items-center gap-4 self-end rounded-full bg-muted px-6 py-5"
					style={{ transform: [{ rotate: "5deg" }] }}
				>
					<Clock3 size={35} color={colors.secondaryText} />
					<View>
						<Text
							allowFontScaling={false}
							className="font-poppins font-semibold text-heading-2 text-text"
						>
							30 Minuten
						</Text>
						<Text
							allowFontScaling={false}
							className="font-poppins text-body-2 text-secondary-text"
						>
							für dich und dein Ziel
						</Text>
					</View>
				</View>
				<View
					className="flex-row items-center gap-3 self-start rounded-full bg-ueben-subtle px-6 py-5"
					style={{ transform: [{ rotate: "-4deg" }] }}
				>
					<Check size={28} color={colors.ueben} />
					<Text
						allowFontScaling={false}
						className="font-poppins font-semibold text-body-1 text-text"
					>
						Schritt für Schritt
					</Text>
					<ArrowRight size={22} color={colors.ueben} />
				</View>
			</View>
		</View>
	);
}
