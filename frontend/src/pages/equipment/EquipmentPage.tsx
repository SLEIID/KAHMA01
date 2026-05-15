import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Wrench, Plus, X, Check, AlertTriangle, RotateCcw, ChevronDown, ChevronUp,
  Tag, ClipboardList, TriangleAlert, Search, Trash2, Clock, MapPin, FileText,
} from 'lucide-react'
import axios from 'axios'
import {
  equipmentApi, rentalsApi, issuesApi,
  type EquipmentItem, type EquipmentRental, type EquipmentIssue, type ItemStatus,
} from '@/api/equipment.api'
import { locationsApi } from '@/api/locations.api'
import { reportsApi } from '@/api/reports.api'
import { usersApi } from '@/api/users.api'
import { useAuthStore } from '@/store/authStore'
import { useTheme } from '@/lib/theme'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { PageSpinner } from '@/components/ui/Spinner'

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<ItemStatus, string> = {
  available: 'Dostępny',
  rented:    'Wypożyczony',
  service:   'Serwis',
  retired:   'Wycofany',
}

function StatusBadge({ status }: { status: ItemStatus }) {
  const t = useTheme()

  const STATUS_STYLE: Record<ItemStatus, React.CSSProperties> = t.dark ? {
    available: { background: 'rgba(16,185,129,0.15)',  color: '#34d399' },
    rented:    { background: 'rgba(251,191,36,0.15)',  color: '#fbbf24' },
    service:   { background: 'rgba(59,130,246,0.15)',  color: '#60a5fa' },
    retired:   { background: 'rgba(156,163,175,0.14)', color: '#9ca3af' },
  } : {
    available: { background: 'rgba(5,150,105,0.10)',   color: '#065f46' },
    rented:    { background: 'rgba(217,119,6,0.10)',   color: '#92400e' },
    service:   { background: 'rgba(14,165,233,0.10)',  color: '#0c4a6e' },
    retired:   { background: 'rgba(156,163,175,0.14)', color: '#6b7280' },
  }

  return (
    <span
      className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
      style={STATUS_STYLE[status]}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}

function errMsg(err: unknown) {
  return axios.isAxiosError(err) ? err.response?.data?.error ?? 'Błąd serwera' : 'Błąd serwera'
}

// ── Czas do zwrotu ───────────────────────────────────────────────────────────

function TimeLeftBadge({
  rental, t,
}: { rental: EquipmentRental; t: ReturnType<typeof useTheme> }) {
  if (!rental.expectedReturn) return null

  const diffMs  = new Date(rental.expectedReturn).getTime() - Date.now()
  const overdue = diffMs < 0
  const absMs   = Math.abs(diffMs)
  const hours   = Math.floor(absMs / 3_600_000)
  const minutes = Math.floor((absMs % 3_600_000) / 60_000)
  const label   = hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`

  return (
    <p className="text-[11px] mt-0.5 flex items-center gap-1" style={{ color: overdue ? '#f43f5e' : t.inkMuted }}>
      <Clock style={{ height: 11, width: 11, flexShrink: 0 }} />
      {overdue ? `Przeterminowane o ${label}` : `Zwrot za ${label}`}
    </p>
  )
}

// ── Formularz zgłoszenia problemu (inline) ───────────────────────────────────

function IssueForm({ item, onClose }: { item: EquipmentItem; onClose: () => void }) {
  const qc = useQueryClient()
  const t = useTheme()
  const [desc, setDesc] = useState('')
  const [err,  setErr]  = useState('')

  const mutation = useMutation({
    mutationFn: () => issuesApi.create({ itemId: item.id, description: desc }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['eq-issues'] }); onClose() },
    onError:   (e) => setErr(errMsg(e)),
  })

  return (
    <div
      className="rounded-xl p-3 mt-2 animate-fade-in"
      style={{ background: t.amber.bg, boxShadow: '0 0 0 1px rgba(217,119,6,0.18)' }}
    >
      <p className="text-xs font-semibold mb-2" style={{ color: t.amber.text }}>
        Zgłoś problem — {item.name}
      </p>
      <textarea
        className="w-full rounded-lg px-3 py-2 text-sm resize-none outline-none"
        style={{ background: t.surfaceAlt, border: '1px solid rgba(217,119,6,0.25)', color: t.ink, minHeight: 72 }}
        placeholder="Opisz problem..."
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
      />
      {err && <p className="text-[12px] font-medium mt-1" style={{ color: '#f43f5e' }}>{err}</p>}
      <div className="flex gap-2 mt-2">
        <Button size="sm" loading={mutation.isPending} onClick={() => { setErr(''); mutation.mutate() }}>
          <Check className="h-3.5 w-3.5 mr-1" /> Wyślij
        </Button>
        <button
          onClick={onClose}
          className="flex-1 rounded-xl py-1.5 text-sm font-medium"
          style={{ background: t.dark ? 'rgba(255,255,255,0.06)' : 'rgba(12,30,60,0.06)', color: '#4a6080' }}
        >
          Anuluj
        </button>
      </div>
    </div>
  )
}

// ── Formularz zwrotu (inline) ─────────────────────────────────────────────────

function ReturnForm({
  rental, onClose,
}: { rental: EquipmentRental; onClose: () => void }) {
  const qc   = useQueryClient()
  const t = useTheme()
  const [notes, setNotes] = useState('')
  const [err,   setErr]   = useState('')

  const mutation = useMutation({
    mutationFn: () => rentalsApi.return(rental.id, { returnNotes: notes || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eq-items'] })
      qc.invalidateQueries({ queryKey: ['eq-rentals'] })
      onClose()
    },
    onError: (e) => setErr(errMsg(e)),
  })

  return (
    <div
      className="rounded-xl p-3 mt-2 animate-fade-in"
      style={{ background: t.green.bg, boxShadow: '0 0 0 1px rgba(5,150,105,0.20)' }}
    >
      <p className="text-xs font-semibold mb-2" style={{ color: t.green.text }}>
        Zwróć — {rental.item.name}
      </p>
      <textarea
        className="w-full rounded-lg px-3 py-2 text-sm resize-none outline-none"
        style={{ background: t.surfaceAlt, border: '1px solid rgba(5,150,105,0.22)', color: t.ink, minHeight: 56 }}
        placeholder="Uwagi przy zwrocie (opcjonalne)..."
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      {err && <p className="text-[12px] font-medium mt-1" style={{ color: '#f43f5e' }}>{err}</p>}
      <div className="flex gap-2 mt-2">
        <Button size="sm" loading={mutation.isPending} onClick={() => { setErr(''); mutation.mutate() }}>
          <RotateCcw className="h-3.5 w-3.5 mr-1" /> Zwróć sprzęt
        </Button>
        <button
          onClick={onClose}
          className="flex-1 rounded-xl py-1.5 text-sm font-medium"
          style={{ background: t.dark ? 'rgba(255,255,255,0.06)' : 'rgba(12,30,60,0.06)', color: '#4a6080' }}
        >
          Anuluj
        </button>
      </div>
    </div>
  )
}

// ── Formularz przypisania do raportu (inline) ─────────────────────────────────

function AssignReportForm({ rental, onClose }: { rental: EquipmentRental; onClose: () => void }) {
  const qc = useQueryClient()
  const t  = useTheme()
  const { user } = useAuthStore()
  const [reportId, setReportId] = useState<string>(rental.reportId ?? '')
  const [err, setErr] = useState('')

  const { data: reportsData } = useQuery({
    queryKey: ['reports-mine-all'],
    queryFn: () => reportsApi.list({ limit: 30 }).then((r) => r.data.data.items),
  })

  const myReports = (reportsData ?? []).filter((r) => r.user.id === user?.id)

  const mutation = useMutation({
    mutationFn: () => rentalsApi.assignReport(rental.id, reportId || null),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eq-rentals'] })
      onClose()
    },
    onError: (e) => setErr(errMsg(e)),
  })

  return (
    <div
      className="rounded-xl p-3 mt-2 animate-fade-in"
      style={{ background: t.blue.bg, boxShadow: '0 0 0 1px rgba(39,97,235,0.18)' }}
    >
      <p className="text-xs font-semibold mb-2" style={{ color: t.blue.text }}>
        Przypisz do raportu dnia
      </p>
      <select
        className="w-full rounded-lg px-3 py-2 text-sm outline-none"
        style={{ background: t.surfaceAlt, border: '1px solid rgba(39,97,235,0.25)', color: t.ink, fontSize: 16 }}
        value={reportId}
        onChange={(e) => setReportId(e.target.value)}
      >
        <option value="">— brak —</option>
        {myReports.map((r) => (
          <option key={r.id} value={r.id}>
            {new Date(r.reportDate).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })}
          </option>
        ))}
      </select>
      {err && <p className="text-[12px] font-medium mt-1" style={{ color: '#f43f5e' }}>{err}</p>}
      <div className="flex gap-2 mt-2">
        <Button size="sm" loading={mutation.isPending} onClick={() => { setErr(''); mutation.mutate() }}>
          <Check className="h-3.5 w-3.5 mr-1" /> Zapisz
        </Button>
        <button
          onClick={onClose}
          className="flex-1 rounded-xl py-1.5 text-sm font-medium"
          style={{ background: t.dark ? 'rgba(255,255,255,0.06)' : 'rgba(12,30,60,0.06)', color: '#4a6080' }}
        >
          Anuluj
        </button>
      </div>
    </div>
  )
}

// ── Formularz wypożyczenia (inline) ──────────────────────────────────────────

function RentForm({ item, onClose }: { item: EquipmentItem; onClose: () => void }) {
  const qc = useQueryClient()
  const t  = useTheme()
  const { isAdmin } = useAuthStore()
  const admin = isAdmin()

  const [locationId,    setLocationId]    = useState(0)
  const [durationHours, setDurationHours] = useState('')
  const [targetUserId,  setTargetUserId]  = useState('')
  const [rentedAt,      setRentedAt]      = useState('')
  const [err,           setErr]           = useState('')

  const { data: locData } = useQuery({
    queryKey: ['locations'],
    queryFn:  () => locationsApi.getAll().then((r) => r.data.data.filter((l) => l.isActive)),
  })
  const locations = locData ?? []

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn:  () => usersApi.getAll().then((r) => r.data.data.filter((u) => u.isActive)),
    enabled:  admin,
  })
  const activeUsers = usersData ?? []

  const mutation = useMutation({
    mutationFn: () => rentalsApi.rent({
      itemId:        item.id,
      locationId,
      durationHours: durationHours ? parseInt(durationHours, 10) : undefined,
      ...(admin && targetUserId ? { userId: targetUserId } : {}),
      ...(admin && rentedAt     ? { rentedAt: new Date(rentedAt).toISOString() } : {}),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eq-items'] })
      qc.invalidateQueries({ queryKey: ['eq-rentals'] })
      onClose()
    },
    onError: (e) => setErr(errMsg(e)),
  })

  const handleSubmit = () => {
    if (!locationId) { setErr('Wybierz lokalizację'); return }
    if (admin && rentedAt && isNaN(new Date(rentedAt).getTime())) { setErr('Nieprawidłowa data wypożyczenia'); return }
    setErr('')
    mutation.mutate()
  }

  const fieldStyle = { background: t.surfaceAlt, border: '1px solid rgba(39,97,235,0.25)' }

  return (
    <div
      className="rounded-xl p-3 mt-2 animate-fade-in"
      style={{ background: t.blue.bg, boxShadow: '0 0 0 1px rgba(39,97,235,0.18)' }}
    >
      <p className="text-xs font-semibold mb-3" style={{ color: t.blue.text }}>
        Wypożycz — {item.name}
      </p>

      {/* Admin: wybór pracownika */}
      {admin && (
        <div className="flex items-center gap-2 rounded-lg px-3 py-2 mb-2" style={fieldStyle}>
          <svg className="h-3.5 w-3.5 shrink-0" style={{ color: t.inkMuted }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
          <select
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: targetUserId ? t.ink : t.inkMuted, fontSize: 16 }}
            value={targetUserId}
            onChange={(e) => setTargetUserId(e.target.value)}
          >
            <option value="">Za siebie (admin)</option>
            {activeUsers.map((u) => (
              <option key={u.id} value={u.id}>{u.fullName}</option>
            ))}
          </select>
        </div>
      )}

      {/* Lokalizacja */}
      <div className="mb-2">
        <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={fieldStyle}>
          <MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: t.inkMuted }} />
          <select
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: locationId ? t.ink : t.inkMuted, fontSize: 16 }}
            value={locationId}
            onChange={(e) => setLocationId(Number(e.target.value))}
          >
            <option value={0}>Wybierz lokalizację...</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Czas */}
      <div className="flex items-center gap-2 rounded-lg px-3 py-2 mb-2"
        style={{ background: t.surfaceAlt, border: '1px solid rgba(39,97,235,0.15)' }}
      >
        <Clock className="h-3.5 w-3.5 shrink-0" style={{ color: t.inkMuted }} />
        <input
          type="number"
          min={1}
          max={720}
          placeholder="Na ile godzin? (opcjonalne)"
          value={durationHours}
          onChange={(e) => setDurationHours(e.target.value)}
          className="flex-1 bg-transparent text-sm outline-none"
          style={{ color: t.ink, fontSize: 16 }}
        />
        {durationHours && <span className="text-xs shrink-0" style={{ color: t.inkMuted }}>h</span>}
      </div>

      {/* Admin: data wypożyczenia wstecz */}
      {admin && (
        <div className="flex items-center gap-2 rounded-lg px-3 py-2 mb-2"
          style={{ background: t.surfaceAlt, border: '1px solid rgba(39,97,235,0.15)' }}
        >
          <FileText className="h-3.5 w-3.5 shrink-0" style={{ color: t.inkMuted }} />
          <input
            type="datetime-local"
            value={rentedAt}
            max={new Date().toISOString().slice(0, 16)}
            onChange={(e) => setRentedAt(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: rentedAt ? t.ink : t.inkMuted, fontSize: 16 }}
          />
          {!rentedAt && <span className="text-xs shrink-0" style={{ color: t.inkMuted }}>data wstecz (opcjonalne)</span>}
        </div>
      )}

      {err && <p className="text-[12px] font-medium mb-2" style={{ color: '#f43f5e' }}>{err}</p>}

      <div className="flex gap-2">
        <Button size="sm" loading={mutation.isPending} onClick={handleSubmit}>
          <Check className="h-3.5 w-3.5 mr-1" /> Wypożycz
        </Button>
        <button
          onClick={onClose}
          className="flex-1 rounded-xl py-1.5 text-sm font-medium"
          style={{ background: t.dark ? 'rgba(255,255,255,0.06)' : 'rgba(12,30,60,0.06)', color: '#4a6080' }}
        >
          Anuluj
        </button>
      </div>
    </div>
  )
}

// ── Karta sprzętu (pracownik) ────────────────────────────────────────────────

function EmployeeItemCard({
  item, myActiveRentalId, canRent,
}: { item: EquipmentItem; myActiveRentalId?: string; canRent: boolean }) {
  const t = useTheme()
  const [showIssue,  setShowIssue]  = useState(false)
  const [showReturn, setShowReturn] = useState(false)
  const [showRent,   setShowRent]   = useState(false)

  const myRentals = useQuery({
    queryKey: ['eq-rentals'],
    queryFn:  () => rentalsApi.getAll().then((r) => r.data.data),
  })
  const myActiveRental = myRentals.data?.find(
    (r) => r.itemId === item.id && !r.returnedAt,
  )

  const isMyRental = !!myActiveRental

  const cardBg   = isMyRental ? (t.dark ? t.green.bg : '#f0fdf6') : t.surface
  const cardRing = isMyRental
    ? `0 0 0 1px ${t.green.ring}, 0 1px 4px rgba(12,30,60,0.08)`
    : t.cardShadow
  const iconBg   = isMyRental
    ? 'linear-gradient(150deg, #10b981, #059669)'
    : (item.status === 'available' ? 'linear-gradient(150deg, #06b6d4, #0891b2)' : (t.dark ? 'rgba(255,255,255,0.10)' : 'rgba(12,30,60,0.10)'))
  const iconColor = isMyRental
    ? '#d1fae5'
    : (item.status === 'available' ? '#e0f7fc' : t.inkMuted)

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: cardBg, boxShadow: cardRing, opacity: item.status === 'retired' ? 0.55 : 1 }}
    >
      <div className="p-4 flex items-start gap-3">
        {/* Ikona */}
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl mt-0.5"
          style={{ background: iconBg, color: iconColor }}
        >
          <Wrench className="h-4.5 w-4.5" style={{ height: 18, width: 18 }} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold" style={{ color: t.ink }}>{item.name}</p>
            <StatusBadge status={item.status} />
            {isMyRental && (
              <span
                className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                style={{ background: t.blue.bg, color: t.blue.text }}
              >
                Moje
              </span>
            )}
          </div>
          <p className="text-xs mt-0.5" style={{ color: t.inkDim }}>{item.category.name}</p>
          {item.serialNumber && (
            <p className="text-[11px] mt-0.5" style={{ color: t.inkMuted }}>SN: {item.serialNumber}</p>
          )}
          {/* Lokalizacja aktywnego wypożyczenia (czyjegoś) */}
          {item.status === 'rented' && item.rentals[0] && !isMyRental && (
            <p className="text-[11px] mt-0.5" style={{ color: t.amber.text }}>
              Wypożyczony przez: {item.rentals[0].user.fullName}
              {item.rentals[0].location?.name ? ` · ${item.rentals[0].location.name}` : ''}
            </p>
          )}
          {/* Lokalizacja własnego wypożyczenia */}
          {isMyRental && myActiveRental && (
            <p className="text-[11px] mt-0.5 flex items-center gap-1" style={{ color: t.green.text }}>
              <MapPin style={{ height: 11, width: 11, flexShrink: 0 }} />
              {myActiveRental.location.name}
            </p>
          )}
          {isMyRental && myActiveRental && <TimeLeftBadge rental={myActiveRental} t={t} />}
        </div>

        {/* Akcje */}
        <div className="flex flex-col gap-1 shrink-0">
          {item.status === 'available' && !isMyRental && canRent && (
            <Button size="sm" onClick={() => { setShowRent((v) => !v); setShowReturn(false); setShowIssue(false) }}>
              Wypożycz
            </Button>
          )}
          {isMyRental && myActiveRental && (
            <button
              className="rounded-xl px-3 py-1.5 text-xs font-semibold"
              style={{ background: t.green.bg, color: t.green.text }}
              onClick={() => { setShowReturn((v) => !v); setShowIssue(false); setShowRent(false) }}
            >
              <RotateCcw className="h-3.5 w-3.5 inline mr-1" />
              Zwróć
            </button>
          )}
          {isMyRental && (
            <button
              className="rounded-xl px-3 py-1.5 text-xs font-semibold"
              style={{ background: t.amber.bg, color: t.amber.text }}
              onClick={() => { setShowIssue((v) => !v); setShowReturn(false); setShowRent(false) }}
            >
              <AlertTriangle className="h-3.5 w-3.5 inline mr-1" />
              Problem
            </button>
          )}
        </div>
      </div>

      {showRent && (
        <div className="px-4 pb-4">
          <RentForm item={item} onClose={() => setShowRent(false)} />
        </div>
      )}

      {showReturn && myActiveRental && (
        <div className="px-4 pb-4">
          <ReturnForm rental={myActiveRental} onClose={() => setShowReturn(false)} />
        </div>
      )}

      {showIssue && (
        <div className="px-4 pb-4">
          <IssueForm item={item} onClose={() => setShowIssue(false)} />
        </div>
      )}
    </div>
  )
}

// ── Karta aktywnego wypożyczenia (sekcja "Twoje wypożyczenia") ───────────────

function MyRentalCard({ rental }: { rental: EquipmentRental }) {
  const t = useTheme()
  const [showReturn,       setShowReturn]       = useState(false)
  const [showIssue,        setShowIssue]        = useState(false)
  const [showAssignReport, setShowAssignReport] = useState(false)

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: t.dark ? t.green.bg : '#f0fdf6', boxShadow: `0 0 0 1px ${t.green.ring}, 0 1px 4px rgba(12,30,60,0.08)` }}
    >
      <div className="p-4 flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: 'linear-gradient(150deg, #10b981, #059669)', color: '#d1fae5' }}
        >
          <Wrench style={{ height: 18, width: 18 }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold" style={{ color: t.ink }}>{rental.item.name}</p>
          <p className="text-xs mt-0.5" style={{ color: t.green.text }}>
            {rental.item.category.name} · od {new Date(rental.rentedAt).toLocaleDateString('pl-PL')}
          </p>
          <p className="text-[11px] mt-0.5 flex items-center gap-1" style={{ color: t.inkDim }}>
            <MapPin style={{ height: 11, width: 11, flexShrink: 0 }} />
            {rental.location.name}
          </p>
          {rental.report && (
            <p className="text-[11px] mt-0.5 flex items-center gap-1" style={{ color: t.inkMuted }}>
              <FileText style={{ height: 11, width: 11, flexShrink: 0 }} />
              Raport: {new Date(rental.report.reportDate).toLocaleDateString('pl-PL')}
            </p>
          )}
          <TimeLeftBadge rental={rental} t={t} />
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          <button
            className="rounded-xl px-3 py-1.5 text-xs font-semibold"
            style={{ background: t.green.bg, color: t.green.text }}
            onClick={() => { setShowReturn((v) => !v); setShowIssue(false); setShowAssignReport(false) }}
          >
            <RotateCcw className="h-3.5 w-3.5 inline mr-1" />
            Zwróć
          </button>
          <button
            className="rounded-xl px-3 py-1.5 text-xs font-semibold"
            style={{ background: t.blue.bg, color: t.blue.text }}
            onClick={() => { setShowAssignReport((v) => !v); setShowReturn(false); setShowIssue(false) }}
          >
            <FileText className="h-3.5 w-3.5 inline mr-1" />
            Raport
          </button>
          <button
            className="rounded-xl px-3 py-1.5 text-xs font-semibold"
            style={{ background: t.amber.bg, color: t.amber.text }}
            onClick={() => { setShowIssue((v) => !v); setShowReturn(false); setShowAssignReport(false) }}
          >
            <AlertTriangle className="h-3.5 w-3.5 inline mr-1" />
            Problem
          </button>
        </div>
      </div>

      {showReturn && (
        <div className="px-4 pb-4">
          <ReturnForm rental={rental} onClose={() => setShowReturn(false)} />
        </div>
      )}
      {showAssignReport && (
        <div className="px-4 pb-4">
          <AssignReportForm rental={rental} onClose={() => setShowAssignReport(false)} />
        </div>
      )}
      {showIssue && (
        <div className="px-4 pb-4">
          <IssueForm item={rental.item} onClose={() => setShowIssue(false)} />
        </div>
      )}
    </div>
  )
}

// ── Pasek wyszukiwania i filtrowania po kategorii ────────────────────────────

function FilterBar({
  search, onSearch,
  categories, catFilter, onCatFilter,
}: {
  search: string
  onSearch: (v: string) => void
  categories: string[]
  catFilter: string
  onCatFilter: (v: string) => void
}) {
  const t = useTheme()
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
          style={{ color: t.inkMuted }}
        />
        <input
          type="text"
          placeholder="Szukaj sprzętu..."
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="w-full rounded-xl py-2.5 pl-9 pr-9 text-sm outline-none"
          style={{
            background:  t.surfaceInput,
            boxShadow:   t.dark ? '0 0 0 1px rgba(255,255,255,0.08), inset 0 1px 3px rgba(0,0,0,0.15)' : '0 0 0 1px rgba(12,30,60,0.10), inset 0 1px 3px rgba(12,30,60,0.06)',
            color:       t.ink,
            fontSize:    16,
          }}
        />
        {search && (
          <button
            onClick={() => onSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2"
            style={{ color: t.inkMuted }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {categories.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
          {['all', ...categories].map((cat) => (
            <button
              key={cat}
              onClick={() => onCatFilter(cat)}
              className="shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all"
              style={catFilter === cat
                ? { background: '#2761eb', color: '#fff' }
                : { background: t.dark ? 'rgba(255,255,255,0.06)' : 'rgba(12,30,60,0.06)', color: '#4a6080' }
              }
            >
              {cat === 'all' ? 'Wszystkie' : cat}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── WIDOK PRACOWNIKA ─────────────────────────────────────────────────────────

function EmployeeView() {
  const t = useTheme()
  const [search,  setSearch]  = useState('')
  const [showAll, setShowAll] = useState(false)
  const authUser = useAuthStore((s) => s.user)
  const canRent  = authUser?.role === 'admin' || (authUser?.canRentEquipment ?? false)

  const { data: items,   isLoading: loadingItems }   = useQuery({
    queryKey: ['eq-items'],
    queryFn:  () => equipmentApi.getItems().then((r) => r.data.data),
  })
  const { data: rentals, isLoading: loadingRentals } = useQuery({
    queryKey: ['eq-rentals'],
    queryFn:  () => rentalsApi.getAll().then((r) => r.data.data),
  })

  const allItems   = items   ?? []
  const allRentals = rentals ?? []
  const myActive   = allRentals.filter((r) => !r.returnedAt)

  if (loadingItems || loadingRentals) return <PageSpinner />

  const q           = search.trim().toLowerCase()
  const showResults = q.length >= 2

  const filtered = showResults
    ? allItems
        .filter((i) => i.status !== 'retired')
        .filter((i) => i.name.toLowerCase().includes(q))
    : []

  const grouped = !showResults && showAll
    ? allItems
        .filter((i) => i.status !== 'retired')
        .reduce<Record<string, EquipmentItem[]>>((acc, item) => {
          if (!acc[item.category.name]) acc[item.category.name] = []
          acc[item.category.name].push(item)
          return acc
        }, {})
    : null

  return (
    <div className="space-y-5">

      {myActive.length > 0 && (
        <div>
          <p className="section-label mb-3">Twoje wypożyczenia ({myActive.length})</p>
          <div className="space-y-2.5">
            {myActive.map((r) => (
              <MyRentalCard key={r.id} rental={r} />
            ))}
          </div>
        </div>
      )}

      <FilterBar
        search={search} onSearch={setSearch}
        categories={[]} catFilter="all" onCatFilter={() => {}}
      />

      {showResults ? (
        filtered.length === 0 ? (
          <div
            className="rounded-2xl p-8 text-center"
            style={{ background: t.surface, boxShadow: t.cardShadow }}
          >
            <Search className="h-8 w-8 mx-auto mb-2" style={{ color: t.inkMuted }} />
            <p className="font-semibold" style={{ color: t.ink }}>Brak wyników</p>
            <p className="text-sm mt-1" style={{ color: t.inkDim }}>Spróbuj innej nazwy.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filtered.map((item) => (
              <EmployeeItemCard key={item.id} item={item} canRent={canRent} />
            ))}
          </div>
        )
      ) : grouped ? (
        <>
          <button
            onClick={() => setShowAll(false)}
            className="text-sm font-medium"
            style={{ color: t.inkMuted }}
          >
            <X className="h-3.5 w-3.5 inline mr-1" />
            Ukryj listę
          </button>
          {Object.entries(grouped).map(([cat, catItems]) => (
            <div key={cat}>
              <p className="section-label mb-3">{cat}</p>
              <div className="space-y-2.5">
                {catItems.map((item) => (
                  <EmployeeItemCard key={item.id} item={item} canRent={canRent} />
                ))}
              </div>
            </div>
          ))}
        </>
      ) : (
        <div
          className="rounded-2xl p-8 text-center"
          style={{ background: t.surface, boxShadow: t.cardShadow }}
        >
          <Search className="h-8 w-8 mx-auto mb-2" style={{ color: t.inkMuted }} />
          <p className="font-semibold" style={{ color: t.ink }}>Wpisz nazwę sprzętu</p>
          <p className="text-sm mt-1" style={{ color: t.inkDim }}>
            {allItems.length === 0
              ? 'Administrator jeszcze nic nie dodał.'
              : 'Wyszukaj po nazwie, żeby zobaczyć dostępny sprzęt.'}
          </p>
          {allItems.length > 0 && (
            <button
              onClick={() => setShowAll(true)}
              className="mt-4 rounded-xl px-4 py-2 text-sm font-semibold"
              style={{ background: t.dark ? 'rgba(255,255,255,0.08)' : 'rgba(12,30,60,0.07)', color: t.inkDim }}
            >
              Pokaż cały sprzęt
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── ADMIN — Formularz dodawania kategorii (inline) ────────────────────────────

function AddCategoryForm({ onClose }: { onClose: () => void }) {
  const qc  = useQueryClient()
  const t = useTheme()
  const [name, setName] = useState('')
  const [err,  setErr]  = useState('')

  const mutation = useMutation({
    mutationFn: () => equipmentApi.createCategory({ name: name.trim() }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['eq-categories'] }); onClose() },
    onError:    (e) => setErr(errMsg(e)),
  })

  return (
    <div
      className="rounded-2xl p-4 animate-fade-in"
      style={{ background: t.surfaceMuted, boxShadow: '0 0 0 2px rgba(39,97,235,0.25), 0 4px 16px rgba(39,97,235,0.12)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="section-label">Nowa kategoria</p>
        <button onClick={onClose} className="rounded-lg p-1" style={{ color: t.inkMuted }}>
          <X className="h-4 w-4" />
        </button>
      </div>
      <Input
        label="Nazwa kategorii"
        placeholder="np. Narzędzia ręczne"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      {err && <p className="text-[12.5px] font-medium mt-2" style={{ color: '#f43f5e' }}>{err}</p>}
      <div className="flex gap-2 mt-3">
        <Button size="sm" loading={mutation.isPending} className="flex-1"
          onClick={() => { setErr(''); if (name.trim().length < 2) { setErr('Podaj nazwę'); return } mutation.mutate() }}
        >
          <Check className="h-4 w-4 mr-1" /> Dodaj
        </Button>
        <button onClick={onClose} className="flex-1 rounded-xl py-2 text-sm font-medium"
          style={{ background: t.dark ? 'rgba(255,255,255,0.06)' : 'rgba(12,30,60,0.06)', color: '#4a6080' }}>
          Anuluj
        </button>
      </div>
    </div>
  )
}

// ── ADMIN — Formularz dodawania sprzętu (inline) ──────────────────────────────

function AddItemForm({
  categories, onClose,
}: { categories: { id: number; name: string }[]; onClose: () => void }) {
  const qc = useQueryClient()
  const t = useTheme()
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? 0)
  const [name,         setName]         = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [notes,        setNotes]        = useState('')
  const [err,          setErr]          = useState('')

  const mutation = useMutation({
    mutationFn: () => equipmentApi.createItem({
      categoryId,
      name:         name.trim(),
      serialNumber: serialNumber.trim() || undefined,
      notes:        notes.trim()        || undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['eq-items'] }); onClose() },
    onError:   (e) => setErr(errMsg(e)),
  })

  const handleSubmit = () => {
    setErr('')
    if (!categoryId)           { setErr('Wybierz kategorię'); return }
    if (name.trim().length < 2){ setErr('Podaj nazwę sprzętu'); return }
    mutation.mutate()
  }

  return (
    <div
      className="rounded-2xl p-4 animate-fade-in"
      style={{ background: t.surfaceMuted, boxShadow: '0 0 0 2px rgba(39,97,235,0.25), 0 4px 16px rgba(39,97,235,0.12)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="section-label">Nowy sprzęt</p>
        <button onClick={onClose} className="rounded-lg p-1" style={{ color: t.inkMuted }}>
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-3">
        <Select
          label="Kategoria"
          value={String(categoryId)}
          onChange={(e) => setCategoryId(Number(e.target.value))}
          options={categories.map((c) => ({ value: String(c.id), label: c.name }))}
        />
        <Input
          label="Nazwa sprzętu"
          placeholder="np. Wiertarka udarowa Bosch"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          label="Numer seryjny (opcjonalnie)"
          placeholder="np. BSH-003"
          value={serialNumber}
          onChange={(e) => setSerialNumber(e.target.value)}
        />
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: '#4a6080' }}>
            Uwagi (opcjonalnie)
          </label>
          <textarea
            className="w-full rounded-xl px-3 py-2 text-sm resize-none outline-none"
            style={{ background: t.surfaceAlt, border: `1px solid ${t.border}`, color: t.ink, minHeight: 56 }}
            placeholder="Dodatkowe informacje..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>
      {err && <p className="text-[12.5px] font-medium mt-2" style={{ color: '#f43f5e' }}>{err}</p>}
      <div className="flex gap-2 mt-3">
        <Button size="sm" loading={mutation.isPending} className="flex-1" onClick={handleSubmit}>
          <Check className="h-4 w-4 mr-1" /> Dodaj sprzęt
        </Button>
        <button onClick={onClose} className="flex-1 rounded-xl py-2 text-sm font-medium"
          style={{ background: t.dark ? 'rgba(255,255,255,0.06)' : 'rgba(12,30,60,0.06)', color: '#4a6080' }}>
          Anuluj
        </button>
      </div>
    </div>
  )
}

// ── ADMIN — Formularz edycji sprzętu (inline) ─────────────────────────────────

function EditItemForm({
  item, categories, onClose,
}: { item: EquipmentItem; categories: { id: number; name: string }[]; onClose: () => void }) {
  const qc = useQueryClient()
  const t = useTheme()
  const [categoryId,   setCategoryId]   = useState(item.categoryId)
  const [name,         setName]         = useState(item.name)
  const [serialNumber, setSerialNumber] = useState(item.serialNumber ?? '')
  const [status,       setStatus]       = useState<string>(item.status)
  const [notes,        setNotes]        = useState(item.notes ?? '')
  const [err,          setErr]          = useState('')

  const mutation = useMutation({
    mutationFn: () => equipmentApi.updateItem(item.id, {
      categoryId,
      name:         name.trim(),
      serialNumber: serialNumber.trim() || null,
      status,
      notes:        notes.trim()        || null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['eq-items'] }); onClose() },
    onError:   (e) => setErr(errMsg(e)),
  })

  const handleSubmit = () => {
    setErr('')
    if (name.trim().length < 2) { setErr('Podaj nazwę'); return }
    mutation.mutate()
  }

  return (
    <div
      className="rounded-xl p-4 mt-2 animate-fade-in"
      style={{ background: t.surfaceMuted, boxShadow: '0 0 0 2px rgba(39,97,235,0.20), 0 4px 12px rgba(39,97,235,0.10)' }}
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Kategoria"
            value={String(categoryId)}
            onChange={(e) => setCategoryId(Number(e.target.value))}
            options={categories.map((c) => ({ value: String(c.id), label: c.name }))}
          />
          <Select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={[
              { value: 'available', label: 'Dostępny' },
              { value: 'service',   label: 'Serwis' },
              { value: 'retired',   label: 'Wycofany' },
            ]}
          />
        </div>
        <Input
          label="Nazwa"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          label="Numer seryjny"
          value={serialNumber}
          onChange={(e) => setSerialNumber(e.target.value)}
        />
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: '#4a6080' }}>Uwagi</label>
          <textarea
            className="w-full rounded-xl px-3 py-2 text-sm resize-none outline-none"
            style={{ background: t.surfaceAlt, border: `1px solid ${t.border}`, color: t.ink, minHeight: 48 }}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>
      {err && <p className="text-[12px] font-medium mt-2" style={{ color: '#f43f5e' }}>{err}</p>}
      <div className="flex gap-2 mt-3">
        <Button size="sm" loading={mutation.isPending} onClick={handleSubmit}>
          <Check className="h-4 w-4 mr-1" /> Zapisz
        </Button>
        <button onClick={onClose} className="flex-1 rounded-xl py-2 text-sm font-medium"
          style={{ background: t.dark ? 'rgba(255,255,255,0.06)' : 'rgba(12,30,60,0.06)', color: '#4a6080' }}>
          Anuluj
        </button>
      </div>
    </div>
  )
}

// ── ADMIN — Karta sprzętu ────────────────────────────────────────────────────

function AdminItemCard({
  item, categories,
}: { item: EquipmentItem; categories: { id: number; name: string }[] }) {
  const qc = useQueryClient()
  const t = useTheme()
  const [editing,     setEditing]     = useState(false)
  const [showRent,    setShowRent]    = useState(false)
  const [confirming,  setConfirming]  = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const deleteMutation = useMutation({
    mutationFn: () => equipmentApi.deleteItem(item.id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['eq-items'] }),
    onError: (err) => {
      setConfirming(false)
      setDeleteError(axios.isAxiosError(err) ? err.response?.data?.error ?? 'Błąd serwera' : 'Błąd serwera')
    },
  })

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: t.surface,
        boxShadow:  t.cardShadow,
        opacity:    item.status === 'retired' ? 0.65 : 1,
      }}
    >
      <div className="p-4 flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl mt-0.5"
          style={{
            background: item.status === 'available'
              ? 'linear-gradient(150deg, #06b6d4, #0891b2)'
              : t.dark ? 'rgba(255,255,255,0.10)' : 'rgba(12,30,60,0.10)',
            color: item.status === 'available' ? '#e0f7fc' : t.inkMuted,
          }}
        >
          <Wrench style={{ height: 18, width: 18 }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold" style={{ color: t.ink }}>{item.name}</p>
            <StatusBadge status={item.status} />
          </div>
          <p className="text-xs mt-0.5" style={{ color: t.inkDim }}>{item.category.name}</p>
          {item.serialNumber && (
            <p className="text-[11px] mt-0.5" style={{ color: t.inkMuted }}>SN: {item.serialNumber}</p>
          )}
          {item.status === 'rented' && item.rentals[0] && (
            <p className="text-[11px] mt-0.5 font-medium" style={{ color: t.amber.text }}>
              {item.rentals[0].user.fullName} · {item.rentals[0].location.name}
            </p>
          )}
          {item.notes && (
            <p className="text-[11px] mt-0.5" style={{ color: t.inkMuted }}>{item.notes}</p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {item.status === 'available' && (
            <button
              onClick={() => { setShowRent((v) => !v); setEditing(false); setConfirming(false); setDeleteError('') }}
              className="rounded-lg px-2 py-1 text-[11px] font-semibold transition-colors"
              style={{ background: showRent ? t.blue.bg : 'transparent', color: showRent ? t.blue.text : t.inkMuted }}
              title="Wypożycz"
            >
              Wypożycz
            </button>
          )}
          <button
            onClick={() => { setEditing((v) => !v); setConfirming(false); setShowRent(false); setDeleteError('') }}
            className="rounded-lg p-2 transition-colors"
            style={{ color: editing ? '#2761eb' : t.inkMuted }}
            title="Edytuj"
          >
            {editing ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <button
            onClick={() => { setConfirming((v) => !v); setEditing(false); setShowRent(false); setDeleteError('') }}
            className="rounded-lg p-2 transition-colors"
            style={{ color: confirming ? '#f43f5e' : '#7da8d8' }}
            title="Usuń"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {deleteError && (
        <div className="px-4 pb-3">
          <p className="text-[12.5px] font-medium" style={{ color: '#f43f5e' }}>{deleteError}</p>
        </div>
      )}

      {confirming && (
        <div
          className="mx-4 mb-4 rounded-xl px-4 py-3 flex items-center justify-between gap-3 animate-fade-in"
          style={{ background: 'rgba(244,63,94,0.07)', boxShadow: '0 0 0 1px rgba(244,63,94,0.20)' }}
        >
          <p className="text-sm font-medium" style={{ color: '#be123c' }}>Usunąć sprzęt?</p>
          <div className="flex gap-2">
            <button
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="rounded-xl px-3 py-1.5 text-xs font-bold"
              style={{ background: '#f43f5e', color: '#fff' }}
            >
              {deleteMutation.isPending ? '...' : 'Usuń'}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="rounded-xl px-3 py-1.5 text-xs font-semibold"
              style={{ background: t.dark ? 'rgba(255,255,255,0.06)' : 'rgba(12,30,60,0.08)', color: '#4a6080' }}
            >
              Anuluj
            </button>
          </div>
        </div>
      )}

      {editing && (
        <div className="px-4 pb-4">
          <EditItemForm item={item} categories={categories} onClose={() => setEditing(false)} />
        </div>
      )}

      {showRent && (
        <div className="px-4 pb-4">
          <RentForm item={item} onClose={() => setShowRent(false)} />
        </div>
      )}
    </div>
  )
}

// ── ADMIN — Panel wypożyczeń ──────────────────────────────────────────────────

function fmtDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtDateTime(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function rentalDuration(rentedAt: string, returnedAt: string | null) {
  const end   = returnedAt ? new Date(returnedAt) : new Date()
  const diffH = Math.round((end.getTime() - new Date(rentedAt).getTime()) / 3_600_000)
  if (diffH < 1)  return '< 1 h'
  if (diffH < 24) return `${diffH} h`
  const days = Math.floor(diffH / 24)
  const rem  = diffH % 24
  return rem ? `${days} d ${rem} h` : `${days} d`
}

function AdminRentalsPanel() {
  const qc = useQueryClient()
  const t  = useTheme()
  const { data, isLoading } = useQuery({
    queryKey: ['eq-rentals'],
    queryFn:  () => rentalsApi.getAll().then((r) => r.data.data),
  })

  const [returning, setReturning] = useState<EquipmentRental | null>(null)

  const active   = (data ?? []).filter((r) => !r.returnedAt)
  const returned = (data ?? []).filter((r) =>  r.returnedAt)

  if (isLoading) return <PageSpinner />

  return (
    <div className="space-y-6">

      {/* ── Aktywne ── */}
      <div>
        <p className="section-label mb-3">Aktywne wypożyczenia ({active.length})</p>
        {active.length === 0 ? (
          <div className="rounded-2xl p-6 text-center" style={{ background: t.surface }}>
            <p className="text-sm" style={{ color: t.inkDim }}>Brak aktywnych wypożyczeń.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {active.map((r) => {
              const overdue = r.expectedReturn && new Date(r.expectedReturn).getTime() < Date.now()
              return (
                <div key={r.id}>
                  <div
                    className="rounded-2xl p-4"
                    style={{ background: t.surface, boxShadow: t.cardShadow }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold" style={{ color: t.ink }}>{r.item.name}</p>
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                            style={{ background: t.surfaceMuted, color: t.inkDim }}>
                            {r.item.category.name}
                          </span>
                          {overdue && (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                              style={{ background: t.red?.bg ?? 'rgba(244,63,94,0.10)', color: t.red?.text ?? '#be123c' }}>
                              Przeterminowane
                            </span>
                          )}
                        </div>

                        <p className="text-xs mt-1" style={{ color: t.inkDim }}>
                          <span className="font-medium" style={{ color: t.ink }}>{r.user.fullName}</span>
                        </p>
                        <p className="text-[11px] mt-0.5 flex items-center gap-1" style={{ color: t.inkMuted }}>
                          <MapPin style={{ height: 11, width: 11 }} />
                          {r.location.name}
                        </p>

                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                          <p className="text-[11px]" style={{ color: t.inkMuted }}>
                            Wypożyczono: <span style={{ color: t.inkDim }}>{fmtDateTime(r.rentedAt)}</span>
                          </p>
                          {r.expectedReturn && (
                            <p className="text-[11px]" style={{ color: overdue ? '#f43f5e' : t.inkMuted }}>
                              Termin zwrotu: <span style={{ color: overdue ? '#f43f5e' : t.inkDim }}>{fmtDateTime(r.expectedReturn)}</span>
                            </p>
                          )}
                          <p className="text-[11px]" style={{ color: t.inkMuted }}>
                            Czas trwania: <span style={{ color: t.inkDim }}>{rentalDuration(r.rentedAt, null)}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1 shrink-0">
                        <button
                          className="rounded-xl px-3 py-1.5 text-xs font-semibold"
                          style={{ background: t.green.bg, color: t.green.text }}
                          onClick={() => setReturning((prev) => prev?.id === r.id ? null : r)}
                        >
                          <RotateCcw className="h-3.5 w-3.5 inline mr-1" />Zwróć
                        </button>
                      </div>
                    </div>
                  </div>

                  {returning?.id === r.id && (
                    <div className="mt-1">
                      <ReturnForm rental={r} onClose={() => setReturning(null)} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Historia ── */}
      {returned.length > 0 && (
        <div>
          <p className="section-label mb-3">Historia ({returned.length})</p>
          <div className="space-y-1.5">
            {returned.map((r) => (
              <div
                key={r.id}
                className="rounded-xl px-4 py-3"
                style={{ background: t.surface, boxShadow: t.cardShadow }}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold" style={{ color: t.ink }}>{r.item.name}</p>
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                    style={{ background: t.surfaceMuted, color: t.inkDim }}>
                    {r.item.category.name}
                  </span>
                </div>

                <p className="text-xs mt-0.5" style={{ color: t.inkDim }}>
                  <span className="font-medium" style={{ color: t.ink }}>{r.user.fullName}</span>
                  <span style={{ color: t.inkMuted }}> · </span>
                  <MapPin className="inline" style={{ height: 10, width: 10 }} />
                  {' '}{r.location.name}
                </p>

                <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                  <p className="text-[11px]" style={{ color: t.inkMuted }}>
                    Od: <span style={{ color: t.inkDim }}>{fmtDate(r.rentedAt)}</span>
                  </p>
                  <p className="text-[11px]" style={{ color: t.inkMuted }}>
                    Do: <span style={{ color: t.inkDim }}>{fmtDate(r.returnedAt)}</span>
                  </p>
                  <p className="text-[11px]" style={{ color: t.inkMuted }}>
                    Czas: <span style={{ color: t.inkDim }}>{rentalDuration(r.rentedAt, r.returnedAt)}</span>
                  </p>
                  {r.returnNotes && (
                    <p className="text-[11px]" style={{ color: t.inkMuted }}>
                      Uwagi: <span style={{ color: t.inkDim }}>{r.returnNotes}</span>
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── ADMIN — Panel zgłoszeń ────────────────────────────────────────────────────

function AdminIssuesPanel() {
  const qc = useQueryClient()
  const t = useTheme()
  const { data, isLoading } = useQuery({
    queryKey: ['eq-issues'],
    queryFn:  () => issuesApi.getAll().then((r) => r.data.data),
  })

  const resolveMutation = useMutation({
    mutationFn: (id: string) => issuesApi.update(id, { status: 'resolved' }),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['eq-issues'] }),
  })

  if (isLoading) return <PageSpinner />

  const open     = (data ?? []).filter((i: EquipmentIssue) => i.status === 'open')
  const resolved = (data ?? []).filter((i: EquipmentIssue) => i.status === 'resolved')

  return (
    <div className="space-y-4">
      <div>
        <p className="section-label mb-3">Otwarte zgłoszenia ({open.length})</p>
        {open.length === 0 ? (
          <div className="rounded-2xl p-6 text-center" style={{ background: t.surface }}>
            <p className="text-sm" style={{ color: t.inkDim }}>Brak otwartych zgłoszeń.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {open.map((issue: EquipmentIssue) => (
              <div
                key={issue.id}
                className="rounded-2xl p-4"
                style={{ background: t.surface, boxShadow: '0 0 0 1px rgba(217,119,6,0.15)' }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold" style={{ color: t.ink }}>{issue.item.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: t.inkDim }}>
                      {issue.reporter.fullName} · {new Date(issue.createdAt).toLocaleDateString('pl-PL')}
                    </p>
                    <p className="text-sm mt-2" style={{ color: t.inkMuted }}>{issue.description}</p>
                  </div>
                  <button
                    className="shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold"
                    style={{ background: t.green.bg, color: t.green.text }}
                    onClick={() => resolveMutation.mutate(issue.id)}
                  >
                    <Check className="h-3.5 w-3.5 inline mr-1" />Rozwiąż
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {resolved.length > 0 && (
        <div>
          <p className="section-label mb-3">Rozwiązane ({resolved.length})</p>
          <div className="space-y-1.5">
            {resolved.slice(0, 10).map((issue: EquipmentIssue) => (
              <div
                key={issue.id}
                className="rounded-xl px-4 py-3"
                style={{ background: t.surface, opacity: 0.7 }}
              >
                <p className="text-sm font-semibold" style={{ color: t.ink }}>{issue.item.name}</p>
                <p className="text-xs mt-0.5" style={{ color: t.inkDim }}>
                  {issue.reporter.fullName} · {issue.description.slice(0, 80)}{issue.description.length > 80 ? '…' : ''}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── WIDOK ADMINA ─────────────────────────────────────────────────────────────

type AdminTab = 'items' | 'rentals' | 'issues'

function AdminView() {
  const t = useTheme()
  const [tab,          setTab]          = useState<AdminTab>('items')
  const [showAddItem,  setShowAddItem]  = useState(false)
  const [showAddCat,   setShowAddCat]   = useState(false)
  const [search,       setSearch]       = useState('')
  const [catFilter,    setCatFilter]    = useState('all')

  const { data: items,      isLoading: loadingItems }      = useQuery({
    queryKey: ['eq-items'],
    queryFn:  () => equipmentApi.getItems().then((r) => r.data.data),
  })
  const { data: categories, isLoading: loadingCategories } = useQuery({
    queryKey: ['eq-categories'],
    queryFn:  () => equipmentApi.getCategories().then((r) => r.data.data),
  })

  const cats     = categories ?? []
  const allItems = items      ?? []

  const catNames = useMemo(() => cats.map((c) => c.name).sort(), [cats])
  const q        = search.trim().toLowerCase()
  const filtered = allItems
    .filter((i) => catFilter === 'all' || i.category.name === catFilter)
    .filter((i) => !q || i.name.toLowerCase().includes(q))

  const TAB_LABELS: { key: AdminTab; label: string; icon: React.ReactNode }[] = [
    { key: 'items',   label: 'Sprzęt',       icon: <Wrench        className="h-4 w-4" /> },
    { key: 'rentals', label: 'Wypożyczenia', icon: <ClipboardList className="h-4 w-4" /> },
    { key: 'issues',  label: 'Zgłoszenia',   icon: <TriangleAlert className="h-4 w-4" /> },
  ]

  return (
    <div className="space-y-4">

      <div
        className="flex rounded-2xl p-1 gap-1"
        style={{ background: t.dark ? 'rgba(255,255,255,0.06)' : 'rgba(12,30,60,0.06)' }}
      >
        {TAB_LABELS.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all"
            style={tab === key
              ? { background: t.surfaceAlt, color: '#2761eb', boxShadow: '0 1px 4px rgba(12,30,60,0.12)' }
              : { color: t.inkMuted }
            }
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {tab === 'items' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            {!showAddItem && (
              <Button size="sm" onClick={() => { setShowAddItem(true); setShowAddCat(false) }}>
                <Plus className="h-4 w-4 mr-1" /> Dodaj sprzęt
              </Button>
            )}
            {!showAddCat && (
              <button
                onClick={() => { setShowAddCat(true); setShowAddItem(false) }}
                className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold"
                style={{ background: t.dark ? 'rgba(255,255,255,0.06)' : 'rgba(12,30,60,0.06)', color: '#4a6080' }}
              >
                <Tag className="h-4 w-4" /> Dodaj kategorię
              </button>
            )}
          </div>

          {showAddCat && <AddCategoryForm onClose={() => setShowAddCat(false)} />}
          {showAddItem && cats.length > 0 && (
            <AddItemForm categories={cats} onClose={() => setShowAddItem(false)} />
          )}
          {showAddItem && cats.length === 0 && (
            <p className="text-sm" style={{ color: '#f43f5e' }}>Najpierw dodaj kategorię.</p>
          )}

          {!loadingItems && !loadingCategories && allItems.length > 0 && (
            <FilterBar
              search={search}       onSearch={setSearch}
              categories={catNames}
              catFilter={catFilter}  onCatFilter={setCatFilter}
            />
          )}

          {loadingItems || loadingCategories ? (
            <PageSpinner />
          ) : allItems.length === 0 ? (
            <div
              className="rounded-2xl p-10 text-center"
              style={{ background: t.surface, boxShadow: t.cardShadow }}
            >
              <Wrench className="h-10 w-10 mx-auto mb-3" style={{ color: t.inkMuted }} />
              <p className="font-semibold" style={{ color: t.ink }}>Brak sprzętu</p>
            </div>
          ) : filtered.length === 0 ? (
            <div
              className="rounded-2xl p-8 text-center"
              style={{ background: t.surface, boxShadow: t.cardShadow }}
            >
              <Search className="h-8 w-8 mx-auto mb-2" style={{ color: t.inkMuted }} />
              <p className="font-semibold" style={{ color: t.ink }}>Brak wyników</p>
              <p className="text-sm mt-1" style={{ color: t.inkDim }}>Spróbuj zmienić kryteria wyszukiwania.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filtered.map((item) => (
                <AdminItemCard key={item.id} item={item} categories={cats} />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'rentals' && <AdminRentalsPanel />}
      {tab === 'issues'  && <AdminIssuesPanel />}
    </div>
  )
}

// ── Strona główna ─────────────────────────────────────────────────────────────

export default function EquipmentPage() {
  const { isAdmin } = useAuthStore()
  const t = useTheme()

  return (
    <div className="animate-fade-in max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="page-title">Wypożyczalnia Sprzętu</h1>
        <p className="text-sm mt-0.5" style={{ color: t.inkDim }}>
          {isAdmin() ? 'Zarządzaj sprzętem, wypożyczeniami i zgłoszeniami' : 'Wypożycz narzędzia i zgłaszaj usterki'}
        </p>
      </div>

      {isAdmin() ? <AdminView /> : <EmployeeView />}
    </div>
  )
}
