import { prisma } from '../../lib/prisma'
import { ApiError } from '../../shared/ApiError'
import { CreateContractorDto, UpdateContractorDto, ListContractorsQuery } from './contractors.schemas'

const contractorSelect = {
  id:              true,
  type:            true,
  name:            true,
  nip:             true,
  street:          true,
  buildingNumber:  true,
  apartmentNumber: true,
  postalCode:      true,
  city:            true,
  country:         true,
  email:           true,
  phone:           true,
  isVatPayer:      true,
  isActive:        true,
  createdAt:       true,
  updatedAt:       true,
}

export async function list(query: ListContractorsQuery) {
  const where: Record<string, unknown> = {}

  if (query.isActive !== undefined) {
    where.isActive = query.isActive === 'true'
  }
  if (query.type) {
    where.type = query.type
  }
  if (query.q && query.q.trim().length > 0) {
    const term = query.q.trim()
    where.OR = [
      { name: { contains: term, mode: 'insensitive' } },
      { nip:  { contains: term } },
    ]
  }

  return prisma.contractor.findMany({
    where,
    select: contractorSelect,
    orderBy: { name: 'asc' },
  })
}

export async function getById(id: string) {
  const c = await prisma.contractor.findUnique({
    where: { id },
    select: { ...contractorSelect, locations: { select: { id: true, name: true, isActive: true } } },
  })
  if (!c) throw ApiError.notFound('Kontrahent nie istnieje')
  return c
}

export async function create(dto: CreateContractorDto) {
  if (dto.nip) {
    const existing = await prisma.contractor.findFirst({ where: { nip: dto.nip } })
    if (existing) throw ApiError.conflict('Kontrahent z tym NIP już istnieje')
  }
  return prisma.contractor.create({
    data: {
      type:            dto.type ?? 'client',
      name:            dto.name,
      nip:             dto.nip ?? null,
      street:          dto.street ?? null,
      buildingNumber:  dto.buildingNumber ?? null,
      apartmentNumber: dto.apartmentNumber ?? null,
      postalCode:      dto.postalCode ?? null,
      city:            dto.city ?? null,
      country:         dto.country ?? 'PL',
      email:           dto.email ?? null,
      phone:           dto.phone ?? null,
      isVatPayer:      dto.isVatPayer ?? true,
    },
    select: contractorSelect,
  })
}

export async function update(id: string, dto: UpdateContractorDto) {
  const c = await prisma.contractor.findUnique({ where: { id } })
  if (!c) throw ApiError.notFound('Kontrahent nie istnieje')

  if (dto.nip && dto.nip !== c.nip) {
    const existing = await prisma.contractor.findFirst({ where: { nip: dto.nip } })
    if (existing) throw ApiError.conflict('Kontrahent z tym NIP już istnieje')
  }

  return prisma.contractor.update({
    where: { id },
    data: dto,
    select: contractorSelect,
  })
}
