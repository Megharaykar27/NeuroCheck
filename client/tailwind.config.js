/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F5F4F0",
        ink: "#101418",
        night: { DEFAULT: "#0B1420", soft: "#13202F", line: "#22324A" },
        muted: "#5B6470",
        line: "#E2DFD8",
        pulse: { DEFAULT: "#E5484D", soft: "#FCE9EA", dark: "#C1353A" },
        calm: { DEFAULT: "#0F8A7E", soft: "#E3F3F1" },
        warn: { DEFAULT: "#D98A1C", soft: "#FBF0DE" },
      },
      fontFamily: {
        display: ['"Space Grotesk"', "system-ui", "sans-serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,20,24,.04), 0 8px 24px -12px rgba(16,20,24,.12)",
      },
    },
  },
  plugins: [],
};
