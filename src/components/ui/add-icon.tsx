import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";
import {
	Defs,
	Path,
	Stop,
	Svg,
	LinearGradient as SvgLinearGradient,
} from "react-native-svg";
import { Plus } from "~/components/ui/icon";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { useDayovaTheme } from "~/lib/theme";
import { cn } from "~/lib/utils";

const PRIMARY_GRADIENT = DAYOVA_DESIGN_SYSTEM.gradients.primaryInteractive;

function GradientPlus() {
	return (
		<Svg width={24} height={24} viewBox="0 0 24 24">
			<Defs>
				<SvgLinearGradient
					id="add-icon-gradient"
					x1="12"
					y1="3"
					x2="12"
					y2="21"
					gradientUnits="userSpaceOnUse"
				>
					<Stop offset="0" stopColor={PRIMARY_GRADIENT.colors[0]} />
					<Stop offset="1" stopColor={PRIMARY_GRADIENT.colors[1]} />
				</SvgLinearGradient>
			</Defs>
			<Path
				d="M12 4V20M4 12H20"
				fill="none"
				stroke="url(#add-icon-gradient)"
				strokeLinecap="round"
				strokeWidth={2.2}
			/>
		</Svg>
	);
}

/** Shared visual for add actions; the surrounding control supplies its label. */
export function AddIcon({
	emphasized = false,
	gradient = false,
	outlinedGradient = false,
}: {
	emphasized?: boolean;
	gradient?: boolean;
	outlinedGradient?: boolean;
}) {
	const { colors } = useDayovaTheme();
	if (outlinedGradient) {
		return (
			<LinearGradient
				pointerEvents="none"
				colors={PRIMARY_GRADIENT.colors}
				start={PRIMARY_GRADIENT.start}
				end={PRIMARY_GRADIENT.end}
				style={styles.outlinedContainer}
			>
				<View style={styles.outlinedInner}>
					<GradientPlus />
				</View>
			</LinearGradient>
		);
	}
	return (
		<View
			pointerEvents="none"
			className={cn(
				"h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full",
				emphasized ? "bg-secondary-text" : "bg-primary/10",
			)}
		>
			{gradient ? (
				<LinearGradient
					colors={DAYOVA_DESIGN_SYSTEM.gradients.primaryInteractive.colors}
					start={DAYOVA_DESIGN_SYSTEM.gradients.primaryInteractive.start}
					end={DAYOVA_DESIGN_SYSTEM.gradients.primaryInteractive.end}
					style={StyleSheet.absoluteFill}
				/>
			) : null}
			<Plus
				size={22}
				color={
					gradient ? "#FFFFFF" : emphasized ? colors.background : colors.primary
				}
				strokeWidth={2.2}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	outlinedContainer: {
		width: 48,
		height: 48,
		padding: 1.5,
		borderRadius: 24,
	},
	outlinedInner: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		borderRadius: 22.5,
		backgroundColor: "#FFFFFF",
	},
});
