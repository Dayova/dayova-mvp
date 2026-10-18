import { useRef, useState } from "react";
import { ActivityIndicator } from "react-native";
import { Button } from "~/components/ui/button";
import { ConfirmationSheet } from "~/components/ui/confirmation-sheet";
import { Text } from "~/components/ui/text";

/** Compare scheduled study with the remaining budget, after diagnostic credit. */
export function PreparationAcceptAction({
	plannedMinutes,
	recommendedMinutes,
	disabled,
	busy,
	onAccept,
}: {
	plannedMinutes: number;
	recommendedMinutes: number;
	disabled: boolean;
	busy: boolean;
	onAccept: () => Promise<void>;
}) {
	const [confirming, setConfirming] = useState(false);
	const submitting = useRef(false);
	const submit = async () => {
		if (busy || disabled || submitting.current) return;
		submitting.current = true;
		setConfirming(false);
		try {
			await onAccept();
		} finally {
			submitting.current = false;
		}
	};
	const more = plannedMinutes > recommendedMinutes;
	return (
		<>
			<Button
				disabled={disabled || busy || confirming}
				onPress={() => {
					if (plannedMinutes !== recommendedMinutes) setConfirming(true);
					else void submit();
				}}
			>
				{busy ? <ActivityIndicator color="white" /> : <Text>Übernehmen</Text>}
			</Button>
			<ConfirmationSheet
				visible={confirming}
				title={more ? "Mehr Zeit einplanen?" : "Weniger Zeit einplanen?"}
				description={`Du hast ${plannedMinutes} Minuten eingeplant. Wir empfehlen dir noch etwa ${recommendedMinutes} Minuten Lernzeit. ${more ? "Möchtest du die zusätzliche Zeit zum Üben einplanen?" : "Mit weniger Zeit bleibt möglicherweise nicht genug Raum für alle Themen. Möchtest du den kürzeren Plan übernehmen?"}`}
				confirmLabel="Übernehmen"
				cancelLabel="Anpassen"
				confirmTone="primary"
				isBusy={busy}
				onConfirm={() => void submit()}
				onClose={() => setConfirming(false)}
			/>
		</>
	);
}
