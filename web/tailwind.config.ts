import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

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
        primary: {
          DEFAULT: 'var(--primary)',
          content: 'var(--primary-content)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          content: 'var(--secondary-content)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          content: 'var(--accent-content)',
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
      fontFamily: {
        sans: ['Inter', 'Roboto', 'system-ui', 'sans-serif'],
        heading: ['Inter', 'Roboto', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [
    typography({
      target: 'modern',
    }),
  ],
};

export default config;

