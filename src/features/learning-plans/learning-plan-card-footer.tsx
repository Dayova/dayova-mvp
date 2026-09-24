import { LinearGradient } from "expo-linear-gradient";
import { View } from "react-native";
import { ClipboardEdit } from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { useDayovaTheme } from "~/lib/theme";

// The card content ends 24 points from the edge. This keeps the footer another
// 32 points inward so it clears the 48-point action and its notched border.
const FOOTER_ACTION_INSET = 32;

export function LearningPlanCardFooter({
	fixedTextScale = false,
	progress,
	remainingDays,
	rollingWindowLabel,
}: {
	fixedTextScale?: boolean;
	progress: number;
	remainingDays: number;
	rollingWindowLabel: string;
}) {
	const { colors } = useDayovaTheme();

	return (
		<View
			className="mt-4 w-full max-w-[300px] gap-1"
			style={{ paddingRight: FOOTER_ACTION_INSET }}
			testID="plan-card-footer"
		>
			<View className="flex-row items-start">
				<Text
					allowFontScaling={!fixedTextScale}
					className="font-poppins text-body-5 text-secondary-text"
					style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, paddingRight: 8 }}
				>
					{rollingWindowLabel}
				</Text>
				<View className="shrink-0 flex-row items-center gap-1">
					<ClipboardEdit
						size={14}
						color={colors.secondaryText}
						strokeWidth={2}
					/>
					<Text
						allowFontScaling={!fixedTextScale}
						className="font-poppins text-body-4 text-secondary-text"
						numberOfLines={1}
					>
						{remainingDays === 1 ? "noch 1 Tag" : `noch ${remainingDays} Tage`}
					</Text>
				</View>
			</View>
			<View
				accessibilityLabel={`${progress} Prozent abgeschlossen`}
				accessibilityValue={{
					max: 100,
					min: 0,
					now: progress,
					text: `${progress} Prozent`,
				}}
				accessibilityRole="progressbar"
				className="h-2 w-[258px] max-w-full overflow-hidden rounded-full bg-light-2"
			>
				<LinearGradient
					colors={DAYOVA_DESIGN_SYSTEM.gradients.primaryInteractive.colors}
					start={DAYOVA_DESIGN_SYSTEM.gradients.primaryInteractive.start}
					end={DAYOVA_DESIGN_SYSTEM.gradients.primaryInteractive.end}
					style={{
						height: "100%",
						width: `${Math.max(progress, progress > 0 ? 8 : 0)}%`,
						borderRadius: 999,
					}}
				/>
			</View>
		</View>
	);
}
