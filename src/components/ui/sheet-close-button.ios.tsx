import { NativeNavigationIconButton } from "~/components/ui/native-navigation-icon-button.ios";
import type { SheetCloseButtonProps } from "~/components/ui/sheet-close-button";

export function SheetCloseButton(props: SheetCloseButtonProps) {
	return <NativeNavigationIconButton kind="close" {...props} />;
}
