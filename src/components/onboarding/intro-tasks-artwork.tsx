import { LinearGradient } from "expo-linear-gradient";
import { Image, StyleSheet, View } from "react-native";
import type { SvgProps } from "react-native-svg";
import Svg, { Circle } from "react-native-svg";
import { Check, ClipboardEdit, Flame } from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { cn } from "~/lib/utils";

const ARTWORK_WIDTH = 356;
const ARTWORK_HEIGHT = 242;
const COLORS = DAYOVA_DESIGN_SYSTEM.colors;
const GRADIENT = DAYOVA_DESIGN_SYSTEM.gradients.primaryInteractive;
const logoSource = require("../../../assets/onboarding/dayova-y.png");

const taskPreviewRows = [
	{ id: "math-homework", label: "Hausaufgabe Mathe" },
	{ id: "german-presentation", label: "Deutsch Vortrag" },
	{ id: "history-test", label: "Geschichte Test lernen" },
] as const;

const streakDays = [
	{ id: "monday", label: "M", state: "question" },
	{ id: "tuesday", label: "T", state: "complete" },
	{ id: "wednesday", label: "W", state: "complete" },
	{ id: "thursday", label: "T", state: "complete" },
	{ id: "friday", label: "F", state: "complete" },
	{ id: "saturday", label: "S", state: "current" },
	{ id: "sunday", label: "S", state: "future" },
] as const;

function TaskCard() {
	return (
		<View
			className="absolute overflow-hidden rounded-[16px] border-border border-hairline bg-surface"
			style={artworkGeometry.taskCard}
		>
			<View className="h-[25px] flex-row items-center gap-[5px] px-[13px]">
				<LinearGradient
					colors={GRADIENT.colors}
					start={GRADIENT.start}
					end={GRADIENT.end}
					style={gradientBackgroundStyle}
				/>
				<ClipboardEdit size={10} color={COLORS.light1} strokeWidth={2} />
				<Text className="font-poppins font-semibold text-[8px] text-white leading-3">
					Deine Aufgaben
				</Text>
			</View>

			<View className="pr-[7px] pl-[17px]">
				{taskPreviewRows.map((row, index) => (
					<View
						key={row.id}
						className={cn(
							"h-[25.7px] flex-row items-center gap-1.5",
							index < taskPreviewRows.length - 1 && "border-border border-b",
						)}
					>
						<View className="h-2 w-2 rounded-full border border-primary" />
						<Text
							numberOfLines={1}
							className="flex-1 font-normal font-poppins text-[6.5px] text-primary leading-[9px]"
						>
							{row.label}
						</Text>
					</View>
				))}
			</View>
		</View>
	);
}

function StreakDay({
	label,
	state,
}: {
	label: string;
	state: (typeof streakDays)[number]["state"];
}) {
	return (
		<View className="w-[17px] items-center gap-0.5">
			<Text className="font-normal font-poppins text-[6px] text-white leading-2">
				{label}
			</Text>
			{state === "question" ? (
				<View className="h-[17px] w-[17px] items-center justify-center rounded-full bg-primary-strong">
					<Text className="font-poppins font-semibold text-[9px] text-white leading-[11px]">
						?
					</Text>
				</View>
			) : null}
			{state === "complete" ? (
				<View className="h-[17px] w-[17px] items-center justify-center rounded-full bg-white">
					<Check size={10} color={COLORS.primary} strokeWidth={3} />
				</View>
			) : null}
			{state === "current" ? (
				<Svg width={17} height={17} viewBox="0 0 17 17">
					<Circle
						cx={8.5}
						cy={8.5}
						r={6}
						fill="none"
						stroke={COLORS.primaryStrong}
						strokeWidth={4}
					/>
					<Circle
						cx={8.5}
						cy={8.5}
						r={6}
						fill="none"
						stroke={COLORS.light1}
						strokeDasharray="22 38"
						strokeLinecap="round"
						strokeWidth={4}
						transform="rotate(-90 8.5 8.5)"
					/>
				</Svg>
			) : null}
			{state === "future" ? (
				<View className="h-[17px] w-[17px] rounded-full border-4 border-primary-strong" />
			) : null}
		</View>
	);
}

function StreakCard() {
	return (
		<View
			className="absolute rounded-[16px] shadow-black/5 shadow-sm"
			style={artworkGeometry.streakCard}
		>
			<View className="h-full w-full overflow-hidden rounded-[16px] px-2 pt-2.5">
				<LinearGradient
					colors={GRADIENT.colors}
					start={GRADIENT.start}
					end={GRADIENT.end}
					style={gradientBackgroundStyle}
				/>
				<View className="items-center">
					<View className="flex-row items-center gap-[3px]">
						<Flame size={13} color={COLORS.light1} strokeWidth={2.4} />
						<Text className="font-poppins font-semibold text-[14px] text-white leading-[17px]">
							4
						</Text>
					</View>
					<Text className="font-normal font-poppins text-[6px] text-white leading-2">
						Erfolgreiche Lerntage
					</Text>
				</View>

				<View className="mt-1.5 flex-row justify-between">
					{streakDays.map((day) => (
						<StreakDay key={day.id} label={day.label} state={day.state} />
					))}
				</View>

				<Text className="mt-1.5 text-center font-normal font-poppins text-[6px] text-white leading-2">
					Weiter so! Du hast schon 4{"\n"}Lerntage abgeschlossen
				</Text>
			</View>
		</View>
	);
}

function ReminderCard() {
	return (
		<View
			className="absolute flex-row items-center rounded-[16px] border-border border-hairline bg-surface px-[13.38px] shadow-black/5 shadow-sm"
			style={artworkGeometry.reminderCard}
		>
			<View className="h-[35.4px] w-[35.4px] items-center justify-center rounded-full border-[0.86px] border-border bg-surface">
				<Image source={logoSource} resizeMode="contain" className="h-6 w-6" />
			</View>
			<View className="mr-4 ml-[11.5px] h-[47px] w-px bg-border" />
			<View className="flex-1 gap-0.5">
				<Text className="font-normal font-poppins text-body-4 text-primary">
					Mathe lernen
				</Text>
				<Text className="font-normal font-poppins text-body-5 text-text">
					Deine Lernstunde startet in 60{"\n"}Minuten
				</Text>
			</View>
		</View>
	);
}

function numericDimension(
	value: SvgProps["width"] | SvgProps["height"],
	fallback: number,
) {
	return typeof value === "number" ? value : fallback;
}

export function IntroTasksArtwork({ width, height }: SvgProps) {
	const resolvedWidth = numericDimension(width, ARTWORK_WIDTH);
	const resolvedHeight = numericDimension(height, ARTWORK_HEIGHT);
	const scale = Math.min(
		resolvedWidth / ARTWORK_WIDTH,
		resolvedHeight / ARTWORK_HEIGHT,
	);

	// Runtime viewport dimensions and responsive scaling are style-prop exceptions.
	return (
		<View
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
			className="items-center justify-center"
			style={{ width: resolvedWidth, height: resolvedHeight }}
		>
			<View
				className="relative h-[242px] w-[356px]"
				style={{ transform: [{ scale }] }}
			>
				<TaskCard />
				<StreakCard />
				<ReminderCard />
			</View>
		</View>
	);
}

// NativeWind owns static styling above. These RN styles are intentionally
// limited to the fixed 356x242 Figma artboard coordinates and transforms.
// expo-linear-gradient also requires its background geometry through `style`.
// See docs/contexts/design-system/adr/onboarding-artwork-rendering.md.
const gradientBackgroundStyle = StyleSheet.absoluteFill;
const artworkGeometry = StyleSheet.create({
	taskCard: {
		left: 6.18,
		top: 37.54,
		width: 179.7,
		height: 102.7,
		transform: [{ rotate: "-12deg" }],
		transformOrigin: [0, 0, 0],
	},
	streakCard: {
		left: 196.43,
		top: 13.86,
		width: 142.44,
		height: 110.79,
		transform: [{ rotate: "7.823deg" }],
		transformOrigin: [0, 0, 0],
	},
	reminderCard: {
		left: 38,
		top: 127,
		width: 268.54,
		height: 74.18,
	},
});
