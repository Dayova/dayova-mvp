import {
	BottomSheetBackdrop,
	type BottomSheetBackdropProps,
	BottomSheetModal,
	BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
	Pressable,
	TouchableOpacity,
	useWindowDimensions,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check } from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { cn } from "~/lib/utils";

type SelectSheetProps<T extends string | number> = {
	visible: boolean;
	title: string;
	options: readonly T[];
	selectedValue: T | "";
	onSelect: (value: T) => void;
	onClose: () => void;
	formatOptionLabel?: (option: T) => string;
	renderOptionIcon?: (option: T, isSelected: boolean) => ReactNode;
};

function SelectSheet<T extends string | number>({
	visible,
	title,
	options,
	selectedValue,
	onSelect,
	onClose,
	formatOptionLabel,
	renderOptionIcon,
}: SelectSheetProps<T>) {
	const sheetRef = useRef<BottomSheetModal>(null);
	const insets = useSafeAreaInsets();
	const { height: windowHeight } = useWindowDimensions();

	const sheetMaxHeight = Math.min(windowHeight * 0.68, 560);
	const snapPoints = useMemo(() => [sheetMaxHeight], [sheetMaxHeight]);

	useEffect(() => {
		if (!visible) return;

		const frame = requestAnimationFrame(() => {
			sheetRef.current?.present();
		});

		return () => cancelAnimationFrame(frame);
	}, [visible]);

	const dismiss = useCallback(() => {
		sheetRef.current?.dismiss();
	}, []);

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

	if (!visible) return null;

	return (
		<BottomSheetModal
			ref={sheetRef}
			// @gorhom/bottom-sheet exposes its container chrome through style-only
			// props, so these tokenized values cannot be NativeWind classes.
			backgroundStyle={{ backgroundColor: DAYOVA_DESIGN_SYSTEM.colors.surface }}
			backdropComponent={renderBackdrop}
			enableDynamicSizing={false}
			enablePanDownToClose
			handleIndicatorStyle={{
				backgroundColor: DAYOVA_DESIGN_SYSTEM.colors.border,
				width: 44,
			}}
			onDismiss={onClose}
			snapPoints={snapPoints}
		>
			<View
				className="flex-1 bg-card px-5 pt-1"
				// Safe-area padding is runtime device data.
				style={{ paddingBottom: Math.max(insets.bottom + 18, 28) }}
			>
				<View className="mb-3 w-full flex-row items-center justify-between">
					<Text className="font-poppins font-semibold text-body-2 text-text">
						{title}
					</Text>
					<TouchableOpacity
						accessibilityLabel="Auswahl schließen"
						accessibilityRole="button"
						hitSlop={8}
						onPress={dismiss}
						className="h-10 min-w-16 items-center justify-center rounded-full bg-primary/10 px-3"
					>
						<Text className="font-poppins font-semibold text-body-2 text-primary">
							Fertig
						</Text>
					</TouchableOpacity>
				</View>
				<BottomSheetScrollView
					bounces={false}
					// BottomSheetScrollView does not expose a NativeWind content
					// container class prop; this spacing is static but API-bound.
					contentContainerStyle={{ paddingBottom: 8, gap: 12 }}
					nestedScrollEnabled
					showsVerticalScrollIndicator={false}
					// Third-party scroll host needs flex applied through style.
					style={{ flex: 1 }}
				>
					{options.map((option) => {
						const isSelected = selectedValue === option;

						return (
							<Pressable
								key={option}
								onPress={() => {
									onSelect(option);
									dismiss();
								}}
								accessibilityRole="button"
								accessibilityState={{ selected: isSelected }}
								className={cn(
									"min-h-16 flex-row items-center rounded-[20px] border px-5",
									isSelected
										? "border-primary/35 bg-accent"
										: "border-foreground/10 bg-card",
								)}
							>
								{renderOptionIcon ? (
									<View className="mr-5 h-9 w-9 items-center justify-center rounded-full bg-muted">
										{renderOptionIcon(option, isSelected)}
									</View>
								) : null}
								<Text
									className={cn(
										"flex-1 font-poppins text-body-2",
										isSelected
											? "font-semibold text-primary"
											: "text-foreground",
									)}
								>
									{formatOptionLabel ? formatOptionLabel(option) : option}
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
