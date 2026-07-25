import type { ReactNode } from "react";
import { View } from "react-native";
import { BackButton } from "~/components/ui/button";
import { Text } from "~/components/ui/text";

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
	return (
		<View className={`relative min-h-12 justify-center ${className}`}>
			{showBack ? (
				<View className="absolute left-0 z-10">
					<BackButton onPress={onBack} />
				</View>
			) : null}
			{title ? (
				<Text
					accessibilityRole="header"
					className={
						titleClassName ??
						"px-20 text-center font-poppins font-semibold text-body-2 text-text"
					}
					numberOfLines={1}
				>
					{title}
				</Text>
			) : null}
			<View className="absolute right-0 z-10 min-h-12 min-w-12 items-center justify-center">
				{right}
			</View>
		</View>
	);
}
