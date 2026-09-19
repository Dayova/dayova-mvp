import type { ReactNode } from "react";
import { ActivityIndicator, View } from "react-native";
import { Button } from "~/components/ui/button";
import { DayovaSheetFrame } from "~/components/ui/dayova-sheet-frame";
import { useContentSizeLayout } from "~/components/ui/portrait-content";
import { Text } from "~/components/ui/text";
import { WarningBanner } from "~/components/ui/warning-banner";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { cn } from "~/lib/utils";

type ConfirmationActionLayout = "inline" | "stacked";

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
	actionLayout?: ConfirmationActionLayout;
	maxWidth?: number;
	scrollable?: boolean;
	size?: "content" | "medium";
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
	actionLayout: requestedActionLayout = "inline",
	maxWidth,
	scrollable = true,
	size = "content",
}: ConfirmationSheetProps) {
	const { shouldStackInlineContent } = useContentSizeLayout();
	const actionLayout = shouldStackInlineContent
		? "stacked"
		: requestedActionLayout;
	const safeClose = () => {
		if (!isBusy) onClose();
	};
	const confirmButton = (
		<Button
			accessibilityLabel={
				isBusy ? `${confirmLabel}, wird ausgeführt` : confirmLabel
			}
			accessibilityLiveRegion={isBusy ? "polite" : undefined}
			accessibilityState={{ busy: isBusy, disabled: isBusy }}
			className={actionLayout === "stacked" ? "w-full" : "flex-1"}
			disabled={isBusy}
			onPress={onConfirm}
			variant={confirmTone === "destructive" ? "destructive" : "default"}
		>
			{isBusy ? (
				<ActivityIndicator color={DAYOVA_DESIGN_SYSTEM.colors.light1} />
			) : (
				<Text>{confirmLabel}</Text>
			)}
		</Button>
	);
	const cancelButton = (
		<Button
			accessibilityLabel={cancelLabel}
			className={cn(
				"border border-border bg-card shadow-none",
				actionLayout === "stacked" ? "w-full" : "flex-1",
			)}
			disabled={isBusy}
			onPress={safeClose}
			variant="ghost"
		>
			<Text>{cancelLabel}</Text>
		</Button>
	);
	const actions = (
		<View className={cn("gap-3", actionLayout === "inline" && "flex-row")}>
			{actionLayout === "stacked" ? confirmButton : cancelButton}
			{actionLayout === "stacked" ? cancelButton : confirmButton}
		</View>
	);
	const error = errorMessage ? (
		<WarningBanner
			accessibilityLiveRegion="polite"
			accessibilityRole="alert"
			title="Das hat nicht geklappt"
			description={errorMessage}
		/>
	) : null;

	return (
		<DayovaSheetFrame
			visible={visible}
			title={title}
			description={description}
			onClose={safeClose}
			dismissible={!isBusy}
			closeAccessibilityLabel={closeAccessibilityLabel}
			footer={actions}
			maxWidth={maxWidth}
			scrollable={scrollable}
			size={size}
		>
			{error}
		</DayovaSheetFrame>
	);
}

export { ConfirmationSheet };
