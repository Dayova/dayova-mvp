import {
	BottomSheetBackdrop,
	type BottomSheetBackdropProps,
	type BottomSheetBackgroundProps,
	BottomSheetFooter,
	type BottomSheetFooterProps,
	BottomSheetModal,
	BottomSheetScrollView,
	BottomSheetTextInput,
	BottomSheetView,
} from "@gorhom/bottom-sheet";
import { cssInterop } from "nativewind";
import type { ComponentProps, ReactNode, RefObject } from "react";
import {
	useCallback,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	type AccessibilityActionEvent,
	AccessibilityInfo,
	BackHandler,
	findNodeHandle,
	type LayoutChangeEvent,
	Platform,
	StyleSheet,
	useWindowDimensions,
	View,
} from "react-native";
import { CloseButton } from "~/components/ui/close-button";
import { Input, InputComponentContext } from "~/components/ui/input";
import { useSheetAccessibility } from "~/components/ui/sheet-accessibility";
import { useSheetSafeAreaInsets } from "~/components/ui/sheet-safe-area";
import { Text } from "~/components/ui/text";
import { getContentSizeLayout } from "~/lib/content-size-layout";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { useDayovaTheme } from "~/lib/theme";
import { cn } from "~/lib/utils";

const DEFAULT_MAX_SHEET_WIDTH = 560;
const SheetTextInput = cssInterop(BottomSheetTextInput, { className: "style" });

type DayovaSheetPhase = "closed" | "opening" | "presented" | "closing";

type DayovaSheetFrameProps = {
	visible: boolean;
	onClose: () => void;
	onDismiss?: () => void;
	onPresented?: () => void;
	title?: ReactNode;
	description?: ReactNode;
	children?: ReactNode;
	footer?: ReactNode;
	dismissible?: boolean;
	showCloseButton?: boolean;
	compactCloseButton?: boolean;
	scrollable?: boolean;
	closeAccessibilityLabel?: string;
	accessibilityLabel?: string;
	returnFocusRef?: RefObject<View | null>;
	contentClassName?: string;
	maxWidth?: number;
};

// Gorhom forwards only selected accessibility props to its native content.
// Wrap the actual portal so its scroll area AND floating footer form one modal.
function SheetModalContainer({ children }: { children?: ReactNode }) {
	return (
		<View
			accessibilityViewIsModal
			pointerEvents="box-none"
			// The third-party portal host must cover the native viewport.
			style={StyleSheet.absoluteFill}
			testID="dayova-sheet-modal"
		>
			{children}
		</View>
	);
}

function DayovaSheetFrame({
	visible,
	onClose,
	onDismiss,
	onPresented,
	title,
	description,
	children,
	footer,
	dismissible = true,
	showCloseButton = true,
	compactCloseButton = false,
	scrollable = true,
	closeAccessibilityLabel = "Dialog schließen",
	accessibilityLabel,
	returnFocusRef,
	contentClassName,
	maxWidth = DEFAULT_MAX_SHEET_WIDTH,
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
	const [isNativeSheetActive, setIsNativeSheetActive] = useState(false);
	const capturesAndroidBack = visible || isNativeSheetActive;
	const insets = useSheetSafeAreaInsets();
	const { colors, isDark } = useDayovaTheme();
	const {
		fontScale,
		height: windowHeight,
		width: windowWidth,
	} = useWindowDimensions();
	const horizontalSafeArea = Math.max(insets.left, insets.right);
	const availableSheetWidth = Math.max(windowWidth - horizontalSafeArea * 2, 0);
	const sheetWidth = Math.min(availableSheetWidth, maxWidth);
	const sheetHorizontalInset = Math.max((windowWidth - sheetWidth) / 2, 0);
	const maximumHeight = Math.max(
		1,
		Math.min(windowHeight - insets.top - 20, 720),
	);
	const { horizontalPadding } = getContentSizeLayout({
		fontScale,
		viewportWidth: sheetWidth,
		requestedHorizontalPadding: 24,
	});
	const bottomPadding = Math.max(insets.bottom + 20, 32);
	const [footerHeight, setFooterHeight] = useState(0);
	// A pinned action area must leave meaningful room for reading. At large
	// text sizes or in a short viewport, the entire dialog scrolls together.
	const hasFixedFooter =
		Boolean(footer) &&
		scrollable &&
		fontScale < 1.5 &&
		maximumHeight >= 480 &&
		footerHeight <= maximumHeight * 0.4;
	const measureFooter = useCallback((event: LayoutChangeEvent) => {
		setFooterHeight(event.nativeEvent.layout.height);
	}, []);
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
		setIsNativeSheetActive(true);
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

		if (phaseRef.current === "opening" || phaseRef.current === "presented") {
			phaseRef.current = "closing";
			sheetRef.current?.dismiss();
			return;
		}

		if (phaseRef.current === "closed") {
			setIsNativeSheetActive(false);
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
		if (phaseRef.current === "closed") {
			desiredVisibleRef.current = false;
			setIsNativeSheetActive(false);
			onClose();
			return;
		}
		sheetRef.current?.dismiss();
	}, [dismissible, onClose]);

	useEffect(() => {
		if (!capturesAndroidBack || Platform.OS !== "android") return undefined;

		const subscription = BackHandler.addEventListener(
			"hardwareBackPress",
			() => {
				if (dismissible) dismiss();
				return true;
			},
		);

		return () => subscription.remove();
	}, [capturesAndroidBack, dismiss, dismissible]);

	const handleDismiss = useCallback(() => {
		const wasControlledDismissal = phaseRef.current === "closing";
		const shouldReopen = wasControlledDismissal && desiredVisibleRef.current;
		phaseRef.current = "closed";
		setIsNativeSheetActive(shouldReopen);
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
			phaseRef.current = "presented";
			setIsNativeSheetActive(true);
			setSheetOpen?.(sheetId, true);
			if (didMoveFocusRef.current) return;

			didMoveFocusRef.current = true;
			onPresented?.();
			initialFocusFrameRef.current = requestAnimationFrame(() => {
				moveAccessibilityFocus(initialFocusRef.current);
				initialFocusFrameRef.current = null;
			});
		},
		[moveAccessibilityFocus, onPresented, setSheetOpen, sheetId],
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
	const renderBackground = useCallback(
		({ pointerEvents, style }: BottomSheetBackgroundProps) => (
			<View
				accessible={false}
				importantForAccessibility="no-hide-descendants"
				pointerEvents={pointerEvents}
				style={style}
			/>
		),
		[],
	);

	const canShowCloseButton = showCloseButton && dismissible;
	const hasHeader = Boolean(title || description || canShowCloseButton);
	const actions = useMemo(
		() =>
			footer ? (
				<View
					onAccessibilityEscape={dismiss}
					onLayout={measureFooter}
					className="bg-card pt-4"
					// Measured action size and screen insets control the pinned/flow layout.
					style={{
						paddingHorizontal: horizontalPadding,
						paddingBottom: bottomPadding,
					}}
					testID="dayova-sheet-actions"
				>
					{footer}
				</View>
			) : null,
		[footer, dismiss, measureFooter, horizontalPadding, bottomPadding],
	);
	const renderFooter = useCallback(
		(props: BottomSheetFooterProps) => (
			<BottomSheetFooter {...props}>{actions}</BottomSheetFooter>
		),
		[actions],
	);
	const content = (
		<View
			accessibilityActions={
				dismissible
					? [{ name: "escape", label: closeAccessibilityLabel }]
					: undefined
			}
			importantForAccessibility="yes"
			onAccessibilityAction={handleAccessibilityAction}
			onAccessibilityEscape={dismiss}
			className="bg-card pt-1"
			testID="dayova-sheet-content"
		>
			<View
				// Horizontal spacing responds to the available width and text size.
				style={{ paddingHorizontal: horizontalPadding }}
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
					<View className="mb-6 gap-3" testID="dayova-sheet-header">
						{canShowCloseButton ? (
							<View className="mb-2 self-end" testID="dayova-sheet-close-row">
								<CloseButton
									compact={compactCloseButton}
									accessibilityLabel={closeAccessibilityLabel}
									onPress={dismiss}
								/>
							</View>
						) : null}
						<View className="w-full" testID="dayova-sheet-title-row">
							{title ? (
								<View
									ref={initialFocusRef}
									accessible
									accessibilityLabel={accessibleTitle}
									accessibilityRole="header"
									className="min-w-0"
									collapsable={false}
								>
									<Text
										accessible={false}
										accessibilityRole="header"
										className="font-poppins font-semibold text-body-1 text-text"
									>
										{title}
									</Text>
								</View>
							) : (
								<View className="flex-1" />
							)}
						</View>
						{description ? (
							<Text className="font-poppins text-body-3 text-secondary-text">
								{description}
							</Text>
						) : null}
					</View>
				) : null}
				{children ? (
					<View className={cn(contentClassName)}>{children}</View>
				) : null}
			</View>
			{!hasFixedFooter ? actions : null}
		</View>
	);

	return (
		// Gorhom exposes native sheet geometry and chrome through style-only props;
		// runtime width and theme colors cannot be represented by static utilities.
		<BottomSheetModal
			ref={sheetRef}
			containerComponent={SheetModalContainer}
			accessible={false}
			// Edge-to-edge Android does not resize the sheet container for the IME.
			// Let Gorhom's interactive mode apply the keyboard offset itself.
			android_keyboardInputMode="adjustPan"
			backgroundComponent={renderBackground}
			backgroundStyle={{ backgroundColor: colors.surface }}
			backdropComponent={renderBackdrop}
			enableDynamicSizing
			footerComponent={hasFixedFooter ? renderFooter : undefined}
			enablePanDownToClose={dismissible}
			handleIndicatorStyle={{
				backgroundColor: colors.border,
				height: 4,
				width: 44,
			}}
			keyboardBehavior="interactive"
			keyboardBlurBehavior="restore"
			maxDynamicContentSize={maximumHeight}
			topInset={insets.top}
			onChange={handleChange}
			onDismiss={handleDismiss}
			style={{
				borderTopLeftRadius: DAYOVA_DESIGN_SYSTEM.radius.rectangle,
				borderTopRightRadius: DAYOVA_DESIGN_SYSTEM.radius.rectangle,
				marginHorizontal: sheetHorizontalInset,
				overflow: "hidden",
				width: sheetWidth,
			}}
		>
			<InputComponentContext.Provider value={SheetTextInput}>
				{scrollable ? (
					<BottomSheetScrollView
						bounces={false}
						keyboardShouldPersistTaps="handled"
						nestedScrollEnabled
						showsVerticalScrollIndicator
						enableFooterMarginAdjustment={hasFixedFooter}
						// Gorhom includes this measured inset in dynamic sizing and scrolling,
						// so the last content never sits behind the floating action area.
						contentContainerStyle={{
							paddingBottom: footer ? (hasFixedFooter ? 8 : 0) : bottomPadding,
						}}
						testID="dayova-sheet-scroll-content"
					>
						{content}
					</BottomSheetScrollView>
				) : (
					<BottomSheetView
						style={{ paddingBottom: footer ? 0 : bottomPadding }}
					>
						{content}
					</BottomSheetView>
				)}
			</InputComponentContext.Provider>
		</BottomSheetModal>
	);
}

// Keep the keyboard-aware native primitive inside the app-owned sheet boundary.
function DayovaSheetInput(props: ComponentProps<typeof Input>) {
	return (
		<Input
			{...props}
			renderInput={(inputProps) => <BottomSheetTextInput {...inputProps} />}
		/>
	);
}

export { DayovaSheetFrame, DayovaSheetInput };
