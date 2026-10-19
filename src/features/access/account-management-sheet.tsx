import type { ComponentProps } from "react";
import { View } from "react-native";
import { Button } from "~/components/ui/button";
import { DayovaSheetFrame } from "~/components/ui/dayova-sheet-frame";
import { useContentSizeLayout } from "~/components/ui/portrait-content";
import { Text } from "~/components/ui/text";
import { cn } from "~/lib/utils";

type AccountManagementSheetProps = Pick<
	ComponentProps<typeof DayovaSheetFrame>,
	"visible" | "onClose" | "onDismiss" | "returnFocusRef"
> & {
	onSwitchAccount: () => void;
	onDeleteAccount: () => void;
};

/** Account choices use popup actions; callers defer effects until dismissal. */
export function AccountManagementSheet({
	onSwitchAccount,
	onDeleteAccount,
	...props
}: AccountManagementSheetProps) {
	const { shouldStackInlineContent } = useContentSizeLayout();
	const actionClassName = shouldStackInlineContent
		? "w-full"
		: "min-w-0 flex-1 basis-0 px-3";

	return (
		<DayovaSheetFrame
			{...props}
			title="Konto verwalten"
			description="Hier kannst du dein Dayova-Konto wechseln oder löschen. Store-Abos verwaltest du direkt in deinem Store."
			closeAccessibilityLabel="Kontoverwaltung schließen"
		>
			<View
				className={cn(
					"gap-3",
					!shouldStackInlineContent && "flex-row items-stretch",
				)}
			>
				<Button
					variant="cancel"
					className={actionClassName}
					accessibilityLabel="Abmelden oder Konto wechseln"
					onPress={onSwitchAccount}
				>
					<Text className="shrink text-center">Konto wechseln</Text>
				</Button>
				<Button
					variant="destructive"
					className={actionClassName}
					onPress={onDeleteAccount}
				>
					<Text className="shrink text-center">Konto löschen</Text>
				</Button>
			</View>
		</DayovaSheetFrame>
	);
}
