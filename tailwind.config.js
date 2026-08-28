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
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "#6366f1",
          dark: "#4f46e5",
        },
        accent: {
          domestic: "#22c55e",
          international: "#3b82f6",
          economic: "#f59e0b",
          political: "#ef4444",
        },
      },
    },
  },
  plugins: [],
}
