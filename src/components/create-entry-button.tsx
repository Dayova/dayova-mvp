import { useRouter } from "expo-router";
import { useState } from "react";
import { TouchableOpacity } from "react-native";
import { CreateTypePickerModal } from "~/components/create-type-picker-modal";
import { CreateEntryIcon } from "~/components/ui/create-entry-icon";
import { ROUTES, withReturnTo } from "~/lib/routes";

export function CreateEntryButton({ returnTo }: { returnTo: string }) {
	const router = useRouter();
	const [showPicker, setShowPicker] = useState(false);
	return (
		<>
			<TouchableOpacity
				accessibilityRole="button"
				accessibilityLabel="Eintrag hinzufügen"
				accessibilityHint="Wähle zwischen Prüfung und Hausaufgabe."
				activeOpacity={0.88}
				onPress={() => setShowPicker(true)}
				className="h-12 w-12 items-center justify-center rounded-full border border-border bg-card"
			>
				<CreateEntryIcon />
			</TouchableOpacity>
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
