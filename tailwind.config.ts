import type { Config } from "tailwindcss";

type TailwindPreset = NonNullable<Config["presets"]>[number];
type TailwindPlugin = NonNullable<Config["plugins"]>[number];

const nativewindPreset = require("nativewind/preset") as TailwindPreset;
const tailwindcssAnimate = require("tailwindcss-animate") as TailwindPlugin;

const config = {
	content: [
		"./App.{js,jsx,ts,tsx}",
		"./app/**/*.{js,jsx,ts,tsx}",
		"./src/**/*.{js,jsx,ts,tsx}",
	],
	presets: [nativewindPreset],
	theme: {
		extend: {
			colors: {
				border: "hsl(var(--border))",
				input: "hsl(var(--input))",
				ring: "hsl(var(--ring))",
				background: "hsl(var(--background))",
				foreground: "hsl(var(--foreground))",
				surface: "hsl(var(--surface))",
				primary: {
					DEFAULT: "hsl(var(--primary))",
					foreground: "hsl(var(--primary-foreground))",
					strong: "hsl(var(--primary-strong))",
					100: "hsl(var(--primary-100))",
					90: "hsl(var(--primary-90))",
					80: "hsl(var(--primary-80))",
					70: "hsl(var(--primary-70))",
					60: "hsl(var(--primary-60))",
					50: "hsl(var(--primary-50))",
					40: "hsl(var(--primary-40))",
					30: "hsl(var(--primary-30))",
				},
				"button-neutral": {
					DEFAULT: "hsl(var(--button-neutral))",
					foreground: "hsl(var(--button-neutral-foreground))",
				},
				secondary: {
					DEFAULT: "hsl(var(--secondary))",
					foreground: "hsl(var(--secondary-foreground))",
					100: "hsl(var(--secondary-100))",
					90: "hsl(var(--secondary-90))",
					80: "hsl(var(--secondary-80))",
					70: "hsl(var(--secondary-70))",
					60: "hsl(var(--secondary-60))",
					50: "hsl(var(--secondary-50))",
					40: "hsl(var(--secondary-40))",
					30: "hsl(var(--secondary-30))",
				},
				destructive: {
					DEFAULT: "hsl(var(--destructive))",
					foreground: "hsl(var(--destructive-foreground))",
				},
				success: {
					DEFAULT: "hsl(var(--success))",
					foreground: "hsl(var(--success-foreground))",
					subtle: "hsl(var(--success-subtle))",
				},
				wrong: {
					DEFAULT: "hsl(var(--wrong))",
					foreground: "hsl(var(--wrong-foreground))",
					subtle: "hsl(var(--wrong-subtle))",
				},
				warning: {
					DEFAULT: "hsl(var(--warning))",
					foreground: "hsl(var(--warning-foreground))",
					subtle: "hsl(var(--warning-subtle))",
				},
				info: {
					DEFAULT: "hsl(var(--info))",
					foreground: "hsl(var(--info-foreground))",
					subtle: "hsl(var(--info-subtle))",
				},
				system: {
					DEFAULT: "hsl(var(--system))",
					foreground: "hsl(var(--system-foreground))",
					subtle: "hsl(var(--system-subtle))",
				},
				theorie: {
					DEFAULT: "hsl(var(--theorie))",
					foreground: "hsl(var(--theorie-foreground))",
					subtle: "hsl(var(--theorie-subtle))",
				},
				ueben: {
					DEFAULT: "hsl(var(--ueben))",
					foreground: "hsl(var(--ueben-foreground))",
					subtle: "hsl(var(--ueben-subtle))",
				},
				praxis: {
					DEFAULT: "hsl(var(--praxis))",
					foreground: "hsl(var(--praxis-foreground))",
					subtle: "hsl(var(--praxis-subtle))",
				},
				hausaufgabe: {
					subtle: "hsl(var(--hausaufgabe-subtle))",
				},
				muted: {
					DEFAULT: "hsl(var(--muted))",
					foreground: "hsl(var(--muted-foreground))",
				},
				accent: {
					DEFAULT: "hsl(var(--accent))",
					foreground: "hsl(var(--accent-foreground))",
				},
				popover: {
					DEFAULT: "hsl(var(--popover))",
					foreground: "hsl(var(--popover-foreground))",
				},
				card: {
					DEFAULT: "hsl(var(--card))",
					foreground: "hsl(var(--card-foreground))",
				},
				text: "hsl(var(--foreground))",
				bg: "hsl(var(--background))",
				light: {
					1: "hsl(var(--light-1))",
					2: "hsl(var(--light-2))",
					3: "hsl(var(--light-3))",
				},
				path: {
					1: "hsl(var(--path-1))",
					2: "hsl(var(--path-2))",
					3: "hsl(var(--path-3))",
					4: "hsl(var(--path-4))",
					5: "hsl(var(--path-5))",
					6: "hsl(var(--path-6))",
					7: "hsl(var(--path-7))",
				},
				black: {
					DEFAULT: "hsl(var(--black-100))",
					100: "hsl(var(--black-100))",
					90: "hsl(var(--black-90))",
					80: "hsl(var(--black-80))",
					70: "hsl(var(--black-70))",
					60: "hsl(var(--black-60))",
					50: "hsl(var(--black-50))",
					40: "hsl(var(--black-40))",
					30: "hsl(var(--black-30))",
					20: "hsl(var(--black-20))",
					10: "hsl(var(--black-10))",
				},
				white: {
					DEFAULT: "hsl(var(--white-100))",
					100: "hsl(var(--white-100))",
					90: "hsl(var(--white-90))",
					80: "hsl(var(--white-80))",
					70: "hsl(var(--white-70))",
					60: "hsl(var(--white-60))",
					50: "hsl(var(--white-50))",
					40: "hsl(var(--white-40))",
					30: "hsl(var(--white-30))",
					20: "hsl(var(--white-20))",
					10: "hsl(var(--white-10))",
				},
			},
			fontFamily: {
				poppins: ["Poppins"],
			},
			fontSize: {
				"heading-1": ["32px", { lineHeight: "48px", letterSpacing: "0px" }],
				"heading-2": ["24px", { lineHeight: "36px", letterSpacing: "0px" }],
				"body-1": ["20px", { lineHeight: "30px", letterSpacing: "0px" }],
				"body-2": ["16px", { lineHeight: "24px", letterSpacing: "0px" }],
				"body-3": ["14px", { lineHeight: "21px", letterSpacing: "0px" }],
				"body-4": ["12px", { lineHeight: "18px", letterSpacing: "0px" }],
				"body-5": ["10px", { lineHeight: "15px", letterSpacing: "0px" }],
				"10": ["10px", { lineHeight: "15px", letterSpacing: "0px" }],
				"12": ["12px", { lineHeight: "18px", letterSpacing: "0px" }],
				"14": ["14px", { lineHeight: "21px", letterSpacing: "0px" }],
				"16": ["16px", { lineHeight: "24px", letterSpacing: "0px" }],
				"20": ["20px", { lineHeight: "30px", letterSpacing: "0px" }],
				"24": ["24px", { lineHeight: "36px", letterSpacing: "0px" }],
				"32": ["32px", { lineHeight: "48px", letterSpacing: "0px" }],
			},
			borderRadius: {
				lg: "var(--radius)",
				md: "var(--radius-md)",
				sm: "var(--radius-sm)",
				card: "32px",
				button: "var(--button-radius)",
				input: "28px",
				tab: "28px",
			},
			borderWidth: {
				hairline: "0.3px",
			},
			keyframes: {
				"accordion-down": {
					from: { height: "0" },
					to: { height: "var(--radix-accordion-content-height)" },
				},
				"accordion-up": {
					from: { height: "var(--radix-accordion-content-height)" },
					to: { height: "0" },
				},
			},
			animation: {
				"accordion-down": "accordion-down 0.2s ease-out",
				"accordion-up": "accordion-up 0.2s ease-out",
			},
		},
	},
	plugins: [tailwindcssAnimate],
} satisfies Config;

export default config;
