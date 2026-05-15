import { forwardRef } from 'react'
import { cn } from '@/lib/cn'
import { useTheme } from '@/lib/theme'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  left?: React.ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  label, error, hint, left, className, id, ...props
}, ref) => {
  const t = useTheme()
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

  const shadowIdle  = t.dark
    ? '0 0 0 1px rgba(255,255,255,0.10), inset 0 1px 3px rgba(0,0,0,0.20)'
    : '0 0 0 1px rgba(12,30,60,0.10), inset 0 1px 3px rgba(12,30,60,0.06)'
  const shadowFocus = t.dark
    ? '0 0 0 3px rgba(251,191,36,0.30), inset 0 1px 2px rgba(0,0,0,0.15)'
    : '0 0 0 3px rgba(39,97,235,0.28), inset 0 1px 2px rgba(12,30,60,0.04)'
  const shadowError = t.dark
    ? '0 0 0 2.5px rgba(244,63,94,0.45), inset 0 1px 2px rgba(0,0,0,0.15)'
    : '0 0 0 2.5px rgba(244,63,94,0.35), inset 0 1px 2px rgba(12,30,60,0.06)'

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium"
          style={{ color: t.inkDim }}
        >
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {left && (
          <div
            className="pointer-events-none absolute left-3.5 flex items-center"
            style={{ color: t.inkMuted }}
          >
            {left}
          </div>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'w-full rounded-xl text-[16px] sm:text-sm',
            'px-4 py-2.5 outline-none transition-all duration-150',
            t.dark ? 'placeholder:text-gray-500' : 'placeholder:text-navy-400',
            left && 'pl-10',
            className,
          )}
          style={{
            background: t.surfaceInput,
            color: t.ink,
            boxShadow: error ? shadowError : shadowIdle,
          }}
          onFocus={(e) => {
            if (!error) e.currentTarget.style.boxShadow = shadowFocus
            props.onFocus?.(e)
          }}
          onBlur={(e) => {
            if (!error) e.currentTarget.style.boxShadow = shadowIdle
            props.onBlur?.(e)
          }}
          {...props}
        />
      </div>
      {error && <p className="text-[12.5px] font-medium text-rose-500">{error}</p>}
      {hint && !error && (
        <p className="text-[12px]" style={{ color: t.inkMuted }}>{hint}</p>
      )}
    </div>
  )
})

Input.displayName = 'Input'
