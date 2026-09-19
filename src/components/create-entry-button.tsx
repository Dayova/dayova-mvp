import { useRouter } from "expo-router";
import { useState } from "react";
import { TouchableOpacity } from "react-native";
import { CreateTypePickerModal } from "~/components/create-type-picker-modal";
import { AddIcon } from "~/components/ui/add-icon";
import { ROUTES, withReturnTo } from "~/lib/routes";
import { useFeatureAnalytics } from "~/lib/use-feature-analytics";

type CreateType = "homework" | "exam";

export function CreateEntryButton({ returnTo }: { returnTo: string }) {
	const trackFeature = useFeatureAnalytics();
	const router = useRouter();
	const [showCreateTypePicker, setShowCreateTypePicker] = useState(false);

	const selectCreateType = (type: CreateType) => {
		trackFeature(
			type === "exam"
				? "home.create_exam_selected"
				: "home.create_homework_selected",
		);
		setShowCreateTypePicker(false);
		const target =
			type === "homework" ? ROUTES.createHomework : ROUTES.createExam;
		router.push(withReturnTo(target, returnTo));
	};

	return (
		<>
			<TouchableOpacity
				accessibilityRole="button"
				accessibilityLabel="Neuen Eintrag erstellen."
				accessibilityHint="Öffnet den Eintragserstellungsdialog, um entweder eine Prüfung oder Hausaufgabe zu erstellen."
				activeOpacity={0.88}
				onPress={() => {
					trackFeature("home.create_opened");
					setShowCreateTypePicker(true);
				}}
				className="h-12 w-12 items-center justify-center rounded-full active:opacity-80"
			>
				<AddIcon emphasized />
			</TouchableOpacity>
			<CreateTypePickerModal
				visible={showCreateTypePicker}
				onRequestClose={() => setShowCreateTypePicker(false)}
				onSelect={selectCreateType}
			/>
		</>
	);
}
