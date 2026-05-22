import { ScrollView, View, type ScrollViewProps, type ViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { cn } from "~/lib/utils";

type ScreenProps = ViewProps;

function Screen({ className, ...props }: ScreenProps) {
	return (
		<View
			className={cn("flex-1", className)}
			style={{ backgroundColor: DAYOVA_DESIGN_SYSTEM.colors.appBackground }}
			{...props}
		/>
	);
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
		<ScrollView
			className={cn("flex-1", className)}
			contentContainerStyle={[
				{
					paddingHorizontal: horizontalPadding,
					paddingTop: Math.max(insets.top + 28, topPadding),
					paddingBottom: Math.max(insets.bottom + 36, bottomPadding),
				},
				contentContainerStyle,
			]}
			keyboardShouldPersistTaps="handled"
			showsVerticalScrollIndicator={false}
			{...props}
		/>
	);
}

export { Screen, ScreenScroll };
