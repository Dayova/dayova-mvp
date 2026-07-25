import type { ViewProps } from "react-native";
import { FlowProgressBar } from "~/components/ui/flow-progress-bar";

export function QuestionProgressBar({
	currentIndex,
	total,
	className,
	...props
}: ViewProps & {
	currentIndex: number;
	total: number;
}) {
	const safeTotal = Math.max(1, total);
	const completedQuestions = Math.min(Math.max(currentIndex + 1, 1), safeTotal);
	const progress = completedQuestions / safeTotal;

	return (
		<FlowProgressBar
			progress={progress}
			className={className}
			accessibilityRole="progressbar"
			accessibilityValue={{
				min: 1,
				max: safeTotal,
				now: completedQuestions,
				text: `Frage ${completedQuestions} von ${safeTotal}`,
			}}
			{...props}
		/>
	);
}
