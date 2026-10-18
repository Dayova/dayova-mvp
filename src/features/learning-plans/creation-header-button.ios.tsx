import { NativeNavigationIconButton } from "~/components/ui/native-navigation-icon-button.ios";
import type { CreationHeaderButtonProps } from "~/features/learning-plans/creation-header-button";

export function CreationHeaderButton(props: CreationHeaderButtonProps) {
	return (
		<NativeNavigationIconButton
			{...props}
			accessibilityHint={
				props.kind === "back"
					? "Geht zum vorherigen Schritt oder Bildschirm zurück."
					: "Verlässt die Lernplan-Erstellung."
			}
		/>
	);
}
