import type { ReactNode } from "react";
import { View } from "react-native";
import { Button } from "~/components/ui/button";
import { DayovaSheetFrame } from "~/components/ui/dayova-sheet-frame";
import { Bell, Mail } from "~/components/ui/icon";
import { useContentSizeLayout } from "~/components/ui/portrait-content";
import { Text } from "~/components/ui/text";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import type { PushNotificationDeliveryStatus } from "~/lib/notification-preferences";
import { cn } from "~/lib/utils";

type NotificationDeliveryInfoSheetProps = {
	visible: boolean;
	pushStatus: PushNotificationDeliveryStatus;
	onClose: () => void;
	pushAction?: {
		label: string;
		onPress: () => void;
	};
};

function StatusBadge({ label, active }: { label: string; active?: boolean }) {
	return (
		<View
			className={cn(
				"rounded-full px-3 py-1.5",
				active ? "bg-success-subtle" : "bg-muted",
			)}
		>
			<Text
				className={cn(
					"font-poppins font-semibold text-body-5",
					active ? "text-success" : "text-secondary-text",
				)}
			>
				{label}
			</Text>
		</View>
	);
}

function DeliveryInfoRow({
	icon,
	title,
	description,
	status,
}: {
	icon: ReactNode;
	title: string;
	description: string;
	status: ReactNode;
}) {
	const { shouldStackInlineContent } = useContentSizeLayout();
	return (
		<View
			className={cn(
				"min-h-20 gap-3 rounded-[24px] bg-muted px-4 py-3",
				shouldStackInlineContent ? "items-start" : "flex-row items-center",
			)}
		>
			<View className="h-11 w-11 shrink-0 items-center justify-center rounded-full bg-card">
				{icon}
			</View>
			<View className={shouldStackInlineContent ? "w-full" : "flex-1"}>
				<Text
					accessibilityRole="header"
					className="font-poppins font-semibold text-body-3 text-text"
				>
					{title}
				</Text>
				<Text className="font-poppins text-body-5 text-secondary-text">
					{description}
				</Text>
				<View className="mt-2 max-w-full self-start">{status}</View>
			</View>
		</View>
	);
}

function NotificationDeliveryInfoSheet({
	visible,
	pushStatus,
	onClose,
	pushAction,
}: NotificationDeliveryInfoSheetProps) {
	const pushStatusLabel = {
		active: "Aktiv",
		disabled: "Aus",
		checking: "Wird geprüft",
		unavailable: "Nicht verfügbar",
	}[pushStatus];

	return (
		<DayovaSheetFrame
			visible={visible}
			title="Wo erscheinen deine Mitteilungen?"
			onClose={onClose}
			closeAccessibilityLabel="Informationen zur Zustellung schließen"
			contentClassName="gap-4"
		>
			<DeliveryInfoRow
				icon={
					<Mail
						size={21}
						color={DAYOVA_DESIGN_SYSTEM.colors.primary}
						strokeWidth={2.2}
					/>
				}
				title="Dayova-Postfach"
				description="Immer in der App verfügbar"
				status={<StatusBadge label="Immer an" active />}
			/>
			<DeliveryInfoRow
				icon={
					<Bell
						size={21}
						color={DAYOVA_DESIGN_SYSTEM.colors.primary}
						strokeWidth={2.2}
					/>
				}
				title="Push-Mitteilungen"
				description="Auch außerhalb der App"
				status={
					<StatusBadge
						label={pushStatusLabel}
						active={pushStatus === "active"}
					/>
				}
			/>

			{pushStatus === "disabled" && pushAction ? (
				<Button
					accessibilityLabel={pushAction.label}
					className="mt-1 w-full"
					onPress={pushAction.onPress}
				>
					<Text className="shrink text-center">{pushAction.label}</Text>
				</Button>
			) : null}
		</DayovaSheetFrame>
	);
}

export { NotificationDeliveryInfoSheet };
