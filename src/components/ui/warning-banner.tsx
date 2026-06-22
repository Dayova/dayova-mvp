import { TouchableOpacity, View, type ViewProps } from "react-native";
import { CircleAlert } from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
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
				"flex-row rounded-[24px] bg-[#FFF7E0] px-5 py-5",
				className,
			)}
			style={[{ gap: 12 }, style]}
			{...props}
		>
			<CircleAlert size={22} color="#F59E0B" strokeWidth={2.2} />
			<View className="flex-1" style={{ gap: 4 }}>
				{title ? (
					<Text
						className="font-bold font-poppins text-[#7A5A12]"
						style={{
							fontSize: 14,
							lineHeight: 20,
							includeFontPadding: false,
						}}
					>
						{title}
					</Text>
				) : null}
				<Text
					selectable
					className="font-poppins text-[#7A5A12]"
					style={{
						fontSize: 12,
						lineHeight: 18,
						includeFontPadding: false,
					}}
				>
					{description}
				</Text>
				{showCta ? (
					<TouchableOpacity
						accessibilityRole="button"
						accessibilityLabel={ctaAccessibilityLabel ?? ctaLabel}
						activeOpacity={0.82}
						onPress={onPressCta}
						className="mt-2 self-start rounded-full bg-white"
						style={{
							minHeight: 38,
							paddingHorizontal: 20,
							paddingVertical: 10,
						}}
					>
						<Text
							className="font-poppins font-semibold text-[#7A5A12]"
							style={{
								fontSize: 12,
								lineHeight: 16,
								includeFontPadding: false,
							}}
						>
							{ctaLabel}
						</Text>
					</TouchableOpacity>
				) : null}
			</View>
		</View>
	);
}

export { WarningBanner };
