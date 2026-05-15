import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useTheme } from '@/lib/theme'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}

export function Modal({ open, onClose, title, description, children, className }: ModalProps) {
  const t = useTheme()

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-40 animate-fade-in"
          style={{ background: 'rgba(6,15,32,0.65)', backdropFilter: 'blur(3px)' }}
        />

        {/* Jeden Content — desktop: wycentrowany, mobile: bottom-sheet */}
        <Dialog.Content
          className={cn(
            'fixed z-50 focus:outline-none',
            // mobile: bottom sheet
            'inset-x-0 bottom-0 rounded-t-3xl p-6 pb-10',
            // desktop: wycentrowany
            'sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2',
            'sm:w-full sm:max-w-md sm:rounded-2xl sm:p-6',
            'animate-slide-up',
            className,
          )}
          style={{
            background: t.surface,
            boxShadow: t.dark
              ? '0 8px 48px rgba(0,0,0,0.60), 0 2px 12px rgba(0,0,0,0.30), 0 0 0 1px rgba(255,255,255,0.08)'
              : '0 8px 48px rgba(6,15,32,0.30), 0 2px 12px rgba(39,97,235,0.10), 0 0 0 1px rgba(12,30,60,0.08)',
          }}
        >
          {/* Uchwyt bottom-sheet (tylko mobile) */}
          <div
            className="sm:hidden absolute top-3 left-1/2 -translate-x-1/2 h-1 w-10 rounded-full"
            style={{ background: t.dark ? 'rgba(255,255,255,0.15)' : 'rgba(12,30,60,0.15)' }}
          />

          <div className="sm:hidden h-3" />

          <div className="flex items-start justify-between mb-5">
            <div>
              <Dialog.Title
                className="text-[17px] font-bold tracking-tight"
                style={{ color: t.ink }}
              >
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description
                  className="mt-0.5 text-sm"
                  style={{ color: t.inkDim }}
                >
                  {description}
                </Dialog.Description>
              )}
            </div>
            <button
              onClick={onClose}
              className="ml-3 rounded-xl p-1.5 transition-all duration-150"
              style={{ color: t.inkDim }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = t.dark
                  ? 'rgba(255,255,255,0.08)'
                  : 'rgba(39,97,235,0.08)'
              }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
