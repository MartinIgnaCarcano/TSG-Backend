/** @type {import('tailwindcss').Config} */
// Paleta "agencia de viajes" — azul océano + turquesa de acento.
// darkMode: 'class' -> el ThemeToggle agrega/quita la clase `dark` en <html>.
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Self-hosteadas vía @fontsource (ver src/main.tsx), reemplazan
        // DM Sans/Syne por Google Fonts CDN.
        sans: ['Inter', 'sans-serif'],
        heading: ['Sora', 'sans-serif'],
      },
      colors: {
        oceano: {
          50: '#eef4fb',
          100: '#d7e6f7',
          200: '#aecbef',
          300: '#7daee3',
          400: '#4f8ed2',
          500: '#2f72b8', // base
          600: '#235a96', // marca / brand
          700: '#1c4877',
          800: '#16395d',
          900: '#102841',
        },
        turquesa: {
          50: '#effbfa',
          100: '#cdf3ef',
          200: '#9de7e0',
          300: '#65d3c8',
          400: '#34b8ac',
          500: '#1f9d92', // base acento
          600: '#16786f', // acento fuerte / hover
        },
      },
      boxShadow: {
        soft: '0 8px 24px -8px rgba(15, 23, 42, 0.18)',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
    },
  },
  plugins: [],
}
