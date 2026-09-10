/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        base: {
          950: '#05070f',
          900: '#0a0e1a',
          850: '#0d1220',
          800: '#111827',
          700: '#1a2236',
        },
        accent: {
          blue: '#3b82f6',
          violet: '#8b5cf6',
          cyan: '#22d3ee',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        glow: '0 0 24px 0 rgba(59, 130, 246, 0.35)',
      },
      backgroundImage: {
        'grid-glow':
          'radial-gradient(circle at 20% 0%, rgba(59,130,246,0.15), transparent 40%), radial-gradient(circle at 80% 0%, rgba(139,92,246,0.15), transparent 40%)',
      },
    },
  },
  plugins: [],
};
