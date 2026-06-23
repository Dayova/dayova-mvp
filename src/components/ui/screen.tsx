import { type ScrollViewProps, View, type ViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardSafeScrollView } from "~/components/ui/keyboard-safe-scroll-view";
import { cn } from "~/lib/utils";

type ScreenProps = ViewProps;

function Screen({ className, ...props }: ScreenProps) {
	return <View className={cn("flex-1 bg-background", className)} {...props} />;
}

type ScreenScrollProps = ScrollViewProps & {
	horizontalPadding?: number;
	topPadding?: number;
	bottomPadding?: number;
};

function ScreenScroll({
	className,
	contentContainerStyle,
	horizontalPadding = 32,
	topPadding = 80,
	bottomPadding = 60,
	...props
}: ScreenScrollProps) {
	const insets = useSafeAreaInsets();

	return (
		<KeyboardSafeScrollView
			className={cn("flex-1 bg-background", className)}
			// Safe-area padding is device/runtime data. This third-party keyboard
			// scroll host also exposes content layout through contentContainerStyle,
			// not a reliable NativeWind contentContainerClassName mapping.
			contentContainerStyle={[
				{
					paddingHorizontal: horizontalPadding,
					paddingTop: Math.max(insets.top + 28, topPadding),
					paddingBottom: Math.max(insets.bottom + 36, bottomPadding),
				},
				contentContainerStyle,
			]}
			{...props}
		/>
	);
}

export { Screen, ScreenScroll };
