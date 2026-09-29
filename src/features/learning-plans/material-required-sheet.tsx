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
		? `Lade mindestens eine Schulunterlage für ${formattedSubject} hoch, damit Dayova den Lernplan auf deinem Unterricht aufbauen kann.`
		: "Lade mindestens eine Schulunterlage hoch, damit Dayova den Lernplan auf deinem Unterricht aufbauen kann.";
	const topicInstruction =
		requiredTopics.length > 0
			? `\n\nDeine Unterlage sollte zu diesen Prüfungsthemen passen:\n${requiredTopics
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
			description={`${subjectInstruction}${topicInstruction}\n\nDayova bestimmt nicht, welches Dokument dir fehlt. Ohne eine Schulunterlage startet die Analyse noch nicht.`}
			maxWidth={760}
			onClose={onClose}
			onConfirm={onUpload}
			scrollable
			title="Schulmaterial fehlt"
			visible={subject !== null}
		/>
	);
}
