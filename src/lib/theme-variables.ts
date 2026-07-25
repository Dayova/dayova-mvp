/**
 * NativeWind's global root-variable observers do not currently invalidate
 * already-mounted Fabric views after an Appearance override on React Native
 * 0.86. Applying the dark variables through a root View keeps descendants in
 * React's variable context while preserving the CSS declarations for web.
 *
 * Keep these values synchronized with `.dark:root` in global.css.
 */
export const DARK_THEME_VARIABLES = {
	"--background": "250 10% 8%",
	"--text": "36 15% 92%",
	"--secondary-text": "220 12% 68%",
	"--card": "248 10% 13%",
	"--popover": "248 10% 13%",
	"--surface": "248 10% 13%",
	"--primary": "196.2 100% 50%",
	"--primary-strong": "198.3 100% 58%",
	"--progress-track": "195.3 56.1% 13.5%",
	"--button-neutral": "0 0% 100%",
	"--secondary": "279.9 68% 66%",
	"--muted": "247 10% 18%",
	"--accent": "196.2 100% 18%",
	"--destructive": "3.2 100% 66%",
	"--success": "135.1 58.6% 56%",
	"--success-subtle": "142 45% 15%",
	"--wrong": "35.1 100% 58%",
	"--wrong-subtle": "33 70% 16%",
	"--info": "48.1 100% 58%",
	"--info-subtle": "50 65% 15%",
	"--system": "196.2 100% 50%",
	"--system-subtle": "204 62% 16%",
	"--theorie": "240.9 61% 68%",
	"--theorie-subtle": "246 35% 18%",
	"--ueben": "279.9 68% 66%",
	"--ueben-subtle": "280 34% 18%",
	"--praxis": "177.3 100% 45%",
	"--praxis-subtle": "176 45% 15%",
	"--hausaufgabe": "313 24.5% 70%",
	"--hausaufgabe-subtle": "313 22% 18%",
	"--border": "224 12% 24%",
	"--input": "224 12% 24%",
	"--ring": "196.2 100% 50%",
	"--chart-1": "196.2 100% 50%",
	"--chart-2": "279.9 68% 66%",
	"--chart-3": "135.1 58.6% 56%",
	"--chart-4": "35.1 100% 58%",
	"--chart-5": "var(--text)",
	"--light-1": "0 0% 100%",
	"--light-2": "247 10% 18%",
	"--light-3": "247 10% 21%",
	"--path-1": "224 12% 24%",
	"--path-2": "224 12% 24%",
	"--path-3": "220 12% 62%",
	"--path-4": "220 12% 68%",
	"--path-5": "198.3 100% 58%",
	"--path-6": "196.2 100% 50%",
	"--path-7": "193.3 100% 65.5%",
	"--black-100": "36 15% 92%",
	"--black-90": "36 12% 84%",
	"--black-80": "36 10% 76%",
	"--black-70": "220 12% 68%",
	"--black-60": "220 11% 59%",
	"--black-50": "220 10% 50%",
	"--black-40": "224 10% 41%",
	"--black-30": "224 11% 32%",
	"--black-20": "224 12% 24%",
	"--black-10": "248 10% 18%",
	"--white-100": "0 0% 100%",
	"--white-90": "36 15% 92%",
	"--white-80": "36 12% 84%",
	"--white-70": "36 10% 76%",
	"--white-60": "220 12% 68%",
	"--white-50": "220 11% 59%",
	"--white-40": "220 10% 50%",
	"--white-30": "224 10% 41%",
	"--white-20": "224 11% 32%",
	"--white-10": "224 12% 24%",
} as const;

type DarkThemeVariable = keyof typeof DARK_THEME_VARIABLES;

const numericHslToHex = (value: string) => {
	const match = value.match(
		/^(\d+(?:\.\d+)?) (\d+(?:\.\d+)?)% (\d+(?:\.\d+)?)%$/,
	);
	if (!match) {
		throw new Error(`Expected a numeric HSL theme value, received: ${value}`);
	}

	const hue = Number(match[1]);
	const saturation = Number(match[2]) / 100;
	const lightness = Number(match[3]) / 100;
	const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
	const intermediate = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
	const offset = lightness - chroma / 2;

	let red = 0;
	let green = 0;
	let blue = 0;

	if (hue < 60) {
		red = chroma;
		green = intermediate;
	} else if (hue < 120) {
		red = intermediate;
		green = chroma;
	} else if (hue < 180) {
		green = chroma;
		blue = intermediate;
	} else if (hue < 240) {
		green = intermediate;
		blue = chroma;
	} else if (hue < 300) {
		red = intermediate;
		blue = chroma;
	} else {
		red = chroma;
		blue = intermediate;
	}

	return `#${[red, green, blue]
		.map((component) =>
			Math.round((component + offset) * 255)
				.toString(16)
				.padStart(2, "0"),
		)
		.join("")}`.toUpperCase();
};

const darkThemeHex = (variable: DarkThemeVariable) =>
	numericHslToHex(DARK_THEME_VARIABLES[variable]);

const darkThemeHsl = (variable: DarkThemeVariable) =>
	`hsl(${DARK_THEME_VARIABLES[variable]})`;

/**
 * Plain React Native colors derived from the same HSL tokens that NativeWind
 * and web consume. The semantic-name mapping is the only duplicated layer.
 */
export const DARK_THEME_COLORS = {
	primary: darkThemeHex("--primary"),
	primaryStrong: darkThemeHex("--primary-strong"),
	primaryAccent: darkThemeHex("--path-7"),
	buttonNeutral: darkThemeHex("--button-neutral"),
	secondary: darkThemeHex("--secondary"),
	text: darkThemeHex("--text"),
	secondaryText: darkThemeHex("--secondary-text"),
	background: darkThemeHex("--background"),
	appBackground: darkThemeHex("--background"),
	surface: darkThemeHex("--surface"),
	light1: darkThemeHex("--light-1"),
	light2: darkThemeHex("--light-2"),
	light3: darkThemeHex("--light-3"),
	mutedSurface: darkThemeHex("--muted"),
	border: darkThemeHex("--border"),
	success: darkThemeHex("--success"),
	successSubtle: darkThemeHex("--success-subtle"),
	wrong: darkThemeHex("--wrong"),
	wrongSubtle: darkThemeHex("--wrong-subtle"),
	destructive: darkThemeHex("--destructive"),
	info: darkThemeHex("--info"),
	infoSubtle: darkThemeHex("--info-subtle"),
	system: darkThemeHex("--system"),
	systemSubtle: darkThemeHex("--system-subtle"),
	theorie: darkThemeHex("--theorie"),
	theorieSubtle: darkThemeHex("--theorie-subtle"),
	ueben: darkThemeHex("--ueben"),
	uebenSubtle: darkThemeHex("--ueben-subtle"),
	praxis: darkThemeHex("--praxis"),
	praxisSubtle: darkThemeHex("--praxis-subtle"),
	hausaufgabe: darkThemeHex("--hausaufgabe"),
	hausaufgabeSubtle: darkThemeHex("--hausaufgabe-subtle"),
	path1: darkThemeHex("--path-1"),
	path2: darkThemeHex("--path-2"),
	path3: darkThemeHex("--path-3"),
	path4: darkThemeHex("--path-4"),
	path5: darkThemeHex("--path-5"),
	path6: darkThemeHex("--path-6"),
	path7: darkThemeHex("--path-7"),
	pathLockedBase: "#ADB3BC",
	uploadArtworkBorder: darkThemeHex("--border"),
	uploadArtworkIconBackground: darkThemeHex("--light-2"),
	uploadArtworkIconBorder: darkThemeHex("--border"),
	uploadArtworkIconFill: darkThemeHex("--light-3"),
	uploadArtworkIconMuted: darkThemeHex("--path-3"),
	uploadArtworkShadow: "#000000",
} as const;

export const DARK_NAV_THEME_COLORS = {
	background: darkThemeHsl("--background"),
	border: darkThemeHsl("--border"),
	card: darkThemeHsl("--card"),
	notification: darkThemeHsl("--wrong"),
	primary: darkThemeHsl("--primary"),
	text: darkThemeHsl("--text"),
} as const;
