import { LinearGradient } from "expo-linear-gradient";
import { createElement } from "react";
import { StyleSheet, View } from "react-native";
import { GraduationCap, Sparkles } from "~/components/ui/icon";
import { getSubjectIcon } from "~/features/subjects/subject-catalog";
import { useDayovaTheme } from "~/lib/theme";

/** DAY-490: decorative, theme-aware study cards; all glyphs come from Hugeicons. */
export function LearningCardIllustration({ subject }: { subject?: string }) {
	const { colors, isDark } = useDayovaTheme();
	const SubjectIcon = subject ? getSubjectIcon(subject) : GraduationCap;
	return (
		<View
			accessible={false}
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
			pointerEvents="none"
			style={art.board}
		>
			<View
				className="overflow-hidden rounded-2xl border border-primary/40 bg-system-subtle"
				style={art.back}
			/>
			<View
				className="overflow-hidden rounded-2xl border border-primary/40 bg-system-subtle"
				style={art.middle}
			/>
			<View
				className="items-center justify-center gap-2 overflow-hidden rounded-2xl border border-primary/50"
				style={art.front}
			>
				<LinearGradient
					colors={
						isDark
							? [colors.systemSubtle, colors.background]
							: [colors.surface, colors.systemSubtle]
					}
					style={StyleSheet.absoluteFill}
				/>
				{createElement(SubjectIcon, {
					size: 36,
					color: colors.primaryStrong,
					strokeWidth: 1.8,
					testID: "learning-illustration-icon",
				})}
				<View className="rounded-full bg-primary" style={art.wideLine} />
				<View className="self-start rounded-full bg-primary" style={art.line} />
				<View
					className="self-start rounded-full bg-primary"
					style={art.shortLine}
				/>
			</View>
			<View style={art.starLeft}>
				<Sparkles size={23} color={colors.primary} />
			</View>
			<View style={art.starRight}>
				<Sparkles size={17} color={colors.primaryStrong} />
			</View>
			{/* Native gradient fades all card edges into the identical hero-top color. */}
			<LinearGradient
				colors={[`${colors.systemSubtle}00`, colors.systemSubtle]}
				locations={[0, 1]}
				style={art.fade}
			/>
		</View>
	);
}

// Fixed decorative artboard geometry, not content layout (docs/styling.md).
const art = StyleSheet.create({
	board: { width: 208, height: 100, alignSelf: "center", overflow: "hidden" },
	back: {
		position: "absolute",
		width: 76,
		height: 88,
		left: 91,
		top: 30,
		opacity: 0.45,
		transform: [{ rotate: "18deg" }],
	},
	middle: {
		position: "absolute",
		width: 76,
		height: 88,
		left: 77,
		top: 5,
		opacity: 0.75,
		transform: [{ rotate: "12deg" }],
	},
	front: {
		position: "absolute",
		width: 76,
		height: 92,
		left: 56,
		top: 14,
		transform: [{ rotate: "12deg" }],
	},
	wideLine: { width: 48, height: 4, opacity: 0.25 },
	line: { marginLeft: 16, width: 32, height: 4, opacity: 0.2 },
	shortLine: { marginLeft: 16, width: 28, height: 4, opacity: 0.15 },
	fade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 48 },
	starLeft: { position: "absolute", left: 18, top: 27 },
	starRight: { position: "absolute", right: 10, bottom: 22 },
});
