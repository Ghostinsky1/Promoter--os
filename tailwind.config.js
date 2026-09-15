/** @type {import('tailwindcss').Config} */
// PROMTP theme — matches gozaentertainment.com (electric blue canvas, black glossy cards, ice-blue accent)
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        gray: {
          50: '#F3F6FB', 100: '#E6EBF3', 200: '#D2DAE6', 300: '#C9D2DE', 400: '#A8B2C1',
          500: '#7E8894', 600: '#2A3040', 700: '#22262F', 800: '#1B1F28', 900: '#111319', 950: '#08090D',
        },
        slate: {
          50: '#F3F6FB', 100: '#E6EBF3', 200: '#D2DAE6', 300: '#C9D2DE', 400: '#A8B2C1',
          500: '#7E8894', 600: '#3A4150', 700: '#22262F', 800: '#1B1F28', 900: '#0B0D12', 950: '#08090D',
        },
        goza: { blue: '#1140F0', ice: '#8FD3FF', iceDeep: '#6FB8F2', navy: '#04214D', black: '#08090D', card: '#14171E', line: '#2A3040' },
      },
      fontFamily: {
        display: ['"Archivo Black"', 'Impact', 'sans-serif'],
        label: ['"Chakra Petch"', '"Trebuchet MS"', 'sans-serif'],
        body: ['"Saira Condensed"', '"Arial Narrow"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
