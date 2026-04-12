import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        base: "#FDFAF5",
        surface: "#F7F3EC",
        muted: "#EEE9DF",
        primary: {
          DEFAULT: "#7B6FCC",
          light: "#EDE9FF",
          dark: "#5B4FCF",
        },
        text: {
          primary: "#2D2A24",
          secondary: "#7A7060",
          muted: "#ADA494",
        },
        success: "#7DBF8E",
        warning: "#E8A84C",
        danger: "#D97B6C",
        border: {
          default: "#E5DFD3",
          soft: "#F0EBE1",
        },
        ticket: {
          DEFAULT: "#C4905A",
          light: "#FDF0E3",
        },
      },
      fontFamily: {
        sans: ["Pretendard", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
