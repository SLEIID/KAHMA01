import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { FileText, Wrench, Users, Package, BarChart3, ChevronRight, LockKeyhole, AlarmClock, Clock, Boxes, ClipboardList, UserCheck, ShoppingCart } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useTheme } from '@/lib/theme'
import { reportsApi } from '@/api/reports.api'
import client from '@/api/client'

function fmtMins(mins: number) {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

function getInitials(fullName: string) {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return parts[0].slice(0, 2).toUpperCase()
}

interface Module {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  topColor: string
  iconBg: string
  href: string
  adminOnly?: boolean
  available: boolean
}

const modules: Module[] = [
  {
    id: 'raporty',
    title: 'Raport Dnia',
    description: 'Rejestruj godziny pracy, miejsce i przebieg pojazdu służbowego.',
    icon: <FileText className="h-5 w-5" />,
    topColor: 'linear-gradient(90deg, #2761eb, #3b7ef8)',
    iconBg:   'linear-gradient(150deg, #3b7ef8, #2761eb)',
    href: '/raporty',
    available: true,
  },
  {
    id: 'sprzet',
    title: 'Wypożyczalnia Sprzętu',
    description: 'Wypożycz narzędzia i sprzęt, zwróć je i zgłaszaj usterki.',
    icon: <Wrench className="h-5 w-5" />,
    topColor: 'linear-gradient(90deg, #0891b2, #06b6d4)',
    iconBg:   'linear-gradient(150deg, #06b6d4, #0891b2)',
    href: '/sprzet',
    available: true,
  },
  {
    id: 'materialowka',
    title: 'Materiały',
    description: 'Rejestruj zużycie materiałów i zgłaszaj niski stan.',
    icon: <Package className="h-5 w-5" />,
    topColor: 'linear-gradient(90deg, #059669, #10b981)',
    iconBg:   'linear-gradient(150deg, #10b981, #059669)',
    href: '/materialy',
    available: true,
  },
  {
    id: 'hr',
    title: 'HR',
    description: 'Wnioski urlopowe, saldo dni i historia obecności.',
    icon: <UserCheck className="h-5 w-5" />,
    topColor: 'linear-gradient(90deg, #b45309, #d97706)',
    iconBg:   'linear-gradient(150deg, #d97706, #b45309)',
    href: '/hr',
    available: true,
  },
  {
    id: 'zakupy',
    title: 'Zamówienia',
    description: 'Zgłoś zapotrzebowanie na materiały i śledź status zakupów.',
    icon: <ShoppingCart className="h-5 w-5" />,
    topColor: 'linear-gradient(90deg, #4338ca, #6366f1)',
    iconBg:   'linear-gradient(150deg, #6366f1, #4338ca)',
    href: '/zakupy',
    available: true,
  },
  {
    id: 'users',
    title: 'Użytkownicy',
    description: 'Zarządzaj kontami pracowników, rolami i uprawnieniami.',
    icon: <Users className="h-5 w-5" />,
    topColor: 'linear-gradient(90deg, #1a4280, #2761eb)',
    iconBg:   'linear-gradient(150deg, #2255a8, #1a4280)',
    href: '/admin/users',
    adminOnly: true,
    available: true,
  },
  {
    id: 'przeglad-dnia',
    title: 'Przegląd Dnia',
    description: 'Raporty, wypożyczenia i zużycia materiałów w jednym widoku.',
    icon: <BarChart3 className="h-5 w-5" />,
    topColor: 'linear-gradient(90deg, #7c3aed, #8b5cf6)',
    iconBg:   'linear-gradient(150deg, #8b5cf6, #7c3aed)',
    href: '/admin/przeglad-dnia',
    adminOnly: true,
    available: true,
  },
]

function getGreeting() {
  const h = new Date().getHours()
  if (h < 5)  return 'Dobranoc'
  if (h < 12) return 'Dzień dobry'
  if (h < 17) return 'Witaj ponownie'
  if (h < 21) return 'Dobry wieczór'
  return 'Dobranoc'
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { user, isAdmin } = useAuthStore()
  const t = useTheme()

  const visible = modules.filter((m) => !m.adminOnly || isAdmin())
  const firstName = user?.fullName?.split(' ')[0] ?? 'tam'

  const todayStr = new Date().toISOString().slice(0, 10)
  const hour = new Date().getHours()

  const { data: todayReports } = useQuery({
    queryKey: ['reports-today-reminder'],
    queryFn: () => reportsApi.list({ from: todayStr, to: todayStr }).then(r => r.data.data.items),
    enabled: !isAdmin() && hour >= 12,
    staleTime: 5 * 60 * 1000,
  })

  const showReminder = !isAdmin() && hour >= 12 && todayReports !== undefined && todayReports.length === 0

  const { data: stats } = useQuery({
    queryKey: ['my-stats'],
    queryFn: () => client.get<{ success: true; data: {
      reportsThisMonth: number
      hoursThisMonth: number
      activeRentals: number
      usagesThisMonth: number
    } }>('/users/me/stats').then(r => r.data.data),
    enabled: !isAdmin(),
    staleTime: 5 * 60 * 1000,
  })

  const monthName = new Date().toLocaleDateString('pl-PL', { month: 'long' })

  const today = new Date().toLocaleDateString('pl-PL', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
  const date = today.charAt(0).toUpperCase() + today.slice(1)

  return (
    <div className="animate-fade-in space-y-6">

      {/* ── Powitanie ──────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: t.ink, letterSpacing: '-0.025em', lineHeight: 1.15 }}>
            {getGreeting()}, {firstName} 👋
          </h1>
          <p style={{ marginTop: '0.25rem', fontSize: '0.875rem', color: t.inkDim }}>{date}</p>
        </div>

        {/* Avatar użytkownika */}
        <div
          style={{
            height: 42, width: 42, borderRadius: 14, flexShrink: 0, marginTop: 2,
            background: t.dark
              ? 'linear-gradient(150deg, #fbbf24, #d97706)'
              : 'linear-gradient(150deg, #3b7ef8, #1a4280)',
            boxShadow: t.dark
              ? '0 2px 10px rgba(251,191,36,0.40)'
              : '0 2px 10px rgba(39,97,235,0.40)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: t.dark ? '#1c1400' : '#c4d9fb', fontWeight: 800, fontSize: 13,
          }}
        >
          {user?.fullName ? getInitials(user.fullName) : 'U'}
        </div>
      </div>

      {/* ── Przypomnienie o raporcie ───────────── */}
      {showReminder && (
        <button
          onClick={() => navigate('/raporty')}
          className="w-full text-left rounded-2xl px-4 py-3.5 flex items-center gap-3 transition-opacity hover:opacity-90"
          style={{
            background: t.amber.bg,
            boxShadow: `0 0 0 1.5px ${t.amber.ring}`,
          }}
        >
          <AlarmClock className="h-5 w-5 shrink-0" style={{ color: t.amber.text }} />
          <div>
            <p className="text-sm font-bold" style={{ color: t.amber.text }}>
              Brak raportu na dziś
            </p>
            <p className="text-xs" style={{ color: t.amber.text, opacity: 0.8 }}>
              Nie zapomnij wypełnić raportu dnia — dotknij, żeby przejść.
            </p>
          </div>
          <ChevronRight className="h-4 w-4 ml-auto shrink-0" style={{ color: t.amber.text }} />
        </button>
      )}

      {/* ── Statystyki użytkownika ─────────────── */}
      {!isAdmin() && stats && (
        <div>
          <p className="section-label mb-3">Twój {monthName}</p>
          <div className="grid grid-cols-2 gap-3">

            <div className="rounded-2xl p-4" style={{ background: t.surface, boxShadow: t.cardShadow }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="rounded-xl p-1.5" style={{ background: t.blue.bg }}>
                  <ClipboardList className="h-4 w-4" style={{ color: t.blue.text }} />
                </div>
                <span className="text-xs font-medium" style={{ color: t.inkMuted }}>Raporty</span>
              </div>
              <p className="text-2xl font-bold" style={{ color: t.ink }}>{stats.reportsThisMonth}</p>
              <p className="text-xs mt-0.5" style={{ color: t.inkMuted }}>w tym miesiącu</p>
            </div>

            <div className="rounded-2xl p-4" style={{ background: t.surface, boxShadow: t.cardShadow }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="rounded-xl p-1.5" style={{ background: 'rgba(124,58,237,0.08)' }}>
                  <Clock className="h-4 w-4" style={{ color: '#7c3aed' }} />
                </div>
                <span className="text-xs font-medium" style={{ color: t.inkMuted }}>Godziny</span>
              </div>
              <p className="text-2xl font-bold" style={{ color: t.ink }}>{fmtMins(stats.hoursThisMonth)}</p>
              <p className="text-xs mt-0.5" style={{ color: t.inkMuted }}>przepracowane</p>
            </div>

            <div className="rounded-2xl p-4" style={{ background: t.surface, boxShadow: t.cardShadow }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="rounded-xl p-1.5" style={{ background: 'rgba(8,145,178,0.08)' }}>
                  <Wrench className="h-4 w-4" style={{ color: '#0891b2' }} />
                </div>
                <span className="text-xs font-medium" style={{ color: t.inkMuted }}>Wypożyczony sprzęt</span>
              </div>
              <p className="text-2xl font-bold" style={{ color: t.ink }}>{stats.activeRentals}</p>
              <p className="text-xs mt-0.5" style={{ color: t.inkMuted }}>aktualnie u Ciebie</p>
            </div>

            <div className="rounded-2xl p-4" style={{ background: t.surface, boxShadow: t.cardShadow }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="rounded-xl p-1.5" style={{ background: t.green.bg }}>
                  <Boxes className="h-4 w-4" style={{ color: t.green.text }} />
                </div>
                <span className="text-xs font-medium" style={{ color: t.inkMuted }}>Pobrania</span>
              </div>
              <p className="text-2xl font-bold" style={{ color: t.ink }}>{stats.usagesThisMonth}</p>
              <p className="text-xs mt-0.5" style={{ color: t.inkMuted }}>materiałów w tym miesiącu</p>
            </div>

          </div>
        </div>
      )}

      {/* ── Moduły ─────────────────────────────── */}
      <div>
        <p className="section-label mb-3">Moduły systemu</p>

        <div className="grid grid-cols-2 gap-3">
          {visible.map((mod) => (
            <button
              key={mod.id}
              onClick={() => mod.available && navigate(mod.href)}
              disabled={!mod.available}
              className="group relative overflow-hidden rounded-2xl text-left transition-all duration-200 ease-out"
              style={{
                background: t.surface,
                boxShadow: t.cardShadow,
                cursor: mod.available ? 'pointer' : 'not-allowed',
              }}
              onMouseEnter={(e) => {
                if (mod.available) {
                  e.currentTarget.style.boxShadow = t.dark
                    ? '0 0 0 1px rgba(251,191,36,0.25), 0 4px 20px rgba(251,191,36,0.12), 0 8px 32px rgba(0,0,0,0.20)'
                    : '0 0 0 1px rgba(39,97,235,0.20), 0 4px 20px rgba(39,97,235,0.14), 0 8px 32px rgba(12,30,60,0.08)'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = t.cardShadow
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              {/* Kreska kolorowa */}
              <div
                className="absolute inset-x-0 top-0 h-[3px]"
                style={{ background: mod.topColor, opacity: mod.available ? 1 : 0.4 }}
              />

              <div className="p-4">
                <div className="flex items-start justify-between">
                  {/* Ikona */}
                  <div
                    style={{
                      height: 38, width: 38, borderRadius: 12, flexShrink: 0,
                      background: mod.available ? mod.iconBg : (t.dark ? 'rgba(255,255,255,0.08)' : 'rgba(12,30,60,0.12)'),
                      color: mod.available ? '#e0ecfd' : t.inkMuted,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: mod.available ? '0 2px 8px rgba(12,30,60,0.18)' : 'none',
                      opacity: mod.available ? 1 : 0.6,
                    }}
                  >
                    {mod.icon}
                  </div>

                  {mod.available ? (
                    <ChevronRight
                      className="h-3.5 w-3.5 mt-0.5 transition-transform duration-150 group-hover:translate-x-0.5"
                      style={{ color: t.inkDim }}
                    />
                  ) : (
                    <LockKeyhole className="h-3.5 w-3.5 mt-0.5" style={{ color: t.inkMuted }} />
                  )}
                </div>

                <div style={{ marginTop: 10 }}>
                  <h3 style={{
                    fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.3,
                    color: mod.available ? t.ink : t.inkMuted,
                  }}>
                    {mod.title}
                  </h3>
                  <p style={{
                    marginTop: 3, fontSize: 11, lineHeight: 1.5,
                    color: mod.available ? t.inkMuted : t.inkDim,
                  }}>
                    {mod.description}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
