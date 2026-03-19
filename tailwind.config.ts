import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}'
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    screens: {
      'xs': '400px',
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        night: '#0B0B0C',           // основной чёрный фон
        dark: '#000000',            // чистый чёрный (для карточек)
        platinum: '#F4F4F5',
        gold: {
          400: '#D4AF37',
          500: '#CBA135',
          dark: '#B8860B'           // тёмно-золотой для hover
        },
        accent: '#1A1A1A'           // тёмно-серый для панелей
      },
      boxShadow: {
        glow: '0 0 12px rgba(212, 175, 55, 0.45)',
        'win-glow': '0 0 25px rgba(212, 175, 55, 0.8)'
      },
      backgroundImage: {
        'gold-sheen':
          'radial-gradient(circle at top, rgba(212, 175, 55, 0.25), transparent 60%), radial-gradient(circle at bottom, rgba(203, 161, 53, 0.2), transparent 55%)'
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' }
        },
        'slide-up': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' }
        },
        'slide-in-right': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' }
        },
        'slide-in-left': {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(0)' }
        },
        // === НОВЫЕ АНИМАЦИИ ПО ТЗ ===
        'chest-open': {
          '0%': { transform: 'scale(0.6) rotate(-15deg)', opacity: '0' },
          '100%': { transform: 'scale(1) rotate(0)', opacity: '1' }
        },
        'win-shine': {
          '0%': { textShadow: '0 0 10px #D4AF37' },
          '50%': { textShadow: '0 0 40px #D4AF37, 0 0 60px #CBA135' },
          '100%': { textShadow: '0 0 10px #D4AF37' }
        },
        'roulette-spin': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(1440deg)' } // 4 полных оборота
        },
        'crash-fall': {
          '0%': { transform: 'translateY(-50px) scale(1)' },
          '100%': { transform: 'translateY(300px) scale(0.8)' }
        },
        'particle-win': {
          '0%': { opacity: '0', transform: 'scale(0.5) translateY(0)' },
          '50%': { opacity: '1', transform: 'scale(1.2) translateY(-30px)' },
          '100%': { opacity: '0', transform: 'scale(0.8) translateY(50px)' }
        }
      },
      animation: {
        'fade-in': 'fade-in 220ms ease-out forwards',
        'slide-up': 'slide-up 300ms ease-out',
        'slide-in-right': 'slide-in-right 300ms ease-out',
        'slide-in-left': 'slide-in-left 250ms ease-out',
        
        // === НОВЫЕ АНИМАЦИИ ПО ТЗ ===
        'chest-open': 'chest-open 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'win-shine': 'win-shine 1.5s infinite ease-in-out',
        'roulette-spin': 'roulette-spin 3s linear forwards',
        'crash-fall': 'crash-fall 1.2s ease-in forwards',
        'particle-win': 'particle-win 0.8s ease-out forwards'
      }
    }
  },
  plugins: []
};

export default config;
