import {
	ActionSheet,
	actionSheetIconColor,
} from "~/components/ui/action-sheet";
import { Backpack, GraduationCap } from "~/components/ui/icon";

type CreateType = "homework" | "exam";

type CreateTypePickerModalProps = {
	visible: boolean;
	onRequestClose: () => void;
	onSelect: (type: CreateType) => void;
};

const CREATE_TYPE_OPTIONS = [
	{
		type: "exam",
		title: "Neue Prüfung",
		description: "Datum, Fach und Prüfungsart eintragen.",
		icon: GraduationCap,
		iconSize: 28,
	},
	{
		type: "homework",
		title: "Neue Hausaufgabe",
		description: "Fälligkeit, Fach und Lernzeit planen.",
		icon: Backpack,
		iconSize: 28,
	},
] as const;

function CreateTypePickerModal({
	visible,
	onRequestClose,
	onSelect,
}: CreateTypePickerModalProps) {
	return (
		<ActionSheet
			visible={visible}
			title="Was möchtest du planen?"
			description="Wähle aus, ob du Hausaufgaben eintragen oder einen Test erstellen möchtest."
			onClose={onRequestClose}
			closeAccessibilityLabel="Auswahl schließen"
			onSelect={onSelect}
			options={CREATE_TYPE_OPTIONS.map(
				({ type, title, description, icon: Icon, iconSize }) => ({
					value: type,
					title,
					description,
					icon: (
						<Icon
							size={iconSize}
							color={actionSheetIconColor}
							strokeWidth={1.8}
						/>
					),
				}),
			)}
		/>
	);
}

export { CreateTypePickerModal };
