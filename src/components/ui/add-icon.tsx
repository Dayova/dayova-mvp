import { View } from "react-native";
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
	outlinedGradient = false,
}: {
	outlinedGradient?: boolean;
}) {
	const { colors } = useDayovaTheme();

	if (outlinedGradient) {
		return (
			<View
				pointerEvents="none"
				className="h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border bg-card"
			>
				<GradientPlus />
			</View>
		);
	}

	return (
		<View
			pointerEvents="none"
			className="h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10"
		>
			<Plus size={22} color={colors.primary} strokeWidth={2.2} />
		</View>
	);
}
