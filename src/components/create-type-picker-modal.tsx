import {
	BottomModal,
	BottomModalOption,
	bottomModalIconColor,
} from "~/components/ui/bottom-modal";
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
		<BottomModal
			visible={visible}
			title="Was möchtest du planen?"
			description="Wähle aus, ob du Hausaufgaben eintragen oder einen Test erstellen möchtest."
			onClose={onRequestClose}
			closeAccessibilityLabel="Auswahl schließen"
			contentClassName="gap-4"
		>
			{CREATE_TYPE_OPTIONS.map(
				({ type, title, description, icon: Icon, iconSize }) => (
					<BottomModalOption
						key={type}
						icon={
							<Icon
								size={iconSize}
								color={bottomModalIconColor}
								strokeWidth={1.8}
							/>
						}
						title={title}
						description={description}
						onPress={() => onSelect(type)}
					/>
				),
			)}
		</BottomModal>
	);
}

export { CreateTypePickerModal };
