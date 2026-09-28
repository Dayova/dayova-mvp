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
					size: 40,
					color: colors.primaryStrong,
					strokeWidth: 1.8,
					testID: "learning-illustration-icon",
				})}
				<View className="rounded-full bg-primary" style={art.wideLine} />
				<View className="self-start rounded-full bg-primary" style={art.line} />
			</View>
			<View style={art.starLeft}>
				<Sparkles size={23} color={colors.primary} />
			</View>
			<View style={art.starRight}>
				<Sparkles size={17} color={colors.primaryStrong} />
			</View>
		</View>
	);
}

// Fixed decorative artboard geometry, not content layout (docs/styling.md).
const art = StyleSheet.create({
	board: { width: 208, height: 116, alignSelf: "center" },
	back: {
		position: "absolute",
		width: 80,
		height: 92,
		left: 85,
		top: 15,
		transform: [{ rotate: "18deg" }],
	},
	middle: {
		position: "absolute",
		width: 80,
		height: 96,
		left: 73,
		top: 5,
		transform: [{ rotate: "10deg" }],
	},
	front: {
		position: "absolute",
		width: 80,
		height: 96,
		left: 56,
		top: 14,
		transform: [{ rotate: "-10deg" }],
	},
	wideLine: { width: 48, height: 4, opacity: 0.25 },
	line: { marginLeft: 16, width: 32, height: 4, opacity: 0.2 },
	starLeft: { position: "absolute", left: 18, top: 27 },
	starRight: { position: "absolute", right: 10, bottom: 22 },
});
