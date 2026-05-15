import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Search, Pencil, UserCheck, UserX, Users as UsersIcon, Clock } from 'lucide-react'
import { useTheme } from '@/lib/theme'

function fmtLogin(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pl-PL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
import axios from 'axios'
import { usersApi, type CreateUserPayload, type UpdateUserPayload } from '@/api/users.api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { PageSpinner } from '@/components/ui/Spinner'
import type { User } from '@/types'

// ── Schemas ─────────────────────────────────────────────
const createSchema = z.object({
  login:            z.string().min(4, 'Min. 4 znaki').max(50),
  password:         z.string().min(4, 'Min. 4 znaki').max(100),
  fullName:         z.string().min(2, 'Min. 2 znaki').max(100),
  role:             z.enum(['admin', 'pracownik']),
  canRentEquipment: z.boolean(),
  canOrder:         z.boolean(),
  canPrepare:       z.boolean(),
})
const editSchema = z.object({
  login:            z.string().min(4, 'Min. 4 znaki').max(50).optional().or(z.literal('')),
  fullName:         z.string().min(2).max(100).optional(),
  role:             z.enum(['admin', 'pracownik']).optional(),
  password:         z.string().min(4).max(100).optional().or(z.literal('')),
  canRentEquipment: z.boolean(),
  canOrder:         z.boolean(),
  canPrepare:       z.boolean(),
})
type CreateForm = z.infer<typeof createSchema>
type EditForm   = z.infer<typeof editSchema>

const roleOptions = [
  { value: 'pracownik', label: 'Pracownik' },
  { value: 'admin',     label: 'Administrator' },
]

// ── Avatar kółko ─────────────────────────────────────────
function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const s = size === 'sm' ? 'h-8 w-8 text-xs' : 'h-9 w-9 text-sm'
  return (
    <div
      className={`${s} shrink-0 flex items-center justify-center rounded-xl font-semibold text-white`}
      style={{ background: 'linear-gradient(135deg, #6366f1, #4338ca)' }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

// ── Formularze ───────────────────────────────────────────
function CreateUserForm({ onSuccess }: { onSuccess: () => void }) {
  const qc = useQueryClient()
  const t = useTheme()
  const { register, handleSubmit, formState: { errors }, setError, reset, watch, setValue } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { role: 'pracownik', canRentEquipment: true, canOrder: false, canPrepare: false },
  })
  const mutation = useMutation({
    mutationFn: (d: CreateUserPayload) => usersApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); reset(); onSuccess() },
    onError: (err) => {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : 'Błąd serwera'
      setError('root', { message: msg })
    },
  })

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
      <Input label="Imię i nazwisko" {...register('fullName')} error={errors.fullName?.message} placeholder="Jan Kowalski" />
      <Input label="Login" {...register('login')} error={errors.login?.message} placeholder="jkowalski" autoCapitalize="none" />
      <Input label="Hasło" type="password" {...register('password')} error={errors.password?.message} placeholder="Min. 4 znaki" />
      <Select label="Rola" {...register('role')} error={errors.role?.message} options={roleOptions} />
      <label className="flex items-center gap-3 cursor-pointer select-none">
        <div className="relative">
          <input
            type="checkbox"
            className="sr-only"
            checked={watch('canRentEquipment')}
            onChange={(e) => setValue('canRentEquipment', e.target.checked)}
          />
          <div
            className="h-5 w-5 rounded-md flex items-center justify-center transition-all"
            style={{
              background: watch('canRentEquipment')
                ? t.dark ? '#fbbf24' : '#2761eb'
                : 'transparent',
              boxShadow: watch('canRentEquipment')
                ? `0 0 0 2px ${t.dark ? '#fbbf24' : '#2761eb'}`
                : t.dark ? '0 0 0 1.5px rgba(255,255,255,0.25)' : '0 0 0 1.5px rgba(15,23,42,0.25)',
            }}
          >
            {watch('canRentEquipment') && (
              <svg
                className="h-3 w-3"
                style={{ color: t.dark ? '#1c1400' : '#ffffff' }}
                viewBox="0 0 12 12" fill="none"
              >
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        </div>
        <span className="text-sm font-medium" style={{ color: t.ink }}>Dostęp do wypożyczalni sprzętu</span>
      </label>
      <label className="flex items-center gap-3 cursor-pointer select-none">
        <div className="relative">
          <input
            type="checkbox"
            className="sr-only"
            checked={watch('canOrder')}
            onChange={(e) => setValue('canOrder', e.target.checked)}
          />
          <div
            className="h-5 w-5 rounded-md flex items-center justify-center transition-all"
            style={{
              background: watch('canOrder')
                ? t.dark ? '#fbbf24' : '#2761eb'
                : 'transparent',
              boxShadow: watch('canOrder')
                ? `0 0 0 2px ${t.dark ? '#fbbf24' : '#2761eb'}`
                : t.dark ? '0 0 0 1.5px rgba(255,255,255,0.25)' : '0 0 0 1.5px rgba(15,23,42,0.25)',
            }}
          >
            {watch('canOrder') && (
              <svg className="h-3 w-3" style={{ color: t.dark ? '#1c1400' : '#ffffff' }} viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        </div>
        <span className="text-sm font-medium" style={{ color: t.ink }}>Uprawnienie do zamawiania (can_order)</span>
      </label>
      <label className="flex items-center gap-3 cursor-pointer select-none">
        <div className="relative">
          <input
            type="checkbox"
            className="sr-only"
            checked={watch('canPrepare')}
            onChange={(e) => setValue('canPrepare', e.target.checked)}
          />
          <div
            className="h-5 w-5 rounded-md flex items-center justify-center transition-all"
            style={{
              background: watch('canPrepare')
                ? t.dark ? '#fbbf24' : '#2761eb'
                : 'transparent',
              boxShadow: watch('canPrepare')
                ? `0 0 0 2px ${t.dark ? '#fbbf24' : '#2761eb'}`
                : t.dark ? '0 0 0 1.5px rgba(255,255,255,0.25)' : '0 0 0 1.5px rgba(15,23,42,0.25)',
            }}
          >
            {watch('canPrepare') && (
              <svg className="h-3 w-3" style={{ color: t.dark ? '#1c1400' : '#ffffff' }} viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        </div>
        <span className="text-sm font-medium" style={{ color: t.ink }}>Magazynier — kompletowanie zamówień (can_prepare)</span>
      </label>
      {errors.root && (
        <p className="text-sm text-red-500 rounded-xl px-3 py-2"
          style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
          {errors.root.message}
        </p>
      )}
      <Button type="submit" loading={mutation.isPending} className="w-full">
        Dodaj użytkownika
      </Button>
    </form>
  )
}

function EditUserForm({ user, onSuccess }: { user: User; onSuccess: () => void }) {
  const qc = useQueryClient()
  const t = useTheme()
  const { register, handleSubmit, formState: { errors }, setError, watch, setValue } = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    defaultValues: { login: user.login, fullName: user.fullName, role: user.role.name as 'admin' | 'pracownik', canRentEquipment: user.canRentEquipment, canOrder: user.canOrder, canPrepare: user.canPrepare },
  })
  const mutation = useMutation({
    mutationFn: (d: UpdateUserPayload) => usersApi.update(user.id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); onSuccess() },
    onError: (err) => {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : 'Błąd serwera'
      setError('root', { message: msg })
    },
  })

  return (
    <form
      onSubmit={handleSubmit((d) => {
        const payload: UpdateUserPayload = { fullName: d.fullName, role: d.role, canRentEquipment: d.canRentEquipment, canOrder: d.canOrder, canPrepare: d.canPrepare }
        if (d.login && d.login !== user.login) payload.login = d.login
        if (d.password) payload.password = d.password
        mutation.mutate(payload)
      })}
      className="space-y-4"
    >
      <Input label="Login" {...register('login')} error={errors.login?.message} autoCapitalize="none" />
      <Input label="Imię i nazwisko" {...register('fullName')} error={errors.fullName?.message} />
      <Select label="Rola" {...register('role')} options={roleOptions} />
      <Input label="Nowe hasło (opcjonalne)" type="password" {...register('password')} placeholder="Zostaw puste, aby nie zmieniać" />
      <label className="flex items-center gap-3 cursor-pointer select-none">
        <div className="relative">
          <input
            type="checkbox"
            className="sr-only"
            checked={watch('canRentEquipment')}
            onChange={(e) => setValue('canRentEquipment', e.target.checked)}
          />
          <div
            className="h-5 w-5 rounded-md flex items-center justify-center transition-all"
            style={{
              background: watch('canRentEquipment')
                ? t.dark ? '#fbbf24' : '#2761eb'
                : 'transparent',
              boxShadow: watch('canRentEquipment')
                ? `0 0 0 2px ${t.dark ? '#fbbf24' : '#2761eb'}`
                : t.dark ? '0 0 0 1.5px rgba(255,255,255,0.25)' : '0 0 0 1.5px rgba(15,23,42,0.25)',
            }}
          >
            {watch('canRentEquipment') && (
              <svg
                className="h-3 w-3"
                style={{ color: t.dark ? '#1c1400' : '#ffffff' }}
                viewBox="0 0 12 12" fill="none"
              >
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        </div>
        <span className="text-sm font-medium" style={{ color: t.ink }}>Dostęp do wypożyczalni sprzętu</span>
      </label>
      <label className="flex items-center gap-3 cursor-pointer select-none">
        <div className="relative">
          <input
            type="checkbox"
            className="sr-only"
            checked={watch('canOrder')}
            onChange={(e) => setValue('canOrder', e.target.checked)}
          />
          <div
            className="h-5 w-5 rounded-md flex items-center justify-center transition-all"
            style={{
              background: watch('canOrder')
                ? t.dark ? '#fbbf24' : '#2761eb'
                : 'transparent',
              boxShadow: watch('canOrder')
                ? `0 0 0 2px ${t.dark ? '#fbbf24' : '#2761eb'}`
                : t.dark ? '0 0 0 1.5px rgba(255,255,255,0.25)' : '0 0 0 1.5px rgba(15,23,42,0.25)',
            }}
          >
            {watch('canOrder') && (
              <svg className="h-3 w-3" style={{ color: t.dark ? '#1c1400' : '#ffffff' }} viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        </div>
        <span className="text-sm font-medium" style={{ color: t.ink }}>Uprawnienie do zamawiania (can_order)</span>
      </label>
      <label className="flex items-center gap-3 cursor-pointer select-none">
        <div className="relative">
          <input
            type="checkbox"
            className="sr-only"
            checked={watch('canPrepare')}
            onChange={(e) => setValue('canPrepare', e.target.checked)}
          />
          <div
            className="h-5 w-5 rounded-md flex items-center justify-center transition-all"
            style={{
              background: watch('canPrepare')
                ? t.dark ? '#fbbf24' : '#2761eb'
                : 'transparent',
              boxShadow: watch('canPrepare')
                ? `0 0 0 2px ${t.dark ? '#fbbf24' : '#2761eb'}`
                : t.dark ? '0 0 0 1.5px rgba(255,255,255,0.25)' : '0 0 0 1.5px rgba(15,23,42,0.25)',
            }}
          >
            {watch('canPrepare') && (
              <svg className="h-3 w-3" style={{ color: t.dark ? '#1c1400' : '#ffffff' }} viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        </div>
        <span className="text-sm font-medium" style={{ color: t.ink }}>Magazynier — kompletowanie zamówień (can_prepare)</span>
      </label>
      {errors.root && (
        <p className="text-sm text-red-500 rounded-xl px-3 py-2"
          style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
          {errors.root.message}
        </p>
      )}
      <Button type="submit" loading={mutation.isPending} className="w-full">
        Zapisz zmiany
      </Button>
    </form>
  )
}

// ── Główna strona ────────────────────────────────────────
export default function UsersPage() {
  const t = useTheme()
  const [search,      setSearch]      = useState('')
  const [createOpen,  setCreateOpen]  = useState(false)
  const [editUser,    setEditUser]    = useState<User | null>(null)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.getAll().then((r) => r.data.data),
  })

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      usersApi.update(id, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })

  const filtered = (data ?? []).filter((u) =>
    u.fullName.toLowerCase().includes(search.toLowerCase()) ||
    u.login.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="animate-fade-in space-y-6">

      {/* ── Nagłówek ───────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ background: 'linear-gradient(135deg, #6366f1, #4338ca)' }}>
              <UsersIcon className="h-4 w-4 text-white" />
            </div>
            <h1 className="page-title">Użytkownicy</h1>
          </div>
          <p className="mt-1 text-[13.5px] text-ink-400 ml-11">
            Zarządzaj kontami i uprawnieniami pracowników
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} size="md" className="shrink-0">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Nowy użytkownik</span>
          <span className="sm:hidden">Nowy</span>
        </Button>
      </div>

      {/* ── Wyszukiwarka ────────────────────────── */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <input
          type="search"
          placeholder="Szukaj po nazwie lub loginie…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={[
            'w-full rounded-xl bg-bg-surface pl-11 pr-4 py-2.5 text-[16px] sm:text-sm text-ink-900',
            'placeholder:text-ink-400 outline-none transition-all duration-150',
            'shadow-[0_0_0_1px_rgba(15,23,42,0.10),0_1px_2px_rgba(15,23,42,0.06)]',
            'focus:shadow-[0_0_0_2px_rgba(99,102,241,0.35)]',
          ].join(' ')}
        />
      </div>

      {/* ── Lista ───────────────────────────────── */}
      {isLoading ? (
        <PageSpinner />
      ) : (
        <>
          {/* DESKTOP: tabela */}
          <div className="hidden md:block bg-bg-surface rounded-2xl overflow-hidden shadow-card">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                  {['Pracownik', 'Login', 'Rola', 'Status', 'Ostatnie logowanie', ''].map((h) => (
                    <th key={h} className="px-5 py-3.5 text-left section-label first:pl-6 last:pr-6">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u, i) => (
                  <tr
                    key={u.id}
                    className="hover:bg-bg-muted/60 transition-colors duration-100"
                    style={{ borderTop: i > 0 ? `1px solid ${t.border}` : undefined }}
                  >
                    <td className="px-5 py-3.5 pl-6">
                      <div className="flex items-center gap-3">
                        <Avatar name={u.fullName} />
                        <span className="font-medium text-[14px] text-ink-900">{u.fullName}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-mono text-[13px] text-ink-400">{u.login}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge variant={u.role.name === 'admin' ? 'primary' : 'default'} dot>
                        {u.role.name === 'admin' ? 'Administrator' : 'Pracownik'}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge variant={u.isActive ? 'success' : 'danger'} dot>
                        {u.isActive ? 'Aktywny' : 'Nieaktywny'}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5" style={{ color: t.inkMuted }}>
                        <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="text-[12px] font-mono whitespace-nowrap">
                          {fmtLogin(u.lastLoginAt)}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 pr-6">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setEditUser(u)} title="Edytuj">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => toggleActive.mutate({ id: u.id, isActive: !u.isActive })}
                          title={u.isActive ? 'Dezaktywuj' : 'Aktywuj'}
                        >
                          {u.isActive
                            ? <UserX className="h-4 w-4 text-red-400" />
                            : <UserCheck className="h-4 w-4 text-emerald-500" />
                          }
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="py-14 text-center text-[14px] text-ink-400">
                Brak użytkowników spełniających kryteria
              </div>
            )}
          </div>

          {/* MOBILE: karty */}
          <div className="md:hidden space-y-2.5">
            {filtered.map((u) => (
              <div key={u.id} className="bg-bg-surface rounded-2xl shadow-card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={u.fullName} />
                    <div className="min-w-0">
                      <p className="font-semibold text-[14px] text-ink-900 truncate">{u.fullName}</p>
                      <p className="text-[12px] text-ink-400 font-mono">{u.login}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0 ml-2">
                    <Button variant="ghost" size="sm" onClick={() => setEditUser(u)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm"
                      onClick={() => toggleActive.mutate({ id: u.id, isActive: !u.isActive })}>
                      {u.isActive
                        ? <UserX className="h-4 w-4 text-red-400" />
                        : <UserCheck className="h-4 w-4 text-emerald-500" />
                      }
                    </Button>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Badge variant={u.role.name === 'admin' ? 'primary' : 'default'} dot>
                    {u.role.name === 'admin' ? 'Admin' : 'Pracownik'}
                  </Badge>
                  <Badge variant={u.isActive ? 'success' : 'danger'} dot>
                    {u.isActive ? 'Aktywny' : 'Nieaktywny'}
                  </Badge>
                </div>
                {u.lastLoginAt && (
                  <div className="mt-2 flex items-center gap-1" style={{ color: t.inkMuted }}>
                    <Clock className="h-3 w-3 flex-shrink-0" />
                    <span className="text-[11px] font-mono">{fmtLogin(u.lastLoginAt)}</span>
                  </div>
                )}
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="py-10 text-center text-[14px] text-ink-400">Brak użytkowników</div>
            )}
          </div>
        </>
      )}

      {/* ── Modals ──────────────────────────────── */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)}
        title="Nowy użytkownik" description="Wypełnij dane nowego pracownika">
        <CreateUserForm onSuccess={() => setCreateOpen(false)} />
      </Modal>

      <Modal open={!!editUser} onClose={() => setEditUser(null)}
        title="Edytuj użytkownika" description={editUser?.fullName}>
        {editUser && <EditUserForm user={editUser} onSuccess={() => setEditUser(null)} />}
      </Modal>
    </div>
  )
}
