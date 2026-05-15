import { prisma } from '../../lib/prisma'
import { ApiError } from '../../shared/ApiError'
import { CreateDepartmentDto, UpdateDepartmentDto, ListDepartmentsQuery } from './departments.schemas'

export async function list(query: ListDepartmentsQuery) {
  return prisma.department.findMany({
    where: {
      ...(query.locationId ? { locationId: query.locationId } : {}),
    },
    include: { location: { select: { id: true, name: true } } },
    orderBy: [{ locationId: 'asc' }, { name: 'asc' }],
  })
}

export async function create(dto: CreateDepartmentDto) {
  const loc = await prisma.location.findUnique({ where: { id: dto.locationId } })
  if (!loc) throw ApiError.notFound('Lokalizacja nie istnieje')

  const existing = await prisma.department.findUnique({
    where: { locationId_name: { locationId: dto.locationId, name: dto.name } },
  })
  if (existing) throw ApiError.conflict('Wydział o tej nazwie już istnieje w tej lokalizacji')

  return prisma.department.create({
    data: { locationId: dto.locationId, name: dto.name },
    include: { location: { select: { id: true, name: true } } },
  })
}

export async function update(id: number, dto: UpdateDepartmentDto) {
  const dept = await prisma.department.findUnique({ where: { id } })
  if (!dept) throw ApiError.notFound('Wydział nie istnieje')

  if (dto.name && dto.name !== dept.name) {
    const existing = await prisma.department.findUnique({
      where: { locationId_name: { locationId: dept.locationId, name: dto.name } },
    })
    if (existing) throw ApiError.conflict('Wydział o tej nazwie już istnieje w tej lokalizacji')
  }

  return prisma.department.update({
    where: { id },
    data: dto,
    include: { location: { select: { id: true, name: true } } },
  })
}
