import type { ReactNode } from "react";
import { View } from "react-native";
import { Button } from "~/components/ui/button";
import { useContentSizeLayout } from "~/components/ui/portrait-content";
import { Text } from "~/components/ui/text";
import { cn } from "~/lib/utils";

/** Calendar orientation only: the existing week slider owns day selection. */
/** Shows the selected month and keeps the calendar actions together. */
export function DashboardCalendarHeader({
	createAction,
	selectedDate,
	onToday,
}: {
	createAction: ReactNode;
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
			<View className="flex-row items-center gap-2">
				<Button
					variant="ghost"
					className="min-h-9 border border-border bg-card px-3 py-1"
					size="sm"
					hitSlop={6}
					onPress={onToday}
					accessibilityLabel="Heute"
					accessibilityHint="Zeigt den heutigen Tag und die aktuelle Woche an."
				>
					<Text className="font-normal text-body-3 text-text group-active:text-text dark:text-white dark:group-active:text-white">
						Heute
					</Text>
				</Button>
				{createAction}
			</View>
		</View>
	);
}
