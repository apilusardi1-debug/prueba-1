/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#fdf8ee',
          100: '#f8edce',
          200: '#f0d89a',
          300: '#e6c060',
          400: '#d9a83a',
          500: '#c9922a',
          600: '#b07420',
          700: '#8a581e',
          800: '#6e4520',
          900: '#3d2410',
        },
        sand: {
          50:  '#fdfaf2',
          100: '#f9f3e3',
          200: '#f2e4c0',
          300: '#e8d09a',
          400: '#dbb96e',
          500: '#cfa04a',
        },
        ocean: {
          50:  '#f0f7f7',
          100: '#d8ecec',
          200: '#aed4d4',
          300: '#7ab8b8',
          400: '#4f9898',
          500: '#3a7c7c',
          600: '#2d6060',
          700: '#264f4f',
          800: '#1e3c3c',
        },
        dark: '#1C1208',
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans:  ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
