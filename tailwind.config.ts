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
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
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
        // EV Green Theme Colors
        "ev-green": {
          50: "hsl(var(--ev-green-50))",
          100: "hsl(var(--ev-green-100))",
          200: "hsl(var(--ev-green-200))",
          300: "hsl(var(--ev-green-300))",
          400: "hsl(var(--ev-green-400))",
          500: "hsl(var(--ev-green-500))",
          600: "hsl(var(--ev-green-600))",
          700: "hsl(var(--ev-green-700))",
          800: "hsl(var(--ev-green-800))",
          900: "hsl(var(--ev-green-900))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      width: {
        sidebar: "240px",
        "sidebar-collapsed": "64px",
        "right-sidebar": "320px",
      },
      minWidth: {
        sidebar: "240px",
        "right-sidebar": "320px",
      },
      maxWidth: {
        sidebar: "240px",
        "right-sidebar": "320px",
      },
    },
  },
  plugins: [],
};
export default config;
