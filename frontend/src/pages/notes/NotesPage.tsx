import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { StickyNote, Plus, Pencil, Trash2, X, Check, User, ChevronDown, ChevronUp } from 'lucide-react'
import axios from 'axios'
import { notesApi, type Note } from '@/api/notes.api'
import { usersApi } from '@/api/users.api'
import { useAuthStore } from '@/store/authStore'
import { useTheme } from '@/lib/theme'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PageSpinner } from '@/components/ui/Spinner'
import type { User as UserType } from '@/types'

function errMsg(err: unknown) {
  return axios.isAxiosError(err) ? (err.response?.data?.error ?? 'Błąd serwera') : 'Błąd serwera'
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pl-PL', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Formularz nowej notatki ───────────────────────────────────────────────────

function NoteForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const t = useTheme()
  const [title,   setTitle]   = useState('')
  const [content, setContent] = useState('')
  const [err,     setErr]     = useState('')

  const mut = useMutation({
    mutationFn: () => notesApi.create({ title: title.trim(), content: content.trim() }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['notes'] }); onClose() },
    onError:    (e) => setErr(errMsg(e)),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    if (!title.trim())   { setErr('Podaj tytuł'); return }
    if (!content.trim()) { setErr('Podaj treść'); return }
    mut.mutate()
  }

  const shadowIdle  = t.dark
    ? '0 0 0 1px rgba(255,255,255,0.10), inset 0 1px 3px rgba(0,0,0,0.20)'
    : '0 0 0 1px rgba(12,30,60,0.10), inset 0 1px 3px rgba(12,30,60,0.06)'
  const shadowFocus = t.dark
    ? '0 0 0 3px rgba(251,191,36,0.30)'
    : '0 0 0 3px rgba(39,97,235,0.28)'

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
        <p className="section-label">Nowa notatka</p>
        <button onClick={onClose} className="rounded-lg p-1" style={{ color: t.inkMuted }}>
          <X className="h-4 w-4" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          label="Tytuł"
          placeholder="Tytuł notatki"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" style={{ color: t.dark ? '#9ca3af' : 'rgba(12,30,60,0.60)' }}>Treść</label>
          <textarea
            rows={4}
            placeholder="Treść notatki..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full rounded-xl resize-none text-sm outline-none transition-all"
            style={{
              background: t.surfaceInput, color: t.ink,
              padding: '0.75rem 1rem',
              boxShadow: shadowIdle,
            }}
            onFocus={(e)  => { e.currentTarget.style.boxShadow = shadowFocus }}
            onBlur={(e)   => { e.currentTarget.style.boxShadow = shadowIdle }}
          />
        </div>
        {err && <p className="text-[12.5px] font-medium" style={{ color: '#f43f5e' }}>{err}</p>}
        <div className="flex gap-2 pt-1">
          <Button type="submit" size="sm" loading={mut.isPending} className="flex-1">
            <Check className="h-4 w-4 mr-1" /> Dodaj notatkę
          </Button>
          <button
            type="button" onClick={onClose}
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

// ── Karta notatki ─────────────────────────────────────────────────────────────

function NoteCard({
  note, canEdit, showUser,
}: {
  note: Note
  canEdit: boolean
  showUser: boolean
}) {
  const qc = useQueryClient()
  const t = useTheme()
  const [editing,    setEditing]    = useState(false)
  const [expanded,   setExpanded]   = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [title,      setTitle]      = useState(note.title)
  const [content,    setContent]    = useState(note.content)
  const [err,        setErr]        = useState('')

  const updateMut = useMutation({
    mutationFn: () => notesApi.update(note.id, { title: title.trim(), content: content.trim() }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['notes'] }); setEditing(false) },
    onError:    (e) => setErr(errMsg(e)),
  })

  const deleteMut = useMutation({
    mutationFn: () => notesApi.remove(note.id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['notes'] }),
    onError:    (e) => setErr(errMsg(e)),
  })

  const isLong = note.content.length > 200

  const shadowIdle  = t.dark
    ? '0 0 0 1px rgba(255,255,255,0.10)'
    : '0 0 0 1px rgba(12,30,60,0.10)'
  const shadowFocus = t.dark
    ? '0 0 0 2px rgba(251,191,36,0.30)'
    : '0 0 0 2px rgba(39,97,235,0.28)'

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: t.surface, boxShadow: t.cardShadow }}
    >
      {/* Nagłówek karty */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {editing ? (
              <input
                className="w-full rounded-lg px-3 py-1.5 text-sm font-semibold outline-none"
                style={{
                  background: t.surfaceInput,
                  color: t.ink,
                  boxShadow: t.dark ? '0 0 0 2px rgba(251,191,36,0.28)' : '0 0 0 2px rgba(39,97,235,0.25)',
                }}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
            ) : (
              <p className="text-sm font-bold leading-snug" style={{ color: t.ink }}>{note.title}</p>
            )}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-[11px]" style={{ color: t.inkMuted }}>{fmtDate(note.createdAt)}</span>
              {showUser && (
                <span
                  className="flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full"
                  style={{ background: t.blue.bg, color: t.blue.text }}
                >
                  <User className="h-2.5 w-2.5" />
                  {note.user.fullName}
                </span>
              )}
              {note.updatedAt !== note.createdAt && (
                <span className="text-[11px]" style={{ color: t.inkMuted }}>
                  (edytowano {fmtDate(note.updatedAt)})
                </span>
              )}
            </div>
          </div>

          {canEdit && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => { setEditing((v) => !v); setConfirming(false); setErr('') }}
                className="rounded-lg p-1.5 transition-colors"
                style={{ color: editing ? t.inkDim : t.inkMuted }}
                title="Edytuj"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => { setConfirming((v) => !v); setEditing(false); setErr('') }}
                className="rounded-lg p-1.5 transition-colors"
                style={{ color: confirming ? '#f43f5e' : t.inkMuted }}
                title="Usuń"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Treść */}
      {editing ? (
        <div className="px-4 pb-4 space-y-3">
          <textarea
            rows={4}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full rounded-xl resize-none text-sm outline-none"
            style={{
              background: t.surfaceInput, color: t.ink,
              padding: '0.625rem 0.875rem',
              boxShadow: shadowIdle,
            }}
            onFocus={(e)  => { e.currentTarget.style.boxShadow = shadowFocus }}
            onBlur={(e)   => { e.currentTarget.style.boxShadow = shadowIdle }}
          />
          {err && <p className="text-[12px] font-medium" style={{ color: '#f43f5e' }}>{err}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => updateMut.mutate()}
              disabled={updateMut.isPending}
              className="rounded-xl px-3 py-1.5 text-xs font-bold"
              style={t.dark
                ? { background: '#fbbf24', color: '#1c1400' }
                : { background: '#2761eb', color: '#fff' }
              }
            >
              {updateMut.isPending ? '…' : 'Zapisz'}
            </button>
            <button
              onClick={() => { setEditing(false); setTitle(note.title); setContent(note.content) }}
              className="rounded-xl px-3 py-1.5 text-xs font-semibold"
              style={{ background: t.dark ? 'rgba(255,255,255,0.07)' : 'rgba(12,30,60,0.07)', color: t.inkMuted }}
            >
              Anuluj
            </button>
          </div>
        </div>
      ) : (
        <div className="px-4 pb-4">
          <p
            className="text-sm whitespace-pre-wrap"
            style={{
              color: t.dark ? '#d1d5db' : '#374151',
              lineHeight: 1.6,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: expanded || !isLong ? 'none' : 4,
            } as React.CSSProperties}
          >
            {note.content}
          </p>
          {isLong && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1 mt-1.5 text-[12px] font-medium"
              style={{ color: t.inkDim }}
            >
              {expanded
                ? <><ChevronUp className="h-3.5 w-3.5" /> Zwiń</>
                : <><ChevronDown className="h-3.5 w-3.5" /> Pokaż więcej</>
              }
            </button>
          )}
        </div>
      )}

      {/* Potwierdzenie usunięcia */}
      {confirming && (
        <div
          className="mx-4 mb-4 rounded-xl px-4 py-3 flex items-center justify-between gap-3 animate-fade-in"
          style={{ background: 'rgba(244,63,94,0.07)', boxShadow: '0 0 0 1px rgba(244,63,94,0.20)' }}
        >
          <p className="text-sm font-medium" style={{ color: t.dark ? '#f87171' : '#be123c' }}>Usunąć notatkę?</p>
          <div className="flex gap-2">
            <button
              onClick={() => deleteMut.mutate()}
              disabled={deleteMut.isPending}
              className="rounded-xl px-3 py-1.5 text-xs font-bold"
              style={{ background: '#f43f5e', color: '#fff' }}
            >
              {deleteMut.isPending ? '…' : 'Usuń'}
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
      {err && !editing && !confirming && (
        <p className="px-4 pb-3 text-[12px] font-medium" style={{ color: '#f43f5e' }}>{err}</p>
      )}
    </div>
  )
}

// ── Widok główny ──────────────────────────────────────────────────────────────

export default function NotesPage() {
  const { isAdmin, user } = useAuthStore()
  const t = useTheme()
  const admin = isAdmin()
  const qc    = useQueryClient()

  const [showForm,  setShowForm]  = useState(false)
  const [filterUser, setFilterUser] = useState('')
  const [page, setPage] = useState(1)

  const params = { page, limit: 20, ...(filterUser ? { userId: filterUser } : {}) }

  const { data, isLoading } = useQuery({
    queryKey: ['notes', params],
    queryFn:  () => notesApi.list(params).then((r) => r.data.data),
  })

  const { data: usersData } = useQuery({
    queryKey: ['users-list'],
    queryFn:  () => usersApi.getAll().then((r) => r.data.data),
    enabled:  admin,
  })

  const notes      = data?.items ?? []
  const totalPages = data?.pages ?? 1

  return (
    <div className="animate-fade-in max-w-2xl mx-auto space-y-4">

      {/* Nagłówek */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Notatki</h1>
          <p className="text-sm mt-0.5" style={{ color: t.inkDim }}>
            {data?.total ?? 0} {data?.total === 1 ? 'notatka' : 'notatek'} łącznie
          </p>
        </div>
        {!showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-1" /> Nowa notatka
          </Button>
        )}
      </div>

      {/* Formularz nowej notatki */}
      {showForm && <NoteForm onClose={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ['notes'] }) }} />}

      {/* Filtr użytkownika (admin) */}
      {admin && (
        <div
          className="rounded-2xl p-4"
          style={{ background: t.surface, boxShadow: t.cardShadow }}
        >
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold uppercase tracking-wider shrink-0" style={{ color: t.inkMuted }}>
              Pracownik
            </label>
            <select
              value={filterUser}
              onChange={(e) => { setFilterUser(e.target.value); setPage(1) }}
              className="flex-1 rounded-xl px-3 py-2 text-sm outline-none appearance-none"
              style={{
                background: t.surfaceInput,
                color: t.ink,
                boxShadow: t.dark ? '0 0 0 1px rgba(255,255,255,0.10)' : '0 0 0 1px rgba(12,30,60,0.10)',
              }}
            >
              <option value="">— wszyscy —</option>
              {(usersData ?? []).map((u: UserType) => (
                <option key={u.id} value={u.id}>{u.fullName}</option>
              ))}
            </select>
            {filterUser && (
              <button
                onClick={() => { setFilterUser(''); setPage(1) }}
                className="text-xs font-medium shrink-0"
                style={{ color: t.inkDim }}
              >
                Wyczyść
              </button>
            )}
          </div>
        </div>
      )}

      {/* Lista */}
      {isLoading ? (
        <PageSpinner />
      ) : notes.length === 0 ? (
        <div
          className="rounded-2xl p-10 text-center"
          style={{ background: t.surface, boxShadow: t.cardShadow }}
        >
          <StickyNote className="h-10 w-10 mx-auto mb-3" style={{ color: t.inkMuted }} />
          <p className="font-semibold" style={{ color: t.ink }}>Brak notatek</p>
          <p className="text-sm mt-1" style={{ color: t.inkDim }}>
            {admin && filterUser ? 'Brak notatek dla wybranego pracownika.' : 'Dodaj pierwszą notatkę.'}
          </p>
          {!showForm && (
            <Button className="mt-4" size="sm" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-1" /> Nowa notatka
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              canEdit={admin || note.user.id === user?.id}
              showUser={admin && !filterUser}
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
    </div>
  )
}
