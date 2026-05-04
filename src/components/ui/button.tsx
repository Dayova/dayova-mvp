import { cva, type VariantProps } from "class-variance-authority";
import { Platform, Pressable } from "react-native";
import { TextClassContext } from "~/components/ui/text";
import { cn } from "~/lib/utils";

const buttonVariants = cva(
	cn(
		"group h-14 shrink-0 flex-row items-center justify-center gap-2 rounded-button px-6 shadow-primary/20 shadow-sm",
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
				secondary: cn(
					"bg-secondary shadow-black/5 shadow-sm active:bg-secondary/80",
					Platform.select({ web: "hover:bg-secondary/80" }),
				),
				ghost: cn(
					"active:bg-accent dark:active:bg-accent/50",
					Platform.select({ web: "hover:bg-accent dark:hover:bg-accent/50" }),
				),
				link: "",
			},
			size: {
				default: cn("h-14 px-6", Platform.select({ web: "has-[>svg]:px-5" })),
				sm: cn(
					"h-11 gap-1.5 rounded-button px-4",
					Platform.select({ web: "has-[>svg]:px-3" }),
				),
				lg: cn(
					"h-16 rounded-button px-8",
					Platform.select({ web: "has-[>svg]:px-6" }),
				),
				icon: "h-10 w-10 sm:h-9 sm:w-9",
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
		"font-bold font-poppins text-16 text-foreground uppercase leading-6",
		Platform.select({ web: "pointer-events-none transition-colors" }),
	),
	{
		variants: {
			variant: {
				default: "text-primary-foreground",
				destructive: "text-white",
				outline: cn(
					"group-active:text-accent-foreground",
					Platform.select({ web: "group-hover:text-accent-foreground" }),
				),
				secondary: "text-secondary-foreground",
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

function Button({ className, variant, size, ...props }: ButtonProps) {
	return (
		<TextClassContext.Provider value={buttonTextVariants({ variant, size })}>
			<Pressable
				className={cn(
					props.disabled && "opacity-50",
					buttonVariants({ variant, size }),
					className,
				)}
				role="button"
				{...props}
			/>
		</TextClassContext.Provider>
	);
}

export { Button };
