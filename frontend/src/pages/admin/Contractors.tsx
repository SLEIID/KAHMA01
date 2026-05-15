import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Building2, Search, X, Check, Pencil, ToggleLeft, ToggleRight, ChevronDown } from 'lucide-react'
import axios from 'axios'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { contractorsApi, type Contractor } from '@/api/contractors.api'
import { useTheme } from '@/lib/theme'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { PageSpinner } from '@/components/ui/Spinner'

// ── Walidacja NIP ─────────────────────────────────────────────────────────────

function validateNip(nip: string): boolean {
  if (!/^\d{10}$/.test(nip)) return false
  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7]
  const digits  = nip.split('').map(Number)
  const sum     = weights.reduce((acc, w, i) => acc + w * digits[i], 0)
  const check   = sum % 11
  return check !== 10 && check === digits[9]
}

// ── Schema formularza ─────────────────────────────────────────────────────────

const formSchema = z.object({
  type:            z.enum(['client', 'supplier', 'both']),
  name:            z.string().min(2, 'Podaj nazwę (min. 2 znaki)').max(300),
  nip:             z.string()
    .regex(/^\d{10}$/, 'NIP musi mieć 10 cyfr')
    .refine(validateNip, 'Nieprawidłowy NIP (cyfra kontrolna)')
    .or(z.literal(''))
    .optional(),
  street:          z.string().max(200).optional(),
  buildingNumber:  z.string().max(20).optional(),
  apartmentNumber: z.string().max(20).optional(),
  postalCode:      z.string().max(10).optional(),
  city:            z.string().max(100).optional(),
  country:         z.string().length(2).default('PL').optional(),
  email:           z.string().email('Nieprawidłowy e-mail').or(z.literal('')).optional(),
  phone:           z.string().max(50).optional(),
  isVatPayer:      z.boolean(),
})

type FormValues = z.infer<typeof formSchema>

const TYPE_LABELS: Record<string, string> = {
  client:   'Klient',
  supplier: 'Dostawca',
  both:     'Klient i dostawca',
}

// ── Modal dodaj/edytuj ────────────────────────────────────────────────────────

function ContractorModal({
  contractor,
  onClose,
}: {
  contractor?: Contractor
  onClose: () => void
}) {
  const qc = useQueryClient()
  const t  = useTheme()
  const [serverError, setServerError] = useState('')

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type:            contractor?.type ?? 'client',
      name:            contractor?.name ?? '',
      nip:             contractor?.nip ?? '',
      street:          contractor?.street ?? '',
      buildingNumber:  contractor?.buildingNumber ?? '',
      apartmentNumber: contractor?.apartmentNumber ?? '',
      postalCode:      contractor?.postalCode ?? '',
      city:            contractor?.city ?? '',
      country:         contractor?.country ?? 'PL',
      email:           contractor?.email ?? '',
      phone:           contractor?.phone ?? '',
      isVatPayer:      contractor?.isVatPayer ?? true,
    },
  })

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        ...values,
        nip:             values.nip?.trim() || null,
        street:          values.street?.trim() || null,
        buildingNumber:  values.buildingNumber?.trim() || null,
        apartmentNumber: values.apartmentNumber?.trim() || null,
        postalCode:      values.postalCode?.trim() || null,
        city:            values.city?.trim() || null,
        email:           values.email?.trim() || null,
        phone:           values.phone?.trim() || null,
      }
      return contractor
        ? contractorsApi.update(contractor.id, payload)
        : contractorsApi.create(payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contractors'] })
      onClose()
    },
    onError: (err) => {
      setServerError(axios.isAxiosError(err) ? err.response?.data?.error ?? 'Błąd serwera' : 'Błąd serwera')
    },
  })

  const onSubmit = (values: FormValues) => {
    setServerError('')
    mutation.mutate(values)
  }

  const field = (label: string, name: keyof FormValues, placeholder?: string, opts?: { half?: boolean }) => (
    <div className={opts?.half ? '' : 'col-span-2'}>
      <label className="block text-xs font-semibold mb-1" style={{ color: t.inkDim }}>
        {label}
      </label>
      <input
        {...register(name)}
        placeholder={placeholder}
        className="w-full rounded-xl px-3 py-2 text-sm outline-none transition-all"
        style={{
          background: t.surfaceInput,
          color: t.ink,
          border: errors[name] ? '1.5px solid #f43f5e' : `1.5px solid ${t.dark ? 'rgba(255,255,255,0.08)' : 'rgba(12,30,60,0.12)'}`,
        }}
      />
      {errors[name] && (
        <p className="text-xs mt-0.5" style={{ color: '#f43f5e' }}>
          {errors[name]?.message as string}
        </p>
      )}
    </div>
  )

  return (
    <Modal
      open
      onClose={onClose}
      title={contractor ? 'Edytuj kontrahenta' : 'Nowy kontrahent'}
    >
      <div className="space-y-4">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

          {/* Typ */}
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: t.inkDim }}>Typ</label>
            <div className="relative">
              <select
                {...register('type')}
                className="w-full rounded-xl px-3 py-2 text-sm outline-none appearance-none"
                style={{
                  background: t.surfaceInput,
                  color: t.ink,
                  border: `1.5px solid ${t.dark ? 'rgba(255,255,255,0.08)' : 'rgba(12,30,60,0.12)'}`,
                }}
              >
                <option value="client">Klient</option>
                <option value="supplier">Dostawca</option>
                <option value="both">Klient i dostawca</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: t.inkMuted }} />
            </div>
          </div>

          {/* Nazwa + NIP */}
          <div className="grid grid-cols-2 gap-3">
            {field('Nazwa', 'name', 'Pełna nazwa kontrahenta')}
            {field('NIP', 'nip', '10 cyfr (bez kresek)', { half: true })}
          </div>

          {/* Adres */}
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: t.inkMuted }}>Adres</p>
          <div className="grid grid-cols-2 gap-3">
            {field('Ulica', 'street', 'ul. Przykładowa', { half: false })}
            {field('Nr budynku', 'buildingNumber', '1A', { half: true })}
            {field('Nr lokalu', 'apartmentNumber', '5', { half: true })}
            {field('Kod pocztowy', 'postalCode', '00-000', { half: true })}
            {field('Miasto', 'city', 'Warszawa', { half: true })}
          </div>

          {/* Kontakt */}
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: t.inkMuted }}>Kontakt</p>
          <div className="grid grid-cols-2 gap-3">
            {field('E-mail', 'email', 'biuro@firma.pl', { half: true })}
            {field('Telefon', 'phone', '+48 000 000 000', { half: true })}
          </div>

          {/* VAT */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" {...register('isVatPayer')} className="rounded" />
            <span className="text-sm" style={{ color: t.ink }}>Podatnik VAT</span>
          </label>

          {serverError && (
            <p className="text-sm font-medium" style={{ color: '#f43f5e' }}>{serverError}</p>
          )}

          <div className="flex gap-2 justify-end pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>Anuluj</Button>
            <Button type="submit" size="sm" loading={mutation.isPending}>
              <Check className="h-4 w-4 mr-1" />
              {contractor ? 'Zapisz' : 'Dodaj'}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  )
}

// ── Karta kontrahenta ─────────────────────────────────────────────────────────

function ContractorCard({
  c,
  onEdit,
}: {
  c: Contractor
  onEdit: (c: Contractor) => void
}) {
  const qc = useQueryClient()
  const t  = useTheme()

  const toggleMutation = useMutation({
    mutationFn: () => contractorsApi.update(c.id, { isActive: !c.isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contractors'] }),
  })

  const activeColor = t.dark ? '#fbbf24' : '#2761eb'
  const mutedColor  = t.dark ? '#6b7280' : '#7da8d8'

  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: t.surface, boxShadow: t.cardShadow, opacity: c.isActive ? 1 : 0.6 }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Building2 className="h-4 w-4 shrink-0" style={{ color: activeColor }} />
            <span className="font-semibold text-sm" style={{ color: t.ink }}>{c.name}</span>
            <Badge variant={c.type === 'client' ? 'primary' : c.type === 'supplier' ? 'warning' : 'success'}>
              {TYPE_LABELS[c.type]}
            </Badge>
            {!c.isVatPayer && <Badge variant="default">Bez VAT</Badge>}
            {!c.isActive && <Badge variant="warning">Nieaktywny</Badge>}
          </div>

          <div className="mt-1.5 space-y-0.5">
            {c.nip && (
              <p className="text-xs" style={{ color: t.inkDim }}>NIP: <span style={{ color: t.ink }}>{c.nip}</span></p>
            )}
            {(c.street || c.city) && (
              <p className="text-xs" style={{ color: t.inkDim }}>
                {[c.street, c.buildingNumber, c.apartmentNumber ? `/${c.apartmentNumber}` : null]
                  .filter(Boolean).join(' ')}{c.postalCode || c.city ? ', ' : ''}
                {[c.postalCode, c.city].filter(Boolean).join(' ')}
              </p>
            )}
            {(c.email || c.phone) && (
              <p className="text-xs" style={{ color: t.inkDim }}>
                {[c.email, c.phone].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onEdit(c)}
            className="rounded-lg p-1.5"
            style={{ color: t.inkDim, background: t.dark ? 'rgba(251,191,36,0.08)' : 'rgba(39,97,235,0.08)' }}
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => toggleMutation.mutate()}
            className="rounded-lg p-1.5"
            style={{ color: c.isActive ? activeColor : mutedColor, background: t.dark ? 'rgba(255,255,255,0.05)' : 'rgba(39,97,235,0.08)' }}
            title={c.isActive ? 'Dezaktywuj' : 'Aktywuj'}
          >
            {c.isActive ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Główny eksport ────────────────────────────────────────────────────────────

export default function ContractorsPage() {
  const t = useTheme()
  const [q, setQ]             = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing]     = useState<Contractor | undefined>()

  const { data, isLoading } = useQuery({
    queryKey: ['contractors'],
    queryFn: () => contractorsApi.list().then((r) => r.data.data),
  })

  const contractors = data ?? []

  const filtered = contractors.filter((c) => {
    if (!q.trim()) return true
    const term = q.trim().toLowerCase()
    return (
      c.name.toLowerCase().includes(term) ||
      (c.nip ?? '').includes(term) ||
      (c.city ?? '').toLowerCase().includes(term)
    )
  })

  const active   = filtered.filter((c) => c.isActive)
  const inactive = filtered.filter((c) => !c.isActive)

  const openAdd  = () => { setEditing(undefined); setShowModal(true) }
  const openEdit = (c: Contractor) => { setEditing(c); setShowModal(true) }
  const close    = () => { setShowModal(false); setEditing(undefined) }

  return (
    <div className="animate-fade-in max-w-2xl mx-auto space-y-4">

      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Kontrahenci</h1>
          <p className="text-sm mt-0.5" style={{ color: t.inkDim }}>
            {contractors.filter((c) => c.isActive).length} aktywnych
          </p>
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="h-4 w-4 mr-1" /> Dodaj kontrahenta
        </Button>
      </div>

      {/* Wyszukiwarka */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: t.inkMuted }} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Szukaj po nazwie, NIP lub mieście…"
          className="w-full rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none"
          style={{
            background: t.surface,
            color: t.ink,
            boxShadow: t.cardShadow,
            border: `1.5px solid ${t.dark ? 'rgba(255,255,255,0.06)' : 'rgba(12,30,60,0.08)'}`,
          }}
        />
        {q && (
          <button
            onClick={() => setQ('')}
            className="absolute right-3 top-1/2 -translate-y-1/2"
            style={{ color: t.inkMuted }}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {isLoading ? (
        <PageSpinner />
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl p-10 text-center" style={{ background: t.surface, boxShadow: t.cardShadow }}>
          <Building2 className="h-10 w-10 mx-auto mb-3" style={{ color: t.inkMuted }} />
          <p className="font-semibold" style={{ color: t.ink }}>
            {q ? 'Brak wyników' : 'Brak kontrahentów'}
          </p>
          <p className="text-sm mt-1" style={{ color: t.inkDim }}>
            {q ? 'Spróbuj zmienić frazę wyszukiwania.' : 'Dodaj pierwszego kontrahenta.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {active.map((c) => <ContractorCard key={c.id} c={c} onEdit={openEdit} />)}
          {inactive.length > 0 && (
            <>
              <p className="text-xs font-semibold uppercase tracking-wider pt-2" style={{ color: t.inkMuted }}>
                Nieaktywni
              </p>
              {inactive.map((c) => <ContractorCard key={c.id} c={c} onEdit={openEdit} />)}
            </>
          )}
        </div>
      )}

      {showModal && (
        <ContractorModal contractor={editing} onClose={close} />
      )}
    </div>
  )
}
