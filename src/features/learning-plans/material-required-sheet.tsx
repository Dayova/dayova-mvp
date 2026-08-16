import { ConfirmationSheet } from "~/components/ui/confirmation-sheet";
import { formatGermanUiText } from "~/lib/german-ui-text";

type MaterialRequiredSheetProps = {
	onClose: () => void;
	onUpload: () => void;
	subject: string | null;
	topicDescription: string | null;
};

const getRequiredTopics = (topicDescription: string | null) =>
	(topicDescription ?? "")
		.split(/[\n,;•]+/u)
		.map((topic) => topic.trim())
		.filter(Boolean);

export function MaterialRequiredSheet({
	onClose,
	onUpload,
	subject,
	topicDescription,
}: MaterialRequiredSheetProps) {
	const formattedSubject = subject ? formatGermanUiText(subject) : null;
	const requiredTopics = getRequiredTopics(topicDescription);
	const subjectInstruction = formattedSubject
		? `Lade mindestens eine Schulunterlage für ${formattedSubject} hoch.`
		: "Lade mindestens eine Schulunterlage hoch.";
	const topicInstruction =
		requiredTopics.length > 0
			? `\n\nDafür brauchst du Material:\n${requiredTopics
					.map((topic) => `• ${formatGermanUiText(topic)}`)
					.join("\n")}`
			: "";

	return (
		<ConfirmationSheet
			actionLayout="stacked"
			cancelLabel="Später"
			closeAccessibilityLabel="Materialhinweis schließen"
			confirmLabel="Material hochladen"
			confirmTone="primary"
			description={`${subjectInstruction}${topicInstruction}\n\nDanach kann Dayova deinen Lernplan erstellen.`}
			onClose={onClose}
			onConfirm={onUpload}
			title="Für diesen Lernplan fehlt Material"
			visible={subject !== null}
		/>
	);
}
