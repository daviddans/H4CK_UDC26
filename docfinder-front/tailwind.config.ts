import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      borderRadius: {
        xl: "0.9rem",
        "2xl": "1.2rem",
      },
      boxShadow: {
        soft: "0 10px 30px -18px rgba(15, 23, 42, 0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
