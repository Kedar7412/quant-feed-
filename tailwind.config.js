/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Deep charcoal (not pure black) with subtle warmth
        dark: {
          900: '#0a0a0a',
          800: '#141414',
          700: '#1a1a1a',
          600: '#1c1c1e',
          500: '#242424',
        },
        // Charcoal panel + border tokens matching the reference dashboard
        panel: {
          DEFAULT: '#1a1a1a',
          alt: '#1c1c1e',
          raised: '#242424',
          border: '#2a2a2a',
        },
        // Primary accent is now the lime-to-emerald green used sparingly
        primary: {
          DEFAULT: "#a3e635", // lime
          dark: "#4ade80",    // emerald
          light: "#bef264",
        },
        // Lime / emerald green accent scale
        lime: {
          DEFAULT: '#a3e635',
          soft: '#bef264',
        },
        emerald: {
          DEFAULT: '#4ade80',
          soft: '#86efac',
        },
        // Beige / tan accent for the premium featured card
        beige: {
          DEFAULT: '#d4c5a9',
          soft: '#e5dcc8',
          dark: '#b8a884',
        },
        // Muted secondary text
        muted: '#8a8a8a',
        accent: {
          domestic: "#4ade80",
          international: "#38bdf8",
          economic: "#facc15",
          political: "#f87171",
        },
      },
      animation: {
        glow: "glow 2s ease-in-out infinite",
        float: "float 6s ease-in-out infinite",
        shimmer: "shimmer 2s linear infinite",
        fadeIn: "fadeIn 0.5s ease-out forwards",
        slideUp: "slideUp 0.5s ease-out forwards",
        scaleIn: "scaleIn 0.4s ease-out forwards",
        borderGlow: "borderGlow 3s ease-in-out infinite",
      },
      keyframes: {
        glow: {
          "0%, 100%": { boxShadow: "0 0 5px rgba(163, 230, 53, 0.25)" },
          "50%": { boxShadow: "0 0 20px rgba(163, 230, 53, 0.5)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-6px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        borderGlow: {
          "0%, 100%": { borderColor: "rgba(163, 230, 53, 0.15)" },
          "50%": { borderColor: "rgba(163, 230, 53, 0.4)" },
        },
      },
      backdropBlur: {
        '3xl': '48px',
      },
      boxShadow: {
        'glow-sm': '0 0 10px rgba(163, 230, 53, 0.08)',
        'glow-md': '0 0 20px rgba(163, 230, 53, 0.12)',
        'glow-lg': '0 0 40px rgba(163, 230, 53, 0.18)',
        'glow-green': '0 0 12px rgba(74, 222, 128, 0.3)',
        'glow-amber': '0 0 12px rgba(250, 204, 21, 0.3)',
        'glow-red': '0 0 12px rgba(248, 113, 113, 0.3)',
      },
    },
  },
  plugins: [],
}
