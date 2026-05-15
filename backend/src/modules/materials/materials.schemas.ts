import { z } from 'zod'

export const searchSchema = z.object({
  q: z.string().optional(),
})

export const createMaterialSchema = z.object({
  catalogNumber: z.string().max(100).optional().nullable(),
  name:          z.string().min(2).max(300),
})

export const updateMaterialSchema = z.object({
  catalogNumber: z.string().max(100).optional().nullable(),
  name:          z.string().min(2).max(300).optional(),
})

export const bulkCreateSchema = z.object({
  names: z.array(z.string().min(2).max(300)).min(1).max(500),
})

export type SearchDto         = z.infer<typeof searchSchema>
export type CreateMaterialDto = z.infer<typeof createMaterialSchema>
export type UpdateMaterialDto = z.infer<typeof updateMaterialSchema>
export type BulkCreateDto     = z.infer<typeof bulkCreateSchema>
