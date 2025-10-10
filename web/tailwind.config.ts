import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/features/**/*.{js,ts,jsx,tsx,mdx}',
    './src/shared/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Roboto', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: [
      {
        light: {
          'primary': '#6200EE',
          'primary-content': '#FFFFFF',
          'secondary': '#03DAC6',
          'secondary-content': '#000000',
          'accent': '#FF4081',
          'accent-content': '#FFFFFF',
          'neutral': '#212121',
          'neutral-content': '#FFFFFF',
          'base-100': '#FFFFFF',
          'base-200': '#F5F5F5',
          'base-300': '#E0E0E0',
          'base-content': '#212121',
          'info': '#2196F3',
          'info-content': '#FFFFFF',
          'success': '#4CAF50',
          'success-content': '#FFFFFF',
          'warning': '#FF9800',
          'warning-content': '#000000',
          'error': '#F44336',
          'error-content': '#FFFFFF',
        },
        dark: {
          'primary': '#BB86FC',
          'primary-content': '#000000',
          'secondary': '#03DAC6',
          'secondary-content': '#000000',
          'accent': '#FF4081',
          'accent-content': '#FFFFFF',
          'neutral': '#1F1F1F',
          'neutral-content': '#E0E0E0',
          'base-100': '#121212',
          'base-200': '#1E1E1E',
          'base-300': '#2C2C2C',
          'base-content': '#E0E0E0',
          'info': '#2196F3',
          'info-content': '#FFFFFF',
          'success': '#4CAF50',
          'success-content': '#FFFFFF',
          'warning': '#FF9800',
          'warning-content': '#000000',
          'error': '#CF6679',
          'error-content': '#FFFFFF',
        },
      },
    ],
  },
};

export default config;

