import { z } from 'zod'

export const createCategorySchema = z.object({
  name: z.string().min(2).max(100),
})

export const createItemSchema = z.object({
  categoryId:   z.coerce.number().int().positive(),
  name:         z.string().min(2).max(200),
  serialNumber: z.string().max(100).optional(),
  notes:        z.string().optional(),
})

export const updateItemSchema = z.object({
  name:         z.string().min(2).max(200).optional(),
  serialNumber: z.string().max(100).nullable().optional(),
  status:       z.enum(['available', 'service', 'retired']).optional(),
  notes:        z.string().nullable().optional(),
  categoryId:   z.coerce.number().int().positive().optional(),
})

export type CreateCategoryDto = z.infer<typeof createCategorySchema>
export type CreateItemDto     = z.infer<typeof createItemSchema>
export type UpdateItemDto     = z.infer<typeof updateItemSchema>
