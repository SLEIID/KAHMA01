import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Download, ChevronRight, Calendar, Clock, MapPin, User, Building2, PenLine, X, LockOpen, Trash2 } from 'lucide-react'
import { reportsApi, type Report, type AvailableReport } from '@/api/reports.api'
import { usersApi } from '@/api/users.api'
import { locationsApi } from '@/api/locations.api'
import { departmentsApi } from '@/api/departments.api'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { PageSpinner } from '@/components/ui/Spinner'
import { useTheme } from '@/lib/theme'
import type { User as UserType } from '@/types'

const today = () => new Date().toISOString().slice(0, 10)
const firstOfMonth = () => {
  const d = new Date()
  d.setDate(1)
  return d.toISOString().slice(0, 10)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('pl-PL', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
}

function calcHoursNum(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return (eh * 60 + em) - (sh * 60 + sm)
}

function formatMins(mins: number) {
  if (mins <= 0) return '–'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

// ── Karta raportu dnia (z listą wpisów) ──────────────────────────────────────

function ReportCard({ report, showUser, onClick, onSignOff, onUnlock, onDelete }: {
  report: Report
  showUser: boolean
  onClick: () => void
  onSignOff?: () => void
  onUnlock?: () => void
  onDelete?: () => void
}) {
  const t = useTheme()
  const totalMins = report.entries.reduce((sum, e) => sum + calcHoursNum(e.workStart, e.workEnd), 0)
  const locations   = [...new Set(report.entries.map((e) => e.location.name))]
  const departments = [...new Set(report.entries.filter((e) => e.department).map((e) => e.department!.name))]
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl transition-all duration-150"
      style={{
        background: t.surface,
        boxShadow: t.cardShadow,
        padding: '1rem',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = t.dark
          ? '0 0 0 1px rgba(251,191,36,0.25), 0 4px 16px rgba(251,191,36,0.12)'
          : '0 0 0 1px rgba(39,97,235,0.20), 0 4px 16px rgba(39,97,235,0.12)'
        e.currentTarget.style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = t.cardShadow
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">

          {/* Nagłówek: data + badge zablokowany + badge zatwierdzenia */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold" style={{ color: t.ink }}>
              {formatDate(report.reportDate)}
            </span>
            {report.isSigned && (
              <span
                className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(39,97,235,0.12)', color: '#2761eb' }}
              >
                Podpisany
              </span>
            )}
            {report.isLocked && !report.unlockedUntil && (
              <span
                className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(217,119,6,0.12)', color: '#d97706' }}
              >
                Zablokowany
              </span>
            )}
            {!report.isLocked && report.unlockedUntil && new Date(report.unlockedUntil) > new Date() && (
              <span
                className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(22,163,74,0.12)', color: '#16a34a' }}
              >
                Odblokowany do {new Date(report.unlockedUntil).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            {report.approvedAt && report.isOffer === 'offer' ? (
              <span
                className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(124,58,237,0.12)', color: '#7c3aed' }}
              >
                Ofertowy
              </span>
            ) : report.approvedAt && report.isOffer === 'no_offer' ? (
              <span
                className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(22,163,74,0.12)', color: '#16a34a' }}
              >
                Bez oferty
              </span>
            ) : report.approvedAt && report.isOffer === 'to_quote' ? (
              <span
                className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(234,88,12,0.12)', color: '#ea580c' }}
              >
                Do zaofertowania
              </span>
            ) : (
              <span
                className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(239,68,68,0.10)', color: '#dc2626' }}
              >
                Niezatwierdzony
              </span>
            )}
          </div>

          {showUser && (
            <div className="flex items-center gap-1 mt-1">
              <User className="h-3 w-3" style={{ color: t.inkDim }} />
              <span className="text-[12px] font-semibold" style={{ color: t.inkDim }}>
                {report.user.fullName}
              </span>
            </div>
          )}

          {/* Podsumowanie: czas łącznie + liczba wpisów */}
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <span className="flex items-center gap-1 text-xs" style={{ color: t.inkDim }}>
              <Clock className="h-3.5 w-3.5" />
              {formatMins(totalMins)} łącznie
            </span>
            <span className="text-xs font-medium px-1.5 py-0.5 rounded-full"
              style={{ background: t.blue.bg, color: t.blue.text }}>
              {report.entries.length} {report.entries.length === 1 ? 'wpis' : report.entries.length < 5 ? 'wpisy' : 'wpisów'}
            </span>
          </div>

          {/* Lokalizacje + wydziały */}
          {locations.length > 0 && (
            <div className="flex items-center gap-1 mt-1.5 flex-wrap">
              <MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: t.inkDim }} />
              <span className="text-xs" style={{ color: t.inkDim }}>
                {locations.slice(0, 3).join(' · ')}
                {locations.length > 3 && ` +${locations.length - 3}`}
              </span>
            </div>
          )}
          {departments.length > 0 && (
            <div className="flex items-center gap-1 mt-1 flex-wrap">
              <Building2 className="h-3.5 w-3.5 shrink-0" style={{ color: t.inkMuted }} />
              <span className="text-xs" style={{ color: t.inkMuted }}>
                {departments.slice(0, 3).join(' · ')}
                {departments.length > 3 && ` +${departments.length - 3}`}
              </span>
            </div>
          )}

          {/* Sygnatariusze */}
          {report.signatures.length > 0 && (
            <div className="flex items-center gap-1 mt-1 flex-wrap">
              <PenLine className="h-3.5 w-3.5 shrink-0" style={{ color: '#2761eb' }} />
              <span className="text-xs" style={{ color: '#2761eb' }}>
                Podpisał: {report.signatures.map((s) => s.signer.fullName).join(', ')}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          <ChevronRight className="h-4 w-4" style={{ color: t.inkMuted }} />
          {onUnlock && report.isLocked && (
            <button
              onClick={(e) => { e.stopPropagation(); onUnlock() }}
              className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(22,163,74,0.10)', color: '#16a34a' }}
              title="Odblokuj na 24h"
            >
              <LockOpen className="h-3 w-3" /> Odblokuj
            </button>
          )}
          {onSignOff && !report.isLocked && (
            <button
              onClick={(e) => { e.stopPropagation(); onSignOff() }}
              className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(220,38,38,0.08)', color: '#dc2626' }}
              title="Cofnij podpis"
            >
              Cofnij
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete() }}
              className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(220,38,38,0.08)', color: '#dc2626' }}
              title="Usuń pusty raport"
            >
              <Trash2 className="h-3 w-3" /> Usuń
            </button>
          )}
        </div>
      </div>
    </button>
  )
}

// ── Widok admina ─────────────────────────────────────────────────────────────

const FILTER_KEY = 'kahma_reports_filter'
function loadFilter() {
  try { return JSON.parse(sessionStorage.getItem(FILTER_KEY) ?? 'null') } catch { return null }
}
function saveFilter(f: object) {
  try { sessionStorage.setItem(FILTER_KEY, JSON.stringify(f)) } catch { /* ignore */ }
}

function AdminView() {
  const navigate = useNavigate()
  const t = useTheme()
  const qc = useQueryClient()

  const saved = loadFilter()
  const [from, setFrom]           = useState<string>(saved?.from       ?? firstOfMonth())
  const [to, setTo]               = useState<string>(saved?.to         ?? today())
  const [userId, setUserId]       = useState<string>(saved?.userId     ?? '')
  const [locationId, setLoc]      = useState<string>(saved?.locationId ?? '')
  const [departmentId, setDept]   = useState<string>(saved?.deptId     ?? '')
  const [page, setPage]           = useState<number>(saved?.page       ?? 1)

  const params = {
    page, limit: 20, from, to,
    ...(userId       ? { userId }       : {}),
    ...(locationId   ? { locationId }   : {}),
    ...(departmentId ? { departmentId } : {}),
  }

  const { data, isLoading } = useQuery({
    queryKey: ['reports', params],
    queryFn: () => reportsApi.list(params).then((r) => r.data.data),
  })

  const { mutate: unlockReport } = useMutation({
    mutationFn: (reportId: string) => reportsApi.unlock(reportId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports'] }),
  })

  const [confirmDeleteReportId, setConfirmDeleteReportId] = useState<string | null>(null)
  const { mutate: deleteReport, isPending: deletingReport } = useMutation({
    mutationFn: (reportId: string) => reportsApi.deleteReport(reportId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reports'] })
      setConfirmDeleteReportId(null)
    },
  })

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createUserId,   setCreateUserId]   = useState('')
  const [createDate,     setCreateDate]     = useState(today())
  const [createErr,      setCreateErr]      = useState('')

  const createMutation = useMutation({
    mutationFn: () => reportsApi.create({ date: createDate, userId: createUserId }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['reports'] })
      navigate(`/raporty/${res.data.data.id}`)
    },
    onError: (e: unknown) => {
      const msg = (e as any)?.response?.data?.error ?? 'Błąd serwera'
      setCreateErr(msg)
    },
  })

  const handleCreate = () => {
    setCreateErr('')
    if (!createUserId) { setCreateErr('Wybierz pracownika'); return }
    if (!createDate)   { setCreateErr('Podaj datę'); return }
    createMutation.mutate()
  }

  const { data: usersData } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => usersApi.getAll().then((r) => r.data.data),
  })

  const { data: locationsData } = useQuery({
    queryKey: ['locations'],
    queryFn: () => locationsApi.getAll().then((r) => r.data.data),
  })

  const { data: deptsData } = useQuery({
    queryKey: ['departments', locationId],
    queryFn:  () => locationId
      ? departmentsApi.list(Number(locationId)).then((r) => r.data.data)
      : departmentsApi.list().then((r) => r.data.data),
  })

  useEffect(() => {
    saveFilter({ from, to, userId, locationId, deptId: departmentId, page })
  }, [from, to, userId, locationId, departmentId, page])

  const handleExport = async () => {
    const p: Record<string, string> = { from, to }
    if (userId)       p.userId       = userId
    if (locationId)   p.locationId   = locationId
    if (departmentId) p.departmentId = departmentId
    const res = await reportsApi.exportXlsx(p)
    const url = URL.createObjectURL(res.data as Blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `raporty_${from}_${to}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  const reports    = data?.items ?? []
  const totalPages = data?.pages ?? 1

  const inputStyle: React.CSSProperties = {
    background: t.surfaceInput, color: t.ink, borderRadius: 10,
    padding: '0.5rem 0.75rem', fontSize: 14, outline: 'none',
    boxShadow: '0 0 0 1px rgba(12,30,60,0.10)', width: '100%',
    appearance: 'none' as const,
  }

  return (
    <div className="animate-fade-in max-w-3xl mx-auto space-y-4">

      <div className="flex items-center justify-between">
        <h1 className="page-title">Raporty dnia</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowCreateForm((v) => !v); setCreateErr('') }}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium"
            style={{ background: showCreateForm ? t.blue.bg : (t.dark ? 'rgba(255,255,255,0.06)' : 'rgba(12,30,60,0.06)'), color: showCreateForm ? t.blue.text : t.inkDim }}
          >
            <Plus className="h-4 w-4" />
            <span>Utwórz raport</span>
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium"
            style={{ background: t.blue.bg, color: t.blue.text }}
          >
            <Download className="h-4 w-4" />
            <span>Eksportuj XLSX</span>
          </button>
        </div>
      </div>

      {/* Formularz tworzenia raportu dla pracownika */}
      {showCreateForm && (
        <div className="rounded-2xl p-4 space-y-3 animate-fade-in"
          style={{ background: t.surface, boxShadow: '0 0 0 2px rgba(39,97,235,0.20), 0 4px 12px rgba(39,97,235,0.10)' }}>
          <div className="flex items-center justify-between">
            <p className="section-label">Utwórz raport z przeszłości</p>
            <button onClick={() => setShowCreateForm(false)} style={{ color: t.inkMuted }}>
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: t.inkMuted }}>Pracownik</label>
              <select
                value={createUserId}
                onChange={(e) => setCreateUserId(e.target.value)}
                style={{ ...inputStyle }}
              >
                <option value="">— wybierz pracownika —</option>
                {(usersData ?? []).filter((u: UserType) => u.isActive).map((u: UserType) => (
                  <option key={u.id} value={u.id}>{u.fullName}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: t.inkMuted }}>Data raportu</label>
              <input
                type="date"
                value={createDate}
                max={today()}
                onChange={(e) => setCreateDate(e.target.value)}
                style={{ ...inputStyle }}
              />
            </div>
          </div>
          {createErr && <p className="text-[12.5px] font-medium" style={{ color: '#f43f5e' }}>{createErr}</p>}
          <div className="flex gap-2">
            <Button size="sm" loading={createMutation.isPending} onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-1" /> Utwórz i otwórz raport
            </Button>
            <button
              onClick={() => setShowCreateForm(false)}
              className="flex-1 rounded-xl py-2 text-sm font-medium"
              style={{ background: t.dark ? 'rgba(255,255,255,0.06)' : 'rgba(12,30,60,0.06)', color: '#4a6080' }}
            >
              Anuluj
            </button>
          </div>
        </div>
      )}

      {/* Filtry */}
      <div className="rounded-2xl p-4 space-y-3"
        style={{ background: t.surface, boxShadow: t.cardShadow }}>
        <p className="section-label">Filtry</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: t.inkMuted }}>Pracownik</label>
            <select value={userId} onChange={(e) => { setUserId(e.target.value); setPage(1) }} style={inputStyle}>
              <option value="">— wszyscy pracownicy —</option>
              {(usersData ?? []).map((u: UserType) => (
                <option key={u.id} value={u.id}>{u.fullName}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: t.inkMuted }}>Lokalizacja</label>
            <select value={locationId} onChange={(e) => { setLoc(e.target.value); setPage(1) }} style={inputStyle}>
              <option value="">— wszystkie lokalizacje —</option>
              {(locationsData ?? []).map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: t.inkMuted }}>Wydział</label>
            <select value={departmentId} onChange={(e) => { setDept(e.target.value); setPage(1) }} style={inputStyle}>
              <option value="">— wszystkie wydziały —</option>
              {(deptsData ?? []).filter((d) => d.isActive).map((d) => (
                <option key={d.id} value={d.id}>{d.location.name} › {d.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: t.inkMuted }}>Od</label>
              <input type="date" value={from} max={to}
                onChange={(e) => { setFrom(e.target.value); setPage(1) }} style={inputStyle} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: t.inkMuted }}>Do</label>
              <input type="date" value={to} min={from} max={today()}
                onChange={(e) => { setTo(e.target.value); setPage(1) }} style={inputStyle} />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-0.5">
          <span className="text-xs" style={{ color: t.inkMuted }}>
            {data?.total ?? 0} {data?.total === 1 ? 'raport' : 'raportów'}
          </span>
          <button
            onClick={() => { setFrom(firstOfMonth()); setTo(today()); setUserId(''); setLoc(''); setDept(''); setPage(1) }}
            className="text-xs font-medium" style={{ color: t.inkDim }}
          >
            Wyczyść filtry
          </button>
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <PageSpinner />
      ) : reports.length === 0 ? (
        <div className="rounded-2xl p-10 text-center"
          style={{ background: t.surface, boxShadow: t.cardShadow }}>
          <Calendar className="h-10 w-10 mx-auto mb-3" style={{ color: t.inkMuted }} />
          <p className="font-semibold" style={{ color: t.ink }}>Brak raportów</p>
          <p className="text-sm mt-1" style={{ color: t.inkDim }}>Brak raportów dla wybranych filtrów.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {reports.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              showUser={!userId}
              onClick={() => navigate(`/raporty/${report.id}`)}
              onUnlock={() => unlockReport(report.id)}
              onDelete={report.entries.length === 0 ? () => setConfirmDeleteReportId(report.id) : undefined}
            />
          ))}

        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-40"
            style={{ background: t.blue.bg, color: t.blue.text }}>
            ← Poprzednia
          </button>
          <span className="text-sm" style={{ color: t.inkMuted }}>{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-40"
            style={{ background: t.blue.bg, color: t.blue.text }}>
            Następna →
          </button>
        </div>
      )}

      <Modal
        open={!!confirmDeleteReportId}
        onClose={() => setConfirmDeleteReportId(null)}
        title="Usuń pusty raport"
        description="Raport nie zawiera żadnych wpisów. Czy na pewno chcesz go usunąć? Operacja jest nieodwracalna."
      >
        <div className="flex gap-3 justify-end mt-2">
          <Button variant="ghost" onClick={() => setConfirmDeleteReportId(null)}>
            Anuluj
          </Button>
          <Button
            variant="danger"
            loading={deletingReport}
            onClick={() => confirmDeleteReportId && deleteReport(confirmDeleteReportId)}
          >
            Usuń raport
          </Button>
        </div>
      </Modal>
    </div>
  )
}

// ── Modal: podpisz się pod raport kolegi ─────────────────────────────────────

function SignModal({ onClose }: { onClose: () => void }) {
  const t = useTheme()
  const qc = useQueryClient()

  const { data: available, isLoading } = useQuery({
    queryKey: ['available-to-sign'],
    queryFn: () => reportsApi.availableToSign().then((r) => r.data.data),
  })

  const { mutate: signOnto, isPending } = useMutation({
    mutationFn: (reportId: string) => reportsApi.signOnto(reportId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reports'] })
      qc.invalidateQueries({ queryKey: ['available-to-sign'] })
      onClose()
    },
  })

  function calcTotalMins(entries: AvailableReport['entries']) {
    return entries.reduce((sum, e) => {
      const [sh, sm] = e.workStart.split(':').map(Number)
      const [eh, em] = e.workEnd.split(':').map(Number)
      return sum + (eh * 60 + em) - (sh * 60 + sm)
    }, 0)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl p-5 space-y-4"
        style={{ background: t.surface, boxShadow: '0 8px 40px rgba(0,0,0,0.25)', maxHeight: '80vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="font-bold text-base" style={{ color: t.ink }}>Podpisz się pod raport</p>
          <button onClick={onClose} style={{ color: t.inkMuted }}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm" style={{ color: t.inkDim }}>
          Dostępne raporty z dzisiaj — podpisując się potwierdzasz, że wykonywałeś te same zadania.
        </p>

        {isLoading ? (
          <PageSpinner />
        ) : !available || available.length === 0 ? (
          <div className="text-center py-6">
            <PenLine className="h-8 w-8 mx-auto mb-2" style={{ color: t.inkMuted }} />
            <p className="text-sm font-medium" style={{ color: t.inkDim }}>Brak dostępnych raportów</p>
            <p className="text-xs mt-1" style={{ color: t.inkMuted }}>
              Żaden kolega nie wypełnił jeszcze raportu na dzisiaj.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {available.map((r) => {
              const totalMins = calcTotalMins(r.entries)
              const h = Math.floor(totalMins / 60)
              const m = totalMins % 60
              const timeStr = m > 0 ? `${h}h ${m}min` : `${h}h`
              const locations = [...new Set(r.entries.map((e) => e.location.name))]
              return (
                <div key={r.id}
                  className="rounded-xl p-3 space-y-2"
                  style={{ background: t.surfaceInput, boxShadow: '0 0 0 1px rgba(12,30,60,0.08)' }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold" style={{ color: t.ink }}>{r.user.fullName}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="flex items-center gap-1 text-xs" style={{ color: t.inkDim }}>
                          <Clock className="h-3 w-3" />{timeStr}
                        </span>
                        <span className="flex items-center gap-1 text-xs" style={{ color: t.inkDim }}>
                          <MapPin className="h-3 w-3" />{locations.join(' · ')}
                        </span>
                      </div>
                      {r.entries.length > 0 && (
                        <p className="text-xs mt-1 line-clamp-2" style={{ color: t.inkMuted }}>
                          {r.entries[0].description}
                          {r.entries.length > 1 && ` (+${r.entries.length - 1} wpisów)`}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => signOnto(r.id)}
                      disabled={isPending}
                      className="shrink-0 px-3 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-50"
                      style={{ background: '#2761eb', color: '#fff' }}
                    >
                      Podpisz
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Widok pracownika ─────────────────────────────────────────────────────────

function EmployeeView() {
  const navigate = useNavigate()
  const t = useTheme()
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [showSignModal, setShowSignModal] = useState(false)

  const params = { page, limit: 20 }

  const { data, isLoading } = useQuery({
    queryKey: ['reports', params],
    queryFn: () => reportsApi.list(params).then((r) => r.data.data),
  })

  const { mutate: signOff } = useMutation({
    mutationFn: (reportId: string) => reportsApi.signOff(reportId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports'] }),
  })

  const reports    = data?.items ?? []
  const totalPages = data?.pages ?? 1

  return (
    <div className="animate-fade-in max-w-2xl mx-auto space-y-4">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Moje raporty</h1>
          <p className="text-sm mt-0.5" style={{ color: t.inkDim }}>
            {data?.total ?? 0} {data?.total === 1 ? 'raport' : 'raportów'} łącznie
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSignModal(true)}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold"
            style={{ background: '#2761eb', color: '#fff' }}
          >
            <PenLine className="h-4 w-4" />
            Podpis
          </button>
          <Button size="sm" onClick={() => navigate('/raporty/nowy')}>
            <Plus className="h-4 w-4 mr-1" /> Nowy raport
          </Button>
        </div>
      </div>

      {isLoading ? (
        <PageSpinner />
      ) : reports.length === 0 ? (
        <div className="rounded-2xl p-10 text-center"
          style={{ background: t.surface, boxShadow: t.cardShadow }}>
          <Calendar className="h-10 w-10 mx-auto mb-3" style={{ color: t.inkMuted }} />
          <p className="font-semibold" style={{ color: t.ink }}>Brak raportów</p>
          <p className="text-sm mt-1" style={{ color: t.inkDim }}>Nie masz jeszcze żadnych raportów.</p>
          <Button className="mt-4" size="sm" onClick={() => navigate('/raporty/nowy')}>
            <Plus className="h-4 w-4 mr-1" /> Dodaj raport
          </Button>
        </div>
      ) : (() => {
        const todayReports    = reports.filter((r) => !r.isLocked)
        const historyReports  = reports.filter((r) =>  r.isLocked)
        return (
          <div className="space-y-5">
            {todayReports.length > 0 && (
              <div className="space-y-2.5">
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: t.inkMuted }}>Dziś</p>
                {todayReports.map((report) => (
                  <ReportCard
                    key={report.id}
                    report={report}
                    showUser={report.isSigned}
                    onClick={() => navigate(`/raporty/${report.id}`)}
                    onSignOff={report.isSigned ? () => signOff(report.id) : undefined}
                  />
                ))}
              </div>
            )}
            {historyReports.length > 0 && (
              <div className="space-y-2.5">
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: t.inkMuted }}>Historia</p>
                {historyReports.map((report) => (
                  <ReportCard
                    key={report.id}
                    report={report}
                    showUser={report.isSigned}
                    onClick={() => navigate(`/raporty/${report.id}`)}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })()}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-40"
            style={{ background: t.blue.bg, color: t.blue.text }}>
            ← Poprzednia
          </button>
          <span className="text-sm" style={{ color: t.inkMuted }}>{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-40"
            style={{ background: t.blue.bg, color: t.blue.text }}>
            Następna →
          </button>
        </div>
      )}

      {showSignModal && <SignModal onClose={() => setShowSignModal(false)} />}
    </div>
  )
}

// ── Główny eksport ───────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { isAdmin } = useAuthStore()
  return isAdmin() ? <AdminView /> : <EmployeeView />
}
