import { BackButton } from "~/components/ui/button";
import { CloseButton } from "~/components/ui/close-button";

export type CreationHeaderButtonProps = {
	kind: "back" | "close";
	onPress: () => void;
	disabled?: boolean;
};

export function CreationHeaderButton({
	kind,
	onPress,
	disabled = false,
}: CreationHeaderButtonProps) {
	return kind === "back" ? (
		<BackButton onPress={onPress} disabled={disabled} />
	) : (
		<CloseButton
			onPress={onPress}
			disabled={disabled}
			accessibilityHint="Verlässt die Lernplan-Erstellung."
		/>
	);
}
