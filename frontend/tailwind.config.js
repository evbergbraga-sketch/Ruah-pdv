/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:     '#0C0C0F',
        bg2:    '#131318',
        bg3:    '#1A1A22',
        bg4:    '#22222E',
        border: '#2A2A38',
        rose:   '#E8547A',
        'rose-dim': '#3D1A25',
        mint:   '#4ECDC4',
        gold:   '#F5C842',
        green:  '#4CAF7D',
        'green-dim': '#0F2A1C',
        red:    '#E85454',
        purple: '#8B7CF8',
        txt:    '#F0EFF8',
        txt2:   '#A09EBB',
        txt3:   '#6B6985',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
