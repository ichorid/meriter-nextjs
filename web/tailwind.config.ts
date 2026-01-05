import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';
import animate from 'tailwindcss-animate';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/features/**/*.{js,ts,jsx,tsx,mdx}',
    './src/shared/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // shadcn/ui theme colors mapped to existing CSS variables
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
          content: 'var(--primary-content)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
          content: 'var(--secondary-content)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
          content: 'var(--accent-content)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        chart: {
          '1': 'var(--chart-1)',
          '2': 'var(--chart-2)',
          '3': 'var(--chart-3)',
          '4': 'var(--chart-4)',
          '5': 'var(--chart-5)',
        },
        // Brand colors (preserved)
        brand: {
          primary: 'var(--brand-primary)',
          secondary: 'var(--brand-secondary)',
          accent: 'var(--brand-accent)',
          background: 'var(--brand-background)',
          surface: 'var(--brand-surface)',
          border: 'var(--brand-border)',
          text: {
            primary: 'var(--brand-text-primary)',
            secondary: 'var(--brand-text-secondary)',
            muted: 'var(--brand-text-muted)',
          }
        },
        // DaisyUI-compatible semantic colors via CSS variables
        base: {
          '100': 'var(--base-100)',
          '200': 'var(--base-200)',
          '300': 'var(--base-300)',
          content: 'var(--base-content)',
        },
        neutral: {
          DEFAULT: 'var(--neutral)',
          content: 'var(--neutral-content)',
        },
        info: {
          DEFAULT: 'var(--info)',
          content: 'var(--info-content)',
        },
        success: {
          DEFAULT: 'var(--success)',
          content: 'var(--success-content)',
        },
        warning: {
          DEFAULT: 'var(--warning)',
          content: 'var(--warning-content)',
        },
        error: {
          DEFAULT: 'var(--error)',
          content: 'var(--error-content)',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['Inter', 'Roboto', 'system-ui', 'sans-serif'],
        heading: ['Inter', 'Roboto', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [
    typography({
      target: 'modern',
    }),
    animate,
  ],
};

export default config;

