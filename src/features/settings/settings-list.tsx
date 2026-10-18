import type { ReactNode } from "react";
import { View } from "react-native";
import { ArrowRight } from "~/components/ui/icon";
import { ListRow } from "~/components/ui/list-row";
import { Surface } from "~/components/ui/surface";
import { Text } from "~/components/ui/text";
import { useDayovaTheme } from "~/lib/theme";
import { cn } from "~/lib/utils";

function SettingsRow({
	icon,
	label,
	description,
	trailing,
	onPress,
	disabled = false,
	busy = false,
	showDisclosure = true,
	destructive = false,
	accessibilityLabel,
	buttonRef,
	expanded = false,
}: {
	icon: (props: {
		size?: number;
		color?: string;
		strokeWidth?: number;
	}) => React.JSX.Element;
	label: string;
	description?: string;
	trailing?: React.JSX.Element;
	onPress?: () => void;
	disabled?: boolean;
	busy?: boolean;
	showDisclosure?: boolean;
	destructive?: boolean;
	accessibilityLabel?: string;
	buttonRef?: React.ComponentProps<typeof ListRow>["ref"];
	expanded?: boolean;
}) {
	const Icon = icon;
	const { colors } = useDayovaTheme();
	return (
		<ListRow
			ref={buttonRef}
			accessibilityLabel={accessibilityLabel}
			icon={
				<Icon
					size={expanded ? 26 : 22}
					color={destructive ? colors.destructive : colors.text}
					strokeWidth={2}
				/>
			}
			iconContainerClassName={expanded ? "h-14 w-14 mr-4" : undefined}
			labelClassName={expanded ? "text-body-1" : undefined}
			label={label}
			description={description}
			tone={destructive ? "destructive" : "default"}
			onPress={onPress}
			disabled={disabled}
			accessibilityState={{
				busy,
				disabled,
			}}
			className={cn(
				"rounded-3xl bg-transparent px-3 shadow-none",
				expanded && "min-h-20 px-5 py-4",
			)}
			trailing={
				trailing ??
				(onPress && showDisclosure ? (
					<ArrowRight
						size={expanded ? 20 : 18}
						color={colors.secondaryText}
						strokeWidth={2}
					/>
				) : undefined)
			}
			variant="flat"
		/>
	);
}

function SettingsDivider() {
	return <View className="mx-4 h-px bg-border" />;
}

function SettingsCard({
	children,
	expanded = false,
}: {
	children: ReactNode;
	expanded?: boolean;
}) {
	return (
		<Surface
			className={cn(
				"overflow-hidden border border-border p-2",
				expanded && "p-3",
			)}
		>
			{children}
		</Surface>
	);
}

function SettingsSection({
	children,
	expanded = false,
	title,
}: {
	children: ReactNode;
	title: string;
	expanded?: boolean;
}) {
	return (
		<View className={expanded ? "gap-3" : "gap-2"}>
			<Text
				accessibilityRole="header"
				className={cn(
					"px-4 font-poppins font-semibold text-body-4 text-secondary-text",
					expanded && "px-5 text-body-3",
				)}
			>
				{title}
			</Text>
			<SettingsCard expanded={expanded}>{children}</SettingsCard>
		</View>
	);
}

export { SettingsCard, SettingsDivider, SettingsRow, SettingsSection };
