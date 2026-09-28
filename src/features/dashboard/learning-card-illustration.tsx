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
			>
				<LinearGradient
					colors={[`${colors.primaryStrong}60`, `${colors.primary}10`]}
					style={StyleSheet.absoluteFill}
				/>
			</View>
			<View
				className="overflow-hidden rounded-2xl border border-primary/40 bg-system-subtle"
				style={art.middle}
			>
				<LinearGradient
					colors={[`${colors.primaryStrong}90`, `${colors.primary}20`]}
					style={StyleSheet.absoluteFill}
				/>
			</View>
			<View
				className="items-center justify-center gap-2 overflow-hidden rounded-2xl border border-primary/50 bg-system-subtle"
				style={art.front}
			>
				<LinearGradient
					colors={
						isDark
							? [`${colors.primaryStrong}90`, colors.systemSubtle]
							: [colors.primaryStrong, `${colors.primary}70`]
					}
					style={StyleSheet.absoluteFill}
				/>
				{createElement(SubjectIcon, {
					size: 30,
					color: isDark ? colors.primaryAccent : colors.light1,
					strokeWidth: 1.8,
					testID: "learning-illustration-icon",
				})}
				<View className="rounded-full bg-white" style={art.wideLine} />
				<View className="self-start rounded-full bg-white" style={art.line} />
				<View
					className="self-start rounded-full bg-white"
					style={art.shortLine}
				/>
			</View>
			<View style={art.starLeft}>
				<Sparkles size={16} color={colors.primary} />
			</View>
			<View style={art.starRight}>
				<Sparkles size={12} color={colors.primaryStrong} />
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
	board: {
		width: 104,
		height: 128,
		alignSelf: "center",
		overflow: "hidden",
		flexShrink: 0,
	},
	back: {
		position: "absolute",
		width: 60,
		height: 80,
		left: 36,
		top: 35,
		opacity: 0.45,
		transform: [{ rotate: "18deg" }],
	},
	middle: {
		position: "absolute",
		width: 60,
		height: 80,
		left: 30,
		top: 17,
		opacity: 0.75,
		transform: [{ rotate: "12deg" }],
	},
	front: {
		position: "absolute",
		width: 60,
		height: 80,
		left: 12,
		top: 29,
		transform: [{ rotate: "12deg" }],
	},
	wideLine: { width: 32, height: 3, opacity: 0.35 },
	line: { marginLeft: 13, width: 26, height: 3, opacity: 0.3 },
	shortLine: { marginLeft: 13, width: 22, height: 3, opacity: 0.25 },
	fade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 44 },
	starLeft: { position: "absolute", left: 1, top: 12 },
	starRight: { position: "absolute", right: 0, bottom: 40 },
});
