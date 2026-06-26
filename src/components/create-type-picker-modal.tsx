import { ClipboardEdit, GraduationCap } from "~/components/ui/icon";
import { SelectSheet } from "~/components/ui/select-sheet";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";

type CreateType = "homework" | "exam";

type CreateTypePickerModalProps = {
	visible: boolean;
	onRequestClose: () => void;
	onSelect: (type: CreateType) => void;
};

const CREATE_TYPE_OPTIONS = ["homework", "exam"] as const;
const CREATE_TYPE_LABELS = {
	homework: "Hausaufgabe",
	exam: "Prüfung",
} satisfies Record<CreateType, string>;

function CreateTypePickerModal({
	visible,
	onRequestClose,
	onSelect,
}: CreateTypePickerModalProps) {
	return (
		<SelectSheet
			visible={visible}
			title="Was möchtest du erstellen?"
			options={CREATE_TYPE_OPTIONS}
			selectedValue=""
			onClose={onRequestClose}
			onSelect={onSelect}
			formatOptionLabel={(option) => CREATE_TYPE_LABELS[option]}
			renderOptionIcon={(option) => {
				const Icon = option === "homework" ? ClipboardEdit : GraduationCap;

				return (
					<Icon
						size={19}
						color={DAYOVA_DESIGN_SYSTEM.colors.primary}
						strokeWidth={2}
					/>
				);
			}}
		/>
	);
}

export { CreateTypePickerModal };
