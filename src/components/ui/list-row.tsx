import type { ReactNode } from "react";
import { View } from "react-native";
import { useContentSizeLayout } from "~/components/ui/portrait-content";
import { ActionSurface } from "~/components/ui/surface";
import { Text } from "~/components/ui/text";
import { cn } from "~/lib/utils";

type ListRowProps = React.ComponentProps<typeof ActionSurface> & {
	icon?: ReactNode;
	iconContainerClassName?: string;
	label: string;
	labelClassName?: string;
	description?: string;
	trailing?: ReactNode;
};

function ListRow({
	className,
	description,
	icon,
	iconContainerClassName,
	label,
	labelClassName,
	trailing,
	...props
}: ListRowProps) {
	const isInteractive = typeof props.onPress === "function";
	const { shouldStackInlineContent } = useContentSizeLayout({
		requestedHorizontalPadding: 24,
	});
	const stackTrailing = Boolean(trailing && shouldStackInlineContent);

	return (
		<ActionSurface
			accessible={props.accessible ?? isInteractive}
			accessibilityLabel={
				isInteractive ? (props.accessibilityLabel ?? label) : undefined
			}
			accessibilityRole={
				props.accessibilityRole ?? (isInteractive ? "button" : undefined)
			}
			className={cn(
				"min-h-16 px-5 py-3",
				stackTrailing ? "items-stretch" : "flex-row items-center",
				className,
			)}
			disabled={props.disabled ?? false}
			{...props}
		>
			<View
				className={cn(
					"min-w-0 flex-1",
					shouldStackInlineContent ? "items-start" : "flex-row items-center",
				)}
			>
				{icon ? (
					<View
						className={cn(
							"h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted",
							shouldStackInlineContent ? "mb-3" : "mr-3",
							iconContainerClassName,
						)}
					>
						{icon}
					</View>
				) : null}
				<View className="min-w-0 flex-1">
					<Text
						className={cn(
							"font-poppins font-semibold text-body-2 text-text",
							labelClassName,
						)}
						numberOfLines={shouldStackInlineContent ? undefined : 1}
					>
						{label}
					</Text>
					{description ? (
						<Text
							className="mt-1 font-poppins text-body-4 text-text/50"
							numberOfLines={shouldStackInlineContent ? undefined : 2}
						>
							{description}
						</Text>
					) : null}
				</View>
			</View>
			{trailing ? (
				<View
					className={cn("shrink-0", stackTrailing ? "mt-3 self-end" : "ml-3")}
				>
					{trailing}
				</View>
			) : null}
		</ActionSurface>
	);
}

export { ListRow };
