import type { ReactNode } from "react";
import { ActivityIndicator, View } from "react-native";
import { Button } from "~/components/ui/button";
import { DayovaSheetFrame } from "~/components/ui/dayova-sheet-frame";
import { useContentSizeLayout } from "~/components/ui/portrait-content";
import { Text } from "~/components/ui/text";
import { WarningBanner } from "~/components/ui/warning-banner";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { useDayovaTheme } from "~/lib/theme";
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
};

function ConfirmationPresentation({
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
	embedded = false,
}: ConfirmationSheetProps & { embedded?: boolean }) {
	const { colors } = useDayovaTheme();
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
			className={
				actionLayout === "stacked" ? "w-full" : "min-w-0 flex-1 basis-0 px-3"
			}
			disabled={isBusy}
			onPress={onConfirm}
			variant={confirmTone === "destructive" ? "destructive" : "default"}
		>
			{isBusy ? (
				<ActivityIndicator
					color={
						confirmTone === "destructive"
							? colors.dangerAction
							: DAYOVA_DESIGN_SYSTEM.colors.light1
					}
				/>
			) : (
				<Text className="shrink text-center">{confirmLabel}</Text>
			)}
		</Button>
	);
	const cancelButton = (
		<Button
			accessibilityLabel={cancelLabel}
			className={cn(
				"shadow-none",
				actionLayout === "stacked" ? "w-full" : "min-w-0 flex-1 basis-0 px-3",
			)}
			disabled={isBusy}
			onPress={safeClose}
			variant="cancel"
		>
			<Text className="shrink text-center">{cancelLabel}</Text>
		</Button>
	);
	const actions = (
		<View
			testID="confirmation-actions"
			className={cn(
				"gap-3",
				actionLayout === "inline" && "flex-row items-stretch",
			)}
		>
			{actionLayout === "stacked" ? confirmButton : cancelButton}
			{actionLayout === "stacked" ? cancelButton : confirmButton}
		</View>
	);
	const error = errorMessage ? (
		<WarningBanner
			accessibilityLiveRegion="polite"
			accessibilityRole="alert"
			className={scrollable ? undefined : "mb-5"}
			title="Das hat nicht geklappt"
			description={errorMessage}
		/>
	) : null;

	if (embedded) {
		return (
			<View className="gap-6">
				{description ? (
					<Text className="font-poppins text-body-3 text-secondary-text">
						{description}
					</Text>
				) : null}
				{error}
				{actions}
			</View>
		);
	}
	return (
		<DayovaSheetFrame
			visible={visible}
			title={title}
			description={description}
			onClose={safeClose}
			dismissible={!isBusy}
			closeAccessibilityLabel={closeAccessibilityLabel}
			contentClassName={scrollable ? "gap-6" : undefined}
			footer={scrollable ? actions : undefined}
			maxWidth={maxWidth}
			scrollable={scrollable}
		>
			{error}
			{scrollable ? null : actions}
		</DayovaSheetFrame>
	);
}

function ConfirmationSheet(props: ConfirmationSheetProps) {
	return <ConfirmationPresentation {...props} />;
}

/** Confirmation inside an already presented sheet; keeps its backdrop mounted. */
function ConfirmationSheetContent(
	props: Omit<ConfirmationSheetProps, "visible" | "title">,
) {
	return <ConfirmationPresentation {...props} visible title={null} embedded />;
}

export { ConfirmationSheet, ConfirmationSheetContent };
