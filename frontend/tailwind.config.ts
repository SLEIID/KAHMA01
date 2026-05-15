import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['attribute', '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        // ── Kolory przez CSS variables — reagują na motyw ──────────────────
        bg: {
          DEFAULT:  'var(--bg)',
          surface:  'var(--surface)',
          input:    'var(--surface-input)',
          muted:    'var(--surface-muted)',
        },
        ink: {
          900: 'var(--ink)',
          400: 'var(--ink-dim)',
          300: 'var(--ink-muted)',
        },
        border: {
          DEFAULT: 'var(--border)',
          strong:  'var(--border-strong)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          hover:   'var(--primary-hover)',
        },
        // ── Granat (stałe — do gradientów, sidebara itp.) ──────────────────
        navy: {
          950: '#060f20',
          900: '#0c1e3c',
          800: '#12305e',
          700: '#1a4280',
          600: '#2255a8',
          500: '#2761eb',
          400: '#5b8ff5',
          300: '#93b8f8',
          200: '#c4d9fb',
          100: '#e0ecfd',
          50:  '#f0f6ff',
        },
        // ── Tło (stałe wartości dla wstecznej kompatybilności) ─────────────
        canvas: {
          bg:      '#edf2fb',
          surface: '#f4f7fd',
          input:   '#eaf0fa',
          muted:   '#e0ecfd',
        },
        // ── Akcenty ───────────────────────────────────────────────────────
        teal:    { 500: '#0891b2', 600: '#0e7490' },
        emerald: { 500: '#059669', 600: '#047857' },
        amber:   { 400: '#fbbf24', 500: '#f59e0b', 600: '#d97706' },
        rose:    { 500: '#f43f5e', 600: '#e11d48' },
      },
      boxShadow: {
        card:        'var(--card-shadow)',
        hover:       '0 0 0 1px rgba(39,97,235,0.20), 0 4px 20px rgba(39,97,235,0.14), 0 8px 32px rgba(12,30,60,0.08)',
        input:       '0 0 0 1px var(--border-strong), 0 1px 2px rgba(12,30,60,0.06)',
        focus:       '0 0 0 3px rgba(39,97,235,0.28)',
        error:       '0 0 0 3px rgba(244,63,94,0.25)',
        nav:         '4px 0 32px rgba(6,15,32,0.28)',
        login:       '0 8px 48px rgba(6,15,32,0.32), 0 2px 12px rgba(39,97,235,0.12)',
        btn:         '0 1px 2px rgba(39,97,235,0.30), 0 0 0 1px rgba(39,97,235,0.55), inset 0 1px 0 rgba(255,255,255,0.12)',
        'btn-hover': '0 4px 16px rgba(39,97,235,0.38), 0 0 0 1px rgba(39,97,235,0.60)',
      },
      animation: {
        'fade-in':  'fadeIn 0.18s ease-out',
        'slide-up': 'slideUp 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in': 'slideIn 0.30s cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        slideIn: { from: { opacity: '0', transform: 'translateX(-14px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
      },
    },
  },
  plugins: [],
} satisfies Config
