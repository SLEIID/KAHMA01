import { prisma } from '../../lib/prisma'
import { ApiError } from '../../shared/ApiError'
import { CreateLocationDto, UpdateLocationDto } from './locations.schemas'

const locationSelect = {
  id:         true,
  name:       true,
  isActive:   true,
  createdAt:  true,
  contractor: {
    select: {
      id:   true,
      name: true,
      nip:  true,
      city: true,
      type: true,
    },
  },
}

export async function list(isAdmin: boolean) {
  return prisma.location.findMany({
    where: isAdmin ? undefined : { isActive: true },
    select: locationSelect,
    orderBy: { name: 'asc' },
  })
}

export async function create(dto: CreateLocationDto) {
  const existing = await prisma.location.findUnique({ where: { name: dto.name } })
  if (existing) throw ApiError.conflict('Lokalizacja o tej nazwie już istnieje')
  return prisma.location.create({
    data:   { name: dto.name },
    select: locationSelect,
  })
}

export async function update(id: number, dto: UpdateLocationDto) {
  const loc = await prisma.location.findUnique({ where: { id } })
  if (!loc) throw ApiError.notFound('Lokalizacja nie istnieje')

  if (dto.name && dto.name !== loc.name) {
    const existing = await prisma.location.findUnique({ where: { name: dto.name } })
    if (existing) throw ApiError.conflict('Lokalizacja o tej nazwie już istnieje')
  }

  if (dto.contractorId !== undefined && dto.contractorId !== null) {
    const contractor = await prisma.contractor.findUnique({ where: { id: dto.contractorId } })
    if (!contractor) throw ApiError.notFound('Kontrahent nie istnieje')
  }

  return prisma.location.update({
    where:  { id },
    data:   dto,
    select: locationSelect,
  })
}
