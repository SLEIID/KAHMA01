import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Package, Search, Check, AlertTriangle, X, Trash2,
  ChevronDown, ChevronUp, Clock, BarChart3, List, Camera,
  Plus, Download, Pencil, Filter,
} from 'lucide-react'
import axios from 'axios'
import {
  materialsApi, materialUsagesApi, materialAlertsApi,
  type Material, type MaterialUsage, type MaterialAlert,
} from '@/api/materials.api'
import { reportsApi } from '@/api/reports.api'
import { locationsApi } from '@/api/locations.api'
import { departmentsApi } from '@/api/departments.api'
import { usersApi } from '@/api/users.api'
import { compressImage } from '@/lib/compressImage'
import { useAuthStore } from '@/store/authStore'
import { useTheme } from '@/lib/theme'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PageSpinner } from '@/components/ui/Spinner'
import { Modal } from '@/components/ui/Modal'

// ── helpers ──────────────────────────────────────────────────────────────────

function errMsg(err: unknown) {
  return axios.isAxiosError(err)
    ? (err.response?.data?.error ?? 'Błąd serwera')
    : 'Błąd serwera'
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pl-PL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtQty(qty: string | number) {
  const n = typeof qty === 'string' ? parseFloat(qty) : qty
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '')
}

const UNITS = ['szt', 'mb', 'kg', 'kpl', 'rolka', 'opak', 'l']

function toLocalISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── MaterialPhoto ─────────────────────────────────────────────────────────────

function MaterialPhoto({ url, name, size = 40 }: { url: string | null; name: string; size?: number }) {
  const t = useTheme()
  const [err, setErr] = useState(false)
  if (url && !err) {
    return (
      <img
        src={url}
        alt={name}
        onError={() => setErr(true)}
        style={{
          width: size, height: size, objectFit: 'cover',
          borderRadius: 10, flexShrink: 0,
          border: `1px solid ${t.border}`,
        }}
      />
    )
  }
  return (
    <div
      style={{
        width: size, height: size, borderRadius: 10, flexShrink: 0,
        background: t.blue.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <Package style={{ width: size * 0.45, height: size * 0.45, color: '#2761eb', opacity: 0.7 }} />
    </div>
  )
}

// ── UsageForm ─────────────────────────────────────────────────────────────────

function UsageForm({
  material,
  onClose,
  onSuccess,
}: {
  material: Material
  onClose: () => void
  onSuccess: () => void
}) {
  const qc = useQueryClient()
  const [qty,       setQty]       = useState('')
  const [unit,      setUnit]      = useState('szt')
  const [notes,     setNotes]     = useState('')
  const [reportId,  setReportId]  = useState('')
  const [entryId,   setEntryId]   = useState('')
  const [lowStock,  setLowStock]  = useState(false)
  const [photo,        setPhoto]        = useState<File | null>(null)
  const [photoLoading, setPhotoLoading] = useState(false)
  const [alertNote,    setAlertNote]    = useState('')
  const [done,         setDone]         = useState(false)
  const [err,          setErr]          = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const t = useTheme()

  // Pobierz dzisiejsze raporty użytkownika do powiązania pobrania
  const todayStr = toLocalISODate(new Date())
  const { data: reportsData, isLoading: reportsLoading } = useQuery({
    queryKey: ['reports-today'],
    queryFn:  () => reportsApi.list({ from: todayStr, to: todayStr, limit: 20 }).then((r) => r.data.data.items),
  })
  const todayReports = reportsData ?? []

  const createReportMut = useMutation({
    mutationFn: () => reportsApi.create(),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['reports-today'] })
      setReportId(res.data.data.id)
    },
    onError: (e) => setErr(errMsg(e)),
  })

  // Auto-select jeśli jest tylko jeden raport
  useEffect(() => {
    if (todayReports.length === 1 && !reportId) {
      setReportId(todayReports[0].id)
    }
  }, [todayReports, reportId])

  // Reset entryId when report changes
  useEffect(() => {
    setEntryId('')
  }, [reportId])

  const selectedReport = todayReports.find((r) => r.id === reportId) ?? null

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoLoading(true)
    try {
      const compressed = await compressImage(file)
      setPhoto(compressed)
    } catch {
      setErr('Nie udało się przetworzyć zdjęcia')
    } finally {
      setPhotoLoading(false)
    }
  }

  const usageMut = useMutation({ mutationFn: () =>
    materialUsagesApi.create({
      entryId:    entryId || undefined,
      materialId: material.id,
      quantity:   parseFloat(qty),
      unit,
      notes:      notes || undefined,
    })
  })

  const alertMut = useMutation({ mutationFn: (photoFile?: File) =>
    materialAlertsApi.create({
      materialId: material.id,
      notes:      alertNote || undefined,
      photo:      photoFile ?? undefined,
    })
  })

  async function handleSubmit() {
    const q = parseFloat(qty)
    if (!qty || isNaN(q) || q <= 0) { setErr('Podaj prawidłową ilość'); return }
    if (!reportId) { setErr('Wybierz raport dnia'); return }
    if (!entryId) { setErr('Wybierz wpis z raportu'); return }
    setErr('')

    try {
      await usageMut.mutateAsync()

      if (lowStock) {
        await alertMut.mutateAsync(photo ?? undefined)
      }

      qc.invalidateQueries({ queryKey: ['mat-usages'] })
      qc.invalidateQueries({ queryKey: ['mat-recent'] })
      qc.invalidateQueries({ queryKey: ['mat-alerts'] })
      if (lowStock && photo) qc.invalidateQueries({ queryKey: ['mat-search'] })

      setDone(true)
      setTimeout(onSuccess, 1200)
    } catch (e) {
      setErr(errMsg(e))
    }
  }

  const loading = usageMut.isPending || alertMut.isPending || photoLoading

  if (done) {
    return (
      <div
        className="rounded-2xl p-4 mt-2 flex items-center gap-3 animate-fade-in"
        style={{ background: t.green.bg, boxShadow: `0 0 0 1px ${t.green.ring}` }}
      >
        <div
          style={{
            width: 32, height: 32, borderRadius: 99, flexShrink: 0,
            background: t.dark ? 'rgba(5,150,105,0.25)' : 'rgba(5,150,105,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Check style={{ width: 18, height: 18, color: t.green.text }} />
        </div>
        <span className="text-sm font-semibold" style={{ color: t.green.text }}>
          Zapisano pobranie!{lowStock ? ' Wysłano alert o niskim stanie.' : ''}
        </span>
      </div>
    )
  }

  return (
    <div
      className="rounded-2xl p-4 mt-2 animate-fade-in"
      style={{
        background: t.dark ? 'rgba(255,255,255,0.04)' : 'rgba(39,97,235,0.04)',
        boxShadow: '0 0 0 1px rgba(39,97,235,0.14)',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold truncate" style={{ color: t.ink }}>
          {material.name}
        </p>
        <button onClick={onClose} style={{ color: t.inkMuted, flexShrink: 0, marginLeft: 8 }}>
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Powiązanie z raportem */}
      <div className="mb-3">
        <label className="block text-xs font-medium mb-1" style={{ color: t.inkMuted }}>
          Raport dnia <span style={{ color: '#f43f5e' }}>*</span>
        </label>
        {reportsLoading ? (
          <p className="text-xs rounded-lg px-3 py-2" style={{ background: t.blue.bg, color: '#2761eb' }}>
            Ładowanie raportów…
          </p>
        ) : todayReports.length === 0 ? (
          <div className="rounded-lg px-3 py-2.5 flex items-center justify-between gap-3"
            style={{ background: 'rgba(244,63,94,0.07)', boxShadow: '0 0 0 1px rgba(244,63,94,0.15)' }}>
            <p className="text-xs font-medium" style={{ color: '#be123c' }}>
              Brak raportów na dziś
            </p>
            <button
              type="button"
              onClick={() => createReportMut.mutate()}
              disabled={createReportMut.isPending}
              className="rounded-lg px-2.5 py-1 text-xs font-semibold shrink-0"
              style={{ background: '#2761eb', color: '#fff' }}
            >
              {createReportMut.isPending ? '…' : '+ Utwórz raport'}
            </button>
          </div>
        ) : (
          <select
            value={reportId}
            onChange={(e) => setReportId(e.target.value)}
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none appearance-none"
            style={{ background: t.surfaceAlt, border: '1.5px solid rgba(39,97,235,0.18)', color: t.ink, fontSize: 15 }}
          >
            <option value="">— wybierz raport —</option>
            {todayReports.map((r) => {
              const locs = [...new Set(r.entries.map((e) => e.location.name))].join(', ')
              return (
                <option key={r.id} value={r.id}>
                  {locs || 'Raport'} ({r.entries.length} wpisów)
                </option>
              )
            })}
          </select>
        )}
      </div>

      {/* Wpis z raportu */}
      {selectedReport && selectedReport.entries.length > 0 && (
        <div className="mb-3">
          <label className="block text-xs font-medium mb-1" style={{ color: t.inkMuted }}>
            Wpis (lokalizacja) <span style={{ color: '#f43f5e' }}>*</span>
          </label>
          <select
            value={entryId}
            onChange={(e) => setEntryId(e.target.value)}
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none appearance-none"
            style={{ background: t.surfaceAlt, border: '1.5px solid rgba(39,97,235,0.18)', color: t.ink, fontSize: 15 }}
          >
            <option value="">— wybierz wpis —</option>
            {selectedReport.entries.map((e) => (
              <option key={e.id} value={e.id}>
                {e.location.name}{e.department ? ` / ${e.department.name}` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {selectedReport && selectedReport.entries.length === 0 && (
        <div className="mb-3 rounded-lg px-3 py-2.5 text-xs font-medium"
          style={{ background: 'rgba(244,63,94,0.07)', color: '#be123c', boxShadow: '0 0 0 1px rgba(244,63,94,0.15)' }}>
          Wybrany raport nie ma wpisów. Dodaj wpis w raporcie przed przypisaniem materiału.
        </div>
      )}

      {/* Ilość + jednostka */}
      <div className="flex gap-2 mb-2">
        <div style={{ flex: 2 }}>
          <label className="block text-xs font-medium mb-1" style={{ color: t.inkMuted }}>Ilość</label>
          <input
            type="number"
            inputMode="decimal"
            min="0.01"
            step="any"
            placeholder="np. 5"
            value={qty}
            onChange={e => setQty(e.target.value)}
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
            style={{
              background: t.surfaceAlt,
              border: '1.5px solid rgba(39,97,235,0.18)',
              color: t.ink,
              fontSize: 16,
            }}
          />
        </div>
        <div style={{ flex: 1.5 }}>
          <label className="block text-xs font-medium mb-1" style={{ color: t.inkMuted }}>Jednostka</label>
          <select
            value={unit}
            onChange={e => setUnit(e.target.value)}
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
            style={{
              background: t.surfaceAlt,
              border: '1.5px solid rgba(39,97,235,0.18)',
              color: t.ink,
              fontSize: 16,
              appearance: 'auto',
            }}
          >
            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>

      {/* Uwagi */}
      <div className="mb-2">
        <label className="block text-xs font-medium mb-1" style={{ color: t.inkMuted }}>Uwagi (opcjonalnie)</label>
        <input
          type="text"
          placeholder="np. użyte przy rozdzielnicy A1"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
          style={{
            background: t.surfaceAlt,
            border: '1.5px solid rgba(39,97,235,0.18)',
            color: t.ink,
            fontSize: 16,
          }}
        />
      </div>

      {/* Toggle niski stan */}
      <button
        type="button"
        onClick={() => setLowStock(v => !v)}
        className="flex items-center gap-2 mb-2 py-1"
      >
        <div
          style={{
            width: 18, height: 18, borderRadius: 5, flexShrink: 0,
            background: lowStock ? 'rgba(217,119,6,0.85)' : t.dark ? 'rgba(255,255,255,0.1)' : 'rgba(12,30,60,0.1)',
            border: lowStock ? '1.5px solid rgba(217,119,6,0.9)' : t.dark ? '1.5px solid rgba(255,255,255,0.18)' : '1.5px solid rgba(12,30,60,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all .15s',
          }}
        >
          {lowStock && <Check style={{ width: 11, height: 11, color: '#fff' }} />}
        </div>
        <span className="text-sm font-medium" style={{ color: lowStock ? t.amber.text : t.inkMuted }}>
          <AlertTriangle className="inline h-3.5 w-3.5 mr-1" style={{ marginTop: -2 }} />
          Zgłoś niski stan
        </span>
      </button>

      {/* Sekcja niski stan */}
      {lowStock && (
        <div
          className="rounded-xl p-3 mb-2 animate-fade-in"
          style={{ background: t.amber.bg, boxShadow: '0 0 0 1px rgba(217,119,6,0.16)' }}
        >
          <p className="text-xs font-semibold mb-2" style={{ color: t.amber.text }}>
            Zdjęcie (zalecane)
            {!material.photoUrl && (
              <span className="ml-1 font-normal opacity-75">— stanie się zdjęciem materiału</span>
            )}
          </p>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />

          {photoLoading ? (
            <div className="flex items-center gap-2 mb-2 text-xs font-medium" style={{ color: t.amber.text }}>
              <div className="animate-spin h-4 w-4 border-2 rounded-full" style={{ borderColor: t.amber.text, borderTopColor: 'transparent' }} />
              Kompresowanie zdjęcia…
            </div>
          ) : photo ? (
            <div className="flex items-center gap-2 mb-2">
              <img
                src={URL.createObjectURL(photo)}
                alt="podgląd"
                style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8 }}
              />
              <div>
                <p className="text-xs font-medium" style={{ color: t.amber.text }}>{photo.name}</p>
                <p className="text-xs opacity-60" style={{ color: t.amber.text }}>
                  {(photo.size / 1024).toFixed(0)} KB
                </p>
                <button
                  className="text-xs underline mt-0.5"
                  style={{ color: t.amber.text }}
                  onClick={() => setPhoto(null)}
                >
                  usuń
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium mb-2 w-full justify-center"
              style={{
                background: t.amber.bg,
                border: '1.5px dashed rgba(217,119,6,0.35)',
                color: t.amber.text,
              }}
            >
              <Camera className="h-4 w-4" />
              Zrób zdjęcie / wybierz plik
            </button>
          )}

          <input
            type="text"
            placeholder="Notatka do alertu (opcjonalnie)"
            value={alertNote}
            onChange={e => setAlertNote(e.target.value)}
            className="w-full rounded-xl px-3 py-2 text-sm outline-none"
            style={{
              background: t.surfaceAlt,
              border: '1px solid rgba(217,119,6,0.22)',
              color: t.ink,
              fontSize: 15,
            }}
          />
        </div>
      )}

      {err && <p className="text-xs font-medium mb-2" style={{ color: '#f43f5e' }}>{err}</p>}

      <div className="flex gap-2">
        <Button
          size="lg"
          style={{ flex: 1 }}
          loading={loading}
          onClick={handleSubmit}
        >
          <Download className="h-4 w-4 mr-1.5" />
          Pobierz
        </Button>
        <button
          onClick={onClose}
          className="px-4 rounded-xl text-sm font-medium"
          style={{ background: t.dark ? 'rgba(255,255,255,0.06)' : 'rgba(12,30,60,0.07)', color: '#4a6080' }}
        >
          Anuluj
        </button>
      </div>
    </div>
  )
}

// ── MaterialCard ──────────────────────────────────────────────────────────────

function MaterialCard({
  material,
  selected,
  onSelect,
  onClose,
  onSuccess,
}: {
  material:  Material
  selected:  boolean
  onSelect:  () => void
  onClose:   () => void
  onSuccess: () => void
}) {
  const t = useTheme()
  return (
    <div>
      <button
        onClick={selected ? onClose : onSelect}
        className="w-full flex items-center gap-3 rounded-2xl px-3 py-3 text-left transition-all"
        style={{
          background: selected ? t.blue.bg : t.surfaceAlt,
          boxShadow: selected
            ? `0 0 0 2px ${t.blue.ring}, 0 2px 8px rgba(39,97,235,0.10)`
            : t.cardShadow,
        }}
      >
        <MaterialPhoto url={material.photoUrl} name={material.name} size={44} />
        <span
          className="flex-1 text-sm font-medium leading-tight"
          style={{ color: t.ink }}
        >
          {material.name}
        </span>
        <ChevronDown
          className="h-4 w-4 flex-shrink-0 transition-transform duration-200"
          style={{
            color: selected ? '#2761eb' : t.inkMuted,
            transform: selected ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {selected && (
        <UsageForm
          material={material}
          onClose={onClose}
          onSuccess={onSuccess}
        />
      )}
    </div>
  )
}

// ── EditUsageForm ─────────────────────────────────────────────────────────────

function EditUsageForm({
  usage,
  onClose,
  onSuccess,
}: {
  usage:     MaterialUsage
  onClose:   () => void
  onSuccess: () => void
}) {
  const qc = useQueryClient()
  const [qty,   setQty]   = useState(fmtQty(usage.quantity))
  const [unit,  setUnit]  = useState(usage.unit)
  const [notes, setNotes] = useState(usage.notes ?? '')
  const [err,   setErr]   = useState('')

  const t = useTheme()

  const updateMut = useMutation({
    mutationFn: () => materialUsagesApi.update(usage.id, {
      quantity: parseFloat(qty),
      unit,
      notes: notes || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mat-usages'] })
      onSuccess()
    },
    onError: (e) => setErr(errMsg(e)),
  })

  return (
    <div
      className="rounded-2xl p-3 mt-1 animate-fade-in"
      style={{
        background: t.dark ? 'rgba(255,255,255,0.04)' : 'rgba(39,97,235,0.05)',
        boxShadow: '0 0 0 1px rgba(39,97,235,0.14)',
      }}
    >
      <div className="flex gap-2 mb-2">
        <div style={{ flex: 2 }}>
          <label className="block text-xs font-medium mb-1" style={{ color: t.inkMuted }}>Ilość</label>
          <input
            type="number" inputMode="decimal" min="0.01" step="any"
            value={qty} onChange={e => setQty(e.target.value)}
            className="w-full rounded-xl px-3 py-2 text-sm outline-none"
            style={{ background: t.surfaceAlt, border: '1.5px solid rgba(39,97,235,0.18)', color: t.ink, fontSize: 16 }}
          />
        </div>
        <div style={{ flex: 1.5 }}>
          <label className="block text-xs font-medium mb-1" style={{ color: t.inkMuted }}>Jednostka</label>
          <select
            value={unit} onChange={e => setUnit(e.target.value)}
            className="w-full rounded-xl px-3 py-2 text-sm outline-none"
            style={{ background: t.surfaceAlt, border: '1.5px solid rgba(39,97,235,0.18)', color: t.ink, fontSize: 16, appearance: 'auto' }}
          >
            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>
      <div className="mb-2">
        <label className="block text-xs font-medium mb-1" style={{ color: t.inkMuted }}>Uwagi</label>
        <input
          type="text" placeholder="Uwagi (opcjonalnie)"
          value={notes} onChange={e => setNotes(e.target.value)}
          className="w-full rounded-xl px-3 py-2 text-sm outline-none"
          style={{ background: t.surfaceAlt, border: '1.5px solid rgba(39,97,235,0.18)', color: t.ink, fontSize: 16 }}
        />
      </div>
      {err && <p className="text-xs font-medium mb-2" style={{ color: '#f43f5e' }}>{err}</p>}
      <div className="flex gap-2">
        <Button
          size="sm"
          loading={updateMut.isPending}
          onClick={() => {
            const q = parseFloat(qty)
            if (!qty || isNaN(q) || q <= 0) { setErr('Podaj prawidłową ilość'); return }
            setErr('')
            updateMut.mutate()
          }}
          style={{ flex: 1 }}
        >
          <Check className="h-3.5 w-3.5 mr-1" /> Zapisz
        </Button>
        <button
          onClick={onClose}
          className="px-3 rounded-xl text-sm font-medium"
          style={{ background: t.dark ? 'rgba(255,255,255,0.06)' : 'rgba(12,30,60,0.07)', color: '#4a6080' }}
        >
          Anuluj
        </button>
      </div>
    </div>
  )
}

// ── EmployeeView ──────────────────────────────────────────────────────────────

function EmployeeView() {
  const qc             = useQueryClient()
  const t              = useTheme()
  const [q,  setQ]     = useState('')
  const [dq, setDq]    = useState('')
  const [sel, setSel]  = useState<number | null>(null)
  const [usageFilter, setUsageFilter] = useState<'today' | '7days' | '30days' | 'all'>('today')
  const [editingId,   setEditingId]   = useState<string | null>(null)
  const timerRef       = useRef<ReturnType<typeof setTimeout>>()

  const isSearching = dq.length >= 3

  useEffect(() => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setDq(q), 300)
    return () => clearTimeout(timerRef.current)
  }, [q])

  const { data: searchData, isFetching } = useQuery({
    queryKey: ['mat-search', dq],
    queryFn:  () => materialsApi.search(dq || undefined).then(r => r.data.data),
    enabled:  isSearching,
    staleTime: 30_000,
  })

  const { data: recentData } = useQuery({
    queryKey: ['mat-recent'],
    queryFn:  () => materialsApi.search().then(r => r.data.data),
    staleTime: 60_000,
  })

  function getUsageRange(f: 'today' | '7days' | '30days' | 'all'): { from?: string; to?: string } {
    const today = toLocalISODate(new Date())
    if (f === 'today')  return { from: today, to: today }
    if (f === '7days')  { const d = new Date(); d.setDate(d.getDate() - 6);  return { from: toLocalISODate(d), to: today } }
    if (f === '30days') { const d = new Date(); d.setDate(d.getDate() - 29); return { from: toLocalISODate(d), to: today } }
    return {}
  }

  const { data: usagesData } = useQuery({
    queryKey: ['mat-usages', 'employee', usageFilter],
    queryFn:  () => {
      const { from, to } = getUsageRange(usageFilter)
      return materialUsagesApi.list({ from, to, limit: 100 }).then(r => r.data.data)
    },
    staleTime: 30_000,
  })

  const removeMut = useMutation({
    mutationFn: (id: string) => materialUsagesApi.remove(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['mat-usages'] }),
  })

  const displayed = isSearching ? (searchData ?? []) : (recentData ?? [])
  const todayStr  = toLocalISODate(new Date())

  function handleSuccess() {
    setSel(null)
    qc.invalidateQueries({ queryKey: ['mat-recent'] })
    qc.invalidateQueries({ queryKey: ['mat-usages'] })
  }

  const filterBtns = [
    { id: 'today'  as const, label: 'Dziś' },
    { id: '7days'  as const, label: '7 dni' },
    { id: '30days' as const, label: '30 dni' },
    { id: 'all'    as const, label: 'Wszystko' },
  ]

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      {/* Search bar */}
      <div className="sticky top-0 z-10 pb-3" style={{ background: t.bg }}>
        <div
          className="flex items-center gap-2 rounded-2xl px-4 py-3"
          style={{
            background: t.surfaceAlt,
            boxShadow: t.cardShadow,
          }}
        >
          <Search className="h-5 w-5 flex-shrink-0" style={{ color: q ? t.inkDim : t.inkMuted }} />
          <input
            type="search"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Szukaj materiału..."
            className="flex-1 outline-none bg-transparent text-sm"
            style={{ color: t.ink, fontSize: 16 }}
            autoComplete="off"
          />
          {q && (
            <button onClick={() => { setQ(''); setDq(''); setSel(null) }}>
              <X className="h-4 w-4" style={{ color: '#8ba4cc' }} />
            </button>
          )}
        </div>
        {q.length > 0 && q.length < 3 && (
          <p className="text-center text-xs mt-2" style={{ color: '#8ba4cc' }}>
            Wpisz min. 3 znaki aby wyszukać
          </p>
        )}
      </div>

      {/* Label sekcji */}
      <div className="flex items-center gap-2 mb-3">
        {isSearching
          ? <Search className="h-4 w-4" style={{ color: t.inkDim }} />
          : <Clock  className="h-4 w-4" style={{ color: t.inkDim }} />
        }
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: t.inkDim }}>
          {isSearching
            ? `Wyniki wyszukiwania${isFetching ? '...' : ` (${displayed.length})`}`
            : 'Ostatnio używane'
          }
        </span>
      </div>

      {/* Lista materiałów (szukaj / ostatnie) */}
      {displayed.length === 0 && !isFetching && (
        <div className="text-center py-10" style={{ color: '#8ba4cc' }}>
          {isSearching
            ? 'Brak wyników dla tego zapytania'
            : 'Brak historii. Zacznij wyszukiwać materiały powyżej.'
          }
        </div>
      )}

      <div className="flex flex-col gap-2 mb-6">
        {displayed.map(mat => (
          <MaterialCard
            key={mat.id}
            material={mat}
            selected={sel === mat.id}
            onSelect={() => setSel(mat.id)}
            onClose={() => setSel(null)}
            onSuccess={handleSuccess}
          />
        ))}
      </div>

      {/* Moje pobrania — nagłówek + filtry */}
      <div className="flex items-center gap-2 mb-3">
        <Download className="h-4 w-4" style={{ color: '#059669' }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#059669' }}>
          Moje pobrania{usagesData?.total != null ? ` (${usagesData.total})` : ''}
        </span>
      </div>

      <div className="flex gap-2 mb-3">
        {filterBtns.map(b => (
          <button
            key={b.id}
            onClick={() => { setUsageFilter(b.id); setEditingId(null) }}
            className="rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors"
            style={{
              background: usageFilter === b.id ? '#059669' : 'rgba(5,150,105,0.08)',
              color:      usageFilter === b.id ? '#fff'    : '#059669',
            }}
          >
            {b.label}
          </button>
        ))}
      </div>

      {/* Lista pobrań */}
      {(usagesData?.items?.length ?? 0) === 0 ? (
        <div className="text-center py-8 text-sm mb-6" style={{ color: '#8ba4cc' }}>
          Brak pobrań w wybranym zakresie
        </div>
      ) : (
        <div
          className="rounded-2xl overflow-hidden mb-6"
          style={{ background: 'rgba(5,150,105,0.06)', boxShadow: '0 0 0 1px rgba(5,150,105,0.18), 0 1px 4px rgba(5,150,105,0.08)' }}
        >
          {usagesData!.items.map((u, i) => {
            const isToday   = u.usedAt.slice(0, 10) === todayStr
            const isEditing = editingId === u.id
            return (
              <div key={u.id}>
                <div
                  className="flex items-center gap-3 px-4 py-3"
                  style={{ borderTop: i > 0 ? '1px solid rgba(5,150,105,0.12)' : 'none' }}
                >
                  <MaterialPhoto url={u.material.photoUrl} name={u.material.name} size={34} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: t.ink }}>
                      {u.material.name}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: '#8ba4cc' }}>
                      {fmtQty(u.quantity)} {u.unit}
                      {u.notes && ` · ${u.notes}`}
                      {usageFilter !== 'today' && (
                        <span className="ml-1">
                          · {new Date(u.usedAt).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5 ml-1 flex-shrink-0">
                    <button
                      onClick={() => setEditingId(isEditing ? null : u.id)}
                      className="p-1.5 rounded-xl"
                      style={{ color: isEditing ? '#2761eb' : '#8ba4cc' }}
                      title="Edytuj"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {isToday && (
                      <button
                        onClick={() => removeMut.mutate(u.id)}
                        disabled={removeMut.isPending}
                        className="p-1.5 rounded-xl"
                        style={{ color: '#f43f5e', opacity: removeMut.isPending ? 0.4 : 1 }}
                        title="Usuń"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                {isEditing && (
                  <div className="px-4 pb-3">
                    <EditUsageForm
                      usage={u}
                      onClose={() => setEditingId(null)}
                      onSuccess={() => setEditingId(null)}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── AdminUsagesPanel ──────────────────────────────────────────────────────────

function AdminUsagesPanel() {
  const t = useTheme()
  const todayStr = toLocalISODate(new Date())
  const [from, setFrom] = useState(todayStr)
  const [to,   setTo]   = useState(todayStr)

  const { data, isLoading } = useQuery({
    queryKey: ['mat-usages', 'admin', from, to],
    queryFn:  () => materialUsagesApi.list({ from: from || undefined, to: to || undefined })
                     .then(r => r.data.data),
    staleTime: 30_000,
  })

  function setRange(days: number) {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - days + 1)
    setFrom(toLocalISODate(start))
    setTo(toLocalISODate(end))
  }

  const quickBtns: { label: string; days: number }[] = [
    { label: 'Dziś',     days: 1 },
    { label: '7 dni',    days: 7 },
    { label: '30 dni',   days: 30 },
  ]

  return (
    <div>
      {/* Filtry */}
      <div className="flex gap-2 mb-2 flex-wrap">
        {quickBtns.map(b => (
          <button
            key={b.label}
            onClick={() => setRange(b.days)}
            className="rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors"
            style={{
              background: from === toLocalISODate(new Date(Date.now() - (b.days - 1) * 86400000)) && to === todayStr
                ? '#2761eb' : 'rgba(39,97,235,0.08)',
              color: from === toLocalISODate(new Date(Date.now() - (b.days - 1) * 86400000)) && to === todayStr
                ? '#fff' : '#2761eb',
            }}
          >
            {b.label}
          </button>
        ))}
      </div>
      <div className="flex gap-2 mb-4">
        <div className="flex-1">
          <label className="block text-xs font-medium mb-1" style={{ color: t.inkMuted }}>Od</label>
          <input
            type="date"
            value={from}
            onChange={e => setFrom(e.target.value)}
            className="w-full rounded-xl px-3 py-2 text-sm outline-none"
            style={{
              background: t.surfaceAlt, border: `1px solid ${t.borderStrong}`,
              color: t.ink, fontSize: 15,
            }}
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium mb-1" style={{ color: t.inkMuted }}>Do</label>
          <input
            type="date"
            value={to}
            onChange={e => setTo(e.target.value)}
            className="w-full rounded-xl px-3 py-2 text-sm outline-none"
            style={{
              background: t.surfaceAlt, border: `1px solid ${t.borderStrong}`,
              color: t.ink, fontSize: 15,
            }}
          />
        </div>
      </div>

      {isLoading && <PageSpinner />}

      {!isLoading && (
        <div>
          <p className="text-xs mb-3" style={{ color: t.inkMuted }}>
            Łącznie: {data?.total ?? 0} pobrań
          </p>

          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: t.surfaceAlt, boxShadow: t.cardShadow }}
          >
            {(data?.items ?? []).length === 0 ? (
              <p className="text-center py-8 text-sm" style={{ color: t.inkMuted }}>Brak pobrań</p>
            ) : (
              (data?.items ?? []).map((u, i) => (
                <div
                  key={u.id}
                  className="flex items-center gap-3 px-4 py-3"
                  style={{
                    borderTop: i > 0 ? '1px solid rgba(12,30,60,0.06)' : 'none',
                  }}
                >
                  <MaterialPhoto url={u.material.photoUrl} name={u.material.name} size={36} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: t.ink }}>
                      {u.material.name}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: t.inkMuted }}>
                      {u.user.fullName} · {fmtQty(u.quantity)} {u.unit}
                    </p>
                  </div>
                  <span className="text-xs whitespace-nowrap" style={{ color: t.inkMuted }}>
                    {new Date(u.usedAt).toLocaleDateString('pl-PL')}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── AdminAlertsPanel ──────────────────────────────────────────────────────────

function AdminAlertsPanel() {
  const qc = useQueryClient()
  const t = useTheme()
  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['mat-alerts'],
    queryFn:  () => materialAlertsApi.list().then(r => r.data.data),
    staleTime: 30_000,
  })

  const resolveMut = useMutation({
    mutationFn: (id: string) => materialAlertsApi.resolve(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['mat-alerts'] }),
  })

  const open     = alerts.filter(a => a.status === 'open')
  const resolved = alerts.filter(a => a.status === 'resolved')

  const AlertCard = ({ alert }: { alert: MaterialAlert }) => (
    <div
      className="rounded-2xl p-4 flex gap-3"
      style={{
        background: alert.status === 'open' ? 'rgba(217,119,6,0.05)' : 'rgba(12,30,60,0.03)',
        boxShadow: '0 0 0 1px rgba(12,30,60,0.07)',
      }}
    >
      {alert.photoUrl ? (
        <img
          src={alert.photoUrl}
          alt={alert.material.name}
          style={{
            width: 72, height: 72, objectFit: 'cover', borderRadius: 10,
            flexShrink: 0, border: '1px solid rgba(12,30,60,0.1)',
          }}
        />
      ) : (
        <MaterialPhoto url={null} name={alert.material.name} size={72} />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: t.ink }}>
          {alert.material.name}
        </p>
        <p className="text-xs mt-0.5" style={{ color: t.inkMuted }}>
          {alert.reporter.fullName} · {fmtDate(alert.createdAt)}
        </p>
        {alert.notes && (
          <p className="text-xs mt-1" style={{ color: t.inkMuted }}>{alert.notes}</p>
        )}
        {alert.status === 'open' && (
          <Button
            size="sm"
            className="mt-2"
            loading={resolveMut.isPending}
            onClick={() => resolveMut.mutate(alert.id)}
            style={{ background: t.green.bg, color: t.green.text }}
          >
            <Check className="h-3.5 w-3.5 mr-1" /> Rozwiązano
          </Button>
        )}
      </div>
    </div>
  )

  if (isLoading) return <PageSpinner />

  return (
    <div className="flex flex-col gap-4">
      {open.length > 0 && (
        <>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: t.amber.text }}>
            Otwarte ({open.length})
          </p>
          {open.map(a => <AlertCard key={a.id} alert={a} />)}
        </>
      )}

      {resolved.length > 0 && (
        <>
          <p className="text-xs font-semibold uppercase tracking-wider mt-2" style={{ color: t.inkMuted }}>
            Rozwiązane ({resolved.length})
          </p>
          {resolved.map(a => <AlertCard key={a.id} alert={a} />)}
        </>
      )}

      {alerts.length === 0 && (
        <p className="text-center py-10 text-sm" style={{ color: t.inkMuted }}>Brak alertów</p>
      )}
    </div>
  )
}

// ── AdminMaterialsList ────────────────────────────────────────────────────────

function AdminMaterialsList() {
  const qc = useQueryClient()
  const t = useTheme()
  const [q,        setQ]       = useState('')
  const [dq,       setDq]      = useState('')
  const [addModal,    setAddModal]    = useState(false)
  const [newName,     setNewName]     = useState('')
  const [newCatalog,  setNewCatalog]  = useState('')
  const [addErr,      setAddErr]      = useState('')
  const [editMat,     setEditMat]     = useState<{ id: number; catalogNumber: string | null; name: string } | null>(null)
  const [editName,    setEditName]    = useState('')
  const [editCatalog, setEditCatalog] = useState('')
  const [editErr,     setEditErr]     = useState('')
  const [bulkModal,   setBulkModal]   = useState(false)
  const [bulkText,    setBulkText]    = useState('')
  const [bulkErr,     setBulkErr]     = useState('')
  const [bulkDone,    setBulkDone]    = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setDq(q), 300)
    return () => clearTimeout(timerRef.current)
  }, [q])

  const isSearching = dq.length >= 3

  const { data: searchData, isFetching: searching } = useQuery({
    queryKey: ['mat-admin-search', dq],
    queryFn:  () => materialsApi.search(dq).then(r => r.data.data),
    enabled:  isSearching,
    staleTime: 20_000,
  })

  const { data: allData } = useQuery({
    queryKey: ['mat-all'],
    queryFn:  () => materialsApi.getAll().then(r => r.data.data),
    staleTime: 60_000,
  })

  const addMut = useMutation({
    mutationFn: () => materialsApi.create({ catalogNumber: newCatalog.trim() || null, name: newName.trim() }),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['mat-all'] })
      setAddModal(false)
      setNewName('')
      setNewCatalog('')
      setAddErr('')
    },
    onError: (e) => setAddErr(errMsg(e)),
  })

  const editMut = useMutation({
    mutationFn: () => materialsApi.update(editMat!.id, { catalogNumber: editCatalog.trim() || null, name: editName.trim() }),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['mat-all'] })
      qc.invalidateQueries({ queryKey: ['mat-admin-search'] })
      setEditMat(null)
      setEditName('')
      setEditCatalog('')
      setEditErr('')
    },
    onError: (e) => setEditErr(errMsg(e)),
  })

  const parsedBulk = bulkText
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length >= 2)

  const bulkMut = useMutation({
    mutationFn: () => materialsApi.bulkCreate(parsedBulk),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['mat-all'] })
      setBulkDone(res.data.data.inserted)
      setBulkText('')
    },
    onError: (e) => setBulkErr(errMsg(e)),
  })

  function openEdit(m: { id: number; catalogNumber: string | null; name: string }) {
    setEditMat(m)
    setEditName(m.name)
    setEditCatalog(m.catalogNumber ?? '')
    setEditErr('')
  }

  const displayed = isSearching ? (searchData ?? []) : (allData ?? [])
  const total     = allData?.length ?? 0

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div
          className="flex items-center gap-2 rounded-2xl px-3 py-2.5 flex-1"
          style={{
            background: t.surfaceAlt,
            boxShadow: t.cardShadow,
          }}
        >
          <Search className="h-4 w-4 flex-shrink-0" style={{ color: t.inkMuted }} />
          <input
            type="search"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Szukaj w bazie..."
            className="flex-1 outline-none bg-transparent text-sm"
            style={{ color: t.ink, fontSize: 15 }}
          />
        </div>
        <button
          onClick={() => setAddModal(true)}
          className="flex items-center gap-1.5 rounded-2xl px-3 py-2.5 text-sm font-semibold"
          style={{ background: '#2761eb', color: '#fff', flexShrink: 0 }}
        >
          <Plus className="h-4 w-4" /> Dodaj
        </button>
        <button
          onClick={() => { setBulkModal(true); setBulkDone(0); setBulkErr('') }}
          className="flex items-center gap-1.5 rounded-2xl px-3 py-2.5 text-sm font-semibold"
          style={{ background: t.dark ? 'rgba(255,255,255,0.08)' : 'rgba(12,30,60,0.07)', color: t.inkDim, flexShrink: 0 }}
        >
          <List className="h-4 w-4" /> Importuj listę
        </button>
      </div>

      <p className="text-xs mb-3" style={{ color: t.inkMuted }}>
        {isSearching
          ? `Wyniki: ${displayed.length}`
          : `Łącznie w bazie: ${total} materiałów`
        }
        {searching && ' (szukam...)'}
      </p>

      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: t.surfaceAlt, boxShadow: t.cardShadow }}
      >
        {displayed.slice(0, 100).map((m, i) => (
          <div
            key={m.id}
            className="flex items-center gap-3 px-4 py-3"
            style={{ borderTop: i > 0 ? `1px solid ${t.border}` : 'none' }}
          >
            <MaterialPhoto url={m.photoUrl} name={m.name} size={32} />
            <div className="flex-1 min-w-0">
              <span className="text-sm block truncate" style={{ color: t.ink }}>{m.name}</span>
              {m.catalogNumber && (
                <span className="text-xs" style={{ color: t.inkMuted }}>{m.catalogNumber}</span>
              )}
            </div>
            <button
              onClick={() => openEdit(m)}
              className="p-1.5 rounded-xl flex-shrink-0"
              style={{ color: t.inkMuted }}
              title="Edytuj"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {displayed.length === 0 && !searching && (
          <p className="text-center py-8 text-sm" style={{ color: t.inkMuted }}>
            {isSearching ? 'Brak wyników' : 'Baza materiałów jest pusta'}
          </p>
        )}
      </div>

      {/* Modal dodawania */}
      <Modal open={addModal} onClose={() => { setAddModal(false); setNewName(''); setNewCatalog(''); setAddErr('') }} title="Dodaj materiał">
        <div className="space-y-3">
          <Input
            label="Nr katalogowy (opcjonalnie)"
            value={newCatalog}
            onChange={e => setNewCatalog(e.target.value)}
            placeholder="np. KAB-001"
          />
          <Input
            label="Nazwa materiału"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="np. Kabel YKY 3x2.5"
            error={addErr}
          />
        </div>
        <Button
          className="w-full mt-4"
          loading={addMut.isPending}
          onClick={() => { setAddErr(''); addMut.mutate() }}
          disabled={newName.trim().length < 2}
        >
          Dodaj
        </Button>
      </Modal>

      {/* Modal edycji */}
      <Modal
        open={editMat !== null}
        onClose={() => { setEditMat(null); setEditName(''); setEditCatalog(''); setEditErr('') }}
        title="Edytuj materiał"
      >
        <div className="space-y-3">
          <Input
            label="Nr katalogowy (opcjonalnie)"
            value={editCatalog}
            onChange={e => setEditCatalog(e.target.value)}
            placeholder="np. KAB-001"
          />
          <Input
            label="Nazwa materiału"
            value={editName}
            onChange={e => setEditName(e.target.value)}
            error={editErr}
          />
        </div>
        <Button
          className="w-full mt-4"
          loading={editMut.isPending}
          onClick={() => { setEditErr(''); editMut.mutate() }}
          disabled={editName.trim().length < 2}
        >
          Zapisz
        </Button>
      </Modal>

      {/* Modal importu listy */}
      <Modal
        open={bulkModal}
        onClose={() => { setBulkModal(false); setBulkText(''); setBulkErr(''); setBulkDone(0) }}
        title="Importuj listę materiałów"
      >
        {bulkDone > 0 ? (
          <div
            className="rounded-2xl p-5 text-center"
            style={{ background: t.green.bg }}
          >
            <Check className="h-8 w-8 mx-auto mb-2" style={{ color: t.green.text }} />
            <p className="font-semibold text-base" style={{ color: t.green.text }}>
              Dodano {bulkDone} {bulkDone === 1 ? 'materiał' : bulkDone < 5 ? 'materiały' : 'materiałów'}
            </p>
            <button
              className="mt-4 text-sm font-medium"
              style={{ color: t.inkMuted }}
              onClick={() => { setBulkDone(0); setBulkText('') }}
            >
              Importuj kolejną listę
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm mb-2" style={{ color: t.inkDim }}>
              Wklej nazwy materiałów — każda w osobnej linii.
            </p>
            <textarea
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none"
              style={{
                background: t.surfaceAlt,
                border: `1.5px solid ${t.border}`,
                color: t.ink,
                fontSize: 14,
                minHeight: 180,
              }}
              placeholder={'Kabel NYY 3x2.5\nZłączka zaciskowa 6mm\nTaśma izolacyjna czarna\n...'}
              value={bulkText}
              onChange={e => { setBulkText(e.target.value); setBulkErr('') }}
            />
            <p className="text-xs mt-1.5" style={{ color: t.inkMuted }}>
              {parsedBulk.length > 0
                ? `${parsedBulk.length} ${parsedBulk.length === 1 ? 'pozycja' : parsedBulk.length < 5 ? 'pozycje' : 'pozycji'} gotowych do dodania`
                : 'Wpisz co najmniej jedną pozycję (min. 2 znaki)'}
            </p>
            {bulkErr && (
              <p className="text-xs font-medium mt-1" style={{ color: '#f43f5e' }}>{bulkErr}</p>
            )}
            <Button
              className="w-full mt-4"
              loading={bulkMut.isPending}
              onClick={() => { setBulkErr(''); bulkMut.mutate() }}
              disabled={parsedBulk.length === 0}
            >
              Dodaj {parsedBulk.length > 0 ? parsedBulk.length : ''} pozycji
            </Button>
          </>
        )}
      </Modal>
    </div>
  )
}

// ── AdminMonthlyPanel ─────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec',
  'Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień',
]

function AdminMonthlyPanel() {
  const t = useTheme()
  const now   = new Date()
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [sub,   setSub]   = useState<'overall' | 'employee'>('overall')
  const [exporting, setExporting] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['mat-monthly', year, month],
    queryFn:  () => materialUsagesApi.getMonthlySummary(year, month).then(r => r.data.data),
    staleTime: 60_000,
  })

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
    }

  async function handleExport() {
    setExporting(true)
    try { await materialUsagesApi.exportMonthly(year, month) }
    finally { setExporting(false) }
  }

  return (
    <div>
      {/* Nawigacja miesiąca */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={prevMonth}
          className="rounded-xl px-3 py-2 text-sm font-semibold"
          style={{ background: t.dark ? 'rgba(255,255,255,0.08)' : 'rgba(12,30,60,0.07)', color: t.inkMuted }}
        >
          ‹
        </button>
        <div className="flex-1 text-center">
          <span className="text-sm font-bold" style={{ color: t.ink }}>
            {MONTH_NAMES[month - 1]} {year}
          </span>
        </div>
        <button
          onClick={nextMonth}
          className="rounded-xl px-3 py-2 text-sm font-semibold"
          style={{ background: t.dark ? 'rgba(255,255,255,0.08)' : 'rgba(12,30,60,0.07)', color: t.inkMuted }}
        >
          ›
        </button>
        <Button
          size="sm"
          loading={exporting}
          onClick={handleExport}
          style={{ background: 'rgba(5,150,105,0.12)', color: '#065f46', flexShrink: 0 }}
        >
          <Download className="h-3.5 w-3.5 mr-1" />
          <span className="hidden sm:inline">Eksport</span> XLSX
        </Button>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-2 mb-4">
        {([['overall', 'Ogólne'], ['employee', 'Per pracownik']] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setSub(id)}
            className="rounded-xl px-3 py-1.5 text-xs font-semibold"
            style={{
              background: sub === id ? t.blue.text : t.blue.bg,
              color:      sub === id ? (t.dark ? '#0c1e3c' : '#fff') : t.blue.text,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading && <PageSpinner />}

      {/* Ogólne */}
      {!isLoading && sub === 'overall' && (
        <div>
          <p className="text-xs mb-3" style={{ color: t.inkMuted }}>
            {data?.overall.length ?? 0} pozycji
          </p>
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: t.surfaceAlt, boxShadow: t.cardShadow }}
          >
            {(data?.overall ?? []).length === 0 ? (
              <p className="text-center py-8 text-sm" style={{ color: t.inkMuted }}>Brak danych</p>
            ) : (
              (data!.overall).map((r, i) => (
                <div
                  key={`${r.materialId}-${r.unit}`}
                  className="flex items-center gap-3 px-4 py-3"
                  style={{ borderTop: i > 0 ? `1px solid ${t.border}` : 'none' }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: t.ink }}>
                      {r.materialName}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: t.inkMuted }}>
                      {r.usageCount} pobrań
                    </p>
                  </div>
                  <span className="text-sm font-semibold whitespace-nowrap" style={{ color: t.blue.text }}>
                    {fmtQty(r.totalQuantity)} {r.unit}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Per pracownik */}
      {!isLoading && sub === 'employee' && (
        <div className="flex flex-col gap-3">
          {(data?.byEmployee ?? []).length === 0 ? (
            <p className="text-center py-8 text-sm" style={{ color: t.inkMuted }}>Brak danych</p>
          ) : (
            data!.byEmployee.map(emp => (
              <div
                key={emp.userId}
                className="rounded-2xl overflow-hidden"
                style={{ background: t.surfaceAlt, boxShadow: t.cardShadow }}
              >
                <div
                  className="px-4 py-3 flex items-center justify-between"
                  style={{
                    background: t.dark ? 'rgba(59,130,246,0.08)' : 'rgba(39,97,235,0.05)',
                    borderBottom: `1px solid ${t.border}`,
                  }}
                >
                  <span className="text-sm font-bold" style={{ color: t.ink }}>
                    {emp.fullName}
                  </span>
                  <span className="text-xs" style={{ color: t.inkMuted }}>
                    {emp.materials.length} poz.
                  </span>
                </div>
                {emp.materials.map((mat, i) => (
                  <div
                    key={`${mat.materialId}-${mat.unit}`}
                    className="flex items-center gap-3 px-4 py-2.5"
                    style={{ borderTop: i > 0 ? `1px solid ${t.border}` : 'none' }}
                  >
                    <p className="flex-1 text-sm truncate" style={{ color: t.ink }}>
                      {mat.materialName}
                    </p>
                    <span className="text-sm font-semibold whitespace-nowrap" style={{ color: t.blue.text }}>
                      {fmtQty(mat.totalQuantity)} {mat.unit}
                    </span>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ── AdminZestawieniePanel ─────────────────────────────────────────────────────

function AdminZestawieniePanel() {
  const t = useTheme()
  const todayStr = toLocalISODate(new Date())
  const [from,         setFrom]         = useState('')
  const [to,           setTo]           = useState('')
  const [locationId,   setLocationId]   = useState<number | ''>('')
  const [departmentId, setDepartmentId] = useState<number | ''>('')
  const [userId,       setUserId]       = useState('')
  const [exporting,    setExporting]    = useState(false)

  const inputStyle = {
    background: t.surfaceAlt, border: `1px solid ${t.borderStrong}`,
    color: t.ink, fontSize: 14, width: '100%', borderRadius: 12,
    padding: '8px 12px', outline: 'none',
  }

  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn:  () => locationsApi.getAll().then(r => r.data.data),
    staleTime: 300_000,
  })

  const { data: departments } = useQuery({
    queryKey: ['departments', locationId],
    queryFn:  () => departmentsApi.list(locationId || undefined).then(r => r.data.data),
    staleTime: 120_000,
  })

  const { data: users } = useQuery({
    queryKey: ['users-all'],
    queryFn:  () => usersApi.getAll().then(r => r.data.data),
    staleTime: 300_000,
  })

  const params = {
    from:         from         || undefined,
    to:           to           || undefined,
    locationId:   locationId   || undefined,
    departmentId: departmentId || undefined,
    userId:       userId       || undefined,
    limit:        200,
  }

  const { data, isLoading } = useQuery({
    queryKey: ['mat-usages', 'zestawienie', from, to, locationId, departmentId, userId],
    queryFn:  () => materialUsagesApi.list(params).then(r => r.data.data),
    staleTime: 30_000,
  })

  function resetFilters() {
    setFrom(''); setTo(''); setLocationId(''); setDepartmentId(''); setUserId('')
  }

  async function handleExport() {
    setExporting(true)
    try {
      await materialUsagesApi.exportFiltered({
        from:         from         || undefined,
        to:           to           || undefined,
        locationId:   locationId   || undefined,
        departmentId: departmentId || undefined,
        userId:       userId       || undefined,
      })
    } catch { /* ignore */ } finally {
      setExporting(false)
    }
  }

  const items = data?.items ?? []

  return (
    <div>
      {/* Filtry */}
      <div
        className="rounded-2xl p-4 mb-4"
        style={{ background: t.surface, border: `1px solid ${t.border}` }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4" style={{ color: t.inkMuted }} />
          <span className="text-sm font-semibold" style={{ color: t.ink }}>Filtry</span>
          <button
            onClick={resetFilters}
            className="ml-auto text-xs font-medium"
            style={{ color: t.inkMuted }}
          >
            Wyczyść
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-2">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: t.inkMuted }}>Od</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: t.inkMuted }}>Do</label>
            <input type="date" value={to} max={todayStr} onChange={e => setTo(e.target.value)} style={inputStyle} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-2">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: t.inkMuted }}>Lokalizacja</label>
            <select
              value={locationId}
              onChange={e => { setLocationId(e.target.value ? Number(e.target.value) : ''); setDepartmentId('') }}
              style={inputStyle}
            >
              <option value="">Wszystkie</option>
              {(locations ?? []).map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: t.inkMuted }}>Wydział</label>
            <select
              value={departmentId}
              onChange={e => setDepartmentId(e.target.value ? Number(e.target.value) : '')}
              disabled={!locationId}
              style={{ ...inputStyle, opacity: locationId ? 1 : 0.4 }}
            >
              <option value="">Wszystkie</option>
              {(departments ?? []).map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: t.inkMuted }}>Pracownik</label>
          <select value={userId} onChange={e => setUserId(e.target.value)} style={inputStyle}>
            <option value="">Wszyscy</option>
            {(users ?? []).filter(u => u.isActive).map(u => (
              <option key={u.id} value={u.id}>{u.fullName}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Akcje */}
      <div className="flex justify-between items-center mb-3">
        <span className="text-sm font-medium" style={{ color: t.inkMuted }}>
          {isLoading ? 'Ładowanie…' : `${items.length} pozycji${data?.total && data.total > items.length ? ` (z ${data.total})` : ''}`}
        </span>
        <Button
          variant="primary"
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-1.5 text-sm"
        >
          <Download className="h-4 w-4" />
          {exporting ? 'Eksport…' : 'Eksportuj XLSX'}
        </Button>
      </div>

      {/* Tabela */}
      {isLoading ? (
        <PageSpinner />
      ) : items.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: t.inkMuted }}>Brak wyników dla wybranych filtrów.</p>
      ) : (
        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: `1px solid ${t.border}` }}
        >
          <div
            className="grid text-[11px] font-bold uppercase tracking-wider px-3 py-2"
            style={{
              gridTemplateColumns: '90px 1fr 1fr 1fr 60px 50px',
              background: t.surfaceAlt, color: t.inkMuted,
            }}
          >
            <span>Data</span>
            <span>Pracownik</span>
            <span>Lokalizacja</span>
            <span>Materiał</span>
            <span className="text-right">Ilość</span>
            <span className="text-right">Jedn.</span>
          </div>
          {items.map((r, i) => (
            <div
              key={r.id}
              className="grid items-center px-3 py-2 text-sm"
              style={{
                gridTemplateColumns: '90px 1fr 1fr 1fr 60px 50px',
                background: i % 2 === 0 ? t.surface : t.surfaceAlt,
                color: t.ink,
                borderTop: i > 0 ? `1px solid ${t.border}` : 'none',
              }}
            >
              <span className="text-xs" style={{ color: t.inkMuted }}>
                {new Date(r.usedAt).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: '2-digit' })}
              </span>
              <span className="truncate">{r.user.fullName}</span>
              <span className="truncate text-xs" style={{ color: t.inkMuted }}>
                {r.location?.name ?? '—'}
                {r.department ? ` / ${r.department.name}` : ''}
              </span>
              <span className="truncate text-xs">{r.material.name}</span>
              <span className="text-right tabular-nums">{fmtQty(r.quantity)}</span>
              <span className="text-right text-xs" style={{ color: t.inkMuted }}>{r.unit}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── AdminView ─────────────────────────────────────────────────────────────────

type AdminTab = 'usages' | 'alerts' | 'list' | 'monthly' | 'zestawienie'

function AdminView() {
  const theme = useTheme()
  const [tab, setTab] = useState<AdminTab>('usages')

  const { data: alerts } = useQuery({
    queryKey: ['mat-alerts'],
    queryFn:  () => materialAlertsApi.list().then(r => r.data.data),
    staleTime: 60_000,
  })
  const openAlerts = (alerts ?? []).filter(a => a.status === 'open').length

  const tabs: { id: AdminTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'usages',       label: 'Zużycie',      icon: <BarChart3     className="h-4 w-4" /> },
    { id: 'zestawienie',  label: 'Zestawienie',  icon: <Filter        className="h-4 w-4" /> },
    { id: 'monthly',      label: 'Miesięczne',   icon: <Download      className="h-4 w-4" /> },
    { id: 'alerts',       label: 'Niski stan',   icon: <AlertTriangle className="h-4 w-4" />, badge: openAlerts },
    { id: 'list',         label: 'Materiały',    icon: <List          className="h-4 w-4" /> },
  ]

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      {/* Tab bar */}
      <div
        className="flex rounded-2xl p-1 mb-5"
        style={{ background: theme.dark ? 'rgba(255,255,255,0.06)' : 'rgba(12,30,60,0.06)' }}
      >
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-all relative"
            style={{
              background: tab === t.id ? theme.surface : 'transparent',
              color:      tab === t.id ? theme.ink : theme.inkMuted,
              boxShadow:  tab === t.id ? theme.cardShadow : 'none',
            }}
          >
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
            {t.badge != null && t.badge > 0 && (
              <span
                className="absolute -top-1 -right-1 text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center"
                style={{ background: '#f43f5e', color: '#fff' }}
              >
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'usages'      && <AdminUsagesPanel />}
      {tab === 'zestawienie' && <AdminZestawieniePanel />}
      {tab === 'monthly'     && <AdminMonthlyPanel />}
      {tab === 'alerts'      && <AdminAlertsPanel />}
      {tab === 'list'        && <AdminMaterialsList />}
    </div>
  )
}

// ── MaterialsPage (root) ──────────────────────────────────────────────────────

export default function MaterialsPage() {
  const isAdmin = useAuthStore(s => s.isAdmin())
  const t = useTheme()

  return (
    <div className="min-h-screen" style={{ background: t.bg }}>
      <div className="px-4 pt-6 pb-24">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6" style={{ maxWidth: isAdmin ? 680 : 560, margin: '0 auto 24px' }}>
          <div
            style={{
              width: 42, height: 42, borderRadius: 13, flexShrink: 0,
              background: 'linear-gradient(135deg, #2761eb 0%, #1a47c4 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(39,97,235,0.28)',
            }}
          >
            <Package className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight" style={{ color: t.ink }}>
              Materiały
            </h1>
            <p className="text-xs" style={{ color: '#8ba4cc' }}>
              {isAdmin ? 'Zarządzanie zużyciem materiałów' : 'Rejestracja pobranych materiałów'}
            </p>
          </div>
        </div>

        {isAdmin ? <AdminView /> : <EmployeeView />}
      </div>
    </div>
  )
}
