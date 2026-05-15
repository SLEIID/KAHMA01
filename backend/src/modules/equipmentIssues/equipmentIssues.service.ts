import { prisma } from '../../lib/prisma'
import { ApiError } from '../../shared/ApiError'
import { CreateIssueDto, UpdateIssueDto } from './equipmentIssues.schemas'

const issueInclude = {
  item:     { include: { category: true } },
  reporter: { select: { id: true, fullName: true } },
} as const

export async function getAll(userId: string, role: string) {
  return prisma.equipmentIssue.findMany({
    where:   role === 'admin' ? {} : { reportedBy: userId },
    include: issueInclude,
    orderBy: { createdAt: 'desc' },
  })
}

export async function createIssue(userId: string, dto: CreateIssueDto) {
  const item = await prisma.equipmentItem.findUnique({ where: { id: dto.itemId } })
  if (!item) throw ApiError.notFound('Sprzęt nie istnieje')

  return prisma.equipmentIssue.create({
    data:    { itemId: dto.itemId, reportedBy: userId, description: dto.description },
    include: issueInclude,
  })
}

export async function updateIssue(issueId: string, dto: UpdateIssueDto) {
  const issue = await prisma.equipmentIssue.findUnique({ where: { id: issueId } })
  if (!issue) throw ApiError.notFound('Zgłoszenie nie istnieje')

  return prisma.equipmentIssue.update({
    where:   { id: issueId },
    data:    dto,
    include: issueInclude,
  })
}
