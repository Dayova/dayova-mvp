import { Pressable, View } from "react-native";
import { Plus } from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
import { useDayovaTheme } from "~/lib/theme";

export function AddOptionButton({
	label,
	onPress,
}: {
	label: string;
	onPress: () => void;
}) {
	const { colors } = useDayovaTheme();
	return (
		<Pressable
			accessibilityLabel={label}
			accessibilityRole="button"
			className="min-h-16 flex-row items-center gap-4 rounded-[22px] border border-primary/50 border-dashed bg-card px-5 py-3 active:opacity-80"
			onPress={onPress}
		>
			<View className="h-9 w-9 items-center justify-center rounded-full bg-accent">
				<Plus size={20} color={colors.primary} strokeWidth={2.2} />
			</View>
			<Text className="flex-1 font-poppins font-semibold text-body-2 text-primary">
				{label}
			</Text>
		</Pressable>
	);
}
