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
        dark: {
          900: '#06060a',
          800: '#0d0d14',
          700: '#14141f',
          600: '#1a1a2e',
        },
        primary: {
          DEFAULT: "#6366f1",
          dark: "#4f46e5",
          light: "#818cf8",
        },
        accent: {
          domestic: "#22c55e",
          international: "#3b82f6",
          economic: "#f59e0b",
          political: "#ef4444",
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
          "0%, 100%": { boxShadow: "0 0 5px rgba(99, 102, 241, 0.3)" },
          "50%": { boxShadow: "0 0 20px rgba(99, 102, 241, 0.6)" },
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
          "0%, 100%": { borderColor: "rgba(99, 102, 241, 0.2)" },
          "50%": { borderColor: "rgba(99, 102, 241, 0.5)" },
        },
      },
      backdropBlur: {
        '3xl': '48px',
      },
      boxShadow: {
        'glow-sm': '0 0 10px rgba(99, 102, 241, 0.1)',
        'glow-md': '0 0 20px rgba(99, 102, 241, 0.15)',
        'glow-lg': '0 0 40px rgba(99, 102, 241, 0.2)',
        'glow-green': '0 0 12px rgba(34, 197, 94, 0.3)',
        'glow-amber': '0 0 12px rgba(245, 158, 11, 0.3)',
        'glow-red': '0 0 12px rgba(239, 68, 68, 0.3)',
      },
    },
  },
  plugins: [],
}
