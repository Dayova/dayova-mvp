import { View } from "react-native";
import {
	SelectionBadge,
	SelectionControl,
	SelectionIndicator,
} from "~/components/ui/selection-control";
import { Text } from "~/components/ui/text";
import type { SessionContentItem } from "~/features/learning-plans/types";

export function ChoiceList({
	item,
	selectedChoiceId,
	onSelect,
	disabled,
}: {
	item: Pick<SessionContentItem, "id" | "choices">;
	selectedChoiceId: string | null;
	onSelect: (choiceId: string) => void;
	disabled: boolean;
}) {
	return (
		<View className="mt-5 gap-2" accessibilityRole="radiogroup">
			{item.choices.map((choice, index) => (
				<ChoiceCard
					key={`${item.id}:${choice.id}`}
					label={String.fromCharCode(65 + index)}
					text={choice.text}
					selected={selectedChoiceId === choice.id}
					disabled={disabled}
					onSelect={() => onSelect(choice.id)}
				/>
			))}
		</View>
	);
}

function ChoiceCard({
	label,
	text,
	selected,
	disabled,
	onSelect,
}: {
	label: string;
	text: string;
	selected: boolean;
	disabled: boolean;
	onSelect: () => void;
}) {
	return (
		<SelectionControl
			selected={selected}
			disabled={disabled}
			accessibilityLabel={`${label}. ${text}`}
			onPress={onSelect}
			contentClassName="min-h-14 flex-row items-center gap-3 border-hairline px-4 py-3 shadow-black/5 shadow-sm"
		>
			<SelectionBadge>{label}</SelectionBadge>
			<Text className="flex-1 font-poppins text-body-3 text-text">{text}</Text>
			<SelectionIndicator />
		</SelectionControl>
	);
}
