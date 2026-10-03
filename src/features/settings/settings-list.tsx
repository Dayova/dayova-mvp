import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { ArrowRight } from "~/components/ui/icon";
import { ListRow } from "~/components/ui/list-row";
import { Surface } from "~/components/ui/surface";
import { Text } from "~/components/ui/text";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
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
	inverse = false,
	multiline = false,
	accessibilityLabel,
	buttonRef,
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
	inverse?: boolean;
	multiline?: boolean;
	accessibilityLabel?: string;
	buttonRef?: React.ComponentProps<typeof ListRow>["ref"];
}) {
	const Icon = icon;
	const { colors } = useDayovaTheme();
	return (
		<ListRow
			ref={buttonRef}
			accessibilityLabel={accessibilityLabel}
			icon={
				<Icon
					size={22}
					color={
						inverse ? "#FFFFFF" : destructive ? colors.destructive : colors.text
					}
					strokeWidth={2}
				/>
			}
			label={label}
			description={description}
			tone={inverse ? "inverse" : destructive ? "destructive" : "default"}
			multiline={multiline}
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
					<ArrowRight
						size={18}
						color={inverse ? "#FFFFFF" : colors.secondaryText}
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
	subscriber = false,
}: {
	children: ReactNode;
	subscriber?: boolean;
}) {
	return (
		<Surface
			className={cn(
				"overflow-hidden border p-2",
				subscriber ? "border-transparent" : "border-border",
			)}
		>
			{subscriber ? (
				<LinearGradient
					{...DAYOVA_DESIGN_SYSTEM.gradients.primaryInteractive}
					pointerEvents="none"
					// The native gradient needs concrete bounds rather than NativeWind classes.
					style={StyleSheet.absoluteFill}
				/>
			) : null}
			{children}
		</Surface>
	);
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
			<SettingsCard>{children}</SettingsCard>
		</View>
	);
}

export { SettingsCard, SettingsDivider, SettingsRow, SettingsSection };
