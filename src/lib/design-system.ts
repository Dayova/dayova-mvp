export const DAYOVA_DESIGN_SYSTEM = {
	brand: {
		attributes: ["structured", "clear", "trustworthy", "supportive", "calm"],
		direction:
			"Modern EdTech look with solid colors, bold systems, quiet hierarchy, and at most one gradient per view.",
	},
	colors: {
		primary: "#3A7BFF",
		secondary: "#FF4CCF",
		text: "#1A1A1A",
		background: "#FFFFFF",
	},
	typography: {
		fontFamily: "Poppins",
		headline: {
			desktop: {
				h1: { fontSize: 56, lineHeight: 67.2, fontWeight: "700" },
				h2: { fontSize: 40, lineHeight: 48, fontWeight: "700" },
				h3: { fontSize: 28, lineHeight: 33.6, fontWeight: "700" },
				h4: { fontSize: 20, lineHeight: 24, fontWeight: "700" },
			},
			mobile: {
				h1: { fontSize: 32, lineHeight: 38.4, fontWeight: "700" },
				h2: { fontSize: 28, lineHeight: 33.6, fontWeight: "700" },
				h3: { fontSize: 24, lineHeight: 28.8, fontWeight: "700" },
				h4: { fontSize: 20, lineHeight: 24, fontWeight: "700" },
			},
		},
		body: {
			desktop: {
				lg: { fontSize: 18, lineHeight: 25.2, fontWeight: "400" },
				lgBold: { fontSize: 18, lineHeight: 25.2, fontWeight: "700" },
				md: { fontSize: 16, lineHeight: 22.4, fontWeight: "400" },
				mdBold: { fontSize: 16, lineHeight: 22.4, fontWeight: "700" },
				sm: { fontSize: 14, lineHeight: 19.6, fontWeight: "400" },
				smBold: { fontSize: 14, lineHeight: 19.6, fontWeight: "700" },
			},
			mobile: {
				lg: { fontSize: 16, lineHeight: 22.4, fontWeight: "400" },
				lgBold: { fontSize: 16, lineHeight: 22.4, fontWeight: "700" },
				md: { fontSize: 14, lineHeight: 19.6, fontWeight: "400" },
				mdBold: { fontSize: 14, lineHeight: 19.6, fontWeight: "700" },
				sm: { fontSize: 12, lineHeight: 16.8, fontWeight: "400" },
				smBold: { fontSize: 12, lineHeight: 16.8, fontWeight: "700" },
			},
		},
		button: {
			desktop: {
				default: { fontSize: 20, lineHeight: 24, fontWeight: "500" },
				small: { fontSize: 16, lineHeight: 24, fontWeight: "500" },
			},
			mobile: {
				small: { fontSize: 16, lineHeight: 24, fontWeight: "500" },
			},
		},
		field: {
			placeholder: { fontSize: 16, lineHeight: 24 },
			label: { fontSize: 12, lineHeight: 16 },
			description: { fontSize: 12, lineHeight: 16 },
		},
	},
	radius: {
		inner: 64,
		outer: 96,
		button: 50,
	},
} as const;
