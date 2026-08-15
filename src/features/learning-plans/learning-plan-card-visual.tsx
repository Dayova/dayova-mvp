import { View } from "react-native";
import {
	ArrowUpRight,
	ClipboardEdit,
	GraduationCap,
} from "~/components/ui/icon";
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

type LearningPlanCardVisualState =
	| {
			kind: "creation";
			progressLabel: string;
	  }
	| {
			kind: "materialRequired";
	  }
	| {
			kind: "ready";
			durationMinutes: number | string | null;
			progress: number;
			remainingDays: number;
			rollingWindowLabel: string;
	  };

export type LearningPlanCardVisualModel = {
	subject: string;
	status: LearningPlanCardStatus;
	examDateLabel: string;
	currentTitle: string;
	state: LearningPlanCardVisualState;
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
						{model.state.kind === "ready" ? (
							<StatusBadge
								fixedTextScale={fixedTextScale}
								status={{
									label: `${model.state.durationMinutes ?? "–"} min`,
									background: DAYOVA_DESIGN_SYSTEM.colors.systemSubtle,
									foreground: DAYOVA_DESIGN_SYSTEM.colors.primary,
								}}
							/>
						) : null}
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

			{model.state.kind === "creation" ? (
				<View className="mt-4 flex-row items-center gap-1.5">
					<ClipboardEdit
						size={14}
						color={colors.secondaryText}
						strokeWidth={2}
					/>
					<Text
						allowFontScaling={!fixedTextScale}
						className="font-poppins text-body-4 text-secondary-text"
					>
						{model.state.progressLabel}
					</Text>
				</View>
			) : model.state.kind === "materialRequired" ? (
				<Text
					allowFontScaling={!fixedTextScale}
					className="mt-4 max-w-[282px] font-poppins text-body-4 text-secondary-text"
				>
					Lade Schulmaterial hoch, damit Dayova deinen Lernplan erstellen kann.
				</Text>
			) : (
				<LearningPlanCardFooter
					fixedTextScale={fixedTextScale}
					progress={model.state.progress}
					remainingDays={model.state.remainingDays}
					rollingWindowLabel={model.state.rollingWindowLabel}
				/>
			)}
		</NotchedActionCard>
	);

	return card;
}
