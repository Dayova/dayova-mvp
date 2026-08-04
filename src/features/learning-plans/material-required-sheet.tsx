import { ConfirmationSheet } from "~/components/ui/confirmation-sheet";
import { formatGermanUiText } from "~/lib/german-ui-text";

type MaterialRequiredSheetProps = {
	onClose: () => void;
	onUpload: () => void;
	subject: string | null;
};

export function MaterialRequiredSheet({
	onClose,
	onUpload,
	subject,
}: MaterialRequiredSheetProps) {
	const formattedSubject = subject ? formatGermanUiText(subject) : null;

	return (
		<ConfirmationSheet
			cancelLabel="Später"
			closeAccessibilityLabel="Materialhinweis schließen"
			confirmLabel="Material hochladen"
			confirmTone="primary"
			description={
				formattedSubject
					? `Lade mindestens eine Schulunterlage für ${formattedSubject} hoch. Danach kann Dayova deinen Lernplan erstellen.`
					: "Lade mindestens eine Schulunterlage hoch. Danach kann Dayova deinen Lernplan erstellen."
			}
			onClose={onClose}
			onConfirm={onUpload}
			title="Für diesen Lernplan fehlt Material"
			visible={subject !== null}
		/>
	);
}
