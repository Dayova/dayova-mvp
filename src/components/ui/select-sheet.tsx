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
import { useContentSizeLayout } from "~/components/ui/portrait-content";
import { Text } from "~/components/ui/text";
import { useDayovaTheme } from "~/lib/theme";
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
	const { colors } = useDayovaTheme();
	const { height: windowHeight, width } = useWindowDimensions();
	const contentSizeLayout = useContentSizeLayout();
	const { shouldStackInlineContent } = contentSizeLayout;
	const sheetWidth = Math.min(width, contentSizeLayout.containerMaxWidth);

	const sheetMaxHeight = shouldStackInlineContent
		? windowHeight * 0.86
		: Math.min(windowHeight * 0.68, 560);
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
			backgroundStyle={{ backgroundColor: colors.surface }}
			backdropComponent={renderBackdrop}
			enableDynamicSizing={false}
			enablePanDownToClose
			handleIndicatorStyle={{
				backgroundColor: colors.border,
				width: 44,
			}}
			onDismiss={onClose}
			snapPoints={snapPoints}
			// Gorhom exposes the modal's measured tablet width through style only.
			style={{ alignSelf: "center", width: sheetWidth }}
		>
			<View
				className="flex-1 bg-card px-5 pt-1"
				// Safe-area padding is runtime device data.
				style={{ paddingBottom: Math.max(insets.bottom + 18, 28) }}
			>
				<View
					className={cn(
						"mb-3 w-full justify-between gap-2",
						shouldStackInlineContent
							? "items-stretch"
							: "flex-row items-center",
					)}
				>
					<Text className="font-poppins font-semibold text-body-2 text-text">
						{title}
					</Text>
					<TouchableOpacity
						accessibilityLabel="Auswahl schließen"
						accessibilityRole="button"
						hitSlop={8}
						onPress={dismiss}
						className={cn(
							"min-h-10 min-w-16 items-center justify-center rounded-full bg-primary/10 px-3 py-1",
							shouldStackInlineContent && "self-end",
						)}
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
									"min-h-16 rounded-[20px] border px-5",
									shouldStackInlineContent
										? "items-stretch gap-3 py-4"
										: "flex-row items-center",
									isSelected
										? "border-primary/35 bg-accent"
										: "border-text/10 bg-card",
								)}
							>
								{renderOptionIcon ? (
									<View
										className={cn(
											"h-9 w-9 items-center justify-center rounded-full bg-muted",
											shouldStackInlineContent ? "" : "mr-5",
										)}
									>
										{renderOptionIcon(option, isSelected)}
									</View>
								) : null}
								<Text
									className={cn(
										"font-poppins text-body-2",
										shouldStackInlineContent ? "w-full" : "flex-1",
										isSelected ? "font-semibold text-primary" : "text-text",
									)}
								>
									{formatOptionLabel ? formatOptionLabel(option) : option}
								</Text>
								{isSelected ? (
									<View
										className={cn(
											"h-7 w-7 items-center justify-center rounded-full bg-primary",
											shouldStackInlineContent ? "self-end" : "ml-4",
										)}
									>
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
