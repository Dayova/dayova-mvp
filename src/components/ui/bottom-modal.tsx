import type { ComponentProps, ReactNode } from "react";
import {
	Modal,
	Pressable,
	ScrollView,
	TouchableOpacity,
	useWindowDimensions,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CloseButton } from "~/components/ui/close-button";
import { useContentSizeLayout } from "~/components/ui/portrait-content";
import { Text } from "~/components/ui/text";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { useDayovaTheme } from "~/lib/theme";
import { cn } from "~/lib/utils";

const MAX_SHEET_WIDTH = 560;
const SHEET_SHADOW = "0 4px 12px rgba(0, 0, 0, 0.10)";
const OPTION_SHADOW = "0 4px 12px rgba(0, 0, 0, 0.06)";
const ICON_SHADOW =
	"0 2px 4px -2px rgba(24, 39, 75, 0.12), 0 4px 4px -2px rgba(24, 39, 75, 0.08)";

type BottomModalProps = {
	visible: boolean;
	title?: ReactNode;
	description?: ReactNode;
	children?: ReactNode;
	onClose?: () => void;
	onDismiss?: () => void;
	dismissible?: boolean;
	showCloseButton?: boolean;
	closeAccessibilityLabel?: string;
	overlayClassName?: string;
	sheetClassName?: string;
	headerClassName?: string;
	titleClassName?: string;
	descriptionClassName?: string;
	contentClassName?: string;
	maxWidth?: number;
};

function BottomModal({
	visible,
	title,
	description,
	children,
	onClose,
	onDismiss,
	dismissible = true,
	showCloseButton = true,
	closeAccessibilityLabel = "Dialog schließen",
	overlayClassName,
	sheetClassName,
	headerClassName,
	titleClassName,
	descriptionClassName,
	contentClassName,
	maxWidth = MAX_SHEET_WIDTH,
}: BottomModalProps) {
	const insets = useSafeAreaInsets();
	const { isDark } = useDayovaTheme();
	const { height: windowHeight, width } = useWindowDimensions();
	const hasHeader = Boolean(title || description);
	const canDismiss = dismissible && Boolean(onClose);
	const sheetWidth = Math.min(width, maxWidth);
	const overlayStyle = {
		backgroundColor: isDark ? "rgba(0, 0, 0, 0.62)" : "rgba(26, 26, 26, 0.25)",
	};

	return (
		<Modal
			visible={visible}
			transparent
			animationType="fade"
			onDismiss={onDismiss}
			onRequestClose={canDismiss ? onClose : undefined}
			statusBarTranslucent
		>
			<View className="flex-1 justify-end">
				{canDismiss ? (
					<Pressable
						accessibilityLabel={closeAccessibilityLabel}
						accessibilityRole="button"
						className={cn("absolute inset-0", overlayClassName)}
						onPress={onClose}
						style={overlayStyle}
					/>
				) : (
					<View
						className={cn("absolute inset-0", overlayClassName)}
						style={overlayStyle}
					/>
				)}
				<View
					className={cn(
						"self-center overflow-hidden rounded-t-[40px] bg-card",
						sheetClassName,
					)}
					style={{
						width: sheetWidth,
						maxHeight: Math.max(240, windowHeight - insets.top - 16),
						boxShadow: SHEET_SHADOW,
					}}
				>
					<ScrollView
						bounces={false}
						// Safe-area padding is runtime device data.
						contentContainerStyle={{
							paddingHorizontal: 24,
							paddingTop: 20,
							paddingBottom: Math.max(insets.bottom + 40, 56),
						}}
						showsVerticalScrollIndicator={false}
					>
						{showCloseButton && onClose ? (
							<View className="items-end">
								<CloseButton
									accessibilityLabel={closeAccessibilityLabel}
									onPress={onClose}
								/>
							</View>
						) : null}
						{hasHeader ? (
							<View
								className={cn(
									showCloseButton && onClose ? "mt-6 gap-3" : "gap-3",
									headerClassName,
								)}
							>
								{title ? (
									<Text
										className={cn(
											"font-poppins font-semibold text-body-1 text-text",
											titleClassName,
										)}
									>
										{title}
									</Text>
								) : null}
								{description ? (
									<Text
										className={cn(
											"font-poppins text-body-2 text-secondary-text",
											descriptionClassName,
										)}
									>
										{description}
									</Text>
								) : null}
							</View>
						) : null}
						{children ? (
							<View
								className={cn(
									hasHeader ? "mt-8" : showCloseButton && onClose ? "mt-6" : "",
									contentClassName,
								)}
							>
								{children}
							</View>
						) : null}
					</ScrollView>
				</View>
			</View>
		</Modal>
	);
}

type BottomModalOptionProps = Omit<
	ComponentProps<typeof TouchableOpacity>,
	"children"
> & {
	icon: ReactNode;
	title: string;
	description?: string;
	layout?: "row" | "tile";
	iconContainerClassName?: string;
	titleClassName?: string;
	descriptionClassName?: string;
};

function BottomModalOption({
	icon,
	title,
	description,
	layout = "row",
	disabled,
	className,
	style,
	iconContainerClassName,
	titleClassName,
	descriptionClassName,
	accessibilityLabel = title,
	accessibilityRole = "button",
	activeOpacity = 0.86,
	...props
}: BottomModalOptionProps) {
	const isTile = layout === "tile";
	const { shouldStackInlineContent } = useContentSizeLayout();

	return (
		<TouchableOpacity
			{...props}
			accessibilityLabel={accessibilityLabel}
			accessibilityRole={accessibilityRole}
			accessibilityState={{ disabled }}
			activeOpacity={activeOpacity}
			disabled={disabled}
			className={cn(
				"border border-border/45 bg-card",
				isTile
					? "min-h-36 flex-1 items-center justify-center gap-5 rounded-card px-4 py-5"
					: "min-h-20 w-full flex-row items-center gap-4 rounded-card px-4 py-3",
				className,
			)}
			style={[
				{ opacity: disabled ? 0.55 : 1, boxShadow: OPTION_SHADOW },
				style,
			]}
		>
			<View
				className={cn(
					"items-center justify-center rounded-full bg-system-subtle",
					isTile ? "h-16 w-16" : "h-14 w-14",
					iconContainerClassName,
				)}
				style={{ boxShadow: ICON_SHADOW }}
			>
				{icon}
			</View>
			<View className={cn(isTile ? "items-center gap-1" : "flex-1 gap-1")}>
				<Text
					className={cn(
						"font-poppins text-text",
						isTile
							? "text-center font-semibold text-body-1"
							: "font-medium text-body-2",
						titleClassName,
					)}
					numberOfLines={shouldStackInlineContent ? undefined : 2}
				>
					{title}
				</Text>
				{description ? (
					<Text
						className={cn(
							"font-poppins text-body-4 text-secondary-text",
							isTile ? "text-center" : "",
							descriptionClassName,
						)}
						numberOfLines={shouldStackInlineContent ? undefined : 2}
					>
						{description}
					</Text>
				) : null}
			</View>
		</TouchableOpacity>
	);
}

const bottomModalIconColor = DAYOVA_DESIGN_SYSTEM.colors.primary;

export { BottomModal, BottomModalOption, bottomModalIconColor };
