import { View } from "react-native";
import Animated, { FadeInUp, useReducedMotion } from "react-native-reanimated";
import { Bulb, Sparkles } from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { getStudyTimeFactBody } from "./study-time-fact";

const COLORS = DAYOVA_DESIGN_SYSTEM.colors;
function StudyTimeFactPanel({ body }: { body: string }) {
	const reducedMotion = useReducedMotion();
	return (
		<Animated.View
			entering={
				reducedMotion
					? undefined
					: FadeInUp.delay(80).duration(420).springify().damping(18)
			}
			className="mt-7 w-full rounded-[28px] border border-primary/15 bg-primary/5 px-6 py-6"
		>
			<View className="flex-row items-center gap-2 self-start rounded-full bg-primary/10 px-3 py-1.5">
				<Sparkles size={16} color={COLORS.primary} strokeWidth={2} />
				<Text className="font-poppins font-semibold text-body-5 text-primary">
					Lernfakt
				</Text>
			</View>

			<Text className="mt-5 font-poppins text-body-3 text-secondary-text">
				{body}
			</Text>
		</Animated.View>
	);
}

export function StudyTimeFactContent({
	title,
	studyTime,
}: {
	title: string;
	studyTime: string;
}) {
	return (
		<>
			<View className="items-center">
				<View className="h-[60px] w-[60px] items-center justify-center rounded-full bg-wrong-subtle">
					<Bulb size={32} color={COLORS.wrong} strokeWidth={1.5} />
				</View>
				<Text className="mt-2 font-poppins text-body-4 text-wrong">
					Schon gewusst?
				</Text>
			</View>

			<Text
				accessibilityRole="header"
				className="mt-5 text-center font-poppins font-semibold text-heading-1 text-text"
			>
				{title}
			</Text>

			<StudyTimeFactPanel body={getStudyTimeFactBody(studyTime)} />
		</>
	);
}
