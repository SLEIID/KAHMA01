import { prisma } from '../../lib/prisma'
import { ApiError } from '../../shared/ApiError'
import { RentItemDto, ReturnItemDto, AssignReportDto, ListRentalsQuery } from './equipmentRentals.schemas'

const rentalInclude = {
  item:     { include: { category: true } },
  user:     { select: { id: true, fullName: true } },
  location: { select: { id: true, name: true } },
  report:   { select: { id: true, reportDate: true } },
} as const

function computeExpectedReturn(dto: RentItemDto, from: Date): Date | null {
  if (dto.durationHours) {
    return new Date(from.getTime() + dto.durationHours * 3_600_000)
  }
  if (dto.expectedReturn) {
    return new Date(dto.expectedReturn)
  }
  return null
}

export async function getAll(userId: string, role: string, query?: ListRentalsQuery) {
  const userFilter = role === 'admin' ? {} : { userId }

  let dateFilter = {}
  if (query?.date) {
    const start = new Date(query.date + 'T00:00:00.000Z')
    const end   = new Date(query.date + 'T23:59:59.999Z')
    dateFilter = {
      OR: [
        { rentedAt:   { gte: start, lte: end } },
        { returnedAt: { gte: start, lte: end } },
      ],
    }
  }

  return prisma.equipmentRental.findMany({
    where:   { ...userFilter, ...dateFilter },
    include: rentalInclude,
    orderBy: { rentedAt: 'desc' },
  })
}

export async function rentItem(userId: string, role: string, dto: RentItemDto) {
  const effectiveUserId = (role === 'admin' && dto.userId) ? dto.userId : userId
  const rentedAt = (role === 'admin' && dto.rentedAt) ? new Date(dto.rentedAt) : new Date()

  if (role !== 'admin') {
    const user = await prisma.user.findUnique({ where: { id: effectiveUserId }, select: { canRentEquipment: true } })
    if (!user?.canRentEquipment) throw ApiError.forbidden('Brak uprawnień do wypożyczania sprzętu')
  }

  const [item, location] = await Promise.all([
    prisma.equipmentItem.findUnique({ where: { id: dto.itemId } }),
    prisma.location.findUnique({ where: { id: dto.locationId } }),
  ])
  if (!item)     throw ApiError.notFound('Sprzęt nie istnieje')
  if (!location) throw ApiError.notFound('Lokalizacja nie istnieje')
  if (item.status !== 'available') throw ApiError.badRequest('Sprzęt jest niedostępny')

  return prisma.$transaction(async (tx) => {
    await tx.equipmentItem.update({ where: { id: dto.itemId }, data: { status: 'rented' } })
    return tx.equipmentRental.create({
      data: {
        itemId:         dto.itemId,
        userId:         effectiveUserId,
        locationId:     dto.locationId,
        rentedAt,
        expectedReturn: computeExpectedReturn(dto, rentedAt),
      },
      include: rentalInclude,
    })
  })
}

export async function returnItem(rentalId: string, userId: string, role: string, dto: ReturnItemDto) {
  const rental = await prisma.equipmentRental.findUnique({ where: { id: rentalId } })
  if (!rental)           throw ApiError.notFound('Wypożyczenie nie istnieje')
  if (rental.returnedAt) throw ApiError.badRequest('Sprzęt został już zwrócony')
  if (role !== 'admin' && rental.userId !== userId) throw ApiError.forbidden()

  return prisma.$transaction(async (tx) => {
    await tx.equipmentItem.update({ where: { id: rental.itemId }, data: { status: 'available' } })
    return tx.equipmentRental.update({
      where:   { id: rentalId },
      data:    { returnedAt: new Date(), returnNotes: dto.returnNotes ?? null },
      include: rentalInclude,
    })
  })
}

export async function assignReport(rentalId: string, userId: string, role: string, dto: AssignReportDto) {
  const rental = await prisma.equipmentRental.findUnique({ where: { id: rentalId } })
  if (!rental) throw ApiError.notFound('Wypożyczenie nie istnieje')
  if (role !== 'admin' && rental.userId !== userId) throw ApiError.forbidden()

  if (dto.reportId) {
    const report = await prisma.dailyReport.findUnique({ where: { id: dto.reportId } })
    if (!report) throw ApiError.notFound('Raport nie istnieje')
  }

  return prisma.equipmentRental.update({
    where:   { id: rentalId },
    data:    { reportId: dto.reportId },
    include: rentalInclude,
  })
}
