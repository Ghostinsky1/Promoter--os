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
        // Brand-mapped status palettes: positive = ice blue, negative = coral, caution = amber, accents = brand blue
        green: { 50: '#EEF8FF', 100: '#D9F0FF', 200: '#BFE5FF', 300: '#A7DCFF', 400: '#8FD3FF', 500: '#6FB8F2', 600: '#4E9BDB', 700: '#3A7DB8', 800: '#2A5E8F', 900: '#1E4468', 950: '#12293F' }, emerald: { 50: '#EEF8FF', 100: '#D9F0FF', 200: '#BFE5FF', 300: '#A7DCFF', 400: '#8FD3FF', 500: '#6FB8F2', 600: '#4E9BDB', 700: '#3A7DB8', 800: '#2A5E8F', 900: '#1E4468', 950: '#12293F' }, teal: { 50: '#EEF8FF', 100: '#D9F0FF', 200: '#BFE5FF', 300: '#A7DCFF', 400: '#8FD3FF', 500: '#6FB8F2', 600: '#4E9BDB', 700: '#3A7DB8', 800: '#2A5E8F', 900: '#1E4468', 950: '#12293F' }, cyan: { 50: '#EEF8FF', 100: '#D9F0FF', 200: '#BFE5FF', 300: '#A7DCFF', 400: '#8FD3FF', 500: '#6FB8F2', 600: '#4E9BDB', 700: '#3A7DB8', 800: '#2A5E8F', 900: '#1E4468', 950: '#12293F' }, sky: { 50: '#EEF8FF', 100: '#D9F0FF', 200: '#BFE5FF', 300: '#A7DCFF', 400: '#8FD3FF', 500: '#6FB8F2', 600: '#4E9BDB', 700: '#3A7DB8', 800: '#2A5E8F', 900: '#1E4468', 950: '#12293F' },
        blue: { 50: '#EEF1FF', 100: '#DCE3FF', 200: '#B9C7FF', 300: '#8EA3FF', 400: '#5F7BFF', 500: '#1140F0', 600: '#0E36CC', 700: '#0B2BA3', 800: '#08207A', 900: '#061856', 950: '#04214D' }, indigo: { 50: '#EEF1FF', 100: '#DCE3FF', 200: '#B9C7FF', 300: '#8EA3FF', 400: '#5F7BFF', 500: '#1140F0', 600: '#0E36CC', 700: '#0B2BA3', 800: '#08207A', 900: '#061856', 950: '#04214D' }, purple: { 50: '#EEF1FF', 100: '#DCE3FF', 200: '#B9C7FF', 300: '#8EA3FF', 400: '#5F7BFF', 500: '#1140F0', 600: '#0E36CC', 700: '#0B2BA3', 800: '#08207A', 900: '#061856', 950: '#04214D' }, violet: { 50: '#EEF1FF', 100: '#DCE3FF', 200: '#B9C7FF', 300: '#8EA3FF', 400: '#5F7BFF', 500: '#1140F0', 600: '#0E36CC', 700: '#0B2BA3', 800: '#08207A', 900: '#061856', 950: '#04214D' },
        red: { 50: '#FFF1F1', 100: '#FFE0E0', 200: '#FFC2C2', 300: '#FF9E9E', 400: '#FF7A7A', 500: '#F25C5C', 600: '#D64545', 700: '#B33636', 800: '#8C2A2A', 900: '#661F1F', 950: '#401313' }, rose: { 50: '#FFF1F1', 100: '#FFE0E0', 200: '#FFC2C2', 300: '#FF9E9E', 400: '#FF7A7A', 500: '#F25C5C', 600: '#D64545', 700: '#B33636', 800: '#8C2A2A', 900: '#661F1F', 950: '#401313' }, pink: { 50: '#FFF1F1', 100: '#FFE0E0', 200: '#FFC2C2', 300: '#FF9E9E', 400: '#FF7A7A', 500: '#F25C5C', 600: '#D64545', 700: '#B33636', 800: '#8C2A2A', 900: '#661F1F', 950: '#401313' },
        orange: { 50: '#FFF7EC', 100: '#FFEDD3', 200: '#FFDCA8', 300: '#FFCA83', 400: '#FFB86B', 500: '#F2A14A', 600: '#D9862F', 700: '#B36B22', 800: '#8C5218', 900: '#663C12', 950: '#40250B' }, amber: { 50: '#FFF7EC', 100: '#FFEDD3', 200: '#FFDCA8', 300: '#FFCA83', 400: '#FFB86B', 500: '#F2A14A', 600: '#D9862F', 700: '#B36B22', 800: '#8C5218', 900: '#663C12', 950: '#40250B' }, yellow: { 50: '#FFF7EC', 100: '#FFEDD3', 200: '#FFDCA8', 300: '#FFCA83', 400: '#FFB86B', 500: '#F2A14A', 600: '#D9862F', 700: '#B36B22', 800: '#8C5218', 900: '#663C12', 950: '#40250B' },
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
