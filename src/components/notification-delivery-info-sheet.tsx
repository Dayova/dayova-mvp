import type { ReactNode } from "react";
import { View } from "react-native";
import { BottomModal } from "~/components/ui/bottom-modal";
import { Button } from "~/components/ui/button";
import { Bell, Check, Mail } from "~/components/ui/icon";
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
	return (
		<View className="min-h-20 flex-row items-center gap-3 rounded-[24px] bg-muted px-4 py-3">
			<View className="h-11 w-11 items-center justify-center rounded-full bg-card">
				{icon}
			</View>
			<View className="flex-1">
				<Text className="font-poppins font-semibold text-body-3 text-text">
					{title}
				</Text>
				<Text className="font-poppins text-body-5 text-secondary-text">
					{description}
				</Text>
			</View>
			{status}
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
		<BottomModal
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
					<Text>{pushAction.label}</Text>
				</Button>
			) : null}
		</BottomModal>
	);
}

export { NotificationDeliveryInfoSheet };
