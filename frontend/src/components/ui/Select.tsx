import { forwardRef } from 'react'
import { cn } from '@/lib/cn'
import { ChevronDown } from 'lucide-react'
import { useThemeStore } from '@/store/themeStore'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string; label: string }[]
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({
  label, error, options, className, id, ...props
}, ref) => {
  const dark = useThemeStore((s) => s.theme === 'dark')
  const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

  const bg    = dark ? '#374151' : '#eaf0fa'
  const color = dark ? '#f9fafb' : '#0c1e3c'

  const shadowIdle  = dark
    ? '0 0 0 1px rgba(255,255,255,0.10), inset 0 1px 3px rgba(0,0,0,0.20)'
    : '0 0 0 1px rgba(12,30,60,0.10), inset 0 1px 3px rgba(12,30,60,0.06)'
  const shadowFocus = dark
    ? '0 0 0 3px rgba(251,191,36,0.30)'
    : '0 0 0 3px rgba(39,97,235,0.28)'
  const shadowError = dark
    ? '0 0 0 2.5px rgba(244,63,94,0.45)'
    : '0 0 0 2.5px rgba(244,63,94,0.35)'

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={selectId}
          className="text-sm font-medium"
          style={{ color: dark ? '#9ca3af' : 'rgba(12,30,60,0.60)' }}
        >
          {label}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          className={cn(
            'w-full appearance-none rounded-xl',
            'px-4 py-2.5 pr-10 text-[16px] sm:text-sm',
            'outline-none transition-all duration-150 cursor-pointer',
            className,
          )}
          style={{
            background: bg,
            color,
            boxShadow: error ? shadowError : shadowIdle,
          }}
          onFocus={(e) => {
            e.currentTarget.style.boxShadow = shadowFocus
            props.onFocus?.(e)
          }}
          onBlur={(e) => {
            e.currentTarget.style.boxShadow = error ? shadowError : shadowIdle
            props.onBlur?.(e)
          }}
          {...props}
        >
          {options.map(({ value, label }) => (
            <option key={value} value={value} style={{ background: dark ? '#1f2937' : '#ffffff', color }}>
              {label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2"
          style={{ color: dark ? '#6b7280' : '#7da8d8' }}
        />
      </div>
      {error && <p className="text-[12.5px] font-medium text-rose-500">{error}</p>}
    </div>
  )
})

Select.displayName = 'Select'
