import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Base backgrounds
        "bg-void":     "var(--bg-void)",
        "bg-base":     "var(--bg-base)",
        "bg-surface":  "var(--bg-surface)",
        "bg-elevated": "var(--bg-elevated)",
        "bg-input":    "var(--bg-input)",
        // Brand
        "brand-400":   "var(--brand-400)",
        "brand-500":   "var(--brand-500)",
        "brand-600":   "var(--brand-600)",
        "brand-700":   "var(--brand-700)",
        "brand-accent":"var(--brand-accent)",
        // Semantic
        success:       "var(--success)",
        warning:       "var(--warning)",
        danger:        "var(--danger)",
        info:          "var(--info)",
        // Text
        "text-primary":   "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "text-muted":     "var(--text-muted)",
        // Stage colors
        "stage-embed":    "var(--stage-embed)",
        "stage-retrieve": "var(--stage-retrieve)",
        "stage-rerank":   "var(--stage-rerank)",
        "stage-generate": "var(--stage-generate)",
        "stage-stt":      "var(--stage-stt)",
      },
      fontFamily: {
        sans:  ["var(--font-inter)", "system-ui", "sans-serif"],
        grotesk: ["var(--font-grotesk)", "system-ui", "sans-serif"],
        mono:  ["var(--font-mono)", "monospace"],
      },
      backdropBlur: {
        glass: "16px",
      },
      boxShadow: {
        "glow-primary": "0 0 40px rgba(108,99,255,0.3)",
        "glow-accent":  "0 0 20px rgba(56,189,248,0.2)",
        "glow-mic":     "0 0 60px rgba(108,99,255,0.5), 0 0 120px rgba(168,85,247,0.2)",
        "glow-success": "0 0 20px rgba(16,185,129,0.3)",
        "glow-danger":  "0 0 20px rgba(239,68,68,0.3)",
        "glass":        "0 8px 32px rgba(0,0,0,0.4)",
      },
      animation: {
        "pulse-ring":    "pulse-ring 2s ease-out infinite",
        "pulse-ring-2":  "pulse-ring 2s ease-out infinite 0.5s",
        "wave-bar":      "wave-bar 1.2s ease-in-out infinite",
        "slide-up":      "slide-up 0.4s cubic-bezier(0.34,1.56,0.64,1)",
        "fade-in":       "fade-in 0.3s ease-out",
        "shimmer":       "shimmer 1.8s linear infinite",
        "glow-breathe":  "glow-breathe 3s ease-in-out infinite",
        "orbit-blob":    "orbit-blob 20s linear infinite",
        "orbit-blob-r":  "orbit-blob 25s linear infinite reverse",
        "typewriter":    "typewriter 0.8s steps(1) infinite",
        "score-fill":    "score-fill 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards",
        "shake":         "shake 0.5s cubic-bezier(0.36,0.07,0.19,0.97)",
      },
      keyframes: {
        "pulse-ring": {
          "0%":   { transform: "scale(1)",   opacity: "0.8" },
          "100%": { transform: "scale(2.2)", opacity: "0" },
        },
        "wave-bar": {
          "0%, 100%": { transform: "scaleY(0.4)" },
          "50%":      { transform: "scaleY(1.0)" },
        },
        "slide-up": {
          "0%":   { transform: "translateY(40px)", opacity: "0" },
          "100%": { transform: "translateY(0)",    opacity: "1" },
        },
        "fade-in": {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "shimmer": {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "glow-breathe": {
          "0%, 100%": { boxShadow: "0 0 40px rgba(108,99,255,0.3)" },
          "50%":      { boxShadow: "0 0 70px rgba(108,99,255,0.6), 0 0 120px rgba(168,85,247,0.3)" },
        },
        "orbit-blob": {
          "0%":   { transform: "rotate(0deg)   translateX(40px) rotate(0deg)" },
          "100%": { transform: "rotate(360deg) translateX(40px) rotate(-360deg)" },
        },
        "typewriter": {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0" },
        },
        "score-fill": {
          "0%":   { width: "0%" },
          "100%": { width: "var(--target-w)" },
        },
        "shake": {
          "10%, 90%":  { transform: "translateX(-2px)" },
          "20%, 80%":  { transform: "translateX(4px)"  },
          "30%, 50%, 70%": { transform: "translateX(-6px)" },
          "40%, 60%":  { transform: "translateX(6px)"  },
        },
      },
    },
  },
  plugins: [],
};

export default config;
