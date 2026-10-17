import { useRouter } from "expo-router";
import { useState } from "react";
import { CreateTypePickerModal } from "~/components/create-type-picker-modal";
import { CreateEntryIcon } from "~/components/ui/create-entry-icon";
import { FeedbackTouchableOpacity } from "~/components/ui/feedback-pressable";
import { ROUTES, withReturnTo } from "~/lib/routes";
import { useFeatureAnalytics } from "~/lib/use-feature-analytics";

export function CreateEntryButton({ returnTo }: { returnTo: string }) {
	const trackFeature = useFeatureAnalytics();
	const router = useRouter();
	const [showPicker, setShowPicker] = useState(false);
	return (
		<>
			<FeedbackTouchableOpacity
				pressScale={0.92}
				accessibilityRole="button"
				accessibilityLabel="Eintrag hinzufügen"
				accessibilityHint="Wähle zwischen Prüfung und Hausaufgabe."
				activeOpacity={0.88}
				onPress={() => {
					trackFeature("home.create_opened");
					setShowPicker(true);
				}}
				className="h-12 w-12 items-center justify-center rounded-full border border-border bg-card"
			>
				<CreateEntryIcon />
			</FeedbackTouchableOpacity>
			<CreateTypePickerModal
				visible={showPicker}
				onRequestClose={() => setShowPicker(false)}
				onSelect={(type) => {
					trackFeature(
						type === "exam"
							? "home.create_exam_selected"
							: "home.create_homework_selected",
					);
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
