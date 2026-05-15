import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileText, Wrench, Package, Clock, User, MapPin, CheckCircle, ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '@/lib/theme'
import { reportsApi }         from '@/api/reports.api'
import { rentalsApi }         from '@/api/equipment.api'
import { materialUsagesApi }  from '@/api/materials.api'

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10)
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
}

function fmtDateTime(iso: string) {
  return `${fmtDate(iso)}, ${fmtTime(iso)}`
}

function StatTile({ icon, label, value, color }: {
  icon: React.ReactNode
  label: string
  value: number
  color: string
}) {
  const t = useTheme()
  return (
    <div style={{ background: t.surface, boxShadow: t.cardShadow, borderRadius: 16, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 12, color: t.inkMuted, marginTop: 2 }}>{label}</div>
      </div>
    </div>
  )
}

function SectionHeader({ icon, title, count, color }: { icon: React.ReactNode; title: string; count: number; color: string }) {
  const t = useTheme()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
        {icon}
      </div>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: t.ink, flex: 1 }}>{title}</h2>
      <span style={{ fontSize: 12, fontWeight: 600, color: t.inkMuted, background: t.surfaceMuted, borderRadius: 20, padding: '2px 10px' }}>
        {count}
      </span>
    </div>
  )
}

export default function DayOverview() {
  const navigate = useNavigate()
  const t = useTheme()

  const [date, setDate] = useState(toDateStr(new Date()))

  const { data: reportsData, isLoading: loadingReports } = useQuery({
    queryKey: ['day-overview-reports', date],
    queryFn: () => reportsApi.list({ from: date, to: date, limit: 100 }),
  })

  const { data: rentalsData, isLoading: loadingRentals } = useQuery({
    queryKey: ['day-overview-rentals', date],
    queryFn: () => rentalsApi.getAll({ date }),
  })

  const { data: usagesData, isLoading: loadingUsages } = useQuery({
    queryKey: ['day-overview-usages', date],
    queryFn: () => materialUsagesApi.list({ from: date, to: date, limit: 100 }),
  })

  const reports  = reportsData?.data.data.items  ?? []
  const rentals  = rentalsData?.data.data         ?? []
  const usages   = usagesData?.data.data.items    ?? []

  const loading = loadingReports || loadingRentals || loadingUsages

  const fmtDateDisplay = new Date(date + 'T12:00:00').toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="animate-fade-in space-y-6">

      {/* Nagłówek */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => navigate('/')}
          style={{ width: 36, height: 36, borderRadius: 10, border: 'none', background: t.surfaceMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.inkMuted, flexShrink: 0 }}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: t.ink, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            Przegląd Dnia
          </h1>
          <p style={{ fontSize: 13, color: t.inkMuted, marginTop: 2, textTransform: 'capitalize' }}>
            {fmtDateDisplay}
          </p>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{
              background: t.surfaceInput, border: 'none', borderRadius: 10,
              padding: '8px 12px', fontSize: 14, color: t.ink,
              boxShadow: t.cardShadow, cursor: 'pointer',
            }}
          />
        </div>
      </div>

      {/* Podsumowanie */}
      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
          <StatTile icon={<FileText className="h-5 w-5" />} label="Raporty" value={reports.length} color="#2761eb" />
          <StatTile icon={<Wrench className="h-5 w-5" />} label="Wypożyczenia" value={rentals.length} color="#0891b2" />
          <StatTile icon={<Package className="h-5 w-5" />} label="Zużycia materiałów" value={usages.length} color="#059669" />
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: t.inkMuted, fontSize: 14 }}>
          Ładowanie danych…
        </div>
      )}

      {!loading && (
        <>
          {/* ── Raporty ───────────────────────────── */}
          <section>
            <SectionHeader icon={<FileText className="h-4 w-4" />} title="Raporty Dnia" count={reports.length} color="#2761eb" />
            {reports.length === 0 ? (
              <p style={{ fontSize: 13, color: t.inkMuted, padding: '12px 0' }}>Brak raportów w wybranym dniu.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {reports.map((r) => (
                  <div key={r.id} style={{ background: t.surface, boxShadow: t.cardShadow, borderRadius: 14, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <User className="h-3.5 w-3.5" style={{ color: t.inkMuted, flexShrink: 0 }} />
                        <span style={{ fontSize: 14, fontWeight: 600, color: t.ink }}>{r.user.fullName}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {r.isLocked && (
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: t.blue.bg, boxShadow: t.blue.ring, color: t.blue.text }}>
                            Zamknięty
                          </span>
                        )}
                        {r.approvedAt && (
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: t.green.bg, boxShadow: t.green.ring, color: t.green.text }}>
                            Zatwierdzony
                          </span>
                        )}
                        {r.isOffer && (
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: t.amber.bg, boxShadow: t.amber.ring, color: t.amber.text }}>
                            Oferta
                          </span>
                        )}
                      </div>
                    </div>
                    {r.entries.map((e) => (
                      <div key={e.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 0', borderTop: `1px solid ${t.border}` }}>
                        <Clock className="h-3.5 w-3.5 mt-0.5" style={{ color: t.inkMuted, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, color: t.ink }}>
                            <span style={{ fontWeight: 600 }}>{e.workStart}–{e.workEnd}</span>
                            {' · '}
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                              <MapPin className="h-3 w-3" style={{ color: t.inkMuted }} />
                              {e.location.name}
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: t.inkMuted, marginTop: 2, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {e.description}
                          </div>
                        </div>
                        {e.vehicleUsages.length > 0 && (
                          <span style={{ fontSize: 11, color: t.inkMuted, flexShrink: 0 }}>
                            {e.vehicleUsages.map(v => `${v.vehicle.plateNumber} +${v.kmDriven} km`).join(', ')}
                          </span>
                        )}
                      </div>
                    ))}
                    {r.signatures.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${t.border}` }}>
                        {r.signatures.map((s) => (
                          <span key={s.id} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: t.green.bg, boxShadow: t.green.ring, color: t.green.text, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <CheckCircle className="h-3 w-3" />
                            {s.signer.fullName}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Wypożyczenia ─────────────────────── */}
          <section>
            <SectionHeader icon={<Wrench className="h-4 w-4" />} title="Wypożyczenia Sprzętu" count={rentals.length} color="#0891b2" />
            {rentals.length === 0 ? (
              <p style={{ fontSize: 13, color: t.inkMuted, padding: '12px 0' }}>Brak wypożyczeń w wybranym dniu.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {rentals.map((r) => {
                  const returned = !!r.returnedAt
                  const color = returned ? t.green : t.blue
                  return (
                    <div key={r.id} style={{ background: color.bg, boxShadow: color.ring, borderRadius: 14, padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>{r.item.name}</div>
                          <div style={{ fontSize: 12, color: t.inkMuted, marginTop: 2 }}>{r.item.category.name}</div>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 20, background: color.bg, boxShadow: color.ring, color: color.text, flexShrink: 0 }}>
                          {returned ? 'Zwrócony' : 'Aktywny'}
                        </span>
                      </div>
                      <div style={{ marginTop: 8, fontSize: 12, color: t.inkMuted, display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
                        <span><User className="h-3 w-3 inline mr-1" />{r.user.fullName}</span>
                        <span><MapPin className="h-3 w-3 inline mr-1" />{r.location.name}</span>
                        <span><Clock className="h-3 w-3 inline mr-1" />Wypożyczono: {fmtDateTime(r.rentedAt)}</span>
                        {r.expectedReturn && !r.returnedAt && <span>Termin: {fmtDateTime(r.expectedReturn)}</span>}
                        {r.returnedAt && <span>Zwrócono: {fmtDateTime(r.returnedAt)}</span>}
                      </div>
                      {r.returnNotes && (
                        <div style={{ marginTop: 6, fontSize: 12, color: t.inkMuted, fontStyle: 'italic' }}>
                          Uwagi: {r.returnNotes}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* ── Materiały ────────────────────────── */}
          <section>
            <SectionHeader icon={<Package className="h-4 w-4" />} title="Zużycie Materiałów" count={usages.length} color="#059669" />
            {usages.length === 0 ? (
              <p style={{ fontSize: 13, color: t.inkMuted, padding: '12px 0' }}>Brak zużyć materiałów w wybranym dniu.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {usages.map((u) => (
                  <div key={u.id} style={{ background: t.surface, boxShadow: t.cardShadow, borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: t.ink }}>{u.material.name}</div>
                      <div style={{ fontSize: 12, color: t.inkMuted, marginTop: 2 }}>
                        <User className="h-3 w-3 inline mr-1" />{u.user.fullName}
                        {u.notes && ` · ${u.notes}`}
                      </div>
                    </div>
                    <div style={{ flexShrink: 0, textAlign: 'right' }}>
                      <span style={{ fontSize: 16, fontWeight: 700, color: t.green.text }}>{u.quantity} {u.unit}</span>
                      <div style={{ fontSize: 11, color: t.inkMuted, marginTop: 1 }}>{fmtTime(u.usedAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
