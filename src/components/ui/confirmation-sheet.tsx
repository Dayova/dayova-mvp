import type { ReactNode } from "react";
import { ActivityIndicator, View } from "react-native";
import { Button } from "~/components/ui/button";
import { DayovaSheetFrame } from "~/components/ui/dayova-sheet-frame";
import { Text } from "~/components/ui/text";
import { WarningBanner } from "~/components/ui/warning-banner";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { useDayovaTheme } from "~/lib/theme";

type ConfirmationSheetProps = {
	visible: boolean;
	title: ReactNode;
	description: ReactNode;
	confirmLabel: string;
	onConfirm: () => void;
	onClose: () => void;
	cancelLabel?: string;
	isBusy?: boolean;
	errorMessage?: string | null;
	confirmTone?: "primary" | "destructive";
	closeAccessibilityLabel?: string;
};

function ConfirmationSheet({
	visible,
	title,
	description,
	confirmLabel,
	onConfirm,
	onClose,
	cancelLabel = "Abbrechen",
	isBusy = false,
	errorMessage,
	confirmTone = "destructive",
	closeAccessibilityLabel = "Bestätigung schließen",
}: ConfirmationSheetProps) {
	const { colors } = useDayovaTheme();
	const safeClose = () => {
		if (!isBusy) onClose();
	};

	return (
		<DayovaSheetFrame
			visible={visible}
			title={title}
			description={description}
			onClose={safeClose}
			dismissible={!isBusy}
			closeAccessibilityLabel={closeAccessibilityLabel}
		>
			{errorMessage ? (
				<WarningBanner
					accessibilityLiveRegion="polite"
					accessibilityRole="alert"
					className="mb-5"
					title="Das hat nicht geklappt"
					description={errorMessage}
				/>
			) : null}
			<View className="flex-row gap-3">
				<Button
					accessibilityLabel={cancelLabel}
					className="flex-1 shadow-none"
					disabled={isBusy}
					onPress={safeClose}
					variant="neutral"
				>
					<Text>{cancelLabel}</Text>
				</Button>
				<Button
					accessibilityLabel={
						isBusy ? `${confirmLabel}, wird ausgeführt` : confirmLabel
					}
					accessibilityLiveRegion={isBusy ? "polite" : undefined}
					accessibilityState={{ busy: isBusy, disabled: isBusy }}
					className="flex-1"
					disabled={isBusy}
					onPress={onConfirm}
					variant={confirmTone === "destructive" ? "destructive" : "default"}
				>
					{isBusy ? (
						<ActivityIndicator
							color={
								confirmTone === "destructive"
									? colors.background
									: DAYOVA_DESIGN_SYSTEM.colors.light1
							}
						/>
					) : (
						<Text>{confirmLabel}</Text>
					)}
				</Button>
			</View>
		</DayovaSheetFrame>
	);
}

export { ConfirmationSheet };
