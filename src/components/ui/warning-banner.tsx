import { View, type ViewProps } from "react-native";
import { Button } from "~/components/ui/button";
import { CircleAlert } from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { cn } from "~/lib/utils";

type WarningBannerProps = ViewProps & {
	title?: string;
	description: string;
	ctaLabel?: string;
	ctaAccessibilityLabel?: string;
	onPressCta?: () => void;
};

function WarningBanner({
	className,
	ctaAccessibilityLabel,
	ctaLabel,
	description,
	onPressCta,
	style,
	title,
	...props
}: WarningBannerProps) {
	const showCta = Boolean(ctaLabel && onPressCta);

	return (
		<View
			className={cn(
				"flex-row items-start gap-4 rounded-[28px] bg-info-subtle px-5 py-5",
				className,
			)}
			style={style}
			{...props}
		>
			<View className="h-10 w-10 items-center justify-center rounded-full bg-card/65">
				<CircleAlert
					size={21}
					color={DAYOVA_DESIGN_SYSTEM.colors.info}
					strokeWidth={2.2}
				/>
			</View>
			<View className="flex-1 gap-2 pt-0.5">
				{title ? (
					<Text className="font-poppins font-semibold text-body-3 text-text">
						{title}
					</Text>
				) : null}
				<Text selectable className="font-poppins text-body-4 text-text">
					{description}
				</Text>
				{showCta ? (
					<Button
						accessibilityLabel={ctaAccessibilityLabel ?? ctaLabel}
						className="mt-1 h-10 min-h-10 self-start rounded-full bg-card px-5 shadow-black/5 shadow-sm active:bg-card/85"
						onPress={onPressCta}
						size="sm"
						variant="ghost"
					>
						<Text className="font-poppins font-semibold text-body-4 text-text">
							{ctaLabel}
						</Text>
					</Button>
				) : null}
			</View>
		</View>
	);
}

export { WarningBanner };
