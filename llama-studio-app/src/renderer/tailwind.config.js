/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Display',
          'SF Pro Text',
          'Segoe UI Variable Display',
          'Segoe UI Variable Text',
          'Segoe UI',
          'Inter',
          'Helvetica Neue',
          'Arial',
          'PingFang SC',
          'Microsoft YaHei',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
}
