/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'alteryx-blue': '#0057FF',
        'alteryx-dark-blue': '#0044CC',
        'alteryx-light-blue': '#E6F0FF',
      }
    },
  },
  plugins: [],
}
