import * as Slot from "@rn-primitives/slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { Platform, Text as RNText, type Role } from "react-native";
import { cn } from "~/lib/utils";

const textVariants = cva(
	cn(
		"font-poppins text-body-2 text-foreground tracking-normal",
		Platform.select({
			web: "select-text",
		}),
	),
	{
		variants: {
			variant: {
				default: "",
				h1: cn(
					"text-center font-semibold text-heading-1",
					Platform.select({ web: "scroll-m-20 text-balance" }),
				),
				h2: cn(
					"border-border border-b pb-2 font-semibold text-heading-2",
					Platform.select({ web: "scroll-m-20 first:mt-0" }),
				),
				h3: cn(
					"font-semibold text-body-1",
					Platform.select({ web: "scroll-m-20" }),
				),
				h4: cn(
					"font-semibold text-body-2",
					Platform.select({ web: "scroll-m-20" }),
				),
				p: "mt-3 sm:mt-6",
				blockquote: "mt-4 border-l-2 pl-3 italic sm:mt-6 sm:pl-6",
				code: cn(
					"relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono font-semibold text-body-3",
				),
				lead: "text-body-1 text-muted-foreground",
				large: "font-semibold text-body-2",
				small: "text-body-4",
				muted: "text-body-4 text-muted-foreground",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

type TextVariantProps = VariantProps<typeof textVariants>;

type TextVariant = NonNullable<TextVariantProps["variant"]>;

const ROLE: Partial<Record<TextVariant, Role>> = {
	h1: "heading",
	h2: "heading",
	h3: "heading",
	h4: "heading",
	blockquote: Platform.select({ web: "blockquote" as Role }),
	code: Platform.select({ web: "code" as Role }),
};

const ARIA_LEVEL: Partial<Record<TextVariant, string>> = {
	h1: "1",
	h2: "2",
	h3: "3",
	h4: "4",
};

const TextClassContext = React.createContext<string | undefined>(undefined);

const androidTextResetStyle = Platform.select({
	android: {
		includeFontPadding: false,
	},
});

function Text({
	className,
	asChild = false,
	style,
	variant = "default",
	...props
}: React.ComponentProps<typeof RNText> &
	TextVariantProps & {
		asChild?: boolean;
	}) {
	const textClass = React.useContext(TextClassContext);
	const Component = asChild ? Slot.Text : RNText;
	return (
		<Component
			className={cn(textVariants({ variant }), textClass, className)}
			role={variant ? ROLE[variant] : undefined}
			aria-level={variant ? ARIA_LEVEL[variant] : undefined}
			// Android adds extra font padding around Text by default; the Figma
			// typography ramp assumes the rendered line box, so the native reset is
			// centralized here instead of repeated on every Text call site.
			style={[androidTextResetStyle, style]}
			{...props}
		/>
	);
}

export { Text, TextClassContext };
