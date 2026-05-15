import { forwardRef } from 'react'
import { cn } from '@/lib/cn'
import { useThemeStore } from '@/store/themeStore'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'xs' | 'sm' | 'md' | 'lg'
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  className, variant = 'primary', size = 'md', loading, disabled, children, style, ...props
}, ref) => {
  const dark = useThemeStore((s) => s.theme === 'dark')
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        // Base
        'inline-flex items-center justify-center font-medium rounded-xl select-none',
        'transition-all duration-150 ease-out',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-bg',
        'active:scale-[0.97]',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
        // Variant
        variant === 'primary' && [
          'text-canvas-surface font-semibold',
        ],
        variant === 'secondary' && [
          'bg-canvas-surface text-navy-900 font-medium',
          'shadow-[0_0_0_1px_rgba(12,30,60,0.12),0_1px_3px_rgba(12,30,60,0.08)]',
          'hover:shadow-[0_0_0_1px_rgba(12,30,60,0.18),0_2px_6px_rgba(12,30,60,0.10)]',
          'hover:bg-canvas-muted',
        ],
        variant === 'ghost' && [
          'text-navy-700 hover:bg-navy-500/8 hover:text-navy-900',
        ],
        variant === 'danger' && [
          'text-canvas-surface font-semibold',
        ],
        // Size
        size === 'xs' && 'px-2.5 py-1   text-xs  gap-1   min-h-[30px]',
        size === 'sm' && 'px-3   py-1.5 text-sm  gap-1.5 min-h-[36px]',
        size === 'md' && 'px-4   py-2.5 text-sm  gap-2   min-h-[44px]',
        size === 'lg' && 'px-6   py-3   text-[15px] gap-2.5 min-h-[52px]',
        className,
      )}
      style={{
        ...(variant === 'primary' ? (dark ? {
          background: 'linear-gradient(160deg, #fcd34d 0%, #fbbf24 50%, #f59e0b 100%)',
          boxShadow: '0 1px 2px rgba(251,191,36,0.30), 0 0 0 1px rgba(251,191,36,0.55), inset 0 1px 0 rgba(255,255,255,0.14)',
          color: '#1c1400',
        } : {
          background: 'linear-gradient(160deg, #3b7ef8 0%, #2761eb 50%, #1d4ed8 100%)',
          boxShadow: '0 1px 2px rgba(39,97,235,0.30), 0 0 0 1px rgba(39,97,235,0.55), inset 0 1px 0 rgba(255,255,255,0.14)',
          color: '#ffffff',
        }) : {}),
        ...(variant === 'danger' ? {
          background: 'linear-gradient(160deg, #f87171 0%, #ef4444 60%, #dc2626 100%)',
          boxShadow: '0 1px 2px rgba(239,68,68,0.25), 0 0 0 1px rgba(239,68,68,0.50)',
        } : {}),
        ...style,
      }}
      onMouseEnter={(e) => {
        if (variant === 'primary' && !disabled && !loading) {
          (e.currentTarget as HTMLElement).style.boxShadow = dark
            ? '0 4px 16px rgba(251,191,36,0.38), 0 0 0 1px rgba(251,191,36,0.60), inset 0 1px 0 rgba(255,255,255,0.14)'
            : '0 4px 16px rgba(39,97,235,0.38), 0 0 0 1px rgba(39,97,235,0.60), inset 0 1px 0 rgba(255,255,255,0.14)'
        }
        props.onMouseEnter?.(e)
      }}
      onMouseLeave={(e) => {
        if (variant === 'primary' && !disabled && !loading) {
          (e.currentTarget as HTMLElement).style.boxShadow = dark
            ? '0 1px 2px rgba(251,191,36,0.30), 0 0 0 1px rgba(251,191,36,0.55), inset 0 1px 0 rgba(255,255,255,0.14)'
            : '0 1px 2px rgba(39,97,235,0.30), 0 0 0 1px rgba(39,97,235,0.55), inset 0 1px 0 rgba(255,255,255,0.14)'
        }
        props.onMouseLeave?.(e)
      }}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  )
})

Button.displayName = 'Button'
