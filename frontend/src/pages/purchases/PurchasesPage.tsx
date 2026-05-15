import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ShoppingCart, Plus, Trash2, ChevronDown, Search, X, Package } from 'lucide-react'
import { useTheme } from '@/lib/theme'
import { useAuthStore } from '@/store/authStore'
import { purchasesApi, type PurchaseOrder, type OrderStatus } from '@/api/purchases.api'
import { locationsApi } from '@/api/locations.api'
import { departmentsApi } from '@/api/departments.api'
import { materialsApi } from '@/api/materials.api'
import { reportsApi } from '@/api/reports.api'
import { usersApi } from '@/api/users.api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Spinner, PageSpinner } from '@/components/ui/Spinner'
import axios from 'axios'

// ── Stałe ─────────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending:   'Oczekuje',
  ordered:   'W realizacji',
  prepared:  'Skompletowane',
  delivered: 'Dostarczone',
  cancelled: 'Anulowane',
}

const STATUS_VARIANT: Record<OrderStatus, 'warning' | 'primary' | 'success' | 'default'> = {
  pending:   'warning',
  ordered:   'primary',
  prepared:  'success',
  delivered: 'success',
  cancelled: 'default',
}

const UNITS = ['szt', 'mb', 'kg', 'kpl', 'rolka', 'opak', 'l', 'm2', 'm3']
const UNIT_OPTIONS = UNITS.map(u => ({ value: u, label: u }))

function fmtDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ── Status Badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={STATUS_VARIANT[status]} dot>{STATUS_LABEL[status]}</Badge>
}

// ── Material Search Input ──────────────────────────────────────────────────────

function MaterialSearch({ onSelect }: { onSelect: (m: { id: number; name: string }) => void }) {
  const t = useTheme()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const { data: results } = useQuery({
    queryKey: ['mat-search', q],
    queryFn:  () => materialsApi.search(q).then(r => r.data.data),
    enabled:  q.length >= 3,
    staleTime: 10_000,
  })

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: t.inkMuted }} />
        <input
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Szukaj materiału (min. 3 znaki)…"
          className="w-full rounded-xl pl-9 pr-3 py-2.5 text-[16px] sm:text-sm outline-none transition-all"
          style={{
            background: t.surfaceInput,
            color: t.ink,
            boxShadow: `0 0 0 1.5px ${t.borderStrong}`,
          }}
        />
        {q && (
          <button
            type="button"
            onClick={() => { setQ(''); setOpen(false) }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2"
          >
            <X className="h-4 w-4" style={{ color: t.inkMuted }} />
          </button>
        )}
      </div>
      {open && results && results.length > 0 && (
        <div
          className="absolute z-50 mt-1 w-full rounded-xl overflow-hidden"
          style={{ background: t.surfaceAlt, boxShadow: t.dark ? '0 4px 20px rgba(0,0,0,0.5)' : '0 4px 20px rgba(12,30,60,0.15)', border: `1px solid ${t.border}` }}
        >
          {results.slice(0, 8).map(m => (
            <button
              key={m.id}
              type="button"
              onMouseDown={() => { onSelect(m); setQ(m.name); setOpen(false) }}
              className="w-full px-3 py-2.5 text-left hover:opacity-80 transition-opacity"
              style={{ background: 'transparent', borderBottom: `1px solid ${t.border}` }}
            >
              <p className="text-sm font-medium" style={{ color: t.ink }}>{m.name}</p>
              {m.catalogNumber && <p className="text-xs" style={{ color: t.inkMuted }}>{m.catalogNumber}</p>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── New Order Modal ────────────────────────────────────────────────────────────

const itemSchema = z.object({
  type:       z.enum(['catalog', 'manual']),
  materialId: z.number().optional(),
  customName: z.string().max(300).optional(),
  quantity:   z.coerce.number().positive('Podaj ilość'),
  unit:       z.string().default('szt'),
  notes:      z.string().max(500).optional(),
})

const newOrderSchema = z.object({
  locationId:   z.coerce.number().int().positive().optional(),
  departmentId: z.coerce.number().int().positive().optional(),
  neededBy:     z.string().optional(),
  notes:        z.string().max(1000).optional(),
  items:        z.array(itemSchema).min(1),
})
type NewOrderForm = z.infer<typeof newOrderSchema>

function NewOrderModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTheme()
  const qc = useQueryClient()

  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn:  () => locationsApi.getAll().then(r => r.data.data.filter(l => l.isActive)),
  })

  const { register, handleSubmit, watch, setValue, control, reset, formState: { errors } } = useForm<NewOrderForm>({
    resolver: zodResolver(newOrderSchema),
    defaultValues: { items: [{ type: 'catalog', quantity: 1, unit: 'szt' }] },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const locationId = watch('locationId')

  const { data: departments } = useQuery({
    queryKey: ['departments', locationId],
    queryFn:  () => departmentsApi.list(locationId).then(r => r.data.data.filter(d => d.isActive)),
    enabled: !!locationId,
  })

  const mutation = useMutation({
    mutationFn: (data: NewOrderForm) => {
      const items = data.items.map(i => ({
        materialId: i.type === 'catalog' ? i.materialId : undefined,
        customName: i.type === 'manual'  ? i.customName : undefined,
        quantity: i.quantity,
        unit: i.unit,
        notes: i.notes || undefined,
      }))
      return purchasesApi.create({
        locationId:   data.locationId   || undefined,
        departmentId: data.departmentId || undefined,
        neededBy:     data.neededBy     || undefined,
        notes:        data.notes        || undefined,
        items,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      reset()
      onClose()
    },
  })

  const locationOptions = [
    { value: '', label: '— Brak lokalizacji —' },
    ...(locations ?? []).map(l => ({ value: String(l.id), label: l.name })),
  ]
  const deptOptions = [
    { value: '', label: '— Brak wydziału —' },
    ...(departments ?? []).map(d => ({ value: String(d.id), label: d.name })),
  ]

  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose() }}
      title="Nowe zamówienie"
      description="Dodaj pozycje i wyślij zapotrzebowanie"
      className="sm:max-w-2xl"
    >
      <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-5">

        {/* Kontekst */}
        <div className="grid grid-cols-2 gap-3">
          <Select label="Lokalizacja" {...register('locationId')} options={locationOptions} />
          <Select
            label="Wydział"
            {...register('departmentId')}
            options={deptOptions}
            disabled={!locationId}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Termin potrzeby" type="date" {...register('neededBy')} />
          <Input label="Uwagi ogólne" {...register('notes')} placeholder="Opcjonalne" />
        </div>

        {/* Pozycje */}
        <div>
          <p className="section-label mb-2">Pozycje zamówienia</p>
          <div className="space-y-3">
            {fields.map((field, idx) => {
              const type = watch(`items.${idx}.type`)
              return (
                <div
                  key={field.id}
                  className="rounded-xl p-3 space-y-2"
                  style={{ background: t.surfaceAlt, border: `1px solid ${t.border}` }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold" style={{ color: t.inkMuted }}>Pozycja {idx + 1}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setValue(`items.${idx}.type`, type === 'catalog' ? 'manual' : 'catalog')}
                        className="text-xs px-2 py-1 rounded-lg transition-all"
                        style={{
                          background: type === 'catalog' ? t.blue.bg : t.amber.bg,
                          color: type === 'catalog' ? t.blue.text : t.amber.text,
                        }}
                      >
                        {type === 'catalog' ? 'Z katalogu' : 'Ręczny'}
                      </button>
                      {fields.length > 1 && (
                        <button type="button" onClick={() => remove(idx)}>
                          <Trash2 className="h-4 w-4" style={{ color: t.red.text }} />
                        </button>
                      )}
                    </div>
                  </div>

                  {type === 'catalog' ? (
                    <MaterialSearch onSelect={m => setValue(`items.${idx}.materialId`, m.id)} />
                  ) : (
                    <Input
                      placeholder="Opisz materiał (np. Klej Soudal Fix All Flexi)"
                      {...register(`items.${idx}.customName`)}
                    />
                  )}

                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <Input
                        label="Ilość"
                        type="number"
                        min="0.01"
                        step="0.01"
                        {...register(`items.${idx}.quantity`)}
                        error={(errors.items?.[idx] as any)?.quantity?.message}
                      />
                    </div>
                    <Select label="Jednostka" {...register(`items.${idx}.unit`)} options={UNIT_OPTIONS} />
                  </div>
                  <Input label="Uwagi do pozycji" {...register(`items.${idx}.notes`)} placeholder="Opcjonalne" />
                </div>
              )
            })}
          </div>
          <button
            type="button"
            onClick={() => append({ type: 'catalog', quantity: 1, unit: 'szt' })}
            className="mt-2 flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-70"
            style={{ color: t.blue.text }}
          >
            <Plus className="h-4 w-4" /> Dodaj pozycję
          </button>
        </div>

        {mutation.isError && (
          <p className="text-sm rounded-xl px-3 py-2" style={{ background: 'rgba(239,68,68,0.06)', color: '#dc2626' }}>
            {axios.isAxiosError(mutation.error) ? mutation.error.response?.data?.error : 'Błąd serwera'}
          </p>
        )}

        <Button type="submit" loading={mutation.isPending} className="w-full">
          Wyślij zamówienie
        </Button>
      </form>
    </Modal>
  )
}

// ── Promote Modal ──────────────────────────────────────────────────────────────

function PromoteModal({
  open, onClose, orderId, itemId, defaultName,
}: {
  open: boolean; onClose: () => void
  orderId: string; itemId: string; defaultName: string
}) {
  const qc = useQueryClient()
  const [name, setName] = useState(defaultName)
  const [catalogNumber, setCatalogNumber] = useState('')

  const mutation = useMutation({
    mutationFn: () => purchasesApi.promoteItem(orderId, itemId, { name, catalogNumber: catalogNumber || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      qc.invalidateQueries({ queryKey: ['purchase-order', orderId] })
      onClose()
    },
  })

  return (
    <Modal open={open} onClose={onClose} title="Dodaj do katalogu" description={`Pozycja: ${defaultName}`}>
      <div className="space-y-4">
        <Input label="Nazwa materiału" value={name} onChange={e => setName(e.target.value)} />
        <Input label="Nr katalogowy (opcjonalny)" value={catalogNumber} onChange={e => setCatalogNumber(e.target.value)} />
        <Button onClick={() => mutation.mutate()} loading={mutation.isPending} className="w-full">
          Dodaj do katalogu
        </Button>
      </div>
    </Modal>
  )
}

// ── Order Detail Modal ─────────────────────────────────────────────────────────

function OrderDetailModal({
  orderId, onClose,
}: {
  orderId: string | null; onClose: () => void
}) {
  const t = useTheme()
  const qc = useQueryClient()
  const { user, isAdmin, canOrder, canPrepare } = useAuthStore()
  const isManager = canOrder()
  const isMagazynier = canPrepare()
  const [promoteItem, setPromoteItem] = useState<{ itemId: string; name: string } | null>(null)
  const [reportId, setReportId] = useState<string>('')

  const { data: order, isLoading } = useQuery({
    queryKey: ['purchase-order', orderId],
    queryFn:  () => purchasesApi.getById(orderId!).then(r => r.data.data),
    enabled: !!orderId,
  })

  const { data: reportsList } = useQuery({
    queryKey: ['reports-for-assign', order?.userId],
    queryFn:  () => reportsApi.list({ userId: order!.userId }).then(r => r.data.data.items),
    enabled: !!order && order.status === 'delivered',
  })

  const statusMut = useMutation({
    mutationFn: (status: 'ordered' | 'prepared' | 'delivered' | 'cancelled') =>
      purchasesApi.updateStatus(orderId!, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      qc.invalidateQueries({ queryKey: ['purchase-order', orderId] })
    },
  })

  const cancelMut = useMutation({
    mutationFn: () => purchasesApi.cancel(orderId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      qc.invalidateQueries({ queryKey: ['purchase-order', orderId] })
    },
  })

  const assignMut = useMutation({
    mutationFn: () => purchasesApi.assignReport(orderId!, reportId || null),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-order', orderId] })
    },
  })

  if (!orderId) return null

  const isOwner = order?.userId === user?.id

  return (
    <Modal
      open={!!orderId}
      onClose={onClose}
      title="Szczegóły zamówienia"
      className="sm:max-w-2xl"
    >
      {isLoading || !order ? (
        <div className="py-8 flex justify-center"><Spinner /></div>
      ) : (
        <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">

          {/* Status + meta */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <StatusBadge status={order.status as OrderStatus} />
              <p className="mt-1.5 text-sm" style={{ color: t.inkMuted }}>
                {order.user.fullName} · {fmtDate(order.createdAt)}
              </p>
              {order.location && (
                <p className="text-sm" style={{ color: t.inkMuted }}>
                  {order.location.name}{order.department ? ` / ${order.department.name}` : ''}
                </p>
              )}
              {order.neededBy && (
                <p className="text-sm font-medium" style={{ color: t.amber.text }}>
                  Potrzebne do: {fmtDate(order.neededBy)}
                </p>
              )}
            </div>
            {order.report && (
              <div className="text-right">
                <p className="text-xs" style={{ color: t.inkMuted }}>Raport</p>
                <p className="text-sm font-medium" style={{ color: t.ink }}>
                  {fmtDate(order.report.reportDate)}
                </p>
              </div>
            )}
          </div>

          {order.notes && (
            <div className="rounded-xl px-3 py-2.5" style={{ background: t.surfaceAlt, border: `1px solid ${t.border}` }}>
              <p className="text-sm" style={{ color: t.ink }}>{order.notes}</p>
            </div>
          )}

          {/* Pozycje */}
          <div>
            <p className="section-label mb-2">Pozycje ({order.items.length})</p>
            <div className="space-y-2">
              {order.items.map(item => (
                <div
                  key={item.id}
                  className="rounded-xl px-3 py-2.5"
                  style={{ background: t.surfaceAlt, border: `1px solid ${t.border}` }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium" style={{ color: t.ink }}>
                        {item.material?.name ?? item.customName}
                      </p>
                      {item.material?.catalogNumber && (
                        <p className="text-xs" style={{ color: t.inkMuted }}>{item.material.catalogNumber}</p>
                      )}
                      {item.customName && (
                        <Badge variant="warning" className="mt-1 text-xs">Spoza katalogu</Badge>
                      )}
                      {item.notes && <p className="text-xs mt-1" style={{ color: t.inkMuted }}>{item.notes}</p>}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold" style={{ color: t.ink }}>{item.quantity} {item.unit}</p>
                      {item.customName && isManager && (
                        <button
                          type="button"
                          onClick={() => setPromoteItem({ itemId: item.id, name: item.customName! })}
                          className="text-xs mt-1 font-medium transition-opacity hover:opacity-70"
                          style={{ color: t.blue.text }}
                        >
                          + Dodaj do katalogu
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Zmiana statusu — zamawiający/admin */}
          {isManager && order.status !== 'cancelled' && (
            <div>
              <p className="section-label mb-2">Zmień status</p>
              <div className="flex gap-2 flex-wrap">
                {order.status === 'pending' && (
                  <Button size="sm" onClick={() => statusMut.mutate('ordered')} loading={statusMut.isPending}>
                    → W realizacji
                  </Button>
                )}
                {order.status === 'prepared' && (
                  <Button size="sm" onClick={() => statusMut.mutate('delivered')} loading={statusMut.isPending}>
                    → Dostarczone
                  </Button>
                )}
                {order.status !== 'delivered' && (
                  <Button size="sm" variant="danger" onClick={() => statusMut.mutate('cancelled')} loading={statusMut.isPending}>
                    Anuluj
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Zmiana statusu — magazynier */}
          {!isManager && isMagazynier && order.status === 'ordered' && (
            <div>
              <p className="section-label mb-2">Akcja magazyniera</p>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" onClick={() => statusMut.mutate('prepared')} loading={statusMut.isPending}>
                  → Skompletowane
                </Button>
                <Button size="sm" variant="danger" onClick={() => statusMut.mutate('cancelled')} loading={statusMut.isPending}>
                  Anuluj
                </Button>
              </div>
            </div>
          )}

          {/* Anulowanie przez twórcę (pending) */}
          {!isManager && isOwner && order.status === 'pending' && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => cancelMut.mutate()}
              loading={cancelMut.isPending}
            >
              Anuluj zamówienie
            </Button>
          )}

          {/* Przypisz do raportu (delivered) */}
          {order.status === 'delivered' && (isOwner || isManager) && (
            <div>
              <p className="section-label mb-2">Przypisz do raportu</p>
              <div className="flex gap-2">
                <select
                  value={reportId}
                  onChange={e => setReportId(e.target.value)}
                  className="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
                  style={{ background: t.surfaceInput, color: t.ink, border: `1px solid ${t.borderStrong}` }}
                >
                  <option value="">— wybierz raport —</option>
                  {(reportsList ?? []).map(r => (
                    <option key={r.id} value={r.id}>
                      {fmtDate(r.reportDate)}
                    </option>
                  ))}
                </select>
                <Button size="sm" onClick={() => assignMut.mutate()} loading={assignMut.isPending}>
                  Przypisz
                </Button>
              </div>
              {order.report && (
                <p className="mt-1.5 text-xs" style={{ color: t.green.text }}>
                  Przypisano: {fmtDate(order.report.reportDate)}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {promoteItem && (
        <PromoteModal
          open
          onClose={() => setPromoteItem(null)}
          orderId={orderId}
          itemId={promoteItem.itemId}
          defaultName={promoteItem.name}
        />
      )}
    </Modal>
  )
}

// ── Order Card ─────────────────────────────────────────────────────────────────

function OrderCard({ order, onClick }: { order: PurchaseOrder; onClick: () => void }) {
  const t = useTheme()
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl p-4 transition-all hover:opacity-90"
      style={{ background: t.surface, boxShadow: t.cardShadow }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={order.status as OrderStatus} />
            {order.neededBy && (
              <span className="text-xs font-medium" style={{ color: t.amber.text }}>
                do {fmtDate(order.neededBy)}
              </span>
            )}
          </div>
          <p className="mt-1.5 text-sm font-semibold truncate" style={{ color: t.ink }}>
            {order.user.fullName}
          </p>
          {order.location && (
            <p className="text-xs" style={{ color: t.inkMuted }}>
              {order.location.name}{order.department ? ` / ${order.department.name}` : ''}
            </p>
          )}
          <p className="text-xs mt-0.5" style={{ color: t.inkMuted }}>
            {order.items.length} poz. · {fmtDate(order.createdAt)}
          </p>
        </div>
        <ChevronDown className="h-4 w-4 shrink-0 mt-1 -rotate-90" style={{ color: t.inkMuted }} />
      </div>
      {order.notes && (
        <p className="mt-2 text-xs line-clamp-2" style={{ color: t.inkMuted }}>{order.notes}</p>
      )}
    </button>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function PurchasesPage() {
  const t = useTheme()
  const { user, isAdmin, canOrder, canPrepare } = useAuthStore()
  const isManager = canOrder()
  const isMagazynier = canPrepare()
  const canSeeAll = isManager || isMagazynier

  const [newOpen,   setNewOpen]   = useState(false)
  const [detailId,  setDetailId]  = useState<string | null>(null)

  // Filtry
  const [filterStatus,     setFilterStatus]     = useState<string>('')
  const [filterLocationId, setFilterLocationId] = useState<string>('')
  const [filterUserId,     setFilterUserId]      = useState<string>('')

  const { data, isLoading } = useQuery({
    queryKey: ['purchase-orders', filterStatus, filterLocationId, filterUserId],
    queryFn: () => purchasesApi.list({
      status:     filterStatus     as OrderStatus || undefined,
      locationId: filterLocationId ? Number(filterLocationId) : undefined,
      userId:     filterUserId     || undefined,
    }).then(r => r.data.data),
  })

  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn:  () => locationsApi.getAll().then(r => r.data.data.filter(l => l.isActive)),
    enabled: canSeeAll,
  })

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn:  () => usersApi.getAll().then(r => r.data.data),
    enabled: isManager,
  })

  const orders = data?.items ?? []

  return (
    <div className="animate-fade-in space-y-6">

      {/* ── Nagłówek ─────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ background: 'linear-gradient(135deg, #6366f1, #4338ca)' }}>
              <ShoppingCart className="h-4 w-4 text-white" />
            </div>
            <h1 className="page-title">Zamówienia</h1>
          </div>
          <p className="mt-1 text-[13.5px] ml-11" style={{ color: t.inkMuted }}>
            {canSeeAll ? 'Wszystkie zamówienia materiałów' : 'Twoje zamówienia materiałów'}
          </p>
        </div>
        <Button onClick={() => setNewOpen(true)} size="md" className="shrink-0">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Nowe zamówienie</span>
          <span className="sm:hidden">Nowe</span>
        </Button>
      </div>

      {/* ── Filtry (zamawiający/magazynier/admin) ─── */}
      {canSeeAll && (
        <div className="flex flex-wrap gap-2">
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="rounded-xl px-3 py-2 text-sm outline-none"
            style={{ background: t.surface, color: t.ink, border: `1px solid ${t.borderStrong}`, boxShadow: t.cardShadow }}
          >
            <option value="">Wszystkie statusy</option>
            {(['pending','ordered','prepared','delivered','cancelled'] as OrderStatus[]).map(s => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>

          {locations && (
            <select
              value={filterLocationId}
              onChange={e => setFilterLocationId(e.target.value)}
              className="rounded-xl px-3 py-2 text-sm outline-none"
              style={{ background: t.surface, color: t.ink, border: `1px solid ${t.borderStrong}`, boxShadow: t.cardShadow }}
            >
              <option value="">Wszystkie lokalizacje</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          )}

          {users && (
            <select
              value={filterUserId}
              onChange={e => setFilterUserId(e.target.value)}
              className="rounded-xl px-3 py-2 text-sm outline-none"
              style={{ background: t.surface, color: t.ink, border: `1px solid ${t.borderStrong}`, boxShadow: t.cardShadow }}
            >
              <option value="">Wszyscy pracownicy</option>
              {users.filter(u => u.isActive).map(u => (
                <option key={u.id} value={u.id}>{u.fullName}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* ── Lista ───────────────────────────────── */}
      {isLoading ? (
        <PageSpinner />
      ) : orders.length === 0 ? (
        <div className="py-16 flex flex-col items-center gap-3" style={{ color: t.inkMuted }}>
          <Package className="h-10 w-10 opacity-30" />
          <p className="text-sm">Brak zamówień</p>
          <Button size="sm" onClick={() => setNewOpen(true)}>Utwórz pierwsze zamówienie</Button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {orders.map(o => (
            <OrderCard key={o.id} order={o} onClick={() => setDetailId(o.id)} />
          ))}
          {(data?.total ?? 0) > orders.length && (
            <p className="text-center text-sm py-2" style={{ color: t.inkMuted }}>
              Wyświetlono {orders.length} z {data?.total}
            </p>
          )}
        </div>
      )}

      {/* ── Modals ──────────────────────────────── */}
      <NewOrderModal open={newOpen} onClose={() => setNewOpen(false)} />
      <OrderDetailModal orderId={detailId} onClose={() => setDetailId(null)} />
    </div>
  )
}
