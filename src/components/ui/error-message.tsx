import { Text } from "~/components/ui/text";
import { cn } from "~/lib/utils";

function ErrorMessage({
	className,
	...props
}: React.ComponentProps<typeof Text>) {
	return (
		<Text
			{...props}
			accessibilityLiveRegion="polite"
			accessibilityRole="alert"
			selectable
			className={cn("font-poppins text-body-4 text-destructive", className)}
		/>
	);
}

export { ErrorMessage };
