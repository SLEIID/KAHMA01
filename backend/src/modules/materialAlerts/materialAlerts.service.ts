import { prisma } from '../../lib/prisma'
import { ApiError } from '../../shared/ApiError'
import { CreateAlertDto, UpdateAlertDto } from './materialAlerts.schemas'

const alertInclude = {
  material: { select: { id: true, name: true, photoUrl: true } },
  reporter: { select: { id: true, fullName: true } },
} as const

export async function create(
  userId: string,
  dto: CreateAlertDto,
  photoFilename: string | undefined,
) {
  const mat = await prisma.material.findUnique({ where: { id: dto.materialId } })
  if (!mat) throw ApiError.notFound('Materiał nie istnieje')

  const photoUrl = photoFilename
    ? `/api/v1/materials/photo/${photoFilename}`
    : null

  // Transakcja: stwórz alert + opcjonalnie ustaw zdjęcie materiału jeśli nie miał
  const alert = await prisma.$transaction(async (tx) => {
    const created = await tx.materialAlert.create({
      data: {
        materialId: dto.materialId,
        reportedBy: userId,
        photoUrl,
        notes:      dto.notes ?? null,
      },
      include: alertInclude,
    })

    // Jeśli materiał nie ma jeszcze zdjęcia, a ten alert ma zdjęcie → ustaw jako zdjęcie materiału
    if (photoUrl && !mat.photoUrl) {
      await tx.material.update({
        where: { id: dto.materialId },
        data:  { photoUrl },
      })
    }

    return created
  })

  return alert
}

export async function getList(role: string, requesterId: string) {
  return prisma.materialAlert.findMany({
    where:   role === 'admin' ? {} : { reportedBy: requesterId },
    include: alertInclude,
    orderBy: { createdAt: 'desc' },
    take:    200,
  })
}

export async function updateStatus(id: string, role: string, dto: UpdateAlertDto) {
  if (role !== 'admin') throw ApiError.forbidden()
  const alert = await prisma.materialAlert.findUnique({ where: { id } })
  if (!alert) throw ApiError.notFound('Alert nie istnieje')
  return prisma.materialAlert.update({
    where:   { id },
    data:    { status: dto.status },
    include: alertInclude,
  })
}
