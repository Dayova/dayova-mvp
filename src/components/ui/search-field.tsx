import type { ComponentProps } from "react";
import { View } from "react-native";
import { FieldControl } from "~/components/ui/field";
import { Search } from "~/components/ui/icon";
import { Input } from "~/components/ui/input";
import { useDayovaTheme } from "~/lib/theme";
import { cn } from "~/lib/utils";

/** Renders the shared search control with a decorative icon and labeled input. */
export function SearchField({
	accessibilityLabel = "Suchen",
	placeholder = "Suchen",
	density = "comfortable",
	...props
}: ComponentProps<typeof Input> & {
	density?: "comfortable" | "compact";
}) {
	const { colors } = useDayovaTheme();
	return (
		<FieldControl
			className={cn(
				"gap-3 py-3",
				density === "compact" && "min-h-14 px-4 py-2",
			)}
		>
			<View accessible={false} importantForAccessibility="no-hide-descendants">
				<Search size={24} color={colors.secondaryText} />
			</View>
			<Input
				accessibilityLabel={accessibilityLabel}
				placeholder={placeholder}
				autoCorrect={false}
				returnKeyType="search"
				{...props}
			/>
		</FieldControl>
	);
}
