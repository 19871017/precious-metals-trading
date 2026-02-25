/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 主色调
        primary: {
          DEFAULT: '#1a237e',
          light: '#534bae',
          dark: '#0d1245',
        },
        // 强调色
        accent: {
          gold: '#FFD700',
          silver: '#C0C0C0',
        },
        // 金融涨跌色
        finance: {
          up: '#ef4444',
          down: '#22c55e',
        },
        // 深色主题背景色
        dark: {
          bg: '#09090b',      // 主背景
          card: '#171717',     // 卡片背景
          border: '#262626',   // 边框色
          hover: '#262626',    // 悬停色
          'hover-light': '#404040', // 悬停高亮色
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
