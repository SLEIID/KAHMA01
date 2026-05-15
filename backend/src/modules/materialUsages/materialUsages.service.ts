import * as XLSX from 'xlsx'
import { prisma } from '../../lib/prisma'
import { ApiError } from '../../shared/ApiError'
import { CreateUsageDto, ListUsagesDto, ExportUsagesDto, UpdateUsageDto } from './materialUsages.schemas'

const usageInclude = {
  material:   { select: { id: true, name: true, photoUrl: true, catalogNumber: true } },
  user:       { select: { id: true, fullName: true } },
  report:     { select: { id: true, reportDate: true } },
  entry:      { select: { id: true, locationId: true, departmentId: true, reportId: true } },
  location:   { select: { id: true, name: true } },
  department: { select: { id: true, name: true } },
} as const

export async function create(userId: string, role: string, dto: CreateUsageDto) {
  const mat = await prisma.material.findUnique({ where: { id: dto.materialId } })
  if (!mat) throw ApiError.notFound('Materiał nie istnieje')

  let resolvedReportId:     string | null = dto.reportId     ?? null
  let resolvedLocationId:   number | null = dto.locationId   ?? null
  let resolvedDepartmentId: number | null = dto.departmentId ?? null

  // Gdy podano entryId — pobierz lokalizację/wydział/raport z wpisu
  if (dto.entryId) {
    const entry = await prisma.reportEntry.findUnique({
      where:   { id: dto.entryId },
      include: { report: { include: { signatures: { select: { signerId: true } } } } },
    })
    if (!entry) throw ApiError.notFound('Wpis nie istnieje')

    if (role !== 'admin') {
      const isSigner = entry.report.signatures.some((s) => s.signerId === userId)
      if (entry.report.userId !== userId && !isSigner) throw ApiError.forbidden()
    }

    resolvedReportId     = entry.reportId
    resolvedLocationId   = entry.locationId
    resolvedDepartmentId = entry.departmentId ?? null
  } else if (dto.reportId) {
    const report = await prisma.dailyReport.findUnique({
      where:   { id: dto.reportId },
      include: { signatures: { select: { signerId: true } } },
    })
    if (!report) throw ApiError.notFound('Raport nie istnieje')
    const isSigner = report.signatures.some((s) => s.signerId === userId)
    if (report.userId !== userId && !isSigner) throw ApiError.forbidden()
  }

  return prisma.materialUsage.create({
    data: {
      entryId:      dto.entryId      ?? null,
      reportId:     resolvedReportId,
      materialId:   dto.materialId,
      userId,
      locationId:   resolvedLocationId,
      departmentId: resolvedDepartmentId,
      quantity:     dto.quantity,
      unit:         dto.unit,
      notes:        dto.notes ?? null,
    },
    include: usageInclude,
  })
}

function buildWhere(dto: ListUsagesDto | ExportUsagesDto, requesterId: string, role: string) {
  const where: Record<string, unknown> = {}

  if (role !== 'admin') {
    where.userId = requesterId
  } else if ('userId' in dto && dto.userId) {
    where.userId = dto.userId
  }

  if ('materialId' in dto && dto.materialId) where.materialId = dto.materialId
  if ('reportId'   in dto && dto.reportId)   where.reportId   = dto.reportId
  if (dto.locationId)   where.locationId   = dto.locationId
  if (dto.departmentId) where.departmentId = dto.departmentId

  if (dto.from || dto.to) {
    where.usedAt = {
      ...(dto.from ? { gte: new Date(dto.from) }                    : {}),
      ...(dto.to   ? { lte: new Date(dto.to + 'T23:59:59Z') } : {}),
    }
  }

  return where
}

export async function getList(requesterId: string, role: string, dto: ListUsagesDto) {
  const { page, limit } = dto
  const skip  = (page - 1) * limit
  const where = buildWhere(dto, requesterId, role)

  const [items, total] = await Promise.all([
    prisma.materialUsage.findMany({
      where,
      include: usageInclude,
      orderBy: { usedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.materialUsage.count({ where }),
  ])

  return { items, total, page, limit }
}

export async function remove(id: string, userId: string, role: string) {
  const usage = await prisma.materialUsage.findUnique({ where: { id } })
  if (!usage) throw ApiError.notFound('Pobranie nie istnieje')
  if (role !== 'admin' && usage.userId !== userId) throw ApiError.forbidden()

  if (role !== 'admin') {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (usage.usedAt < today) {
      throw ApiError.badRequest('Możesz usunąć tylko pobranie z bieżącego dnia')
    }
  }

  await prisma.materialUsage.delete({ where: { id } })
}

export async function update(id: string, userId: string, role: string, dto: UpdateUsageDto) {
  const usage = await prisma.materialUsage.findUnique({ where: { id } })
  if (!usage) throw ApiError.notFound('Pobranie nie istnieje')
  if (role !== 'admin' && usage.userId !== userId) throw ApiError.forbidden()

  return prisma.materialUsage.update({
    where: { id },
    data: {
      quantity: dto.quantity,
      unit:     dto.unit,
      notes:    dto.notes ?? null,
    },
    include: usageInclude,
  })
}

// ─── Eksport z filtrami ───────────────────────────────────────────────────────

export async function exportFiltered(dto: ExportUsagesDto) {
  const where = buildWhere(dto, '', 'admin')

  const usages = await prisma.materialUsage.findMany({
    where,
    include: usageInclude,
    orderBy: [{ usedAt: 'desc' }],
  })

  const ws = XLSX.utils.json_to_sheet(
    usages.map(r => ({
      'Data':          r.usedAt.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      'Pracownik':     r.user.fullName,
      'Lokalizacja':   r.location?.name ?? '',
      'Wydział':       r.department?.name ?? '',
      'Nr katalogowy': r.material.catalogNumber ?? '',
      'Materiał':      r.material.name,
      'Ilość':         Number(r.quantity),
      'Jednostka':     r.unit,
      'Uwagi':         r.notes ?? '',
    }))
  )
  ws['!cols'] = [
    { wch: 12 }, { wch: 22 }, { wch: 20 }, { wch: 20 },
    { wch: 16 }, { wch: 50 }, { wch: 10 }, { wch: 12 }, { wch: 30 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Zużycie materiałów')
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
}

// ─── Zestawienie miesięczne ───────────────────────────────────────────────────

export async function getMonthlySummary(year: number, month: number) {
  const from = new Date(year, month - 1, 1)
  const to   = new Date(year, month,     0, 23, 59, 59)
  const where = { usedAt: { gte: from, lte: to } }

  const [overallRaw, byEmployeeRaw] = await Promise.all([
    prisma.materialUsage.groupBy({
      by:      ['materialId', 'unit'],
      where,
      _sum:    { quantity: true },
      _count:  { _all: true },
      orderBy: { materialId: 'asc' },
    }),
    prisma.materialUsage.groupBy({
      by:      ['userId', 'materialId', 'unit'],
      where,
      _sum:    { quantity: true },
      orderBy: [{ userId: 'asc' }, { materialId: 'asc' }],
    }),
  ])

  const materialIds = [...new Set([
    ...overallRaw.map(r => r.materialId),
    ...byEmployeeRaw.map(r => r.materialId),
  ])]
  const userIds = [...new Set(byEmployeeRaw.map(r => r.userId))]

  const [materials, users] = await Promise.all([
    prisma.material.findMany({ where: { id: { in: materialIds } }, select: { id: true, name: true, catalogNumber: true } }),
    prisma.user.findMany(    { where: { id: { in: userIds      } }, select: { id: true, fullName: true } }),
  ])

  const matMap  = new Map(materials.map(m => [m.id, m]))
  const userMap = new Map(users.map(u     => [u.id, u.fullName]))

  const overall = overallRaw
    .map(r => ({
      materialId:    r.materialId,
      catalogNumber: matMap.get(r.materialId)?.catalogNumber ?? '',
      materialName:  matMap.get(r.materialId)?.name ?? '?',
      unit:          r.unit,
      totalQuantity: Number(r._sum.quantity ?? 0),
      usageCount:    r._count._all,
    }))
    .sort((a, b) => a.materialName.localeCompare(b.materialName, 'pl'))

  type EmpEntry = { userId: string; fullName: string; materials: typeof overall; totalUsageCount: number }
  const empMap = new Map<string, EmpEntry>()
  for (const r of byEmployeeRaw) {
    if (!empMap.has(r.userId)) {
      empMap.set(r.userId, { userId: r.userId, fullName: userMap.get(r.userId) ?? '?', materials: [], totalUsageCount: 0 })
    }
    const e = empMap.get(r.userId)!
    e.materials.push({
      materialId:    r.materialId,
      catalogNumber: matMap.get(r.materialId)?.catalogNumber ?? '',
      materialName:  matMap.get(r.materialId)?.name ?? '?',
      unit:          r.unit,
      totalQuantity: Number(r._sum.quantity ?? 0),
      usageCount:    0,
    })
  }

  const byEmployee = [...empMap.values()]
    .map(e => ({
      ...e,
      totalUsageCount: e.materials.length,
      materials: e.materials.sort((a, b) => a.materialName.localeCompare(b.materialName, 'pl')),
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, 'pl'))

  return { overall, byEmployee, year, month }
}

export async function exportMonthlyXlsx(year: number, month: number) {
  const from  = new Date(year, month - 1, 1)
  const to    = new Date(year, month,     0, 23, 59, 59)
  const label = `${String(month).padStart(2, '0')}.${year}`

  const { overall, byEmployee } = await getMonthlySummary(year, month)

  const details = await prisma.materialUsage.findMany({
    where:   { usedAt: { gte: from, lte: to } },
    include: usageInclude,
    orderBy: [{ usedAt: 'asc' }, { user: { fullName: 'asc' } }],
  })

  const wb = XLSX.utils.book_new()

  const ws1 = XLSX.utils.json_to_sheet(
    details.map(r => ({
      'Data':          r.usedAt.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      'Pracownik':     r.user.fullName,
      'Nr katalogowy': r.material.catalogNumber ?? '',
      'Materiał':      r.material.name,
      'Ilość':         Number(r.quantity),
      'Jednostka':     r.unit,
      'Uwagi':         r.notes ?? '',
    }))
  )
  ws1['!cols'] = [{ wch: 12 }, { wch: 22 }, { wch: 16 }, { wch: 50 }, { wch: 10 }, { wch: 12 }, { wch: 30 }]
  XLSX.utils.book_append_sheet(wb, ws1, 'Szczegóły')

  const ws2 = XLSX.utils.json_to_sheet(
    overall.map(r => ({
      'Nr katalogowy': r.catalogNumber,
      'Materiał':      r.materialName,
      'Ilość':         r.totalQuantity,
      'Jednostka':     r.unit,
      'Pobrań':        r.usageCount,
    }))
  )
  ws2['!cols'] = [{ wch: 16 }, { wch: 50 }, { wch: 10 }, { wch: 12 }, { wch: 10 }]
  XLSX.utils.book_append_sheet(wb, ws2, 'Ogólne')

  const rows3: Record<string, unknown>[] = []
  for (const emp of byEmployee) {
    for (const mat of emp.materials) {
      rows3.push({
        'Pracownik':     emp.fullName,
        'Nr katalogowy': mat.catalogNumber,
        'Materiał':      mat.materialName,
        'Ilość':         mat.totalQuantity,
        'Jednostka':     mat.unit,
      })
    }
  }
  const ws3 = XLSX.utils.json_to_sheet(
    rows3.length > 0
      ? rows3
      : [{ 'Pracownik': '', 'Nr katalogowy': '', 'Materiał': '', 'Ilość': '', 'Jednostka': '' }]
  )
  ws3['!cols'] = [{ wch: 22 }, { wch: 16 }, { wch: 50 }, { wch: 10 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(wb, ws3, 'Per pracownik')

  return { buffer: XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }), label }
}
