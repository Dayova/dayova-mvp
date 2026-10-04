import { useRouter } from "expo-router";
import { useState } from "react";
import { TouchableOpacity } from "react-native";
import { CreateTypePickerModal } from "~/components/create-type-picker-modal";
import { Plus } from "~/components/ui/icon";
import { ROUTES, withReturnTo } from "~/lib/routes";
import { useDayovaTheme } from "~/lib/theme";
import { useFeatureAnalytics } from "~/lib/use-feature-analytics";

export function CreateEntryButton({ returnTo }: { returnTo: string }) {
	const trackFeature = useFeatureAnalytics();
	const router = useRouter();
	const { colors } = useDayovaTheme();
	const [showPicker, setShowPicker] = useState(false);
	return (
		<>
			<TouchableOpacity
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
				<Plus size={28} color={colors.primary} strokeWidth={1.8} />
			</TouchableOpacity>
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
