import type { Config } from "tailwindcss";

/**
 * Commerce Admin design system — Tailwind token mapping (design-system §11).
 * Colors/radius/shadow/font are driven by the CSS variables defined on :root in
 * globals.css so the system stays white-label (override the accent ramp only).
 */
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "var(--canvas)",
        surface: {
          DEFAULT: "var(--surface)",
          subtle: "var(--surface-subtle)",
          hover: "var(--surface-hover)",
        },
        border: {
          DEFAULT: "var(--border)",
          strong: "var(--border-strong)",
        },
        text: {
          DEFAULT: "var(--text)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
          faint: "var(--text-faint)",
        },
        accent: {
          50: "var(--accent-50)",
          100: "var(--accent-100)",
          500: "var(--accent-500)",
          600: "var(--accent-600)",
          700: "var(--accent-700)",
          fg: "var(--accent-fg)",
        },
        success: { DEFAULT: "#16A34A", 50: "#F0FDF4" },
        warning: { DEFAULT: "#D97706", 50: "#FFFBEB" },
        error: { DEFAULT: "#DC2626", 50: "#FEF2F2" },
        info: { DEFAULT: "#0284C7", 50: "#F0F9FF" },
        viz: {
          1: "#4F46E5",
          2: "#06B6D4",
          3: "#F59E0B",
          4: "#10B981",
          5: "#8B5CF6",
          6: "#F43F5E",
          7: "#64748B",
        },
        // `brand` kept as an alias → accent for back-compat during migration.
        brand: {
          50: "var(--accent-50)",
          100: "var(--accent-100)",
          500: "var(--accent-500)",
          600: "var(--accent-600)",
          700: "var(--accent-700)",
        },
      },
      borderColor: {
        DEFAULT: "var(--border)",
      },
      borderRadius: {
        sm: "6px",
        md: "8px",
        lg: "12px",
        xl: "16px",
      },
      boxShadow: {
        xs: "0 1px 2px rgba(16,24,40,.04)",
        sm: "0 1px 2px rgba(16,24,40,.06),0 1px 3px rgba(16,24,40,.08)",
        md: "0 2px 4px -2px rgba(16,24,40,.06),0 6px 12px -2px rgba(16,24,40,.10)",
        lg: "0 8px 24px -4px rgba(16,24,40,.12),0 4px 8px -4px rgba(16,24,40,.06)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Hind Siliguri", "system-ui", "sans-serif"],
      },
      fontSize: {
        // admin type scale (design-system §4.1)
        display: ["30px", { lineHeight: "36px", fontWeight: "700" }],
        eyebrow: ["11px", { lineHeight: "16px", fontWeight: "600", letterSpacing: "0.04em" }],
      },
      ringColor: {
        DEFAULT: "var(--accent-600)",
      },
    },
  },
  plugins: [],
};

export default config;
