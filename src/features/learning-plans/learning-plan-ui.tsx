import { type ReactNode, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Button } from "~/components/ui/button";
import { FeedbackTouchableOpacity } from "~/components/ui/feedback-pressable";
import {
	FieldAccessory,
	FieldLabel,
	FieldTrigger,
} from "~/components/ui/field";
import { CalendarDays, ChevronDown, Clock3 } from "~/components/ui/icon";
import { useContentSizeLayout } from "~/components/ui/portrait-content";
import { Text } from "~/components/ui/text";
import type {
	PlanSession,
	SessionPhase,
} from "~/features/learning-plans/types";
import { formatDate } from "~/features/learning-plans/utils";
import { useDayovaTheme } from "~/lib/theme";
import { cn } from "~/lib/utils";

const phaseEditCopy: Record<
	SessionPhase,
	{ actionLabel: string; fieldLabel: string }
> = {
	theory: { actionLabel: "Lernen", fieldLabel: "Theorie" },
	practice: { actionLabel: "Üben", fieldLabel: "Üben" },
	rehearsal: { actionLabel: "Praxis", fieldLabel: "Praxis" },
};

const getSessionEditTitle = (session: PlanSession) =>
	`${session.sortOrder + 1}. ${phaseEditCopy[session.phase].actionLabel} bearbeiten`;

const getSessionPhaseLabel = (phase: SessionPhase) =>
	phaseEditCopy[phase].fieldLabel;

const sessionPhaseOptions: SessionPhase[] = ["theory", "practice", "rehearsal"];

function SessionEditPill({
	value,
	icon,
	onPress,
	accessibilityLabel,
	className,
}: {
	value: string;
	icon: ReactNode;
	onPress: () => void;
	accessibilityLabel: string;
	className?: string;
}) {
	const { shouldStackInlineContent } = useContentSizeLayout();

	return (
		<FieldTrigger
			accessibilityLabel={accessibilityLabel}
			accessibilityRole="button"
			activeOpacity={0.86}
			onPress={onPress}
			className={cn("min-h-[64px] rounded-[28px] px-5", className)}
		>
			<Text
				className="flex-1 font-poppins text-body-2 text-text"
				numberOfLines={shouldStackInlineContent ? undefined : 1}
			>
				{value}
			</Text>
			<FieldAccessory>{icon}</FieldAccessory>
		</FieldTrigger>
	);
}

/**
 * Displays controlled session fields and responsive save/remove actions.
 * The parent owns date/time pickers, removal confirmation, and persistence.
 */
export function SessionEditForm({
	session,
	editDate,
	editStart,
	editEnd,
	editPhase,
	isSaving,
	onChangeDate,
	onChangeStart,
	onChangeEnd,
	onChangePhase,
	onRemove,
	onSave,
}: {
	session: PlanSession;
	editDate: Date;
	editStart: string;
	editEnd: string;
	editPhase: SessionPhase;
	isSaving: boolean;
	onChangeDate: () => void;
	onChangeStart: () => void;
	onChangeEnd: () => void;
	onChangePhase: (phase: SessionPhase) => void;
	onRemove: () => void;
	onSave: () => void;
}) {
	const [isPhaseMenuOpen, setIsPhaseMenuOpen] = useState(false);
	const { colors } = useDayovaTheme();
	const { shouldStackInlineContent } = useContentSizeLayout();

	return (
		<View className="flex-1">
			<Text className="font-poppins font-semibold text-body-2 text-text">
				{getSessionEditTitle({ ...session, phase: editPhase })}
			</Text>
			<Text className="mt-2 mb-7 font-poppins text-body-3 text-text/42">
				Passe deinen Lernplan so an, wie er für dich passt.
			</Text>

			<FieldLabel>Lerndatum</FieldLabel>
			<SessionEditPill
				accessibilityLabel="Lerndatum ändern"
				value={formatDate(editDate)}
				icon={<CalendarDays size={20} color="#697586" strokeWidth={2.1} />}
				onPress={onChangeDate}
			/>
			<View
				className={cn(
					"mt-5 mb-7 gap-3",
					!shouldStackInlineContent && "flex-row",
				)}
			>
				<View className="flex-1">
					<SessionEditPill
						accessibilityLabel="Startzeit ändern"
						value={editStart}
						icon={<Clock3 size={19} color="#697586" strokeWidth={2.1} />}
						onPress={onChangeStart}
						className="min-h-[64px] px-5"
					/>
				</View>
				<View className="flex-1">
					<SessionEditPill
						accessibilityLabel="Endzeit ändern"
						value={editEnd}
						icon={<Clock3 size={19} color="#697586" strokeWidth={2.1} />}
						onPress={onChangeEnd}
						className="min-h-[64px] px-5"
					/>
				</View>
			</View>

			<FieldLabel>Lernphase</FieldLabel>
			<View>
				<SessionEditPill
					accessibilityLabel="Lernphase ändern"
					value={getSessionPhaseLabel(editPhase)}
					icon={<ChevronDown size={20} color={colors.text} strokeWidth={2.1} />}
					onPress={() => setIsPhaseMenuOpen((value) => !value)}
				/>
				{isPhaseMenuOpen ? (
					<View className="mt-2 gap-2">
						{sessionPhaseOptions.map((phase) => (
							<FeedbackTouchableOpacity
								key={phase}
								accessibilityLabel={`Lernphase ${getSessionPhaseLabel(phase)} auswählen`}
								accessibilityRole="button"
								accessibilityState={{ selected: phase === editPhase }}
								activeOpacity={0.86}
								onPress={() => {
									onChangePhase(phase);
									setIsPhaseMenuOpen(false);
								}}
								className="min-h-12 justify-center rounded-[24px] bg-card px-5 py-2"
								style={{
									borderWidth: phase === editPhase ? 1.5 : 1,
									borderColor:
										phase === editPhase ? "#00BAFF" : "rgba(17,24,39,0.04)",
								}}
							>
								<Text className="font-poppins text-body-3 text-text/70">
									{getSessionPhaseLabel(phase)}
								</Text>
							</FeedbackTouchableOpacity>
						))}
					</View>
				) : null}
			</View>

			<View
				className={cn(
					"mt-auto gap-3 pt-8",
					!shouldStackInlineContent && "flex-row",
				)}
			>
				<Button
					variant="destructive"
					className={
						shouldStackInlineContent
							? "w-full shadow-none"
							: "flex-1 shadow-none"
					}
					onPress={onRemove}
				>
					<Text>Entfernen</Text>
				</Button>
				<Button
					accessibilityLabel={
						isSaving ? "Speichern, wird geladen" : "Speichern"
					}
					accessibilityLiveRegion={isSaving ? "polite" : undefined}
					accessibilityState={{ busy: isSaving, disabled: isSaving }}
					className={shouldStackInlineContent ? "w-full" : "flex-1"}
					onPress={onSave}
					disabled={isSaving}
				>
					{isSaving ? (
						<ActivityIndicator color="#FFFFFF" />
					) : (
						<Text>Speichern</Text>
					)}
				</Button>
			</View>
		</View>
	);
}
