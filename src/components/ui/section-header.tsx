import { View, type ViewProps } from "react-native";
import { Text } from "~/components/ui/text";
import { cn } from "~/lib/utils";

type SectionHeaderProps = ViewProps & {
	title: string;
	description?: string;
	titleSize?: "sm" | "md";
};

function SectionHeader({
	className,
	description,
	title,
	titleSize = "md",
	...props
}: SectionHeaderProps) {
	return (
		<View className={cn("mb-7", className)} {...props}>
			<Text
				className={cn(
					"font-poppins font-semibold text-text",
					titleSize === "sm" ? "text-body-2" : "text-body-1",
				)}
			>
				{title}
			</Text>
			{description ? (
				<Text className="mt-2 font-poppins text-body-3 text-text/55">
					{description}
				</Text>
			) : null}
		</View>
	);
}

export { SectionHeader };
