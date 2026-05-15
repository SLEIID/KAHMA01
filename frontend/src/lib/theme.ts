import { useThemeStore } from '@/store/themeStore'

/** Zwraca gotowe obiekty stylów odpowiadające aktywnemu motywowi */
export function useTheme() {
  const { theme } = useThemeStore()
  const dark = theme === 'dark'

  return {
    dark,

    // Kolory tekstów
    ink:     dark ? '#f9fafb'  : '#0c1e3c',
    inkDim:  dark ? '#fbbf24'  : '#5b8ff5',
    inkMuted:dark ? '#9ca3af'  : '#7da8d8',
    inkWarn: dark ? '#fbbf24'  : '#92400e',
    inkInfo: dark ? '#60a5fa'  : '#0c4a6e',

    // Kolory tła
    bg:           dark ? '#111827' : '#edf2fb',
    surface:      dark ? '#1f2937' : '#f4f7fd',
    surfaceAlt:   dark ? '#1f2937' : '#ffffff',
    surfaceInput: dark ? '#374151' : '#eaf0fa',
    surfaceMuted: dark ? '#374151' : '#e0ecfd',

    // Obramowania
    border:       dark ? 'rgba(255,255,255,0.07)' : 'rgba(12,30,60,0.07)',
    borderStrong: dark ? 'rgba(255,255,255,0.13)' : 'rgba(12,30,60,0.12)',

    // Cień karty
    cardShadow: dark
      ? '0 0 0 1px rgba(255,255,255,0.06), 0 1px 4px rgba(0,0,0,0.35), 0 4px 12px rgba(0,0,0,0.20)'
      : '0 0 0 1px rgba(12,30,60,0.07), 0 1px 4px rgba(12,30,60,0.08), 0 4px 12px rgba(12,30,60,0.04)',

    // Gotowe style obiektów
    card: {
      background: dark ? '#1f2937' : '#f4f7fd',
      boxShadow:  dark
        ? '0 0 0 1px rgba(255,255,255,0.06), 0 1px 4px rgba(0,0,0,0.35)'
        : '0 0 0 1px rgba(12,30,60,0.07), 0 1px 4px rgba(12,30,60,0.08)',
    } as React.CSSProperties,

    cardAlt: {
      background: dark ? '#1f2937' : '#ffffff',
      boxShadow:  dark
        ? '0 0 0 1px rgba(255,255,255,0.06), 0 1px 4px rgba(0,0,0,0.35)'
        : '0 0 0 1px rgba(12,30,60,0.07), 0 1px 4px rgba(12,30,60,0.08)',
    } as React.CSSProperties,

    // Kolory statusów (wypożyczalnia, materiały itp.)
    green: {
      bg:   dark ? 'rgba(16,185,129,0.12)'  : 'rgba(5,150,105,0.06)',
      ring: dark ? '0 0 0 1px rgba(16,185,129,0.22)' : '0 0 0 1px rgba(5,150,105,0.20)',
      text: dark ? '#34d399' : '#065f46',
    },
    amber: {
      bg:   dark ? 'rgba(251,191,36,0.12)' : 'rgba(217,119,6,0.06)',
      ring: dark ? '0 0 0 1px rgba(251,191,36,0.22)' : '0 0 0 1px rgba(217,119,6,0.18)',
      text: dark ? '#fbbf24' : '#92400e',
    },
    blue: {
      bg:   dark ? 'rgba(59,130,246,0.12)' : 'rgba(39,97,235,0.08)',
      ring: dark ? '0 0 0 1px rgba(59,130,246,0.22)' : '0 0 0 1px rgba(39,97,235,0.20)',
      text: dark ? '#60a5fa' : '#1a4280',
    },
    red: {
      bg:   dark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.06)',
      ring: dark ? '0 0 0 1px rgba(239,68,68,0.22)' : '0 0 0 1px rgba(239,68,68,0.15)',
      text: dark ? '#f87171' : '#dc2626',
    },
    purple: {
      bg:   dark ? 'rgba(139,92,246,0.14)' : 'rgba(109,40,217,0.07)',
      ring: dark ? '0 0 0 1px rgba(139,92,246,0.28)' : '0 0 0 1px rgba(109,40,217,0.20)',
      text: dark ? '#a78bfa' : '#5b21b6',
    },
  }
}

export type ThemeValues = ReturnType<typeof useTheme>
