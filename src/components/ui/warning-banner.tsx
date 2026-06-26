import { TouchableOpacity, View, type ViewProps } from "react-native";
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
				"flex-row gap-3 rounded-[24px] bg-warning-subtle px-5 py-5",
				className,
			)}
			style={style}
			{...props}
		>
			<CircleAlert
				size={22}
				color={DAYOVA_DESIGN_SYSTEM.colors.warning}
				strokeWidth={2.2}
			/>
			<View className="flex-1 gap-1">
				{title ? (
					<Text className="font-poppins font-semibold text-body-3 text-text">
						{title}
					</Text>
				) : null}
				<Text selectable className="font-poppins text-body-4 text-text">
					{description}
				</Text>
				{showCta ? (
					<TouchableOpacity
						accessibilityRole="button"
						accessibilityLabel={ctaAccessibilityLabel ?? ctaLabel}
						activeOpacity={0.82}
						onPress={onPressCta}
						className="mt-2 self-start rounded-full bg-card"
						style={{
							minHeight: 38,
							paddingHorizontal: 20,
							paddingVertical: 10,
						}}
					>
						<Text className="font-poppins font-semibold text-body-4 text-text">
							{ctaLabel}
						</Text>
					</TouchableOpacity>
				) : null}
			</View>
		</View>
	);
}

export { WarningBanner };
