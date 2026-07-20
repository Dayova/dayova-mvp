import {
	BottomSheetBackdrop,
	type BottomSheetBackdropProps,
	BottomSheetModal,
	BottomSheetScrollView,
	BottomSheetView,
} from "@gorhom/bottom-sheet";
import type { ReactNode, RefObject } from "react";
import { useCallback, useEffect, useId, useMemo, useRef } from "react";
import {
	AccessibilityInfo,
	findNodeHandle,
	type AccessibilityActionEvent,
	useWindowDimensions,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CloseButton } from "~/components/ui/close-button";
import { useSheetAccessibility } from "~/components/ui/sheet-accessibility";
import { Text } from "~/components/ui/text";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { useDayovaTheme } from "~/lib/theme";
import { cn } from "~/lib/utils";

const MAX_SHEET_WIDTH = 560;

type DayovaSheetSize = "content" | "medium";
type DayovaSheetPhase = "closed" | "opening" | "closing";

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
	accessibilityLabel?: string;
	returnFocusRef?: RefObject<View | null>;
	contentClassName?: string;
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
	accessibilityLabel,
	returnFocusRef,
	contentClassName,
}: DayovaSheetFrameProps) {
	const sheetRef = useRef<BottomSheetModal>(null);
	const initialFocusRef = useRef<View>(null);
	const initialFocusFrameRef = useRef<number | null>(null);
	const didMoveFocusRef = useRef(false);
	const sheetId = useId();
	const sheetAccessibility = useSheetAccessibility();
	const setSheetOpen = sheetAccessibility?.setSheetOpen;
	const desiredVisibleRef = useRef(visible);
	const phaseRef = useRef<DayovaSheetPhase>("closed");
	const insets = useSafeAreaInsets();
	const { colors, isDark } = useDayovaTheme();
	const { height: windowHeight, width: windowWidth } = useWindowDimensions();
	const sheetWidth = Math.min(windowWidth, MAX_SHEET_WIDTH);
	const maximumHeight = Math.max(
		240,
		Math.min(windowHeight - insets.top - 20, 720),
	);
	const fixedHeight = Math.min(maximumHeight, windowHeight * 0.68, 560);
	const snapPoints = useMemo(
		() => (size === "content" ? undefined : [fixedHeight]),
		[fixedHeight, size],
	);
	const accessibleTitle =
		accessibilityLabel ?? (typeof title === "string" ? title : "Dialog");

	const moveAccessibilityFocus = useCallback(
		(target: View | null | undefined) => {
			if (!target) return;
			const reactTag = findNodeHandle(target);
			if (reactTag !== null) AccessibilityInfo.setAccessibilityFocus(reactTag);
		},
		[],
	);

	const presentIfDesired = useCallback(() => {
		if (!desiredVisibleRef.current || phaseRef.current !== "closed") return;
		phaseRef.current = "opening";
		sheetRef.current?.present();
	}, []);

	useEffect(() => {
		desiredVisibleRef.current = visible;
		if (visible) {
			if (phaseRef.current === "closing") return;
			const frame = requestAnimationFrame(presentIfDesired);

			return () => cancelAnimationFrame(frame);
		}

		if (phaseRef.current === "opening") {
			phaseRef.current = "closing";
			sheetRef.current?.dismiss();
		}
	}, [presentIfDesired, visible]);

	useEffect(
		() => () => {
			if (initialFocusFrameRef.current !== null) {
				cancelAnimationFrame(initialFocusFrameRef.current);
			}
			setSheetOpen?.(sheetId, false);
		},
		[setSheetOpen, sheetId],
	);

	const dismiss = useCallback(() => {
		if (!dismissible) return;
		sheetRef.current?.dismiss();
	}, [dismissible]);

	const handleDismiss = useCallback(() => {
		const wasControlledDismissal = phaseRef.current === "closing";
		phaseRef.current = "closed";
		didMoveFocusRef.current = false;
		setSheetOpen?.(sheetId, false);
		if (initialFocusFrameRef.current !== null) {
			cancelAnimationFrame(initialFocusFrameRef.current);
			initialFocusFrameRef.current = null;
		}
		const shouldRestoreFocus =
			!wasControlledDismissal || !desiredVisibleRef.current;
		if (shouldRestoreFocus && returnFocusRef?.current) {
			requestAnimationFrame(() => {
				moveAccessibilityFocus(returnFocusRef.current);
			});
		}
		onDismiss?.();

		if (!desiredVisibleRef.current) return;
		if (!wasControlledDismissal) {
			onClose();
			return;
		}

		requestAnimationFrame(presentIfDesired);
	}, [
		moveAccessibilityFocus,
		onClose,
		onDismiss,
		presentIfDesired,
		returnFocusRef,
		setSheetOpen,
		sheetId,
	]);

	const handleChange = useCallback(
		(index: number) => {
			if (index < 0) return;
			setSheetOpen?.(sheetId, true);
			if (didMoveFocusRef.current) return;

			didMoveFocusRef.current = true;
			initialFocusFrameRef.current = requestAnimationFrame(() => {
				moveAccessibilityFocus(initialFocusRef.current);
				initialFocusFrameRef.current = null;
			});
		},
		[moveAccessibilityFocus, setSheetOpen, sheetId],
	);

	const handleAccessibilityAction = useCallback(
		(event: AccessibilityActionEvent) => {
			if (event.nativeEvent.actionName === "escape") dismiss();
		},
		[dismiss],
	);

	const renderBackdrop = useCallback(
		(props: BottomSheetBackdropProps) => (
			<BottomSheetBackdrop
				{...props}
				accessible={false}
				importantForAccessibility="no"
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
			accessibilityActions={
				dismissible
					? [{ name: "escape", label: closeAccessibilityLabel }]
					: undefined
			}
			accessibilityViewIsModal
			importantForAccessibility="yes"
			onAccessibilityAction={handleAccessibilityAction}
			onAccessibilityEscape={dismiss}
			className={cn(
				"bg-card px-6 pt-1",
				size !== "content" && !scrollable && "flex-1",
			)}
			// Safe-area padding is runtime device data and cannot be a static utility.
			style={{ paddingBottom: Math.max(insets.bottom + 20, 32) }}
		>
			{!title ? (
				<View
					ref={initialFocusRef}
					accessible
					accessibilityLabel={accessibleTitle}
					accessibilityRole="header"
					className="absolute h-px w-px opacity-[0.01]"
					collapsable={false}
				/>
			) : null}
			{hasHeader ? (
				<View className="mb-6 gap-3">
					<View className="min-h-10 flex-row items-start gap-4">
						{title ? (
							<View
								ref={initialFocusRef}
								accessible
								accessibilityLabel={accessibleTitle}
								accessibilityRole="header"
								className="flex-1"
								collapsable={false}
							>
								<Text className="pt-1 font-poppins font-semibold text-body-1 text-text">
									{title}
								</Text>
							</View>
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
				<View className={children ? "mt-6" : undefined}>{footer}</View>
			) : null}
		</View>
	);

	return (
		// Gorhom exposes native sheet geometry and chrome through style-only props;
		// runtime width and theme colors cannot be represented by static utilities.
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
			onChange={handleChange}
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
					// Gorhom scrollables require their fill geometry through `style`.
					style={{ flex: 1 }}
				>
					{content}
				</BottomSheetScrollView>
			) : (
				<BottomSheetView
					// Gorhom views do not expose NativeWind class props.
					style={size !== "content" ? { flex: 1 } : undefined}
				>
					{content}
				</BottomSheetView>
			)}
		</BottomSheetModal>
	);
}

export { DayovaSheetFrame };
