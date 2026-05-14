import {
	BottomSheetBackdrop,
	type BottomSheetBackdropProps,
	BottomSheetModal,
	BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import { type ReactNode, useCallback, useEffect, useMemo, useRef } from "react";
import {
	Pressable,
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
	const sheetRef = useRef<BottomSheetModal>(null);
	const insets = useSafeAreaInsets();
	const { height: windowHeight } = useWindowDimensions();

	const sheetMaxHeight = Math.min(windowHeight * 0.68, 560);
	const snapPoints = useMemo(() => [sheetMaxHeight], [sheetMaxHeight]);

	useEffect(() => {
		if (visible) {
			sheetRef.current?.present();
			return;
		}

		sheetRef.current?.dismiss();
	}, [visible]);

	const renderBackdrop = useCallback(
		(props: BottomSheetBackdropProps) => (
			<BottomSheetBackdrop
				{...props}
				appearsOnIndex={0}
				disappearsOnIndex={-1}
				opacity={0.28}
				pressBehavior="close"
			/>
		),
		[],
	);

	return (
		<BottomSheetModal
			ref={sheetRef}
			backgroundStyle={{ backgroundColor: "#FFFFFF" }}
			backdropComponent={renderBackdrop}
			enableDynamicSizing={false}
			enablePanDownToClose
			handleIndicatorStyle={{ backgroundColor: "#D7D8DE", width: 44 }}
			onDismiss={onClose}
			snapPoints={snapPoints}
		>
			<View
				className="flex-1 bg-white px-5 pt-1"
				style={{ paddingBottom: Math.max(insets.bottom + 18, 28) }}
			>
				<View className="mb-3 w-full flex-row items-center justify-between">
					<Text
						className="font-poppins font-semibold text-text"
						style={{
							fontSize: 17,
							lineHeight: 22,
							includeFontPadding: false,
						}}
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
				<BottomSheetScrollView
					bounces={false}
					contentContainerStyle={{ paddingBottom: 6, gap: 10 }}
					nestedScrollEnabled
					showsVerticalScrollIndicator={false}
					style={{ flex: 1 }}
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
				</BottomSheetScrollView>
			</View>
		</BottomSheetModal>
	);
}

export { SelectSheet };
