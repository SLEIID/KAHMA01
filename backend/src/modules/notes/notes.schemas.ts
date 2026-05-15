import { z } from 'zod'

export const createNoteSchema = z.object({
  title:   z.string().min(1, 'Podaj tytuł').max(200, 'Tytuł max 200 znaków'),
  content: z.string().min(1, 'Podaj treść notatki'),
})

export const updateNoteSchema = z.object({
  title:   z.string().min(1).max(200).optional(),
  content: z.string().min(1).optional(),
})

export const listNotesSchema = z.object({
  userId: z.string().uuid().optional(),
  page:   z.coerce.number().int().min(1).default(1),
  limit:  z.coerce.number().int().min(1).max(100).default(20),
})

export type CreateNoteDto   = z.infer<typeof createNoteSchema>
export type UpdateNoteDto   = z.infer<typeof updateNoteSchema>
export type ListNotesQuery  = z.infer<typeof listNotesSchema>
