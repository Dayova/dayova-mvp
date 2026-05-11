import type { ReactNode } from "react";
import {
	Pressable,
	ScrollView,
	TouchableOpacity,
	useWindowDimensions,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check } from "~/components/ui/icon";
import { Text } from "~/components/ui/text";

type SelectSheetProps<T extends string> = {
	visible: boolean;
	title: string;
	options: readonly T[];
	selectedValue: T | "";
	onSelect: (value: T) => void;
	onClose: () => void;
	renderOptionIcon?: (option: T, isSelected: boolean) => ReactNode;
};

function SelectSheet<T extends string>({
	visible,
	title,
	options,
	selectedValue,
	onSelect,
	onClose,
	renderOptionIcon,
}: SelectSheetProps<T>) {
	const insets = useSafeAreaInsets();
	const { height: windowHeight } = useWindowDimensions();

	if (!visible) return null;

	const sheetMaxHeight = Math.min(windowHeight * 0.68, 560);

	return (
		<View className="absolute inset-0 z-50 justify-end">
			<Pressable className="absolute inset-0 bg-black/28" onPress={onClose} />
			<View
				className="w-full rounded-t-[30px] bg-white px-5 pt-4"
				style={{
					maxHeight: sheetMaxHeight,
					paddingBottom: Math.max(insets.bottom + 18, 28),
					borderWidth: 1,
					borderColor: "rgba(17,24,39,0.06)",
					boxShadow: "0 -18px 42px rgba(17, 24, 39, 0.14)",
				}}
			>
				<View className="mb-4 items-center">
					<View className="h-1 w-11 rounded-full bg-[#D7D8DE]" />
				</View>
				<View className="mb-3 w-full flex-row items-center justify-between">
					<Text
						className="font-poppins font-semibold text-text"
						style={{ fontSize: 17, lineHeight: 22, includeFontPadding: false }}
					>
						{title}
					</Text>
					<TouchableOpacity
						accessibilityLabel="Auswahl schließen"
						accessibilityRole="button"
						hitSlop={8}
						onPress={onClose}
						className="h-10 min-w-16 items-center justify-center rounded-full px-3"
						style={{ backgroundColor: "rgba(58,123,255,0.08)" }}
					>
						<Text className="font-bold font-poppins text-16 text-primary">
							Fertig
						</Text>
					</TouchableOpacity>
				</View>
				<ScrollView
					showsVerticalScrollIndicator={false}
					contentContainerStyle={{ paddingBottom: 6, gap: 10 }}
				>
					{options.map((option) => {
						const isSelected = selectedValue === option;

						return (
							<Pressable
								key={option}
								onPress={() => {
									onSelect(option);
									onClose();
								}}
								accessibilityRole="button"
								accessibilityState={{ selected: isSelected }}
								className="min-h-[62px] flex-row items-center rounded-[20px] px-5"
								style={{
									borderWidth: 1,
									borderColor: isSelected
										? "rgba(58,123,255,0.34)"
										: "rgba(17,24,39,0.07)",
									backgroundColor: isSelected ? "#F3F7FF" : "#FFFFFF",
								}}
							>
								{renderOptionIcon ? (
									<View className="mr-5 h-9 w-9 items-center justify-center rounded-full bg-[#F4F6FA]">
										{renderOptionIcon(option, isSelected)}
									</View>
								) : null}
								<Text
									className="flex-1 font-poppins"
									style={{
										fontSize: 16,
										lineHeight: 21,
										color: isSelected ? "#3A7BFF" : "#202127",
										includeFontPadding: false,
										fontWeight: isSelected ? "600" : "400",
									}}
								>
									{option}
								</Text>
								{isSelected ? (
									<View className="ml-4 h-7 w-7 items-center justify-center rounded-full bg-primary">
										<Check size={16} color="#FFFFFF" strokeWidth={2.4} />
									</View>
								) : null}
							</Pressable>
						);
					})}
				</ScrollView>
			</View>
		</View>
	);
}

export { SelectSheet };
