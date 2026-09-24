import { Pressable, View } from "react-native";
import { Plus } from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
import { useDayovaTheme } from "~/lib/theme";

type DashboardDayHeaderProps = {
	agendaLabel: string;
	onAddPlan: () => void;
	showAddPlanAction: boolean;
	weekday: string;
};

function DashboardDayHeader({
	agendaLabel,
	onAddPlan,
	showAddPlanAction,
	weekday,
}: DashboardDayHeaderProps) {
	const { colors } = useDayovaTheme();

	return (
		<View className="z-10 flex-row items-center justify-between gap-4 bg-background px-6 pt-5 pb-6">
			<View className="flex-1">
				<Text
					accessibilityRole="header"
					className="font-poppins font-semibold text-heading-2 text-text"
				>
					{weekday}
				</Text>
				<Text className="font-poppins text-body-4 text-secondary-text">
					{agendaLabel}
				</Text>
			</View>
			{showAddPlanAction ? (
				<Pressable
					accessibilityHint="Öffnet die Erstellung eines neuen Lernplans."
					accessibilityLabel="Lernplan hinzufügen"
					accessibilityRole="button"
					className="h-12 w-12 items-center justify-center rounded-full border border-border bg-card active:opacity-80"
					hitSlop={4}
					onPress={onAddPlan}
				>
					<Plus size={22} color={colors.primaryStrong} strokeWidth={2.2} />
				</Pressable>
			) : null}
		</View>
	);
}

export { DashboardDayHeader };
export type { DashboardDayHeaderProps };
