/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Rubik', 'Heebo', 'system-ui', 'sans-serif'] },
      colors: { night: { 950: '#04050c', 900: '#080a18', 800: '#0e1226' } },
      boxShadow: {
        glass: '0 8px 32px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.08)',
        'glow-emerald': '0 0 24px rgba(52,211,153,.45)',
        'glow-amber': '0 0 20px rgba(251,191,36,.45)',
        'glow-rose': '0 0 28px rgba(244,63,94,.5)',
        'glow-violet': '0 0 28px rgba(139,92,246,.5)',
      },
    },
  },
  plugins: [],
};
