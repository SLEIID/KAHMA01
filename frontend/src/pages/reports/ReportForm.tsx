import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Car, Trash2, Package, Plus, X, Check,
  Clock, MapPin, Users, Pencil, Building2, ShieldCheck, ShieldOff, LockOpen,
  AlertTriangle, Camera, Wrench,
} from 'lucide-react'
import axios from 'axios'
import { reportsApi, type Report, type ReportEntry, type EntryMaterial } from '@/api/reports.api'
import { usersApi } from '@/api/users.api'
import { vehiclesApi } from '@/api/vehicles.api'
import { locationsApi } from '@/api/locations.api'
import { departmentsApi } from '@/api/departments.api'

import { materialsApi, materialUsagesApi, materialAlertsApi, type Material } from '@/api/materials.api'
import { compressImage } from '@/lib/compressImage'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { PageSpinner } from '@/components/ui/Spinner'
import { useTheme } from '@/lib/theme'

// ── Schematy walidacji ────────────────────────────────────────────────────────

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/

const vehicleRowSchema = z.object({
  vehicleId: z.coerce.number().int().positive('Wybierz pojazd'),
  kmDriven:  z.coerce.number().int().min(0, 'Podaj km'),
})

const entrySchema = z.object({
  workStart:    z.string().regex(timeRegex, 'Format HH:MM'),
  workEnd:      z.string().regex(timeRegex, 'Format HH:MM'),
  locationId:   z.coerce.number().int().positive('Wybierz lokalizację'),
  departmentId: z.coerce.number().int().min(0).optional().nullable().transform(v => (!v || v <= 0) ? null : v),
  description:  z.string().min(3, 'Opisz wykonaną pracę'),
  vehicleUsages: z.array(vehicleRowSchema).default([]),
}).refine(
  (d) => {
    if (!timeRegex.test(d.workStart) || !timeRegex.test(d.workEnd)) return true
    return d.workEnd > d.workStart
  },
  { message: 'Godzina zakończenia musi być późniejsza niż rozpoczęcia', path: ['workEnd'] }
)

type EntryFormData = z.infer<typeof entrySchema>

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDatePL(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('pl-PL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function calcMins(start: string, end: string): number {
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

function makeSelectStyle(t: ReturnType<typeof useTheme>): React.CSSProperties {
  return {
    background: t.surfaceInput,
    color: t.ink,
    boxShadow: '0 0 0 1px rgba(12,30,60,0.10), inset 0 1px 3px rgba(12,30,60,0.06)',
    borderRadius: 12,
    padding: '0.625rem 1rem',
    fontSize: 16,
    width: '100%',
    appearance: 'none' as const,
    outline: 'none',
  }
}

// ── Draft persistence (sessionStorage) ──────────────────────────────────────

const DRAFT_KEY = 'kahma_entry_draft'

function loadDraft(): Partial<EntryFormData> | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY)
    return raw ? (JSON.parse(raw) as Partial<EntryFormData>) : null
  } catch { return null }
}
function saveDraft(values: unknown) {
  try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(values)) } catch {}
}
function clearDraft() {
  try { sessionStorage.removeItem(DRAFT_KEY) } catch {}
}

// ── Formularz pojedynczego wpisu (modal) ─────────────────────────────────────

function EntryModal({
  onClose,
  onSave,
  initialData,
  locked,
  reportDate,
}: {
  onClose: () => void
  onSave: (data: EntryFormData) => Promise<{ entryId: string }>
  initialData?: ReportEntry | null
  locked: boolean
  reportDate: string
}) {
  const t = useTheme()
  const selectStyle = makeSelectStyle(t)
  const { user, isAdmin } = useAuthStore()

  const [addingLocation, setAddingLocation]     = useState(false)
  const [newLocationName, setNewLocationName]   = useState('')
  const [newLocationError, setNewLocationError] = useState('')
  const [addingDept, setAddingDept]             = useState(false)
  const [newDeptName, setNewDeptName]           = useState('')
  const [newDeptError, setNewDeptError]         = useState('')
  const [saving, setSaving]                     = useState(false)
  const [globalError, setGlobalError]           = useState('')

  // Materiały — faza 2 (nowy wpis) lub sekcja inline (edycja)
  const [phase, setPhase]               = useState<'entry' | 'materials'>('entry')
  const [savedEntryId, setSavedEntryId] = useState<string | null>(initialData?.id ?? null)
  const [localMaterials, setLocalMaterials] = useState<EntryMaterial[]>(
    initialData?.materialUsages ?? []
  )
  const [removingId, setRemovingId] = useState<string | null>(null)

  const [editingUsageId, setEditingUsageId] = useState<string | null>(null)
  const [editQty,        setEditQty]        = useState('')
  const [editUnit,       setEditUnit]       = useState('szt')
  const [editNotes,      setEditNotes]      = useState('')
  const [editSaving,     setEditSaving]     = useState(false)

  function startEdit(m: EntryMaterial) {
    setEditingUsageId(m.id)
    setEditQty(String(Number(m.quantity)))
    setEditUnit(m.unit)
    setEditNotes(m.notes ?? '')
  }

  function cancelEdit() { setEditingUsageId(null) }

  async function saveEdit() {
    if (!editingUsageId) return
    const qty = Number(editQty)
    if (!qty || qty <= 0) return
    setEditSaving(true)
    try {
      const res = await materialUsagesApi.update(editingUsageId, {
        quantity: qty,
        unit:     editUnit,
        notes:    editNotes || null,
      })
      const u = res.data.data
      setLocalMaterials(prev => prev.map(m =>
        m.id === editingUsageId
          ? { ...m, quantity: u.quantity, unit: u.unit, notes: u.notes }
          : m
      ))
      setEditingUsageId(null)
    } catch {} finally {
      setEditSaving(false)
    }
  }

  async function removeMaterial(usageId: string) {
    setRemovingId(usageId)
    try {
      await materialUsagesApi.remove(usageId)
      setLocalMaterials(prev => prev.filter(m => m.id !== usageId))
    } catch {} finally {
      setRemovingId(null)
    }
  }

  const qc = useQueryClient()

  const { data: vehiclesData } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => vehiclesApi.getAll().then((r) => r.data.data),
  })
  const vehicles = vehiclesData?.filter((v) => v.isActive) ?? []

  const { data: locationsData } = useQuery({
    queryKey: ['locations'],
    queryFn: () => locationsApi.getAll().then((r) => r.data.data),
  })
  const locations = locationsData ?? []

  const draft = !initialData ? loadDraft() : null

  const { register, handleSubmit, watch, setValue, control, formState: { errors } } = useForm<EntryFormData>({
    resolver: zodResolver(entrySchema),
    defaultValues: initialData
      ? {
          workStart:    initialData.workStart,
          workEnd:      initialData.workEnd,
          locationId:   initialData.location.id,
          departmentId: initialData.department?.id ?? null,
          description:  initialData.description,
          vehicleUsages: initialData.vehicleUsages.map((v) => ({ vehicleId: v.vehicle.id, kmDriven: v.kmDriven })),
        }
      : {
          workStart:    draft?.workStart    ?? '07:00',
          workEnd:      draft?.workEnd      ?? '15:00',
          locationId:   draft?.locationId   ?? 0,
          departmentId: draft?.departmentId ?? null,
          description:  draft?.description  ?? '',
          vehicleUsages: draft?.vehicleUsages ?? [],
        },
  })

  const { fields: vehicleFields, append: appendVehicle, remove: removeVehicle } = useFieldArray({
    control,
    name: 'vehicleUsages',
  })

  useEffect(() => {
    if (initialData) return
    const sub = watch((values) => saveDraft(values))
    return () => sub.unsubscribe()
  }, [watch, initialData])

  const locationId = watch('locationId')

  const { data: deptsData } = useQuery({
    queryKey: ['departments', locationId],
    queryFn:  () => locationId > 0
      ? departmentsApi.list(Number(locationId)).then((r) => r.data.data)
      : Promise.resolve([]),
    enabled: !!locationId && locationId > 0,
  })
  const departments = (deptsData ?? []).filter((d) => d.isActive)

  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    setValue('departmentId', null)
  }, [locationId, setValue])

  const addLocationMutation = useMutation({
    mutationFn: () => locationsApi.create({ name: newLocationName.trim() }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['locations'] })
      setValue('locationId', res.data.data.id, { shouldValidate: true })
      setAddingLocation(false)
      setNewLocationName('')
      setNewLocationError('')
    },
    onError: (err) => {
      setNewLocationError(
        axios.isAxiosError(err) ? err.response?.data?.error ?? 'Błąd serwera' : 'Błąd serwera'
      )
    },
  })

  const addDeptMutation = useMutation({
    mutationFn: () => departmentsApi.create({ locationId: Number(locationId), name: newDeptName.trim() }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['departments', locationId] })
      setValue('departmentId', res.data.data.id, { shouldValidate: true })
      setAddingDept(false)
      setNewDeptName('')
      setNewDeptError('')
    },
    onError: (err) => {
      setNewDeptError(
        axios.isAxiosError(err) ? err.response?.data?.error ?? 'Błąd serwera' : 'Błąd serwera'
      )
    },
  })

  const onSubmit = async (data: EntryFormData) => {
    setSaving(true)
    setGlobalError('')
    try {
      const { entryId } = await onSave(data)
      clearDraft()
      if (initialData) {
        // Edycja — zamknij modal
        onClose()
      } else {
        // Nowy wpis — przejdź do fazy materiałów
        setSavedEntryId(entryId)
        setPhase('materials')
      }
    } catch (err) {
      setGlobalError(
        axios.isAxiosError(err) ? err.response?.data?.error ?? 'Błąd serwera' : 'Błąd serwera'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(12,30,60,0.45)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto"
        style={{
          background: t.surface,
          borderRadius: '20px 20px 0 0',
          boxShadow: '0 -4px 40px rgba(12,30,60,0.18)',
        }}
      >
        {/* Nagłówek */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <h2 className="text-base font-bold" style={{ color: t.ink }}>
              {phase === 'materials' ? 'Materiały zużyte' : initialData ? 'Edytuj wpis' : 'Nowy wpis'}
            </h2>
            {phase === 'entry' && draft && (
              <p className="text-[11px] mt-0.5 font-medium" style={{ color: '#d97706' }}>
                Przywrócono niezapisany szkic
              </p>
            )}
            {phase === 'materials' && (
              <p className="text-[11px] mt-0.5 font-medium" style={{ color: t.inkMuted }}>
                Wpis zapisany — dodaj zużyte materiały (opcjonalnie)
              </p>
            )}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5" style={{ color: t.inkMuted, background: t.border }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Faza 2 — materiały po zapisaniu nowego wpisu */}
        {phase === 'materials' && savedEntryId && (
          <div className="px-5 pb-5 space-y-3">
            {localMaterials.length === 0 && (
              <p className="text-sm text-center py-3" style={{ color: t.inkMuted }}>
                Brak dodanych materiałów
              </p>
            )}
            {localMaterials.length > 0 && (
              <div className="space-y-1.5">
                {localMaterials.map(m => editingUsageId === m.id ? (
                  <div key={m.id} className="rounded-xl px-3 py-2 space-y-2" style={{ background: t.surfaceAlt }}>
                    <span className="text-xs font-medium block" style={{ color: t.ink }}>{m.material.name}</span>
                    <div className="flex gap-2 flex-wrap">
                      <input
                        type="number" value={editQty} onChange={e => setEditQty(e.target.value)}
                        min="0.01" step="any"
                        className="w-20 rounded-lg px-2 py-1 text-xs outline-none"
                        style={{ background: t.surfaceInput, color: t.ink, boxShadow: '0 0 0 1px rgba(12,30,60,0.12)' }}
                      />
                      <select value={editUnit} onChange={e => setEditUnit(e.target.value)}
                        className="rounded-lg px-2 py-1 text-xs outline-none" style={selectStyle}>
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                      <input
                        type="text" value={editNotes} onChange={e => setEditNotes(e.target.value)}
                        placeholder="Uwagi"
                        className="flex-1 min-w-0 rounded-lg px-2 py-1 text-xs outline-none"
                        style={{ background: t.surfaceInput, color: t.ink, boxShadow: '0 0 0 1px rgba(12,30,60,0.12)' }}
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button type="button" onClick={cancelEdit}
                        className="text-xs px-3 py-1 rounded-lg"
                        style={{ color: t.inkMuted, background: t.border }}>
                        Anuluj
                      </button>
                      <button type="button" onClick={saveEdit} disabled={editSaving}
                        className="text-xs px-3 py-1 rounded-lg disabled:opacity-40"
                        style={{ color: '#fff', background: '#2761eb' }}>
                        {editSaving ? '...' : 'Zapisz'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div key={m.id} className="flex items-center gap-2 text-xs rounded-xl px-3 py-2"
                    style={{ background: t.surfaceAlt }}>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium truncate block" style={{ color: t.ink }}>{m.material.name}</span>
                      {m.material.catalogNumber && (
                        <span style={{ color: t.inkMuted }}>{m.material.catalogNumber}</span>
                      )}
                    </div>
                    <span className="shrink-0 font-semibold" style={{ color: t.blue.text }}>
                      {Number(m.quantity).toLocaleString('pl-PL')} {m.unit}
                    </span>
                    {(isAdmin() || m.user?.id === user?.id) && (
                      <>
                        <button type="button" onClick={() => startEdit(m)}
                          className="shrink-0 rounded-lg p-1"
                          style={{ color: '#2761eb', background: 'rgba(39,97,235,0.08)' }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => removeMaterial(m.id)}
                          disabled={removingId === m.id}
                          className="shrink-0 rounded-lg p-1 disabled:opacity-40"
                          style={{ color: '#f43f5e', background: 'rgba(244,63,94,0.07)' }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
            <AddMaterialPanel
              entryId={savedEntryId}
              onAdded={(usage) => setLocalMaterials(prev => [...prev, usage])}
            />
            <Button type="button" size="lg" onClick={onClose} className="w-full">
              <Check className="h-4 w-4 mr-1.5" />
              Gotowe
            </Button>
          </div>
        )}

        {/* Faza 1 — formularz wpisu */}
        {phase === 'entry' && (
        <>
        <form onSubmit={handleSubmit(onSubmit)} className="px-5 pb-5 space-y-4">

          {/* Godziny */}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Godzina od" type="time" disabled={locked} {...register('workStart')} error={errors.workStart?.message} />
            <Input label="Godzina do" type="time" disabled={locked} {...register('workEnd')} error={errors.workEnd?.message} />
          </div>

          {/* Lokalizacja */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" style={{ color: t.inkMuted }}>Lokalizacja</label>
            <>
              <select
                disabled={locked}
                value={watch('locationId') ?? ''}
                onChange={e => setValue('locationId', Number(e.target.value), { shouldValidate: true })}
                style={{
                  ...selectStyle,
                  boxShadow: errors.locationId ? '0 0 0 2.5px rgba(244,63,94,0.40)' : selectStyle.boxShadow,
                }}
              >
                <option value="0">— wybierz lokalizację —</option>
                {locations.filter((l) => l.isActive).map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
              {errors.locationId && (
                <p className="text-[12.5px] font-medium" style={{ color: '#f43f5e' }}>{errors.locationId.message}</p>
              )}
              {!locked && !addingLocation && (
                <button type="button" onClick={() => setAddingLocation(true)}
                  className="text-xs font-medium text-left" style={{ color: t.blue.text }}>
                  + Dodaj nową lokalizację
                </button>
              )}
              {addingLocation && (
                <div className="rounded-xl p-3 space-y-2"
                  style={{ background: t.blue.bg, boxShadow: `0 0 0 1px ${t.blue.ring}` }}>
                  <p className="text-xs font-semibold" style={{ color: t.ink }}>Nowa lokalizacja</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newLocationName}
                      onChange={(e) => { setNewLocationName(e.target.value); setNewLocationError('') }}
                      placeholder="np. Zakład Główny"
                      className="flex-1 rounded-lg px-3 py-2 text-[15px] sm:text-sm outline-none"
                      style={{ background: t.surfaceInput, color: t.ink, boxShadow: '0 0 0 1px rgba(12,30,60,0.12)' }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); if (newLocationName.trim().length >= 2) addLocationMutation.mutate() }
                        if (e.key === 'Escape') { setAddingLocation(false); setNewLocationName(''); setNewLocationError('') }
                      }}
                      autoFocus
                    />
                    <button type="button"
                      onClick={() => { if (newLocationName.trim().length < 2) { setNewLocationError('Min. 2 znaki'); return } addLocationMutation.mutate() }}
                      disabled={addLocationMutation.isPending}
                      className="rounded-lg px-3 py-2 text-sm font-semibold" style={{ background: '#2761eb', color: '#fff' }}>
                      {addLocationMutation.isPending ? '…' : <Check className="h-4 w-4" />}
                    </button>
                    <button type="button"
                      onClick={() => { setAddingLocation(false); setNewLocationName(''); setNewLocationError('') }}
                      className="rounded-lg px-2 py-2 text-sm" style={{ color: t.inkMuted, background: t.border }}>
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  {newLocationError && (
                    <p className="text-[12px] font-medium" style={{ color: '#f43f5e' }}>{newLocationError}</p>
                  )}
                </div>
              )}
            </>
          </div>

          {/* Wydział (zależny od lokalizacji) */}
          {locationId > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: t.inkMuted }}>
                Wydział <span style={{ color: t.inkMuted, fontWeight: 400 }}>(opcjonalnie)</span>
              </label>
              <select
                disabled={locked}
                value={watch('departmentId') ?? ''}
                onChange={e => setValue('departmentId', e.target.value ? Number(e.target.value) : null, { shouldValidate: true })}
                style={selectStyle}
              >
                <option value="">— brak wydziału —</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              {!locked && !addingDept && (
                <button type="button" onClick={() => setAddingDept(true)}
                  className="text-xs font-medium text-left" style={{ color: t.blue.text }}>
                  + Dodaj nowy wydział
                </button>
              )}
              {addingDept && (
                <div className="rounded-xl p-3 space-y-2"
                  style={{ background: t.blue.bg, boxShadow: `0 0 0 1px ${t.blue.ring}` }}>
                  <p className="text-xs font-semibold" style={{ color: t.ink }}>Nowy wydział</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newDeptName}
                      onChange={(e) => { setNewDeptName(e.target.value); setNewDeptError('') }}
                      placeholder="np. Wydział UHT"
                      className="flex-1 rounded-lg px-3 py-2 text-[15px] sm:text-sm outline-none"
                      style={{ background: t.surfaceInput, color: t.ink, boxShadow: '0 0 0 1px rgba(12,30,60,0.12)' }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); if (newDeptName.trim().length >= 2) addDeptMutation.mutate() }
                        if (e.key === 'Escape') { setAddingDept(false); setNewDeptName(''); setNewDeptError('') }
                      }}
                      autoFocus
                    />
                    <button type="button"
                      onClick={() => { if (newDeptName.trim().length < 2) { setNewDeptError('Min. 2 znaki'); return } addDeptMutation.mutate() }}
                      disabled={addDeptMutation.isPending}
                      className="rounded-lg px-3 py-2 text-sm font-semibold" style={{ background: '#2761eb', color: '#fff' }}>
                      {addDeptMutation.isPending ? '…' : <Check className="h-4 w-4" />}
                    </button>
                    <button type="button"
                      onClick={() => { setAddingDept(false); setNewDeptName(''); setNewDeptError('') }}
                      className="rounded-lg px-2 py-2 text-sm" style={{ color: t.inkMuted, background: t.border }}>
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  {newDeptError && (
                    <p className="text-[12px] font-medium" style={{ color: '#f43f5e' }}>{newDeptError}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Opis */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" style={{ color: t.inkMuted }}>
              Co udało się zrobić?
            </label>
            <textarea
              placeholder="Opisz wykonane prace, postęp, uwagi..."
              rows={3}
              disabled={locked}
              {...register('description')}
              className="w-full rounded-xl resize-none text-[16px] sm:text-sm outline-none transition-all duration-150"
              style={{
                background: t.surfaceInput, color: t.ink,
                padding: '0.75rem 1rem',
                boxShadow: '0 0 0 1px rgba(12,30,60,0.10), inset 0 1px 3px rgba(12,30,60,0.06)',
              }}
              onFocus={(e) => { e.currentTarget.style.boxShadow = '0 0 0 3px rgba(39,97,235,0.28)' }}
              onBlur={(e) => { e.currentTarget.style.boxShadow = '0 0 0 1px rgba(12,30,60,0.10), inset 0 1px 3px rgba(12,30,60,0.06)' }}
            />
            {errors.description && (
              <p className="text-[12.5px] font-medium" style={{ color: '#f43f5e' }}>{errors.description.message}</p>
            )}
          </div>

          {/* Pojazdy (opcjonalne, wiele) */}
          <div className="rounded-xl p-3 space-y-2" style={{ background: t.blue.bg, boxShadow: `0 0 0 1px ${t.blue.ring}` }}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium" style={{ color: t.ink }}>
                <Car className="h-4 w-4 inline mr-1.5" style={{ color: t.inkDim }} />
                Pojazdy służbowe
              </span>
              {!locked && (
                <button
                  type="button"
                  onClick={() => appendVehicle({ vehicleId: 0, kmDriven: 0 })}
                  className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg"
                  style={{ background: '#2761eb', color: '#fff' }}
                >
                  <Plus className="h-3.5 w-3.5" /> Dodaj pojazd
                </button>
              )}
            </div>

            {vehicleFields.length === 0 && (
              <p className="text-xs" style={{ color: t.inkMuted }}>Brak — kliknij "Dodaj pojazd" jeśli używano auta</p>
            )}

            {vehicleFields.map((field, idx) => {
              const noVehicle = Number(watch(`vehicleUsages.${idx}.vehicleId`) ?? 0) === 0
              return (
              <div key={field.id} className="flex gap-2 items-start">
                <div className="flex-1 space-y-1.5">
                  <select
                    disabled={locked}
                    {...register(`vehicleUsages.${idx}.vehicleId` as const, {
                      onChange: (e: React.ChangeEvent<HTMLSelectElement>) => {
                        if (Number(e.target.value) === 0) setValue(`vehicleUsages.${idx}.kmDriven`, 0)
                      },
                    })}
                    className="w-full appearance-none rounded-xl px-3 py-2 text-[16px] sm:text-sm outline-none"
                    style={{
                      background: t.surfaceInput, color: t.ink,
                      boxShadow: errors.vehicleUsages?.[idx]?.vehicleId
                        ? '0 0 0 2px rgba(244,63,94,0.40)' : '0 0 0 1px rgba(12,30,60,0.10)',
                    }}
                  >
                    <option value={0}>-- wybierz pojazd --</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>{v.plateNumber} — {v.name}</option>
                    ))}
                  </select>
                  {errors.vehicleUsages?.[idx]?.vehicleId && (
                    <p className="text-[12px] font-medium" style={{ color: '#f43f5e' }}>
                      {errors.vehicleUsages[idx]?.vehicleId?.message}
                    </p>
                  )}
                </div>
                <div className="w-24 space-y-1.5">
                  <input
                    type="number"
                    min={0}
                    disabled={locked || noVehicle}
                    placeholder="km"
                    {...register(`vehicleUsages.${idx}.kmDriven` as const)}
                    className="w-full rounded-xl px-3 py-2 text-[16px] sm:text-sm outline-none"
                    style={{
                      background: t.surfaceInput, color: t.ink,
                      opacity: noVehicle ? 0.4 : 1,
                      boxShadow: errors.vehicleUsages?.[idx]?.kmDriven
                        ? '0 0 0 2px rgba(244,63,94,0.40)' : '0 0 0 1px rgba(12,30,60,0.10)',
                    }}
                  />
                </div>
                {!locked && (
                  <button
                    type="button"
                    onClick={() => removeVehicle(idx)}
                    className="mt-1.5 rounded-xl p-2 shrink-0"
                    style={{ color: '#f43f5e', background: 'rgba(244,63,94,0.07)' }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              )
            })}
          </div>

          {/* Materiały przy edycji wpisu */}
          {initialData && savedEntryId && !locked && (
            <div className="border-t pt-3" style={{ borderColor: t.border }}>
              <div className="flex items-center gap-2 mb-2">
                <Package className="h-4 w-4" style={{ color: t.blue.text }} />
                <span className="text-sm font-semibold" style={{ color: t.ink }}>Materiały zużyte</span>
              </div>
              {localMaterials.length === 0 && (
                <p className="text-xs mb-2" style={{ color: t.inkMuted }}>Brak materiałów — dodaj poniżej</p>
              )}
              {localMaterials.length > 0 && (
                <div className="space-y-1.5 mb-3">
                  {localMaterials.map(m => editingUsageId === m.id ? (
                    <div key={m.id} className="rounded-xl px-3 py-2 space-y-2" style={{ background: t.surfaceAlt }}>
                      <span className="text-xs font-medium block" style={{ color: t.ink }}>{m.material.name}</span>
                      <div className="flex gap-2 flex-wrap">
                        <input
                          type="number" value={editQty} onChange={e => setEditQty(e.target.value)}
                          min="0.01" step="any"
                          className="w-20 rounded-lg px-2 py-1 text-xs outline-none"
                          style={{ background: t.surfaceInput, color: t.ink, boxShadow: '0 0 0 1px rgba(12,30,60,0.12)' }}
                        />
                        <select value={editUnit} onChange={e => setEditUnit(e.target.value)}
                          className="rounded-lg px-2 py-1 text-xs outline-none" style={selectStyle}>
                          {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                        <input
                          type="text" value={editNotes} onChange={e => setEditNotes(e.target.value)}
                          placeholder="Uwagi"
                          className="flex-1 min-w-0 rounded-lg px-2 py-1 text-xs outline-none"
                          style={{ background: t.surfaceInput, color: t.ink, boxShadow: '0 0 0 1px rgba(12,30,60,0.12)' }}
                        />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button type="button" onClick={cancelEdit}
                          className="text-xs px-3 py-1 rounded-lg"
                          style={{ color: t.inkMuted, background: t.border }}>
                          Anuluj
                        </button>
                        <button type="button" onClick={saveEdit} disabled={editSaving}
                          className="text-xs px-3 py-1 rounded-lg disabled:opacity-40"
                          style={{ color: '#fff', background: '#2761eb' }}>
                          {editSaving ? '...' : 'Zapisz'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div key={m.id} className="flex items-center gap-2 text-xs rounded-xl px-3 py-2"
                      style={{ background: t.surfaceAlt }}>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium truncate block" style={{ color: t.ink }}>{m.material.name}</span>
                        {m.material.catalogNumber && (
                          <span style={{ color: t.inkMuted }}>{m.material.catalogNumber}</span>
                        )}
                      </div>
                      <span className="shrink-0 font-semibold" style={{ color: t.blue.text }}>
                        {Number(m.quantity).toLocaleString('pl-PL')} {m.unit}
                      </span>
                      {(isAdmin() || m.user?.id === user?.id) && (
                        <>
                          <button type="button" onClick={() => startEdit(m)}
                            className="shrink-0 rounded-lg p-1"
                            style={{ color: '#2761eb', background: 'rgba(39,97,235,0.08)' }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={() => removeMaterial(m.id)}
                            disabled={removingId === m.id}
                            className="shrink-0 rounded-lg p-1 disabled:opacity-40"
                            style={{ color: '#f43f5e', background: 'rgba(244,63,94,0.07)' }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <AddMaterialPanel
                entryId={savedEntryId}
                onAdded={(usage) => setLocalMaterials(prev => [...prev, usage])}
              />
            </div>
          )}

          {globalError && (
            <div className="rounded-xl px-4 py-3 text-sm font-medium"
              style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.20)', color: '#be123c' }}>
              {globalError}
            </div>
          )}

          {!locked && (
            <Button type="submit" size="lg" loading={saving} className="w-full">
              {initialData ? 'Zapisz zmiany' : 'Zapisz wpis'}
            </Button>
          )}
        </form>
        </>
        )}
      </div>
    </div>
  )
}

// ── Panel dodawania materiału ─────────────────────────────────────────────────

function MaterialListItem({ m, onSelect }: { m: Material; onSelect: (m: Material) => void }) {
  const t = useTheme()
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      onClick={() => onSelect(m)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="w-full text-left px-4 py-2.5 text-sm transition-colors border-b last:border-0"
      style={{ color: t.ink, borderColor: t.border, background: hovered ? t.blue.bg : 'transparent' }}
    >
      <span className="font-medium">{m.name}</span>
      {m.catalogNumber && (
        <span className="ml-2 text-xs" style={{ color: t.inkMuted }}>{m.catalogNumber}</span>
      )}
    </button>
  )
}

const UNITS = ['szt', 'm', 'mb', 'kg', 'kpl', 'rolka', 'opak', 'l', 'para', 'cm', 'g']

function AddMaterialPanel({
  entryId,
  onAdded,
}: {
  entryId: string
  onAdded: (usage: EntryMaterial) => void
}) {
  const t = useTheme()
  const selectStyle = makeSelectStyle(t)

  const [query, setQuery]           = useState('')
  const [selected, setSelected]     = useState<Material | null>(null)
  const [quantity, setQuantity]     = useState('')
  const [unit, setUnit]             = useState('szt')
  const [notes, setNotes]           = useState('')
  const [lowStock, setLowStock]     = useState(false)
  const [photo, setPhoto]           = useState<File | null>(null)
  const [photoLoading, setPhotoLoading] = useState(false)
  const [alertNote, setAlertNote]   = useState('')
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const { data: searchResults } = useQuery({
    queryKey: ['materials-search', query],
    queryFn:  () => materialsApi.search(query || undefined).then((r) => r.data.data),
    staleTime: 10000,
  })
  const materials = searchResults ?? []

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoLoading(true)
    try {
      const compressed = await compressImage(file)
      setPhoto(compressed)
    } catch {
      setError('Nie udało się przetworzyć zdjęcia')
    } finally {
      setPhotoLoading(false)
    }
  }

  const handleAdd = async () => {
    if (!selected) { setError('Wybierz materiał'); return }
    if (!quantity || Number(quantity) <= 0) { setError('Podaj ilość'); return }
    setSaving(true)
    setError('')
    try {
      const res = await materialUsagesApi.create({
        entryId,
        materialId: selected.id,
        quantity:   Number(quantity),
        unit,
        notes:      notes || undefined,
      })
      if (lowStock) {
        await materialAlertsApi.create({
          materialId: selected.id,
          notes:      alertNote || undefined,
          photo:      photo ?? undefined,
        })
      }
      const u = res.data.data
      setSelected(null)
      setQuery('')
      setQuantity('')
      setNotes('')
      setLowStock(false)
      setPhoto(null)
      setAlertNote('')
      onAdded({
        id:         u.id,
        materialId: u.materialId,
        material:   u.material,
        user:       u.user,
        quantity:   u.quantity,
        unit:       u.unit,
        notes:      u.notes,
        usedAt:     u.usedAt,
      })
    } catch (err) {
      setError(axios.isAxiosError(err) ? err.response?.data?.error ?? 'Błąd serwera' : 'Błąd serwera')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      {/* Wyszukiwarka */}
      {!selected ? (
        <div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Szukaj materiału (min. 3 znaki) lub ostatnio używane..."
            className="w-full rounded-xl px-3 py-2 text-[15px] outline-none"
            style={{
              background: t.surfaceInput, color: t.ink,
              boxShadow: '0 0 0 1px rgba(12,30,60,0.12)', fontSize: 15,
            }}
            onFocus={(e) => { e.currentTarget.style.boxShadow = '0 0 0 2px rgba(39,97,235,0.30)' }}
            onBlur={(e)  => { e.currentTarget.style.boxShadow = '0 0 0 1px rgba(12,30,60,0.10)' }}
          />
          {materials.length > 0 && (
            <div className="mt-1 max-h-48 overflow-y-auto rounded-xl"
              style={{ background: t.surfaceAlt, boxShadow: t.cardShadow }}>
              {materials.map((m) => (
                <MaterialListItem
                  key={m.id}
                  m={m}
                  onSelect={(mat) => { setSelected(mat); setQuery(mat.name) }}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-xl px-3 py-2"
          style={{ background: t.blue.bg, boxShadow: `0 0 0 1px ${t.blue.ring}` }}>
          <div>
            <p className="text-sm font-semibold" style={{ color: t.ink }}>{selected.name}</p>
            {selected.catalogNumber && (
              <p className="text-xs" style={{ color: t.inkMuted }}>{selected.catalogNumber}</p>
            )}
          </div>
          <button onClick={() => { setSelected(null); setQuery('') }}
            className="rounded-lg p-1" style={{ color: t.inkMuted }}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {selected && (
        <>
          {/* Ilość + jednostka */}
          <div className="flex gap-2">
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Ilość"
              min={0}
              step="any"
              className="flex-1 rounded-xl px-3 py-2 text-[15px] outline-none"
              style={{ background: t.surfaceInput, color: t.ink, boxShadow: '0 0 0 1px rgba(12,30,60,0.12)', fontSize: 15 }}
            />
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              style={{ ...selectStyle, width: 'auto', minWidth: 80 }}
            >
              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>

          {/* Uwagi */}
          <input
            type="text"
            placeholder="Uwagi (opcjonalnie)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-xl px-3 py-2 text-sm outline-none"
            style={{ background: t.surfaceInput, color: t.ink, boxShadow: '0 0 0 1px rgba(12,30,60,0.12)', fontSize: 15 }}
          />

          {/* Alert niskiego stanu */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="lowstock-entry"
              checked={lowStock}
              onChange={(e) => setLowStock(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="lowstock-entry" className="text-sm font-medium flex items-center gap-1.5"
              style={{ color: t.amber.text }}>
              <AlertTriangle className="h-3.5 w-3.5" />
              Zgłoś niski stan
            </label>
          </div>

          {lowStock && (
            <div className="rounded-xl p-3 space-y-2"
              style={{ background: t.amber.bg, boxShadow: `0 0 0 1px rgba(217,119,6,0.25)` }}>
              <p className="text-xs font-semibold" style={{ color: t.amber.text }}>
                Zdjęcie (zalecane)
                {!selected.photoUrl && (
                  <span className="ml-1 font-normal opacity-75">— stanie się zdjęciem materiału</span>
                )}
              </p>
              <input ref={fileRef} type="file" accept="image/*" capture="environment"
                className="hidden" onChange={handleFileChange} />
              {photoLoading ? (
                <div className="flex items-center gap-2 text-xs font-medium" style={{ color: t.amber.text }}>
                  <div className="animate-spin h-4 w-4 border-2 rounded-full"
                    style={{ borderColor: t.amber.text, borderTopColor: 'transparent' }} />
                  Kompresowanie…
                </div>
              ) : photo ? (
                <div className="flex items-center gap-2">
                  <img src={URL.createObjectURL(photo)} alt="podgląd"
                    style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8 }} />
                  <button className="text-xs underline" style={{ color: t.amber.text }}
                    onClick={() => setPhoto(null)}>usuń</button>
                </div>
              ) : (
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium w-full justify-center"
                  style={{ background: t.amber.bg, border: '1.5px dashed rgba(217,119,6,0.35)', color: t.amber.text }}>
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
                style={{ background: t.surfaceAlt, border: '1px solid rgba(217,119,6,0.22)', color: t.ink, fontSize: 15 }}
              />
            </div>
          )}
        </>
      )}

      {error && (
        <p className="text-[12.5px] font-medium" style={{ color: '#f43f5e' }}>{error}</p>
      )}

      {selected && (
        <Button size="sm" onClick={handleAdd} loading={saving} className="w-full">
          <Plus className="h-4 w-4 mr-1" />
          Dodaj pobranie{lowStock ? ' + alert' : ''}
        </Button>
      )}
    </div>
  )
}

// ── Karta pojedynczego wpisu ─────────────────────────────────────────────────

function EntryCard({
  entry,
  locked,
  onEdit,
  onDelete,
  onMaterialAdded,
}: {
  entry: ReportEntry
  locked: boolean
  onEdit: () => void
  onDelete: () => void
  onMaterialAdded: () => void
}) {
  const t = useTheme()
  const mins = calcMins(entry.workStart, entry.workEnd)
  const [showMaterialPanel, setShowMaterialPanel] = useState(false)
  const mats = entry.materialUsages ?? []

  return (
    <div
      className="rounded-2xl p-4 relative"
      style={{ background: t.surfaceAlt, boxShadow: t.cardShadow }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">

          {/* Godziny + czas */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1 text-sm font-bold" style={{ color: t.ink }}>
              <Clock className="h-3.5 w-3.5" style={{ color: t.blue.text }} />
              {entry.workStart}–{entry.workEnd}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: t.blue.bg, color: t.blue.text }}>
              {formatMins(mins)}
            </span>
          </div>

          {/* Lokalizacja + Wydział */}
          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
            <MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: t.inkDim }} />
            <span className="text-sm font-medium" style={{ color: t.ink }}>{entry.location.name}</span>
            {entry.department && (
              <>
                <span className="text-xs" style={{ color: t.inkMuted }}>›</span>
                <span className="text-sm" style={{ color: t.ink }}>
                  <Building2 className="h-3 w-3 inline mr-0.5" style={{ color: t.inkMuted }} />
                  {entry.department.name}
                </span>
              </>
            )}
          </div>

          {/* Opis */}
          <p className="mt-1.5 text-xs line-clamp-2" style={{ color: t.inkMuted }}>
            {entry.description}
          </p>

          {/* Pojazdy */}
          {entry.vehicleUsages.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {entry.vehicleUsages.map((vu) => (
                <div key={vu.id} className="flex items-center gap-1.5 text-xs rounded-lg px-2 py-1"
                  style={{ background: t.blue.bg, color: t.blue.text }}>
                  <Car className="h-3.5 w-3.5" />
                  <span className="font-medium">{vu.vehicle.plateNumber}</span>
                  <span style={{ color: t.inkDim }}>{vu.kmDriven} km</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Edycja — prawy górny róg */}
        {!locked && (
          <button onClick={onEdit}
            className="rounded-xl p-2 transition-colors shrink-0"
            style={{ color: t.blue.text, background: t.blue.bg }}>
            <Pencil className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Materiały przypisane do wpisu */}
      {mats.length > 0 && (
        <div className="mt-3 pt-3 border-t" style={{ borderColor: t.border }}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Package className="h-3.5 w-3.5" style={{ color: t.inkMuted }} />
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: t.inkMuted }}>
              Materiały ({mats.length})
            </span>
          </div>
          <div className="space-y-1">
            {mats.map((m) => (
              <div key={m.id} className="flex items-center justify-between text-xs rounded-lg px-2.5 py-1.5"
                style={{ background: t.surface }}>
                <div className="flex-1 min-w-0">
                  <span className="font-medium truncate block" style={{ color: t.ink }}>{m.material.name}</span>
                  {m.material.catalogNumber && (
                    <span style={{ color: t.inkMuted }}>{m.material.catalogNumber}</span>
                  )}
                  {m.notes && <span className="ml-2" style={{ color: t.inkMuted }}>· {m.notes}</span>}
                </div>
                <span className="shrink-0 ml-2 font-semibold" style={{ color: t.blue.text }}>
                  {Number(m.quantity).toLocaleString('pl-PL')} {m.unit}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dodaj materiał do wpisu */}
      {!locked && (
        <div className="mt-3">
          {showMaterialPanel ? (
            <div className="pt-3 border-t" style={{ borderColor: t.border }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold" style={{ color: t.ink }}>Dodaj materiał do wpisu</span>
                <button onClick={() => setShowMaterialPanel(false)}
                  className="text-xs" style={{ color: t.inkMuted }}>Anuluj</button>
              </div>
              <AddMaterialPanel
                entryId={entry.id}
                onAdded={() => {
                  setShowMaterialPanel(false)
                  onMaterialAdded()
                }}
              />
            </div>
          ) : (
            <button
              onClick={() => setShowMaterialPanel(true)}
              className="flex items-center gap-1.5 text-xs font-semibold rounded-lg px-2.5 py-1.5 transition-colors"
              style={{ background: t.surface, color: t.inkMuted }}
            >
              <Package className="h-3.5 w-3.5" />
              + Dodaj materiał
            </button>
          )}
        </div>
      )}

      {/* Usuwanie — prawy dolny róg (tylko gdy panel zamknięty) */}
      {!locked && !showMaterialPanel && (
        <button
          onClick={onDelete}
          className="absolute bottom-3 right-3 rounded-xl p-1.5 transition-colors"
          style={{ color: '#f43f5e', background: 'rgba(244,63,94,0.07)' }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

// ── Nowy wpis — pełnoekranowy formularz ──────────────────────────────────────

function NewReportPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const t = useTheme()
  const selectStyle = makeSelectStyle(t)

  const todayStr = new Date().toISOString().slice(0, 10)
  const [saving, setSaving]                 = useState(false)
  const [globalError, setGlobalError]       = useState('')
  const [savedEntryId, setSavedEntryId]     = useState<string | null>(null)
  const [savedReportId, setSavedReportId]   = useState<string | null>(null)
  const [localMaterials, setLocalMaterials] = useState<EntryMaterial[]>([])
  const [addingLocation, setAddingLocation] = useState(false)
  const [newLocationName, setNewLocationName] = useState('')
  const [newLocationError, setNewLocationError] = useState('')
  const [addingDept, setAddingDept]         = useState(false)
  const [newDeptName, setNewDeptName]       = useState('')
  const [newDeptError, setNewDeptError]     = useState('')

  const { data: vehiclesData } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => vehiclesApi.getAll().then((r) => r.data.data),
  })
  const vehicles = vehiclesData?.filter((v) => v.isActive) ?? []

  const { data: locationsData } = useQuery({
    queryKey: ['locations'],
    queryFn: () => locationsApi.getAll().then((r) => r.data.data),
  })
  const locations = locationsData ?? []

  const draft = loadDraft()
  const { register, handleSubmit, watch, setValue, control, formState: { errors } } = useForm<EntryFormData>({
    resolver: zodResolver(entrySchema),
    defaultValues: {
      workStart:     draft?.workStart    ?? '07:00',
      workEnd:       draft?.workEnd      ?? '15:00',
      locationId:    draft?.locationId   ?? 0,
      departmentId:  draft?.departmentId ?? null,
      description:   draft?.description  ?? '',
      vehicleUsages: draft?.vehicleUsages ?? [],
    },
  })

  const { fields: vehicleFields, append: appendVehicle, remove: removeVehicle } = useFieldArray({ control, name: 'vehicleUsages' })

  useEffect(() => {
    const sub = watch((values) => saveDraft(values))
    return () => sub.unsubscribe()
  }, [watch])

  const locationId = watch('locationId')

  const { data: deptsData } = useQuery({
    queryKey: ['departments', locationId],
    queryFn:  () => locationId > 0
      ? departmentsApi.list(Number(locationId)).then((r) => r.data.data)
      : Promise.resolve([]),
    enabled: !!locationId && locationId > 0,
  })
  const departments = (deptsData ?? []).filter((d) => d.isActive)

  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    setValue('departmentId', null)
  }, [locationId, setValue])

  const addLocationMutation = useMutation({
    mutationFn: () => locationsApi.create({ name: newLocationName.trim() }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['locations'] })
      setValue('locationId', res.data.data.id, { shouldValidate: true })
      setAddingLocation(false); setNewLocationName(''); setNewLocationError('')
    },
    onError: (err) => { setNewLocationError(axios.isAxiosError(err) ? err.response?.data?.error ?? 'Błąd serwera' : 'Błąd serwera') },
  })

  const addDeptMutation = useMutation({
    mutationFn: () => departmentsApi.create({ locationId: Number(locationId), name: newDeptName.trim() }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['departments', locationId] })
      setValue('departmentId', res.data.data.id, { shouldValidate: true })
      setAddingDept(false); setNewDeptName(''); setNewDeptError('')
    },
    onError: (err) => { setNewDeptError(axios.isAxiosError(err) ? err.response?.data?.error ?? 'Błąd serwera' : 'Błąd serwera') },
  })

  async function onSubmit(data: EntryFormData) {
    setSaving(true); setGlobalError('')
    try {
      const createRes  = await reportsApi.create()
      const reportId   = createRes.data.data.id
      const entryRes   = await reportsApi.addEntry(reportId, {
        workStart:     data.workStart,
        workEnd:       data.workEnd,
        locationId:    data.locationId,
        departmentId:  data.departmentId ?? null,
        description:   data.description,
        vehicleUsages: data.vehicleUsages.filter((v) => v.vehicleId > 0),
      })
      clearDraft()
      qc.invalidateQueries({ queryKey: ['reports'] })
      setSavedReportId(reportId)
      setSavedEntryId(entryRes.data.data.id)
    } catch (err) {
      setGlobalError(axios.isAxiosError(err) ? err.response?.data?.error ?? 'Błąd serwera' : 'Błąd serwera')
    } finally {
      setSaving(false)
    }
  }

  // Faza 2 — wpis zapisany, pokazujemy materiały
  if (savedEntryId && savedReportId) {
    return (
      <div className="animate-fade-in max-w-2xl mx-auto space-y-5 pb-8">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(`/raporty/${savedReportId}`)}
            className="rounded-xl p-2" style={{ color: t.inkDim, background: t.blue.bg }}>
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="page-title">Materiały zużyte</h1>
            <p className="text-[13px] mt-0.5" style={{ color: t.inkMuted }}>
              Wpis zapisany — dodaj zużyte materiały (opcjonalnie)
            </p>
          </div>
        </div>

        <div className="rounded-2xl p-5 space-y-3" style={{ background: t.surface, boxShadow: t.cardShadow }}>
          {localMaterials.length > 0 && (
            <div className="space-y-1.5">
              {localMaterials.map((m) => (
                <div key={m.id} className="flex items-center gap-2 text-xs rounded-xl px-3 py-2"
                  style={{ background: t.surfaceAlt }}>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium truncate block" style={{ color: t.ink }}>{m.material.name}</span>
                    {m.material.catalogNumber && (
                      <span style={{ color: t.inkMuted }}>{m.material.catalogNumber}</span>
                    )}
                  </div>
                  <span className="shrink-0 font-semibold" style={{ color: t.blue.text }}>
                    {Number(m.quantity).toLocaleString('pl-PL')} {m.unit}
                  </span>
                </div>
              ))}
            </div>
          )}
          <AddMaterialPanel
            entryId={savedEntryId}
            onAdded={(usage) => setLocalMaterials((prev) => [...prev, usage])}
          />
        </div>

        <Button size="lg" className="w-full" onClick={() => navigate(`/raporty/${savedReportId}`)}>
          <Check className="h-4 w-4 mr-1.5" />
          Gotowe
        </Button>
      </div>
    )
  }

  return (
    <div className="animate-fade-in max-w-2xl mx-auto space-y-5 pb-8">

      <div className="flex items-center gap-3">
        <button onClick={() => { clearDraft(); navigate('/raporty') }}
          className="rounded-xl p-2" style={{ color: t.inkDim, background: t.blue.bg }}>
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="page-title">Nowy wpis</h1>
      </div>

      {draft && (
        <div className="rounded-xl px-4 py-2 text-sm font-medium"
          style={{ background: 'rgba(217,119,6,0.08)', color: '#d97706' }}>
          Przywrócono niezapisany szkic
        </div>
      )}

      {/* Formularz wpisu */}
      <div className="rounded-2xl p-5" style={{ background: t.surface, boxShadow: t.cardShadow }}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

          <div className="grid grid-cols-2 gap-3">
            <Input label="Godzina od" type="time" {...register('workStart')} error={errors.workStart?.message} />
            <Input label="Godzina do" type="time" {...register('workEnd')}   error={errors.workEnd?.message} />
          </div>

          {/* Lokalizacja */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" style={{ color: t.inkMuted }}>Lokalizacja</label>
            <select
              value={watch('locationId') ?? ''}
              onChange={(e) => setValue('locationId', Number(e.target.value), { shouldValidate: true })}
              style={{ ...selectStyle, boxShadow: errors.locationId ? '0 0 0 2.5px rgba(244,63,94,0.40)' : selectStyle.boxShadow }}
            >
              <option value="0">— wybierz lokalizację —</option>
              {locations.filter((l) => l.isActive).map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
            {errors.locationId && (
              <p className="text-[12.5px] font-medium" style={{ color: '#f43f5e' }}>{errors.locationId.message}</p>
            )}
            {!addingLocation && (
              <button type="button" onClick={() => setAddingLocation(true)}
                className="text-xs font-medium text-left" style={{ color: t.blue.text }}>
                + Dodaj nową lokalizację
              </button>
            )}
            {addingLocation && (
              <div className="rounded-xl p-3 space-y-2" style={{ background: t.blue.bg, boxShadow: `0 0 0 1px ${t.blue.ring}` }}>
                <p className="text-xs font-semibold" style={{ color: t.ink }}>Nowa lokalizacja</p>
                <div className="flex gap-2">
                  <input type="text" value={newLocationName}
                    onChange={(e) => { setNewLocationName(e.target.value); setNewLocationError('') }}
                    placeholder="np. Zakład Główny" autoFocus
                    className="flex-1 rounded-lg px-3 py-2 text-[15px] sm:text-sm outline-none"
                    style={{ background: t.surfaceInput, color: t.ink, boxShadow: '0 0 0 1px rgba(12,30,60,0.12)' }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); if (newLocationName.trim().length >= 2) addLocationMutation.mutate() }
                      if (e.key === 'Escape') { setAddingLocation(false); setNewLocationName(''); setNewLocationError('') }
                    }}
                  />
                  <button type="button" disabled={addLocationMutation.isPending}
                    onClick={() => { if (newLocationName.trim().length < 2) { setNewLocationError('Min. 2 znaki'); return } addLocationMutation.mutate() }}
                    className="rounded-lg px-3 py-2 text-sm font-semibold" style={{ background: '#2761eb', color: '#fff' }}>
                    {addLocationMutation.isPending ? '…' : <Check className="h-4 w-4" />}
                  </button>
                  <button type="button"
                    onClick={() => { setAddingLocation(false); setNewLocationName(''); setNewLocationError('') }}
                    className="rounded-lg px-2 py-2 text-sm" style={{ color: t.inkMuted, background: t.border }}>
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {newLocationError && <p className="text-[12px] font-medium" style={{ color: '#f43f5e' }}>{newLocationError}</p>}
              </div>
            )}
          </div>

          {/* Wydział */}
          {locationId > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: t.inkMuted }}>
                Wydział <span style={{ color: t.inkMuted, fontWeight: 400 }}>(opcjonalnie)</span>
              </label>
              <select
                value={watch('departmentId') ?? ''}
                onChange={(e) => setValue('departmentId', e.target.value ? Number(e.target.value) : null, { shouldValidate: true })}
                style={selectStyle}
              >
                <option value="">— brak wydziału —</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              {!addingDept && (
                <button type="button" onClick={() => setAddingDept(true)}
                  className="text-xs font-medium text-left" style={{ color: t.blue.text }}>
                  + Dodaj nowy wydział
                </button>
              )}
              {addingDept && (
                <div className="rounded-xl p-3 space-y-2" style={{ background: t.blue.bg, boxShadow: `0 0 0 1px ${t.blue.ring}` }}>
                  <p className="text-xs font-semibold" style={{ color: t.ink }}>Nowy wydział</p>
                  <div className="flex gap-2">
                    <input type="text" value={newDeptName}
                      onChange={(e) => { setNewDeptName(e.target.value); setNewDeptError('') }}
                      placeholder="np. Wydział UHT" autoFocus
                      className="flex-1 rounded-lg px-3 py-2 text-[15px] sm:text-sm outline-none"
                      style={{ background: t.surfaceInput, color: t.ink, boxShadow: '0 0 0 1px rgba(12,30,60,0.12)' }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); if (newDeptName.trim().length >= 2) addDeptMutation.mutate() }
                        if (e.key === 'Escape') { setAddingDept(false); setNewDeptName(''); setNewDeptError('') }
                      }}
                    />
                    <button type="button" disabled={addDeptMutation.isPending}
                      onClick={() => { if (newDeptName.trim().length < 2) { setNewDeptError('Min. 2 znaki'); return } addDeptMutation.mutate() }}
                      className="rounded-lg px-3 py-2 text-sm font-semibold" style={{ background: '#2761eb', color: '#fff' }}>
                      {addDeptMutation.isPending ? '…' : <Check className="h-4 w-4" />}
                    </button>
                    <button type="button"
                      onClick={() => { setAddingDept(false); setNewDeptName(''); setNewDeptError('') }}
                      className="rounded-lg px-2 py-2 text-sm" style={{ color: t.inkMuted, background: t.border }}>
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  {newDeptError && <p className="text-[12px] font-medium" style={{ color: '#f43f5e' }}>{newDeptError}</p>}
                </div>
              )}
            </div>
          )}

          {/* Opis */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" style={{ color: t.inkMuted }}>Co udało się zrobić?</label>
            <textarea
              placeholder="Opisz wykonane prace, postęp, uwagi..."
              rows={3}
              {...register('description')}
              className="w-full rounded-xl resize-none text-[16px] sm:text-sm outline-none transition-all duration-150"
              style={{ background: t.surfaceInput, color: t.ink, padding: '0.75rem 1rem',
                boxShadow: '0 0 0 1px rgba(12,30,60,0.10), inset 0 1px 3px rgba(12,30,60,0.06)' }}
              onFocus={(e) => { e.currentTarget.style.boxShadow = '0 0 0 3px rgba(39,97,235,0.28)' }}
              onBlur={(e)  => { e.currentTarget.style.boxShadow = '0 0 0 1px rgba(12,30,60,0.10), inset 0 1px 3px rgba(12,30,60,0.06)' }}
            />
            {errors.description && (
              <p className="text-[12.5px] font-medium" style={{ color: '#f43f5e' }}>{errors.description.message}</p>
            )}
          </div>

          {/* Pojazdy */}
          <div className="rounded-xl p-3 space-y-2" style={{ background: t.blue.bg, boxShadow: `0 0 0 1px ${t.blue.ring}` }}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium" style={{ color: t.ink }}>
                <Car className="h-4 w-4 inline mr-1.5" style={{ color: t.inkDim }} />
                Pojazdy służbowe
              </span>
              <button type="button" onClick={() => appendVehicle({ vehicleId: 0, kmDriven: 0 })}
                className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg"
                style={{ background: '#2761eb', color: '#fff' }}>
                <Plus className="h-3.5 w-3.5" /> Dodaj pojazd
              </button>
            </div>
            {vehicleFields.length === 0 && (
              <p className="text-xs" style={{ color: t.inkMuted }}>Brak — kliknij "Dodaj pojazd" jeśli używano auta</p>
            )}
            {vehicleFields.map((field, idx) => {
              const noVehicle = Number(watch(`vehicleUsages.${idx}.vehicleId`) ?? 0) === 0
              return (
              <div key={field.id} className="flex gap-2 items-start">
                <div className="flex-1 space-y-1.5">
                  <select
                    {...register(`vehicleUsages.${idx}.vehicleId` as const, {
                      onChange: (e: React.ChangeEvent<HTMLSelectElement>) => {
                        if (Number(e.target.value) === 0) setValue(`vehicleUsages.${idx}.kmDriven`, 0)
                      },
                    })}
                    className="w-full appearance-none rounded-xl px-3 py-2 text-[16px] sm:text-sm outline-none"
                    style={{ background: t.surfaceInput, color: t.ink,
                      boxShadow: errors.vehicleUsages?.[idx]?.vehicleId ? '0 0 0 2px rgba(244,63,94,0.40)' : '0 0 0 1px rgba(12,30,60,0.10)' }}>
                    <option value={0}>-- wybierz pojazd --</option>
                    {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plateNumber} — {v.name}</option>)}
                  </select>
                </div>
                <div className="w-24">
                  <input type="number" min={0} placeholder="km"
                    disabled={noVehicle}
                    {...register(`vehicleUsages.${idx}.kmDriven` as const)}
                    className="w-full rounded-xl px-3 py-2 text-[16px] sm:text-sm outline-none"
                    style={{ background: t.surfaceInput, color: t.ink, opacity: noVehicle ? 0.4 : 1, boxShadow: '0 0 0 1px rgba(12,30,60,0.10)' }}
                  />
                </div>
                <button type="button" onClick={() => removeVehicle(idx)}
                  className="mt-1.5 rounded-xl p-2 shrink-0"
                  style={{ color: '#f43f5e', background: 'rgba(244,63,94,0.07)' }}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              )
            })}
          </div>

          {globalError && (
            <div className="rounded-xl px-4 py-3 text-sm font-medium"
              style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.20)', color: '#be123c' }}>
              {globalError}
            </div>
          )}

          <Button type="submit" size="lg" loading={saving} className="w-full">
            Zapisz wpis
          </Button>
        </form>
      </div>
    </div>
  )
}

// ── Główna strona raportu ─────────────────────────────────────────────────────

export default function ReportForm() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { isAdmin } = useAuthStore()
  const t = useTheme()

  const isNew = !id || id === 'nowy'

  const [showModal, setShowModal]         = useState(false)
  const [editingEntry, setEditingEntry]   = useState<ReportEntry | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const { data: report, isLoading } = useQuery<Report>({
    queryKey: ['report', id],
    queryFn: () => reportsApi.getById(id!).then((r) => r.data.data),
    enabled: !isNew,
    staleTime: 0,
  })

  const locked = !!report?.isLocked && !isAdmin()

  const deleteMutation = useMutation({
    mutationFn: (entryId: string) => reportsApi.deleteEntry(entryId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['report', report?.id] }),
  })

  const [confirmDeleteReport, setConfirmDeleteReport] = useState(false)
  const deleteReportMut = useMutation({
    mutationFn: () => reportsApi.deleteReport(report!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reports'] })
      navigate('/raporty')
    },
  })

  const approveMut = useMutation({
    mutationFn: (isOffer: 'offer' | 'no_offer' | 'to_quote' | null) => reportsApi.approve(report!.id, isOffer),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['report', report!.id] }),
  })

  const unlockMut = useMutation({
    mutationFn: () => reportsApi.unlock(report!.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['report', report!.id] }),
  })

  const removeSignatureMut = useMutation({
    mutationFn: (signerId: string) => reportsApi.signOff(report!.id, signerId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['report', report!.id] }),
  })

  const [showSignAs, setShowSignAs]   = useState(false)
  const [signAsUserId, setSignAsUserId] = useState('')
  const [signAsErr, setSignAsErr]     = useState('')

  const { data: allUsers } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.getAll().then((r) => r.data.data.filter((u) => u.isActive)),
    enabled: isAdmin(),
  })

  const addSignatureMut = useMutation({
    mutationFn: (targetId: string) => reportsApi.signOnto(report!.id, targetId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['report', report!.id] })
      setShowSignAs(false)
      setSignAsUserId('')
      setSignAsErr('')
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Błąd podpisu'
      setSignAsErr(msg)
    },
  })

  function handleSignAs() {
    if (!signAsUserId) { setSignAsErr('Wybierz pracownika'); return }
    setSignAsErr('')
    addSignatureMut.mutate(signAsUserId)
  }

  function buildPayload(data: EntryFormData) {
    return {
      workStart:     data.workStart,
      workEnd:       data.workEnd,
      locationId:    data.locationId,
      departmentId:  data.departmentId ?? null,
      description:   data.description,
      vehicleUsages: data.vehicleUsages.filter((v) => v.vehicleId > 0),
    }
  }

  async function handleSave(data: EntryFormData): Promise<{ entryId: string }> {
    if (editingEntry) {
      await reportsApi.updateEntry(editingEntry.id, buildPayload(data))
      qc.invalidateQueries({ queryKey: ['report', report!.id] })
      return { entryId: editingEntry.id }
    } else {
      // Dodanie wpisu do raportu bez wpisu (stan awaryjny)
      const entryRes = await reportsApi.addEntry(report!.id, buildPayload(data))
      qc.invalidateQueries({ queryKey: ['report', report!.id] })
      return { entryId: entryRes.data.data.id }
    }
  }

  function handleModalClose() {
    setShowModal(false)
    setEditingEntry(null)
  }

  const totalMins = (report?.entries ?? []).reduce(
    (sum, e) => sum + calcMins(e.workStart, e.workEnd), 0
  )

  if (isNew) return <NewReportPage />

  if (isLoading) return <PageSpinner />
  if (!report)  return <PageSpinner />

  const reportDateLabel = formatDatePL(report.reportDate)

  return (
    <div className="animate-fade-in max-w-2xl mx-auto space-y-5 pb-8">

      {/* Nagłówek */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/raporty')}
          className="rounded-xl p-2 transition-colors"
          style={{ color: t.inkDim, background: t.blue.bg }}>
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="page-title">Raport dnia</h1>
          <p className="text-[13px] mt-0.5 font-medium capitalize" style={{ color: t.inkDim }}>
            {reportDateLabel}
          </p>
          {locked && !isAdmin() && (
            <p className="text-[12px] mt-0.5 font-medium" style={{ color: '#d97706' }}>
              Raport zablokowany — tylko administrator może edytować
            </p>
          )}
          {locked && isAdmin() && (
            <button
              onClick={() => unlockMut.mutate()}
              disabled={unlockMut.isPending}
              className="mt-1 flex items-center gap-1.5 text-[12px] font-semibold px-2 py-1 rounded-lg disabled:opacity-50"
              style={{ background: 'rgba(22,163,74,0.10)', color: '#16a34a' }}
            >
              <LockOpen className="h-3.5 w-3.5" />
              Odblokuj na 24h
            </button>
          )}
          {!locked && report?.unlockedUntil && new Date(report.unlockedUntil) > new Date() && (
            <p className="text-[12px] mt-0.5 font-medium" style={{ color: '#16a34a' }}>
              Odblokowany do {new Date(report.unlockedUntil).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
        {report.entries.length > 0 && (
          <div className="text-right shrink-0">
            <p className="text-xs font-medium" style={{ color: t.inkMuted }}>Łącznie</p>
            <p className="text-lg font-bold" style={{ color: t.blue.text }}>{formatMins(totalMins)}</p>
          </div>
        )}
      </div>

      {/* Wpis */}
      <div className="space-y-3">
        {report.entries.length === 0 ? (
          <div className="rounded-2xl p-8 text-center"
            style={{ background: t.surface, boxShadow: t.cardShadow }}>
            <Clock className="h-9 w-9 mx-auto mb-3" style={{ color: t.inkMuted }} />
            <p className="font-semibold" style={{ color: t.ink }}>Brak wpisu</p>
            <p className="text-sm mt-1" style={{ color: t.inkDim }}>
              Raport nie ma jeszcze wpisu.
            </p>
            <div className="flex items-center justify-center gap-3 mt-4 flex-wrap">
              {!locked && (
                <button
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold"
                  style={{ background: t.blue.text, color: '#fff', border: 'none', cursor: 'pointer' }}
                  onClick={() => { setEditingEntry(null); setShowModal(true) }}
                >
                  <Plus className="h-4 w-4" />
                  Dodaj wpis
                </button>
              )}
              {isAdmin() && (
                <button
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold"
                  style={{ background: 'rgba(220,38,38,0.08)', color: '#dc2626', border: 'none', cursor: 'pointer' }}
                  onClick={() => setConfirmDeleteReport(true)}
                >
                  <Trash2 className="h-4 w-4" />
                  Usuń pusty raport
                </button>
              )}
            </div>
          </div>
        ) : (
          report.entries.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              locked={locked}
              onEdit={() => { setEditingEntry(entry); setShowModal(true) }}
              onDelete={() => setConfirmDeleteId(entry.id)}
              onMaterialAdded={() => qc.invalidateQueries({ queryKey: ['report', report.id] })}
            />
          ))
        )}
        {!locked && report.entries.length > 0 && (
          <button
            className="w-full rounded-2xl py-3 text-sm font-semibold flex items-center justify-center gap-2"
            style={{ background: t.surfaceMuted, color: t.inkMuted, border: 'none', cursor: 'pointer' }}
            onClick={() => { setEditingEntry(null); setShowModal(true) }}
          >
            <Plus className="h-4 w-4" />
            Dodaj wpis
          </button>
        )}
      </div>

      {/* Sprzęt powiązany z raportem */}
      {(report.equipmentRentals?.length ?? 0) > 0 && (
        <div className="rounded-2xl p-4"
          style={{ background: t.surface, boxShadow: t.cardShadow }}>
          <div className="flex items-center gap-2 mb-3">
            <Wrench className="h-4 w-4" style={{ color: t.blue.text }} />
            <p className="section-label">Sprzęt ({report.equipmentRentals?.length ?? 0})</p>
          </div>
          <div className="space-y-2">
            {(report.equipmentRentals ?? []).map((r) => (
              <div key={r.id} className="flex items-start gap-3">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg mt-0.5"
                  style={{
                    background: r.returnedAt
                      ? (t.dark ? 'rgba(255,255,255,0.08)' : 'rgba(12,30,60,0.08)')
                      : 'linear-gradient(150deg, #10b981, #059669)',
                    color: r.returnedAt ? t.inkMuted : '#d1fae5',
                  }}
                >
                  <Wrench style={{ height: 14, width: 14 }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: t.ink }}>{r.item.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: t.inkDim }}>
                    {r.item.category.name}
                    <span style={{ color: t.inkMuted }}> · </span>
                    <MapPin className="inline" style={{ height: 10, width: 10 }} />
                    {' '}{r.location.name}
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: r.returnedAt ? t.inkMuted : t.green.text }}>
                    {r.returnedAt
                      ? `Zwrócono: ${new Date(r.returnedAt).toLocaleDateString('pl-PL')}`
                      : 'Aktywne wypożyczenie'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Panel podpisów */}
      {(report.signatures.length > 0 || isAdmin()) && (
        <div className="rounded-2xl p-4"
          style={{ background: t.surface, boxShadow: t.cardShadow }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" style={{ color: t.blue.text }} />
              <p className="section-label">Podpisy</p>
            </div>
            {isAdmin() && (
              <button
                onClick={() => { setShowSignAs((v) => !v); setSignAsErr('') }}
                className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                style={{ background: t.blue.bg, color: t.blue.text }}
              >
                + Podpisz za pracownika
              </button>
            )}
          </div>

          {/* Formularz admina: podpisz za pracownika */}
          {showSignAs && isAdmin() && (
            <div className="mb-3 p-3 rounded-xl" style={{ background: t.surfaceAlt, border: '1px solid rgba(39,97,235,0.2)' }}>
              <p className="text-xs font-semibold mb-2" style={{ color: t.blue.text }}>Wybierz pracownika</p>
              <select
                className="w-full rounded-lg px-3 py-2 text-sm outline-none mb-2"
                style={{ background: t.surfaceInput, border: '1px solid rgba(39,97,235,0.25)', color: signAsUserId ? t.ink : t.inkMuted, fontSize: 16 }}
                value={signAsUserId}
                onChange={(e) => setSignAsUserId(e.target.value)}
              >
                <option value="">Wybierz pracownika...</option>
                {(allUsers ?? [])
                  .filter((u) => u.id !== report.user.id && !report.signatures.some((s) => s.signer.id === u.id))
                  .map((u) => (
                    <option key={u.id} value={u.id}>{u.fullName}</option>
                  ))
                }
              </select>
              {signAsErr && <p className="text-[12px] mb-1" style={{ color: '#dc2626' }}>{signAsErr}</p>}
              <div className="flex gap-2">
                <Button size="sm" loading={addSignatureMut.isPending} onClick={handleSignAs}>
                  <Check className="h-3.5 w-3.5 mr-1" />Podpisz
                </Button>
                <button
                  onClick={() => { setShowSignAs(false); setSignAsErr('') }}
                  className="flex-1 rounded-xl py-1.5 text-sm font-medium"
                  style={{ background: t.dark ? 'rgba(255,255,255,0.06)' : 'rgba(12,30,60,0.06)', color: t.inkMuted }}
                >
                  Anuluj
                </button>
              </div>
            </div>
          )}

          {report.signatures.length === 0 && (
            <p className="text-sm" style={{ color: t.inkMuted }}>Brak podpisów.</p>
          )}
          <div className="space-y-1.5">
            {report.signatures.map((sig) => (
              <div key={sig.id} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-semibold" style={{ color: t.ink }}>{sig.signer.fullName}</span>
                  <span className="text-xs" style={{ color: t.inkDim }}>
                    {new Date(sig.signedAt).toLocaleString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {isAdmin() && (
                  <button
                    onClick={() => removeSignatureMut.mutate(sig.signer.id)}
                    disabled={removeSignatureMut.isPending}
                    className="shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full disabled:opacity-40"
                    style={{ background: 'rgba(220,38,38,0.08)', color: '#dc2626' }}
                    title="Cofnij podpis"
                  >
                    Cofnij
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Panel zatwierdzenia */}
      <div className="rounded-2xl p-4"
        style={{ background: t.surface, boxShadow: t.cardShadow }}>
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="h-4 w-4" style={{ color: t.blue.text }} />
          <p className="section-label">Zatwierdzenie raportu</p>
        </div>

        {report.approvedAt ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full"
                style={
                  report.isOffer === 'offer'
                    ? { background: 'rgba(124,58,237,0.12)', color: '#7c3aed' }
                    : report.isOffer === 'to_quote'
                    ? { background: 'rgba(234,88,12,0.12)', color: '#ea580c' }
                    : { background: 'rgba(22,163,74,0.12)', color: '#16a34a' }
                }
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                {report.isOffer === 'offer' ? 'Ofertowy' : report.isOffer === 'to_quote' ? 'Do zaofertowania' : 'Bez oferty'}
              </span>
            </div>
            <p className="text-xs" style={{ color: t.inkDim }}>
              Zatwierdził: <span className="font-semibold" style={{ color: t.ink }}>{report.approvedBy?.fullName}</span>
              {' · '}
              {new Date(report.approvedAt).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
            {isAdmin() && (
              <button
                onClick={() => approveMut.mutate(null)}
                disabled={approveMut.isPending}
                className="flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-1.5 transition-colors mt-1"
                style={{ background: 'rgba(244,63,94,0.08)', color: '#dc2626' }}
              >
                <ShieldOff className="h-3.5 w-3.5" />
                Cofnij zatwierdzenie
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <span
              className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(239,68,68,0.10)', color: '#dc2626' }}
            >
              Oczekuje na zatwierdzenie
            </span>
            {isAdmin() && (
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => approveMut.mutate('no_offer')}
                  disabled={approveMut.isPending}
                  className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-colors"
                  style={{ background: t.blue.bg, color: t.blue.text }}
                >
                  <ShieldCheck className="h-4 w-4" />
                  Bez oferty
                </button>
                <button
                  onClick={() => approveMut.mutate('to_quote')}
                  disabled={approveMut.isPending}
                  className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-colors"
                  style={{ background: 'rgba(234,88,12,0.10)', color: '#ea580c' }}
                >
                  <ShieldCheck className="h-4 w-4" />
                  Do zaofertowania
                </button>
                <button
                  onClick={() => approveMut.mutate('offer')}
                  disabled={approveMut.isPending}
                  className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-colors"
                  style={{ background: t.green.bg, color: t.green.text }}
                >
                  <ShieldCheck className="h-4 w-4" />
                  Ofertowy
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal edycji wpisu */}
      {showModal && (
        <EntryModal
          onClose={handleModalClose}
          onSave={handleSave}
          initialData={editingEntry}
          locked={locked}
          reportDate={report.reportDate.slice(0, 10)}
        />
      )}

      {/* Potwierdzenie usunięcia wpisu */}
      <Modal
        open={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        title="Usuń wpis"
        description="Czy na pewno chcesz usunąć ten wpis? Operacja jest nieodwracalna."
      >
        <div className="flex gap-3 justify-end mt-2">
          <Button variant="ghost" onClick={() => setConfirmDeleteId(null)}>
            Anuluj
          </Button>
          <Button
            variant="danger"
            disabled={deleteMutation.isPending}
            onClick={() => {
              deleteMutation.mutate(confirmDeleteId!, {
                onSuccess: () => setConfirmDeleteId(null),
              })
            }}
          >
            Usuń wpis
          </Button>
        </div>
      </Modal>

      {/* Potwierdzenie usunięcia pustego raportu */}
      <Modal
        open={confirmDeleteReport}
        onClose={() => setConfirmDeleteReport(false)}
        title="Usuń pusty raport"
        description="Raport nie zawiera żadnych wpisów. Czy na pewno chcesz go usunąć? Operacja jest nieodwracalna."
      >
        <div className="flex gap-3 justify-end mt-2">
          <Button variant="ghost" onClick={() => setConfirmDeleteReport(false)}>
            Anuluj
          </Button>
          <Button
            variant="danger"
            loading={deleteReportMut.isPending}
            onClick={() => deleteReportMut.mutate()}
          >
            Usuń raport
          </Button>
        </div>
      </Modal>
    </div>
  )
}
