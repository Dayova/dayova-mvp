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
	const isInteractive = typeof props.onPress === "function";

	return (
		<ActionSurface
			accessible={props.accessible ?? isInteractive}
			accessibilityLabel={
				isInteractive ? (props.accessibilityLabel ?? label) : undefined
			}
			accessibilityRole={
				props.accessibilityRole ?? (isInteractive ? "button" : undefined)
			}
			className={cn("min-h-16 flex-row items-center px-5 py-3", className)}
			disabled={props.disabled ?? false}
			{...props}
		>
			{icon ? (
				<View className="mr-3 h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted">
					{icon}
				</View>
			) : null}
			<View className="flex-1">
				<Text
					className="font-poppins font-semibold text-body-2 text-text"
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
