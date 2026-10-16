import { type ReactNode, useState } from "react";
import { useWindowDimensions, View } from "react-native";
import { BackButton } from "~/components/ui/button";
import { useContentSizeLayout } from "~/components/ui/portrait-content";
import { Text } from "~/components/ui/text";
import { cn } from "~/lib/utils";

type ScreenHeaderProps = {
	title?: string;
	onBack: () => void;
	right?: ReactNode;
	showBack?: boolean;
	className?: string;
	titleClassName?: string;
};

export function ScreenHeader(props: ScreenHeaderProps) {
	const { fontScale, width } = useWindowDimensions();
	const { shouldStackInlineContent } = useContentSizeLayout();

	return (
		<ScreenHeaderLayout
			// Recheck native text fit when the title or system sizing changes.
			key={`${props.title}:${props.titleClassName}:${props.showBack}:${width}:${fontScale}`}
			{...props}
			stackControls={shouldStackInlineContent}
		/>
	);
}

function ScreenHeaderLayout({
	title,
	onBack,
	right,
	showBack = true,
	className = "mb-7",
	titleClassName,
	stackControls,
}: ScreenHeaderProps & { stackControls: boolean }) {
	const [titleNeedsOwnRow, setTitleNeedsOwnRow] = useState(false);
	const [backWidth, setBackWidth] = useState(48);
	const [rightWidth, setRightWidth] = useState(0);
	const stacked = stackControls || titleNeedsOwnRow;
	const hasControls = showBack || Boolean(right);
	const sideWidth = Math.max(showBack ? backWidth : 0, right ? rightWidth : 0);
	const titlePadding = stacked || sideWidth === 0 ? 0 : sideWidth + 12;
	const backControl = showBack ? (
		<View onLayout={(event) => setBackWidth(event.nativeEvent.layout.width)}>
			<BackButton onPress={onBack} />
		</View>
	) : null;
	const rightControl = right ? (
		<View
			className="min-h-12 items-end justify-center"
			onLayout={(event) => setRightWidth(event.nativeEvent.layout.width)}
		>
			{right}
		</View>
	) : null;

	return (
		<View className={cn("relative min-h-12 justify-center", className)}>
			{stacked && hasControls ? (
				<View className="min-h-12 flex-row items-start justify-between gap-3">
					{backControl}
					{rightControl ? (
						<View className="min-w-0 flex-1 items-end">{rightControl}</View>
					) : null}
				</View>
			) : (
				<View className="absolute top-0 left-0 z-10">{backControl}</View>
			)}
			{title ? (
				<Text
					accessibilityRole="header"
					className={cn(
						"text-center font-poppins font-semibold text-body-2 text-text",
						titleClassName,
						stacked && hasControls && "mt-2",
					)}
					// Side controls are measured; typography overrides cannot reserve
					// empty timer space or defeat the full-width fallback.
					style={{ paddingHorizontal: titlePadding }}
					onTextLayout={(event) => {
						if (!stacked && event.nativeEvent.lines.length > 1) {
							setTitleNeedsOwnRow(true);
						}
					}}
				>
					{title}
				</Text>
			) : null}
			{!stacked ? (
				<View className="absolute top-0 right-0 z-10">{rightControl}</View>
			) : null}
		</View>
	);
}
