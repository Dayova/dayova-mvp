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
				"mb-4 min-h-12 justify-between gap-3",
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
				className="min-h-9 border border-border bg-card px-3 py-1"
				size="sm"
				hitSlop={6}
				onPress={onToday}
				accessibilityLabel="Heute"
				accessibilityHint="Zeigt den heutigen Tag und die aktuelle Woche an."
			>
				<Text className="font-normal text-body-3 text-secondary-text group-active:text-secondary-text">
					Heute
				</Text>
			</Button>
		</View>
	);
}
