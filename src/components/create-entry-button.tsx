import { useRouter } from "expo-router";
import { useState } from "react";
import { CreateTypePickerModal } from "~/components/create-type-picker-modal";
import { CreateEntryIcon } from "~/components/ui/create-entry-icon";
import { FeedbackTouchableOpacity } from "~/components/ui/feedback-pressable";
import { ROUTES, withReturnTo } from "~/lib/routes";

export function CreateEntryButton({ returnTo }: { returnTo: string }) {
	const router = useRouter();
	const [showPicker, setShowPicker] = useState(false);
	return (
		<>
			<FeedbackTouchableOpacity
				accessibilityRole="button"
				accessibilityLabel="Eintrag hinzufügen"
				accessibilityHint="Wähle zwischen Prüfung und Hausaufgabe."
				activeOpacity={0.88}
				onPress={() => setShowPicker(true)}
				className="h-12 w-12 items-center justify-center rounded-full border border-border bg-card"
			>
				<CreateEntryIcon />
			</FeedbackTouchableOpacity>
			<CreateTypePickerModal
				visible={showPicker}
				onRequestClose={() => setShowPicker(false)}
				onSelect={(type) => {
					setShowPicker(false);
					router.push(
						withReturnTo(
							type === "homework" ? ROUTES.createHomework : ROUTES.createExam,
							returnTo,
						),
					);
				}}
			/>
		</>
	);
}
