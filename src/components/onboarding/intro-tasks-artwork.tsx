import { LinearGradient } from "expo-linear-gradient";
import { Image, StyleSheet, View } from "react-native";
import type { SvgProps } from "react-native-svg";
import Svg, { Circle } from "react-native-svg";
import { Check, ClipboardEdit, Flame } from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";

const ARTWORK_WIDTH = 356;
const ARTWORK_HEIGHT = 242;
const COLORS = DAYOVA_DESIGN_SYSTEM.colors;
const GRADIENT = DAYOVA_DESIGN_SYSTEM.gradients.primaryInteractive;
const TYPOGRAPHY = DAYOVA_DESIGN_SYSTEM.typography;
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
		<View style={styles.taskCard}>
			<LinearGradient
				colors={GRADIENT.colors}
				start={GRADIENT.start}
				end={GRADIENT.end}
				style={styles.taskHeader}
			>
				<ClipboardEdit size={10} color={COLORS.light1} strokeWidth={2} />
				<Text style={styles.taskHeaderText}>Deine Aufgaben</Text>
			</LinearGradient>

			<View style={styles.taskRows}>
				{taskPreviewRows.map((row, index) => (
					<View
						key={row.id}
						style={[
							styles.taskRow,
							index < taskPreviewRows.length - 1
								? styles.taskRowDivider
								: undefined,
						]}
					>
						<View style={styles.taskCircle} />
						<Text numberOfLines={1} style={styles.taskLabel}>
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
		<View style={styles.streakDay}>
			<Text style={styles.streakDayLabel}>{label}</Text>
			{state === "question" ? (
				<View style={[styles.streakCircle, styles.streakCircleQuestion]}>
					<Text style={styles.questionMark}>?</Text>
				</View>
			) : null}
			{state === "complete" ? (
				<View style={[styles.streakCircle, styles.streakCircleComplete]}>
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
				<View style={[styles.streakCircle, styles.streakCircleFuture]} />
			) : null}
		</View>
	);
}

function StreakCard() {
	return (
		<View style={styles.streakCardShadow}>
			<LinearGradient
				colors={GRADIENT.colors}
				start={GRADIENT.start}
				end={GRADIENT.end}
				style={styles.streakCard}
			>
				<View style={styles.streakHeading}>
					<View style={styles.streakCount}>
						<Flame size={13} color={COLORS.light1} strokeWidth={2.4} />
						<Text style={styles.streakNumber}>4</Text>
					</View>
					<Text style={styles.streakSubtitle}>Erfolgreiche Lerntage</Text>
				</View>

				<View style={styles.streakDays}>
					{streakDays.map((day) => (
						<StreakDay key={day.id} label={day.label} state={day.state} />
					))}
				</View>

				<Text style={styles.streakFooter}>
					Weiter so! Du hast schon 4{"\n"}Lerntage abgeschlossen
				</Text>
			</LinearGradient>
		</View>
	);
}

function ReminderCard() {
	return (
		<View style={styles.reminderCard}>
			<View style={styles.logoCircle}>
				<Image source={logoSource} resizeMode="contain" style={styles.logo} />
			</View>
			<View style={styles.reminderDivider} />
			<View style={styles.reminderCopy}>
				<Text style={styles.reminderTitle}>Mathe lernen</Text>
				<Text style={styles.reminderBody}>
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

	return (
		<View
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
			style={[
				styles.viewport,
				{ width: resolvedWidth, height: resolvedHeight },
			]}
		>
			<View style={[styles.canvas, { transform: [{ scale }] }]}>
				<TaskCard />
				<StreakCard />
				<ReminderCard />
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	viewport: {
		alignItems: "center",
		justifyContent: "center",
	},
	canvas: {
		width: ARTWORK_WIDTH,
		height: ARTWORK_HEIGHT,
	},
	taskCard: {
		position: "absolute",
		left: 6.18,
		top: 37.54,
		width: 179.7,
		height: 102.7,
		borderRadius: 15.85,
		borderColor: COLORS.border,
		borderWidth: 0.3,
		backgroundColor: COLORS.surface,
		overflow: "hidden",
		transform: [{ rotate: "-12deg" }],
		transformOrigin: [0, 0, 0],
	},
	taskHeader: {
		height: 25,
		flexDirection: "row",
		alignItems: "center",
		gap: 5,
		paddingHorizontal: 13,
	},
	taskHeaderText: {
		fontSize: 8,
		lineHeight: 12,
		fontWeight: "600",
		color: COLORS.light1,
	},
	taskRows: {
		paddingLeft: 17,
		paddingRight: 7,
	},
	taskRow: {
		height: 25.7,
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
	},
	taskRowDivider: {
		borderBottomColor: COLORS.border,
		borderBottomWidth: 1,
	},
	taskCircle: {
		width: 8,
		height: 8,
		borderRadius: 4,
		borderColor: COLORS.primary,
		borderWidth: 1,
	},
	taskLabel: {
		flex: 1,
		fontSize: 6.5,
		lineHeight: 9,
		fontWeight: "400",
		color: COLORS.primary,
	},
	streakCardShadow: {
		position: "absolute",
		left: 196.43,
		top: 13.86,
		width: 142.44,
		height: 110.79,
		borderRadius: 16,
		...DAYOVA_DESIGN_SYSTEM.elevation.soft,
		transform: [{ rotate: "7.823deg" }],
		transformOrigin: [0, 0, 0],
	},
	streakCard: {
		width: "100%",
		height: "100%",
		borderRadius: 16,
		paddingTop: 10,
		paddingHorizontal: 8,
		overflow: "hidden",
	},
	streakHeading: {
		alignItems: "center",
	},
	streakCount: {
		flexDirection: "row",
		alignItems: "center",
		gap: 3,
	},
	streakNumber: {
		fontSize: 14,
		lineHeight: 17,
		fontWeight: "600",
		color: COLORS.light1,
	},
	streakSubtitle: {
		fontSize: 6,
		lineHeight: 8,
		fontWeight: "400",
		color: COLORS.light1,
	},
	streakDays: {
		marginTop: 6,
		flexDirection: "row",
		justifyContent: "space-between",
	},
	streakDay: {
		width: 17,
		alignItems: "center",
		gap: 2,
	},
	streakDayLabel: {
		fontSize: 6,
		lineHeight: 8,
		fontWeight: "400",
		color: COLORS.light1,
	},
	streakCircle: {
		width: 17,
		height: 17,
		borderRadius: 8.5,
		alignItems: "center",
		justifyContent: "center",
	},
	streakCircleQuestion: {
		backgroundColor: COLORS.primaryStrong,
	},
	streakCircleComplete: {
		backgroundColor: COLORS.light1,
	},
	streakCircleFuture: {
		borderColor: COLORS.primaryStrong,
		borderWidth: 4,
	},
	questionMark: {
		fontSize: 9,
		lineHeight: 11,
		fontWeight: "600",
		color: COLORS.light1,
	},
	streakFooter: {
		marginTop: 6,
		fontSize: 6,
		lineHeight: 8,
		fontWeight: "400",
		textAlign: "center",
		color: COLORS.light1,
	},
	reminderCard: {
		position: "absolute",
		left: 38,
		top: 127,
		width: 268.54,
		height: 74.18,
		borderRadius: 16,
		borderColor: COLORS.border,
		borderWidth: 0.3,
		backgroundColor: COLORS.surface,
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 13.38,
		...DAYOVA_DESIGN_SYSTEM.elevation.surface,
	},
	logoCircle: {
		width: 35.4,
		height: 35.4,
		borderRadius: 17.7,
		borderColor: COLORS.border,
		borderWidth: 0.86,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: COLORS.surface,
	},
	logo: {
		width: 24,
		height: 24,
	},
	reminderDivider: {
		width: 1,
		height: 47,
		marginLeft: 11.5,
		marginRight: 16,
		backgroundColor: COLORS.border,
	},
	reminderCopy: {
		flex: 1,
		gap: 2,
	},
	reminderTitle: {
		...TYPOGRAPHY.body.sm,
		color: COLORS.primary,
	},
	reminderBody: {
		...TYPOGRAPHY.body.xs,
		color: COLORS.text,
	},
});
