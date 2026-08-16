import type { ComponentProps } from "react";
import { useWindowDimensions, View } from "react-native";
import { getContentSizeLayout } from "~/lib/content-size-layout";
import { cn } from "~/lib/utils";

type ContentSizeLayoutOptions = {
	containerMaxWidth?: number;
	requestedHorizontalPadding?: number;
};

function useContentSizeLayout(options: ContentSizeLayoutOptions = {}) {
	const { fontScale, width } = useWindowDimensions();

	return getContentSizeLayout({
		...options,
		fontScale,
		viewportWidth: width,
	});
}

type PortraitContentProps = ComponentProps<typeof View> & {
	maxWidth?: number;
};

function PortraitContent({
	className,
	maxWidth = 480,
	style,
	...props
}: PortraitContentProps) {
	return (
		<View
			{...props}
			className={cn("w-full self-center", className)}
			style={[
				// The readable-width bound is a runtime component option.
				{
					maxWidth,
				},
				style,
			]}
		/>
	);
}

export { PortraitContent, useContentSizeLayout };
