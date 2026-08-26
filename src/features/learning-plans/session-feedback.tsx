import { View } from "react-native";
import { decodeGeneratedTextHtmlEntities } from "#convex/generatedGermanText";
import {
	Check,
	CircleAlert,
	ClipboardEdit,
	Pencil,
} from "~/components/ui/icon";
import { Surface } from "~/components/ui/surface";
import { Text } from "~/components/ui/text";
import type {
	SessionAnswerAttempt,
	SessionAnswerRating,
} from "~/features/learning-plans/types";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { cn } from "~/lib/utils";

const ratingCopy: Record<
	SessionAnswerRating,
	{
		title: string;
		color: string;
		subtleClassName: string;
		textClassName: string;
	}
> = {
	notCorrect: {
		title: "Noch nicht gewusst",
		color: DAYOVA_DESIGN_SYSTEM.colors.wrong,
		subtleClassName: "bg-wrong-subtle",
		textClassName: "text-wrong",
	},
	partiallyCorrect: {
		title: "Teilweise richtig",
		color: DAYOVA_DESIGN_SYSTEM.colors.info,
		subtleClassName: "bg-info-subtle",
		textClassName: "text-info",
	},
	correct: {
		title: "Richtige Antwort",
		color: DAYOVA_DESIGN_SYSTEM.colors.success,
		subtleClassName: "bg-success-subtle",
		textClassName: "text-success",
	},
};

function TagPill({
	label,
	icon,
}: {
	label: string;
	icon: "answer" | "evaluation";
}) {
	const Icon = icon === "answer" ? Pencil : ClipboardEdit;

	return (
		<View className="flex-row items-center gap-2 self-start rounded-full bg-system-subtle px-3 py-2">
			<Icon
				size={16}
				color={DAYOVA_DESIGN_SYSTEM.colors.primary}
				strokeWidth={2.1}
			/>
			<Text className="font-poppins font-semibold text-body-4 text-primary">
				{label}
			</Text>
		</View>
	);
}

export function FeedbackView({ attempt }: { attempt: SessionAnswerAttempt }) {
	const copy = ratingCopy[attempt.rating];
	const StatusIcon = attempt.rating === "correct" ? Check : CircleAlert;
	const feedback = decodeGeneratedTextHtmlEntities(attempt.feedback);
	const perfectAnswer = decodeGeneratedTextHtmlEntities(attempt.perfectAnswer);
	return (
		<View className="flex-1 justify-between">
			<View className="items-center pt-6">
				<View
					className={cn(
						"h-20 w-20 items-center justify-center rounded-full",
						copy.subtleClassName,
					)}
				>
					<StatusIcon size={34} color={copy.color} strokeWidth={2.4} />
				</View>
				<Text
					className={cn(
						"mt-3 font-poppins font-semibold text-body-3",
						copy.textClassName,
					)}
				>
					{copy.title}
				</Text>
			</View>

			<View className="mt-9">
				<Surface className="rounded-[32px] px-5 py-6" variant="flat">
					<TagPill label="Auswertung" icon="evaluation" />
					<Text className="mt-8 font-poppins text-body-2 text-secondary-text">
						{feedback}
					</Text>
				</Surface>
				<View className="mx-8 my-8 h-px bg-border" />
				<Surface className="rounded-[32px] px-5 py-6" variant="flat">
					<TagPill label="Ideale Antwort" icon="answer" />
					<Text className="mt-8 font-poppins text-body-2 text-secondary-text">
						{perfectAnswer}
					</Text>
				</Surface>
			</View>
		</View>
	);
}
