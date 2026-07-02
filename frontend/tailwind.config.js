/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        ink: {
          DEFAULT: '#0f0f0f',
          soft: '#1a1a1a',
          muted: '#2e2e2e',
        },
        slate: {
          faint: '#f7f7f6',
          light: '#efefed',
          mid: '#c8c8c4',
        },
        accent: {
          DEFAULT: '#4f46e5',
          soft: '#eef2ff',
          hover: '#4338ca',
        },
        signal: {
          green: '#16a34a',
          green_bg: '#f0fdf4',
          amber: '#d97706',
          amber_bg: '#fffbeb',
          red: '#dc2626',
          red_bg: '#fef2f2',
        }
      },
      animation: {
        'fade-up': 'fadeUp 0.4s ease forwards',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        'fade-in': 'fadeIn 0.3s ease forwards',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        }
      }
    },
  },
  plugins: [],
}