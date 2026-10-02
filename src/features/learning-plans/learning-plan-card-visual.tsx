import { TouchableOpacity, View } from "react-native";
import {
	ArrowUpRight,
	ClipboardEdit,
	GraduationCap,
	PropertyEdit,
	Trash2,
} from "~/components/ui/icon";
import { NotchedActionCard } from "~/components/ui/notched-action-card";
import { useContentSizeLayout } from "~/components/ui/portrait-content";
import { Text } from "~/components/ui/text";
import { LearningPlanCardFooter } from "~/features/learning-plans/learning-plan-card-footer";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { useDayovaTheme } from "~/lib/theme";
import { cn } from "~/lib/utils";
import { LearningPlanStatusBadge as StatusBadge } from "./learning-plan-status-badge";

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

type LearningPlanCardVisualModel = {
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
	onEdit?: () => void;
	onDelete?: () => void;
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

export function LearningPlanCardVisual(props: LearningPlanCardVisualProps) {
	const { colors } = useDayovaTheme();
	const { model } = props;
	const fixedTextScale = props.mode === "artwork";
	const { shouldStackInlineContent } = useContentSizeLayout();
	const shouldReflowCard = !fixedTextScale && shouldStackInlineContent;
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
						pressType: "action" as const,
						onPress: props.onPress,
						actionAccessibilityLabel: props.accessibilityLabel,
						actionAccessibilityHint: props.accessibilityHint,
					})}
		>
			<View className="gap-2">
				{props.mode !== "artwork" && (props.onEdit || props.onDelete) ? (
					<View className="flex-row justify-end gap-2">
						{props.onEdit ? (
							<TouchableOpacity
								accessibilityRole="button"
								accessibilityLabel={`${model.subject}: Lernplan bearbeiten`}
								onPress={props.onEdit}
								className="h-11 w-11 items-center justify-center rounded-full border border-border bg-surface"
							>
								<PropertyEdit size={22} color={colors.secondaryText} />
							</TouchableOpacity>
						) : null}
						{props.onDelete ? (
							<TouchableOpacity
								accessibilityRole="button"
								accessibilityLabel={`${model.subject}: Lernplan löschen`}
								onPress={props.onDelete}
								className="h-11 w-11 items-center justify-center rounded-full border border-border bg-surface"
							>
								<Trash2 size={22} color={colors.secondaryText} />
							</TouchableOpacity>
						) : null}
					</View>
				) : null}
				<View
					className={cn(
						"items-start justify-between gap-3",
						shouldReflowCard ? "flex-col" : "flex-row",
					)}
					testID="learning-plan-card-heading-row"
				>
					<Text
						allowFontScaling={!fixedTextScale}
						className={cn(
							"min-w-0 font-poppins font-semibold text-body-1 text-text",
							shouldReflowCard ? "w-full" : "flex-1 pr-2",
						)}
						numberOfLines={shouldReflowCard ? undefined : 2}
					>
						{model.subject}
					</Text>
					<View className="shrink-0 flex-row flex-wrap gap-2">
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
						className="min-w-0 flex-1 font-poppins text-body-4 text-secondary-text"
					>
						{model.examDateLabel}
					</Text>
				</View>

				<Text
					allowFontScaling={!fixedTextScale}
					className={cn(
						"font-poppins font-semibold text-body-2 text-text",
						!shouldReflowCard && "max-w-[282px]",
					)}
					numberOfLines={shouldReflowCard ? undefined : 2}
				>
					{model.currentTitle}
				</Text>
			</View>

			{model.state.kind === "creation" ? (
				<View className="mt-4 flex-row items-center gap-2">
					<ClipboardEdit
						size={14}
						color={colors.secondaryText}
						strokeWidth={2}
					/>
					<Text
						allowFontScaling={!fixedTextScale}
						className="min-w-0 flex-1 font-poppins text-body-4 text-secondary-text"
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
