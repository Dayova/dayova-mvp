import { cva, type VariantProps } from "class-variance-authority";
import { LinearGradient } from "expo-linear-gradient";
import { Platform, Pressable, StyleSheet } from "react-native";
import { ArrowLeft } from "~/components/ui/icon";
import { TextClassContext } from "~/components/ui/text";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { useDayovaTheme } from "~/lib/theme";
import { cn } from "~/lib/utils";

const PRIMARY_INTERACTIVE_GRADIENT =
	DAYOVA_DESIGN_SYSTEM.gradients.primaryInteractive;
// expo-linear-gradient needs concrete native bounds; NativeWind className
// interop is intentionally avoided for this functional absolute fill.
const gradientFillStyle = StyleSheet.absoluteFill;

const buttonVariants = cva(
	cn(
		"group h-14 shrink-0 flex-row items-center justify-center gap-2 overflow-hidden rounded-button px-6 shadow-primary/20 shadow-sm",
		Platform.select({
			web: "whitespace-nowrap outline-none transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
		}),
	),
	{
		variants: {
			variant: {
				default: cn(
					"border-hairline border-white bg-primary active:opacity-90",
					Platform.select({ web: "hover:opacity-90" }),
				),
				neutral: cn(
					"border-border border-hairline bg-button-neutral shadow-black/5 active:bg-button-neutral/90",
					Platform.select({ web: "hover:bg-button-neutral/90" }),
				),
				destructive: cn(
					"border-border border-hairline bg-button-neutral shadow-black/5 shadow-sm active:bg-button-neutral/90",
					Platform.select({
						web: "hover:bg-button-neutral/90 focus-visible:ring-destructive/20",
					}),
				),
				outline: cn(
					"border-border border-hairline bg-button-neutral active:bg-button-neutral/90",
					Platform.select({
						web: "hover:bg-button-neutral/90",
					}),
				),
				ghost: cn(
					"active:bg-accent",
					Platform.select({ web: "hover:bg-accent" }),
				),
				link: "",
			},
			size: {
				default: cn("h-14 px-6", Platform.select({ web: "has-[>svg]:px-5" })),
				sm: cn(
					"h-12 gap-2 rounded-button px-4",
					Platform.select({ web: "has-[>svg]:px-3" }),
				),
				lg: cn(
					"h-14 rounded-button px-8",
					Platform.select({ web: "has-[>svg]:px-6" }),
				),
				icon: "h-11 w-11",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

const buttonTextVariants = cva(
	cn(
		"font-poppins font-semibold text-body-2 text-text",
		Platform.select({ web: "pointer-events-none transition-colors" }),
	),
	{
		variants: {
			variant: {
				default: "text-white",
				neutral: "text-background",
				destructive: "text-background",
				outline: "text-background",
				ghost: "group-active:text-primary-strong",
				link: cn(
					"text-primary group-active:underline",
					Platform.select({
						web: "underline-offset-4 hover:underline group-hover:underline",
					}),
				),
			},
			size: {
				default: "",
				sm: "",
				lg: "",
				icon: "",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

type ButtonProps = React.ComponentProps<typeof Pressable> &
	VariantProps<typeof buttonVariants>;

function Button({
	accessibilityState,
	children,
	className,
	variant,
	size,
	style,
	...props
}: ButtonProps) {
	const resolvedVariant = variant ?? "default";
	const showGradientFill = resolvedVariant === "default";
	const resolvedAccessibilityState = props.disabled
		? { ...accessibilityState, disabled: true }
		: accessibilityState;

	return (
		<TextClassContext.Provider
			value={buttonTextVariants({ variant: resolvedVariant, size })}
		>
			<Pressable
				{...props}
				accessible
				accessibilityRole="button"
				accessibilityState={resolvedAccessibilityState}
				className={cn(
					props.disabled && "opacity-50",
					buttonVariants({ variant: resolvedVariant, size }),
					className,
				)}
				role="button"
				// Style passthrough is reserved for runtime Pressable styles such as
				// animated or measured values; static styling belongs in className.
				style={style}
			>
				{(state) => (
					<>
						{showGradientFill ? (
							<LinearGradient
								pointerEvents="none"
								colors={PRIMARY_INTERACTIVE_GRADIENT.colors}
								start={PRIMARY_INTERACTIVE_GRADIENT.start}
								end={PRIMARY_INTERACTIVE_GRADIENT.end}
								style={gradientFillStyle}
							/>
						) : null}
						{typeof children === "function" ? children(state) : children}
					</>
				)}
			</Pressable>
		</TextClassContext.Provider>
	);
}

type BackButtonProps = Omit<ButtonProps, "children" | "variant" | "size"> & {
	iconSize?: number;
	strokeWidth?: number;
};

function BackButton({
	className,
	iconSize = 20,
	strokeWidth = 2.4,
	style,
	...props
}: BackButtonProps) {
	const { colors } = useDayovaTheme();

	return (
		<Button
			accessibilityHint="Geht zum vorherigen Schritt oder Bildschirm zurück."
			accessibilityLabel="Zurück"
			hitSlop={8}
			className={cn(
				"h-12 min-h-12 w-12 min-w-12 items-center justify-center rounded-full bg-card px-0 shadow-black/10 shadow-sm active:bg-card/80",
				Platform.select({ web: "hover:bg-card/90" }),
				className,
			)}
			variant="ghost"
			size="icon"
			style={style}
			{...props}
		>
			<ArrowLeft
				size={iconSize}
				color={colors.text}
				strokeWidth={strokeWidth}
			/>
		</Button>
	);
}

export { BackButton, Button };
