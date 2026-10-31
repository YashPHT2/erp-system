/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        canvas: '#f4f5f7',
      },
      boxShadow: {
        card: '0 1px 2px rgba(16, 24, 40, 0.05)',
      },
    },
  },
  plugins: [],
};
