import { prisma } from '../../lib/prisma'
import { ApiError } from '../../shared/ApiError'
import { CreateCategoryDto, CreateItemDto, UpdateItemDto } from './equipment.schemas'

const activeRentalInclude = {
  rentals: {
    where: { returnedAt: null },
    include: {
      user:     { select: { id: true, fullName: true } },
      location: { select: { id: true, name: true } },
    },
    take: 1,
  },
} as const

export async function getAllCategories() {
  return prisma.equipmentCategory.findMany({ orderBy: { name: 'asc' } })
}

export async function getAllItems(role: string) {
  return prisma.equipmentItem.findMany({
    where: role === 'admin' ? undefined : { status: { not: 'retired' } },
    include: { category: true, ...activeRentalInclude },
    orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }],
  })
}

export async function createCategory(dto: CreateCategoryDto) {
  const existing = await prisma.equipmentCategory.findUnique({ where: { name: dto.name } })
  if (existing) throw ApiError.conflict('Kategoria o tej nazwie już istnieje')
  return prisma.equipmentCategory.create({ data: dto })
}

export async function createItem(dto: CreateItemDto) {
  const category = await prisma.equipmentCategory.findUnique({ where: { id: dto.categoryId } })
  if (!category) throw ApiError.notFound('Kategoria nie istnieje')
  return prisma.equipmentItem.create({
    data: dto,
    include: { category: true, ...activeRentalInclude },
  })
}

export async function updateItem(id: number, dto: UpdateItemDto) {
  const item = await prisma.equipmentItem.findUnique({ where: { id } })
  if (!item) throw ApiError.notFound('Sprzęt nie istnieje')

  if (dto.categoryId) {
    const category = await prisma.equipmentCategory.findUnique({ where: { id: dto.categoryId } })
    if (!category) throw ApiError.notFound('Kategoria nie istnieje')
  }

  return prisma.equipmentItem.update({
    where: { id },
    data: dto,
    include: { category: true, ...activeRentalInclude },
  })
}

export async function removeItem(id: number) {
  const item = await prisma.equipmentItem.findUnique({ where: { id } })
  if (!item) throw ApiError.notFound('Sprzęt nie istnieje')

  const rentalCount = await prisma.equipmentRental.count({ where: { itemId: id } })
  if (rentalCount > 0) throw ApiError.badRequest('Nie można usunąć sprzętu z historią wypożyczeń. Ustaw status "Wycofany" zamiast usuwać.')

  const issueCount = await prisma.equipmentIssue.count({ where: { itemId: id } })
  if (issueCount > 0) throw ApiError.badRequest('Nie można usunąć sprzętu ze zgłoszeniami. Ustaw status "Wycofany" zamiast usuwać.')

  return prisma.equipmentItem.delete({ where: { id } })
}
