import { z } from 'zod'

export const createIssueSchema = z.object({
  itemId:      z.coerce.number().int().positive(),
  description: z.string().min(5, 'Opis musi mieć co najmniej 5 znaków'),
})

export const updateIssueSchema = z.object({
  status: z.enum(['open', 'resolved']),
})

export type CreateIssueDto = z.infer<typeof createIssueSchema>
export type UpdateIssueDto = z.infer<typeof updateIssueSchema>
