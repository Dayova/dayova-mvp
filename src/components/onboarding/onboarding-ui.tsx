import { LinearGradient } from "expo-linear-gradient";
import { Image, Pressable, View } from "react-native";
import {
	ArrowUpRight,
	Check,
	ClipboardEdit,
	Dumbbell,
} from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { cn } from "~/lib/utils";
import type { IntroStep } from "./onboarding-flow";

const logoSource = require("../../../assets/onboarding/dayova-y.png");

const colors = DAYOVA_DESIGN_SYSTEM.colors;
const gradient = DAYOVA_DESIGN_SYSTEM.gradients.primaryInteractive;
const taskPreviewRows = [
	{ id: "first", label: "Tippen zum Aufdecken" },
	{ id: "second", label: "Tippen zum Aufdecken" },
	{ id: "third", label: "Tippen zum Aufdecken" },
] as const;
const streakDays = [
	{ id: "mon", label: "M" },
	{ id: "tue", label: "T" },
	{ id: "wed", label: "W" },
	{ id: "thu", label: "T" },
	{ id: "fri", label: "F" },
	{ id: "sat", label: "S" },
	{ id: "sun", label: "S" },
] as const;

function MiniTaskCard() {
	return (
		<View
			className="-rotate-12 overflow-hidden rounded-[16px] border border-border bg-white"
			style={{ width: 180, height: 103 }}
		>
			<LinearGradient
				colors={gradient.colors}
				start={gradient.start}
				end={gradient.end}
				style={{ height: 22 }}
			/>
			<View className="gap-2 px-3 pt-2">
				{taskPreviewRows.map((row) => (
					<View
						key={row.id}
						className="flex-row items-center gap-1 border-border"
					>
						<View className="h-2 w-2 rounded-full border border-primary" />
						<Text className="font-medium font-poppins text-[6px] text-primary leading-[8px]">
							{row.label}
						</Text>
					</View>
				))}
			</View>
			<View className="absolute top-1 left-3 flex-row items-center gap-1">
				<ClipboardEdit size={10} color={colors.light1} strokeWidth={2} />
				<Text className="font-poppins font-semibold text-[8px] text-white leading-[18px]">
					Deine Aufgaben
				</Text>
			</View>
		</View>
	);
}

function StreakCard() {
	return (
		<LinearGradient
			colors={gradient.colors}
			start={gradient.start}
			end={gradient.end}
			style={{
				width: 142,
				height: 111,
				borderRadius: 16,
				transform: [{ rotate: "8deg" }],
				padding: 10,
				boxShadow: "0 20px 24px -4px rgba(16, 24, 40, 0.08)",
			}}
		>
			<View className="items-center gap-1">
				<View className="flex-row items-center gap-1">
					<Dumbbell size={12} color={colors.light1} strokeWidth={2} />
					<Text className="font-poppins font-semibold text-[14px] text-white leading-[17px]">
						4
					</Text>
				</View>
				<Text className="font-medium font-poppins text-[6px] text-white leading-[8px]">
					Erfolgreiche Lerntage
				</Text>
			</View>
			<View className="mt-3 flex-row justify-between">
				{streakDays.map((day, index) => (
					<View key={day.id} className="items-center gap-1">
						<Text className="font-poppins text-[6px] text-white">
							{day.label}
						</Text>
						<View className="h-4 w-4 items-center justify-center rounded-full bg-white/30">
							{index < 4 ? (
								<Check size={10} color={colors.light1} strokeWidth={2} />
							) : null}
						</View>
					</View>
				))}
			</View>
			<Text className="mt-2 text-center font-poppins text-[6px] text-white/75 leading-[8px]">
				Weiter so! Du hast schon 4 Lerntage abgeschlossen
			</Text>
		</LinearGradient>
	);
}

function NotificationCard() {
	return (
		<View
			className="flex-row items-center rounded-[16px] border border-border bg-white px-3 py-2"
			style={{
				width: 268,
				boxShadow: "0 20px 24px rgba(16, 24, 40, 0.08)",
			}}
		>
			<View className="h-9 w-9 items-center justify-center rounded-full border border-border">
				<Image
					source={logoSource}
					resizeMode="contain"
					style={{ width: 28, height: 28 }}
				/>
			</View>
			<View className="mx-3 h-9 w-px bg-border" />
			<View className="flex-1">
				<Text className="font-medium font-poppins text-[12px] text-primary leading-[17px]">
					Mathe lernen
				</Text>
				<Text className="font-poppins text-[10px] text-text leading-[15px]">
					Deine Lernstunde startet in 60 Minuten
				</Text>
			</View>
		</View>
	);
}

export function OnboardingIntroArtwork({
	illustration,
}: {
	illustration: IntroStep["illustration"];
}) {
	const rotate = illustration === "success" ? "5deg" : "0deg";

	return (
		<View className="relative h-[300px] w-full items-center justify-center">
			<View style={{ transform: [{ rotate }] }}>
				<MiniTaskCard />
			</View>
			<View className="absolute top-[76px] right-[30px]">
				<StreakCard />
			</View>
			<View className="absolute bottom-[44px]">
				<NotificationCard />
			</View>
		</View>
	);
}

export function ProgressDots({
	activeIndex,
	count,
}: {
	activeIndex: number;
	count: number;
}) {
	const dots = Array.from({ length: count }, (_, index) => ({
		id: `intro-dot-${index + 1}`,
		index,
	}));

	return (
		<View className="flex-row items-center justify-center gap-[7px]">
			{dots.map((dot) => (
				<View
					key={dot.id}
					className="h-[6px] rounded-full"
					style={{
						width: dot.index === activeIndex ? 34 : 8,
						backgroundColor:
							dot.index === activeIndex
								? colors.buttonNeutral
								: `${colors.buttonNeutral}80`,
					}}
				/>
			))}
		</View>
	);
}

export function CircleProgressButton({
	accessibilityLabel,
	disabled,
	onPress,
	progress,
}: {
	accessibilityLabel: string;
	disabled?: boolean;
	onPress: () => void;
	progress: number;
}) {
	return (
		<Pressable
			accessibilityLabel={accessibilityLabel}
			accessibilityRole="button"
			accessibilityState={{ disabled }}
			disabled={disabled}
			onPress={onPress}
			className="h-16 w-16 items-center justify-center rounded-full"
			style={{ opacity: disabled ? 0.5 : 1 }}
		>
			<View
				className="absolute rounded-full border-[3px] border-primary"
				style={{
					width: 80,
					height: 80,
					transform: [{ rotate: `${Math.max(progress, 0.08) * 270}deg` }],
				}}
			/>
			<View className="h-16 w-16 items-center justify-center rounded-full bg-button-neutral">
				<ArrowUpRight
					size={24}
					color={colors.light1}
					strokeWidth={2.2}
					style={{ transform: [{ rotate: "45deg" }] }}
				/>
			</View>
		</Pressable>
	);
}

export function OnboardingOption({
	label,
	onPress,
	selected,
}: {
	label: string;
	onPress: () => void;
	selected: boolean;
}) {
	return (
		<Pressable
			accessibilityLabel={label}
			accessibilityRole="radio"
			accessibilityState={{ selected }}
			className={cn("min-h-[60px] justify-center rounded-[22px] px-5")}
			onPress={onPress}
			style={{
				backgroundColor: selected ? colors.primary : colors.surface,
				borderColor: selected ? colors.primary : `${colors.text}14`,
				borderWidth: 1.2,
				boxShadow: selected
					? "0 12px 26px rgba(0, 186, 255, 0.18)"
					: "0 10px 22px rgba(20, 28, 48, 0.05)",
			}}
		>
			<Text
				className={cn(
					"font-poppins font-semibold text-[16px]",
					selected ? "text-white" : "text-text",
				)}
			>
				{label}
			</Text>
		</Pressable>
	);
}
