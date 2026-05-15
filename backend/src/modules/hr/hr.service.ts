import { prisma } from '../../lib/prisma'
import { ApiError } from '../../shared/ApiError'
import * as XLSX from 'xlsx'
import type { CreateLeaveRequestDto, ReviewLeaveRequestDto, UpdateBalanceDto } from './hr.schemas'

// ─── helpers ──────────────────────────────────────────────────────────────────

function parseLocalDate(str: string): Date {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function countWorkdays(from: Date, to: Date): number {
  let count = 0
  const cur = new Date(from)
  cur.setHours(0, 0, 0, 0)
  const end = new Date(to)
  end.setHours(0, 0, 0, 0)
  while (cur <= end) {
    const day = cur.getDay()
    if (day !== 0 && day !== 6) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

function minsFromTime(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function dateToStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ─── leave types ──────────────────────────────────────────────────────────────

export async function getLeaveTypes() {
  return prisma.leaveType.findMany({ orderBy: { id: 'asc' } })
}

// ─── balances ─────────────────────────────────────────────────────────────────

const L4_NAME = 'L4'

async function getL4TypeId(): Promise<number | null> {
  const t = await prisma.leaveType.findFirst({ where: { name: L4_NAME } })
  return t?.id ?? null
}

async function computeApprovedDays(userId: string, year: number, l4TypeId: number | null): Promise<number> {
  const yearStart = new Date(year, 0, 1)
  const yearEnd   = new Date(year, 11, 31, 23, 59, 59)
  const result = await prisma.leaveRequest.aggregate({
    where: {
      userId,
      status:      'approved',
      leaveTypeId: l4TypeId ? { not: l4TypeId } : undefined,
      dateFrom:    { gte: yearStart },
      dateTo:      { lte: yearEnd },
    },
    _sum: { daysCount: true },
  })
  return result._sum.daysCount ?? 0
}

async function getOrCreateBalance(userId: string, year: number) {
  return prisma.leaveBalance.upsert({
    where:  { userId_year: { userId, year } },
    create: { userId, year, totalDays: 26, usedDaysCarry: 0 },
    update: {},
  })
}

export async function getMyBalance(userId: string) {
  const year = new Date().getFullYear()
  const [balance, l4Id] = await Promise.all([
    getOrCreateBalance(userId, year),
    getL4TypeId(),
  ])
  const approvedDays = await computeApprovedDays(userId, year, l4Id)
  return {
    year,
    totalDays:     balance.totalDays,
    usedDaysCarry: balance.usedDaysCarry,
    approvedDays,
    remainingDays: balance.totalDays - balance.usedDaysCarry - approvedDays,
  }
}

export async function getAllBalances() {
  const year = new Date().getFullYear()
  const [users, l4Id] = await Promise.all([
    prisma.user.findMany({
      where:   { isActive: true },
      select:  { id: true, fullName: true },
      orderBy: { fullName: 'asc' },
    }),
    getL4TypeId(),
  ])

  await Promise.all(users.map(u => getOrCreateBalance(u.id, year)))

  const balances = await prisma.leaveBalance.findMany({
    where: { year, userId: { in: users.map(u => u.id) } },
  })
  const balanceMap = Object.fromEntries(balances.map(b => [b.userId, b]))

  return Promise.all(users.map(async (u) => {
    const balance      = balanceMap[u.id]
    const approvedDays = await computeApprovedDays(u.id, year, l4Id)
    return {
      userId:        u.id,
      fullName:      u.fullName,
      year,
      totalDays:     balance.totalDays,
      usedDaysCarry: balance.usedDaysCarry,
      approvedDays,
      remainingDays: balance.totalDays - balance.usedDaysCarry - approvedDays,
    }
  }))
}

export async function updateBalance(userId: string, dto: UpdateBalanceDto) {
  const year = new Date().getFullYear()
  await getOrCreateBalance(userId, year)
  return prisma.leaveBalance.update({
    where: { userId_year: { userId, year } },
    data:  { totalDays: dto.totalDays, usedDaysCarry: dto.usedDaysCarry },
  })
}

// ─── requests ─────────────────────────────────────────────────────────────────

const requestInclude = {
  user:      { select: { id: true, fullName: true } },
  leaveType: true,
  reviewer:  { select: { id: true, fullName: true } },
} as const

export async function getRequests(
  userId: string, role: string, status?: string, filterUserId?: string,
) {
  const where: Record<string, unknown> = {}
  if (role !== 'admin') where.userId = userId
  else if (filterUserId) where.userId = filterUserId
  if (status) where.status = status

  return prisma.leaveRequest.findMany({
    where,
    include: requestInclude,
    orderBy: { createdAt: 'desc' },
  })
}

export async function createRequest(userId: string, dto: CreateLeaveRequestDto) {
  const dateFrom = parseLocalDate(dto.dateFrom)
  const dateTo   = parseLocalDate(dto.dateTo)

  if (dateTo < dateFrom) throw ApiError.badRequest('Data końcowa musi być późniejsza niż początkowa')

  const daysCount = countWorkdays(dateFrom, dateTo)
  if (daysCount === 0) throw ApiError.badRequest('Wybrany zakres nie zawiera dni roboczych')

  const leaveType = await prisma.leaveType.findUnique({ where: { id: dto.leaveTypeId } })
  if (!leaveType) throw ApiError.notFound('Typ urlopu nie istnieje')

  const l4Id = await getL4TypeId()
  const isL4 = l4Id === dto.leaveTypeId

  if (!isL4) {
    const year     = dateFrom.getFullYear()
    const balance  = await getOrCreateBalance(userId, year)
    const approved = await computeApprovedDays(userId, year, l4Id)
    const remaining = balance.totalDays - balance.usedDaysCarry - approved
    if (daysCount > remaining) {
      throw ApiError.badRequest(
        `Niewystarczające saldo urlopowe. Pozostało: ${remaining} dni, wniosek: ${daysCount} dni`,
      )
    }
  }

  const overlap = await prisma.leaveRequest.findFirst({
    where: {
      userId,
      status:   { in: ['pending', 'approved'] },
      dateFrom: { lte: dateTo },
      dateTo:   { gte: dateFrom },
    },
  })
  if (overlap) throw ApiError.conflict('Masz już wniosek na ten okres')

  return prisma.leaveRequest.create({
    data: {
      userId,
      leaveTypeId: dto.leaveTypeId,
      dateFrom,
      dateTo,
      daysCount,
      notes: dto.notes ?? null,
    },
    include: requestInclude,
  })
}

export async function reviewRequest(requestId: string, reviewerId: string, dto: ReviewLeaveRequestDto) {
  const request = await prisma.leaveRequest.findUnique({ where: { id: requestId } })
  if (!request) throw ApiError.notFound('Wniosek nie istnieje')

  return prisma.leaveRequest.update({
    where: { id: requestId },
    data:  {
      status:        dto.status,
      reviewedById:  reviewerId,
      reviewedAt:    new Date(),
      reviewComment: dto.reviewComment ?? null,
    },
    include: requestInclude,
  })
}

export async function cancelRequest(requestId: string, userId: string) {
  const request = await prisma.leaveRequest.findUnique({ where: { id: requestId } })
  if (!request)              throw ApiError.notFound('Wniosek nie istnieje')
  if (request.userId !== userId) throw ApiError.forbidden()
  if (request.status !== 'pending') throw ApiError.badRequest('Można cofnąć tylko wniosek oczekujący')

  await prisma.leaveRequest.delete({ where: { id: requestId } })
}

// ─── attendance ───────────────────────────────────────────────────────────────

export async function getAttendance(year: number, month: number) {
  const start = new Date(year, month - 1, 1)
  const end   = new Date(year, month, 0)

  const [users, reports, leaves] = await Promise.all([
    prisma.user.findMany({
      where:   { isActive: true },
      select:  { id: true, fullName: true },
      orderBy: { fullName: 'asc' },
    }),
    prisma.dailyReport.findMany({
      where:   { reportDate: { gte: start, lte: end } },
      include: {
        entries:    { select: { workStart: true, workEnd: true } },
        user:       { select: { id: true } },
        signatures: { select: { signerId: true } },
      },
    }),
    prisma.leaveRequest.findMany({
      where: {
        status:   'approved',
        dateFrom: { lte: end },
        dateTo:   { gte: start },
      },
      include: {
        leaveType: { select: { name: true } },
        user:      { select: { id: true } },
      },
    }),
  ])

  const daysInMonth = end.getDate()

  // userId → dateStr → minutes worked (autor + sygnatariusze), potem konwersja na godziny
  const minsMap: Record<string, Record<string, number>> = {}
  for (const r of reports) {
    const ds = dateToStr(r.reportDate)
    let totalMins = 0
    for (const e of r.entries) {
      const diff = minsFromTime(e.workEnd) - minsFromTime(e.workStart)
      if (diff > 0) totalMins += diff
    }

    const creditTo = [r.user.id, ...r.signatures.map(s => s.signerId)]
    for (const uid of creditTo) {
      if (!minsMap[uid]) minsMap[uid] = {}
      minsMap[uid][ds] = (minsMap[uid][ds] ?? 0) + totalMins
    }
  }
  const reportMap: Record<string, Record<string, number>> = {}
  for (const [uid, days] of Object.entries(minsMap)) {
    reportMap[uid] = {}
    for (const [ds, mins] of Object.entries(days)) {
      reportMap[uid][ds] = mins  // minuty (całkowite)
    }
  }

  // userId → dateStr → leaveTypeName
  const leaveMap: Record<string, Record<string, string>> = {}
  for (const req of leaves) {
    const uid = req.user.id
    if (!leaveMap[uid]) leaveMap[uid] = {}
    const cur = new Date(req.dateFrom)
    const to  = new Date(req.dateTo)
    while (cur <= to) {
      if (cur >= start && cur <= end) leaveMap[uid][dateToStr(cur)] = req.leaveType.name
      cur.setDate(cur.getDate() + 1)
    }
  }

  return {
    year, month, daysInMonth,
    users: users.map(u => {
      const days: Record<string, { hours: number | null; leaveType: string | null }> = {}
      let totalHours = 0
      for (let d = 1; d <= daysInMonth; d++) {
        const ds = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        const minutes  = reportMap[u.id]?.[ds] ?? null
        const leaveType = leaveMap[u.id]?.[ds] ?? null
        if (minutes !== null) totalHours += minutes
        days[ds] = { hours: minutes, leaveType }
      }
      return { id: u.id, fullName: u.fullName, days, totalHours }
    }),
  }
}

// ─── calendar ─────────────────────────────────────────────────────────────────

export async function getCalendar(year: number, month: number) {
  const start = new Date(year, month - 1, 1)
  const end   = new Date(year, month, 0)

  return prisma.leaveRequest.findMany({
    where: {
      status:   'approved',
      dateFrom: { lte: end },
      dateTo:   { gte: start },
    },
    include: {
      user:      { select: { id: true, fullName: true } },
      leaveType: { select: { name: true } },
    },
    orderBy: { dateFrom: 'asc' },
  })
}

// ─── attendance export ────────────────────────────────────────────────────────

function fmtMins(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

const MONTH_NAMES_PL = [
  'Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec',
  'Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień',
]

export async function exportAttendanceXlsx(year: number, month: number): Promise<Buffer> {
  const data = await getAttendance(year, month)

  const monthPad = String(month).padStart(2, '0')
  const header = [
    'Pracownik',
    ...Array.from({ length: data.daysInMonth }, (_, i) => `${i + 1}.${monthPad}.${year}`),
    'Suma',
  ]

  const rows = data.users.map(u => {
    const row: (string | number)[] = [u.fullName]
    for (let d = 1; d <= data.daysInMonth; d++) {
      const ds   = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const cell = u.days[ds]
      const dow  = new Date(year, month - 1, d).getDay()
      if (dow === 0 || dow === 6) { row.push(''); continue }
      if (!cell)                  { row.push(''); continue }
      if (cell.hours !== null)    { row.push(fmtMins(cell.hours)); continue }
      if (cell.leaveType)         { row.push(`U (${cell.leaveType})`); continue }
      row.push('')
    }
    row.push(fmtMins(u.totalHours))
    return row
  })

  const ws = XLSX.utils.aoa_to_sheet([header, ...rows])

  // szerokości kolumn
  ws['!cols'] = [
    { wch: 28 },
    ...Array.from({ length: data.daysInMonth }, () => ({ wch: 10 })),
    { wch: 12 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, `${MONTH_NAMES_PL[month - 1]} ${year}`)

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}
