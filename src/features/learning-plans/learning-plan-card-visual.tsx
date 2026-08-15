import { View } from "react-native";
import { ArrowUpRight, GraduationCap } from "~/components/ui/icon";
import { NotchedActionCard } from "~/components/ui/notched-action-card";
import { Text } from "~/components/ui/text";
import { LearningPlanCardFooter } from "~/features/learning-plans/learning-plan-card-footer";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { useDayovaTheme } from "~/lib/theme";

type LearningPlanCardStatus = {
	label: string;
	background: string;
	foreground: string;
};

export type LearningPlanCardVisualModel = {
	subject: string;
	status: LearningPlanCardStatus;
	examDateLabel: string;
	currentTitle: string;
	durationMinutes: number | string | null;
	needsSchoolMaterial: boolean;
	progress: number;
	remainingDays: number;
	rollingWindowLabel: string;
};

type ScreenLearningPlanCardVisualProps = {
	mode?: "screen";
	model: LearningPlanCardVisualModel;
	onPress: () => void;
	accessibilityLabel: string;
	accessibilityHint: string;
};

type ArtworkLearningPlanCardVisualProps = {
	mode: "artwork";
	model: LearningPlanCardVisualModel;
};

type LearningPlanCardVisualProps =
	| ScreenLearningPlanCardVisualProps
	| ArtworkLearningPlanCardVisualProps;

function StatusBadge({
	status,
	fixedTextScale,
}: {
	status: LearningPlanCardStatus;
	fixedTextScale: boolean;
}) {
	return (
		<View
			className="h-7 justify-center rounded-full px-3"
			style={{ backgroundColor: status.background }}
		>
			<Text
				allowFontScaling={!fixedTextScale}
				className="font-poppins font-semibold text-body-5"
				style={{ color: status.foreground }}
			>
				{status.label}
			</Text>
		</View>
	);
}

export function LearningPlanCardVisual(props: LearningPlanCardVisualProps) {
	const { colors } = useDayovaTheme();
	const { model } = props;
	const fixedTextScale = props.mode === "artwork";
	const card = (
		<NotchedActionCard
			actionIcon={
				<ArrowUpRight
					size={24}
					color={DAYOVA_DESIGN_SYSTEM.colors.light1}
					strokeWidth={1.9}
				/>
			}
			{...(props.mode === "artwork"
				? { pressType: "none" as const }
				: {
						pressType: "card" as const,
						onPress: props.onPress,
						cardAccessibilityLabel: props.accessibilityLabel,
						cardAccessibilityHint: props.accessibilityHint,
					})}
		>
			<View className="gap-2">
				<View className="flex-row items-start justify-between gap-3">
					<Text
						allowFontScaling={!fixedTextScale}
						className="min-w-0 flex-1 pr-2 font-poppins font-semibold text-body-1 text-text"
						numberOfLines={2}
					>
						{model.subject}
					</Text>
					<View className="shrink-0 flex-row gap-2">
						<StatusBadge
							status={model.status}
							fixedTextScale={fixedTextScale}
						/>
						{model.needsSchoolMaterial ? null : (
							<StatusBadge
								fixedTextScale={fixedTextScale}
								status={{
									label: `${model.durationMinutes ?? "–"} min`,
									background: DAYOVA_DESIGN_SYSTEM.colors.systemSubtle,
									foreground: DAYOVA_DESIGN_SYSTEM.colors.primary,
								}}
							/>
						)}
					</View>
				</View>

				<View className="flex-row items-center gap-1">
					<GraduationCap
						size={14}
						color={colors.secondaryText}
						strokeWidth={2}
					/>
					<Text
						allowFontScaling={!fixedTextScale}
						className="font-poppins text-body-4 text-secondary-text"
					>
						{model.examDateLabel}
					</Text>
				</View>

				<Text
					allowFontScaling={!fixedTextScale}
					className="max-w-[282px] font-poppins font-semibold text-body-2 text-text"
					numberOfLines={2}
				>
					{model.currentTitle}
				</Text>
			</View>

			{model.needsSchoolMaterial ? (
				<Text
					allowFontScaling={!fixedTextScale}
					className="mt-4 max-w-[282px] font-poppins text-body-4 text-secondary-text"
				>
					Lade Schulmaterial hoch, damit Dayova deinen Lernplan erstellen kann.
				</Text>
			) : (
				<LearningPlanCardFooter
					fixedTextScale={fixedTextScale}
					progress={model.progress}
					remainingDays={model.remainingDays}
					rollingWindowLabel={model.rollingWindowLabel}
				/>
			)}
		</NotchedActionCard>
	);

	return card;
}
