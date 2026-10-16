import { CloseButton } from "~/components/ui/close-button";

export type SheetCloseButtonProps = {
	onPress: () => void;
	disabled?: boolean;
	accessibilityLabel?: string;
	accessibilityHint?: string;
};

export function SheetCloseButton(props: SheetCloseButtonProps) {
	return <CloseButton {...props} />;
}
