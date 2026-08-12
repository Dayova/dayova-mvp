import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "~/components/ui/button";
import { ArrowRight, Check } from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { triggerSuccessHaptic } from "~/lib/safe-haptics";

const WELCOME_GRADIENT = DAYOVA_DESIGN_SYSTEM.gradients.primaryInteractive;
const BRAND_COLORS = DAYOVA_DESIGN_SYSTEM.colors;
const WHITE = BRAND_COLORS.light1;
// LinearGradient exposes its full-bleed geometry through the native style API.
const gradientFillStyle = StyleSheet.absoluteFill;
// This branded access-completion route stays light in every app theme. Fixed
// shared tokens avoid stale CSS variables on newly mounted Fabric descendants.
const confirmationCardStyle = {
	backgroundColor: BRAND_COLORS.surface,
	borderColor: BRAND_COLORS.primaryAccent,
};
const welcomeActionStyle = {
	backgroundColor: BRAND_COLORS.surface,
	borderColor: WHITE,
};
const benefitIconStyle = {
	backgroundColor: BRAND_COLORS.systemSubtle,
};
const primaryTextStyle = { color: BRAND_COLORS.text };
const secondaryTextStyle = { color: BRAND_COLORS.secondaryText };

export function ProWelcomeScreen() {
	const router = useRouter();
	const insets = useSafeAreaInsets();

	useEffect(() => {
		void triggerSuccessHaptic({ platform: process.env.EXPO_OS });
	}, []);

	return (
		<View className="flex-1 bg-primary-strong">
			<StatusBar style="light" />
			<LinearGradient
				pointerEvents="none"
				colors={WELCOME_GRADIENT.colors}
				start={WELCOME_GRADIENT.start}
				end={WELCOME_GRADIENT.end}
				style={gradientFillStyle}
			/>
			<ScrollView
				alwaysBounceVertical={false}
				className="flex-1"
				contentInsetAdjustmentBehavior="never"
				showsVerticalScrollIndicator={false}
				// This full-screen route has no native header, so its scroll content
				// owns the runtime safe-area values and minimum viewport height.
				contentContainerStyle={{
					flexGrow: 1,
					paddingBottom: Math.max(insets.bottom, 28),
					paddingTop: insets.top,
				}}
			>
				<View className="flex-1 justify-between px-7 pt-10">
					<View className="items-center">
						<View className="mb-8 h-32 w-32 items-center justify-center rounded-full border border-white/70 bg-white shadow-black/5 shadow-sm">
							<Check
								size={62}
								color={BRAND_COLORS.primaryStrong}
								strokeWidth={2.4}
							/>
						</View>

						<Text className="font-semibold text-body-4 text-white/85">
							DAYOVA PRO
						</Text>
						<Text
							accessibilityRole="header"
							className="mt-3 max-w-[340px] text-center font-semibold text-heading-1 text-white leading-tight"
						>
							Willkommen bei Dayova Pro
						</Text>
						<Text className="mt-3 max-w-[340px] text-center text-body-3 text-white/90">
							Dein Zugang ist freigeschaltet. Du kannst direkt dort
							weitermachen, wo du aufgehört hast.
						</Text>

						<View
							className="mt-8 w-full rounded-card border px-5 py-5 shadow-black/5 shadow-sm"
							style={confirmationCardStyle}
							testID="pro-welcome-confirmation-card"
						>
							<Text
								className="font-semibold text-body-2"
								style={primaryTextStyle}
							>
								Alles freigeschaltet
							</Text>
							<BenefitRow label="Dein Lernstand bleibt vollständig erhalten" />
							<BenefitRow label="Alle Dayova-Funktionen sind jetzt verfügbar" />
						</View>
					</View>

					<View className="pt-8">
						<Button
							accessibilityHint="Öffnet deine heutige Lernübersicht."
							accessibilityLabel="Jetzt loslernen"
							className="w-full"
							variant="neutral"
							style={welcomeActionStyle}
							onPress={() => router.replace("/home")}
						>
							<Text
								className="font-semibold text-body-2"
								style={{ color: BRAND_COLORS.primaryStrong }}
							>
								Jetzt loslernen
							</Text>
							<ArrowRight
								size={20}
								color={BRAND_COLORS.primaryStrong}
								strokeWidth={2.4}
							/>
						</Button>
						<Text className="mt-3 text-center text-body-4 text-white/80">
							Dein Abo kannst du jederzeit in den Einstellungen verwalten.
						</Text>
					</View>
				</View>
			</ScrollView>
		</View>
	);
}

function BenefitRow({ label }: { label: string }) {
	return (
		<View className="mt-4 flex-row items-center">
			<View
				className="mr-3 h-8 w-8 items-center justify-center rounded-full"
				style={benefitIconStyle}
			>
				<Check size={17} color={BRAND_COLORS.primaryStrong} strokeWidth={2.4} />
			</View>
			<Text className="flex-1 text-body-3" style={secondaryTextStyle}>
				{label}
			</Text>
		</View>
	);
}
