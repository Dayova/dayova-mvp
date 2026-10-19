import type { ComponentProps } from "react";
import { View } from "react-native";
import { FieldControl } from "~/components/ui/field";
import { Search } from "~/components/ui/icon";
import { Input } from "~/components/ui/input";
import { useDayovaTheme } from "~/lib/theme";

/** Renders the shared search control with a decorative icon and labeled input. */
export function SearchField({
	accessibilityLabel = "Suchen",
	placeholder = "Suchen",
	...props
}: ComponentProps<typeof Input>) {
	const { colors } = useDayovaTheme();
	return (
		<FieldControl className="gap-3 py-3">
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
