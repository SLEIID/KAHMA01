import { prisma } from '../../lib/prisma'
import { ApiError } from '../../shared/ApiError'
import { CreateVehicleDto, UpdateVehicleDto } from './vehicles.schemas'

export async function getAll(onlyActive = false) {
  return prisma.vehicle.findMany({
    where:   onlyActive ? { isActive: true } : undefined,
    orderBy: { name: 'asc' },
  })
}

export async function create(dto: CreateVehicleDto) {
  const existing = await prisma.vehicle.findUnique({ where: { plateNumber: dto.plateNumber } })
  if (existing) throw ApiError.conflict('Pojazd z takim numerem rejestracyjnym już istnieje')

  return prisma.vehicle.create({ data: { plateNumber: dto.plateNumber, name: dto.name } })
}

export async function update(id: number, dto: UpdateVehicleDto) {
  const vehicle = await prisma.vehicle.findUnique({ where: { id } })
  if (!vehicle) throw ApiError.notFound('Pojazd nie istnieje')

  if (dto.plateNumber && dto.plateNumber !== vehicle.plateNumber) {
    const existing = await prisma.vehicle.findUnique({ where: { plateNumber: dto.plateNumber } })
    if (existing) throw ApiError.conflict('Ten numer rejestracyjny jest już zajęty')
  }

  return prisma.vehicle.update({ where: { id }, data: dto })
}

export async function remove(id: number) {
  const vehicle = await prisma.vehicle.findUnique({ where: { id } })
  if (!vehicle) throw ApiError.notFound('Pojazd nie istnieje')

  const usageCount = await prisma.vehicleUsage.count({ where: { vehicleId: id } })
  if (usageCount > 0) {
    throw ApiError.badRequest('Nie można usunąć pojazdu, który figuruje w raportach. Dezaktywuj go zamiast usuwać.')
  }

  return prisma.vehicle.delete({ where: { id } })
}
