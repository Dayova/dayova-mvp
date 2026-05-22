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
				className="font-poppins font-semibold text-[#17171C]"
				style={{
					fontSize: titleSize === "sm" ? 18 : 20,
					lineHeight: titleSize === "sm" ? 24 : 26,
					includeFontPadding: false,
				}}
			>
				{title}
			</Text>
			{description ? (
				<Text
					className="mt-2 font-poppins text-text/55"
					style={{ fontSize: 14, lineHeight: 20, includeFontPadding: false }}
				>
					{description}
				</Text>
			) : null}
		</View>
	);
}

export { SectionHeader };
