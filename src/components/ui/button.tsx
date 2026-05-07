import { cva, type VariantProps } from "class-variance-authority";
import { Platform, Pressable, type ViewStyle } from "react-native";
import { ArrowLeft } from "~/components/ui/icon";
import { TextClassContext } from "~/components/ui/text";
import { cn } from "~/lib/utils";

const buttonVariants = cva(
	cn(
		"group h-[64px] shrink-0 flex-row items-center justify-center gap-2 rounded-button px-6 shadow-primary/20 shadow-sm",
		Platform.select({
			web: "whitespace-nowrap outline-none transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
		}),
	),
	{
		variants: {
			variant: {
				default: cn(
					"bg-primary active:bg-primary/90",
					Platform.select({ web: "hover:bg-primary/90" }),
				),
				neutral: cn(
					"bg-button-neutral shadow-black/5 active:bg-button-neutral/90",
					Platform.select({ web: "hover:bg-button-neutral/90" }),
				),
				destructive: cn(
					"bg-destructive shadow-black/5 shadow-sm active:bg-destructive/90 dark:bg-destructive/60",
					Platform.select({
						web: "hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
					}),
				),
				outline: cn(
					"border border-primary/50 bg-background active:bg-accent",
					Platform.select({
						web: "hover:bg-accent dark:hover:bg-input/50",
					}),
				),
				ghost: cn(
					"active:bg-accent dark:active:bg-accent/50",
					Platform.select({ web: "hover:bg-accent dark:hover:bg-accent/50" }),
				),
				link: "",
			},
			size: {
				default: cn(
					"h-[64px] px-6",
					Platform.select({ web: "has-[>svg]:px-5" }),
				),
				sm: cn(
					"h-[48px] gap-1.5 rounded-button px-4",
					Platform.select({ web: "has-[>svg]:px-3" }),
				),
				lg: cn(
					"h-[64px] rounded-button px-8",
					Platform.select({ web: "has-[>svg]:px-6" }),
				),
				icon: "h-[44px] w-[44px]",
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
		"font-poppins font-semibold text-16 text-foreground leading-6",
		Platform.select({ web: "pointer-events-none transition-colors" }),
	),
	{
		variants: {
			variant: {
				default: "text-primary-foreground",
				neutral: "text-button-neutral-foreground",
				destructive: "text-white",
				outline: cn(
					"group-active:text-accent-foreground",
					Platform.select({ web: "group-hover:text-accent-foreground" }),
				),
				ghost: "group-active:text-accent-foreground",
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
	className,
	variant,
	size,
	...props
}: ButtonProps) {
	const resolvedAccessibilityState = props.disabled
		? { ...accessibilityState, disabled: true }
		: accessibilityState;

	return (
		<TextClassContext.Provider value={buttonTextVariants({ variant, size })}>
			<Pressable
				{...props}
				accessible
				accessibilityRole="button"
				accessibilityState={resolvedAccessibilityState}
				className={cn(
					props.disabled && "opacity-50",
					buttonVariants({ variant, size }),
					className,
				)}
				role="button"
			/>
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
	const baseStyle: ViewStyle = {
		width: 48,
		height: 48,
		minWidth: 48,
		minHeight: 48,
		borderRadius: 24,
	};
	const resolvedStyle =
		typeof style === "function"
			? (state: Parameters<typeof style>[0]) => [baseStyle, style(state)]
			: [baseStyle, style];

	return (
		<Button
			accessibilityHint="Geht zum vorherigen Schritt oder Bildschirm zurück."
			accessibilityLabel="Zurück"
			hitSlop={8}
			className={cn(
				"items-center justify-center rounded-full bg-white px-0 shadow-black/10 shadow-sm active:bg-white/80",
				Platform.select({ web: "hover:bg-white/90" }),
				className,
			)}
			variant="ghost"
			size="icon"
			style={resolvedStyle}
			{...props}
		>
			<ArrowLeft size={iconSize} color="#1A1A1A" strokeWidth={strokeWidth} />
		</Button>
	);
}

export { BackButton, Button };
