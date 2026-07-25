import Svg, {
	Circle,
	Defs,
	FeDropShadow,
	Filter,
	G,
	LinearGradient,
	Path,
	Rect,
	Stop,
	type SvgProps,
	Text as SvgText,
} from "react-native-svg";
import { useDayovaTheme } from "~/lib/theme";

const UPLOAD_ARTWORK_VIEW_BOX = "0 0 345 313";
// Preserve the approved Figma illustration's exported label weight. This is
// artwork typography rather than an app text-hierarchy role.
const UPLOAD_ARTWORK_LABEL_WEIGHT = "700";

export function IntroUploadArtwork(props: SvgProps) {
	const { colors, isDark } = useDayovaTheme();

	return (
		<Svg viewBox={UPLOAD_ARTWORK_VIEW_BOX} fill="none" {...props}>
			<Defs>
				<LinearGradient id="uploadBlue" x1="0" y1="0" x2="0" y2="1">
					<Stop offset="0" stopColor={colors.primaryStrong} />
					<Stop offset="1" stopColor={colors.primaryAccent} />
				</LinearGradient>
				<Filter
					id="uploadShadow"
					x="-28"
					y="-18"
					width="401"
					height="381"
					filterUnits="userSpaceOnUse"
				>
					<FeDropShadow
						dx="0"
						dy="32"
						stdDeviation="20"
						floodColor={colors.uploadArtworkShadow}
						floodOpacity={isDark ? 0.2 : 0.12}
					/>
				</Filter>
			</Defs>
			<G filter="url(#uploadShadow)">
				<Rect width="345" height="313" rx="32" fill={colors.surface} />
				<SvgText
					x="172.5"
					y="39"
					textAnchor="middle"
					fill={colors.text}
					fontSize="20"
					fontFamily="Poppins"
					fontWeight={UPLOAD_ARTWORK_LABEL_WEIGHT}
				>
					Hochladen
				</SvgText>
				<SvgText
					x="172.5"
					y="67"
					textAnchor="middle"
					fill={colors.secondaryText}
					fontSize="12"
					fontFamily="Poppins"
				>
					Lade deine Mitschriften hoch
				</SvgText>
				<Rect
					x="13"
					y="81"
					width="321"
					height="220"
					rx="20"
					fill={colors.surface}
					stroke={colors.uploadArtworkBorder}
					strokeWidth="2"
					strokeDasharray="20 10"
				/>
				<Rect
					x="149"
					y="130"
					width="47"
					height="47"
					fill={colors.uploadArtworkIconBackground}
					stroke={colors.uploadArtworkIconBorder}
					strokeWidth="2"
				/>
				<Rect
					x="158"
					y="142"
					width="18"
					height="18"
					rx="4"
					fill={colors.uploadArtworkIconFill}
				/>
				<Path
					d="M168 177h39"
					stroke={colors.uploadArtworkIconMuted}
					strokeWidth="2"
					strokeDasharray="3 3"
				/>
				<Circle cx="219" cy="172" r="14" fill={colors.uploadArtworkIconMuted} />
				<Path
					d="M219 179v-13M214 171l5-5 5 5"
					stroke={colors.light1}
					strokeWidth="2.4"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
				<Rect
					x="120"
					y="203"
					width="107"
					height="30"
					rx="15"
					fill="url(#uploadBlue)"
				/>
				<SvgText
					x="173.5"
					y="223"
					textAnchor="middle"
					fill={colors.light1}
					fontSize="12"
					fontFamily="Poppins"
					fontWeight={UPLOAD_ARTWORK_LABEL_WEIGHT}
				>
					Hochladen
				</SvgText>
				<SvgText
					x="172.5"
					y="270"
					textAnchor="middle"
					fill={colors.secondaryText}
					fontSize="12"
					fontFamily="Poppins"
				>
					oder Scanne deine Mitschriften
				</SvgText>
			</G>
		</Svg>
	);
}
