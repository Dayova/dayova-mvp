export const DAYOVA_DESIGN_SYSTEM = {
  brand: {
    attributes: [
      "structured",
      "clear",
      "trustworthy",
      "supportive",
      "calm",
    ],
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
    body: {
      desktop: {
        lg: { fontSize: 18, lineHeight: 25.2 },
        md: { fontSize: 16, lineHeight: 22.4 },
        sm: { fontSize: 14, lineHeight: 19.6 },
      },
      mobile: {
        lg: { fontSize: 16, lineHeight: 22.4 },
        md: { fontSize: 14, lineHeight: 19.6 },
        sm: { fontSize: 12, lineHeight: 16.8 },
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
