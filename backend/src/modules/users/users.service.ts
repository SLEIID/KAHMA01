import bcrypt from 'bcryptjs'
import { prisma } from '../../lib/prisma'
import { env } from '../../config/env'
import { ApiError } from '../../shared/ApiError'
import { CreateUserDto, UpdateUserDto } from './users.schemas'

const userSelect = {
  id: true,
  login: true,
  fullName: true,
  isActive: true,
  canRentEquipment: true,
  canOrder: true,
  canPrepare: true,
  createdAt: true,
  lastLoginAt: true,
  role: { select: { id: true, name: true } },
}

export async function getAll() {
  return prisma.user.findMany({
    select: userSelect,
    orderBy: { fullName: 'asc' },
  })
}

export async function getById(id: string) {
  const user = await prisma.user.findUnique({ where: { id }, select: userSelect })
  if (!user) throw ApiError.notFound('Użytkownik nie istnieje')
  return user
}

export async function create(dto: CreateUserDto) {
  const existing = await prisma.user.findUnique({ where: { login: dto.login } })
  if (existing) throw ApiError.conflict('Login jest już zajęty')

  const role = await prisma.role.findUnique({ where: { name: dto.role } })
  if (!role) throw ApiError.notFound('Rola nie istnieje')

  const passwordHash = await bcrypt.hash(dto.password, env.bcryptRounds)

  return prisma.user.create({
    data: {
      login: dto.login,
      passwordHash,
      fullName: dto.fullName,
      roleId: role.id,
      canRentEquipment: dto.canRentEquipment ?? true,
      canOrder: dto.canOrder ?? false,
      canPrepare: dto.canPrepare ?? false,
    },
    select: userSelect,
  })
}

export async function getMyStats(userId: string) {
  const now   = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  const [ownReports, signedReports, activeRentals, usagesThisMonth] = await Promise.all([
    prisma.dailyReport.findMany({
      where:   { userId, reportDate: { gte: start, lte: end } },
      include: { entries: { select: { workStart: true, workEnd: true } } },
    }),
    prisma.dailyReport.findMany({
      where: {
        reportDate: { gte: start, lte: end },
        signatures: { some: { signerId: userId } },
      },
      include: { entries: { select: { workStart: true, workEnd: true } } },
    }),
    prisma.equipmentRental.count({
      where: { userId, returnedAt: null },
    }),
    prisma.materialUsage.count({
      where: { userId, usedAt: { gte: start, lte: end } },
    }),
  ])

  const minsToNum = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }

  const allReports = [...ownReports, ...signedReports]

  let totalMins = 0
  for (const r of allReports) {
    for (const e of r.entries) {
      const diff = minsToNum(e.workEnd) - minsToNum(e.workStart)
      if (diff > 0) totalMins += diff
    }
  }

  return {
    reportsThisMonth: allReports.length,
    hoursThisMonth:   totalMins,
    activeRentals,
    usagesThisMonth,
  }
}

export async function update(id: string, dto: UpdateUserDto) {
  await getById(id)

  const data: Record<string, unknown> = {}

  if (dto.login !== undefined) {
    const existing = await prisma.user.findUnique({ where: { login: dto.login } })
    if (existing && existing.id !== id) throw ApiError.conflict('Login jest już zajęty')
    data.login = dto.login
  }
  if (dto.fullName !== undefined) data.fullName = dto.fullName
  if (dto.isActive !== undefined) data.isActive = dto.isActive
  if (dto.canRentEquipment !== undefined) data.canRentEquipment = dto.canRentEquipment
  if (dto.canOrder         !== undefined) data.canOrder         = dto.canOrder
  if (dto.canPrepare       !== undefined) data.canPrepare       = dto.canPrepare
  if (dto.password) data.passwordHash = await bcrypt.hash(dto.password, env.bcryptRounds)

  if (dto.role) {
    const role = await prisma.role.findUnique({ where: { name: dto.role } })
    if (!role) throw ApiError.notFound('Rola nie istnieje')
    data.roleId = role.id
  }

  return prisma.user.update({ where: { id }, data, select: userSelect })
}
