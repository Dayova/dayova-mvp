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
}: {
	title?: string;
	onBack: () => void;
	right?: ReactNode;
	showBack?: boolean;
	className?: string;
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
					className="text-center font-bold font-poppins text-16 text-text"
				>
					{title}
				</Text>
			) : null}
			<View className="absolute right-0 z-10 h-12 w-12 items-center justify-center">
				{right}
			</View>
		</View>
	);
}
