/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#FF4CCF",
        secondary: "#3A7BFF",
        text: "#1A1A1A",
        bg: "#FFFFFF",
        black: "#1A1A1A",

        white: "#FFFFFF",
        background: "#FFFFFF",
      },
      fontFamily: {
        poppins: ["Poppins-Regular", "Poppins"],
        dmsans: ["DMSans-Regular", "DM Sans"],
        inter: ["Inter-Regular", "Inter"],
      },
      fontSize: {
        '12': '12px',
        '14': '14px',
        '16': '16px',
        '18': '18px',
        '20': '20px',
        '24': '24px',
        '32': '32px',
        '40': '40px',
        '56': '56px',
        '64': '64px',
      },
      spacing: {
        '4': '4px',
        '8': '8px',
        '12': '12px',
        '16': '16px',
        '24': '24px',
        '32': '32px',
        '36': '36px',
        '40': '40px',
        '48': '48px',
        '56': '56px',
        '64': '64px',
        '80': '80px',
        '120': '120px',
        '200': '200px',
      },
      borderRadius: {
        'card': '32px',
        'button': '24px',
        'input': '30px',
        'tab': '30px',
      }
    },
  },
  plugins: [],
};
