import { cn } from '@/lib/cn'
import { useThemeStore } from '@/store/themeStore'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'primary'
  dot?: boolean
  className?: string
}

export function Badge({ children, variant = 'default', dot = false, className }: BadgeProps) {
  const dark = useThemeStore((s) => s.theme === 'dark')

  const styles: Record<string, { bg: string; text: string; dot: string }> = dark ? {
    default:  { bg: 'rgba(156,163,175,0.12)', text: '#d1d5db', dot: '#9ca3af' },
    primary:  { bg: 'rgba(59,130,246,0.15)',  text: '#60a5fa', dot: '#3b82f6' },
    success:  { bg: 'rgba(16,185,129,0.15)',  text: '#34d399', dot: '#10b981' },
    warning:  { bg: 'rgba(251,191,36,0.15)',  text: '#fcd34d', dot: '#fbbf24' },
    danger:   { bg: 'rgba(239,68,68,0.15)',   text: '#f87171', dot: '#ef4444' },
  } : {
    default:  { bg: 'rgba(12,30,60,0.07)',    text: '#1a4280', dot: '#5b8ff5' },
    primary:  { bg: 'rgba(39,97,235,0.10)',   text: '#1d4ed8', dot: '#2761eb' },
    success:  { bg: 'rgba(5,150,105,0.10)',   text: '#047857', dot: '#059669' },
    warning:  { bg: 'rgba(245,158,11,0.12)',  text: '#b45309', dot: '#f59e0b' },
    danger:   { bg: 'rgba(244,63,94,0.10)',   text: '#be123c', dot: '#f43f5e' },
  }

  const s = styles[variant]

  return (
    <span
      className={cn('inline-flex items-center gap-1.5 rounded-lg px-2.5 py-0.5 text-xs font-semibold', className)}
      style={{ background: s.bg, color: s.text }}
    >
      {dot && (
        <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: s.dot }} />
      )}
      {children}
    </span>
  )
}
