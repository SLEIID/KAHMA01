import { prisma } from '../../lib/prisma'
import { ApiError } from '../../shared/ApiError'
import { CreateMaterialDto, UpdateMaterialDto, BulkCreateDto } from './materials.schemas'

export async function search(q: string | undefined, userId: string) {
  if (!q || q.trim().length < 3) {
    return getRecent(userId)
  }

  const words = q.trim().split(/\s+/).filter(w => w.length > 0)

  return prisma.material.findMany({
    where: {
      AND: words.map(word => ({
        name: { contains: word, mode: 'insensitive' },
      })),
    },
    orderBy: { name: 'asc' },
    take: 60,
  })
}

async function getRecent(userId: string) {
  const usages = await prisma.materialUsage.findMany({
    where:   { userId },
    orderBy: { usedAt: 'desc' },
    select:  { materialId: true },
    take:    300,
  })

  const seen = new Set<number>()
  const ids:  number[] = []
  for (const u of usages) {
    if (!seen.has(u.materialId)) {
      seen.add(u.materialId)
      ids.push(u.materialId)
      if (ids.length === 30) break
    }
  }

  if (ids.length === 0) return []

  const materials = await prisma.material.findMany({ where: { id: { in: ids } } })
  const map = new Map(materials.map(m => [m.id, m]))
  return ids.map(id => map.get(id)!).filter(Boolean)
}

export async function getAll() {
  return prisma.material.findMany({ orderBy: { name: 'asc' } })
}

export async function create(dto: CreateMaterialDto) {
  return prisma.material.create({
    data: { name: dto.name, catalogNumber: dto.catalogNumber ?? null },
  })
}

export async function update(id: number, dto: UpdateMaterialDto) {
  const mat = await prisma.material.findUnique({ where: { id } })
  if (!mat) throw ApiError.notFound('Materiał nie istnieje')
  return prisma.material.update({ where: { id }, data: dto })
}

export async function bulkCreate(dto: BulkCreateDto) {
  const names = [...new Set(dto.names.map(n => n.trim()).filter(n => n.length >= 2))]
  await prisma.material.createMany({
    data:           names.map(name => ({ name })),
    skipDuplicates: true,
  })
  return { inserted: names.length }
}

export async function setPhoto(id: number, photoUrl: string) {
  return prisma.material.update({ where: { id }, data: { photoUrl } })
}
