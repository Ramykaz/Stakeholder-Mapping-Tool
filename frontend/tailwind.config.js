/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // UNDP brand palette
        primary: {
          50: '#e6f1fa',
          100: '#cce4f5',
          200: '#99c8eb',
          300: '#66ade0',
          400: '#3391d6',
          500: '#0468B1', // UNDP Blue
          600: '#035a9a',
          700: '#024b82',
          800: '#023d6b',
          900: '#012e53',
          950: '#011e37',
        },
        // Dark navy for headers/text
        navy: {
          50: '#f0f1f4',
          100: '#d5d8e0',
          200: '#abb1c1',
          300: '#818ba3',
          400: '#576484',
          500: '#3a4a6b',
          600: '#2d3a55',
          700: '#1F2A44',
          800: '#182236',
          900: '#111928',
        },
        // Accent teal for highlights
        accent: {
          50: '#e6f8fc',
          100: '#b3ecf7',
          200: '#80e0f2',
          300: '#4dd3ec',
          400: '#1ac7e7',
          500: '#00B4D8',
          600: '#0099b8',
          700: '#007d97',
          800: '#006277',
          900: '#004757',
        },
        // Semantic entity colors
        entity: {
          person: '#3b82f6',
          organization: '#8b5cf6',
          location: '#10b981',
          role: '#f59e0b',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Manrope', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Courier New', 'monospace'],
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.06), 0 1px 2px -1px rgba(0, 0, 0, 0.06)',
        'card-hover': '0 4px 12px 0 rgba(0, 0, 0, 0.08), 0 2px 4px -2px rgba(0, 0, 0, 0.06)',
        'elevated': '0 8px 24px 0 rgba(0, 0, 0, 0.1), 0 2px 8px -2px rgba(0, 0, 0, 0.06)',
        'nav': '0 1px 3px 0 rgba(0, 0, 0, 0.08)',
      },
      borderRadius: {
        'xl': '0.875rem',
        '2xl': '1rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
    },
  },
  plugins: [],
};
