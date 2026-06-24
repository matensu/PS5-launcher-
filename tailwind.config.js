/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/**/*.{js,ts,jsx,tsx,html}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Segoe UI"', 'system-ui', 'sans-serif'],
        display: ['"SST Pro"', '"Segoe UI"', 'sans-serif']
      },
      colors: {
        console: {
          bg: 'var(--color-bg)',
          surface: 'var(--color-surface)',
          accent: 'var(--color-accent)',
          'accent-glow': 'var(--color-accent-glow)',
          text: 'var(--color-text)',
          muted: 'var(--color-muted)',
          card: 'var(--color-card)',
          border: 'var(--color-border)'
        },
        trophy: {
          bronze: '#cd7f32',
          silver: '#c0c0c0',
          gold: '#ffd700',
          platinum: '#e5e4e2'
        }
      },
      backdropBlur: {
        console: '24px'
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'slide-up': 'slide-up 0.4s ease-out'
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 20px var(--color-accent-glow)' },
          '50%': { boxShadow: '0 0 40px var(--color-accent-glow)' }
        },
        'slide-up': {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        }
      }
    }
  },
  plugins: []
}
