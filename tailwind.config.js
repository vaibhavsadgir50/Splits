/** @type {import('tailwindcss').Config} */
const config = {
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'prism-start': '#ffffff',
        'prism-border': 'rgba(255, 255, 255, 0.4)',
        'glass-bg': 'rgba(255, 255, 255, 0.15)',
        'on-surface': '#1a1a1a',
        primary: '#6b38d4',
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        'display-lg': ['Playfair Display', 'serif'],
        'body-base': ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
