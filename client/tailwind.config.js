/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sp: {
          blue: '#2158a5',
          'blue-light': '#0057b8',
          magenta: '#e6007e',
          yellow: '#ffc400',
          cyan: '#00b8e6',
          grafite: '#222222',
          offwhite: '#f6f6f6',
          dark: '#0f172a',
          'dark-card': '#1e293b',
        }
      },
      fontFamily: {
        title: ['Outfit', 'Qurova', 'sans-serif'],
        body: ['Outfit', 'Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
