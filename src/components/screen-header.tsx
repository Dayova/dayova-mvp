import type { ReactNode } from "react";
import { View } from "react-native";
import { BackButton } from "~/components/ui/button";
import { useContentSizeLayout } from "~/components/ui/portrait-content";
import { Text } from "~/components/ui/text";
import { cn } from "~/lib/utils";

export function ScreenHeader({
	title,
	onBack,
	right,
	showBack = true,
	className = "mb-7",
	titleClassName,
}: {
	title?: string;
	onBack: () => void;
	right?: ReactNode;
	showBack?: boolean;
	className?: string;
	titleClassName?: string;
}) {
	const { shouldStackInlineContent } = useContentSizeLayout();
	const defaultTitleClassName =
		"text-center font-poppins font-semibold text-body-2 text-text";

	return (
		<View className={cn("relative min-h-12 justify-center", className)}>
			{showBack ? (
				<View className="absolute left-0 z-10">
					<BackButton onPress={onBack} />
				</View>
			) : null}
			{title ? (
				<Text
					accessibilityRole="header"
					className={
						shouldStackInlineContent
							? cn("px-14", defaultTitleClassName, titleClassName)
							: (titleClassName ?? defaultTitleClassName)
					}
				>
					{title}
				</Text>
			) : null}
			{right ? (
				<View
					className={
						shouldStackInlineContent
							? "mt-2 min-h-12 items-end justify-center self-end"
							: "absolute right-0 z-10 h-12 w-12 items-center justify-center"
					}
				>
					{right}
				</View>
			) : null}
		</View>
	);
}
