import { View } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { Bulb, Sparkles } from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { cn } from "~/lib/utils";
import { getStudyTimeFactBody } from "./study-time-fact";

const COLORS = DAYOVA_DESIGN_SYSTEM.colors;
const HANGING_FACT_RAILS = [
	{ id: "left", position: "left-1/4" },
	{ id: "right", position: "right-1/4" },
] as const;

function HangingStudyTimeFactPanel({ body }: { body: string }) {
	return (
		<View className="min-h-[420px] w-full items-center">
			{HANGING_FACT_RAILS.map((rail) => (
				<View
					key={rail.id}
					className={cn(
						"absolute top-0 h-[232px] w-2 rounded-full bg-path-2/60",
						rail.position,
					)}
				/>
			))}

			<Animated.View
				entering={FadeInUp.delay(80).duration(420).springify().damping(18)}
				className="mt-56 w-full"
			>
				<View className="w-full -rotate-2 rounded-card bg-surface px-6 py-5">
					<View className="flex-row items-center gap-1 self-start rounded-full bg-primary/10 px-2 py-1">
						<Sparkles size={16} color={COLORS.primary} strokeWidth={2} />
						<Text className="font-poppins font-semibold text-body-5 text-primary">
							Lernfakt
						</Text>
					</View>

					<Text className="mt-5 font-poppins text-body-3 text-secondary-text">
						{body}
					</Text>
				</View>
			</Animated.View>
		</View>
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
				className="z-10 mt-10 text-center font-poppins font-semibold text-heading-1 text-text"
			>
				{title}
			</Text>

			<View className="-mt-24 w-full items-center">
				<HangingStudyTimeFactPanel body={getStudyTimeFactBody(studyTime)} />
			</View>
		</>
	);
}
