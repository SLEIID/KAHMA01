import { prisma } from '../../lib/prisma'
import { ApiError } from '../../shared/ApiError'
import { CreateNoteDto, UpdateNoteDto, ListNotesQuery } from './notes.schemas'

const noteSelect = {
  id:        true,
  title:     true,
  content:   true,
  createdAt: true,
  updatedAt: true,
  user:      { select: { id: true, fullName: true, login: true } },
}

export async function list(query: ListNotesQuery, requesterId: string, requesterRole: string) {
  const where: Record<string, unknown> = {}

  if (requesterRole !== 'admin') {
    where.userId = requesterId
  } else if (query.userId) {
    where.userId = query.userId
  }

  const [total, items] = await Promise.all([
    prisma.note.count({ where }),
    prisma.note.findMany({
      where,
      select: noteSelect,
      orderBy: { createdAt: 'desc' },
      skip:  (query.page - 1) * query.limit,
      take:  query.limit,
    }),
  ])

  return { items, total, page: query.page, limit: query.limit, pages: Math.ceil(total / query.limit) }
}

export async function create(userId: string, dto: CreateNoteDto) {
  return prisma.note.create({
    data:   { userId, title: dto.title, content: dto.content },
    select: noteSelect,
  })
}

export async function update(id: string, requesterId: string, requesterRole: string, dto: UpdateNoteDto) {
  const note = await prisma.note.findUnique({ where: { id } })
  if (!note) throw ApiError.notFound('Notatka nie istnieje')
  if (note.userId !== requesterId && requesterRole !== 'admin') throw ApiError.forbidden()

  return prisma.note.update({ where: { id }, data: dto, select: noteSelect })
}

export async function remove(id: string, requesterId: string, requesterRole: string) {
  const note = await prisma.note.findUnique({ where: { id } })
  if (!note) throw ApiError.notFound('Notatka nie istnieje')
  if (note.userId !== requesterId && requesterRole !== 'admin') throw ApiError.forbidden()

  await prisma.note.delete({ where: { id } })
}
