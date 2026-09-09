import type { ReactNode } from "react";
import { View } from "react-native";
import { ArrowRight } from "~/components/ui/icon";
import { ListRow } from "~/components/ui/list-row";
import { Surface } from "~/components/ui/surface";
import { Text } from "~/components/ui/text";
import { useDayovaTheme } from "~/lib/theme";

function SettingsRow({
	icon,
	label,
	trailing,
	onPress,
	disabled = false,
	busy = false,
	showDisclosure = true,
	destructive = false,
	accessibilityLabel,
}: {
	icon: (props: {
		size?: number;
		color?: string;
		strokeWidth?: number;
	}) => React.JSX.Element;
	label: string;
	trailing?: React.JSX.Element;
	onPress?: () => void;
	disabled?: boolean;
	busy?: boolean;
	showDisclosure?: boolean;
	destructive?: boolean;
	accessibilityLabel?: string;
}) {
	const Icon = icon;
	const { colors } = useDayovaTheme();
	return (
		<ListRow
			accessibilityLabel={accessibilityLabel}
			icon={
				<Icon
					size={22}
					color={destructive ? colors.destructive : colors.text}
					strokeWidth={2}
				/>
			}
			label={label}
			tone={destructive ? "destructive" : "default"}
			onPress={onPress}
			disabled={disabled}
			accessibilityState={{
				busy,
				disabled,
			}}
			className="rounded-3xl bg-transparent px-3 shadow-none"
			trailing={
				trailing ??
				(onPress && showDisclosure ? (
					<ArrowRight size={18} color={colors.secondaryText} strokeWidth={2} />
				) : undefined)
			}
			variant="flat"
		/>
	);
}

function SettingsDivider() {
	return <View className="mx-4 h-px bg-border" />;
}

function SettingsSection({
	children,
	title,
}: {
	children: ReactNode;
	title: string;
}) {
	return (
		<View className="gap-2">
			<Text
				accessibilityRole="header"
				className="px-4 font-poppins font-semibold text-body-4 text-secondary-text"
			>
				{title}
			</Text>
			<Surface className="overflow-hidden p-2">{children}</Surface>
		</View>
	);
}

export { SettingsDivider, SettingsRow, SettingsSection };
