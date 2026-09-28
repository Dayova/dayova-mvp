import { View } from "react-native";
import { Button } from "~/components/ui/button";
import { useContentSizeLayout } from "~/components/ui/portrait-content";
import { Text } from "~/components/ui/text";
import { cn } from "~/lib/utils";

/** Calendar orientation only: the existing week slider owns day selection. */
export function DashboardCalendarHeader({
	selectedDate,
	onToday,
}: {
	selectedDate: Date;
	onToday: () => void;
}) {
	const { shouldStackInlineContent } = useContentSizeLayout();
	return (
		<View
			className={cn(
				"mb-4 justify-between gap-3",
				shouldStackInlineContent ? "items-start" : "flex-row items-center",
			)}
			testID="dashboard-calendar-header"
		>
			<Text
				accessibilityRole="header"
				className={cn(
					"font-poppins font-semibold text-body-1 text-text",
					!shouldStackInlineContent && "flex-1",
				)}
			>
				{new Intl.DateTimeFormat("de-DE", {
					month: "long",
					year: "numeric",
				}).format(selectedDate)}
			</Text>
			<Button
				variant="ghost"
				className="border border-border bg-card"
				size="sm"
				onPress={onToday}
				accessibilityLabel="Heute"
				accessibilityHint="Zeigt den heutigen Tag und die aktuelle Woche an."
			>
				<Text className="text-primary-strong">Heute</Text>
			</Button>
		</View>
	);
}
