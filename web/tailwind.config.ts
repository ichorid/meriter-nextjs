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
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#2563EB', // Blue 600 - Placeholder for Meriter Blue
          secondary: '#64748B', // Slate 500
          accent: '#0EA5E9', // Sky 500
          background: '#F8F9FA', // Gray 50
          surface: '#FFFFFF',
          text: {
            primary: '#1F2937', // Gray 800
            secondary: '#6B7280', // Gray 500
            muted: '#9CA3AF', // Gray 400
          }
        }
      },
      fontFamily: {
        sans: ['Inter', 'Roboto', 'system-ui', 'sans-serif'],
        heading: ['Inter', 'Roboto', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [typography],
};

export default config;

