/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#080A0F",
        surface: "#0F1626",
        "surface-light": "#182238",
        "surface-border": "#23314F",
        bullish: {
          DEFAULT: "#10B981",
          glow: "rgba(16, 185, 129, 0.15)",
          text: "#34D399",
        },
        bearish: {
          DEFAULT: "#EF4444",
          glow: "rgba(239, 68, 68, 0.15)",
          text: "#F87171",
        },
        accent: {
          cyan: "#06B6D4",
          amber: "#F59E0B",
          indigo: "#6366F1",
        },
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "flash-green": "flashGreen 1s ease-out",
        "flash-red": "flashRed 1s ease-out",
      },
      keyframes: {
        flashGreen: {
          "0%": { backgroundColor: "rgba(16, 185, 129, 0.35)" },
          "100%": { backgroundColor: "transparent" },
        },
        flashRed: {
          "0%": { backgroundColor: "rgba(239, 68, 68, 0.35)" },
          "100%": { backgroundColor: "transparent" },
        },
      },
    },
  },
  plugins: [],
};
