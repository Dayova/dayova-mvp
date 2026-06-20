import type { ReactNode } from "react";
import { View } from "react-native";
import { ActionSurface } from "~/components/ui/surface";
import { Text } from "~/components/ui/text";
import { cn } from "~/lib/utils";

type ListRowProps = React.ComponentProps<typeof ActionSurface> & {
	icon?: ReactNode;
	label: string;
	description?: string;
	trailing?: ReactNode;
};

function ListRow({
	className,
	description,
	icon,
	label,
	trailing,
	...props
}: ListRowProps) {
	return (
		<ActionSurface
			accessibilityLabel={props.accessibilityLabel ?? label}
			accessibilityRole={props.onPress ? "button" : "text"}
			className={cn("min-h-16 flex-row items-center px-5 py-3", className)}
			{...props}
		>
			{icon ? (
				<View className="mr-3 h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted">
					{icon}
				</View>
			) : null}
			<View className="flex-1">
				<Text
					className="font-poppins font-semibold text-body-2 text-foreground"
					numberOfLines={1}
				>
					{label}
				</Text>
				{description ? (
					<Text
						className="mt-1 font-poppins text-body-4 text-text/50"
						numberOfLines={2}
					>
						{description}
					</Text>
				) : null}
			</View>
			{trailing ? <View className="ml-3 shrink-0">{trailing}</View> : null}
		</ActionSurface>
	);
}

export { ListRow };
