/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        terminal: {
          bg: '#0a0a0a',
          panel: '#141414',
          border: '#2a2a2a',
          hover: '#1f1f1f',
        },
        accent: '#00d4ff',
        profit: '#00ff88',
        loss: '#ff4444',
        warning: '#ffaa00',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
