/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['IBM Plex Sans', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        soft: '0 1px 2px rgba(20, 30, 50, 0.04), 0 10px 28px -16px rgba(20, 30, 50, 0.18)',
        softDark: '0 1px 2px rgba(0, 0, 0, 0.35), 0 14px 30px -16px rgba(0, 0, 0, 0.55)'
      },
      transitionTimingFunction: {
        app: 'cubic-bezier(.4,0,.2,1)'
      },
      animation: {
        'tab-in': 'tabIn 0.3s cubic-bezier(.4,0,.2,1) both',
        'login-in': 'loginIn 0.55s cubic-bezier(.4,0,.2,1) both',
        'row-in': 'rowIn 0.35s cubic-bezier(.4,0,.2,1) both',
        'badge-pop': 'badgePop 0.6s cubic-bezier(.4,0,.2,1) 0.1s both',
        pulseDot: 'dotPulse 1.8s ease-in-out infinite',
        armPulse: 'armPulse 1s ease-in-out infinite',
        glowDrift: 'glowDrift 7s ease-in-out infinite'
      },
      keyframes: {
        tabIn: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        loginIn: {
          '0%': { opacity: '0', transform: 'translateY(14px) scale(.97)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' }
        },
        rowIn: {
          '0%': { opacity: '0', transform: 'translateY(3px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        badgePop: {
          '0%': { opacity: '0', transform: 'scale(.6) rotate(-8deg)' },
          '100%': { opacity: '1', transform: 'scale(1) rotate(0)' }
        },
        dotPulse: {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 0 0 rgba(11, 79, 168, 0.45)' },
          '50%': { opacity: '.65', boxShadow: '0 0 0 4px transparent' }
        },
        armPulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '.55' }
        },
        glowDrift: {
          '0%, 100%': { transform: 'translateX(-6%) translateY(0)' },
          '50%': { transform: 'translateX(6%) translateY(4%)' }
        }
      }
    }
  },
  plugins: []
};
