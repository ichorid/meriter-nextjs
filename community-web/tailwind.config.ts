import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: { DEFAULT: 'var(--card)', foreground: 'var(--card-foreground)' },
        primary: { DEFAULT: 'var(--primary)', foreground: 'var(--primary-foreground)' },
        muted: { DEFAULT: 'var(--muted)', foreground: 'var(--muted-foreground)' },
        border: 'var(--border)',
        stitch: {
          sidebar: 'rgb(var(--stitch-sidebar-rgb) / <alpha-value>)',
          canvas: 'rgb(var(--stitch-canvas-rgb) / <alpha-value>)',
          surface: 'rgb(var(--stitch-surface-rgb) / <alpha-value>)',
          accent: 'rgb(var(--stitch-accent-rgb) / <alpha-value>)',
          text: 'rgb(var(--stitch-text-rgb) / <alpha-value>)',
          muted: 'rgb(var(--stitch-muted-rgb) / <alpha-value>)',
          border: 'rgb(var(--stitch-border-rgb) / <alpha-value>)',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        xl: 'calc(var(--radius) + 4px)',
      },
      fontFamily: {
        sans: ['var(--font-manrope)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [animate],
};

export default config;
