import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Car, ToggleLeft, ToggleRight, X, Check, Pencil, Trash2 } from 'lucide-react'
import axios from 'axios'
import { vehiclesApi, type Vehicle } from '@/api/vehicles.api'
import { useTheme } from '@/lib/theme'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PageSpinner } from '@/components/ui/Spinner'

// ── Formularz dodawania ──────────────────────────────────────────────────────

function AddVehicleForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const t = useTheme()
  const [plateNumber, setPlateNumber] = useState('')
  const [name, setName]               = useState('')
  const [error, setError]             = useState('')

  const mutation = useMutation({
    mutationFn: () => vehiclesApi.create({
      plateNumber: plateNumber.trim().toUpperCase(),
      name:        name.trim(),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vehicles'] }); onClose() },
    onError: (err) => {
      setError(axios.isAxiosError(err) ? err.response?.data?.error ?? 'Błąd serwera' : 'Błąd serwera')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (plateNumber.trim().length < 2) { setError('Podaj numer rejestracyjny'); return }
    if (name.trim().length < 2)        { setError('Podaj nazwę pojazdu'); return }
    mutation.mutate()
  }

  return (
    <div
      className="rounded-2xl p-4 animate-fade-in"
      style={{
        background: t.surface,
        boxShadow: t.dark
          ? '0 0 0 2px rgba(251,191,36,0.22), 0 4px 16px rgba(0,0,0,0.25)'
          : '0 0 0 2px rgba(39,97,235,0.25), 0 4px 16px rgba(39,97,235,0.12)',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="section-label">Nowy pojazd</p>
        <button onClick={onClose} className="rounded-lg p-1" style={{ color: t.inkMuted }}>
          <X className="h-4 w-4" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Nr rejestracyjny"
            placeholder="np. WA 12345"
            value={plateNumber}
            onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
          />
          <Input
            label="Nazwa / model"
            placeholder="np. Ford Transit"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {error && <p className="text-[12.5px] font-medium" style={{ color: '#f43f5e' }}>{error}</p>}

        <div className="flex gap-2 pt-1">
          <Button type="submit" size="sm" loading={mutation.isPending} className="flex-1">
            <Check className="h-4 w-4 mr-1" /> Dodaj pojazd
          </Button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl py-2 text-sm font-medium"
            style={{ background: t.dark ? 'rgba(255,255,255,0.06)' : 'rgba(12,30,60,0.06)', color: t.inkMuted }}
          >
            Anuluj
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Formularz edycji ─────────────────────────────────────────────────────────

function EditVehicleForm({ vehicle, onClose }: { vehicle: Vehicle; onClose: () => void }) {
  const qc = useQueryClient()
  const t = useTheme()
  const [plateNumber, setPlateNumber] = useState(vehicle.plateNumber)
  const [name, setName]               = useState(vehicle.name)
  const [error, setError]             = useState('')

  const mutation = useMutation({
    mutationFn: () => vehiclesApi.update(vehicle.id, {
      plateNumber: plateNumber.trim().toUpperCase(),
      name:        name.trim(),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vehicles'] }); onClose() },
    onError: (err) => {
      setError(axios.isAxiosError(err) ? err.response?.data?.error ?? 'Błąd serwera' : 'Błąd serwera')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (plateNumber.trim().length < 2) { setError('Podaj numer rejestracyjny'); return }
    if (name.trim().length < 2)        { setError('Podaj nazwę pojazdu'); return }
    mutation.mutate()
  }

  return (
    <div
      className="rounded-2xl p-4 animate-fade-in"
      style={{
        background: t.surface,
        boxShadow: t.dark
          ? '0 0 0 2px rgba(251,191,36,0.18), 0 4px 16px rgba(0,0,0,0.22)'
          : '0 0 0 2px rgba(39,97,235,0.20), 0 4px 16px rgba(39,97,235,0.10)',
        marginTop: '0.5rem',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="section-label">Edytuj pojazd</p>
        <button onClick={onClose} className="rounded-lg p-1" style={{ color: t.inkMuted }}>
          <X className="h-4 w-4" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Nr rejestracyjny"
            value={plateNumber}
            onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
          />
          <Input
            label="Nazwa / model"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {error && <p className="text-[12.5px] font-medium" style={{ color: '#f43f5e' }}>{error}</p>}

        <div className="flex gap-2 pt-1">
          <Button type="submit" size="sm" loading={mutation.isPending} className="flex-1">
            <Check className="h-4 w-4 mr-1" /> Zapisz
          </Button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl py-2 text-sm font-medium"
            style={{ background: t.dark ? 'rgba(255,255,255,0.06)' : 'rgba(12,30,60,0.06)', color: t.inkMuted }}
          >
            Anuluj
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Karta pojazdu ────────────────────────────────────────────────────────────

function VehicleCard({ vehicle, onToggle }: { vehicle: Vehicle; onToggle: () => void }) {
  const qc = useQueryClient()
  const t = useTheme()
  const [editing,    setEditing]    = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const deleteMutation = useMutation({
    mutationFn: () => vehiclesApi.remove(vehicle.id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['vehicles'] }),
    onError: (err) => {
      setConfirming(false)
      setDeleteError(axios.isAxiosError(err) ? err.response?.data?.error ?? 'Błąd serwera' : 'Błąd serwera')
    },
  })

  const activeColor = t.dark ? '#fbbf24' : '#2761eb'
  const mutedColor  = t.dark ? '#6b7280' : '#7da8d8'

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: t.surface,
        boxShadow: t.cardShadow,
        opacity: vehicle.isActive ? 1 : 0.6,
      }}
    >
      <div className="p-4 flex items-center gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{
            background: vehicle.isActive
              ? t.dark
                ? 'linear-gradient(150deg, #fcd34d, #f59e0b)'
                : 'linear-gradient(150deg, #3b7ef8, #2761eb)'
              : t.dark ? 'rgba(255,255,255,0.08)' : 'rgba(12,30,60,0.12)',
            color: vehicle.isActive
              ? t.dark ? '#1c1400' : '#e0ecfd'
              : mutedColor,
          }}
        >
          <Car className="h-5 w-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold" style={{ color: t.ink }}>
              {vehicle.plateNumber}
            </p>
            <span
              className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
              style={vehicle.isActive
                ? { background: t.dark ? 'rgba(251,191,36,0.12)' : 'rgba(39,97,235,0.10)', color: activeColor }
                : { background: t.dark ? 'rgba(255,255,255,0.06)' : 'rgba(12,30,60,0.08)', color: mutedColor }}
            >
              {vehicle.isActive ? 'Aktywny' : 'Nieaktywny'}
            </span>
          </div>
          <p className="text-xs mt-0.5" style={{ color: t.inkMuted }}>{vehicle.name}</p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => { setEditing((v) => !v); setConfirming(false) }}
            className="rounded-lg p-2 transition-colors"
            style={{ color: editing ? activeColor : mutedColor }}
            title="Edytuj"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={onToggle}
            className="rounded-lg p-2 transition-colors"
            style={{ color: vehicle.isActive ? activeColor : mutedColor }}
            title={vehicle.isActive ? 'Dezaktywuj' : 'Aktywuj'}
          >
            {vehicle.isActive ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
          </button>
          <button
            onClick={() => { setConfirming((v) => !v); setEditing(false); setDeleteError('') }}
            className="rounded-lg p-2 transition-colors"
            style={{ color: confirming ? '#f43f5e' : mutedColor }}
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
          <p className="text-sm font-medium" style={{ color: t.dark ? '#f87171' : '#be123c' }}>Usunąć pojazd?</p>
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
              style={{ background: t.dark ? 'rgba(255,255,255,0.08)' : 'rgba(12,30,60,0.08)', color: t.inkMuted }}
            >
              Anuluj
            </button>
          </div>
        </div>
      )}

      {editing && (
        <div className="px-4 pb-4">
          <EditVehicleForm vehicle={vehicle} onClose={() => setEditing(false)} />
        </div>
      )}
    </div>
  )
}

// ── Strona główna ────────────────────────────────────────────────────────────

export default function VehiclesPage() {
  const qc = useQueryClient()
  const t = useTheme()
  const [showAdd, setShowAdd] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => vehiclesApi.getAll().then((r) => r.data.data),
  })

  const toggleMutation = useMutation({
    mutationFn: (v: Vehicle) => vehiclesApi.update(v.id, { isActive: !v.isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vehicles'] }),
  })

  const vehicles = data ?? []
  const active   = vehicles.filter((v) => v.isActive)
  const inactive = vehicles.filter((v) => !v.isActive)

  return (
    <div className="animate-fade-in max-w-2xl mx-auto space-y-4">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Pojazdy służbowe</h1>
          <p className="text-sm mt-0.5" style={{ color: t.inkDim }}>
            {active.length} aktywnych · {inactive.length} nieaktywnych
          </p>
        </div>
        {!showAdd && (
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-1" /> Dodaj pojazd
          </Button>
        )}
      </div>

      {showAdd && <AddVehicleForm onClose={() => setShowAdd(false)} />}

      {isLoading ? (
        <PageSpinner />
      ) : vehicles.length === 0 ? (
        <div
          className="rounded-2xl p-10 text-center"
          style={{ background: t.surface, boxShadow: t.cardShadow }}
        >
          <Car className="h-10 w-10 mx-auto mb-3" style={{ color: t.inkMuted }} />
          <p className="font-semibold" style={{ color: t.ink }}>Brak pojazdów</p>
          <p className="text-sm mt-1" style={{ color: t.inkDim }}>Dodaj pierwszy pojazd służbowy.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {vehicles.map((v) => (
            <VehicleCard
              key={v.id}
              vehicle={v}
              onToggle={() => toggleMutation.mutate(v)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
