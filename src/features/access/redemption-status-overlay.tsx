import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "~/components/ui/button";
import { CircleAlert, CreditCard } from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";

const BRAND_COLORS = DAYOVA_DESIGN_SYSTEM.colors;
const REDEMPTION_GRADIENT = DAYOVA_DESIGN_SYSTEM.gradients.primaryInteractive;
const gradientFillStyle = StyleSheet.absoluteFill;
const contentSurfaceStyle = {
	backgroundColor: BRAND_COLORS.surface,
	borderColor: BRAND_COLORS.primaryAccent,
};
const actionStyle = {
	backgroundColor: BRAND_COLORS.text,
	borderColor: BRAND_COLORS.border,
};
const primaryTextStyle = { color: BRAND_COLORS.text };
const secondaryTextStyle = { color: BRAND_COLORS.secondaryText };

export type RedemptionFailure = {
	title: string;
	description: string;
	canRetry: boolean;
};

export function RedemptionStatusOverlay({
	failure,
	isProcessing,
	onDismiss,
	onRetry,
}: {
	failure: RedemptionFailure | null;
	isProcessing: boolean;
	onDismiss: () => void;
	onRetry: () => void;
}) {
	const insets = useSafeAreaInsets();
	if (!failure && !isProcessing) return null;

	return (
		<View
			accessibilityViewIsModal
			className="absolute inset-0 z-50 justify-center bg-primary-strong px-6"
			style={{
				paddingBottom: Math.max(insets.bottom, 24),
				paddingTop: Math.max(insets.top, 24),
			}}
			testID="revenuecat-redemption-overlay"
		>
			<StatusBar style="light" />
			<LinearGradient
				pointerEvents="none"
				colors={REDEMPTION_GRADIENT.colors}
				start={REDEMPTION_GRADIENT.start}
				end={REDEMPTION_GRADIENT.end}
				style={gradientFillStyle}
			/>
			<View
				className="w-full rounded-card border px-6 py-7 shadow-black/10 shadow-lg"
				style={contentSurfaceStyle}
			>
				<View className="mb-5 h-14 w-14 items-center justify-center rounded-full bg-system-subtle">
					{isProcessing ? (
						<ActivityIndicator
							accessibilityLabel="Abo wird verbunden"
							color={BRAND_COLORS.primaryStrong}
						/>
					) : (
						<CircleAlert
							size={28}
							color={BRAND_COLORS.primaryStrong}
							strokeWidth={2.2}
						/>
					)}
				</View>
				<Text
					accessibilityRole="header"
					className="font-semibold text-heading-2"
					style={primaryTextStyle}
				>
					{isProcessing ? "Dein Abo wird verbunden" : failure?.title}
				</Text>
				<Text className="mt-3 text-body-2" style={secondaryTextStyle}>
					{isProcessing
						? "Wir ordnen den Website-Kauf deinem angemeldeten Dayova-Konto zu und prüfen den Zugang."
						: failure?.description}
				</Text>

				{failure && !isProcessing ? (
					<View className="mt-7 gap-3">
						{failure.canRetry ? (
							<Button style={actionStyle} variant="neutral" onPress={onRetry}>
								<CreditCard
									size={20}
									color={BRAND_COLORS.surface}
									strokeWidth={2.2}
								/>
								<Text>Erneut versuchen</Text>
							</Button>
						) : null}
						<Button variant="outline" onPress={onDismiss}>
							<Text>
								{failure.canRetry ? "Später erneut öffnen" : "Verstanden"}
							</Text>
						</Button>
					</View>
				) : null}
			</View>
		</View>
	);
}
