import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, MapPin, ToggleLeft, ToggleRight, X, Check, Pencil, Building2, ChevronDown, Link, Unlink } from 'lucide-react'
import axios from 'axios'
import { locationsApi, type Location } from '@/api/locations.api'
import { contractorsApi, type Contractor } from '@/api/contractors.api'
import { useTheme } from '@/lib/theme'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PageSpinner } from '@/components/ui/Spinner'

// ── Formularz dodawania ──────────────────────────────────────────────────────

function AddLocationForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const t = useTheme()
  const [name, setName]   = useState('')
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => locationsApi.create({ name: name.trim() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['locations'] }); onClose() },
    onError: (err) => {
      setError(axios.isAxiosError(err) ? err.response?.data?.error ?? 'Błąd serwera' : 'Błąd serwera')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (name.trim().length < 2) { setError('Podaj nazwę lokalizacji (min. 2 znaki)'); return }
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
        <p className="section-label">Nowa lokalizacja</p>
        <button onClick={onClose} className="rounded-lg p-1" style={{ color: t.inkMuted }}>
          <X className="h-4 w-4" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          label="Nazwa lokalizacji"
          placeholder="np. Polmlek Raciąż"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        {error && (
          <p className="text-sm font-medium" style={{ color: '#f43f5e' }}>{error}</p>
        )}
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Anuluj</Button>
          <Button type="submit" size="sm" loading={mutation.isPending}>
            <Check className="h-4 w-4 mr-1" /> Dodaj
          </Button>
        </div>
      </form>
    </div>
  )
}

// ── Panel przypisania kontrahenta ────────────────────────────────────────────

function AssignContractorPanel({
  loc,
  contractors,
  onClose,
}: {
  loc: Location
  contractors: Contractor[]
  onClose: () => void
}) {
  const qc = useQueryClient()
  const t  = useTheme()
  const [selectedId, setSelectedId] = useState<string>(loc.contractor?.id ?? '')
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      locationsApi.update(loc.id, { contractorId: selectedId || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['locations'] })
      onClose()
    },
    onError: (err) => {
      setError(axios.isAxiosError(err) ? err.response?.data?.error ?? 'Błąd serwera' : 'Błąd serwera')
    },
  })

  const activeContractors = contractors.filter((c) => c.isActive || c.id === loc.contractor?.id)

  return (
    <div
      className="mt-2 rounded-xl p-3 animate-fade-in"
      style={{
        background: t.dark ? 'rgba(255,255,255,0.04)' : 'rgba(39,97,235,0.04)',
        border: `1px solid ${t.dark ? 'rgba(255,255,255,0.08)' : 'rgba(39,97,235,0.12)'}`,
      }}
    >
      <p className="text-xs font-semibold mb-2" style={{ color: t.inkDim }}>Przypisz kontrahenta</p>

      <div className="relative mb-2">
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="w-full rounded-xl px-3 py-2 text-sm outline-none appearance-none"
          style={{
            background: t.surfaceInput,
            color: t.ink,
            border: `1.5px solid ${t.dark ? 'rgba(255,255,255,0.08)' : 'rgba(12,30,60,0.12)'}`,
          }}
        >
          <option value="">— brak (odpisz) —</option>
          {activeContractors.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}{c.nip ? ` (${c.nip})` : ''}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4"
          style={{ color: t.inkMuted }}
        />
      </div>

      {error && <p className="text-xs mb-2" style={{ color: '#f43f5e' }}>{error}</p>}

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>Anuluj</Button>
        <Button type="button" size="sm" loading={mutation.isPending} onClick={() => mutation.mutate()}>
          <Check className="h-4 w-4 mr-1" /> Zapisz
        </Button>
      </div>
    </div>
  )
}

// ── Karta lokalizacji ────────────────────────────────────────────────────────

function LocationCard({ loc, contractors }: { loc: Location; contractors: Contractor[] }) {
  const qc = useQueryClient()
  const t  = useTheme()
  const [editing, setEditing]         = useState(false)
  const [assigning, setAssigning]     = useState(false)
  const [name, setName]               = useState(loc.name)
  const [error, setError]             = useState('')

  const toggleMutation = useMutation({
    mutationFn: () => locationsApi.update(loc.id, { isActive: !loc.isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['locations'] }),
  })

  const renameMutation = useMutation({
    mutationFn: () => locationsApi.update(loc.id, { name: name.trim() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['locations'] }); setEditing(false) },
    onError: (err) => {
      setError(axios.isAxiosError(err) ? err.response?.data?.error ?? 'Błąd serwera' : 'Błąd serwera')
    },
  })

  const activeColor = t.dark ? '#fbbf24' : '#2761eb'
  const mutedColor  = t.dark ? '#6b7280' : '#7da8d8'

  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: t.surface, boxShadow: t.cardShadow, opacity: loc.isActive ? 1 : 0.6 }}
    >
      {/* Główny wiersz */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <MapPin className="h-4 w-4 shrink-0" style={{ color: activeColor }} />
          {editing ? (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 rounded-lg px-2 py-1 text-sm outline-none"
              style={{
                background: t.surfaceInput,
                color: t.ink,
                boxShadow: t.dark ? '0 0 0 2px rgba(251,191,36,0.30)' : '0 0 0 2px rgba(39,97,235,0.30)',
              }}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') renameMutation.mutate()
                if (e.key === 'Escape') { setEditing(false); setName(loc.name) }
              }}
            />
          ) : (
            <span className="font-semibold text-sm truncate" style={{ color: t.ink }}>{loc.name}</span>
          )}
          {!loc.isActive && (
            <span
              className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0"
              style={{ background: t.amber.bg, color: t.amber.text }}
            >
              Nieaktywna
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {editing ? (
            <>
              <button
                onClick={() => renameMutation.mutate()}
                className="rounded-lg p-1.5"
                style={{ color: '#16a34a', background: 'rgba(22,163,74,0.10)' }}
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={() => { setEditing(false); setName(loc.name); setError('') }}
                className="rounded-lg p-1.5"
                style={{ color: mutedColor, background: t.dark ? 'rgba(255,255,255,0.06)' : 'rgba(12,30,60,0.06)' }}
              >
                <X className="h-4 w-4" />
              </button>
            </>
          ) : (
            <button
              onClick={() => { setEditing(true); setAssigning(false) }}
              className="rounded-lg p-1.5"
              style={{ color: t.inkDim, background: t.dark ? 'rgba(251,191,36,0.08)' : 'rgba(39,97,235,0.08)' }}
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}

          {/* Przycisk przypisania kontrahenta */}
          <button
            onClick={() => { setAssigning((a) => !a); setEditing(false) }}
            className="rounded-lg p-1.5"
            title={loc.contractor ? 'Zmień / odpisz kontrahenta' : 'Przypisz kontrahenta'}
            style={{
              color: loc.contractor ? activeColor : mutedColor,
              background: loc.contractor
                ? t.dark ? 'rgba(251,191,36,0.12)' : 'rgba(39,97,235,0.12)'
                : t.dark ? 'rgba(255,255,255,0.05)' : 'rgba(12,30,60,0.05)',
            }}
          >
            {loc.contractor ? <Link className="h-4 w-4" /> : <Unlink className="h-4 w-4" />}
          </button>

          <button
            onClick={() => toggleMutation.mutate()}
            className="rounded-lg p-1.5"
            style={{
              color: loc.isActive ? activeColor : mutedColor,
              background: t.dark ? 'rgba(255,255,255,0.05)' : 'rgba(39,97,235,0.08)',
            }}
            title={loc.isActive ? 'Dezaktywuj' : 'Aktywuj'}
          >
            {loc.isActive ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Powiązany kontrahent */}
      {loc.contractor && !assigning && (
        <div className="mt-2 flex items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5 shrink-0" style={{ color: t.inkMuted }} />
          <span className="text-xs" style={{ color: t.inkDim }}>
            {loc.contractor.name}
            {loc.contractor.nip ? (
              <span style={{ color: t.inkMuted }}> · NIP {loc.contractor.nip}</span>
            ) : null}
            {loc.contractor.city ? (
              <span style={{ color: t.inkMuted }}> · {loc.contractor.city}</span>
            ) : null}
          </span>
        </div>
      )}

      {error && (
        <p className="text-xs font-medium mt-2" style={{ color: '#f43f5e' }}>{error}</p>
      )}

      {assigning && (
        <AssignContractorPanel
          loc={loc}
          contractors={contractors}
          onClose={() => setAssigning(false)}
        />
      )}
    </div>
  )
}

// ── Główny eksport ───────────────────────────────────────────────────────────

export default function LocationsPage() {
  const t = useTheme()
  const [showAdd, setShowAdd] = useState(false)

  const { data: locData, isLoading: locLoading } = useQuery({
    queryKey: ['locations'],
    queryFn: () => locationsApi.getAll().then((r) => r.data.data),
  })

  const { data: conData } = useQuery({
    queryKey: ['contractors'],
    queryFn: () => contractorsApi.list().then((r) => r.data.data),
  })

  const locations   = locData ?? []
  const contractors = conData ?? []
  const active      = locations.filter((l) => l.isActive)
  const inactive    = locations.filter((l) => !l.isActive)

  return (
    <div className="animate-fade-in max-w-2xl mx-auto space-y-4">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Lokalizacje</h1>
          <p className="text-sm mt-0.5" style={{ color: t.inkDim }}>
            {active.length} aktywnych
          </p>
        </div>
        {!showAdd && (
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-1" /> Dodaj lokalizację
          </Button>
        )}
      </div>

      {showAdd && <AddLocationForm onClose={() => setShowAdd(false)} />}

      {locLoading ? (
        <PageSpinner />
      ) : locations.length === 0 ? (
        <div className="rounded-2xl p-10 text-center" style={{ background: t.surface, boxShadow: t.cardShadow }}>
          <MapPin className="h-10 w-10 mx-auto mb-3" style={{ color: t.inkMuted }} />
          <p className="font-semibold" style={{ color: t.ink }}>Brak lokalizacji</p>
          <p className="text-sm mt-1" style={{ color: t.inkDim }}>Dodaj pierwszą lokalizację.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {active.map((l) => <LocationCard key={l.id} loc={l} contractors={contractors} />)}
          {inactive.length > 0 && (
            <>
              <p className="text-xs font-semibold uppercase tracking-wider pt-2" style={{ color: t.inkMuted }}>
                Nieaktywne
              </p>
              {inactive.map((l) => <LocationCard key={l.id} loc={l} contractors={contractors} />)}
            </>
          )}
        </div>
      )}
    </div>
  )
}
