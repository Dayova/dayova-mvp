import {
	BottomSheetBackdrop,
	type BottomSheetBackdropProps,
	BottomSheetModal,
	BottomSheetScrollView,
	BottomSheetView,
} from "@gorhom/bottom-sheet";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CloseButton } from "~/components/ui/close-button";
import { Text } from "~/components/ui/text";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { useDayovaTheme } from "~/lib/theme";
import { cn } from "~/lib/utils";

const MAX_SHEET_WIDTH = 560;

type DayovaSheetSize = "content" | "medium" | "large";

type DayovaSheetFrameProps = {
	visible: boolean;
	onClose: () => void;
	onDismiss?: () => void;
	title?: ReactNode;
	description?: ReactNode;
	children?: ReactNode;
	footer?: ReactNode;
	size?: DayovaSheetSize;
	dismissible?: boolean;
	showCloseButton?: boolean;
	scrollable?: boolean;
	closeAccessibilityLabel?: string;
	contentClassName?: string;
	headerClassName?: string;
	footerClassName?: string;
	maxWidth?: number;
};

function DayovaSheetFrame({
	visible,
	onClose,
	onDismiss,
	title,
	description,
	children,
	footer,
	size = "content",
	dismissible = true,
	showCloseButton = true,
	scrollable = false,
	closeAccessibilityLabel = "Dialog schließen",
	contentClassName,
	headerClassName,
	footerClassName,
	maxWidth = MAX_SHEET_WIDTH,
}: DayovaSheetFrameProps) {
	const sheetRef = useRef<BottomSheetModal>(null);
	const visibleRef = useRef(visible);
	const wasPresentedRef = useRef(false);
	const insets = useSafeAreaInsets();
	const { colors, isDark } = useDayovaTheme();
	const { height: windowHeight, width: windowWidth } = useWindowDimensions();
	const sheetWidth = Math.min(windowWidth, maxWidth);
	const maximumHeight = Math.max(
		240,
		Math.min(windowHeight - insets.top - 20, 720),
	);
	const fixedHeight =
		size === "large"
			? Math.min(maximumHeight, windowHeight * 0.86)
			: Math.min(maximumHeight, windowHeight * 0.68, 560);
	const snapPoints = useMemo(
		() => (size === "content" ? undefined : [fixedHeight]),
		[fixedHeight, size],
	);

	useEffect(() => {
		visibleRef.current = visible;
	}, [visible]);

	useEffect(() => {
		if (visible) {
			const frame = requestAnimationFrame(() => {
				wasPresentedRef.current = true;
				sheetRef.current?.present();
			});

			return () => cancelAnimationFrame(frame);
		}

		if (wasPresentedRef.current) sheetRef.current?.dismiss();
	}, [visible]);

	const dismiss = useCallback(() => {
		if (!dismissible) return;
		sheetRef.current?.dismiss();
	}, [dismissible]);

	const handleDismiss = useCallback(() => {
		wasPresentedRef.current = false;
		if (visibleRef.current) onClose();
		onDismiss?.();
	}, [onClose, onDismiss]);

	const renderBackdrop = useCallback(
		(props: BottomSheetBackdropProps) => (
			<BottomSheetBackdrop
				{...props}
				appearsOnIndex={0}
				disappearsOnIndex={-1}
				opacity={isDark ? 0.62 : 0.28}
				pressBehavior={dismissible ? "close" : "none"}
			/>
		),
		[dismissible, isDark],
	);

	const canShowCloseButton = showCloseButton && dismissible;
	const hasHeader = Boolean(title || description || canShowCloseButton);
	const content = (
		<View
			className={cn(
				"bg-card px-6 pt-1",
				size !== "content" && !scrollable && "flex-1",
			)}
			style={{ paddingBottom: Math.max(insets.bottom + 20, 32) }}
		>
			{hasHeader ? (
				<View className={cn("mb-6 gap-3", headerClassName)}>
					<View className="min-h-10 flex-row items-start gap-4">
						{title ? (
							<Text className="flex-1 pt-1 font-poppins font-semibold text-body-1 text-text">
								{title}
							</Text>
						) : (
							<View className="flex-1" />
						)}
						{canShowCloseButton ? (
							<CloseButton
								accessibilityLabel={closeAccessibilityLabel}
								onPress={dismiss}
							/>
						) : null}
					</View>
					{description ? (
						<Text className="font-poppins text-body-3 text-secondary-text">
							{description}
						</Text>
					) : null}
				</View>
			) : null}
			{children ? (
				<View
					className={cn(
						size !== "content" && !scrollable && "flex-1",
						contentClassName,
					)}
				>
					{children}
				</View>
			) : null}
			{footer ? (
				<View className={cn(children ? "mt-6" : "", footerClassName)}>
					{footer}
				</View>
			) : null}
		</View>
	);

	return (
		<BottomSheetModal
			ref={sheetRef}
			android_keyboardInputMode="adjustResize"
			backgroundStyle={{ backgroundColor: colors.surface }}
			backdropComponent={renderBackdrop}
			enableDynamicSizing={size === "content"}
			enablePanDownToClose={dismissible}
			handleIndicatorStyle={{
				backgroundColor: colors.border,
				height: 4,
				width: 44,
			}}
			keyboardBehavior="interactive"
			keyboardBlurBehavior="restore"
			maxDynamicContentSize={maximumHeight}
			onDismiss={handleDismiss}
			snapPoints={snapPoints}
			style={{
				alignSelf: "center",
				borderTopLeftRadius: DAYOVA_DESIGN_SYSTEM.radius.rectangle,
				borderTopRightRadius: DAYOVA_DESIGN_SYSTEM.radius.rectangle,
				overflow: "hidden",
				width: sheetWidth,
			}}
		>
			{scrollable ? (
				<BottomSheetScrollView
					bounces={false}
					keyboardShouldPersistTaps="handled"
					nestedScrollEnabled
					showsVerticalScrollIndicator={false}
					style={{ flex: 1 }}
				>
					{content}
				</BottomSheetScrollView>
			) : (
				<BottomSheetView style={size !== "content" ? { flex: 1 } : undefined}>
					{content}
				</BottomSheetView>
			)}
		</BottomSheetModal>
	);
}

export { DayovaSheetFrame };
