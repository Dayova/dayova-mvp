import { ScrollView, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "~/components/ui/button";
import { Check } from "~/components/ui/icon";
import {
	PortraitContent,
	useContentSizeLayout,
} from "~/components/ui/portrait-content";
import { Text } from "~/components/ui/text";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";

type SuccessConfirmationScreenProps = {
	title: string;
	detailLabel: string;
	detailValue?: string;
	onFinish: () => void;
};

function SuccessConfirmationScreen({
	title,
	detailLabel,
	detailValue,
	onFinish,
}: SuccessConfirmationScreenProps) {
	const insets = useSafeAreaInsets();
	const { height } = useWindowDimensions();
	const contentSizeLayout = useContentSizeLayout({
		requestedHorizontalPadding: 28,
	});
	const successMarkTop = Math.max(152, Math.min(224, height * 0.235));
	const headlineTopMargin = Math.max(72, Math.min(80, height * 0.085));
	const buttonBottomPadding = Math.max(insets.bottom + 28, 64);

	if (contentSizeLayout.shouldStackInlineContent) {
		return (
			<View className="flex-1 bg-background">
				<ScrollView
					bounces={false}
					contentInsetAdjustmentBehavior="never"
					showsVerticalScrollIndicator={false}
					// Safe-area, readable-width, and viewport height are runtime layout data.
					contentContainerStyle={{
						alignSelf: "center",
						justifyContent: "center",
						maxWidth: contentSizeLayout.containerMaxWidth,
						minHeight: height,
						paddingBottom: Math.max(insets.bottom + 32, 48),
						paddingHorizontal: contentSizeLayout.horizontalPadding,
						paddingTop: Math.max(insets.top + 32, 48),
						width: "100%",
					}}
				>
					<View className="items-center">
						<View className="h-36 w-36 items-center justify-center rounded-full bg-success-subtle">
							<Check
								size={64}
								color={DAYOVA_DESIGN_SYSTEM.colors.success}
								strokeWidth={2.2}
							/>
						</View>

						<Text
							accessibilityRole="header"
							className="mt-10 text-center font-poppins font-semibold text-heading-1 text-text"
						>
							{title}
						</Text>

						<View className="mt-6 items-center">
							<Text className="text-center font-poppins text-body-2 text-text">
								{detailLabel}
							</Text>
							{detailValue ? (
								<Text
									selectable
									className="text-center font-poppins text-body-2 text-secondary-text"
								>
									{detailValue}
								</Text>
							) : null}
						</View>
					</View>

					<Button
						accessibilityLabel="Fertig"
						className="mt-10 w-full"
						onPress={onFinish}
					>
						<Text>Fertig</Text>
					</Button>
				</ScrollView>
			</View>
		);
	}

	return (
		<View className="flex-1 bg-background">
			<PortraitContent className="flex-1 px-7">
				<View
					className="items-center"
					// Runtime viewport height preserves the default vertical composition.
					style={{ paddingTop: successMarkTop }}
				>
					<View className="h-36 w-36 items-center justify-center rounded-full bg-success-subtle">
						<Check
							size={64}
							color={DAYOVA_DESIGN_SYSTEM.colors.success}
							strokeWidth={2.2}
						/>
					</View>

					<Text
						accessibilityRole="header"
						className="text-center font-poppins font-semibold text-heading-1 text-text"
						// Runtime viewport height preserves the default heading rhythm.
						style={{ marginTop: headlineTopMargin }}
					>
						{title}
					</Text>

					<View className="mt-6 items-center">
						<Text className="text-center font-poppins text-body-2 text-text">
							{detailLabel}
						</Text>
						{detailValue ? (
							<Text
								selectable
								className="text-center font-poppins text-body-2 text-secondary-text"
							>
								{detailValue}
							</Text>
						) : null}
					</View>
				</View>

				<View
					className="absolute right-0 bottom-0 left-0 px-7"
					// Safe-area and viewport-height padding are runtime device data.
					style={{ paddingBottom: buttonBottomPadding }}
				>
					<Button
						accessibilityLabel="Fertig"
						className="w-full"
						onPress={onFinish}
					>
						<Text>Fertig</Text>
					</Button>
				</View>
			</PortraitContent>
		</View>
	);
}

export { SuccessConfirmationScreen };
