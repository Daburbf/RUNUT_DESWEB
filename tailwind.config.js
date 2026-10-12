/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        paper: '#FFFFFF',
        ink: '#000000',
        mutedbg: '#F2F2F2',
        accent: { DEFAULT: '#FF3000', dark: '#CC2600' },
        grayline: '#525252',
        line: '#000000',
        // alias lama -> dipetakan ke token Swiss agar tidak ada sisa tema gelap
        deep: '#FFFFFF',
        base: '#FFFFFF',
        elevated: '#F2F2F2',
        fg: '#000000',
        muted: '#525252',
      },
      borderRadius: { none: '0px' },
      boxShadow: { none: 'none' },
    },
  },
  plugins: [],
}
