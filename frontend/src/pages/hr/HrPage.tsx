import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Users, CalendarDays, BarChart3, ClipboardList, ChevronLeft, ChevronRight, X, Check, Pencil, Download } from 'lucide-react'
import axios from 'axios'
import { hrApi } from '@/api/hr.api'
import { reportsApi, type Report } from '@/api/reports.api'
import { usersApi } from '@/api/users.api'
import { useAuthStore } from '@/store/authStore'
import { useTheme } from '@/lib/theme'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { PageSpinner } from '@/components/ui/Spinner'
import type { LeaveRequest, LeaveBalance, CalendarEvent } from '@/types'

// ─── helpers ──────────────────────────────────────────────────────────────────

function errMsg(err: unknown) {
  return axios.isAxiosError(err) ? (err.response?.data?.error ?? 'Błąd serwera') : 'Błąd serwera'
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function countWorkdays(from: string, to: string): number {
  const start = new Date(from + 'T00:00:00')
  const end   = new Date(to   + 'T00:00:00')
  let count = 0
  const cur = new Date(start)
  while (cur <= end) {
    const d = cur.getDay()
    if (d !== 0 && d !== 6) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

const MONTH_NAMES = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec',
                     'Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień']
const DAY_NAMES   = ['Pon','Wt','Śr','Czw','Pt','Sob','Nd']

function padDate(n: number) { return String(n).padStart(2, '0') }
function ymd(y: number, m: number, d: number) { return `${y}-${padDate(m)}-${padDate(d)}` }

// ─── status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const t = useTheme()
  const cfg: Record<string, { label: string; color: typeof t.green }> = {
    pending:  { label: 'Oczekuje', color: t.amber },
    approved: { label: 'Zatwierdzone', color: t.green },
    rejected: { label: 'Odrzucone',  color: t.red  },
  }
  const { label, color } = cfg[status] ?? cfg.pending
  return (
    <span style={{ background: color.bg, boxShadow: color.ring, color: color.text,
      fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 20 }}>
      {label}
    </span>
  )
}

// ─── new request modal ────────────────────────────────────────────────────────

function NewRequestModal({ onClose }: { onClose: () => void }) {
  const t  = useTheme()
  const qc = useQueryClient()
  const { data: types = [] } = useQuery({ queryKey: ['leave-types'], queryFn: hrApi.getLeaveTypes })
  const [leaveTypeId, setLeaveTypeId] = useState(0)
  const [dateFrom, setDateFrom]       = useState('')
  const [dateTo,   setDateTo]         = useState('')
  const [notes,    setNotes]          = useState('')
  const [err,      setErr]            = useState('')

  const days = dateFrom && dateTo ? countWorkdays(dateFrom, dateTo) : 0

  const mut = useMutation({
    mutationFn: () => hrApi.createRequest({ leaveTypeId, dateFrom, dateTo, notes: notes || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-requests'] })
      qc.invalidateQueries({ queryKey: ['hr-balance'] })
      onClose()
    },
    onError: (e) => setErr(errMsg(e)),
  })

  function submit() {
    setErr('')
    if (!leaveTypeId) return setErr('Wybierz typ urlopu')
    if (!dateFrom || !dateTo) return setErr('Podaj daty')
    if (days === 0) return setErr('Wybrany zakres nie zawiera dni roboczych')
    mut.mutate()
  }

  return (
    <Modal open onClose={onClose} title="Nowy wniosek urlopowy">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: t.inkMuted, display: 'block', marginBottom: 4 }}>
            Typ urlopu
          </label>
          <select
            value={leaveTypeId}
            onChange={e => setLeaveTypeId(Number(e.target.value))}
            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${t.borderStrong}`,
              background: t.surfaceInput, color: t.ink, fontSize: 14 }}
          >
            <option value={0}>– wybierz –</option>
            {types.map(tp => <option key={tp.id} value={tp.id}>{tp.name}</option>)}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: t.inkMuted, display: 'block', marginBottom: 4 }}>Od</label>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: t.inkMuted, display: 'block', marginBottom: 4 }}>Do</label>
            <Input type="date" value={dateTo} min={dateFrom} onChange={e => setDateTo(e.target.value)} />
          </div>
        </div>

        {dateFrom && dateTo && (
          <div style={{ textAlign: 'center', fontSize: 13, color: t.inkMuted }}>
            Dni roboczych: <strong style={{ color: t.ink }}>{days}</strong>
          </div>
        )}

        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: t.inkMuted, display: 'block', marginBottom: 4 }}>
            Uwagi (opcjonalne)
          </label>
          <textarea
            value={notes} onChange={e => setNotes(e.target.value)}
            rows={2} placeholder="np. urlop na wyjazd rodzinny"
            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${t.borderStrong}`,
              background: t.surfaceInput, color: t.ink, fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }}
          />
        </div>

        {err && <p style={{ color: t.red.text, fontSize: 13, margin: 0 }}>{err}</p>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onClose}>Anuluj</Button>
          <Button onClick={submit} loading={mut.isPending}>Złóż wniosek</Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── monthly calendar (employee attendance) ───────────────────────────────────

function AttendanceCalendar({ userId }: { userId: string }) {
  const t   = useTheme()
  const now = new Date()
  const [year, setYear]   = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  const { data: reports = [] } = useQuery<Report[]>({
    queryKey: ['reports', userId, year, month],
    queryFn:  () => {
      const from = `${year}-${padDate(month)}-01`
      const last = new Date(year, month, 0).getDate()
      const to   = `${year}-${padDate(month)}-${padDate(last)}`
      return reportsApi.list({ from, to, limit: 100 }).then(r => r.data.data.items)
    },
  })

  const { data: requests = [] } = useQuery({
    queryKey: ['hr-requests-approved', userId, year, month],
    queryFn:  () => hrApi.getRequests({ status: 'approved' }),
  })

  // build maps
  const reportMins: Record<string, number> = {}
  for (const r of reports) {
    const ds = r.reportDate.slice(0, 10)
    for (const e of r.entries) {
      const [hs, ms] = e.workStart.split(':').map(Number)
      const [he, me] = e.workEnd.split(':').map(Number)
      const diff = (he * 60 + me) - (hs * 60 + ms)
      if (diff > 0) reportMins[ds] = (reportMins[ds] ?? 0) + diff
    }
  }

  function fmtMins(mins: number) {
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return m > 0 ? `${h}h ${m}min` : `${h}h`
  }

  const totalMins = Object.values(reportMins).reduce((s, v) => s + v, 0)

  const leaveTypeByDay: Record<string, string> = {}
  for (const req of requests as LeaveRequest[]) {
    const fromStr = req.dateFrom.slice(0, 10)
    const toStr   = req.dateTo.slice(0, 10)
    const cur = new Date(fromStr + 'T00:00:00')
    const end = new Date(toStr   + 'T00:00:00')
    while (cur <= end) {
      leaveTypeByDay[ymd(cur.getFullYear(), cur.getMonth() + 1, cur.getDate())] = req.leaveType.name
      cur.setDate(cur.getDate() + 1)
    }
  }

  const prevMonth = () => { if (month === 1) { setYear(y => y - 1); setMonth(12) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 12) { setYear(y => y + 1); setMonth(1) } else setMonth(m => m + 1) }

  const daysInMonth   = new Date(year, month, 0).getDate()
  const firstDayOfWeek = (new Date(year, month - 1, 1).getDay() + 6) % 7 // 0=Mon

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  function cellStyle(day: number) {
    const ds      = ymd(year, month, day)
    const dow     = new Date(year, month - 1, day).getDay()
    const isWeekend = dow === 0 || dow === 6
    const hasLeave  = leaveTypeByDay[ds] !== undefined

    if (isWeekend)             return { bg: 'transparent', text: t.inkMuted, label: '' }
    if (hasLeave)              return { bg: t.blue.bg,   text: t.blue.text,  label: leaveTypeByDay[ds].slice(0, 2) }
    if (reportMins[ds] != null) return { bg: t.green.bg, text: t.green.text, label: fmtMins(reportMins[ds]) }
    return { bg: 'transparent', text: t.inkMuted, label: '' }
  }

  return (
    <div>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.ink, padding: 4 }}>
          <ChevronLeft size={20} />
        </button>
        <span style={{ fontWeight: 700, fontSize: 16, color: t.ink }}>
          {MONTH_NAMES[month - 1]} {year}
        </span>
        <button onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.ink, padding: 4 }}>
          <ChevronRight size={20} />
        </button>
      </div>

      {/* day labels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
        {DAY_NAMES.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: t.inkMuted, padding: '2px 0' }}>
            {d}
          </div>
        ))}
      </div>

      {/* cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} />
          const { bg, text, label } = cellStyle(day)
          return (
            <div key={day} style={{
              background: bg, borderRadius: 6, padding: '4px 2px',
              textAlign: 'center', minHeight: 44,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              border: `1px solid ${bg === 'transparent' ? t.border : 'transparent'}`,
            }}>
              <span style={{ fontSize: 12, color: t.inkMuted }}>{day}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: text }}>{label}</span>
            </div>
          )
        })}
      </div>

      {/* legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 12, color: t.inkMuted }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: t.green.bg, display: 'inline-block', boxShadow: t.green.ring }} />
          Przepracowany
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: t.blue.bg, display: 'inline-block', boxShadow: t.blue.ring }} />
          Urlop
        </span>
      </div>

      {/* total */}
      {totalMins > 0 && (
        <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 10, background: t.green.bg,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: t.green.text }}>
            Łącznie w {MONTH_NAMES[month - 1]}
          </span>
          <span style={{ fontSize: 15, fontWeight: 700, color: t.green.text }}>
            {fmtMins(totalMins)}
          </span>
        </div>
      )}
    </div>
  )
}

// ─── employee view ────────────────────────────────────────────────────────────

function EmployeeHrView() {
  const t   = useTheme()
  const qc  = useQueryClient()
  const user = useAuthStore(s => s.user)
  const [tab, setTab]           = useState<'urlopy' | 'obecnosc'>('urlopy')
  const [showNew, setShowNew]   = useState(false)

  const { data: balance, isLoading: balLoading } = useQuery({
    queryKey: ['hr-balance'],
    queryFn:  hrApi.getMyBalance,
  })

  const { data: requests = [], isLoading: reqLoading } = useQuery({
    queryKey: ['hr-requests'],
    queryFn:  () => hrApi.getRequests(),
  })

  const cancelMut = useMutation({
    mutationFn: hrApi.cancelRequest,
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['hr-requests'] }),
  })

  const TAB_STYLE = (active: boolean) => ({
    padding: '8px 18px', borderRadius: 8, fontWeight: 600, fontSize: 14,
    cursor: 'pointer', border: 'none',
    background: active ? (t.dark ? '#fbbf24' : '#2761eb') : 'transparent',
    color:      active ? (t.dark ? '#1c1400' : '#fff')     : t.inkMuted,
  })

  if (balLoading || reqLoading) return <PageSpinner />

  return (
    <div style={{ padding: '0 0 40px' }}>
      {/* tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        <button style={TAB_STYLE(tab === 'urlopy')}   onClick={() => setTab('urlopy')}>Urlopy</button>
        <button style={TAB_STYLE(tab === 'obecnosc')} onClick={() => setTab('obecnosc')}>Moja obecność</button>
      </div>

      {tab === 'urlopy' && (
        <>
          {/* balance card */}
          {balance && (
            <div style={{ ...t.cardAlt, borderRadius: 12, padding: 20, marginBottom: 20,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontSize: 13, color: t.inkMuted, marginBottom: 4 }}>Saldo urlopowe {balance.year}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: balance.remainingDays <= 3 ? t.red.text : t.ink }}>
                  {balance.remainingDays} <span style={{ fontSize: 16, fontWeight: 500, color: t.inkMuted }}>/ {balance.totalDays} dni</span>
                </div>
                <div style={{ fontSize: 12, color: t.inkMuted, marginTop: 4 }}>
                  Wykorzystano: {balance.usedDaysCarry + balance.approvedDays} dni
                  {balance.usedDaysCarry > 0 && ` (w tym ${balance.usedDaysCarry} dni przeniesione)`}
                </div>
              </div>
              <Button onClick={() => setShowNew(true)}>+ Złóż wniosek</Button>
            </div>
          )}

          {/* requests list */}
          {(requests as LeaveRequest[]).length === 0 ? (
            <p style={{ color: t.inkMuted, fontSize: 14, textAlign: 'center', padding: 32 }}>
              Brak wniosków urlopowych
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(requests as LeaveRequest[]).map(req => (
                <div key={req.id} style={{ ...t.cardAlt, borderRadius: 10, padding: 14,
                  display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: t.ink }}>{req.leaveType.name}</span>
                      <StatusBadge status={req.status} />
                    </div>
                    <div style={{ fontSize: 13, color: t.inkMuted }}>
                      {fmtDate(req.dateFrom)} – {fmtDate(req.dateTo)} · <strong>{req.daysCount} dni</strong>
                    </div>
                    {req.reviewComment && (
                      <div style={{ fontSize: 12, color: t.inkMuted, marginTop: 4, fontStyle: 'italic' }}>
                        Komentarz: {req.reviewComment}
                      </div>
                    )}
                    {req.notes && (
                      <div style={{ fontSize: 12, color: t.inkMuted, marginTop: 2 }}>{req.notes}</div>
                    )}
                  </div>
                  {req.status === 'pending' && (
                    <button
                      onClick={() => cancelMut.mutate(req.id)}
                      title="Cofnij wniosek"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.inkMuted, padding: 4, flexShrink: 0 }}>
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'obecnosc' && user && (
        <div style={{ ...t.cardAlt, borderRadius: 12, padding: 20 }}>
          <AttendanceCalendar userId={user.id} />
        </div>
      )}

      {showNew && <NewRequestModal onClose={() => setShowNew(false)} />}
    </div>
  )
}

// ─── admin: requests ──────────────────────────────────────────────────────────

function ReviewModal({ request, onClose }: { request: LeaveRequest; onClose: () => void }) {
  const t  = useTheme()
  const qc = useQueryClient()
  const [comment, setComment] = useState('')
  const [err, setErr]         = useState('')

  const mut = useMutation({
    mutationFn: (status: 'approved' | 'rejected') =>
      hrApi.reviewRequest(request.id, { status, reviewComment: comment || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-requests-admin'] })
      qc.invalidateQueries({ queryKey: ['hr-balances'] })
      onClose()
    },
    onError: (e) => setErr(errMsg(e)),
  })

  return (
    <Modal open onClose={onClose} title={`Wniosek — ${request.user.fullName}`}>
      <div style={{ fontSize: 14, color: t.inkMuted, marginBottom: 12 }}>
        <strong style={{ color: t.ink }}>{request.leaveType.name}</strong> ·{' '}
        {fmtDate(request.dateFrom)} – {fmtDate(request.dateTo)} ·{' '}
        <strong>{request.daysCount} dni</strong>
        {request.notes && <div style={{ marginTop: 4, fontStyle: 'italic' }}>{request.notes}</div>}
      </div>
      <textarea
        value={comment} onChange={e => setComment(e.target.value)}
        rows={2} placeholder="Komentarz (opcjonalny)"
        style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${t.borderStrong}`,
          background: t.surfaceInput, color: t.ink, fontSize: 14, resize: 'vertical', boxSizing: 'border-box', marginBottom: 12 }}
      />
      {err && <p style={{ color: t.red.text, fontSize: 13, margin: '0 0 8px' }}>{err}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant="ghost" onClick={onClose} style={{ flex: 1 }}>Anuluj</Button>
        <button
          onClick={() => mut.mutate('rejected')} disabled={mut.isPending}
          style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14,
            background: t.red.bg, boxShadow: t.red.ring, color: t.red.text }}>
          Odrzuć
        </button>
        <button
          onClick={() => mut.mutate('approved')} disabled={mut.isPending}
          style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14,
            background: t.green.bg, boxShadow: t.green.ring, color: t.green.text }}>
          Zatwierdź
        </button>
      </div>
    </Modal>
  )
}

function AdminRequests() {
  const t = useTheme()
  const [filterStatus, setFilterStatus] = useState('')
  const [filterUserId, setFilterUserId] = useState('')
  const [reviewing, setReviewing]       = useState<LeaveRequest | null>(null)

  const { data: users = [] } = useQuery({
    queryKey: ['users-list'],
    queryFn:  () => usersApi.getAll().then(r => r.data.data as { id: string; fullName: string; isActive: boolean }[]),
  })

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['hr-requests-admin', filterStatus, filterUserId],
    queryFn:  () => hrApi.getRequests({
      ...(filterStatus  ? { status: filterStatus }   : {}),
      ...(filterUserId  ? { userId: filterUserId }   : {}),
    }),
  })

  const selectStyle: React.CSSProperties = {
    background: t.surfaceInput, color: t.ink, borderRadius: 10,
    padding: '6px 10px', fontSize: 13, outline: 'none',
    boxShadow: '0 0 0 1px rgba(12,30,60,0.10)', appearance: 'none' as const,
  }

  if (isLoading) return <PageSpinner />

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {['', 'pending', 'approved', 'rejected'].map(s => (
          <button key={s || 'all'}
            onClick={() => setFilterStatus(s)}
            style={{ padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
              background: filterStatus === s ? (t.dark ? '#fbbf24' : '#2761eb') : t.surfaceMuted,
              color: filterStatus === s ? (t.dark ? '#1c1400' : '#fff') : t.inkMuted }}>
            {{ '': 'Wszystkie', pending: 'Oczekujące', approved: 'Zatwierdzone', rejected: 'Odrzucone' }[s]}
          </button>
        ))}
      </div>
      <div style={{ marginBottom: 16 }}>
        <select value={filterUserId} onChange={e => setFilterUserId(e.target.value)} style={selectStyle}>
          <option value="">— wszyscy pracownicy —</option>
          {users.filter(u => u.isActive).map(u => (
            <option key={u.id} value={u.id}>{u.fullName}</option>
          ))}
        </select>
      </div>

      {(requests as LeaveRequest[]).length === 0 ? (
        <p style={{ color: t.inkMuted, fontSize: 14, textAlign: 'center', padding: 32 }}>Brak wniosków</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(requests as LeaveRequest[]).map(req => (
            <div key={req.id} style={{ ...t.cardAlt, borderRadius: 10, padding: 14,
              display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: t.ink }}>{req.user.fullName}</span>
                  <span style={{ fontSize: 13, color: t.inkMuted }}>{req.leaveType.name}</span>
                  <StatusBadge status={req.status} />
                </div>
                <div style={{ fontSize: 13, color: t.inkMuted }}>
                  {fmtDate(req.dateFrom)} – {fmtDate(req.dateTo)} · <strong>{req.daysCount} dni</strong>
                </div>
                {req.reviewComment && (
                  <div style={{ fontSize: 12, color: t.inkMuted, marginTop: 4, fontStyle: 'italic' }}>
                    Komentarz: {req.reviewComment}
                  </div>
                )}
              </div>
              <button
                onClick={() => setReviewing(req)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.inkMuted, padding: 4, flexShrink: 0 }}>
                <Pencil size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {reviewing && <ReviewModal request={reviewing} onClose={() => setReviewing(null)} />}
    </>
  )
}

// ─── admin: balances ──────────────────────────────────────────────────────────

function EditBalanceModal({ balance, onClose }: { balance: LeaveBalance; onClose: () => void }) {
  const t  = useTheme()
  const qc = useQueryClient()
  const [totalDays,     setTotalDays]     = useState(balance.totalDays)
  const [usedDaysCarry, setUsedDaysCarry] = useState(balance.usedDaysCarry)
  const [err, setErr] = useState('')

  const mut = useMutation({
    mutationFn: () => hrApi.updateBalance(balance.userId!, { totalDays, usedDaysCarry }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['hr-balances'] }); onClose() },
    onError:    (e) => setErr(errMsg(e)),
  })

  return (
    <Modal open onClose={onClose} title={`Saldo — ${balance.fullName}`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: t.inkMuted, display: 'block', marginBottom: 4 }}>
            Limit dni w roku {balance.year}
          </label>
          <Input type="number" min={0} max={365} value={totalDays}
            onChange={e => setTotalDays(Number(e.target.value))} />
        </div>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: t.inkMuted, display: 'block', marginBottom: 4 }}>
            Dni już wykorzystane (przeniesione / wpisane ręcznie)
          </label>
          <Input type="number" min={0} max={365} value={usedDaysCarry}
            onChange={e => setUsedDaysCarry(Number(e.target.value))} />
        </div>
        <div style={{ fontSize: 13, color: t.inkMuted, padding: '8px 12px', borderRadius: 8, background: t.surfaceMuted }}>
          Pozostanie: <strong style={{ color: t.ink }}>{totalDays - usedDaysCarry - balance.approvedDays}</strong> dni
          {' '}(po zatwierdzonych wnioskach: {balance.approvedDays} dni)
        </div>
        {err && <p style={{ color: t.red.text, fontSize: 13, margin: 0 }}>{err}</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onClose}>Anuluj</Button>
          <Button onClick={() => mut.mutate()} loading={mut.isPending}>Zapisz</Button>
        </div>
      </div>
    </Modal>
  )
}

function AdminBalances() {
  const t = useTheme()
  const [editing, setEditing] = useState<LeaveBalance | null>(null)

  const { data: balances = [], isLoading } = useQuery({
    queryKey: ['hr-balances'],
    queryFn:  hrApi.getAllBalances,
  })

  if (isLoading) return <PageSpinner />

  return (
    <>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr>
              {['Pracownik', 'Limit', 'Przeniesione', 'Zatwierdzone', 'Pozostało', ''].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12, fontWeight: 700,
                  color: t.inkMuted, borderBottom: `1px solid ${t.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(balances as LeaveBalance[]).map(b => (
              <tr key={b.userId} style={{ borderBottom: `1px solid ${t.border}` }}>
                <td style={{ padding: '10px 12px', color: t.ink, fontWeight: 600 }}>{b.fullName}</td>
                <td style={{ padding: '10px 12px', color: t.ink }}>{b.totalDays}</td>
                <td style={{ padding: '10px 12px', color: t.ink }}>{b.usedDaysCarry}</td>
                <td style={{ padding: '10px 12px', color: t.ink }}>{b.approvedDays}</td>
                <td style={{ padding: '10px 12px', fontWeight: 700,
                  color: b.remainingDays <= 3 ? t.red.text : t.green.text }}>{b.remainingDays}</td>
                <td style={{ padding: '10px 12px' }}>
                  <button onClick={() => setEditing(b)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.inkMuted }}>
                    <Pencil size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && <EditBalanceModal balance={editing} onClose={() => setEditing(null)} />}
    </>
  )
}

// ─── admin: attendance table ──────────────────────────────────────────────────

function fmtMinutes(mins: number) {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

function AdminAttendance() {
  const t   = useTheme()
  const now = new Date()
  const [year, setYear]   = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  const { data, isLoading } = useQuery({
    queryKey: ['hr-attendance', year, month],
    queryFn:  () => hrApi.getAttendance(year, month),
  })

  const prevMonth = () => { if (month === 1) { setYear(y => y - 1); setMonth(12) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 12) { setYear(y => y + 1); setMonth(1) } else setMonth(m => m + 1) }

  async function handleExport() {
    const res = await hrApi.exportAttendance(year, month)
    const url = URL.createObjectURL(res.data as Blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `obecnosc_${year}_${String(month).padStart(2, '0')}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.ink }}>
          <ChevronLeft size={20} />
        </button>
        <span style={{ fontWeight: 700, color: t.ink, minWidth: 140, textAlign: 'center' }}>
          {MONTH_NAMES[month - 1]} {year}
        </span>
        <button onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.ink }}>
          <ChevronRight size={20} />
        </button>
        <button onClick={handleExport}
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6,
            background: t.blue.bg, color: t.blue.text, border: 'none', cursor: 'pointer',
            borderRadius: 10, padding: '6px 14px', fontWeight: 600, fontSize: 13 }}>
          <Download size={15} />
          Eksportuj XLSX
        </button>
      </div>

      {isLoading ? <PageSpinner /> : data && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 12, whiteSpace: 'nowrap' }}>
            <thead>
              <tr>
                <th style={{ padding: '6px 10px', textAlign: 'left', color: t.inkMuted, fontWeight: 700,
                  borderBottom: `1px solid ${t.border}`, position: 'sticky', left: 0, background: t.surface, zIndex: 1 }}>
                  Pracownik
                </th>
                {Array.from({ length: data.daysInMonth }, (_, i) => i + 1).map(d => {
                  const dow = new Date(data.year, data.month - 1, d).getDay()
                  const isWe = dow === 0 || dow === 6
                  return (
                    <th key={d} style={{ padding: '6px 4px', textAlign: 'center', color: isWe ? t.inkMuted : t.ink,
                      fontWeight: 700, borderBottom: `1px solid ${t.border}`, minWidth: 32 }}>
                      {d}
                    </th>
                  )
                })}
                <th style={{ padding: '6px 10px', textAlign: 'right', color: t.inkMuted, fontWeight: 700,
                  borderBottom: `1px solid ${t.border}` }}>Suma</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map(u => (
                <tr key={u.id} style={{ borderBottom: `1px solid ${t.border}` }}>
                  <td style={{ padding: '6px 10px', fontWeight: 600, color: t.ink,
                    position: 'sticky', left: 0, background: t.surface, zIndex: 1 }}>{u.fullName}</td>
                  {Array.from({ length: data.daysInMonth }, (_, i) => i + 1).map(d => {
                    const ds  = `${data.year}-${padDate(data.month)}-${padDate(d)}`
                    const dow = new Date(data.year, data.month - 1, d).getDay()
                    const isWe = dow === 0 || dow === 6
                    const cell = u.days[ds]
                    let bg = 'transparent', txt = '', color = t.inkMuted
                    if (!isWe && cell) {
                      if (cell.hours !== null) { bg = t.green.bg; txt = fmtMinutes(cell.hours); color = t.green.text }
                      else if (cell.leaveType) { bg = t.blue.bg;  txt = 'U';                    color = t.blue.text  }
                    }
                    return (
                      <td key={d} title={cell?.leaveType ?? undefined}
                        style={{ padding: '4px 2px', textAlign: 'center', background: bg, color, fontWeight: txt ? 600 : 400, fontSize: 11 }}>
                        {txt || (isWe ? '' : '–')}
                      </td>
                    )
                  })}
                  <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: t.ink }}>
                    {fmtMinutes(u.totalHours)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

// ─── admin: calendar ──────────────────────────────────────────────────────────

function AdminCalendar() {
  const t   = useTheme()
  const now = new Date()
  const [year, setYear]   = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['hr-calendar', year, month],
    queryFn:  () => hrApi.getCalendar(year, month),
  })

  const prevMonth = () => { if (month === 1) { setYear(y => y - 1); setMonth(12) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 12) { setYear(y => y + 1); setMonth(1) } else setMonth(m => m + 1) }

  const daysInMonth    = new Date(year, month, 0).getDate()
  const firstDayOfWeek = (new Date(year, month - 1, 1).getDay() + 6) % 7

  // Build day → events map
  const dayEvents: Record<number, { name: string; type: string }[]> = {}
  for (const ev of events as CalendarEvent[]) {
    const from = new Date(ev.dateFrom + 'T00:00:00')
    const to   = new Date(ev.dateTo   + 'T00:00:00')
    const cur  = new Date(from)
    while (cur <= to) {
      const d = cur.getDate()
      const m2 = cur.getMonth() + 1
      const y2 = cur.getFullYear()
      if (y2 === year && m2 === month) {
        if (!dayEvents[d]) dayEvents[d] = []
        dayEvents[d].push({ name: ev.user.fullName.split(' ')[0], type: ev.leaveType.name })
      }
      cur.setDate(cur.getDate() + 1)
    }
  }

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <button onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.ink }}>
          <ChevronLeft size={20} />
        </button>
        <span style={{ fontWeight: 700, color: t.ink, minWidth: 140, textAlign: 'center' }}>
          {MONTH_NAMES[month - 1]} {year}
        </span>
        <button onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.ink }}>
          <ChevronRight size={20} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 4 }}>
        {DAY_NAMES.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: t.inkMuted }}>{d}</div>
        ))}
      </div>

      {isLoading ? <PageSpinner /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
          {cells.map((day, i) => {
            if (!day) return <div key={`e-${i}`} />
            const dow = new Date(year, month - 1, day).getDay()
            const isWe = dow === 0 || dow === 6
            const names = dayEvents[day] ?? []
            return (
              <div key={day} style={{
                borderRadius: 6, padding: '4px 4px', minHeight: 60,
                background: names.length > 0 ? t.blue.bg : 'transparent',
                border: `1px solid ${names.length > 0 ? 'transparent' : t.border}`,
              }}>
                <div style={{ fontSize: 11, color: isWe ? t.inkMuted : t.ink, fontWeight: isWe ? 400 : 600, marginBottom: 2 }}>
                  {day}
                </div>
                {names.slice(0, 3).map((n, idx) => (
                  <div key={idx} style={{ fontSize: 10, color: t.blue.text, fontWeight: 600, lineHeight: 1.3 }} title={n.type}>
                    {n.name}
                  </div>
                ))}
                {names.length > 3 && (
                  <div style={{ fontSize: 10, color: t.inkMuted }}>+{names.length - 3}</div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

// ─── admin view ───────────────────────────────────────────────────────────────

function AdminHrView() {
  const t = useTheme()
  const [tab, setTab] = useState<'wnioski' | 'salda' | 'obecnosc' | 'kalendarz'>('wnioski')

  const TABS: { key: typeof tab; label: string; icon: React.ReactNode }[] = [
    { key: 'wnioski',   label: 'Wnioski',    icon: <ClipboardList size={15} /> },
    { key: 'salda',     label: 'Salda',      icon: <Users size={15} />         },
    { key: 'obecnosc',  label: 'Obecność',   icon: <BarChart3 size={15} />     },
    { key: 'kalendarz', label: 'Kalendarz',  icon: <CalendarDays size={15} />  },
  ]

  const TAB_STYLE = (active: boolean) => ({
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '8px 16px', borderRadius: 8, fontWeight: 600, fontSize: 13,
    cursor: 'pointer', border: 'none',
    background: active ? (t.dark ? '#fbbf24' : '#2761eb') : 'transparent',
    color:      active ? (t.dark ? '#1c1400' : '#fff')     : t.inkMuted,
  })

  return (
    <div style={{ padding: '0 0 40px' }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, flexWrap: 'wrap' }}>
        {TABS.map(tb => (
          <button key={tb.key} style={TAB_STYLE(tab === tb.key)} onClick={() => setTab(tb.key)}>
            {tb.icon} {tb.label}
          </button>
        ))}
      </div>

      {tab === 'wnioski'   && <AdminRequests />}
      {tab === 'salda'     && <AdminBalances />}
      {tab === 'obecnosc'  && <AdminAttendance />}
      {tab === 'kalendarz' && <AdminCalendar />}
    </div>
  )
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function HrPage() {
  const t    = useTheme()
  const user = useAuthStore(s => s.user)
  const isAdmin = user?.role === 'admin'

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <Users size={22} style={{ color: t.inkDim }} />
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: t.ink }}>HR</h1>
      </div>
      {isAdmin ? <AdminHrView /> : <EmployeeHrView />}
    </div>
  )
}
