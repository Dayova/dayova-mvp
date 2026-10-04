import { View } from "react-native";
import { Text } from "~/components/ui/text";
import { cn } from "~/lib/utils";

export function LearningPlanStatusBadge({
	status,
	fixedTextScale,
	className,
}: {
	status: { label: string; background: string; foreground: string };
	fixedTextScale: boolean;
	className?: string;
}) {
	return (
		<View
			className={cn("min-h-7 justify-center rounded-full px-3 py-1", className)}
			// Badge colors are semantic runtime values supplied by the card model.
			style={{ backgroundColor: status.background }}
		>
			<Text
				allowFontScaling={!fixedTextScale}
				className="font-poppins font-semibold text-body-5"
				// Badge colors are semantic runtime values supplied by the card model.
				style={{ color: status.foreground }}
			>
				{status.label}
			</Text>
		</View>
	);
}
