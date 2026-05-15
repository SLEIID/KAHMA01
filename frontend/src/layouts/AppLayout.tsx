import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, FileText, Wrench, Users, LogOut, Menu, X, Package, Car, BookOpen, MapPin, StickyNote, Sun, Moon, BarChart3, UserCheck, ShoppingCart, Building2 } from 'lucide-react'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { useThemeStore } from '@/store/themeStore'
import { authApi } from '@/api/auth.api'
import { cn } from '@/lib/cn'

function getInitials(fullName: string) {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return parts[0].slice(0, 2).toUpperCase()
}

// ── Palety sidebara per motyw ────────────────────────────────────────────────

const SIDEBAR_LIGHT = {
  bg:           '#0c1e3c',
  border:       'rgba(91,143,245,0.10)',
  text:         '#7da8d8',
  textHover:    '#c4d9fb',
  textActive:   '#e0ecfd',
  activeBg:     'rgba(39,97,235,0.14)',
  activeBorder: 'rgba(39,97,235,0.30)',
  hoverBg:      'rgba(91,143,245,0.07)',
  dot:          '#5b8ff5',
  logoText:     '#dce8f8',
  iconActive:   '#5b8ff5',
}

const SIDEBAR_DARK = {
  bg:           '#0d1117',
  border:       'rgba(251,191,36,0.10)',
  text:         '#9ca3af',
  textHover:    '#f9fafb',
  textActive:   '#fbbf24',
  activeBg:     'rgba(251,191,36,0.10)',
  activeBorder: 'rgba(251,191,36,0.28)',
  hoverBg:      'rgba(255,255,255,0.05)',
  dot:          '#fbbf24',
  logoText:     '#f9fafb',
  iconActive:   '#fbbf24',
}

interface NavItem { to: string; icon: React.ReactNode; label: string; adminOnly?: boolean }

const navItems: NavItem[] = [
  { to: '/',             icon: <LayoutDashboard className="h-[18px] w-[18px]" />, label: 'Dashboard' },
  { to: '/raporty',      icon: <FileText  className="h-[18px] w-[18px]" />,       label: 'Raporty' },
  { to: '/sprzet',       icon: <Wrench    className="h-[18px] w-[18px]" />,       label: 'Sprzęt' },
  { to: '/materialy',    icon: <Package   className="h-[18px] w-[18px]" />,       label: 'Materiałówka' },
  { to: '/notatki',      icon: <StickyNote  className="h-[18px] w-[18px]" />,     label: 'Notatki' },
  { to: '/hr',           icon: <UserCheck     className="h-[18px] w-[18px]" />,   label: 'HR' },
  { to: '/zakupy',       icon: <ShoppingCart className="h-[18px] w-[18px]" />,    label: 'Zamówienia' },
  { to: '/instrukcja',   icon: <BookOpen     className="h-[18px] w-[18px]" />,    label: 'Instrukcja' },
  { to: '/admin/przeglad-dnia', icon: <BarChart3 className="h-[18px] w-[18px]" />, label: 'Przegląd Dnia', adminOnly: true },
  { to: '/admin/pojazdy',       icon: <Car      className="h-[18px] w-[18px]" />, label: 'Pojazdy',       adminOnly: true },
  { to: '/admin/lokalizacje',   icon: <MapPin     className="h-[18px] w-[18px]" />, label: 'Lokalizacje',   adminOnly: true },
  { to: '/admin/kontrahenci',   icon: <Building2  className="h-[18px] w-[18px]" />, label: 'Kontrahenci',   adminOnly: true },
  { to: '/admin/users',         icon: <Users    className="h-[18px] w-[18px]" />, label: 'Użytkownicy',   adminOnly: true },
]

function LogoMark({ size = 36, dark }: { size?: number; dark?: boolean }) {
  const s = size
  return (
    <div
      style={{
        height: s, width: s, borderRadius: s * 0.3,
        background: dark
          ? 'linear-gradient(150deg, #fbbf24 0%, #f59e0b 60%, #d97706 100%)'
          : 'linear-gradient(150deg, #3b7ef8 0%, #2761eb 50%, #1a4280 100%)',
        boxShadow: dark
          ? '0 2px 10px rgba(251,191,36,0.40), inset 0 1px 0 rgba(255,255,255,0.15)'
          : '0 2px 10px rgba(39,97,235,0.45), inset 0 1px 0 rgba(255,255,255,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <span style={{
        color: dark ? '#1c1400' : '#e0ecfd',
        fontWeight: 800, fontSize: s * 0.48, letterSpacing: '-0.02em',
      }}>K</span>
    </div>
  )
}

function SidebarNav({ S, onNavigate, onLogout }: { S: typeof SIDEBAR_LIGHT; onNavigate?: () => void; onLogout?: () => void }) {
  const { isAdmin } = useAuthStore()
  const items = navItems.filter((i) => !i.adminOnly || isAdmin())

  return (
    <nav className="flex-1 px-3 py-3 space-y-0.5">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          onClick={onNavigate}
        >
          {({ isActive }) => (
            <div
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-all duration-150 cursor-pointer"
              style={{
                color:      isActive ? S.textActive : S.text,
                background: isActive ? S.activeBg : 'transparent',
                boxShadow:  isActive ? `inset 0 0 0 1px ${S.activeBorder}` : 'none',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = S.hoverBg
                  e.currentTarget.style.color = S.textHover
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = S.text
                }
              }}
            >
              <span style={{ color: isActive ? S.iconActive : S.text, opacity: isActive ? 1 : 0.65 }}>
                {item.icon}
              </span>
              <span className="flex-1">{item.label}</span>
              {isActive && (
                <span
                  className="h-1.5 w-1.5 rounded-full shrink-0"
                  style={{ background: S.dot }}
                />
              )}
            </div>
          )}
        </NavLink>
      ))}

      {onLogout && (
        <>
          <div style={{ height: 1, background: S.border, margin: '6px 4px' }} />
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-all duration-150"
            style={{ color: S.text, background: 'transparent' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(244,63,94,0.12)'; e.currentTarget.style.color = '#f87171' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = S.text }}
          >
            <span style={{ opacity: 0.65 }}><LogOut className="h-[18px] w-[18px]" /></span>
            <span className="flex-1 text-left">Wyloguj</span>
          </button>
        </>
      )}
    </nav>
  )
}

function UserFooter({ S, onLogout, hideLogout }: { S: typeof SIDEBAR_LIGHT; onLogout: () => void; hideLogout?: boolean }) {
  const { user } = useAuthStore()
  const { theme, toggle } = useThemeStore()
  const dark = theme === 'dark'

  return (
    <div className="px-3 py-3" style={{ borderTop: `1px solid ${S.border}` }}>
      <div className="flex items-center gap-3 rounded-xl px-3 py-2.5">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold"
          style={{
            background: dark
              ? 'linear-gradient(135deg, #fbbf24, #d97706)'
              : 'linear-gradient(135deg, #2761eb, #1a4280)',
            color: dark ? '#1c1400' : '#c4d9fb',
            boxShadow: dark
              ? '0 2px 6px rgba(251,191,36,0.35)'
              : '0 2px 6px rgba(39,97,235,0.35)',
          }}
        >
          {user?.fullName ? getInitials(user.fullName) : 'U'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold truncate leading-tight" style={{ color: S.logoText }}>
            {user?.fullName}
          </p>
          <p className="text-[11px] capitalize leading-tight mt-0.5" style={{ color: S.dot }}>
            {user?.role}
          </p>
        </div>
        {/* Przełącznik motywu */}
        <button
          onClick={toggle}
          title={dark ? 'Motyw jasny' : 'Motyw ciemny'}
          className="rounded-lg p-1.5 transition-all duration-150"
          style={{ color: S.text }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = S.hoverBg
            e.currentTarget.style.color = S.textHover
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = S.text
          }}
        >
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        {/* Wyloguj — tylko na desktopie (na mobile jest w nav) */}
        {!hideLogout && (
          <button
            onClick={onLogout}
            title="Wyloguj"
            className="rounded-lg p-1.5 transition-all duration-150"
            style={{ color: S.text }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(244,63,94,0.12)'
              e.currentTarget.style.color = '#f87171'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = S.text
            }}
          >
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}

export default function AppLayout() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { clearAuth } = useAuthStore()
  const { theme } = useThemeStore()
  const dark = theme === 'dark'
  const S = dark ? SIDEBAR_DARK : SIDEBAR_LIGHT

  const logout = useMutation({
    mutationFn: () => authApi.logout(),
    onSettled: () => { clearAuth(); navigate('/login') },
  })

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)', transition: 'background-color 0.2s ease' }}>

      {/* ── Sidebar desktop ───────────────────── */}
      <aside
        className="hidden lg:flex w-60 flex-col shrink-0"
        style={{ background: S.bg, boxShadow: '4px 0 32px rgba(6,15,32,0.28)', transition: 'background-color 0.2s ease' }}
      >
        <div className="flex items-center px-5 py-5" style={{ borderBottom: `1px solid ${S.border}` }}>
          <button onClick={() => navigate('/dashboard')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
            <img src="/logo-male.png" alt="Kahma" style={{ width: 120, height: 'auto' }} />
          </button>
        </div>
        <SidebarNav S={S} />
        <UserFooter S={S} onLogout={() => logout.mutate()} />
      </aside>

      {/* ── Sidebar mobile overlay ─────────────── */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="absolute inset-0 animate-fade-in"
            style={{ background: 'rgba(6,15,32,0.70)', backdropFilter: 'blur(3px)' }}
            onClick={() => setOpen(false)}
          />
          <aside
            className="relative flex w-72 flex-col animate-slide-in"
            style={{ background: S.bg, boxShadow: '8px 0 40px rgba(6,15,32,0.40)' }}
          >
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${S.border}` }}>
              <div className="flex items-center">
                <button onClick={() => { navigate('/dashboard'); setOpen(false) }} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                  <img src="/logo-male.png" alt="Kahma" style={{ width: 120, height: 'auto' }} />
                </button>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-xl p-2 transition-all duration-150"
                style={{ color: S.text }}
                onMouseEnter={(e) => { e.currentTarget.style.background = S.hoverBg; e.currentTarget.style.color = S.textHover }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = S.text }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <SidebarNav S={S} onNavigate={() => setOpen(false)} onLogout={() => { logout.mutate(); setOpen(false) }} />
            <UserFooter S={S} onLogout={() => { logout.mutate(); setOpen(false) }} hideLogout />
          </aside>
        </div>
      )}

      {/* ── Główna treść ──────────────────────── */}
      <div className="flex flex-1 flex-col min-w-0">

        {/* ── Mobile header ── */}
        <header
          className="lg:hidden flex items-center h-14 px-3 shrink-0"
          style={{ background: S.bg, borderBottom: `1px solid ${S.border}`, transition: 'background-color 0.2s ease' }}
        >
          <button
            onClick={() => setOpen(true)}
            className="rounded-xl p-2 transition-all duration-150"
            style={{ color: S.text }}
            onMouseEnter={(e) => { e.currentTarget.style.background = S.hoverBg }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex-1" />

          <div className="flex items-center pr-1">
            <button onClick={() => navigate('/dashboard')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
              <img src="/logo-male.png" alt="Kahma" style={{ width: 100, height: 'auto' }} />
            </button>
          </div>
        </header>

        {/* ── Content ───────────────────────────── */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl px-4 py-5 md:px-6 md:py-7 lg:px-8 lg:py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
