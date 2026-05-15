import { prisma } from '../../lib/prisma'
import { ApiError } from '../../shared/ApiError'
import { CreateEntryDto, UpdateEntryDto, ListQuery } from './dailyReport.schemas'
import * as XLSX from 'xlsx'

// ─── helpers ───────────────────────────────────────────────────────────────

function isLocked(reportDate: Date, unlockedUntil?: Date | null): boolean {
  const now = new Date()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const rd = new Date(reportDate)
  rd.setHours(0, 0, 0, 0)
  if (rd >= today) return false
  if (unlockedUntil && unlockedUntil > now) return false
  return true
}

// Zwraca true gdy dwa przedziały czasowe [s1,e1) i [s2,e2) nakładają się (stykanie się = OK)
function overlaps(s1: string, e1: string, s2: string, e2: string): boolean {
  return s1 < e2 && s2 < e1
}

async function checkNoOverlap(
  userId: string,
  reportDate: Date,
  workStart: string,
  workEnd: string,
  excludeEntryId?: string,
) {
  const where: Parameters<typeof prisma.reportEntry.findMany>[0]['where'] = {
    report: { userId, reportDate },
  }
  if (excludeEntryId) where.id = { not: excludeEntryId }

  const existing = await prisma.reportEntry.findMany({ where, select: { workStart: true, workEnd: true } })
  for (const e of existing) {
    if (overlaps(workStart, workEnd, e.workStart, e.workEnd)) {
      throw ApiError.badRequest(
        `Godziny ${workStart}–${workEnd} nakładają się z istniejącym wpisem ${e.workStart}–${e.workEnd}`
      )
    }
  }
}

function calcHours(start: string, end: string): string {
  try {
    const [sh, sm] = start.split(':').map(Number)
    const [eh, em] = end.split(':').map(Number)
    const mins = (eh * 60 + em) - (sh * 60 + sm)
    if (mins < 0) return ''
    return `${Math.floor(mins / 60)}h ${mins % 60}m`
  } catch {
    return ''
  }
}

// ─── selectors ─────────────────────────────────────────────────────────────

// Lean — używany w list(), create(), addEntry(), updateEntry()
const entrySelect = {
  id: true,
  workStart: true,
  workEnd: true,
  location:   { select: { id: true, name: true } },
  department: { select: { id: true, name: true } },
  description: true,
  createdAt: true,
  updatedAt: true,
  vehicleUsages: {
    select: {
      id: true,
      kmDriven: true,
      vehicle: { select: { id: true, plateNumber: true, name: true } },
    },
  },
}

// Full — używany tylko w getById (zawiera materialUsages per entry)
const entrySelectFull = {
  ...entrySelect,
  materialUsages: {
    select: {
      id: true,
      materialId: true,
      material: { select: { id: true, name: true, catalogNumber: true } },
      quantity: true,
      unit: true,
      notes: true,
      usedAt: true,
    },
    orderBy: { usedAt: 'asc' as const },
  },
}

const reportSelect = {
  id: true,
  reportDate: true,
  approvedAt: true,
  isOffer: true,
  unlockedUntil: true,
  approvedBy: { select: { id: true, fullName: true } },
  createdAt: true,
  updatedAt: true,
  user: { select: { id: true, fullName: true, login: true } },
  entries: {
    select: entrySelect,
    orderBy: { workStart: 'asc' as const },
  },
  signatures: {
    select: {
      id: true,
      signedAt: true,
      signer: { select: { id: true, fullName: true } },
    },
  },
}

// Full report select — tylko getById
const reportSelectFull = {
  ...reportSelect,
  entries: {
    select: entrySelectFull,
    orderBy: { workStart: 'asc' as const },
  },
  equipmentRentals: {
    select: {
      id:             true,
      itemId:         true,
      item:           { select: { id: true, name: true, category: { select: { id: true, name: true } } } },
      locationId:     true,
      location:       { select: { id: true, name: true } },
      rentedAt:       true,
      expectedReturn: true,
      returnedAt:     true,
      returnNotes:    true,
    },
    orderBy: { rentedAt: 'asc' as const },
  },
}

// ─── service ───────────────────────────────────────────────────────────────

export async function list(query: ListQuery, requesterId: string, requesterRole: string) {
  const where: Record<string, unknown> = {}

  if (requesterRole !== 'admin') {
    where.OR = [
      { userId: requesterId },
      { signatures: { some: { signerId: requesterId } } },
    ]
  } else if (query.userId) {
    where.userId = query.userId
  }

  if (query.from || query.to) {
    where.reportDate = {
      ...(query.from ? { gte: new Date(query.from) } : {}),
      ...(query.to   ? { lte: new Date(query.to + 'T23:59:59') } : {}),
    }
  }

  if (query.locationId || query.departmentId) {
    where.entries = {
      some: {
        ...(query.locationId   ? { locationId:   query.locationId }   : {}),
        ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      },
    }
  }

  const [total, items] = await Promise.all([
    prisma.dailyReport.count({ where }),
    prisma.dailyReport.findMany({
      where,
      select: reportSelect,
      orderBy: [{ reportDate: 'desc' }, { createdAt: 'desc' }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ])

  return {
    items: items.map((r) => ({
      ...r,
      isLocked: isLocked(r.reportDate, r.unlockedUntil),
      isSigned: r.signatures.some((s) => s.signer.id === requesterId),
    })),
    total,
    page: query.page,
    limit: query.limit,
    pages: Math.ceil(total / query.limit),
  }
}

export async function getById(id: string, requesterId: string, requesterRole: string) {
  const report = await prisma.dailyReport.findUnique({ where: { id }, select: reportSelectFull })
  if (!report) throw ApiError.notFound('Raport nie istnieje')
  if (requesterRole !== 'admin' && report.user.id !== requesterId) {
    const isSigned = report.signatures.some((s) => s.signer.id === requesterId)
    if (!isSigned) throw ApiError.forbidden()
  }

  return {
    ...report,
    isLocked: isLocked(report.reportDate, report.unlockedUntil),
    isSigned: report.signatures.some((s) => s.signer.id === requesterId),
  }
}

/** Tworzy nowy raport. Pracownik zawsze dla daty dzisiejszej, admin może podać datę. */
export async function create(userId: string, role: string, dateStr?: string) {
  const reportDate = dateStr && role === 'admin'
    ? new Date(dateStr)
    : new Date(new Date().toISOString().slice(0, 10))

  const report = await prisma.dailyReport.create({
    data: { userId, reportDate },
    select: reportSelect,
  })
  return { ...report, isLocked: isLocked(report.reportDate, report.unlockedUntil) }
}

export async function addEntry(
  reportId: string,
  dto: CreateEntryDto,
  requesterId: string,
  requesterRole: string,
) {
  const report = await prisma.dailyReport.findUnique({ where: { id: reportId } })
  if (!report) throw ApiError.notFound('Raport nie istnieje')
  if (report.userId !== requesterId && requesterRole !== 'admin') {
    const sig = await prisma.reportSignature.findUnique({
      where: { reportId_signerId: { reportId, signerId: requesterId } },
    })
    if (!sig) throw ApiError.forbidden()
  }
  if (requesterRole !== 'admin' && isLocked(report.reportDate, report.unlockedUntil)) {
    throw ApiError.forbidden('Raport z poprzedniego dnia jest zablokowany')
  }

  const entryCount = await prisma.reportEntry.count({ where: { reportId } })
  if (entryCount >= 1) {
    throw ApiError.badRequest('Raport może mieć tylko jeden wpis. Utwórz nowy raport dla kolejnego wpisu.')
  }

  await checkNoOverlap(report.userId, report.reportDate, dto.workStart, dto.workEnd)

  const loc = await prisma.location.findUnique({ where: { id: dto.locationId } })
  if (!loc) throw ApiError.notFound('Lokalizacja nie istnieje')

  if (dto.departmentId) {
    const dept = await prisma.department.findUnique({ where: { id: dto.departmentId } })
    if (!dept) throw ApiError.notFound('Wydział nie istnieje')
    if (dept.locationId !== dto.locationId) throw ApiError.badRequest('Wydział nie należy do wybranej lokalizacji')
  }

  return prisma.reportEntry.create({
    data: {
      reportId,
      workStart:    dto.workStart,
      workEnd:      dto.workEnd,
      locationId:   dto.locationId,
      departmentId: dto.departmentId ?? null,
      description:  dto.description,
      vehicleUsages: dto.vehicleUsages?.length
        ? { createMany: { data: dto.vehicleUsages.map((v) => ({ vehicleId: v.vehicleId, kmDriven: v.kmDriven })) } }
        : undefined,
    },
    select: entrySelect,
  })
}

export async function updateEntry(
  entryId: string,
  dto: UpdateEntryDto,
  requesterId: string,
  requesterRole: string,
) {
  const entry = await prisma.reportEntry.findUnique({
    where: { id: entryId },
    include: { report: true },
  })
  if (!entry) throw ApiError.notFound('Wpis nie istnieje')
  if (entry.report.userId !== requesterId && requesterRole !== 'admin') {
    const sig = await prisma.reportSignature.findUnique({
      where: { reportId_signerId: { reportId: entry.report.id, signerId: requesterId } },
    })
    if (!sig) throw ApiError.forbidden()
  }
  if (requesterRole !== 'admin' && isLocked(entry.report.reportDate, entry.report.unlockedUntil)) {
    throw ApiError.forbidden('Raport z poprzedniego dnia jest zablokowany')
  }

  const newStart = dto.workStart ?? entry.workStart
  const newEnd   = dto.workEnd   ?? entry.workEnd
  await checkNoOverlap(entry.report.userId, entry.report.reportDate, newStart, newEnd, entryId)

  if (dto.departmentId) {
    const targetLocationId = dto.locationId ?? entry.locationId
    const dept = await prisma.department.findUnique({ where: { id: dto.departmentId } })
    if (!dept) throw ApiError.notFound('Wydział nie istnieje')
    if (dept.locationId !== targetLocationId) throw ApiError.badRequest('Wydział nie należy do wybranej lokalizacji')
  }

  if (dto.vehicleUsages !== undefined) {
    await prisma.vehicleUsage.deleteMany({ where: { entryId } })
  }

  return prisma.reportEntry.update({
    where: { id: entryId },
    data: {
      workStart:    dto.workStart,
      workEnd:      dto.workEnd,
      locationId:   dto.locationId,
      departmentId: dto.departmentId,
      description:  dto.description,
      vehicleUsages: dto.vehicleUsages?.length
        ? { createMany: { data: dto.vehicleUsages.map((v) => ({ vehicleId: v.vehicleId, kmDriven: v.kmDriven })) } }
        : undefined,
    },
    select: entrySelect,
  })
}

export async function deleteEntry(
  entryId: string,
  requesterId: string,
  requesterRole: string,
) {
  const entry = await prisma.reportEntry.findUnique({
    where: { id: entryId },
    include: { report: true },
  })
  if (!entry) throw ApiError.notFound('Wpis nie istnieje')
  if (entry.report.userId !== requesterId && requesterRole !== 'admin') {
    const sig = await prisma.reportSignature.findUnique({
      where: { reportId_signerId: { reportId: entry.report.id, signerId: requesterId } },
    })
    if (!sig) throw ApiError.forbidden()
  }
  if (requesterRole !== 'admin' && isLocked(entry.report.reportDate, entry.report.unlockedUntil)) {
    throw ApiError.forbidden('Raport z poprzedniego dnia jest zablokowany')
  }

  await prisma.reportEntry.delete({ where: { id: entryId } })
}

// ─── Zatwierdzanie raportu (admin) ──────────────────────────────────────────

export async function approveReport(
  reportId: string,
  approverId: string,
  isOffer: 'offer' | 'no_offer' | 'to_quote' | null,
) {
  const report = await prisma.dailyReport.findUnique({ where: { id: reportId } })
  if (!report) throw ApiError.notFound('Raport nie istnieje')

  const updated = await prisma.dailyReport.update({
    where: { id: reportId },
    data: isOffer === null
      ? { approvedAt: null, approvedById: null, isOffer: null }
      : { approvedAt: new Date(), approvedById: approverId, isOffer },
    select: reportSelect,
  })
  return { ...updated, isLocked: isLocked(updated.reportDate, updated.unlockedUntil) }
}

// ─── Sygnatury ──────────────────────────────────────────────────────────────

export async function signOnto(callerId: string, callerRole: string, reportId: string, targetSignerId?: string) {
  const effectiveSignerId = (callerRole === 'admin' && targetSignerId) ? targetSignerId : callerId
  const report = await prisma.dailyReport.findUnique({ where: { id: reportId } })
  if (!report) throw ApiError.notFound('Raport nie istnieje')
  if (report.userId === effectiveSignerId) throw ApiError.badRequest('Pracownik jest właścicielem tego raportu')
  // Admin podpisuje za pracownika — pomijamy blokadę daty
  if (callerRole !== 'admin' && isLocked(report.reportDate, report.unlockedUntil)) {
    throw ApiError.forbidden('Można podpisywać się tylko pod raporty z bieżącego dnia')
  }

  const existing = await prisma.reportSignature.findUnique({
    where: { reportId_signerId: { reportId, signerId: effectiveSignerId } },
  })
  if (existing) throw ApiError.conflict('Ten pracownik jest już podpisany pod raport')

  return prisma.reportSignature.create({
    data: { reportId, signerId: effectiveSignerId },
    select: { id: true, signedAt: true, signer: { select: { id: true, fullName: true } } },
  })
}

export async function signOff(callerId: string, callerRole: string, reportId: string, targetSignerId?: string) {
  const signerId = callerRole === 'admin' && targetSignerId ? targetSignerId : callerId

  const sig = await prisma.reportSignature.findUnique({
    where: { reportId_signerId: { reportId, signerId } },
  })
  if (!sig) throw ApiError.notFound('Podpis nie istnieje')

  await prisma.reportSignature.delete({
    where: { reportId_signerId: { reportId, signerId } },
  })
}

export async function availableToSign(userId: string) {
  const today = new Date(new Date().toISOString().slice(0, 10))
  const now = new Date()
  return prisma.dailyReport.findMany({
    where: {
      userId: { not: userId },
      signatures: { none: { signerId: userId } },
      OR: [
        { reportDate: today },
        { unlockedUntil: { gt: now } },
      ],
    },
    select: {
      id: true,
      user: { select: { id: true, fullName: true } },
      entries: {
        select: entrySelect,
        orderBy: { workStart: 'asc' as const },
      },
    },
  })
}

// ─── Odblokowanie raportu (admin) ────────────────────────────────────────────

export async function unlockReport(reportId: string) {
  const report = await prisma.dailyReport.findUnique({ where: { id: reportId } })
  if (!report) throw ApiError.notFound('Raport nie istnieje')

  const unlockedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const updated = await prisma.dailyReport.update({
    where: { id: reportId },
    data: { unlockedUntil },
    select: reportSelect,
  })
  return { ...updated, isLocked: false }
}

// ─── Usunięcie raportu (admin) ───────────────────────────────────────────────

export async function deleteReport(reportId: string) {
  const report = await prisma.dailyReport.findUnique({
    where: { id: reportId },
    include: { _count: { select: { entries: true } } },
  })
  if (!report) throw ApiError.notFound('Raport nie istnieje')
  if (report.approvedAt !== null) {
    throw ApiError.badRequest('Nie można usunąć zatwierdzonego raportu. Cofnij zatwierdzenie i spróbuj ponownie.')
  }
  if (report._count.entries > 0) {
    throw ApiError.badRequest('Nie można usunąć raportu zawierającego wpisy. Usuń najpierw wszystkie wpisy.')
  }

  await prisma.$transaction([
    prisma.materialUsage.updateMany({ where: { reportId }, data: { reportId: null } }),
    prisma.equipmentRental.updateMany({ where: { reportId }, data: { reportId: null } }),
    prisma.purchaseOrder.updateMany({ where: { reportId }, data: { reportId: null } }),
    prisma.dailyReport.delete({ where: { id: reportId } }),
  ])
}

// ─── XLSX export ────────────────────────────────────────────────────────────

export async function exportXlsx(query: {
  from?: string
  to?: string
  userId?: string
  locationId?: string
  departmentId?: string
}) {
  const where: Record<string, unknown> = {}
  if (query.userId) where.userId = query.userId
  if (query.from || query.to) {
    where.reportDate = {
      ...(query.from ? { gte: new Date(query.from) } : {}),
      ...(query.to   ? { lte: new Date(query.to + 'T23:59:59') } : {}),
    }
  }
  if (query.locationId || query.departmentId) {
    where.entries = {
      some: {
        ...(query.locationId   ? { locationId:   Number(query.locationId) }   : {}),
        ...(query.departmentId ? { departmentId: Number(query.departmentId) } : {}),
      },
    }
  }

  const reports = await prisma.dailyReport.findMany({
    where,
    select: reportSelectFull,
    orderBy: [{ reportDate: 'asc' }, { user: { fullName: 'asc' } }],
  })

  // ── Arkusz 1: Raporty (jeden wiersz per wpis per pracownik) ───────────────
  const reportRows: object[] = []

  for (const r of reports) {
    const workers = [
      { id: r.user.id, fullName: r.user.fullName, isSigned: false },
      ...r.signatures.map((s) => ({ id: s.signer.id, fullName: s.signer.fullName, isSigned: true })),
    ]
    for (const worker of workers) {
      for (const e of r.entries) {
        reportRows.push({
          'Data':           new Date(r.reportDate).toLocaleDateString('pl-PL'),
          'Pracownik':      worker.fullName,
          'Podpisany':      worker.isSigned ? 'Tak' : '',
          'Lokalizacja':    e.location.name,
          'Wydział':        e.department?.name ?? '',
          'Godzina od':     e.workStart,
          'Godzina do':     e.workEnd,
          'Przepracowane':  calcHours(e.workStart, e.workEnd),
          'Opis pracy':     e.description,
          'Pojazdy':        e.vehicleUsages.map((v) => `${v.vehicle.plateNumber} (${v.kmDriven} km)`).join(', '),
          'Km łącznie':     e.vehicleUsages.reduce((s, v) => s + v.kmDriven, 0) || '',
        })
      }
    }
  }

  // ── Arkusz 2: Materiały (per wpis raportu) ──────────────────────────────
  const materialRows: object[] = []
  for (const r of reports) {
    for (const e of r.entries) {
      // materialUsages jest w entrySelectFull (używanym przez reportSelectFull)
      const mats = (e as unknown as { materialUsages: Array<{
        id: string; quantity: unknown; unit: string; notes: string | null
        material: { id: number; name: string; catalogNumber: string | null }
      }> }).materialUsages ?? []
      for (const m of mats) {
        materialRows.push({
          'Data':          new Date(r.reportDate).toLocaleDateString('pl-PL'),
          'Pracownik':     r.user.fullName,
          'Lokalizacja':   e.location.name,
          'Wydział':       e.department?.name ?? '',
          'Nr katalogowy': m.material.catalogNumber ?? '',
          'Materiał':      m.material.name,
          'Ilość':         Number(m.quantity),
          'Jednostka':     m.unit,
          'Uwagi':         m.notes ?? '',
        })
      }
    }
  }

  // ── Budujemy plik XLSX ─────────────────────────────────────────────────────
  const wb = XLSX.utils.book_new()

  const ws1 = XLSX.utils.json_to_sheet(reportRows.length > 0 ? reportRows : [{}])
  ws1['!cols'] = [
    { wch: 12 }, { wch: 24 }, { wch: 10 }, { wch: 22 }, { wch: 18 },
    { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 50 }, { wch: 30 }, { wch: 12 },
  ]
  XLSX.utils.book_append_sheet(wb, ws1, 'Raporty')

  const ws2 = XLSX.utils.json_to_sheet(materialRows.length > 0 ? materialRows : [{}])
  ws2['!cols'] = [
    { wch: 12 }, { wch: 24 }, { wch: 22 }, { wch: 18 },
    { wch: 16 }, { wch: 50 }, { wch: 10 }, { wch: 12 }, { wch: 30 },
  ]
  XLSX.utils.book_append_sheet(wb, ws2, 'Materiały')

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
}
