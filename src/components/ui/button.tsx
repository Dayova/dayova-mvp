import { cva, type VariantProps } from "class-variance-authority";
import { Platform, Pressable } from "react-native";
import { ArrowLeft } from "~/components/ui/icon";
import { TextClassContext } from "~/components/ui/text";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { cn } from "~/lib/utils";

const buttonVariants = cva(
	cn(
		"group h-16 shrink-0 flex-row items-center justify-center gap-2 rounded-button px-6 shadow-primary/20 shadow-sm",
		Platform.select({
			web: "whitespace-nowrap outline-none transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
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
					"bg-destructive shadow-black/5 shadow-sm active:bg-destructive/90",
					Platform.select({
						web: "hover:bg-destructive/90 focus-visible:ring-destructive/20",
					}),
				),
				outline: cn(
					"border border-primary/50 bg-background active:bg-accent",
					Platform.select({
						web: "hover:bg-accent",
					}),
				),
				ghost: cn(
					"active:bg-accent",
					Platform.select({ web: "hover:bg-accent" }),
				),
				link: "",
			},
			size: {
				default: cn("h-16 px-6", Platform.select({ web: "has-[>svg]:px-5" })),
				sm: cn(
					"h-12 gap-2 rounded-button px-4",
					Platform.select({ web: "has-[>svg]:px-3" }),
				),
				lg: cn(
					"h-16 rounded-button px-8",
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
		"font-poppins font-semibold text-body-2 text-foreground",
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
	style,
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
				// Style passthrough is reserved for runtime Pressable styles such as
				// animated or measured values; static styling belongs in className.
				style={style}
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
				color={DAYOVA_DESIGN_SYSTEM.colors.text}
				strokeWidth={strokeWidth}
			/>
		</Button>
	);
}

export { BackButton, Button };
